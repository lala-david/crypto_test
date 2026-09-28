/* 유형·역할·종류 아이콘 (직접 그린 24×24 라인 아이콘, stroke=currentColor). KL.typeIcon(type) · KL.roleIcon(role) · KL.avatar(i) · KL.roleBadge(role) */
(() => {
  "use strict";
  const { esc, typeName, typeFull, roleName, TYPE_COLOR } = KL;
  const wrap = (paths, extra = "") => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${paths}</svg>`;
  // 유형별: 해킹=깨진 방패 · 개인키=열쇠 · 피싱=낚싯바늘 · 러그풀=말린 카펫+화살 · 사기=가면 · 랜섬웨어=자물쇠 · 제재=금지 원 · 수사·기소=망치(가벨) · 세탁=순환 화살표+$ · 기타=점
  const F = 'fill="currentColor" fill-opacity=".2"';
  // 유형별(면 20% + 선): 해킹=방패+번개 · 개인키=열쇠 · 피싱=코인 미끼 낚싯바늘 · 러그풀=떨어지는 화살+말린 카펫 · 사기=가면 · 랜섬웨어=자물쇠 · 제재=팔각 금지 · 수사·기소=가벨 · 세탁=순환+$ · 기타=스파클
  const TYPE_PATHS = {
    hack_exploit: `<path d="M12 2.5l7.5 3v5.5c0 5.3-3.2 9.2-7.5 10.7C7.7 20.2 4.5 16.3 4.5 11V5.5l7.5-3z" ${F}/><path d="M13.3 6.8l-3.5 5.2h3.8l-2.7 5.2" stroke-width="2.2"/>`,
    private_key_compromise: `<circle cx="7.5" cy="16.5" r="3.6" ${F}/><path d="M10.1 13.9L19.6 4.4"/><path d="M16.2 7.8l2.6 2.6M13.2 10.8l2.1 2.1"/><path d="M19.6 4.4l1.2 1.2" stroke-width="2.4"/>`,
    phishing_social_engineering: `<circle cx="14" cy="5.2" r="2.3" ${F}/><path d="M14 7.5v6.2a4 4 0 0 1-8 0V12"/><path d="M6 12l2.3 1.5"/>`,
    rug_pull: `<path d="M12 2.8v8.6M8.4 7.8l3.6 3.6 3.6-3.6"/><path d="M3 17.6h11.5"/><circle cx="17.5" cy="15.3" r="2.9" ${F}/><path d="M17.5 15.3h1.5"/>`,
    scam_fraud: `<path d="M4.5 6.3c2.5-2.1 12.5-2.1 15 0 0 5.6-.5 9.2-3.5 12.2-1.5 1.5-3 2.5-4 2.5s-2.5-1-4-2.5c-3-3-3.5-6.6-3.5-12.2z" ${F}/><path d="M8 11.4c.8-.9 2-.9 2.8 0M13.2 11.4c.8-.9 2-.9 2.8 0"/><path d="M9 15.8c1.7 1.4 4.3 1.4 6 0"/>`,
    ransomware: `<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" ${F}/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/><circle cx="12" cy="14.8" r="1.4" fill="currentColor" stroke="none"/><path d="M12 16.2v2.3"/>`,
    sanctions_designation: `<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3z" ${F}/><path d="M7.8 12h8.4" stroke-width="2.6"/>`,
    law_enforcement_action: `<path d="M13.6 3.4l7 7-2.6 2.6-7-7z" ${F}/><path d="M14.6 9.4L4.6 19.4"/><path d="M3 21.2h8.2"/><path d="M11.2 4.8l1.2-1.2M19.4 13l1.2-1.2" stroke-width="1.6"/>`,
    laundering_report: `<path d="M5.2 12A6.8 6.8 0 0 1 16.4 6.8"/><path d="M18.8 12A6.8 6.8 0 0 1 7.6 17.2"/><path d="M16.6 3.6v3.2h-3.2M7.4 20.4v-3.2h3.2"/><circle cx="12" cy="12" r="3.3" ${F}/><text x="12" y="14.6" text-anchor="middle" font-family="Geist Mono, Menlo, monospace" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">$</text>`,
    other: `<path d="M12 3c.6 4.8 4.2 8.4 9 9-4.8.6-8.4 4.2-9 9-.6-4.8-4.2-8.4-9-9 4.8-.6 8.4-4.2 9-9z" ${F}/>`,
  };
  // 역할: 제재=팔각 금지 · 공격자=조준선 · 세탁·경유=순환 · 피해자=방패+체크 · 미분류=물음표
  const ROLE_PATHS = {
    sanctioned: TYPE_PATHS.sanctions_designation,
    attacker: `<circle cx="12" cy="12" r="7" ${F}/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>`,
    laundering: `<path d="M5.2 12A6.8 6.8 0 0 1 16.4 6.8"/><path d="M18.8 12A6.8 6.8 0 0 1 7.6 17.2"/><path d="M16.6 3.6v3.2h-3.2M7.4 20.4v-3.2h3.2"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>`,
    victim: `<path d="M12 2.5l7.5 3v5.5c0 5.3-3.2 9.2-7.5 10.7C7.7 20.2 4.5 16.3 4.5 11V5.5l7.5-3z" ${F}/><path d="M8.8 12l2.2 2.2 4.4-4.4"/>`,
    unknown: `<circle cx="12" cy="12" r="8.5" ${F}/><path d="M9.4 9.6a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.1.9-1.1 1.8"/><circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>`,
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
