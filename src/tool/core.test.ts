import { describe, expect, it } from 'vitest';
import { categorize, dedupe, parseBill, parseCents, parseCsv, parseRules, reconcile, decodeText, summarize, type Txn } from './core';
import { ALI_SAMPLE, WX_SAMPLE, WX_SAMPLE_2, alipayCsv, wechatCsv } from './build';

const wx = () => parseBill(parseCsv(decodeText(wechatCsv(WX_SAMPLE))), 'wx.csv');
const ali = () => parseBill(parseCsv(decodeText(alipayCsv(ALI_SAMPLE))), 'ali.csv');

describe('解析', () => {
  it('微信账单：跳过前面的说明行，识别金额和收支', () => {
    const r = wx();
    expect(r.source).toBe('微信');
    expect(r.txns).toHaveLength(7);
    expect(r.txns[0]).toMatchObject({ time: '2026-10-01 08:12:30', counterparty: '示例咖啡店', dir: '支出', cents: 1800, orderId: '4200000001', note: '' });
    expect(r.txns[4].dir).toBe('不计收支'); // 零钱提现的收/支是「/」
    expect(r.txns[3]).toMatchObject({ dir: '收入', cents: 8800 });
  });
  it('支付宝账单：GBK 编码、字段后带制表符和空格也能读，关闭的交易被标记', () => {
    const r = ali();
    expect(r.source).toBe('支付宝');
    expect(r.txns).toHaveLength(4);
    expect(r.txns[0]).toMatchObject({ counterparty: '示例火锅店', cents: 16800, orderId: '2026100422001', method: '余额宝' });
    expect(r.txns[1].failed).toBe(true);
    expect(r.txns[2].failed).toBe(false);
  });
  it('不是账单时给出能看懂的错误', () => {
    expect(() => parseBill([['a', 'b'], ['1', '2']], 'x.csv')).toThrow('没有找到账单表头');
    expect(() => parseBill([['交易时间', '金额', '别的']], 'x.csv')).toThrow('表头不像微信或支付宝账单');
  });
  it('金额解析：去掉符号和千分位，用分做整数', () => {
    expect(parseCents('¥1,234.56')).toBe(123456);
    expect(parseCents(0.1 + 0.2)).toBe(30);
    expect(parseCents('abc')).toBeNull();
  });
  it('Excel 里的日期单元格按所见即所得转成文字', () => {
    const r = parseBill([['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号'], [new Date(Date.UTC(2026, 9, 1, 8, 5, 3)), '商户消费', '甲', '乙', '支出', 12.5, '零钱', '支付成功', '1']], 'a.xlsx');
    expect(r.txns[0]).toMatchObject({ time: '2026-10-01 08:05:03', cents: 1250 });
  });
});

describe('去重、分类、汇总', () => {
  it('时间重叠的两份微信账单，重复的两笔只留一条', () => {
    const a = wx().txns;
    const b = parseBill(parseCsv(decodeText(wechatCsv(WX_SAMPLE_2))), 'wx2.csv').txns;
    const r = dedupe([...a, ...b]);
    expect(r.removed).toBe(2);
    expect(r.kept).toHaveLength(9);
  });
  it('分类：自定义规则优先于内置规则', () => {
    const t = { counterparty: '示例咖啡店', item: '拿铁', type: '商户消费', dir: '支出' } as Txn;
    expect(categorize(t, [])).toBe('餐饮');
    expect(categorize(t, parseRules('# 注释\n示例咖啡店 = 提神\n坏行'))).toBe('提神');
    expect(categorize({ counterparty: '某某', item: '', type: '', dir: '支出' } as Txn, [])).toBe('其他');
  });
  it('汇总：不计收支不进金额，按月份和分类归集', () => {
    const rec = reconcile([...wx().txns, ...ali().txns], { dedupe: true, excludeFailed: true, rules: [] });
    expect(rec.excluded).toHaveLength(1); // 支付宝关闭的那笔
    const s = rec.summary;
    // 支出：18+32.5+200+129+168+50 = 597.5；收入：88+8000+退款129 = 8217（退款与原支出相抵）
    expect(s.total.out).toBe(59750);
    expect(s.total.in).toBe(821700);
    expect(s.total.neutral).toBe(1);
    expect(s.byMonth).toEqual([['2026-10', { in: 821700, out: 59750, count: 9 }]]);
    expect(s.byCategory.find(([k]) => k === '餐饮')![1].out).toBe(1800 + 3250 + 16800);
  });
  it('不排除未成功交易时，关闭的交易也计入', () => {
    const rec = reconcile(ali().txns, { dedupe: true, excludeFailed: false, rules: [] });
    expect(rec.excluded).toHaveLength(0);
    expect(summarize(rec.txns).total.out).toBe(16800 + 3990 + 5000);
  });
  it('按时间排序', () => {
    const rec = reconcile([...ali().txns, ...wx().txns], { dedupe: true, excludeFailed: true, rules: [] });
    const times = rec.txns.map((t) => t.time);
    expect(times).toEqual([...times].sort());
  });
});
