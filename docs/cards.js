/* 21st.dev 컴포넌트 2종의 바닐라 이식 (React/Tailwind → HTML·CSS·SVG, 치수·색·모션 동일, 데이터는 실제 사건)
   1) area-chart-1.tsx  "Incident Report" 카드  → KL.reportCard(el, {series, labels, metrics})
      제목 · 범례(사각 스와치) · reaviz 스타일 스무스 그룹 영역 차트(그라데이션, 점선 그리드, x축 M/D) · 지표 3행(경고 아이콘 · 라벨 · 값 · 추세 원형 아이콘, 순차 페이드인)
   2) animated-card-diagram.tsx  AnimatedCard + Visual2 → KL.animatedCard(el, {...})
      356px 카드 · 180px 비주얼: 도넛(호버 시 -90px 상승·1.1배, 진행률 전환) · 상단 배지(호버 시 아래로 슬라이드) · 6개 알약 라벨(호버 시 방사) · 하단 그라데이션 · 20px 격자(방사 마스크) · 타원 글로우 */
(() => {
  "use strict";
  const { esc } = KL;

  // ---- 아이콘 (원본 SVG 경로 그대로) ----
  const ICON = {
    diamond: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.92844 1.25411C9.32947 1.25895 8.73263 1.49041 8.28293 1.94747L1.92062 8.41475C1.02123 9.32885 1.03336 10.8178 1.94748 11.7172L8.41476 18.0795C9.32886 18.9789 10.8178 18.9667 11.7172 18.0526L18.0795 11.5861C18.0798 11.5859 18.08 11.5856 18.0803 11.5853C18.979 10.6708 18.9667 9.18232 18.0526 8.28291L11.5853 1.92061C11.1283 1.47091 10.5274 1.24926 9.92844 1.25411ZM9.93901 2.49597C10.2155 2.49373 10.4926 2.59892 10.7089 2.81172L17.1762 9.17403C17.6087 9.59962 17.6139 10.2767 17.1884 10.7097L10.8261 17.1761C10.4005 17.6087 9.72379 17.614 9.29123 17.1884L2.82394 10.826C2.39139 10.4005 2.38613 9.72378 2.81174 9.29121L9.17404 2.82393C9.38684 2.60765 9.66256 2.4982 9.93901 2.49597ZM9.99028 5.40775C9.82481 5.41034 9.66711 5.47845 9.55178 5.59714C9.43645 5.71583 9.37289 5.87541 9.37505 6.04089V11.0409C9.37388 11.1237 9.38918 11.2059 9.42006 11.2828C9.45095 11.3596 9.4968 11.4296 9.55495 11.4886C9.6131 11.5476 9.6824 11.5944 9.75881 11.6264C9.83522 11.6583 9.91722 11.6748 10 11.6748C10.0829 11.6748 10.1649 11.6583 10.2413 11.6264C10.3177 11.5944 10.387 11.5476 10.4451 11.4886C10.5033 11.4296 10.5492 11.3596 10.58 11.2828C10.6109 11.2059 10.6262 11.1237 10.625 11.0409V6.04089C10.6261 5.95731 10.6105 5.87435 10.5789 5.79694C10.5474 5.71952 10.5006 5.64922 10.4415 5.59019C10.3823 5.53115 10.3119 5.48459 10.2344 5.45326C10.1569 5.42192 10.0739 5.40645 9.99028 5.40775ZM10 12.9159C9.77904 12.9159 9.56707 13.0037 9.41079 13.16C9.25451 13.3162 9.16672 13.5282 9.16672 13.7492C9.16672 13.9702 9.25451 14.1822 9.41079 14.3385C9.56707 14.4948 9.77904 14.5826 10 14.5826C10.2211 14.5826 10.433 14.4948 10.5893 14.3385C10.7456 14.1822 10.8334 13.9702 10.8334 13.7492C10.8334 13.5282 10.7456 13.3162 10.5893 13.16C10.433 13.0037 10.2211 12.9159 10 12.9159Z" fill="#E84045"/></svg>`,
    circle: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10.0001 1.66663C5.40511 1.66663 1.66675 5.40499 1.66675 9.99996C1.66675 14.5949 5.40511 18.3333 10.0001 18.3333C14.5951 18.3333 18.3334 14.5949 18.3334 9.99996C18.3334 5.40499 14.5951 1.66663 10.0001 1.66663ZM10.0001 2.91663C13.9195 2.91663 17.0834 6.08054 17.0834 9.99996C17.0834 13.9194 13.9195 17.0833 10.0001 17.0833C6.08066 17.0833 2.91675 13.9194 2.91675 9.99996C2.91675 6.08054 6.08066 2.91663 10.0001 2.91663ZM9.99032 5.82434C9.8247 5.82693 9.66688 5.89515 9.55152 6.01401C9.43616 6.13288 9.37271 6.29267 9.37508 6.45829V10.625C9.37391 10.7078 9.38921 10.79 9.42009 10.8669C9.45098 10.9437 9.49683 11.0137 9.55498 11.0726C9.61313 11.1316 9.68243 11.1785 9.75884 11.2104C9.83525 11.2424 9.91725 11.2589 10.0001 11.2589C10.0829 11.2589 10.1649 11.2424 10.2413 11.2104C10.3177 11.1785 10.387 11.1316 10.4452 11.0726C10.5033 11.0137 10.5492 10.9437 10.5801 10.8669C10.611 10.79 10.6263 10.7078 10.6251 10.625V6.45829C10.6263 6.37464 10.6107 6.2916 10.5792 6.21409C10.5477 6.13658 10.501 6.06618 10.4418 6.00706C10.3826 5.94794 10.3121 5.9013 10.2346 5.86992C10.157 5.83853 10.074 5.82303 9.99032 5.82434ZM10.0001 12.5C9.77907 12.5 9.56711 12.5878 9.41083 12.744C9.25455 12.9003 9.16675 13.1123 9.16675 13.3333C9.16675 13.5543 9.25455 13.7663 9.41083 13.9225C9.56711 14.0788 9.77907 14.1666 10.0001 14.1666C10.2211 14.1666 10.4331 14.0788 10.5893 13.9225C10.7456 13.7663 10.8334 13.5543 10.8334 13.3333C10.8334 13.1123 10.7456 12.9003 10.5893 12.744C10.4331 12.5878 10.2211 12.5 10.0001 12.5Z" fill="#E84045"/></svg>`,
    triangle: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10.0001 2.10535C9.35241 2.10535 8.70472 2.42118 8.35459 3.05343L1.9044 14.7063C1.22414 15.9354 2.14514 17.5 3.5499 17.5H16.4511C17.8559 17.5 18.7769 15.9354 18.0966 14.7063L11.6456 3.05343C11.2955 2.42118 10.6478 2.10535 10.0001 2.10535ZM10.0001 3.31222C10.212 3.31222 10.4237 3.42739 10.5519 3.65889L17.0029 15.3117C17.2501 15.7585 16.9605 16.25 16.4511 16.25H3.5499C3.04051 16.25 2.7509 15.7585 2.99815 15.3117L9.44834 3.65889C9.57655 3.42739 9.78821 3.31222 10.0001 3.31222ZM9.99033 6.65776C9.82472 6.66034 9.6669 6.72856 9.55154 6.84743C9.43618 6.96629 9.37272 7.12609 9.3751 7.29171V11.4584C9.37393 11.5412 9.38923 11.6234 9.42011 11.7003C9.451 11.7771 9.49685 11.8471 9.555 11.9061C9.61315 11.965 9.68245 12.0119 9.75886 12.0438C9.83527 12.0758 9.91727 12.0923 10.0001 12.0923C10.0829 12.0923 10.1649 12.0758 10.2413 12.0438C10.3178 12.0119 10.387 11.965 10.4452 11.9061C10.5034 11.8471 10.5492 11.7771 10.5801 11.7003C10.611 11.6234 10.6263 11.5412 10.6251 11.4584V7.29171C10.6263 7.20806 10.6107 7.12501 10.5792 7.0475C10.5477 6.96999 10.501 6.89959 10.4418 6.84047C10.3826 6.78135 10.3121 6.73472 10.2346 6.70333C10.157 6.67195 10.074 6.65645 9.99033 6.65776ZM10.0001 13.3334C9.77909 13.3334 9.56712 13.4212 9.41084 13.5775C9.25456 13.7337 9.16677 13.9457 9.16677 14.1667C9.16677 14.3877 9.25456 14.5997 9.41084 14.756C9.56712 14.9122 9.77909 15 10.0001 15C10.2211 15 10.4331 14.9122 10.5894 14.756C10.7456 14.5997 10.8334 14.3877 10.8334 14.1667C10.8334 13.9457 10.7456 13.7337 10.5894 13.5775C10.4331 13.4212 10.2211 13.3334 10.0001 13.3334Z" fill="#E84045"/></svg>`,
  };
  const trendIcon = (up, base, stroke) => up
    ? `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="14" fill="${base}" fill-opacity="0.4"/><path d="M9.50134 12.6111L14.0013 8.16663M14.0013 8.16663L18.5013 12.6111M14.0013 8.16663L14.0013 19.8333" stroke="${stroke}" stroke-width="2" stroke-linecap="square"/></svg>`
    : `<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="14" fill="${base}" fill-opacity="0.4"/><path d="M18.4987 15.3889L13.9987 19.8334M13.9987 19.8334L9.49866 15.3889M13.9987 19.8334V8.16671" stroke="${stroke}" stroke-width="2" stroke-linecap="square"/></svg>`;

  // ---- 스무스 곡선 (reaviz interpolation="smooth" ≈ Catmull-Rom → cubic Bezier, 기준선 아래로 내려가지 않게 클램프) ----
  function smoothPath(pts, base) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = Math.min(base, p1[1] + (p2[1] - p0[1]) / 6);
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = Math.min(base, p2[1] - (p3[1] - p1[1]) / 6);
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  /* series: [{key, color, data:[number…]}], labels: [string…] (x 라벨), metrics: [{icon:'diamond'|'circle'|'triangle', label, value, up, good}] */
  function reportCard(el, { title = "Incident Report", series, labels, metrics = [], wide = false, hud = "" }) {
    const W = wide ? 1108 : 448, H = wide ? 300 : 200, m = { l: 14, r: 14, t: 12, b: 28 };
    const n = labels.length; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = Math.max(1, ...series.flatMap((s) => s.data));
    const x = (i) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2), y = (v) => m.t + ph - (v / max) * ph, base = y(0);
    const uid = "rg" + Math.random().toString(36).slice(2, 7);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="rc-svg" role="img" aria-label="${esc(title)}"><defs>${series.map((s, k) => `<linearGradient id="${uid}${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${s.color}" stop-opacity="0"/><stop offset="1" stop-color="${s.color}" stop-opacity="0.4"/></linearGradient>`).join("")}</defs>`;
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const yy = m.t + ph * (1 - f); svg += `<line class="rc-grid" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`; });
    series.forEach((s, k) => {
      const pts = s.data.map((v, i) => [x(i), y(v)]);
      const line = smoothPath(pts, base);
      svg += `<path class="rc-area" d="${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z" fill="url(#${uid}${k})"/><path class="rc-line" d="${line}" stroke="${s.color}"/>`;
    });
    const step = Math.max(1, Math.ceil(n / (wide ? 13 : 7)));
    labels.forEach((lb, i) => { if (i % step === 0 || i === n - 1) svg += `<text class="rc-tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`; });
    // 호버: 세로 기준선 + 시리즈별 점 + 툴팁(라벨·값). 버킷마다 투명 히트 영역
    svg += `<g class="rc-hover" style="display:none"><line class="rc-x" y1="${m.t}" y2="${base}" x1="0" x2="0"/>${series.map((s) => `<circle class="rc-dot" r="4" fill="${s.color}" cx="0" cy="0"/>`).join("")}</g>`;
    const slot = n > 1 ? pw / (n - 1) : pw;
    labels.forEach((lb, i) => { svg += `<rect class="rc-hit" data-i="${i}" x="${x(i) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}"/>`; });
    svg += "</svg>";
    el.innerHTML = `<div class="rc ${wide ? "rc-wide" : ""}">
      <div class="rc-head"><h3 class="rc-title">${esc(title)}</h3>${hud}</div>
      <div class="rc-legend">${series.map((s) => `<div class="rc-li"><span class="rc-sw" style="background:${s.color}"></span><span>${esc(s.key)}</span></div>`).join("")}</div>
      <div class="rc-chart">${svg}<div class="rc-tip"></div></div>
      ${metrics.length ? `<div class="rc-metrics">${metrics.map((mt, k) => { const base = mt.good ? "#40E5D1" : "#E84045", stroke = mt.good ? "#40E5D1" : "#F08083";
        return `<div class="rc-row" style="animation-delay:${(k * 0.05).toFixed(2)}s"><div class="rc-lbl">${ICON[mt.icon] || ICON.circle}<span title="${esc(mt.tooltip || mt.label)}">${esc(mt.label)}</span></div><div class="rc-val"><span>${esc(mt.value)}</span>${trendIcon(mt.up, base, stroke)}</div></div>`; }).join("")}</div>` : ""}
    </div>`;
    // ---- 호버 동작 ----
    const svgEl = el.querySelector(".rc-svg"), tip = el.querySelector(".rc-tip"), hov = svgEl.querySelector(".rc-hover"), xline = hov.querySelector(".rc-x"), dots = [...hov.querySelectorAll(".rc-dot")];
    const unitLbl = (KL.t && KL.t("unit")) || "";
    const show = (i, ev) => {
      hov.style.display = ""; const cx = x(i); xline.setAttribute("x1", cx); xline.setAttribute("x2", cx);
      series.forEach((s, k) => { dots[k].setAttribute("cx", cx); dots[k].setAttribute("cy", y(s.data[i])); });
      tip.innerHTML = `<div class="d">${esc(labels[i])}</div>${series.map((s) => `<div class="r"><span><i style="background:${s.color}"></i>${esc(s.key)}</span><b>${fmtNum(s.data[i])}${esc(unitLbl)}</b></div>`).join("")}`;
      const box = el.querySelector(".rc-chart").getBoundingClientRect(); const px = ev.clientX - box.left, py = ev.clientY - box.top;
      const tw = tip.offsetWidth || 160; tip.style.left = `${Math.min(box.width - tw - 6, Math.max(6, px + 14))}px`; tip.style.top = `${Math.max(6, py - 12)}px`; tip.classList.add("show");
    };
    const hide = () => { hov.style.display = "none"; tip.classList.remove("show"); };
    svgEl.querySelectorAll(".rc-hit").forEach((r) => { r.addEventListener("mousemove", (ev) => show(parseInt(r.dataset.i, 10), ev)); r.addEventListener("mouseenter", (ev) => show(parseInt(r.dataset.i, 10), ev)); });
    svgEl.addEventListener("mouseleave", hide);
  }
  const fmtNum = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10));

  /* opts: {mainColor, secondaryColor, gridColor, mainPct, hoverMainPct, hoverSecondaryPct, badgeTitle, badgeSub, pills:[string×6], title, description} */
  function animatedCard(el, o) {
    const main = o.mainColor || "#8b5cf6", sec = o.secondaryColor || "#fbbf24", grid = o.gridColor || "#80808015";
    const R = 40, C = 2 * Math.PI * R; const off = (p) => C - (Math.max(0, Math.min(100, p)) / 100) * C;
    const idleMain = o.mainPct ?? 12.5, hovMain = o.hoverMainPct ?? 66, hovSec = o.hoverSecondaryPct ?? 100;
    const POS = [[100, 50], [100, -50], [125, 0], [-125, 0], [-100, 50], [-100, -50]];
    const pills = (o.pills || []).slice(0, 6);
    el.innerHTML = `<div class="ac" role="region" style="--color:${main};--secondary-color:${sec};--grid-color:${grid}">
      <div class="ac-visual">
        <div class="ac-hit"></div>
        <div class="ac-l1"><div class="ac-donut"><svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${R}" stroke="currentColor" stroke-width="10" fill="transparent" opacity="0.2"/>
          <circle class="ac-ring2" cx="50" cy="50" r="${R}" stroke="${sec}" stroke-width="14" fill="transparent" stroke-dasharray="${C}" stroke-dashoffset="${off(0)}" transform="rotate(-90 50 50)"/>
          <circle class="ac-ring1" cx="50" cy="50" r="${R}" stroke="${main}" stroke-width="14" fill="transparent" stroke-dasharray="${C}" stroke-dashoffset="${off(idleMain)}" transform="rotate(-90 50 50)"/>
        </svg><span class="ac-pct">${Math.round(idleMain)}%</span></div></div>
        <div class="ac-l2"><div class="ac-badge"><div class="ac-badge-h"><span class="ac-dot"></span><p>${esc(o.badgeTitle || "")}</p></div><p class="ac-badge-s">${esc(o.badgeSub || "")}</p></div></div>
        <div class="ac-l3"><svg width="356" height="180" viewBox="0 0 356 180" fill="none"><rect width="356" height="180" fill="url(#${el.id || "ac"}-lin)"/><defs><linearGradient id="${el.id || "ac"}-lin" x1="178" y1="0" x2="178" y2="180" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="${main}" stop-opacity="0"/><stop offset="1" stop-color="${main}" stop-opacity="0.3"/></linearGradient></defs></svg></div>
        <div class="ac-l4">${pills.map((p, i) => `<div class="ac-pill" data-tx="${POS[i][0]}" data-ty="${POS[i][1]}"><span class="ac-pill-dot" style="background:${i < 3 ? main : sec}"></span><span>${esc(p)}</span></div>`).join("")}</div>
        <div class="ac-ellipse"><svg width="356" height="196" viewBox="0 0 356 180" fill="none"><rect width="356" height="180" fill="url(#${el.id || "ac"}-rad)"/><defs><radialGradient id="${el.id || "ac"}-rad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(178 98) rotate(90) scale(98 178)"><stop stop-color="${main}" stop-opacity="0.25"/><stop offset="0.34" stop-color="${main}" stop-opacity="0.15"/><stop offset="1" stop-opacity="0"/></radialGradient></defs></svg></div>
        <div class="ac-grid"></div>
      </div>
      <div class="ac-body"><h3 class="ac-title">${esc(o.title || "")}</h3><p class="ac-desc">${esc(o.description || "")}</p></div>
    </div>`;
    // 호버 상태 (Visual2: 200ms 뒤 진행률 전환, 알약 방사)
    const card = el.firstElementChild, r1 = card.querySelector(".ac-ring1"), r2 = card.querySelector(".ac-ring2"), pct = card.querySelector(".ac-pct");
    const pillEls = [...card.querySelectorAll(".ac-pill")]; let tm = 0;
    const setHover = (h) => {
      card.classList.toggle("hover", h); clearTimeout(tm);
      pillEls.forEach((p) => { p.style.transform = h ? `translate(${p.dataset.tx}px, ${p.dataset.ty}px)` : "translate(0px, 0px)"; });
      if (h) tm = setTimeout(() => { r1.style.strokeDashoffset = off(hovMain); r2.style.strokeDashoffset = off(hovSec); pct.textContent = `${Math.round(hovSec > 66 ? hovSec : hovMain)}%`; }, 200);
      else { r1.style.strokeDashoffset = off(idleMain); r2.style.strokeDashoffset = off(0); pct.textContent = `${Math.round(idleMain)}%`; }
    };
    card.addEventListener("mouseenter", () => setHover(true)); card.addEventListener("mouseleave", () => setHover(false));
    card.addEventListener("focusin", () => setHover(true)); card.addEventListener("focusout", () => setHover(false));
    card.tabIndex = 0;
    if (o.onClick) { card.style.cursor = "pointer"; card.addEventListener("click", o.onClick); }
  }

  Object.assign(KL, { reportCard, animatedCard });
})();
