// 测试与示例用：按微信、支付宝账单导出文件的常见版式生成虚构账单（版式依据常见导出样例，未对照最新版本核实）。
import iconv from 'iconv-lite';
import ExcelJS from 'exceljs';

export type WxRow = [time: string, type: string, cp: string, item: string, dir: string, amt: string, method: string, status: string, id: string, merchantId: string, note: string];
export type AliRow = [time: string, cat: string, cp: string, acct: string, item: string, dir: string, amt: string, method: string, status: string, id: string, merchantId: string, note: string];

export const WX_HEAD = ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号', '商户单号', '备注'];
export const ALI_HEAD = ['交易时间', '交易分类', '交易对方', '对方账号', '商品说明', '收/支', '金额', '收/付款方式', '交易状态', '交易订单号', '商家订单号', '备注'];

const csvLine = (r: string[]) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');

export function wechatPreamble(n: number): string[][] {
  return [['微信支付账单明细'], ['微信昵称：[示例用户]'], ['起始时间：[2026-10-01 00:00:00] 终止时间：[2026-10-31 23:59:59]'], ['导出类型：[全部]'], ['导出时间：[2026-11-01 10:00:00]'], [''], [`共${n}笔记录`], [''], ['----------------------微信支付账单明细列表--------------------']];
}

export function wechatCsv(rows: WxRow[]): Uint8Array {
  const lines = [...wechatPreamble(rows.length), WX_HEAD, ...rows].map((r) => csvLine(r));
  return new TextEncoder().encode('﻿' + lines.join('\r\n') + '\r\n');
}

export async function wechatXlsx(rows: WxRow[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('微信支付账单明细');
  for (const r of [...wechatPreamble(rows.length), WX_HEAD]) ws.addRow(r);
  for (const r of rows) ws.addRow(r);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** 支付宝 CSV 常见为 GBK 编码，行尾有多余逗号，字段两侧带空格 */
export function alipayCsv(rows: AliRow[]): Uint8Array {
  const pre = ['支付宝支付科技有限公司', '姓名：示例用户', '起始时间：[2026-10-01 00:00:00]    终止时间：[2026-10-31 23:59:59]', '------------------------支付宝交易记录明细列表------------------------'];
  const body = rows.map((r) => r.map((c) => c + '\t').join(',') + ',');
  const lines = [...pre, ALI_HEAD.join(',') + ',', ...body, '------------------------------------------------------------------------------------'];
  return new Uint8Array(iconv.encode(lines.join('\r\n') + '\r\n', 'gbk'));
}

export const WX_SAMPLE: WxRow[] = [
  ['2026-10-01 08:12:30', '商户消费', '示例咖啡店', '拿铁咖啡', '支出', '¥18.00', '零钱', '支付成功', '4200000001', 'M001', '/'],
  ['2026-10-02 12:40:10', '商户消费', '示例外卖平台', '午餐外卖', '支出', '¥32.50', '招商银行(1234)', '支付成功', '4200000002', 'M002', '/'],
  ['2026-10-03 09:00:00', '转账', '示例朋友', '/', '支出', '¥200.00', '零钱', '朋友已收钱', '4200000003', '/', '还款'],
  ['2026-10-05 18:20:00', '微信红包', '示例朋友', '/', '收入', '¥88.00', '/', '已存入零钱', '4200000004', '/', '/'],
  ['2026-10-08 10:00:00', '零钱提现', '示例银行卡', '/', '/', '¥500.00', '招商银行(1234)', '提现已到账', '4200000005', '/', '/'],
  ['2026-10-09 21:15:00', '商户消费', '示例商城', '蓝牙耳机', '支出', '¥129.00', '零钱', '已全额退款', '4200000006', 'M006', '/'],
  ['2026-10-10 09:00:00', '退款', '示例商城', '蓝牙耳机-退款', '收入', '¥129.00', '零钱', '已退款', '4200000009', 'M006', '/'],
];

export const WX_SAMPLE_2: WxRow[] = [
  WX_SAMPLE[4], WX_SAMPLE[5], // 与上一份重叠的两笔
  ['2026-10-12 07:50:00', '商户消费', '示例地铁', '地铁乘车', '支出', '¥4.00', '零钱', '支付成功', '4200000007', 'M007', '/'],
  ['2026-10-15 13:00:00', '商户消费', '示例超市', '日用品', '支出', '¥56.80', '零钱', '支付成功', '4200000008', 'M008', '/'],
];

export const ALI_SAMPLE: AliRow[] = [
  ['2026-10-04 19:30:00', '餐饮美食', '示例火锅店', '示例账号', '火锅套餐', '支出', '168.00', '余额宝', '交易成功', '2026100422001', 'T001', ''],
  ['2026-10-10 11:00:00', '日用百货', '示例网店', '示例账号', '收纳盒', '支出', '39.90', '花呗', '交易关闭', '2026101022002', 'T002', ''],
  ['2026-10-20 09:00:00', '收入', '示例公司', '示例账号', '十月工资', '收入', '8000.00', '', '交易成功', '2026102022003', 'T003', ''],
  ['2026-10-25 20:00:00', '充值缴费', '示例运营商', '示例账号', '话费充值', '支出', '50.00', '余额', '交易成功', '2026102522004', 'T004', ''],
];
