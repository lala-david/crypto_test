// 21st.dev animated-card-diagram 이식: 도넛(호버 시 진행률 전환) + 배지 + 방사되는 알약 6개.
import { useEffect, useRef, useState } from "react";

const R = 40;
const C = 2 * Math.PI * R;
const off = (p) => C - (Math.max(0, Math.min(100, p)) / 100) * C;
const POS = [
  [100, 50],
  [100, -50],
  [125, 0],
  [-125, 0],
  [-100, 50],
  [-100, -50],
];

export default function AnimatedCard({
  title,
  description,
  badgeTitle,
  badgeSub,
  pills = [],
  mainColor = "#8b5cf6",
  secondaryColor = "#fbbf24",
  gridColor = "#80808015",
  mainPct = 12.5,
  hoverMainPct = 66,
  hoverSecondaryPct = 100,
  onClick,
}) {
  const [hover, setHover] = useState(false);
  const [rings, setRings] = useState({ main: mainPct, sec: 0 });
  const timer = useRef(0);
  const uid = useRef("ac" + Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    clearTimeout(timer.current);
    if (hover) timer.current = setTimeout(() => setRings({ main: hoverMainPct, sec: hoverSecondaryPct }), 200);
    else setRings({ main: mainPct, sec: 0 });
    return () => clearTimeout(timer.current);
  }, [hover, mainPct, hoverMainPct, hoverSecondaryPct]);

  const pct = Math.round(hover ? (hoverSecondaryPct > 66 ? hoverSecondaryPct : hoverMainPct) : mainPct);

  return (
    <div
      className={`ac${hover ? " hover" : ""}`}
      role="region"
      tabIndex={0}
      style={{ "--color": mainColor, "--secondary-color": secondaryColor, "--grid-color": gridColor, cursor: onClick ? "pointer" : undefined }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={onClick}
    >
      <div className="ac-visual">
        <div className="ac-hit" />
        <div className="ac-l1">
          <div className="ac-donut">
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} stroke="currentColor" strokeWidth="10" fill="transparent" opacity="0.2" />
              <circle
                className="ac-ring2"
                cx="50"
                cy="50"
                r={R}
                stroke={secondaryColor}
                strokeWidth="14"
                fill="transparent"
                strokeDasharray={C}
                strokeDashoffset={off(rings.sec)}
                transform="rotate(-90 50 50)"
              />
              <circle
                className="ac-ring1"
                cx="50"
                cy="50"
                r={R}
                stroke={mainColor}
                strokeWidth="14"
                fill="transparent"
                strokeDasharray={C}
                strokeDashoffset={off(rings.main)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <span className="ac-pct">{pct}%</span>
          </div>
        </div>
        <div className="ac-l2">
          <div className="ac-badge">
            <div className="ac-badge-h">
              <span className="ac-dot" />
              <p>{badgeTitle}</p>
            </div>
            <p className="ac-badge-s">{badgeSub}</p>
          </div>
        </div>
        <div className="ac-l3">
          <svg width="356" height="180" viewBox="0 0 356 180" fill="none">
            <rect width="356" height="180" fill={`url(#${uid.current}-lin)`} />
            <defs>
              <linearGradient id={`${uid.current}-lin`} x1="178" y1="0" x2="178" y2="180" gradientUnits="userSpaceOnUse">
                <stop stopColor={mainColor} stopOpacity="0" />
                <stop offset="1" stopColor={mainColor} stopOpacity="0.16" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="ac-l4">
          {pills.slice(0, 6).map((p, i) => (
            <div
              className="ac-pill"
              key={`${p}-${i}`}
              style={{ transform: hover ? `translate(${POS[i][0]}px, ${POS[i][1]}px)` : "translate(0px, 0px)" }}
            >
              <span className="ac-pill-dot" style={{ background: i < 3 ? mainColor : secondaryColor }} />
              <span>{p}</span>
            </div>
          ))}
        </div>
        <div className="ac-ellipse">
          <svg width="356" height="196" viewBox="0 0 356 180" fill="none">
            <rect width="356" height="180" fill={`url(#${uid.current}-rad)`} />
            <defs>
              <radialGradient
                id={`${uid.current}-rad`}
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(178 90) rotate(90) scale(90 178)"
              >
                <stop stopColor={mainColor} stopOpacity="0.28" />
                <stop offset="1" stopColor={mainColor} stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        <div className="ac-grid" />
      </div>
      <div className="ac-body">
        <h3 className="ac-title">{title}</h3>
        <p className="ac-desc">{description}</p>
      </div>
    </div>
  );
}
