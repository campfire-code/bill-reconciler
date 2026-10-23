// 截图与预览用的示例数据（不会进入正式运行）
import type { Row } from '../kit/runner';

const files: [string, number, Row['status'], string?][] = [
  ['示例微信账单-上半月.csv', 3_200, 'ok', '微信账单 7 笔，支出 ¥379.50，收入 ¥217.00'],
  ['示例微信账单-补充.xlsx', 9_800, 'ok', '微信账单 4 笔，支出 ¥189.80，收入 ¥0.00'],
  ['示例支付宝账单.csv', 2_900, 'ok', '支付宝账单 4 笔，支出 ¥218.00，收入 ¥8,000.00'],
  ['示例支付宝账单-十一月.csv', 3_100, 'run'],
  ['示例银行流水.pdf', 120_000, 'err', '只支持微信、支付宝导出的 .csv 或 .xlsx 账单'],
];

export const rows = (state: string): Row[] =>
  state === 'empty' ? [] : files.map(([name, size, status, text], i) => {
    const st = state === 'done' && status !== 'err' ? 'ok' : status;
    return {
      item: { id: `p${i}`, name, path: `/示例/${name}`, size },
      status: st,
      progress: st === 'run' ? 0.5 : st === 'ok' ? 1 : 0,
      error: st === 'err' ? text : undefined,
      result: st === 'ok' ? { summary: text ?? '支付宝账单 3 笔', outputPath: '/示例/输出/账单对账结果.xlsx' } : undefined,
    };
  });

export const params = { dedupe: true, excludeFailed: true };
export const notice = { kind: 'ok' as const, text: '已合并 3 份账单：计入 11 笔，支出 ¥658.30，收入 ¥8,217.00；去重 2 条，排除未成功 1 条' };
