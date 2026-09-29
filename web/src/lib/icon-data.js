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
export const CHAIN = {
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
