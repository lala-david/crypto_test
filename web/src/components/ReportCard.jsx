// 개요 첫 화면의 Incident Report 카드(21st.dev area-chart 이식): 스무스 영역 차트 + 호버 값.
import { useMemo, useRef, useState } from "react";

const smoothPath = (pts) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${Math.max(0, c1y)} ${c2x} ${Math.max(0, c2y)} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

export default function ReportCard({ title = "Incident Report", series, labels, wide = true }) {
  const W = wide ? 1108 : 448;
  const H = wide ? 300 : 200;
  const m = { l: 14, r: 14, t: 12, b: 28 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const uid = useMemo(() => "rc" + Math.random().toString(36).slice(2, 8), []);

  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
  const y = (v) => m.t + ph - (v / max) * ph;
  const slot = n > 1 ? pw / (n - 1) : pw;
  const step = Math.max(1, Math.ceil(n / (wide ? 13 : 7)));

  return (
    <div className="rc rc-wide">
      <div className="rc-head">
        <h3 className="rc-title">{title}</h3>
      </div>
      <div className="rc-legend">
        {series.map((s) => (
          <div className="rc-li" key={s.key}>
            <span className="rc-sw" style={{ background: s.color }} />
            <span>{s.key}</span>
          </div>
        ))}
      </div>
      <div className="rc-chart" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg" role="img" aria-label={title}>
          <defs>
            {series.map((s, k) => (
              <linearGradient id={`${uid}${k}`} key={s.key} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.02" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.45" />
              </linearGradient>
            ))}
          </defs>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} className="rc-grid" x1={m.l} x2={W - m.r} y1={m.t + ph - ph * f} y2={m.t + ph - ph * f} />
          ))}
          {series.map((s, k) => {
            const pts = s.values.map((v, i) => [x(i), y(v)]);
            const line = smoothPath(pts);
            return (
              <g key={s.key}>
                <path d={`${line} L ${x(n - 1)} ${m.t + ph} L ${x(0)} ${m.t + ph} Z`} fill={`url(#${uid}${k})`} />
                <path className="rc-line" d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
              </g>
            );
          })}
          {labels.map((lb, i) =>
            i % step === 0 || i === n - 1 ? (
              <text key={i} className="rc-tick" x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {lb}
              </text>
            ) : null,
          )}
          {hover != null && (
            <g className="rc-hover">
              <line className="rc-x" x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ph} />
              {series.map((s) => (
                <circle key={s.key} className="rc-dot" cx={x(hover)} cy={y(s.values[hover])} r="4" style={{ fill: s.color }} />
              ))}
            </g>
          )}
          {labels.map((_, i) => (
            <rect
              key={i}
              className="rc-hit"
              x={x(i) - slot / 2}
              y={m.t}
              width={slot}
              height={ph}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover != null && (
          <div
            className="rc-tip show"
            style={{
              left: `${Math.min(88, Math.max(2, ((x(hover) - m.l) / pw) * 100))}%`,
              top: 8,
            }}
          >
            <b>{labels[hover]}</b>
            {series.map((s) => (
              <div key={s.key} className="rc-tip-row">
                <span className="rc-sw" style={{ background: s.color }} />
                <span>{s.key}</span>
                <b>{s.values[hover]}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
