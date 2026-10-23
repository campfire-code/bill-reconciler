import { describe, expect, it } from 'vitest';
import tool from './index';
import { ALI_SAMPLE, WX_SAMPLE, WX_SAMPLE_2, alipayCsv, wechatCsv, wechatXlsx } from './build';
import { readGrid } from './xlsx';
import type { InputItem, ItemResult, Params, RunContext } from '../kit/types';
import ExcelJS from 'exceljs';

function fakeCtx(files: Map<string, Uint8Array>, params: Params): RunContext {
  return {
    params, outputDir: '/out', signal: new AbortController().signal, progress: () => {},
    readFile: async (p) => files.get(p)!,
    readText: async (p) => new TextDecoder().decode(files.get(p)!),
    writeFile: async (p, d) => void files.set(p, d),
    writeText: async (p, t) => void files.set(p, new TextEncoder().encode(t)),
    mkdir: async () => {},
    join: async (...parts) => parts.join('/'),
    llm: async () => '', sidecar: async () => '',
  };
}
const defaults = (over: Params = {}): Params => ({ ...Object.fromEntries(tool.params.map((f) => [f.key, f.default])), ...over });
const item = (name: string): InputItem => ({ id: name, name, path: '/in/' + name });

async function runAll(files: Map<string, Uint8Array>, names: string[], over: Params = {}) {
  const ctx = fakeCtx(files, defaults(over));
  const results: { item: InputItem; result: ItemResult }[] = [];
  for (const n of names) results.push({ item: item(n), result: await tool.run(item(n), ctx) });
  return { results, msg: await tool.afterAll!(results, ctx) as string };
}
async function sheet(files: Map<string, Uint8Array>, path: string, name: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(files.get(path)!.buffer as ArrayBuffer);
  return wb.getWorksheet(name)!.getSheetValues().slice(1).map((r) => (r as unknown[]).slice(1));
}

describe('账单对账流程', () => {
  const mk = async () => new Map<string, Uint8Array>([
    ['/in/微信10月上半.csv', wechatCsv(WX_SAMPLE)],
    ['/in/微信补充.xlsx', await wechatXlsx(WX_SAMPLE_2)],
    ['/in/支付宝10月.csv', alipayCsv(ALI_SAMPLE)],
  ]);
  it('三份账单（CSV、xlsx、GBK CSV）合并成一个 xlsx，重复的去掉、关闭的排除', async () => {
    const files = await mk();
    const { results, msg } = await runAll(files, ['微信10月上半.csv', '微信补充.xlsx', '支付宝10月.csv']);
    expect(results[0].result.summary).toContain('微信账单 7 笔');
    expect(results[2].result.summary).toContain('支付宝账单 4 笔');
    expect(msg).toContain('去重 2 条');
    expect(msg).toContain('排除未成功 1 条');
    const detail = await sheet(files, '/out/账单对账结果.xlsx', '明细');
    expect(detail).toHaveLength(1 + 7 + 2 + 3); // 表头 + 微信7 + 补充新增2 + 支付宝去掉关闭后3
    expect(detail[1][1]).toBe('2026-10-01 08:12:30');
    const total = await sheet(files, '/out/账单对账结果.xlsx', '总览');
    expect(total[0]).toEqual(['项目', '数值']);
    expect(total[1][1]).toBeCloseTo(8217, 2); // 收入：88 + 8000 + 退款 129
    expect(total[2][1]).toBeCloseTo(658.3, 2); // 支出：597.5 + 地铁 4 + 超市 56.8
  });
  it('关闭去重时重复记录保留', async () => {
    const files = await mk();
    const { msg } = await runAll(files, ['微信10月上半.csv', '微信补充.xlsx'], { dedupe: false });
    expect(msg).toContain('去重 0 条');
  });
  it('自定义分类规则写进结果', async () => {
    const files = await mk();
    await runAll(files, ['微信10月上半.csv'], { rules: '示例咖啡店=提神' });
    const detail = await sheet(files, '/out/账单对账结果.xlsx', '明细');
    expect(detail[1][4]).toBe('提神');
  });
  it('非账单文件报错', async () => {
    const files = new Map([['/in/x.csv', new TextEncoder().encode('a,b\n1,2')]]);
    await expect(tool.run(item('x.csv'), fakeCtx(files, defaults()))).rejects.toThrow('没有找到账单表头');
  });
  it('readGrid 读 xlsx 返回格子', async () => {
    const g = await readGrid(await wechatXlsx(WX_SAMPLE), 'a.xlsx');
    expect(g.some((r) => r[0] === '交易时间')).toBe(true);
  });
});
