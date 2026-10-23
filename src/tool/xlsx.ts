// Excel 读写：基于 exceljs（MIT）
import ExcelJS from 'exceljs';
import { decodeText, parseCsv, type Cell, type Reconciled, yuan } from './core';

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  }
  return String(v);
}

/** 读 CSV 或 xlsx 的第一个有数据的工作表，返回二维格子 */
export async function readGrid(bytes: Uint8Array, fileName: string): Promise<Cell[][]> {
  if (/\.(csv|txt)$/i.test(fileName)) return parseCsv(decodeText(bytes));
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new Error('打不开这个 Excel 文件，可能已损坏或有密码');
  }
  let best: Cell[][] = [];
  wb.eachSheet((ws) => {
    const grid: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => { grid[n - 1] = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue); });
    for (let i = 0; i < grid.length; i++) grid[i] ??= [];
    if (grid.length > best.length) best = grid;
  });
  return best;
}

const MONEY = '#,##0.00';

export async function writeReport(r: Reconciled, info: { file: string; source: string; read: number; used: number }[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '篝火 · 微信/支付宝账单对账';
  const sheet = (name: string, header: string[], rows: (string | number)[][], widths: number[], money: number[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(header).font = { bold: true };
    rows.forEach((x) => ws.addRow(x));
    ws.columns.forEach((c, i) => { c.width = widths[i] ?? 14; if (money.includes(i)) c.numFmt = MONEY; });
    return ws;
  };
  const s = r.summary;
  const net = s.total.in - s.total.out;
  const ov = sheet('总览', ['项目', '数值'], [
    ['收入合计（元）', yuan(s.total.in)], ['支出合计（元）', yuan(s.total.out)], ['净额 = 收入 - 支出（元）', yuan(net)],
    ['计入汇总的笔数', s.total.count], ['不计收支的笔数（未计入上面的金额）', s.total.neutral],
    ['去掉的重复记录', r.duplicates], ['排除的未成功交易', r.excluded.length],
  ], [40, 18], []);
  ov.getRow(2).getCell(2).numFmt = MONEY; ov.getRow(3).getCell(2).numFmt = MONEY; ov.getRow(4).getCell(2).numFmt = MONEY;
  ov.addRow([]);
  ov.addRow(['读取的文件', '读到笔数 / 计入笔数']).font = { bold: true };
  for (const i of info) ov.addRow([`${i.file}（${i.source}）`, `${i.read} / ${i.used}`]);
  const agg = (a: { in: number; out: number; count: number }) => [yuan(a.in), yuan(a.out), yuan(a.in - a.out), a.count];
  sheet('按分类', ['分类', '收入（元）', '支出（元）', '净额（元）', '笔数'], s.byCategory.map(([k, a]) => [k, ...agg(a)]), [18, 14, 14, 14, 8], [1, 2, 3]);
  sheet('按月份', ['月份', '收入（元）', '支出（元）', '净额（元）', '笔数'], s.byMonth.map(([k, a]) => [k, ...agg(a)]), [12, 14, 14, 14, 8], [1, 2, 3]);
  sheet('按对方（支出前20）', ['交易对方', '收入（元）', '支出（元）', '净额（元）', '笔数'], s.byCounterparty.map(([k, a]) => [k, ...agg(a)]), [30, 14, 14, 14, 8], [1, 2, 3]);
  const head = ['来源', '交易时间', '交易对方', '商品/说明', '分类', '收/支', '金额（元）', '支付方式', '状态', '订单号', '备注', '来源文件'];
  const line = (t: Reconciled['txns'][number]) => [t.source, t.time, t.counterparty, t.item, t.category, t.dir, yuan(t.cents), t.method, t.status, t.orderId, t.note, t.file];
  const w = [8, 20, 24, 28, 12, 10, 12, 16, 12, 30, 20, 24];
  sheet('明细', head, r.txns.map(line), w, [6]);
  if (r.excluded.length) sheet('已排除（未成功）', head, r.excluded.map(line), w, [6]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
