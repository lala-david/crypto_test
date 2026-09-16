/* 공통: i18n 사전, 포맷터, 데이터 로더, 테마/언어 토글 (index.html, incident.html 공용) */
window.KL = (() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const I18N = {
    ko: {
      nav_hacks: "사건", nav_briefing: "브리핑", nav_stats: "통계", brand_sub: "Threat Intelligence",
      hero_phrases: ["가상자산 해킹을 추적합니다", "범죄 지갑 주소를 모읍니다", "제재·수사 동향을 매시간 갱신합니다", "한국어와 영어로 브리핑합니다"],
      hero_sub: "rekt · SlowMist · DeFiLlama · DeFiHackLabs · ZachXBT · TRM · Chainalysis · OFAC · DOJ 등 12개 소스", updated: "갱신",
      total: "사건", all: "전체", tab_value: "피해 금액", tab_type: "공격 유형", tab_chain: "체인별", tab_legal: "제재·수사·주소",
      mode_amount: "금액 (USD)", mode_count: "건수", table_view: "표로 보기", latest_briefing: "일일 브리핑", search_ph: "프로젝트 이름, 주소, 키워드 검색",
      hide_follow: "후속 보도 숨기기", th_incident: "사건", th_amount: "피해 금액", th_date: "사건일", th_type: "공격 유형", th_chain: "체인", th_addr: "주소", th_conf: "교차 검증",
      foot: "데이터는 공개 소스에서 자동 수집·LLM 요약된 것으로 오류가 있을 수 있습니다. 주소는 반드시 원문으로 재확인하세요.",
      kpi_today: "오늘 신규", kpi_7d: "7일 사건", kpi_loss: "7일 피해·관련 금액", kpi_addr: "7일 수집 주소", kpi_sdn: "OFAC 제재 주소", vs_prev: "지난 7일 대비",
      total_value: "기간 내 금액", total_count: "기간 내 사건", top_projects: "피해액 상위 5", by_type: "유형별 건수", by_chain: "체인별 건수", legal_side: "역할별 주소",
      follow: "후속", first_reported: "첫 보도", background: "사건 배경", method: "공격 / 범죄 수법", summary: "요약", flow: "자금 흐름", addresses: "지갑 주소",
      sources: "출처", actors: "관련 주체", tx: "트랜잭션", blacklist: "기존 블랙리스트 재등장", copy: "복사", copied: "복사됨", no_data: "해당 조건의 사건이 없습니다",
      day: "날짜", count: "건수", type: "유형", chain: "체인", amount: "금액", report: "상세 리포트 (GitHub)", all_types: "모든 유형", all_chains: "모든 체인", all_sources: "모든 소스",
      ticker: "{amt} · {who} · {date}", reported: "보고", sources_n: "출처 {n}개", unit: "건", back: "사건 목록", facts: "개요", related: "관련 사건", incident_date: "사건일",
      report_date: "보고일", tags: "태그", role_filter: "역할", all_roles: "모두", not_found: "사건을 찾을 수 없습니다", open_detail: "상세 페이지", cross_check: "교차 검증",
      cross_desc: "같은 사건을 다룬 출처 수", amount_unknown: "금액 미상", loss_label: "피해·관련 금액",
      types: { hack_exploit: "해킹/익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱/드레이너",
               scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사/기소/압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles: { attacker: "공격자", laundering: "세탁/경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      nav_hacks: "Incidents", nav_briefing: "Briefing", nav_stats: "Stats", brand_sub: "Threat Intelligence",
      hero_phrases: ["We track crypto hacks", "We collect illicit wallet addresses", "We refresh sanctions & enforcement hourly", "We brief in Korean and English"],
      hero_sub: "12 sources: rekt · SlowMist · DeFiLlama · DeFiHackLabs · ZachXBT · TRM · Chainalysis · OFAC · DOJ …", updated: "Updated",
      total: "Incidents", all: "All", tab_value: "Exploited Value", tab_type: "Attack Vector", tab_chain: "By Chain", tab_legal: "Sanctions · Enforcement · Addresses",
      mode_amount: "Value (USD)", mode_count: "Count", table_view: "Table view", latest_briefing: "Daily Briefing", search_ph: "Search project, address, keyword",
      hide_follow: "Hide follow-ups", th_incident: "Incident", th_amount: "Amount", th_date: "Date", th_type: "Attack Vector", th_chain: "Chain", th_addr: "Addr.", th_conf: "Cross-check",
      foot: "Data is auto-collected from public sources and summarized by an LLM; errors are possible. Always re-verify addresses against the original source.",
      kpi_today: "New today", kpi_7d: "Incidents (7d)", kpi_loss: "Loss & related (7d)", kpi_addr: "Addresses (7d)", kpi_sdn: "OFAC sanctioned addresses", vs_prev: "vs previous 7d",
      total_value: "Value (period)", total_count: "Incidents (period)", top_projects: "Top 5 by loss", by_type: "Count by type", by_chain: "Count by chain", legal_side: "Addresses by role",
      follow: "follow-up", first_reported: "first reported", background: "Background", method: "Attack / Modus operandi", summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses",
      sources: "Sources", actors: "Actors", tx: "Transactions", blacklist: "Known blacklist re-hits", copy: "Copy", copied: "Copied", no_data: "No incidents match the filters",
      day: "Day", count: "Count", type: "Type", chain: "Chain", amount: "Amount", report: "Full report (GitHub)", all_types: "All types", all_chains: "All chains", all_sources: "All sources",
      ticker: "{amt} · {who} · {date}", reported: "reported", sources_n: "{n} sources", unit: "", back: "All incidents", facts: "Overview", related: "Related incidents", incident_date: "Incident date",
      report_date: "Reported", tags: "Tags", role_filter: "Role", all_roles: "All", not_found: "Incident not found", open_detail: "Open detail page", cross_check: "Cross-check",
      cross_desc: "number of sources covering this incident", amount_unknown: "amount unknown", loss_label: "Loss & related amount",
      types: { hack_exploit: "Hack / Exploit", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Drainer",
               scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Law enforcement", laundering_report: "Laundering report", other: "Other" },
      roles: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const TYPE_COLOR = { hack_exploit: "var(--t-hack)", private_key_compromise: "var(--t-key)", rug_pull: "var(--t-rug)", phishing_social_engineering: "var(--t-phish)",
    scam_fraud: "var(--t-scam)", ransomware: "var(--t-ransom)", sanctions_designation: "var(--t-sanction)", law_enforcement_action: "var(--t-law)", laundering_report: "var(--t-law)", other: "var(--t-other)" };
  const AVATAR = ["#2f6bff", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4", "#84cc16"];
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs",
    chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer" };
  const REPO = "https://github.com/lala-david/crypto_test";

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
  const detailUrl = (i) => `incident.html?id=${encodeURIComponent(i.uid)}&d=${encodeURIComponent(i.day)}`;
  const mdToHtml = (md) => {
    const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, ""));
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`;
  };

  // ---- data ----
  const fetchJson = (p) => fetch(p, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
  const loadAll = () => Promise.all(["incidents", "briefings", "meta"].map((n) => fetchJson(`data/${n}.json`))).then(([incidents, briefings, meta]) => ({ incidents, briefings, meta }));

  // ---- 공통 UI ----
  function applyI18n() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    const lb = $("#langBtn"); if (lb) lb.textContent = state.lang === "ko" ? "EN" : "한국어";
  }
  function applyTheme(th) { document.documentElement.dataset.theme = th; const b = $("#themeBtn"); if (b) b.textContent = th === "dark" ? "☀" : "☾"; }
  function bindChrome(onLang) {
    applyTheme(localStorage.getItem("theme") || "dark");
    const tb = $("#themeBtn"); if (tb) tb.addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", next); applyTheme(next); });
    const lb = $("#langBtn"); if (lb) lb.addEventListener("click", () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); onLang && onLang(); });
  }
  const tip = () => $("#tip");
  const bindTips = (root) => $$("[data-tip]", root).forEach((el) => {
    el.addEventListener("mousemove", (e) => { const tp = tip(); if (!tp) return; tp.innerHTML = el.dataset.tip; tp.classList.add("show"); tp.style.left = e.clientX + "px"; tp.style.top = (e.clientY - 8) + "px"; });
    el.addEventListener("mouseleave", () => tip() && tip().classList.remove("show"));
  });
  // 별자리 배경 (Kloint 홈 느낌) — 결정적 난수로 노드/선 생성
  function constellation(el, n = 26, seed = 7) {
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const W = 1200, H = 420; const pts = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, r: 1.5 + rnd() * 3.5 }));
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = pts[i], b = pts[j]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 260) svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--line)" stroke-width="1" opacity="${(1 - d / 260) * 0.8}"/>`; }
    pts.forEach((p, k) => { svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r * 3}" fill="var(--glow)" opacity="0.25"/><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#fff" opacity="${k % 3 ? 0.9 : 0.6}"/>`; });
    el.innerHTML = svg + "</svg>";
  }

  return { $, $$, I18N, TYPE_COLOR, REPO, state, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, avatarColor, initials, explorer,
           shortText, pill, chainPills, gauge, detailUrl, mdToHtml, fetchJson, loadAll, applyI18n, applyTheme, bindChrome, bindTips, constellation };
})();
