/* 유형·역할·종류 아이콘 (직접 그린 24×24 라인 아이콘, stroke=currentColor). KL.typeIcon(type) · KL.roleIcon(role) · KL.avatar(i) · KL.roleBadge(role) */
(() => {
  "use strict";
  const { esc, typeName, typeFull, roleName, TYPE_COLOR } = KL;
  const wrap = (paths, extra = "") => `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"${extra}>${paths}</svg>`;
  // 유형별: 해킹=깨진 방패 · 개인키=열쇠 · 피싱=낚싯바늘 · 러그풀=말린 카펫+화살 · 사기=가면 · 랜섬웨어=자물쇠 · 제재=금지 원 · 수사·기소=망치(가벨) · 세탁=순환 화살표+$ · 기타=점
  // 솔리드 스타일: 기본 fill=currentColor, 구멍은 evenodd, 굵은 선 요소는 개별 stroke. 14~17px 에서도 실루엣이 읽힌다.
  const S = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const EO = 'fill-rule="evenodd" clip-rule="evenodd"';
  const ring = (cx, cy, r, ri) => `<path ${EO} d="M${cx} ${cy - r}a${r} ${r} 0 1 0 0 ${2 * r}a${r} ${r} 0 1 0 0-${2 * r}Zm0 ${r - ri}a${ri} ${ri} 0 1 1 0 ${2 * ri}a${ri} ${ri} 0 1 1 0-${2 * ri}Z"/>`;
  // 유형: 해킹=방패+번개 구멍 · 개인키=열쇠 · 피싱=코인 미끼 낚싯바늘 · 러그풀=떨어지는 화살+말린 카펫 · 사기=가면(눈·입 구멍) · 랜섬웨어=자물쇠(열쇠구멍) · 제재=팔각 금지 · 수사·기소=가벨 · 세탁=순환 화살+코인 · 기타=스파클
  const TYPE_PATHS = {
    hack_exploit: `<path ${EO} d="M12 2.2 20 5.4V11c0 5.4-3.4 9.4-8 10.8C7.4 20.4 4 16.4 4 11V5.4l8-3.2Zm1.5 4.6-4.2 6.2h2.9l-1.6 4.8 4.6-6.6h-3l1.3-4.4Z"/>`,
    private_key_compromise: `${ring(7.6, 16.4, 4.4, 1.7)}<path d="M10.6 13.4 20.2 3.8" ${S} stroke-width="2.9"/><path d="M16.4 7.6l2.6 2.6M13.4 10.6l2 2" ${S} stroke-width="2.5"/>`,
    phishing_social_engineering: `${ring(14.2, 5.2, 2.8, 1.1)}<path d="M14.2 8v5.6a4.1 4.1 0 0 1-8.2 0v-1.8" ${S} stroke-width="2.7"/><path d="M6 11.8l2.6 1.6" ${S} stroke-width="2.4"/>`,
    rug_pull: `<path d="M10.7 2.6h2.6v6.2l1.6-1.6 1.8 1.8L12 13.7 7.3 9l1.8-1.8 1.6 1.6V2.6Z"/><path d="M3 18.4h10.2" ${S} stroke-width="2.7"/>${ring(18.2, 16.3, 3.3, 1.2)}`,
    scam_fraud: `<path ${EO} d="M4 5.4c2.6-2.2 13.4-2.2 16 0 0 6.1-.6 9.8-3.6 12.9-1.5 1.5-3 2.7-4.4 2.7s-2.9-1.2-4.4-2.7C4.6 15.2 4 11.5 4 5.4Zm2.9 4.7c1.1-1.3 3.1-1.3 4.2 0-1.1 1.3-3.1 1.3-4.2 0Zm6 0c1.1-1.3 3.1-1.3 4.2 0-1.1 1.3-3.1 1.3-4.2 0Zm-4.6 4.4c2.2 2.2 5.2 2.2 7.4 0-2.2 3.1-5.2 3.1-7.4 0Z"/>`,
    ransomware: `<path ${EO} d="M7.1 10.3h9.8A2.6 2.6 0 0 1 19.5 12.9v6a2.6 2.6 0 0 1-2.6 2.6H7.1a2.6 2.6 0 0 1-2.6-2.6v-6a2.6 2.6 0 0 1 2.6-2.6Zm4.9 3.2a1.7 1.7 0 0 0-.9 3.2v1.9h1.8v-1.9a1.7 1.7 0 0 0-.9-3.2Z"/><path d="M8.1 10.3V7.7a3.9 3.9 0 0 1 7.8 0v2.6" ${S} stroke-width="2.6"/>`,
    sanctions_designation: `<path ${EO} d="M8.1 2.5h7.8l5.6 5.6v7.8l-5.6 5.6H8.1l-5.6-5.6V8.1l5.6-5.6Zm-1.4 8.2a1.3 1.3 0 0 0 0 2.6h10.6a1.3 1.3 0 0 0 0-2.6H6.7Z"/>`,
    law_enforcement_action: `<path d="M13.2 2.6l8.2 8.2-2.7 2.7-8.2-8.2 2.7-2.7Z"/><path d="M14.3 9.7 4.7 19.3" ${S} stroke-width="2.9"/><path d="M2.6 21.4h8.8" ${S} stroke-width="2.7"/>`,
    laundering_report: `<path d="M5.4 12A6.6 6.6 0 0 1 14.6 5.9" ${S} stroke-width="2.5"/><path d="M18.6 12A6.6 6.6 0 0 1 9.4 18.1" ${S} stroke-width="2.5"/><path d="M14.2 2.6l4.6 3.4-4.9 2.4.3-5.8Z"/><path d="M9.8 21.4 5.2 18l4.9-2.4-.3 5.8Z"/>${ring(12, 12, 3.1, 1.3)}`,
    other: `<path d="M12 2.4c.7 5 4.6 8.9 9.6 9.6-5 .7-8.9 4.6-9.6 9.6-.7-5-4.6-8.9-9.6-9.6 5-.7 8.9-4.6 9.6-9.6Z"/>`,
  };
  // 역할: 제재=팔각 금지 · 공격자=조준선 · 세탁·경유=순환 화살 · 피해자=방패+체크 구멍 · 미분류=점선 원
  const ROLE_PATHS = {
    sanctioned: TYPE_PATHS.sanctions_designation,
    attacker: `${ring(12, 12, 7.2, 4.6)}<circle cx="12" cy="12" r="2.1"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4" ${S} stroke-width="2.4"/>`,
    laundering: `<path d="M5.4 12A6.6 6.6 0 0 1 14.6 5.9" ${S} stroke-width="2.5"/><path d="M18.6 12A6.6 6.6 0 0 1 9.4 18.1" ${S} stroke-width="2.5"/><path d="M14.2 2.6l4.6 3.4-4.9 2.4.3-5.8Z"/><path d="M9.8 21.4 5.2 18l4.9-2.4-.3 5.8Z"/><circle cx="12" cy="12" r="2.2"/>`,
    victim: `<path ${EO} d="M12 2.2 20 5.4V11c0 5.4-3.4 9.4-8 10.8C7.4 20.4 4 16.4 4 11V5.4l8-3.2Zm3.6 7.2-1.6-1.6-3.2 3.2-1.6-1.6-1.6 1.6 3.2 3.2 4.8-4.8Z"/>`,
    unknown: `<circle cx="12" cy="12" r="8" ${S} stroke-width="2.3" stroke-dasharray="3.2 3"/><circle cx="12" cy="12" r="2.4"/>`,
  };

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
  Object.assign(KL, { typeIcon, roleIcon, avatar, typeBadge, roleBadge, TYPE_PATHS, ROLE_PATHS, chainIcon, chainColor, CHAIN_ICONS: CHAIN });
})();
