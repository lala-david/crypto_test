const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// docs/icons.js 에서 옮긴 아이콘 데이터(유형·역할 플랫 2톤 엠블럼 + 체인 마크). SVG 내부 문자열을 그대로 쓴다.
// ---- 플랫 2톤 엠블럼: 기본색 면 + 오른쪽 어두운 면(입체감) + 흰 포인트(번개·체크·눈·금지 바) + 플랫 금색 코인/강철. 그라데이션·글로우·하이라이트 없음 ----
const BASE = { hack_exploit: "#e0521c", private_key_compromise: "#8f66f0", phishing_social_engineering: "#6aa018", rug_pull: "#b8800e", scam_fraud: "#d9408a", ransomware: "#e83a5a",
  sanctions_designation: "#109e8c", law_enforcement_action: "#3f7fe8", laundering_report: "#1e9fd8", other: "#7a8290", attacker: "#fb7185", laundering: "#fbbf24", victim: "#3f7fe8", unknown: "#7a8290" };
const shade = (hex, p) => { const n = parseInt(hex.slice(1), 16); const t = p < 0 ? 0 : 255, q = Math.abs(p); const f = (v) => Math.round((t - v) * q + v);
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join(""); };
const C = (k) => shade(BASE[k] || BASE.other, 0.06);
const D2 = (k) => shade(BASE[k] || BASE.other, -0.3);
const INNER = "#15151a", GOLD = "#f2b632", GOLD_D = "#a86a00", STEEL = "#b9c2d2", STEEL_D = "#6b7689";
const RC = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
const coin = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".9"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" fill="none" stroke="${GOLD_D}" stroke-opacity=".7" stroke-width=".8"/>`;
const SHIELD = "M12 2.2 20 5.4V11c0 5.4-3.4 9.4-8 10.8C7.4 20.4 4 16.4 4 11V5.4Z", SHIELD_R = "M12 2.2 20 5.4V11c0 5.4-3.4 9.4-8 10.8Z";
const BOLT = "M13.7 6.2 9.6 12.6h2.9L11 17.8l4.7-6.8h-3.1Z";
const CYCLE = (k) => `<path d="M5.4 12A6.6 6.6 0 0 1 14.6 5.9" stroke="${C(k)}" stroke-width="2.6" ${RC}/><path d="M18.6 12A6.6 6.6 0 0 1 9.4 18.1" stroke="${C(k)}" stroke-width="2.6" ${RC}/><path d="M14.2 2.6l4.6 3.4-4.9 2.4Z" fill="${C(k)}"/><path d="M9.8 21.4 5.2 18l4.9-2.4Z" fill="${C(k)}"/>`;
// 유형: 해킹=방패+번개 · 개인키=열쇠 · 피싱=코인 미끼 낚싯바늘 · 러그풀=코인 추락+말린 카펫 · 사기=가면 · 랜섬웨어=강철 고리 자물쇠 · 제재=팔각 금지 · 수사·기소=가벨 · 세탁=순환 화살+코인 · 기타=스파클
export const TYPE_PATHS = {
  hack_exploit: `<path d="${SHIELD}" fill="${C("hack_exploit")}"/><path d="${SHIELD_R}" fill="${D2("hack_exploit")}"/><path d="${BOLT}" fill="#fff"/>`,
  private_key_compromise: `<path d="M10.4 13.6 20.4 3.6" stroke="${C("private_key_compromise")}" stroke-width="3.1" ${RC}/><path d="M16.6 7.4l2.7 2.7M13.6 10.4l2.1 2.1" stroke="${C("private_key_compromise")}" stroke-width="2.6" ${RC}/><circle cx="7.6" cy="16.4" r="4.7" fill="${C("private_key_compromise")}"/><path d="M7.6 11.7a4.7 4.7 0 0 1 0 9.4Z" fill="${D2("private_key_compromise")}"/><circle cx="7.6" cy="16.4" r="1.9" fill="${INNER}"/>`,
  phishing_social_engineering: `<path d="M14.4 8.4v5.2a4.2 4.2 0 0 1-8.4 0v-1.8" stroke="${C("phishing_social_engineering")}" stroke-width="2.9" ${RC}/><path d="M6 11.8l2.7 1.7" stroke="${C("phishing_social_engineering")}" stroke-width="2.5" ${RC}/>${coin(14.4, 5.2, 3.2)}`,
  rug_pull: `<path d="M3 17.4h11.6" stroke="${C("rug_pull")}" stroke-width="3.2" ${RC}/><circle cx="18" cy="15.6" r="3.8" fill="${C("rug_pull")}"/><path d="M18 11.8a3.8 3.8 0 0 1 0 7.6Z" fill="${D2("rug_pull")}"/><circle cx="18" cy="15.6" r="1.4" fill="${INNER}"/>${coin(8.2, 6.4, 3.1)}<path d="M14.4 3v4.6M12.8 6l1.6 1.7L16 6" stroke="#fff" stroke-width="1.3" ${RC}/>`,
  scam_fraud: `<path d="M4 5.4c2.6-2.2 13.4-2.2 16 0 0 6.1-.6 9.8-3.6 12.9-1.5 1.5-3 2.7-4.4 2.7s-2.9-1.2-4.4-2.7C4.6 15.2 4 11.5 4 5.4Z" fill="${C("scam_fraud")}"/><path d="M12 3.75c3.6 0 7.2.55 8 1.65 0 6.1-.6 9.8-3.6 12.9-1.5 1.5-3 2.7-4.4 2.7Z" fill="${D2("scam_fraud")}"/><path d="M6.9 10.1c1.1-1.4 3.1-1.4 4.2 0-1.1 1.4-3.1 1.4-4.2 0Zm6 0c1.1-1.4 3.1-1.4 4.2 0-1.1 1.4-3.1 1.4-4.2 0Z" fill="#fff"/><path d="M8.3 14.4c2.3 2.4 5.1 2.4 7.4 0-2.3 3.4-5.1 3.4-7.4 0Z" fill="${INNER}"/>`,
  ransomware: `<path d="M8.1 10.2V7.6a3.9 3.9 0 0 1 7.8 0v2.6" stroke="${STEEL}" stroke-width="2.7" ${RC}/><rect x="4.6" y="10.2" width="14.8" height="11" rx="2.6" fill="${C("ransomware")}"/><path d="M12 10.2h4.8a2.6 2.6 0 0 1 2.6 2.6v5.8a2.6 2.6 0 0 1-2.6 2.6H12Z" fill="${D2("ransomware")}"/><path d="M12 13.4a1.8 1.8 0 0 0-1 3.3v2h2v-2a1.8 1.8 0 0 0-1-3.3Z" fill="${INNER}"/>`,
  sanctions_designation: `<path d="M8.1 2.5h7.8l5.6 5.6v7.8l-5.6 5.6H8.1l-5.6-5.6V8.1Z" fill="${C("sanctions_designation")}"/><path d="M12 2.5h3.9l5.6 5.6v7.8l-5.6 5.6H12Z" fill="${D2("sanctions_designation")}"/><rect x="6.4" y="10.7" width="11.2" height="2.6" rx="1.3" fill="#fff"/>`,
  law_enforcement_action: `<path d="M14.5 9.6 4.8 19.3" stroke="${C("law_enforcement_action")}" stroke-width="3" ${RC}/><path d="M13.2 2.6l8.2 8.2-2.7 2.7-8.2-8.2Z" fill="${STEEL}"/><path d="M17.3 6.7l4.1 4.1-2.7 2.7-4.1-4.1Z" fill="${STEEL_D}"/><path d="M2.6 21.4h8.8" stroke="${C("law_enforcement_action")}" stroke-width="2.6" ${RC}/>`,
  laundering_report: `${CYCLE("laundering_report")}${coin(12, 12, 3.4)}`,
  other: `<path d="M12 2.4c.7 5 4.6 8.9 9.6 9.6-5 .7-8.9 4.6-9.6 9.6-.7-5-4.6-8.9-9.6-9.6 5-.7 8.9-4.6 9.6-9.6Z" fill="${C("other")}"/><path d="M12 2.4c.7 5 4.6 8.9 9.6 9.6-5 .7-8.9 4.6-9.6 9.6Z" fill="${D2("other")}"/>`,
};
// 역할: 제재=팔각 금지 · 공격자=조준선 · 세탁·경유=순환 화살+코인 · 피해자=방패+체크 · 미분류=점선 원
export const ROLE_PATHS = {
  sanctioned: TYPE_PATHS.sanctions_designation,
  attacker: `<circle cx="12" cy="12" r="6.2" stroke="${C("attacker")}" stroke-width="2.5" fill="none"/><path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22" stroke="${C("attacker")}" stroke-width="2.5" ${RC}/><circle cx="12" cy="12" r="2.3" fill="#fff"/><circle cx="12" cy="12" r="1.2" fill="${BASE.attacker}"/>`,
  laundering: `${CYCLE("laundering")}${coin(12, 12, 3.2)}`,
  victim: `<path d="${SHIELD}" fill="${C("victim")}"/><path d="${SHIELD_R}" fill="${D2("victim")}"/><path d="M8.2 12.2l2.6 2.6 5.2-5.2" stroke="#fff" stroke-width="2.3" ${RC}/>`,
  unknown: `<circle cx="12" cy="12" r="8" stroke="${C("unknown")}" stroke-width="2.4" fill="none" stroke-dasharray="3.4 3"/><circle cx="12" cy="12" r="2.5" fill="${C("unknown")}"/>`,
};


// ---- 체인 아이콘: 브랜드 색 원 + 흰 마크(직접 그림). 없는 체인은 이름 첫 글자 모노그램 ----
const W = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
// 브랜드색 원 + 흰 글자(마크를 따로 그리기 어려운 체인용). 두 글자까지.
const M = (c, ch) => ({ c, g: `<text x="12" y="${ch.length > 1 ? 16 : 16.4}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${ch.length > 1 ? 9.5 : 12}" font-weight="700" fill="#fff">${ch}</text>` });
export const CHAIN = {
  // ---- 직접 그린 마크 ----
  eos:        { c: "#443F54", g: `<circle cx="12" cy="12" r="6.4" ${W} stroke-width="1.6"/><path d="M12 5.6 17 12l-5 6.4L7 12z" ${W} stroke-width="1.6"/>` },
  fantom:     { c: "#1969FF", g: `<path d="M12 4.6l5 2.9v9l-5 2.9-5-2.9v-9z" ${W} stroke-width="1.7"/><path d="M7 9.5l5 2.9 5-2.9M12 12.4v6.5" ${W} stroke-width="1.5"/>` },
  sui:        { c: "#4DA2FF", g: `<path d="M12 4.2c3.2 4 5.2 6 5.2 8.6a5.2 5.2 0 0 1-10.4 0c0-2.6 2-4.6 5.2-8.6z" ${W} stroke-width="1.8"/>` },
  blast:      { c: "#FCFC03", g: `<path d="M13.4 4.6 7.8 12.4h3.6l-1 7 5.8-8.2h-3.6z" fill="#111"/>` },
  near:       { c: "#00EC97", g: `<path d="M7 17.6V6.4l10 11.2V6.4" ${W} stroke-width="2.4" stroke="#0b1f16"/>` },
  stellar:    { c: "#7D00FF", g: `<path d="M5 9.2l14-2.6M5 17.4l14-2.6" ${W} stroke-width="1.8"/><circle cx="12" cy="12" r="4.6" ${W} stroke-width="1.6"/>` },
  algorand:   { c: "#2B2B2B", g: `<path d="M6 18 13 6M9.6 18l4.2-7.2M11.8 18l2.2-3.8M14.4 10.4 16.6 18" ${W} stroke-width="1.7"/>` },
  litecoin:   { c: "#A6A9AA", g: `<path d="M11.6 5.6 9.9 14.6l-2.3.9M9.9 14.6h7.5M8 11.6l7-2.4" ${W} stroke-width="1.9"/>` },
  terra:      { c: "#FFD83D", g: `<circle cx="12" cy="12" r="6.6" fill="none" stroke="#111" stroke-width="1.8"/><path d="M7 9.4c3.4 1.6 6.6 1.6 10 0M7 14.6c3.4-1.6 6.6-1.6 10 0" stroke="#111" stroke-width="1.5" fill="none"/>` },
  "terra-classic": { c: "#172852", g: `<circle cx="12" cy="12" r="6.6" ${W} stroke-width="1.7"/><path d="M7 9.4c3.4 1.6 6.6 1.6 10 0" ${W} stroke-width="1.4"/>` },
  "terra-2":  { c: "#FFD83D", g: `<circle cx="12" cy="12" r="6.6" fill="none" stroke="#111" stroke-width="1.8"/><path d="M10 15.2h4" stroke="#111" stroke-width="1.6"/>` },
  hedera:     { c: "#222222", g: `<path d="M8 6v12M16 6v12M8 10.4h8M8 13.6h8" ${W} stroke-width="1.9"/>` },
  gnosis:     { c: "#3E6957", g: `<circle cx="12" cy="12" r="6.6" ${W} stroke-width="1.6"/><path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" ${W} stroke-width="1.6"/>` },
  mantle:     { c: "#65B3AE", g: `<circle cx="12" cy="12" r="6.6" ${W} stroke-width="1.6"/><path d="M9.4 15V9.4l2.6 3.2 2.6-3.2V15" ${W} stroke-width="1.8"/>` },
  stacks:     { c: "#FC6432", g: `<path d="M7 7.6h10M7 16.4h10M9.4 7.6l5.2 8.8M14.6 7.6 9.4 16.4" ${W} stroke-width="1.8"/>` },
  flow:       { c: "#00EF8B", g: `<path d="M9.4 16.6V9.2h6M9.4 12.8h4" stroke="#05321f" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="15.4" cy="14.6" r="1.7" fill="#05321f"/>` },
  ton:        { c: "#0098EA", g: `<path d="M6.4 8.6h11.2L12 18.4z" ${W} stroke-width="1.7"/><path d="M12 8.6v9.8" ${W} stroke-width="1.5"/>` },
  polkadot:   { c: "#E6007A", g: `<ellipse cx="12" cy="6.6" rx="2.6" ry="1.7" fill="#fff"/><ellipse cx="12" cy="17.4" rx="2.6" ry="1.7" fill="#fff"/><ellipse cx="7.4" cy="9.4" rx="2.6" ry="1.7" fill="#fff" transform="rotate(-60 7.4 9.4)"/><ellipse cx="16.6" cy="14.6" rx="2.6" ry="1.7" fill="#fff" transform="rotate(-60 16.6 14.6)"/><ellipse cx="7.4" cy="14.6" rx="2.6" ry="1.7" fill="#fff" transform="rotate(60 7.4 14.6)"/><ellipse cx="16.6" cy="9.4" rx="2.6" ry="1.7" fill="#fff" transform="rotate(60 16.6 9.4)"/>` },
  celo:       { c: "#FCFF52", g: `<circle cx="10.4" cy="13.6" r="4.4" fill="none" stroke="#111" stroke-width="1.7"/><circle cx="13.6" cy="10.4" r="4.4" fill="none" stroke="#111" stroke-width="1.7"/>` },
  scroll:     { c: "#FFEEDA", g: `<path d="M7.4 7.6h7.2c1.4 0 2.4 1 2.4 2.4v6.4H9.8c-1.4 0-2.4-1-2.4-2.4z" fill="none" stroke="#8a5a2b" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.4 7.6a2.4 2.4 0 0 0 0 4.8h2.4" fill="none" stroke="#8a5a2b" stroke-width="1.5"/>` },
  sei:        { c: "#9E1F19", g: `<path d="M6 14.4c3-4.2 6-6 12-6.4M6 17c2.6-2.6 5.4-3.6 9.4-3.8" ${W} stroke-width="1.9"/>` },
  berachain:  { c: "#814625", g: `<circle cx="12" cy="13" r="4.8" ${W} stroke-width="1.7"/><circle cx="8.2" cy="7.6" r="1.9" ${W} stroke-width="1.5"/><circle cx="15.8" cy="7.6" r="1.9" ${W} stroke-width="1.5"/>` },
  aptos:      { c: "#0B0B0B", g: `<circle cx="12" cy="12" r="6.6" ${W} stroke-width="1.6"/><path d="M6 10.8h4.4l1.2-1.6 1.2 1.6H18M6.6 14.4h4l1.2-1.6 1.2 1.6h4.4" ${W} stroke-width="1.4"/>` },
  icp:        { c: "#29ABE2", g: `<path d="M6.4 12c0-2 1.4-3.4 3.2-3.4 2.6 0 4.2 6.8 6.8 6.8 1.8 0 3.2-1.5 3.2-3.4S18.2 8.6 16.4 8.6c-2.6 0-4.2 6.8-6.8 6.8-1.8 0-3.2-1.5-3.2-3.4z" ${W} stroke-width="1.7"/>` },
  vechain:    { c: "#15BDFF", g: `<path d="M5.6 7.4h4l2.4 5 2.4-5h4L12 18z" ${W} stroke-width="1.6"/>` },
  kaia:       { c: "#BFF009", g: `<path d="M12 5.4 18.6 12 12 18.6 5.4 12z" fill="#111"/><circle cx="12" cy="12" r="1.8" fill="#BFF009"/>` },
  harmony:    { c: "#00AEE9", g: `<circle cx="9.2" cy="9.2" r="2.4" ${W} stroke-width="1.5"/><circle cx="14.8" cy="14.8" r="2.4" ${W} stroke-width="1.5"/><path d="M10.8 10.8l2.4 2.4" ${W} stroke-width="1.5"/>` },
  conflux:    { c: "#1A1A1A", g: `<path d="M12 5.4 18.6 12 12 18.6 5.4 12z" ${W} stroke-width="1.6"/><path d="M9.4 12 12 9.4l2.6 2.6L12 14.6z" fill="#fff"/>` },
  taiko:      { c: "#E81899", g: `<path d="M12 5.2 18.4 12 12 18.8 5.6 12z" ${W} stroke-width="1.7"/><path d="M12 9.2 14.8 12 12 14.8 9.2 12z" fill="#fff"/>` },
  zilliqa:    { c: "#49C1BF", g: `<path d="M7 8.2l10-1.6v3.2l-10 1.6zM7 13.2l10-1.6v3.2l-10 1.6z" ${W} stroke-width="1.4"/>` },
  tezos:      { c: "#2C7DF7", g: `<path d="M9.4 6.6h5M11.6 6.6v7.2c0 1.6 1 2.4 2.4 2.4 1.2 0 2-.6 2.4-1.6M9.4 11h5.2l-3 5.2" ${W} stroke-width="1.7"/>` },
  metis:      { c: "#00DACC", g: `<path d="M12 5.4 18.4 9v6L12 18.6 5.6 15V9z" ${W} stroke-width="1.6"/><path d="M9 14.4V9.6l3 1.8 3-1.8v4.8" ${W} stroke-width="1.5"/>` },
  loopring:   { c: "#1C60FF", g: `<path d="M7 16.4V9.2c0-1.4 1-2.4 2.4-2.4h1.2M17 7.6v7.2c0 1.4-1 2.4-2.4 2.4h-1.2" ${W} stroke-width="1.8"/>` },
  monad:      { c: "#836EF9", g: `<path d="M12 5.4c3.4 0 6.6 3 6.6 6.6S15.4 18.6 12 18.6 5.4 15.6 5.4 12 8.6 5.4 12 5.4zm0 3.2c-1.5 0-2.6 1.5-2.6 3.4s1.1 3.4 2.6 3.4 2.6-1.5 2.6-3.4-1.1-3.4-2.6-3.4z" fill="#fff"/>` },
  core:       { c: "#FF9211", g: `<path d="M12 5.2 18.4 12 12 18.8 5.6 12z" ${W} stroke-width="1.6"/><path d="M14.6 9.8a3.4 3.4 0 1 0 0 4.4" ${W} stroke-width="1.8"/>` },
  mode:       { c: "#DFFE00", g: `<path d="M7 16.4V8.6l5 5.4 5-5.4v7.8" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
  pulsechain: { c: "#00E1FF", g: `<path d="M4.6 12h4l2-4 3 8 2-4h3.8" ${W} stroke-width="1.8"/>` },
  moonriver:  { c: "#F2B705", g: `<path d="M14.6 6.6a5.6 5.6 0 1 0 3.4 8.6A6.4 6.4 0 0 1 14.6 6.6z" fill="#fff"/>` },
  fuse:       { c: "#B4F9BA", g: `<circle cx="12" cy="12" r="6.4" fill="none" stroke="#123" stroke-width="1.7"/><path d="M8.8 12h6.4M12 8.8v6.4" stroke="#123" stroke-width="1.7"/>` },
  zksync:     { c: "#8C8DFC", g: `<path d="M6 12l5-4.4v3.2h5.4L11.4 15v-3H6z" fill="#fff"/><path d="M18 12l-5 4.4v-3.2H7.6L12.6 9v3H18z" fill="#fff" fill-opacity=".55"/>` },
  secret:     { c: "#1B1B1B", g: `<circle cx="12" cy="12" r="6.4" ${W} stroke-width="1.6"/><path d="M8.8 12a3.2 3.2 0 0 1 6.4 0 3.2 3.2 0 0 0 0 0" ${W} stroke-width="1.5"/><circle cx="12" cy="12" r="1.4" fill="#fff"/>` },
  unichain:   { c: "#FF007A", g: `<circle cx="12" cy="12" r="6.4" ${W} stroke-width="1.6"/><path d="M9 14.6c1.8-1.2 2.6-3 2.6-5.6 0 3.4 1 5 3.4 5.6" ${W} stroke-width="1.6"/>` },
  apechain:   { c: "#0055FF", g: `<path d="M8 16.4V9.6c0-1.6 1.8-2.8 4-2.8s4 1.2 4 2.8v6.8" ${W} stroke-width="1.8"/><path d="M8.6 13h6.8" ${W} stroke-width="1.6"/>` },
  shibarium:  { c: "#F00500", g: `<path d="M6.6 10.4 12 6l5.4 4.4-2 7.2H8.6z" ${W} stroke-width="1.6"/>` },
  dogecoin:   { c: "#C3A634", g: `<path d="M9 6.8h3.4c3 0 4.8 2 4.8 5.2s-1.8 5.2-4.8 5.2H9V6.8z" ${W} stroke-width="1.7"/><path d="M7.2 12h4.4" ${W} stroke-width="1.7"/>` },
  "bitcoin-cash": { c: "#0AC18E", g: `<path d="M9.4 6.8h4.2a2.4 2.4 0 0 1 0 4.8H9.4m0 0h4.6a2.4 2.4 0 0 1 0 4.8H9.4V6.8M11 5.2v1.6M13.4 5.2v1.6M11 16.4v1.6M13.4 16.4v1.6" ${W} stroke-width="1.6"/>` },
  "ethereum-classic": { c: "#3AB83A", g: `<path d="M12 4.6l4.8 7.2L12 19.4 7.2 11.8z" ${W} stroke-width="1.5"/><path d="M7.2 11.8 12 14l4.8-2.2" ${W} stroke-width="1.3"/>` },
  iota:       { c: "#131F37", g: `<circle cx="7.6" cy="14.4" r="2.2" fill="#fff"/><circle cx="12.6" cy="11.4" r="1.6" fill="#fff"/><circle cx="16" cy="8.8" r="1.2" fill="#fff"/>` },
  nano:       { c: "#4A90E2", g: `<path d="M7 16V9.4l5 3.2 5-3.2V16" ${W} stroke-width="1.9"/>` },
  verge:      { c: "#00CBFF", g: `<path d="M5.4 7.6 12 17.2l6.6-9.6" ${W} stroke-width="2"/>` },
  ravencoin:  { c: "#384182", g: `<path d="M8 17V8.6c2.6 0 4.6 1.2 5.6 3.4L16 8.6" ${W} stroke-width="1.8"/>` },
  chia:       { c: "#3AAC59", g: `<path d="M15.6 7.4c-4.6 0-8 3-8 6.8 0 1 .2 1.8.6 2.6 4.6 0 8-3 8-6.8 0-1-.2-1.8-.6-2.6z" fill="#fff"/>` },
  casper:     { c: "#FF0012", g: `<circle cx="12" cy="12" r="6.6" ${W} stroke-width="1.6"/><path d="M12 5.4v13.2M5.4 12h13.2" ${W} stroke-width="1.3"/>` },
  story:      { c: "#3D3D3D", g: `<path d="M8 6.8h6.4l2 2v8.4H8z" ${W} stroke-width="1.6"/><path d="M10.2 11h4.2M10.2 14h4.2" ${W} stroke-width="1.4"/>` },
  saga:       { c: "#6B4BF6", g: `<path d="M12 5.4 18.4 12 12 18.6 5.6 12z" ${W} stroke-width="1.6"/><path d="M9.8 12h4.4" ${W} stroke-width="1.7"/>` },
  syscoin:    { c: "#0089D0", g: `<path d="M12 5.2 18.4 8.8v6.4L12 18.8 5.6 15.2V8.8z" ${W} stroke-width="1.6"/><path d="M12 9.2v5.6" ${W} stroke-width="1.7"/>` },
  icon:       { c: "#1FC5C9", g: `<circle cx="12" cy="12" r="3" ${W} stroke-width="1.8"/><circle cx="12" cy="6.4" r="1.5" fill="#fff"/><circle cx="17" cy="14.8" r="1.5" fill="#fff"/><circle cx="7" cy="14.8" r="1.5" fill="#fff"/>` },
  kadena:     { c: "#4A9079", g: `<path d="M7.6 6.6v10.8M7.6 12l6-5.4M7.6 12l6 5.4M16.4 8.2v7.6" ${W} stroke-width="1.7"/>` },
  nervos:     { c: "#3CC68A", g: `<path d="M12 5.4 18 8.8v6.4L12 18.6 6 15.2V8.8z" ${W} stroke-width="1.6"/><path d="M9.6 14.6V9.4l4.8 5.2V9.4" ${W} stroke-width="1.6"/>` },
  aeternity:  { c: "#DE3F6B", g: `<path d="M12 5.6 17.4 18h-3L12 11.4 9.6 18h-3z" fill="#fff"/>` },
  grin:       { c: "#FFD200", g: `<path d="M7 10.4c1.6-2 3.4-3 5-3s3.4 1 5 3M8.4 14.6c1.4 1.6 4.8 1.6 7.2 0" stroke="#111" stroke-width="1.8" fill="none" stroke-linecap="round"/>` },
  nem:        { c: "#67B2E8", g: `<circle cx="8.6" cy="8.6" r="1.9" fill="#fff"/><circle cx="15.4" cy="8.6" r="1.9" fill="#fff"/><circle cx="8.6" cy="15.4" r="1.9" fill="#fff"/><circle cx="15.4" cy="15.4" r="1.9" fill="#fff"/><path d="M8.6 8.6l6.8 6.8" ${W} stroke-width="1.3"/>` },
  elastos:    { c: "#1F7BFF", g: `<path d="M6.6 14.4c3-6 8-6 11 0" ${W} stroke-width="1.8"/><circle cx="12" cy="15.6" r="1.8" fill="#fff"/>` },
  mixin:      { c: "#3D75E3", g: `<path d="M7 16.6V7.4l5 4 5-4v9.2" ${W} stroke-width="1.9"/>` },
  "bitcoin-gold": { c: "#EBA809", g: `<path d="M9.4 6.8h4.2a2.4 2.4 0 0 1 0 4.8H9.4m0 0h4.6a2.4 2.4 0 0 1 0 4.8H9.4V6.8" ${W} stroke-width="1.6"/>` },
  vertcoin:   { c: "#048657", g: `<path d="M6.4 7.4 12 17.2l5.6-9.8" ${W} stroke-width="2"/>` },
  acala:      { c: "#E40C5B", g: `<path d="M12 5.4 18 15.4H6z" ${W} stroke-width="1.6"/><path d="M9.4 15.4 12 11l2.6 4.4" ${W} stroke-width="1.4"/>` },
  monacoin:   { c: "#C7B36A", g: `<path d="M7 16.4V8.2l5 4.6 5-4.6v8.2" ${W} stroke-width="1.8"/>` },
  nuls:       { c: "#62D0C6", g: `<path d="M7.4 16.4V7.6l9.2 8.8V7.6" ${W} stroke-width="1.9"/>` },
  coreum:     { c: "#25D695", g: `<path d="M12 5.4 18.4 12 12 18.6 5.6 12z" ${W} stroke-width="1.6"/><path d="M12 8.6 15.4 12 12 15.4 8.6 12z" fill="#fff"/>` },
  mantra:     { c: "#E4572E", g: `<circle cx="12" cy="12" r="6.4" ${W} stroke-width="1.6"/><path d="M12 8v8M8.4 12h7.2" ${W} stroke-width="1.5"/>` },
  namada:     { c: "#FFFF00", g: `<path d="M12 5.6 18 12l-6 6.4L6 12z" fill="none" stroke="#111" stroke-width="1.7"/><path d="M12 9.2 14.6 12 12 14.8 9.4 12z" fill="#111"/>` },
  abstract:   { c: "#0CE466", g: `<circle cx="12" cy="12" r="6.4" fill="none" stroke="#05321f" stroke-width="1.7"/><path d="M9 12h6" stroke="#05321f" stroke-width="1.7"/>` },
  bob:        { c: "#F25D00", g: `<path d="M8 7.4h3.6a2.3 2.3 0 0 1 0 4.6H8m0 0h4a2.3 2.3 0 0 1 0 4.6H8z" ${W} stroke-width="1.6"/>` },
  megaeth:    { c: "#1C1C1C", g: `<path d="M12 5.4l4.6 6.8L12 18.6 7.4 12.2z" ${W} stroke-width="1.5"/><path d="M7.4 12.2 12 14.4l4.6-2.2" ${W} stroke-width="1.3"/>` },
  "polygon-zkevm": { c: "#7B3FE4", g: `<path d="M8.5 9.3l3.5-2 3.5 2v4l-3.5 2-3.5-2z" ${W} stroke-width="1.6"/><path d="M6 12.6l2.5-1.4M15.5 12.6l2.5 1.4" ${W} stroke-width="1.4"/>` },
  "hyperliquid-l1": { c: "#12B5A0", g: `<path d="M5.6 12c1.8-3.2 3.6-3.2 5.4 0s3.6 3.2 5.4 0" ${W} stroke-width="1.8"/><path d="M5.6 12c1.8 3.2 3.6 3.2 5.4 0s3.6-3.2 5.4 0" ${W} stroke-width="1.8"/>` },
  // ---- 브랜드색 모노그램(마크가 단순해 글자로 대체) ----
  zencash: M("#F4B728", "Z"), haven: M("#43A1A2", "H"), verus: M("#3165D4", "V"), constellation: M("#0F1B2A", "DAG"),
  supra: M("#FF4D00", "S"), oraichain: M("#6BE0C4", "OR"), quicksilver: M("#5FB8A6", "Q"), comdex: M("#C43B57", "CM"),
  kiichain: M("#1FA8A0", "KII"), nesa: M("#3E4BB8", "N"), tac: M("#2F6BFF", "TAC"), fogo: M("#FF5A1F", "F"),
  bouncebit: M("#F7A600", "BB"), mayachain: M("#3FBF9F", "MY"), dango: M("#E0533D", "D"), mezo: M("#FF4D2E", "MZ"),
  rise: M("#4F46E5", "R"), zigchain: M("#1E9E8A", "ZIG"), "0g": M("#111827", "0G"), aurumcoin: M("#C9A227", "AU"),
  polynetwork: M("#2B6CB0", "PN"), dagger: M("#5A5F73", "DG"), "rei-network": M("#3AA0FF", "REI"),
  heco: M("#01943F", "HT"), wemix: M("#0F1627", "WX"), "multiversx-elrond": M("#1CB9A4", "MX"),

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
export const chainSlug = (c) => String(c || "").toLowerCase().replace(/\s+/g, "-");
const hashHue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
const chainIconHtml = (name, size = 18) => {
  const slug = chainSlug(name), d = CHAIN[slug];
  const bg = d ? d.c : `hsl(${hashHue(slug)} 40% 42%)`;
  const glyph = d ? d.g : `<text x="12" y="16.3" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">${esc(String(name || "?").trim().charAt(0).toUpperCase())}</text>`;
  return `<svg class="cico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${bg}"/>${glyph}</svg>`;
};
export const chainColor = (name) => { const d = CHAIN[chainSlug(name)]; return d ? d.c : `hsl(${hashHue(chainSlug(name))} 40% 55%)`; };
export { chainIconHtml };
