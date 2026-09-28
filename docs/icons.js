/* 유형·역할·종류 아이콘 (직접 그린 24×24 라인 아이콘, stroke=currentColor). KL.typeIcon(type) · KL.roleIcon(role) · KL.avatar(i) · KL.roleBadge(role) */
(() => {
  "use strict";
  const { esc, typeName, typeFull, roleName, TYPE_COLOR } = KL;
  const wrap = (paths, extra = "") => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"${extra}>${paths}</svg>`;
  // 유형별: 해킹=깨진 방패 · 개인키=열쇠 · 피싱=낚싯바늘 · 러그풀=말린 카펫+화살 · 사기=가면 · 랜섬웨어=자물쇠 · 제재=금지 원 · 수사·기소=망치(가벨) · 세탁=순환 화살표+$ · 기타=점
  // ---- 게임 엠블럼 스타일: 그라데이션 면(ig-<key>) + 어두운 외곽선 + 흰 하이라이트 + 금색 코인/강철 디테일 ----
  const BASE = { hack_exploit: "#e0521c", private_key_compromise: "#8f66f0", phishing_social_engineering: "#6aa018", rug_pull: "#b8800e", scam_fraud: "#d9408a", ransomware: "#e83a5a",
    sanctions_designation: "#109e8c", law_enforcement_action: "#3f7fe8", laundering_report: "#1e9fd8", other: "#7a8290", attacker: "#fb7185", laundering: "#fbbf24", victim: "#3f7fe8", unknown: "#7a8290" };
  const shade = (hex, p) => { const n = parseInt(hex.slice(1), 16); const t = p < 0 ? 0 : 255, q = Math.abs(p); const f = (v) => Math.round((t - v) * q + v);
    return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join(""); };
  const DK = (k) => shade(BASE[k] || BASE.other, -0.5);
  const G = (k) => `url(#ig-${k})`;
  const INNER = "#15151a";
  const HL = 'stroke="#fff" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round" fill="none"';
  const OL = (k, w = ".8") => `stroke="${DK(k)}" stroke-width="${w}" stroke-linejoin="round"`;
  const RC = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
  function ensureDefs() {
    if (document.getElementById("klIconDefs")) return;
    const grads = Object.keys(BASE).map((k) => { const c = BASE[k]; return `<linearGradient id="ig-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 0.42)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.4)}"/></linearGradient>`; }).join("")
      + `<linearGradient id="ig-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeaa7"/><stop offset=".5" stop-color="#f5b301"/><stop offset="1" stop-color="#a86a00"/></linearGradient>`
      + `<linearGradient id="ig-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fb"/><stop offset=".5" stop-color="#b6bfd0"/><stop offset="1" stop-color="#5b6577"/></linearGradient>`
      + `<linearGradient id="ig-white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe9a8"/></linearGradient>`;
    const el = document.createElement("div"); el.innerHTML = `<svg id="klIconDefs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${grads}</defs></svg>`;
    (document.body || document.documentElement).prepend(el.firstChild);
  }
  const coin = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ig-gold)" stroke="#8a5a00" stroke-width=".7"/><circle cx="${(cx - r * 0.32).toFixed(1)}" cy="${(cy - r * 0.34).toFixed(1)}" r="${(r * 0.28).toFixed(1)}" fill="#fff" fill-opacity=".85"/>`;
  const SHIELD = "M12 2.2 20 5.4V11c0 5.4-3.4 9.4-8 10.8C7.4 20.4 4 16.4 4 11V5.4Z";
  const BOLT = "M13.7 6.2 9.6 12.6h2.9L11 17.8l4.7-6.8h-3.1Z";
  const CYCLE = (k) => `<path d="M5.4 12A6.6 6.6 0 0 1 14.6 5.9" stroke="${G(k)}" stroke-width="2.6" ${RC}/><path d="M18.6 12A6.6 6.6 0 0 1 9.4 18.1" stroke="${G(k)}" stroke-width="2.6" ${RC}/><path d="M14.2 2.6l4.6 3.4-4.9 2.4Z" fill="${G(k)}" ${OL(k, ".6")}/><path d="M9.8 21.4 5.2 18l4.9-2.4Z" fill="${G(k)}" ${OL(k, ".6")}/>`;
  // 유형: 해킹=방패+번개 · 개인키=열쇠+반짝임 · 피싱=코인 미끼 낚싯바늘 · 러그풀=코인 추락+말린 카펫 · 사기=가면(빛나는 눈) · 랜섬웨어=강철 고리 자물쇠 · 제재=팔각 금지 · 수사·기소=가벨+타격 · 세탁=순환 화살+코인 · 기타=스파클
  const TYPE_PATHS = {
    hack_exploit: `<path d="${SHIELD}" fill="${G("hack_exploit")}" ${OL("hack_exploit")}/><path d="M12 3.7 18.5 6.3" ${HL}/><path d="${BOLT}" transform="translate(.5 .8)" fill="${DK("hack_exploit")}" fill-opacity=".7"/><path d="${BOLT}" fill="url(#ig-white)" stroke="#ffd166" stroke-width=".6" stroke-linejoin="round"/>`,
    private_key_compromise: `<path d="M10.4 13.6 20.4 3.6" stroke="${G("private_key_compromise")}" stroke-width="3.1" ${RC}/><path d="M16.6 7.4l2.7 2.7M13.6 10.4l2.1 2.1" stroke="${G("private_key_compromise")}" stroke-width="2.6" ${RC}/><circle cx="7.6" cy="16.4" r="4.7" fill="${G("private_key_compromise")}" ${OL("private_key_compromise")}/><circle cx="7.6" cy="16.4" r="1.9" fill="${INNER}"/><path d="M4.4 14.6a3.7 3.7 0 0 1 2.6-1.8" ${HL}/><path d="M11.4 12.6 19.6 4.4" stroke="#fff" stroke-opacity=".45" stroke-width=".8" stroke-linecap="round" fill="none"/><path d="M20.6 1.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#fff"/>`,
    phishing_social_engineering: `<path d="M14.4 8.4v5.2a4.2 4.2 0 0 1-8.4 0v-1.8" stroke="${G("phishing_social_engineering")}" stroke-width="2.9" ${RC}/><path d="M6 11.8l2.7 1.7" stroke="${G("phishing_social_engineering")}" stroke-width="2.5" ${RC}/><path d="M14.4 9v4.6a4.2 4.2 0 0 1-2.1 3.6" stroke="#fff" stroke-opacity=".4" stroke-width=".8" stroke-linecap="round" fill="none"/>${coin(14.4, 5.2, 3.2)}`,
    rug_pull: `<path d="M3 17.4h11.6" stroke="${G("rug_pull")}" stroke-width="3.2" ${RC}/><path d="M3.8 16.6h9.8" stroke="#fff" stroke-opacity=".35" stroke-width=".8" stroke-linecap="round" fill="none"/><circle cx="18" cy="15.6" r="3.8" fill="${G("rug_pull")}" ${OL("rug_pull")}/><circle cx="18" cy="15.6" r="1.4" fill="${INNER}"/><path d="M15.2 13.6a3 3 0 0 1 2.4-1.2" ${HL}/>${coin(8.2, 6.4, 3.1)}<path d="M14.4 3v4.6M12.8 6l1.6 1.7L16 6" stroke="#fff" stroke-opacity=".85" stroke-width="1.3" ${RC}/>`,
    scam_fraud: `<path d="M4 5.4c2.6-2.2 13.4-2.2 16 0 0 6.1-.6 9.8-3.6 12.9-1.5 1.5-3 2.7-4.4 2.7s-2.9-1.2-4.4-2.7C4.6 15.2 4 11.5 4 5.4Z" fill="${G("scam_fraud")}" ${OL("scam_fraud")}/><path d="M5.6 5.4c2.4-1.5 10.4-1.5 12.8 0" ${HL}/><path d="M6.9 10.1c1.1-1.4 3.1-1.4 4.2 0-1.1 1.4-3.1 1.4-4.2 0Zm6 0c1.1-1.4 3.1-1.4 4.2 0-1.1 1.4-3.1 1.4-4.2 0Z" fill="#fff"/><path d="M8.3 14.4c2.3 2.4 5.1 2.4 7.4 0-2.3 3.4-5.1 3.4-7.4 0Z" fill="${INNER}"/>`,
    ransomware: `<path d="M8.1 10.2V7.6a3.9 3.9 0 0 1 7.8 0v2.6" stroke="url(#ig-steel)" stroke-width="2.7" ${RC}/><path d="M8.1 10.2V7.6a3.9 3.9 0 0 1 7.8 0v2.6" stroke="#2c3442" stroke-width=".6" ${RC}/><rect x="4.6" y="10.2" width="14.8" height="11" rx="2.6" fill="${G("ransomware")}" ${OL("ransomware")}/><path d="M6.4 11.8h11.2" ${HL}/><path d="M12 13.4a1.8 1.8 0 0 0-1 3.3v2h2v-2a1.8 1.8 0 0 0-1-3.3Z" fill="${INNER}"/>`,
    sanctions_designation: `<path d="M8.1 2.5h7.8l5.6 5.6v7.8l-5.6 5.6H8.1l-5.6-5.6V8.1Z" fill="${G("sanctions_designation")}" ${OL("sanctions_designation")}/><path d="M8.7 3.8h6.6l4.6 4.6" ${HL}/><path d="M9.1 4.7h5.8l4.4 4.4v5.8l-4.4 4.4H9.1L4.7 14.9V9.1Z" fill="none" stroke="${INNER}" stroke-opacity=".45" stroke-width=".7"/><rect x="6.4" y="10.7" width="11.2" height="2.6" rx="1.3" fill="#fff"/>`,
    law_enforcement_action: `<path d="M14.5 9.6 4.8 19.3" stroke="${G("law_enforcement_action")}" stroke-width="3" ${RC}/><path d="M13.2 2.6l8.2 8.2-2.7 2.7-8.2-8.2Z" fill="url(#ig-steel)" stroke="#2c3442" stroke-width=".8" stroke-linejoin="round"/><path d="M13.6 4.2 19.6 10.2" ${HL}/><path d="M2.6 21.4h8.8" stroke="${G("law_enforcement_action")}" stroke-width="2.6" ${RC}/><path d="M18.4 1.6l.8 2M21.4 2.8l-1.4 1.6M22.6 6.4l-2 .6" stroke="#fff" stroke-opacity=".9" stroke-width="1.1" stroke-linecap="round" fill="none"/>`,
    laundering_report: `${CYCLE("laundering_report")}${coin(12, 12, 3.4)}`,
    other: `<path d="M12 2.4c.7 5 4.6 8.9 9.6 9.6-5 .7-8.9 4.6-9.6 9.6-.7-5-4.6-8.9-9.6-9.6 5-.7 8.9-4.6 9.6-9.6Z" fill="${G("other")}" ${OL("other", ".7")}/><path d="M12 6.6c.4 2.6 2.3 4.6 5 5.2" ${HL}/><path d="M19.6 3.2c.2 1.3 1.1 2.2 2.4 2.4-1.3.2-2.2 1.1-2.4 2.4-.2-1.3-1.1-2.2-2.4-2.4 1.3-.2 2.2-1.1 2.4-2.4Z" fill="#fff" fill-opacity=".9"/>`,
  };
  // 역할: 제재=팔각 금지 · 공격자=조준선(빨강, 흰 중심) · 세탁·경유=순환 화살(노랑)+코인 · 피해자=방패(파랑)+흰 체크 · 미분류=점선 원
  const ROLE_PATHS = {
    sanctioned: TYPE_PATHS.sanctions_designation,
    attacker: `<circle cx="12" cy="12" r="6.2" stroke="${G("attacker")}" stroke-width="2.5" fill="none"/><path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22" stroke="${G("attacker")}" stroke-width="2.5" ${RC}/><path d="M7.6 9.4a5 5 0 0 1 3.2-3" ${HL}/><circle cx="12" cy="12" r="2.3" fill="#fff"/><circle cx="12" cy="12" r="1.2" fill="${BASE.attacker}"/>`,
    laundering: `${CYCLE("laundering")}${coin(12, 12, 3.2)}`,
    victim: `<path d="${SHIELD}" fill="${G("victim")}" ${OL("victim")}/><path d="M12 3.7 18.5 6.3" ${HL}/><path d="M8.2 12.2l2.6 2.6 5.2-5.2" stroke="#fff" stroke-width="2.3" ${RC}/>`,
    unknown: `<circle cx="12" cy="12" r="8" stroke="${G("unknown")}" stroke-width="2.4" fill="none" stroke-dasharray="3.4 3"/><circle cx="12" cy="12" r="2.5" fill="${G("unknown")}" ${OL("unknown", ".6")}/>`,
  };
  ensureDefs();

  // ---- 체인 아이콘: 브랜드 색 원 + 흰 마크(직접 그림). 없는 체인은 이름 첫 글자 모노그램 ----
  const W = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const CHAIN = {
    ethereum:   { c: "#627EEA", g: `<path d="M12 4l5.5 8.2L12 20 6.5 12.2z" fill="#fff" fill-opacity=".92"/><path d="M12 4v16M6.5 12.2L12 14.8l5.5-2.6" stroke="#627EEA" stroke-width="1.1"/>` },
    bitcoin:    { c: "#F7931A", g: `<path d="M9.2 6.5h4.3a2.4 2.4 0 0 1 0 4.8H9.2m0 0h4.8a2.4 2.4 0 0 1 0 4.8H9.2V6.5M10.8 4.8v1.7M13.4 4.8v1.7M10.8 16.1v1.7M13.4 16.1v1.7" ${W}/>` },
    bsc:        { c: "#F3BA2F", g: `<path d="M12 7l2.2 2.2L12 11.4 9.8 9.2z M7.4 11.6l1.5 1.5-1.5 1.5-1.5-1.5z M16.6 11.6l1.5 1.5-1.5 1.5-1.5-1.5z M12 15.6l2.2 2.2L12 20 9.8 17.8z M12 11.6l1.5 1.5-1.5 1.5-1.5-1.5z" fill="#fff"/>` },
    tron:       { c: "#EF0027", g: `<path d="M6 6.5l11.5 2.6-5.7 9.4z M6 6.5l5.8 12 M17.5 9.1l-3.4 1.6" ${W} stroke-width="1.8"/>` },
    solana:     { c: "#9945FF", g: `<path d="M8 8.2h10l-2 2H6z M8 13.9h10l-2 2H6z M6 11h10l2 2H8z" fill="#fff"/>` },
    polygon:    { c: "#8247E5", g: `<path d="M8.5 9.3l3.5-2 3.5 2v4l-3.5 2-3.5-2z" ${W}/><path d="M5 12.5l3.5-2 M15.5 12.5l3.5 2" ${W}/>` },
    base:       { c: "#0052FF", g: `<circle cx="12" cy="12" r="5.6" ${W} stroke-width="2.6"/><path d="M4.5 12h7" stroke="#0052FF" stroke-width="3.2"/><path d="M4.5 12h4.6" stroke="#fff" stroke-width="2.6"/>` },
    arbitrum:   { c: "#12AAFF", g: `<path d="M12 5.5l6 11h-3.2L12 10.9l-2.8 5.6H6z" fill="#fff"/><path d="M12 12.6l1.6 3.9h-3.2z" fill="#12AAFF"/>` },
    optimism:   { c: "#FF0420", g: `<circle cx="8.6" cy="12" r="3" ${W} stroke-width="2.2"/><path d="M14 15.4V8.8h2.6a2 2 0 0 1 0 4H14" ${W} stroke-width="2.2"/>` },
    avalanche:  { c: "#E84142", g: `<path d="M12 5l7 12.5H5z" fill="#fff"/><path d="M12 11.2l2.9 5.1H9.1z" fill="#E84142"/>` },
    xrp:        { c: "#8A9BB5", g: `<path d="M7 7.5c2 2.6 3.2 3.4 5 3.4s3-.8 5-3.4 M7 16.5c2-2.6 3.2-3.4 5-3.4s3 .8 5 3.4" ${W}/>` },
    "xrp-ledger": { c: "#8A9BB5", g: `<path d="M7 7.5c2 2.6 3.2 3.4 5 3.4s3-.8 5-3.4 M7 16.5c2-2.6 3.2-3.4 5-3.4s3 .8 5 3.4" ${W}/>` },
    cosmos:     { c: "#4A5BB0", g: `<circle cx="12" cy="12" r="1.6" fill="#fff"/><ellipse cx="12" cy="12" rx="7" ry="2.8" ${W} stroke-width="1.3"/><ellipse cx="12" cy="12" rx="7" ry="2.8" transform="rotate(60 12 12)" ${W} stroke-width="1.3"/><ellipse cx="12" cy="12" rx="7" ry="2.8" transform="rotate(-60 12 12)" ${W} stroke-width="1.3"/>` },
    osmosis:    { c: "#5E12A0", g: `<path d="M10 5.5h4v3l3 5.5a3 3 0 0 1-2.6 4.5H9.6A3 3 0 0 1 7 14l3-5.5z" ${W}/><circle cx="14.2" cy="14.6" r="1" fill="#fff"/>` },
    monero:     { c: "#FF6600", g: `<path d="M6.5 16.5V8l5.5 5.4L17.5 8v8.5" ${W} stroke-width="2.2"/><path d="M4 14h4M16 14h4" ${W} stroke-width="2.2"/>` },
    cronos:     { c: "#3B6BE0", g: `<path d="M12 4.5l6.5 3.7v7.6L12 19.5l-6.5-3.7V8.2z" ${W} stroke-width="1.6"/><path d="M14.6 9.8a3.2 3.2 0 1 0 0 4.4" ${W} stroke-width="2"/>` },
    hyperevm:   { c: "#12B5A0", g: `<path d="M5.5 12c1.8-3.2 3.6-3.2 5.4 0s3.6 3.2 5.4 0M5.5 12c1.8 3.2 3.6 3.2 5.4 0s3.6-3.2 5.4 0" ${W} stroke-width="1.8"/>` },
    starknet:   { c: "#EC796B", g: `<path d="M6 14.5a6.5 6.5 0 0 1 12 0" ${W}/><circle cx="15" cy="9.2" r="1.6" fill="#fff"/><circle cx="8.6" cy="15.2" r="1.1" fill="#fff"/>` },
    neutron:    { c: "#7C86C8", g: `<circle cx="12" cy="12" r="6.2" ${W} stroke-width="1.5"/><circle cx="12" cy="12" r="2.2" fill="#fff"/><path d="M12 3.5v3M12 17.5v3" ${W} stroke-width="1.5"/>` },
    nomic:      { c: "#2FB457", g: `<path d="M7.5 16.5v-9l9 9v-9" ${W} stroke-width="2.2"/>` },
    linea:      { c: "#3DB1D8", g: `<path d="M8.5 7v10h7.5" ${W} stroke-width="2.4"/><circle cx="16.2" cy="7.3" r="1.7" fill="#fff"/>` },
    sonic:      { c: "#8D8DD6", g: `<path d="M16 8.5c-1-1.2-2.3-1.7-4-1.7-2.6 0-4 1.3-4 2.9 0 3.6 8 1.7 8 5.4 0 1.7-1.5 3-4.2 3-1.9 0-3.4-.7-4.4-2" ${W} stroke-width="2"/>` },
    meter:      { c: "#3F5FD4", g: `<path d="M6.5 16.5v-9l5.5 5.4L17.5 7.5v9" ${W} stroke-width="2.2"/>` },
    cardano:    { c: "#2F5FD0", g: `<circle cx="12" cy="12" r="2.4" fill="#fff"/><circle cx="12" cy="6.2" r="1.2" fill="#fff"/><circle cx="12" cy="17.8" r="1.2" fill="#fff"/><circle cx="6.9" cy="9.1" r="1.2" fill="#fff"/><circle cx="17.1" cy="9.1" r="1.2" fill="#fff"/><circle cx="6.9" cy="14.9" r="1.2" fill="#fff"/><circle cx="17.1" cy="14.9" r="1.2" fill="#fff"/>` },
    multiversx: { c: "#1CB9A4", g: `<path d="M7 7.5l10 9M17 7.5l-10 9" ${W} stroke-width="2.6"/>` },
    radix:      { c: "#3B5BE8", g: `<path d="M8 17V7h4.5a2.6 2.6 0 0 1 0 5.2H8m4.5 0L16 17" ${W} stroke-width="2.2"/>` },
    axelar:     { c: "#7E95BC", g: `<path d="M7 17l5-10 5 10M9 13.5h6" ${W} stroke-width="2.2"/>` },
    galachain:  { c: "#9A8FD8", g: `<path d="M12 4.5l6.5 3.7v7.6L12 19.5l-6.5-3.7V8.2z" ${W} stroke-width="1.6"/><path d="M14.5 9.8a3 3 0 1 0 .3 3.7H12.5" ${W} stroke-width="1.9"/>` },
    rootstock:  { c: "#FF9931", g: `<path d="M8 17V7h4.5a2.6 2.6 0 0 1 0 5.2H8m4.5 0L16 17" ${W} stroke-width="2.2"/>` },
    zcash:      { c: "#F4B728", g: `<path d="M8 7.5h8L8 16.5h8M12 5v2.5M12 16.5V19" ${W} stroke-width="2.2"/>` },
    thorchain:  { c: "#23DCC8", g: `<path d="M13.2 4.5L7.5 13h4l-1.2 6.5L16.5 11h-4z" fill="#fff"/>` },
    liquid:     { c: "#00B4E0", g: `<path d="M8.5 7v10h7" ${W} stroke-width="2.4"/>` },
    noble:      { c: "#4B6CFF", g: `<path d="M7.5 16.5v-9l9 9v-9" ${W} stroke-width="2.2"/>` },
    citrea:     { c: "#F26B22", g: `<path d="M15.5 9a4.2 4.2 0 1 0 0 6" ${W} stroke-width="2.4"/>` },
    "robinhood-chain": { c: "#00C805", g: `<path d="M8 17V7h4.5a2.6 2.6 0 0 1 0 5.2H8m4.5 0L16 17" ${W} stroke-width="2.2"/>` },
    "dot-one-smart-chain": { c: "#6B5BFF", g: `<circle cx="12" cy="12" r="3.2" fill="#fff"/>` },
    unknown:    { c: "#55555f", g: `<path d="M9.3 9.6a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.1.9-1.1 1.8" ${W}/><circle cx="12" cy="17.3" r="1.2" fill="#fff"/>` },
  };
  const chainSlug = (c) => String(c || "").toLowerCase().replace(/\s+/g, "-");
  const hashHue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
  const chainIcon = (name, size = 18) => {
    const slug = chainSlug(name), d = CHAIN[slug];
    const bg = d ? d.c : `hsl(${hashHue(slug)} 40% 42%)`;
    const glyph = d ? d.g : `<text x="12" y="16.3" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">${esc(String(name || "?").trim().charAt(0).toUpperCase())}</text>`;
    return `<svg class="cico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${bg}"/>${glyph}</svg>`;
  };
  const chainColor = (name) => { const d = CHAIN[chainSlug(name)]; return d ? d.c : `hsl(${hashHue(chainSlug(name))} 40% 55%)`; };
  const typeIcon = (type) => wrap(TYPE_PATHS[type] || TYPE_PATHS.other);
  const roleIcon = (role) => wrap(ROLE_PATHS[role] || ROLE_PATHS.unknown);
  const avatar = (i, size = "") => `<span class="avatar ${size}" style="--c:${TYPE_COLOR[i.type] || "var(--t-other)"}" title="${esc(typeFull(i.type))}">${typeIcon(i.type)}</span>`;
  const typeBadge = (type) => `<span class="badge tb" style="--c:${TYPE_COLOR[type] || "var(--t-other)"}" title="${esc(typeFull(type))}">${typeIcon(type)}${esc(typeName(type))}</span>`;
  const roleBadge = (role) => `<span class="role ${esc(role)}" title="${esc(KL.t("tip_role_" + role) || roleName(role))}">${roleIcon(role)}${esc(roleName(role))}</span>`;
  Object.assign(KL, { typeIcon, roleIcon, avatar, typeBadge, roleBadge, TYPE_PATHS, ROLE_PATHS, chainIcon, chainColor, CHAIN_ICONS: CHAIN, ensureIconDefs: ensureDefs });
})();
