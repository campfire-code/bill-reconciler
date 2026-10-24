// 空状态：画出「微信账单 + 支付宝账单 → 去重、分类 → 一张总表」，数字和分类都是真实感的中文
import { Upload } from 'lucide-react';
import './tool.css';

const TABS = ['总览', '分类', '月份', '对方', '明细'];

export function Empty({ hover }: { hover: boolean }) {
  return (
    <div className="bl-empty">
      <svg viewBox="0 0 540 220" role="img" aria-label="微信账单和支付宝账单合并，去掉重复记录，按分类汇总成一张 Excel 总表">
        <g>
          <rect x="8" y="14" width="124" height="74" rx="6" className="bl-card wx" />
          <rect x="8" y="14" width="124" height="20" rx="6" className="bl-top wx" />
          <text x="20" y="28" className="bl-tt">微信账单</text>
          {[0, 1, 2].map((i) => <rect key={i} x="20" y={44 + i * 12} width={i === 1 ? 70 : 92} height="5" rx="2.5" className="bl-ln" />)}
          <rect x="8" y="112" width="124" height="74" rx="6" className="bl-card ali" />
          <rect x="8" y="112" width="124" height="20" rx="6" className="bl-top ali" />
          <text x="20" y="126" className="bl-tt">支付宝账单</text>
          {[0, 1, 2].map((i) => <rect key={i} x="20" y={142 + i * 12} width={i === 2 ? 60 : 92} height="5" rx="2.5" className="bl-ln" />)}
        </g>
        <path d="M140 51 H168 V100 H190 M140 149 H168 V112 H190" className="bl-arrow" />
        <g>
          <rect x="194" y="62" width="104" height="76" rx="6" className="bl-step" />
          <text x="246" y="86" textAnchor="middle" className="bl-st1">去掉重复</text>
          <text x="246" y="104" textAnchor="middle" className="bl-st2">同一笔只留一条</text>
          <text x="246" y="124" textAnchor="middle" className="bl-st2">自动归入分类</text>
        </g>
        <path d="M304 100 H340 M332 92 L342 100 L332 108" className="bl-arrow" />
        <g>
          <rect x="350" y="14" width="182" height="172" rx="6" className="bl-card hot" />
          <rect x="350" y="14" width="182" height="24" rx="6" className="bl-top hot" />
          <text x="362" y="31" className="bl-tt">账单对账结果.xlsx</text>
          {[['餐饮', '¥1,286', 84], ['交通', '¥342', 40], ['网购', '¥958', 70], ['住房', '¥3,200', 100]].map(([k, v, w], i) => (
            <g key={k as string}>
              <text x="362" y={62 + i * 24} className="bl-ct">{k}</text>
              <rect x="400" y={52 + i * 24} width="70" height="8" rx="4" className="bl-track" />
              <rect x="400" y={52 + i * 24} width={(Number(w) / 100) * 70} height="8" rx="4" className="bl-fill" />
              <text x="520" y={62 + i * 24} textAnchor="end" className="bl-ct">{v}</text>
            </g>
          ))}
          {TABS.map((t, i) => (
            <g key={t}>
              <rect x={360 + i * 33} y="160" width="30" height="18" rx="4" className={i === 0 ? 'bl-tab on' : 'bl-tab'} />
              <text x={375 + i * 33} y="173" textAnchor="middle" className={i === 0 ? 'bl-tabt on' : 'bl-tabt'}>{t}</text>
            </g>
          ))}
        </g>
        <text x="70" y="208" textAnchor="middle" className="bl-cap">多份账单</text>
        <text x="246" y="208" textAnchor="middle" className="bl-cap">合并整理</text>
        <text x="441" y="208" textAnchor="middle" className="bl-cap">一个 Excel，分表汇总</text>
      </svg>
      <h2 className="bl-title">{hover ? '松开鼠标，开始添加' : '把导出的账单拖进来'}</h2>
      <p className="bl-act"><Upload size={15} />微信、支付宝导出的 CSV 或 Excel 账单都行，多份混放也可以</p>
    </div>
  );
}
