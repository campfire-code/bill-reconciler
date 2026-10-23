// 纯函数：账单解析、去重、分类、汇总。金额一律用「分」做整数计算，避免小数误差。
export type Cell = string | number | boolean | Date | null;
export type Source = '微信' | '支付宝';
export type Dir = '收入' | '支出' | '不计收支';

export interface Txn {
  source: Source;
  time: string; // YYYY-MM-DD HH:mm:ss
  counterparty: string;
  item: string;
  type: string; // 账单里原有的交易类型 / 交易分类
  dir: Dir;
  cents: number;
  method: string;
  status: string;
  orderId: string;
  note: string;
  file: string;
  category: string;
  failed: boolean;
}

export const baseName = (file: string) => file.replace(/\.[^.]+$/, '');

export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('gbk').decode(bytes); // 支付宝导出的 CSV 常见为 GBK
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const pad = (n: number) => String(n).padStart(2, '0');
function cellStr(v: Cell): string {
  if (v == null) return '';
  // Excel 里的日期按「所见即所得」取，不做时区换算
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
  return String(v).replace(/[\t ]/g, ' ').trim();
}

export function parseCents(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(Math.abs(v) * 100) : null;
  const s = cellStr(v).replace(/[¥￥,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Math.abs(parseFloat(s)) * 100);
}

export interface ParsedBill { source: Source; txns: Txn[]; skipped: number }

/** 解析一份账单的二维表（CSV 或 Excel 读出来的格子）。找不到表头时抛出能看懂的错误 */
export function parseBill(grid: Cell[][], file: string): ParsedBill {
  const rows = grid.map((r) => r.map(cellStr));
  const h = rows.findIndex((r) => r.includes('交易时间') && r.some((c) => c.startsWith('金额')));
  if (h < 0) throw new Error('没有找到账单表头（应有「交易时间」「金额」列）。请确认是微信或支付宝导出的账单，不要手动改过表头');
  const head = rows[h];
  const col = (...names: string[]) => head.findIndex((c) => names.some((n) => c === n || c.startsWith(n)));
  const isWechat = head.includes('交易类型') && head.includes('当前状态');
  const isAlipay = head.includes('交易分类') || head.includes('交易订单号');
  if (!isWechat && !isAlipay) throw new Error('表头不像微信或支付宝账单（微信应有「交易类型」「当前状态」，支付宝应有「交易分类」「交易订单号」）');
  const source: Source = isWechat ? '微信' : '支付宝';
  const ix = {
    time: col('交易时间'), type: col('交易类型', '交易分类'), cp: col('交易对方'),
    item: col('商品说明', '商品'), dir: col('收/支'), amt: col('金额'),
    method: col('支付方式', '收/付款方式'), status: col('当前状态', '交易状态'),
    order: col('交易单号', '交易订单号'), note: col('备注'),
  };
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? '' : '');
  const txns: Txn[] = [];
  let skipped = 0;
  for (let ri = h + 1; ri < rows.length; ri++) {
    const r = rows[ri];
    if (!/^\d{4}-\d{2}-\d{2}/.test(get(r, ix.time))) { if (r.some(Boolean)) skipped++; continue; }
    const cents = parseCents(grid[ri]?.[ix.amt] ?? get(r, ix.amt));
    if (cents == null) { skipped++; continue; }
    const d = get(r, ix.dir);
    const status = get(r, ix.status);
    txns.push({
      source, time: get(r, ix.time).slice(0, 19), counterparty: get(r, ix.cp), item: get(r, ix.item), type: get(r, ix.type),
      dir: d === '收入' || d === '支出' ? d : '不计收支', cents, method: get(r, ix.method), status,
      orderId: get(r, ix.order), note: get(r, ix.note) === '/' ? '' : get(r, ix.note), file, category: '', failed: /关闭|失败|已撤销|未支付/.test(status),
    });
  }
  return { source, txns, skipped };
}

// ---------- 去重 ----------
const keyOf = (t: Txn) => (t.orderId ? [t.source, t.orderId, t.dir, t.cents].join('|') : [t.source, t.time, t.dir, t.cents, t.counterparty, t.item].join('|'));

/** 多份账单时间范围重叠时，同一笔会出现多次：按「来源 + 订单号 + 收支 + 金额」去重，留下先出现的 */
export function dedupe(txns: Txn[]): { kept: Txn[]; removed: number } {
  const seen = new Set<string>();
  const kept: Txn[] = [];
  for (const t of txns) {
    const k = keyOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(t);
  }
  return { kept, removed: txns.length - kept.length };
}

// ---------- 分类 ----------
/** 内置分类关键词：只是常见词的粗略匹配，用户可以在设置里用「关键词=分类」覆盖 */
export const DEFAULT_RULES: [string, string][] = [
  ['红包', '红包转账'], ['转账', '红包转账'],
  ['外卖', '餐饮'], ['美团', '餐饮'], ['饿了么', '餐饮'], ['咖啡', '餐饮'], ['奶茶', '餐饮'], ['餐', '餐饮'], ['饭', '餐饮'], ['面包', '餐饮'], ['火锅', '餐饮'],
  ['地铁', '交通'], ['公交', '交通'], ['打车', '交通'], ['出行', '交通'], ['滴滴', '交通'], ['加油', '交通'], ['停车', '交通'], ['高铁', '交通'], ['火车', '交通'], ['机票', '交通'],
  ['超市', '日用百货'], ['便利店', '日用百货'], ['百货', '日用百货'], ['生鲜', '日用百货'],
  ['话费', '通讯'], ['充值', '通讯'], ['宽带', '通讯'],
  ['电费', '水电燃气'], ['水费', '水电燃气'], ['燃气', '水电燃气'], ['物业', '水电燃气'],
  ['房租', '住房'], ['租金', '住房'],
  ['医院', '医疗'], ['药', '医疗'], ['诊所', '医疗'],
  ['电影', '娱乐'], ['游戏', '娱乐'], ['会员', '娱乐'], ['视频', '娱乐'],
  ['淘宝', '网购'], ['天猫', '网购'], ['京东', '网购'], ['拼多多', '网购'],
  ['工资', '工资收入'], ['退款', '退款'],
];

export function parseRules(text: string): [string, string][] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.search(/[=＝]/);
    return i > 0 ? ([l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]) : null;
  }).filter((r): r is [string, string] => !!r && !!r[0] && !!r[1]);
}

export function categorize(t: Txn, user: [string, string][]): string {
  const text = `${t.counterparty} ${t.item} ${t.type}`;
  for (const [kw, cat] of [...user, ...DEFAULT_RULES]) if (text.includes(kw)) return cat;
  return t.dir === '不计收支' ? '不计收支' : '其他';
}

// ---------- 汇总 ----------
export interface Agg { in: number; out: number; count: number }
export interface Summary {
  total: Agg & { neutral: number };
  byCategory: [string, Agg][];
  byMonth: [string, Agg][];
  byCounterparty: [string, Agg][];
}

const add = (m: Map<string, Agg>, k: string, t: Txn) => {
  const a = m.get(k) ?? { in: 0, out: 0, count: 0 };
  if (t.dir === '收入') a.in += t.cents; else a.out += t.cents;
  a.count++;
  m.set(k, a);
};

/** 汇总只统计「收入」「支出」；「不计收支」（如零钱提现、信用卡还款）单独计数 */
export function summarize(txns: Txn[]): Summary {
  const cat = new Map<string, Agg>(), mon = new Map<string, Agg>(), cp = new Map<string, Agg>();
  const total = { in: 0, out: 0, count: 0, neutral: 0 };
  for (const t of txns) {
    if (t.dir === '不计收支') { total.neutral++; continue; }
    add(cat, t.category, t); add(mon, t.time.slice(0, 7), t); add(cp, t.counterparty || '（未知）', t);
    if (t.dir === '收入') total.in += t.cents; else total.out += t.cents;
    total.count++;
  }
  const byOut = (a: [string, Agg], b: [string, Agg]) => b[1].out - a[1].out || b[1].in - a[1].in;
  return { total, byCategory: [...cat].sort(byOut), byMonth: [...mon].sort((a, b) => a[0].localeCompare(b[0])), byCounterparty: [...cp].sort(byOut).slice(0, 20) };
}

export const yuan = (cents: number) => cents / 100;
export const fmtYuan = (cents: number) => `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface Reconciled { txns: Txn[]; excluded: Txn[]; duplicates: number; summary: Summary }

/** 合并多份账单：去重 → 剔除未成功交易（可选）→ 分类 → 按时间排序 → 汇总 */
export function reconcile(all: Txn[], opts: { dedupe: boolean; excludeFailed: boolean; rules: [string, string][] }): Reconciled {
  const d = opts.dedupe ? dedupe(all) : { kept: all, removed: 0 };
  const sorted = [...d.kept].sort((a, b) => a.time.localeCompare(b.time));
  for (const t of sorted) t.category = categorize(t, opts.rules);
  const excluded = opts.excludeFailed ? sorted.filter((t) => t.failed) : [];
  const txns = opts.excludeFailed ? sorted.filter((t) => !t.failed) : sorted;
  return { txns, excluded, duplicates: d.removed, summary: summarize(txns) };
}
