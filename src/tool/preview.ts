// 截图与预览用的示例数据（不会进入正式运行）
import type { Row } from '../kit/runner';
import type { Txn } from './core';

// 示例交易：[日期, 收支, 元, 是否未成功]
const mk = (source: '微信' | '支付宝', list: [string, '收入' | '支出', number, boolean?][]): { source: string; txns: Txn[]; skipped: number } => ({
  source,
  skipped: 0,
  txns: list.map(([d, dir, y, failed], i) => ({ source, time: `2026-10-${d} 12:00:00`, counterparty: '', item: '', type: '', dir, cents: y * 100, method: '', status: failed ? '交易关闭' : '支付成功', orderId: String(i), note: '', file: '', category: '', failed: !!failed })),
});
const wx1 = mk('微信', [['01', '支出', 18], ['02', '支出', 32.5], ['03', '支出', 200], ['05', '收入', 88], ['09', '支出', 129], ['10', '收入', 129], ['12', '支出', 4], ['13', '支出', 56.8], ['15', '支出', 36], ['16', '支出', 22], ['18', '支出', 68], ['20', '支出', 15]]);
const wx2 = mk('微信', [['21', '支出', 4], ['22', '支出', 56.8], ['24', '支出', 129.9], ['26', '支出', 12], ['28', '支出', 33]]);
const ali = mk('支付宝', [['04', '支出', 168], ['10', '支出', 39.9, true], ['20', '收入', 8000], ['25', '支出', 50], ['27', '支出', 88], ['29', '支出', 26]]);

const files: [string, number, Row['status'], string?, unknown?][] = [
  ['示例微信账单-上半月.csv', 3_200, 'ok', '微信账单 12 笔，支出 ¥379.50，收入 ¥217.00', wx1],
  ['示例微信账单-补充.xlsx', 9_800, 'ok', '微信账单 5 笔，支出 ¥234.80，收入 ¥0.00', wx2],
  ['示例支付宝账单.csv', 2_900, 'ok', '支付宝账单 6 笔，支出 ¥332.00，收入 ¥8,000.00；1 行无法识别已跳过', { ...ali, skipped: 1 }],
  ['示例支付宝账单-十一月.csv', 3_100, 'run'],
  ['示例银行流水.pdf', 120_000, 'err', '只支持微信、支付宝导出的 .csv 或 .xlsx 账单'],
];

export const rows = (state: string): Row[] =>
  state === 'empty' ? [] : files.map(([name, size, status, text, data], i) => {
    const st = state === 'done' && status !== 'err' ? 'ok' : status;
    return {
      item: { id: `p${i}`, name, path: `/示例/${name}`, size },
      status: st,
      progress: st === 'run' ? 0.5 : st === 'ok' ? 1 : 0,
      error: st === 'err' ? text : undefined,
      result: st === 'ok' ? { summary: text ?? '支付宝账单 3 笔', outputPath: '/示例/输出/账单对账结果.xlsx', data } : undefined,
    };
  });

export const params = { dedupe: true, excludeFailed: true };
export const notice = { kind: 'ok' as const, text: '已合并 3 份账单：计入 11 笔，支出 ¥658.30，收入 ¥8,217.00；去重 2 条，排除未成功 1 条' };
