/* 공통: i18n, API 호출, 내비게이션, 포맷터, 차트, 표 행 (모든 페이지 공용) */
window.KL = (() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const I18N = {
    ko: {
      nav_home: "홈", nav_incidents: "사건", nav_briefings: "브리핑", nav_stats: "통계", nav_addresses: "주소 조회", brand_sub: "가상자산 해킹·범죄 주소 일일 원장", hero_pill: "{n}개 소스 · 매시간 자동 수집", hero_sub: "공개 소스를 매시간 모아 LLM이 한국어·영어로 요약하고, 지갑 주소는 OFAC·블랙리스트와 대조합니다.", hero_fallback: "가상자산 해킹·범죄 주소 일일 원장", cta_incidents: "사건 보기", cta_addresses: "주소 조회", net_title: "{n}개 소스가 매시간 원장으로 모입니다", net_desc: "{list} 외 {m}개 소스를 각자 다른 주기로 수집하고, 같은 사건은 하나로 합쳐 교차 검증 수를 보여줍니다.",
      hero_phrases: ["가상자산 해킹을 추적합니다", "범죄 지갑 주소를 모읍니다", "제재·수사 동향을 매시간 갱신합니다", "한국어와 영어로 브리핑합니다"],
      hero_sub_prefix: "소스", updated: "갱신", sources_word: "개 소스 · 매시간 수집",
      total: "사건", all: "전체", tab_value: "피해 금액", tab_type: "공격 유형", tab_chain: "체인별", tab_legal: "제재·수사·주소",
      mode_amount: "금액 (USD)", mode_count: "건수", table_view: "표로 보기", latest_briefing: "일일 브리핑", search_ph: "프로젝트 이름, 주소, 키워드 검색",
      hide_follow: "후속 보도 숨기기", th_incident: "사건", th_amount: "피해 금액", th_date: "사건일", th_type: "공격 유형", th_chain: "체인", th_addr: "주소", th_conf: "교차 검증",
      foot: "Incident Ledger · 공개 소스에서 매시간 자동 수집하고 LLM이 요약합니다. 오류가 있을 수 있으니 주소는 반드시 원문으로 재확인하세요.",
      kpi_today: "오늘 신규", kpi_7d: "7일 사건", kpi_loss: "7일 피해·관련 금액", kpi_addr: "7일 수집 주소", kpi_sdn: "OFAC 제재 주소", vs_prev: "지난 7일 대비",
      total_value: "기간 내 금액", total_count: "기간 내 사건", top_projects: "피해액 상위 5", by_type: "유형별 건수", by_chain: "체인별 건수", legal_side: "역할별 주소",
      follow: "후속", first_reported: "첫 보도", background: "사건 배경", method: "공격 / 범죄 수법", summary: "요약", flow: "자금 흐름", addresses: "지갑 주소",
      sources: "출처", actors: "관련 주체", tx: "트랜잭션", blacklist: "기존 블랙리스트 재등장", copy: "복사", copied: "복사됨", no_data: "해당 조건의 사건이 없습니다",
      day: "날짜", count: "건수", type: "유형", chain: "체인", amount: "금액", report: "상세 리포트 (GitHub)", all_types: "모든 유형", all_chains: "모든 체인", all_sources: "모든 소스",
      reported: "보고", sources_n: "출처 {n}개", unit: "건", back: "사건 목록", facts: "개요", related: "관련 사건", incident_date: "사건일",
      report_date: "보고일", tags: "태그", all_roles: "모두", not_found: "사건을 찾을 수 없습니다", cross_check: "교차 검증", cross_desc: "같은 사건을 다룬 출처 수",
      amount_unknown: "금액 미상", loss_label: "피해·관련 금액", recent: "최근 사건", see_all: "전체 보기 →", todays_briefing: "오늘의 브리핑", more_briefings: "지난 브리핑 →",
      home_stats: "최근 30일 통계 →", addr_title: "지갑 주소 조회", addr_ph: "0x… / T… / bc1… 주소 또는 일부 입력 (6자 이상)", addr_hint: "수집된 사건 카드, OFAC SDN 목록, crimial_hunter 블랙리스트를 한 번에 대조합니다.",
      addr_found_in: "사건 카드에서 발견", addr_sdn: "OFAC SDN 제재 목록", addr_bl: "crimial_hunter 블랙리스트", addr_none: "일치하는 기록이 없습니다", addr_role: "역할", addr_incident: "사건",
      known_addresses: "수집 주소", sanctioned_addresses: "제재 주소", incidents_total: "누적 사건", days_covered: "수집 일수", sort: "정렬", sort_day: "보고일", sort_amount: "금액", sort_date: "사건일",
      briefing_days: "날짜", briefing_incidents: "이 날의 사건", page: "페이지", legal: "제재·수사", new_label: "신규",
      types: { hack_exploit: "해킹/익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱/드레이너",
               scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사/기소/압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles: { attacker: "공격자", laundering: "세탁/경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      nav_home: "Home", nav_incidents: "Incidents", nav_briefings: "Briefings", nav_stats: "Stats", nav_addresses: "Address lookup", brand_sub: "crypto hack & illicit address daily ledger", hero_pill: "{n} sources · collected hourly", hero_sub: "Public sources are collected hourly, summarized in Korean and English by an LLM, and every wallet address is checked against OFAC and blacklists.", hero_fallback: "Crypto hack & illicit address daily ledger", cta_incidents: "Browse incidents", cta_addresses: "Look up an address", net_title: "{n} sources flow into one ledger every hour", net_desc: "{list} and {m} more, each on its own schedule. Duplicate reports are merged into one incident with a cross-check count.",
      hero_phrases: ["We track crypto hacks", "We collect illicit wallet addresses", "We refresh sanctions & enforcement hourly", "We brief in Korean and English"],
      hero_sub_prefix: "Sources", updated: "Updated", sources_word: " sources · hourly",
      total: "Incidents", all: "All", tab_value: "Exploited Value", tab_type: "Attack Vector", tab_chain: "By Chain", tab_legal: "Sanctions · Enforcement · Addresses",
      mode_amount: "Value (USD)", mode_count: "Count", table_view: "Table view", latest_briefing: "Daily Briefing", search_ph: "Search project, address, keyword",
      hide_follow: "Hide follow-ups", th_incident: "Incident", th_amount: "Amount", th_date: "Date", th_type: "Attack Vector", th_chain: "Chain", th_addr: "Addr.", th_conf: "Cross-check",
      foot: "Incident Ledger · collected hourly from public sources and summarized by an LLM. Errors are possible; always re-verify addresses against the original source.",
      kpi_today: "New today", kpi_7d: "Incidents (7d)", kpi_loss: "Loss & related (7d)", kpi_addr: "Addresses (7d)", kpi_sdn: "OFAC sanctioned addresses", vs_prev: "vs previous 7d",
      total_value: "Value (period)", total_count: "Incidents (period)", top_projects: "Top 5 by loss", by_type: "Count by type", by_chain: "Count by chain", legal_side: "Addresses by role",
      follow: "follow-up", first_reported: "first reported", background: "Background", method: "Attack / Modus operandi", summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses",
      sources: "Sources", actors: "Actors", tx: "Transactions", blacklist: "Known blacklist re-hits", copy: "Copy", copied: "Copied", no_data: "No incidents match the filters",
      day: "Day", count: "Count", type: "Type", chain: "Chain", amount: "Amount", report: "Full report (GitHub)", all_types: "All types", all_chains: "All chains", all_sources: "All sources",
      reported: "reported", sources_n: "{n} sources", unit: "", back: "All incidents", facts: "Overview", related: "Related incidents", incident_date: "Incident date",
      report_date: "Reported", tags: "Tags", all_roles: "All", not_found: "Incident not found", cross_check: "Cross-check", cross_desc: "number of sources covering this incident",
      amount_unknown: "amount unknown", loss_label: "Loss & related amount", recent: "Recent incidents", see_all: "See all →", todays_briefing: "Today's briefing", more_briefings: "Past briefings →",
      home_stats: "Last 30 days →", addr_title: "Wallet address lookup", addr_ph: "Enter an address or fragment (0x… / T… / bc1…, 6+ chars)", addr_hint: "Checks collected incident cards, the OFAC SDN list and the crimial_hunter blacklist at once.",
      addr_found_in: "Found in incident cards", addr_sdn: "OFAC SDN sanctions list", addr_bl: "crimial_hunter blacklist", addr_none: "No matching records", addr_role: "Role", addr_incident: "Incident",
      known_addresses: "Collected addresses", sanctioned_addresses: "Sanctioned addresses", incidents_total: "Incidents total", days_covered: "Days covered", sort: "Sort", sort_day: "Report date", sort_amount: "Amount", sort_date: "Incident date",
      briefing_days: "Days", briefing_incidents: "Incidents that day", page: "Page", legal: "Sanctions · Enforcement", new_label: "new",
      types: { hack_exploit: "Hack / Exploit", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Drainer",
               scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Law enforcement", laundering_report: "Laundering report", other: "Other" },
      roles: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const TYPE_COLOR = { hack_exploit: "var(--t-hack)", private_key_compromise: "var(--t-key)", rug_pull: "var(--t-rug)", phishing_social_engineering: "var(--t-phish)",
    scam_fraud: "var(--t-scam)", ransomware: "var(--t-ransom)", sanctions_designation: "var(--t-sanction)", law_enforcement_action: "var(--t-law)", laundering_report: "var(--t-launder)", other: "var(--t-other)" };
  const AVATAR = ["#2f6bff", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4", "#84cc16"];
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs",
    chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer" };
  const REPO = "https://github.com/lala-david/crypto_test";
  const PAGES = [["index.html", "nav_home"], ["incidents.html", "nav_incidents"], ["briefings.html", "nav_briefings"], ["stats.html", "nav_stats"], ["addresses.html", "nav_addresses"]];

  const state = { lang: localStorage.getItem("lang") || "ko" };
  const t = (k) => (I18N[state.lang][k] ?? I18N.ko[k] ?? k);
  const typeName = (k) => I18N[state.lang].types[k] || k;
  const roleName = (k) => I18N[state.lang].roles[k] || k;
  const srcLabel = (s) => SOURCE_LABEL[s] || (s || "").replace(/^rss:/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
  const money = (v) => v == null ? "-" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const moneyFull = (v) => v == null ? "" : `<span class="money"><span class="cur">$</span>${fmtInt(v)}</span>`;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (d) => { if (!d) return "-"; const [y, m, dd] = d.split("-"); return state.lang === "ko" ? `${y}.${m}.${dd}` : `${MON[+m - 1]} ${dd} ${y}`; };
  const dayOf = (i) => i.incident_date || i.day;
  const txt = (i, f) => i[`${f}_${state.lang}`] || i[`${f}_${state.lang === "ko" ? "en" : "ko"}`] || "";
  const avatarColor = (name) => { let h = 0; for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };
  const initials = (name) => (name || "?").replace(/[^A-Za-z0-9가-힣 ]/g, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const explorer = (chain, addr) => {
    const c = (chain || "").toUpperCase();
    if (addr.startsWith("0x")) return c === "BSC" ? `https://bscscan.com/address/${addr}` : c === "ARB" ? `https://arbiscan.io/address/${addr}` : c === "POLYGON" ? `https://polygonscan.com/address/${addr}` : c === "BASE" ? `https://basescan.org/address/${addr}` : `https://etherscan.io/address/${addr}`;
    if (c === "TRX" || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return `https://tronscan.org/#/address/${addr}`;
    if (c === "BTC") return `https://mempool.space/address/${addr}`;
    if (c === "SOL") return `https://solscan.io/account/${addr}`;
    if (c === "LTC") return `https://blockchair.com/litecoin/address/${addr}`;
    return "";
  };
  const shortText = (s, n = 24) => { s = (s || "").replace(/\s*\(.*$/, "").trim(); return s ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "-"; };
  const pill = (i) => `<span class="pill"><span class="dot" style="background:${TYPE_COLOR[i.type] || "var(--t-other)"}"></span>${esc(typeName(i.type))}</span>`;
  const chainPills = (chains, max = 2) => (chains || []).slice(0, max).map((c) => `<span class="pill chain">${esc(c)}</span>`).join(" ") + ((chains || []).length > max ? ` <span class="muted small">+${chains.length - max}</span>` : "") + (!(chains || []).length ? '<span class="muted">-</span>' : "");
  const gauge = (n) => {
    const pct = Math.min(1, n / 5); const r = 16, cx = 30, cy = 26; const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = p(Math.PI), [x1, y1] = p(Math.PI + Math.PI * pct);
    const color = n >= 3 ? "var(--good)" : n === 2 ? "var(--warning)" : "var(--critical)";
    const arc = pct > 0 ? `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>` : "";
    return `<svg class="gauge" viewBox="0 0 60 40"><path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" stroke="var(--raised)" stroke-width="3" fill="none"/>${arc}<text x="30" y="30" text-anchor="middle">${n}</text></svg>`;
  };
  const detailUrl = (i) => `incident.html?id=${encodeURIComponent(i.uid)}`;
  const mdToHtml = (md) => {
    const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, ""));
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`;
  };

  // ---- API ----
  const api = async (path, params) => {
    const u = new URL(path, location.origin);
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) u.searchParams.set(k, v); });
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) { let msg = `${r.status}`; try { msg = (await r.json()).detail || msg; } catch (_) {} throw new Error(msg); }
    return r.json();
  };

  // ---- 공통 UI ----
  function renderNav(active, meta) {
    const nav = $("#nav"); if (!nav) return;
    nav.innerHTML = `<div class="nav-l"><a class="brand" href="index.html"><span class="mark">${MARK}</span><span class="word">Incident Ledger</span><span class="brand-sub">${esc(t("brand_sub"))}</span></a>
      <div class="nav-links">${PAGES.map(([href, key]) => `<a class="nav-link ${active === href ? "on" : ""}" href="${href}">${esc(t(key))}</a>`).join("")}</div></div>
      <div class="nav-r"><span class="updated">${meta && meta.generated_at ? esc(t("updated")) + " " + esc(meta.generated_at.replace("T", " ").slice(0, 16)) : ""}</span>
      <button id="themeBtn" class="icon-btn" type="button" aria-label="theme">◐</button><button id="langBtn" class="btn-ghost" type="button" aria-label="language">${state.lang === "ko" ? "EN" : "한국어"}</button></div>`;
  }
  function renderFoot() { const f = $("#foot"); if (f) f.innerHTML = `${esc(t("foot"))} · <a href="${REPO}" target="_blank" rel="noopener">GitHub</a> · <a href="/api" target="_blank" rel="noopener">API</a>`; }
  function applyI18n() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  }
  function applyTheme(th) { document.documentElement.dataset.theme = th; const b = $("#themeBtn"); if (b) b.textContent = th === "dark" ? "☾" : "☀"; }
  function bindChrome(onLang) {
    applyTheme(new URLSearchParams(location.search).get("theme") || localStorage.getItem("theme") || "dark");
    const tb = $("#themeBtn"); if (tb) tb.onclick = () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", next); applyTheme(next); };
    const lb = $("#langBtn"); if (lb) lb.onclick = () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); onLang && onLang(); };
  }
  const bindTips = (root) => $$("[data-tip]", root).forEach((el) => {
    el.addEventListener("mousemove", (e) => { const tp = $("#tip"); if (!tp) return; tp.innerHTML = el.dataset.tip; tp.classList.add("show"); tp.style.left = e.clientX + "px"; tp.style.top = (e.clientY - 8) + "px"; });
    el.addEventListener("mouseleave", () => { const tp = $("#tip"); if (tp) tp.classList.remove("show"); });
  });
  function constellation(el, n = 26, seed = 7) {
    if (!el) return;
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const W = 1200, H = 420; const pts = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, r: 1.5 + rnd() * 3.5 }));
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = pts[i], b = pts[j]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 260) svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--line)" stroke-width="1" opacity="${(1 - d / 260) * 0.8}"/>`; }
    pts.forEach((p, k) => { svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r * 3}" fill="var(--glow)" opacity="0.25"/><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#fff" opacity="${k % 3 ? 0.9 : 0.6}"/>`; });
    el.innerHTML = svg + "</svg>";
  }

  // ---- 차트 ----
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const GRAD = `<defs><linearGradient id="gv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart-2)"/><stop offset="1" stop-color="var(--chart)"/></linearGradient><linearGradient id="gh" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--chart)"/><stop offset="1" stop-color="var(--chart-2)"/></linearGradient></defs>`;
  function columns(el, buckets, fmt, ariaLabel) {
    if (!buckets.length) { el.innerHTML = `<div class="empty">${t("no_data")}</div>`; return; }
    const W = 640, H = 260, m = { l: 54, r: 10, t: 10, b: 28 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = niceMax(Math.max(...buckets.map((b) => b.v))); const slot = pw / buckets.length; const bw = Math.max(3, Math.min(22, slot * 0.6));
    const x = (k) => m.l + (k + 0.5) * slot; const y = (v) => m.t + ph - (v / max) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${GRAD}`;
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const v = max * f; s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    buckets.forEach((b, k) => {
      if (b.v) s += `<rect class="bar v" x="${x(k) - bw / 2}" y="${y(b.v)}" width="${bw}" height="${Math.max(1, y(0) - y(b.v))}" rx="3"/>`;
      s += `<rect class="hit" x="${x(k) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}" data-tip="<b>${esc(b.label)}</b><br>${esc(fmt(b.v))}${b.extra ? " · " + esc(b.extra) : ""}"/>`;
    });
    const step = Math.max(1, Math.ceil(buckets.length / 7));
    buckets.forEach((b, k) => { if (k % step === 0 || k === buckets.length - 1) s += `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${esc(b.short || b.label)}</text>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function hbars(el, items, fmt, title) {
    if (!items.length) { el.innerHTML = `<h4>${esc(title)}</h4><div class="empty">${t("no_data")}</div>`; return; }
    const W = 360, rowH = 34, m = { l: 100, r: 56, t: 6, b: 22 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r;
    const max = niceMax(Math.max(...items.map((i) => i.v)));
    let s = `${title ? `<h4>${esc(title)}</h4>` : ""}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || "chart")}">${GRAD}`;
    [0, 0.5, 1].forEach((f) => { const xx = m.l + pw * f; s += `<line class="grid" x1="${xx}" x2="${xx}" y1="${m.t}" y2="${H - m.b}"/><text x="${xx}" y="${H - 6}" text-anchor="middle">${esc(fmt(max * f))}</text>`; });
    items.forEach((it, k) => {
      const yy = m.t + k * rowH + 5, w = Math.max(2, (it.v / max) * pw);
      s += `<text class="lbl" x="${m.l - 8}" y="${yy + 15}" text-anchor="end">${esc(it.k.length > 14 ? it.k.slice(0, 13) + "…" : it.k)}</text>`;
      s += `<rect class="bar h" x="${m.l}" y="${yy}" width="${w}" height="22" rx="3"/>`;
      s += `<rect class="hit" x="0" y="${yy - 4}" width="${W}" height="${rowH}" data-tip="<b>${esc(it.k)}</b><br>${esc(fmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`;
    });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }

  // ---- 표 행 ----
  function incidentRow(i) {
    const d = dayOf(i); const rep = i.day !== d && Math.abs((new Date(i.day) - new Date(d)) / 864e5) > 3 ? `<div class="psub">${esc(t("reported"))} ${i.day}</div>` : "";
    return `<tr data-href="${detailUrl(i)}">
      <td><div class="proj"><span class="swatch" style="--type:${TYPE_COLOR[i.type] || "var(--t-other)"}"></span><div><a class="pname" href="${detailUrl(i)}">${esc(i.project)}</a><div>${i.followup_of ? `<span class="tag">↩ ${esc(t("follow"))} ${esc((i.followup_of.day || "").slice(5))}</span>` : ""}${i.blacklist_hits ? `<span class="tag warn">⚠ ${i.blacklist_hits}</span>` : ""}</div>${rep}</div></div></td>
      <td>${i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="muted">${esc(shortText(i.amount_text))}</span>`}</td>
      <td><span class="date">${esc(fmtDate(d))}</span></td>
      <td>${pill(i)}</td>
      <td>${chainPills(i.chains)}</td>
      <td class="num mono">${i.addresses.length}</td>
      <td class="center" title="${esc(t("sources_n").replace("{n}", i.sources.length))}">${gauge(i.sources.length)}</td></tr>`;
  }
  const TABLE_HEAD = () => `<thead><tr><th>${esc(t("th_incident"))}</th><th>${esc(t("th_amount"))}</th><th>${esc(t("th_date"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_chain"))}</th><th class="num">${esc(t("th_addr"))}</th><th class="center">${esc(t("th_conf"))}</th></tr></thead>`;
  function bindRows(root) { $$("tr[data-href]", root).forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("a")) return; location.href = tr.dataset.href; })); }
  function fillSelect(sel, values, allLabel, current) { sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join(""); }

  // ---- 브랜드 마크 ----
  const MARK = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.5h14M5 12h9M5 17.5h14" stroke="#04150d" stroke-width="2.6" stroke-linecap="round"/><circle cx="17.5" cy="12" r="2" fill="#04150d"/></svg>`;
  const MONO = { rekt: "RKT", trm: "TRM", chainalysis: "CHA", ofac: "OFAC", ofac_sdn: "SDN", doj: "DOJ", slowmist: "SM", defillama: "DL", zachxbt: "ZX", defihacklabs: "DHL", scamsniffer: "SS" };
  const monogram = (s) => MONO[s] || (s || "").replace(/^rss:/, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "?";

  // ---- Velaris (WebGL simplex-noise 그라디언트) 바닐라 포팅 ----
  const VELARIS_VS = `attribute vec2 position; varying vec2 vUv; void main(){ vUv = position*0.5+0.5; gl_Position = vec4(position,0.0,1.0); }`;
  const VELARIS_FS = `precision highp float; varying vec2 vUv; uniform vec2 u_resolution; uniform float u_time; uniform float u_grain; uniform vec3 u_colors[4]; uniform vec3 u_bg;
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){ const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx); vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g); }
void main(){ vec2 uv = vUv; float ratio = u_resolution.x / u_resolution.y; vec2 p = uv - 0.5; p.x *= ratio; float t = u_time * 0.1;
  float n1 = snoise(p*0.4 + vec2(t*0.2, -t*0.3)); float n2 = snoise(p*0.55 + vec2(-t*0.15, t*0.25) + n1*0.25); float n3 = snoise(p*0.75 + vec2(t*0.1, -t*0.2) + n2*0.2);
  vec3 col = u_bg; float dist = length(p) * 1.5; float vignette = 1.0 - smoothstep(0.3, 1.2, dist);
  col = mix(col, u_colors[0], smoothstep(-0.2, 0.5, n1) * 0.85); col = mix(col, u_colors[1], smoothstep(-0.1, 0.6, n2) * 0.7);
  col = mix(col, u_colors[2], smoothstep(-0.3, 0.4, n3) * 0.6); col = mix(col, u_colors[3], smoothstep(0.0, 0.7, n1*n2) * 0.5);
  float glow = smoothstep(0.8, 0.0, dist) * 0.3; col += u_colors[1] * glow; col = mix(col * 0.2, col, vignette);
  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time); col += (grain - 0.5) * u_grain * 0.1; gl_FragColor = vec4(col, 1.0); }`;
  const hexRgb = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255); };
  const shade = (hex, f) => "#" + [0, 2, 4].map((k) => Math.round(parseInt(hex.replace("#", "").slice(k, k + 2), 16) * f).toString(16).padStart(2, "0")).join("");
  function velaris(el, o = {}) {
    if (!el) return null;
    if (el._velaris) { if (o.colors) el._velaris.setColors(o.colors); return el._velaris; }
    const opt = Object.assign({ bg: "#04070a", colors: ["#34d399", "#059669", "#064e3b", "#020617"], speed: 1.4, grain: 0.28 }, o);
    const canvas = document.createElement("canvas"); canvas.className = "velaris"; el.prepend(canvas);
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) { el.classList.add("no-webgl"); canvas.remove(); return null; }
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VELARIS_VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, VELARIS_FS)); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "position"); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const U = { res: gl.getUniformLocation(prog, "u_resolution"), time: gl.getUniformLocation(prog, "u_time"), grain: gl.getUniformLocation(prog, "u_grain"), colors: gl.getUniformLocation(prog, "u_colors"), bg: gl.getUniformLocation(prog, "u_bg") };
    let colors = opt.colors.slice(0, 4); while (colors.length < 4) colors.push(colors[colors.length - 1] || "#000000");
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = Math.max(1, Math.round(el.clientWidth * dpr)); canvas.height = Math.max(1, Math.round(el.clientHeight * dpr)); gl.viewport(0, 0, canvas.width, canvas.height); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, running = true;
    const draw = (ms) => { gl.uniform2f(U.res, canvas.width, canvas.height); gl.uniform1f(U.time, ms * 0.001 * opt.speed); gl.uniform1f(U.grain, opt.grain); gl.uniform3f(U.bg, ...hexRgb(opt.bg)); gl.uniform3fv(U.colors, new Float32Array(colors.flatMap(hexRgb))); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    const loop = (ms) => { if (!running) return; draw(ms); if (!reduce) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; raf = requestAnimationFrame(loop); } });
    el._velaris = { setColors(c) { colors = c.slice(0, 4); while (colors.length < 4) colors.push(colors[colors.length - 1]); if (reduce) draw(performance.now()); }, stop() { running = false; cancelAnimationFrame(raf); ro.disconnect(); } };
    return el._velaris;
  }
  const typeGradient = (hex) => [hex, shade(hex, 0.62), shade(hex, 0.3), "#020617"];

  // ---- 소스 네트워크 (Integration Card 포팅: 중앙 노드 ↔ 주변 노드 사이 흐르는 경로) ----
  const NET_SLOTS = [
    { x: 110, y: 90, d: "M 270 205 V 105 Q 270 90 255 90 H 110" }, { x: 360, y: 70, d: "M 294 205 V 85 Q 294 70 309 70 H 360" },
    { x: 160, y: 205, d: "M 250 205 H 160" }, { x: 480, y: 205, d: "M 314 205 H 480" },
    { x: 282, y: 360, d: "M 282 205 V 360" }, { x: 460, y: 340, d: "M 314 215 V 325 Q 314 340 329 340 H 460" },
  ];
  function network(el, nodes) {
    if (!el) return;
    const id = "net" + Math.random().toString(36).slice(2, 7);
    const paths = NET_SLOTS.slice(0, nodes.length).map((s, k) => `<path class="base" d="${s.d}"/><path class="flow" d="${s.d}" stroke="url(#${id}-${k})" style="animation-delay:-${(k * 0.7) % 4}s"/>
      <defs><linearGradient id="${id}-${k}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="transparent"/><stop offset="50%" stop-color="var(--primary)" stop-opacity="0.75"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>`).join("");
    const coreMark = `<span class="mark" style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#34d399,#059669 60%,#064e3b)">${MARK.replace("<svg ", '<svg width="18" height="18" ')}</span>`;
    el.innerHTML = `<div class="dots"></div><div class="fade"></div><svg class="lines" viewBox="0 0 564 410" fill="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>
      <div class="node core" style="left:50%;top:50%"><div class="inner">${coreMark}</div><div class="ring"></div></div>
      ${nodes.map((n, k) => { const s = NET_SLOTS[k]; return `<div class="node" title="${esc(n.title || n.sub || "")}" style="left:${(s.x / 564) * 100}%;top:${(s.y / 410) * 100}%;animation-delay:${0.1 + k * 0.1}s">${esc(n.label)}<small>${esc(n.sub || "")}</small></div>`; }).join("")}`;
  }

  return { $, $$, I18N, TYPE_COLOR, REPO, state, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, avatarColor, initials, explorer,
           shortText, pill, chainPills, gauge, detailUrl, mdToHtml, api, renderNav, renderFoot, applyI18n, applyTheme, bindChrome, bindTips, constellation,
           columns, hbars, niceMax, incidentRow, TABLE_HEAD, bindRows, fillSelect, velaris, network, monogram, typeGradient, shade, MARK };
})();
