// 单份账单的读取结果：支出、收入用大字显示，下面按日画出支出柱状图；未成功、跳过的行用小标签提醒
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { InputItem, ItemResult } from '../kit/types';
import { fmtYuan, type Txn } from './core';
import './tool.css';

interface Shown { source: string; txns: Txn[]; skipped: number }

/** 说明里已经算好的支出、收入（和处理时的参数一致），取不到再自己算 */
function money(result: ItemResult, txns: Txn[]) {
  const m = /支出 (¥[\d,.]+)，收入 (¥[\d,.]+)/.exec(result.summary ?? '');
  if (m) return { out: m[1], inc: m[2] };
  const ok = txns.filter((t) => !t.failed);
  const sum = (d: string) => ok.filter((t) => t.dir === d).reduce((a, t) => a + t.cents, 0);
  return { out: fmtYuan(sum('支出')), inc: fmtYuan(sum('收入')) };
}

export function ResultBody({ result }: { item: InputItem; result: ItemResult }) {
  const d = result.data as Shown | undefined;
  if (!d?.txns) return <p className="bl-sub">{result.summary}</p>;
  const { out, inc } = money(result, d.txns);
  const byDay = new Map<string, number>();
  for (const t of d.txns) if (t.dir === '支出' && !t.failed) byDay.set(t.time.slice(0, 10), (byDay.get(t.time.slice(0, 10)) ?? 0) + t.cents);
  const days = [...byDay].sort((a, b) => a[0].localeCompare(b[0])).slice(-31);
  const max = Math.max(1, ...days.map((x) => x[1]));
  const failed = d.txns.filter((t) => t.failed).length;
  const times = d.txns.map((t) => t.time.slice(0, 10)).sort();
  return (
    <div className="bl-body">
      <div className="bl-head">
        <span className={`bl-src ${d.source === '微信' ? 'wx' : 'ali'}`}>{d.source}</span>
        <span className="bl-range k-num">{times[0].slice(5)} 至 {times[times.length - 1].slice(5)}</span>
        <span className="bl-count"><b className="k-num">{d.txns.length}</b> 笔</span>
      </div>
      <div className="bl-money">
        <div className="out"><span><ArrowUpRight size={14} />支出</span><b className="k-num">{out}</b></div>
        <div className="in"><span><ArrowDownLeft size={14} />收入</span><b className="k-num">{inc}</b></div>
      </div>
      {days.length > 0 && (
        <div className="bl-bars" role="img" aria-label={`按日支出柱状图，共 ${days.length} 天有支出`}>
          {days.map(([day, c]) => <i key={day} title={`${day}：${fmtYuan(c)}`} style={{ height: `${Math.max(8, (c / max) * 100)}%` }} />)}
        </div>
      )}
      {(failed > 0 || d.skipped > 0) && (
        <div className="bl-tags">
          {failed > 0 && <span className="warn">{failed} 笔未成功</span>}
          {d.skipped > 0 && <span className="warn">{d.skipped} 行无法识别</span>}
        </div>
      )}
    </div>
  );
}
