// 生成 samples/ 里的示例账单（只在设置了 MAKE_SAMPLES=1 时运行）。内容全部是虚构的示例。
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ALI_SAMPLE, WX_SAMPLE, WX_SAMPLE_2, alipayCsv, wechatCsv, wechatXlsx } from './build';

it.runIf(process.env.MAKE_SAMPLES === '1')('生成示例文件', async () => {
  writeFileSync('samples/示例微信账单-上半月.csv', wechatCsv(WX_SAMPLE));
  writeFileSync('samples/示例微信账单-补充.xlsx', await wechatXlsx(WX_SAMPLE_2));
  writeFileSync('samples/示例支付宝账单.csv', alipayCsv(ALI_SAMPLE));
});
