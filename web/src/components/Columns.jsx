// 세로 막대 차트(일별/주별/월별). 축 눈금은 1/2/2.5/5 단위, 막대에 커서를 올리면 값 툴팁.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n.jsx";
import { useTip } from "./Tooltip.jsx";

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
const niceStep = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const ticksOf = (max, n = 4) => {
  const st = niceStep(max / n);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += st) out.push(v);
  return out;
};

export default function Columns({ buckets, fmt, height = 210 }) {
  const { t } = useI18n();
  const box = useRef(null);
  const tip = useTip();
  const [w, setW] = useState(640);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width - 2)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!buckets.length) return <div className="empty">{t("no_data")}</div>;

  const H = height;
  const m = { l: 56, r: 10, t: 18, b: 26 };
  const pw = w - m.l - m.r;
  const ph = H - m.t - m.b;
  const few = buckets.length <= 12;
  const tk = ticksOf(niceMax(Math.max(...buckets.map((b) => b.v))), few ? 2 : 4);
  const max = tk[tk.length - 1] || 1;
  const slot = pw / buckets.length;
  const bw = Math.max(4, Math.min(few ? 56 : 28, slot * 0.55));
  const x = (k) => m.l + (k + 0.5) * slot;
  const y = (v) => m.t + ph - (v / max) * ph;
  const step = Math.max(1, Math.ceil(buckets.length / Math.max(4, Math.floor(pw / 64))));

  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img">
        {tk.map((v) => (
          <g key={v}>
            <line className="grid" x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        <line className="axis" x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} />
        {buckets.map((b, k) => (
          <g className="col" key={k}>
            {b.v > 0 && (
              <rect className="bar" x={x(k) - bw / 2} y={y(b.v)} width={bw} height={Math.max(1, y(0) - y(b.v))} rx="2" />
            )}
            {b.v > 0 && few && (
              <text className="val" x={x(k)} y={y(b.v) - 5} textAnchor="middle">
                {fmt(b.v)}
              </text>
            )}
            <rect
              className="hit"
              x={x(k) - slot / 2}
              y={m.t}
              width={slot}
              height={ph}
              onMouseMove={(e) => tip.show(`${b.label} · ${fmt(b.v)}${b.extra ? " · " + b.extra : ""}`, e)}
              onMouseLeave={tip.hide}
            />
          </g>
        ))}
        {buckets.map((b, k) =>
          k % step === 0 ? (
            <text key={`l${k}`} x={x(k)} y={H - 8} textAnchor="middle">
              {b.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
