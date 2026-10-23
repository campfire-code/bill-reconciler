// 工具声明：微信 / 支付宝账单对账
import { ReceiptText } from 'lucide-react';
import type { BatchTool } from '../kit/types';
import { baseName, fmtYuan, parseBill, parseRules, reconcile, summarize, type Txn } from './core';
import { readGrid, writeReport } from './xlsx';

interface Data { source: string; txns: Txn[]; skipped: number }

const tool: BatchTool = {
  id: 'o10',
  name: '微信 / 支付宝账单对账',
  tagline: '把多份微信、支付宝账单合并成一张表：去掉重复记录、自动分类，按分类、月份、对方汇总。全部在本机处理。',
  icon: ReceiptText,
  category: '办公提效',
  type: 'data',
  mode: 'batch',
  resultView: 'list',
  concurrency: 1,
  accept: { label: '账单', extensions: ['csv', 'xlsx'] },
  params: [
    { key: 'dedupe', label: '去掉重复记录', type: 'toggle', default: true, help: '多份账单的时间范围重叠时，同一笔交易只留一条（按来源、订单号、收支、金额判断）' },
    { key: 'excludeFailed', label: '排除未成功的交易', type: 'toggle', default: true, help: '状态含「关闭」「失败」「已撤销」「未支付」的记录不计入汇总，单独放在「已排除」表里' },
    { key: 'rules', label: '自定义分类规则', type: 'textarea', default: '', rows: 4, placeholder: '每行一条：关键词=分类\n例如：瑞幸=咖啡\n房东=住房', help: '关键词会在「交易对方、商品、交易类型」里查找，比内置规则优先。内置规则只是常见词的粗略匹配，请按自己的习惯补充' },
    { key: 'outName', label: '结果文件名', type: 'text', default: '账单对账结果' },
    { key: 'out', label: '保存到', type: 'folder', default: '' },
  ],

  async run(item, ctx) {
    const grid = await readGrid(await ctx.readFile(item.path!), item.name);
    const { source, txns, skipped } = parseBill(grid, item.name);
    if (!txns.length) throw new Error('账单里没有读到交易记录');
    const s = summarize(txns.filter((t) => !(ctx.params.excludeFailed && t.failed)).map((t) => ({ ...t, category: '' })));
    const data: Data = { source, txns, skipped };
    return { summary: `${source}账单 ${txns.length} 笔，支出 ${fmtYuan(s.total.out)}，收入 ${fmtYuan(s.total.in)}${skipped ? `；${skipped} 行无法识别已跳过` : ''}`, data };
  },

  async afterAll(results, ctx) {
    const ds = results.map((r) => ({ item: r.item, d: r.result.data as Data | undefined })).filter((x): x is { item: typeof x.item; d: Data } => !!x.d);
    if (!ds.length) return;
    const rec = reconcile(ds.flatMap((x) => x.d.txns), { dedupe: Boolean(ctx.params.dedupe), excludeFailed: Boolean(ctx.params.excludeFailed), rules: parseRules(String(ctx.params.rules)) });
    const used = (file: string) => rec.txns.filter((t) => t.file === file).length;
    const info = ds.map((x) => ({ file: x.item.name, source: x.d.source, read: x.d.txns.length, used: used(x.item.name) }));
    const name = String(ctx.params.outName).trim().replace(/[\\/:*?"<>|]/g, '_') || baseName('账单对账结果');
    const path = await ctx.join(ctx.outputDir, `${name}.xlsx`);
    await ctx.writeFile(path, await writeReport(rec, info));
    const t = rec.summary.total;
    return `已合并 ${ds.length} 份账单：计入 ${t.count} 笔，支出 ${fmtYuan(t.out)}，收入 ${fmtYuan(t.in)}；去重 ${rec.duplicates} 条，排除未成功 ${rec.excluded.length} 条。${path}`;
  },
};

export default tool;
