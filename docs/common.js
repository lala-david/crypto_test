/* 공통: i18n · API · 상단 바 · 포맷 · 차트(막대/가로막대/도넛/스파크) · 표 행 */
window.KL = (() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const I18N = {
    ko: {
      nav_home: "개요", nav_incidents: "사건", nav_briefings: "브리핑", nav_stats: "통계", nav_addresses: "지갑 주소",
      recent_addresses: "최근 수집 주소", all_addresses: "수집 주소", th_address: "주소", role_all: "전체 역할", lookup_title: "주소 조회", addr_list_hint: "사건에서 수집한 지갑 주소. 역할은 우선순위(제재 > 공격자 > 세탁 > 피해자)로 하나만 표시.", top_amount5: "금액 상위 5",
      updated: "수집", all: "전체", unit: "건", no_data: "데이터 없음", search_ph: "사건·주소 검색", hide_follow: "후속 제외", days_n: "{n}일", collected_days: "수집 {n}일",
      k_latest_new: "최근일 신규", k_new: "신규 사건", k_follow: "후속 보도", k_loss: "피해액", k_legal: "제재·수사 금액", k_addr: "주소", k_unknown_amt: "금액 미상", vs_prev: "이전 기간 대비",
      daily_count: "일별 사건 수", daily_amount: "일별 피해액", share_type: "유형 비중", share_chain: "대표 체인 비중", by_source: "출처별 사건", top_amount: "금액 상위 10", recent: "최근 사건", roles: "주소 역할",
      basis_new: "신규 기준", basis_collected: "수집일 기준", basis_event: "사건일 기준", basis_first_chain: "첫 체인 기준", daily_avg: "일평균", peak: "최대", coverage: "커버리지", legal_daily: "제재·수사 일별", event_date: "사건일", collected_date: "수집일",
      th_incident: "사건", th_amount: "금액", th_report: "보고일", th_date: "사건일", th_type: "유형", th_chain: "체인", th_addr: "주소 수", th_src: "출처 수", th_count: "건수", th_new: "신규", th_share: "비중", th_last: "최근 수집", th_source: "출처", th_rank: "#",
      th_count_pct: "건수 %", th_amount_pct: "금액 %", th_avg: "평균", sum: "합계", other: "기타", unknown: "미상", legend_follow: "후속 = 이전 사건의 후속 보도", legend_bl: "BL = 블랙리스트 일치 주소 수",
      briefing: "브리핑", latest_briefing: "최신 브리핑", day_incidents: "당일 사건", follow: "후속", new_label: "신규", background: "배경", method: "수법", summary: "요약", flow: "자금 흐름", addresses: "지갑 주소", sources: "출처", actors: "관련 주체",
      tx: "트랜잭션", blacklist: "블랙리스트", copy: "복사", copied: "복사됨", back: "사건 목록", incident_date: "사건일", report_date: "보고일", amount_unknown: "금액 미상", not_found: "사건을 찾을 수 없습니다", loss_label: "피해액", revised_from: "이전 보고",
      all_types: "유형: 전체", all_chains: "체인: 전체", all_sources: "출처: 전체", sort: "정렬", sort_day: "보고일", sort_amount: "금액", sort_date: "사건일", related: "관련 사건", report: "GitHub 보고서", show_more: "{n}개 더 보기", show_less: "접기", all_roles: "전체", note: "메모",
      addr_ph: "지갑 주소 입력 (6자 이상)", addr_scope: "조회 범위: 사건 주소 · OFAC SDN · 블랙리스트", addr_found_in: "사건 내 주소", addr_sdn: "OFAC SDN", addr_bl: "블랙리스트", addr_none: "일치 없음", addr_role: "역할", lookup: "조회",
      th_entity: "제재 대상", th_programs: "프로그램", th_first_seen: "최초 등재",
      known_addresses: "전체 주소", sanctioned_addresses: "제재 주소 (OFAC)", incidents_total: "누적 사건", days_covered: "수집 일수", legal: "제재·수사", tab_value: "피해액", tab_type: "유형", tab_chain: "체인", mode_amount: "금액", mode_count: "건수",
      day: "날짜", count: "건수", amount: "금액", type: "유형", chain: "체인", foot: "공개 소스 자동 수집 · LLM 요약 · 주소는 원문 재확인", load_error: "데이터를 불러오지 못했습니다", retry: "다시 시도",
      a_theme: "테마 전환", a_lang: "언어 전환", a_prev: "이전 페이지", a_next: "다음 페이지", page_total: "총 {n}건", total_amount: "합계 {v} (후속 제외)",
      types: { hack_exploit: "해킹", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱", scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재", law_enforcement_action: "수사·기소", laundering_report: "세탁 분석", other: "기타" },
      types_full: { hack_exploit: "해킹 / 익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱 / 드레이너", scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사 / 기소 / 압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles_map: { attacker: "공격자", laundering: "세탁·경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      nav_home: "Overview", nav_incidents: "Incidents", nav_briefings: "Briefings", nav_stats: "Stats", nav_addresses: "Wallet addresses",
      recent_addresses: "Recently collected addresses", all_addresses: "Collected addresses", th_address: "Address", role_all: "All roles", lookup_title: "Address lookup", addr_list_hint: "Wallet addresses collected from incidents. One role per address by priority (sanctioned > attacker > laundering > victim).", top_amount5: "Top 5 by amount",
      updated: "Collected", all: "All", unit: "", no_data: "No data", search_ph: "Search incidents / addresses", hide_follow: "Hide follow-ups", days_n: "{n}d", collected_days: "{n} days collected",
      k_latest_new: "New (latest day)", k_new: "New incidents", k_follow: "Follow-ups", k_loss: "Loss", k_legal: "Enforcement amount", k_addr: "Addresses", k_unknown_amt: "Unknown amount", vs_prev: "vs previous period",
      daily_count: "Incidents per day", daily_amount: "Loss per day", share_type: "By type", share_chain: "By primary chain", by_source: "By source", top_amount: "Top 10 by amount", recent: "Recent incidents", roles: "Address roles",
      basis_new: "new only", basis_collected: "by collection day", basis_event: "by incident date", basis_first_chain: "first chain", daily_avg: "avg/day", peak: "peak", coverage: "coverage", legal_daily: "Enforcement per day", event_date: "Incident date", collected_date: "Collected",
      th_incident: "Incident", th_amount: "Amount", th_report: "Reported", th_date: "Incident date", th_type: "Type", th_chain: "Chain", th_addr: "Addresses", th_src: "Sources", th_count: "Count", th_new: "New", th_share: "Share", th_last: "Last run", th_source: "Source", th_rank: "#",
      th_count_pct: "Count %", th_amount_pct: "Amount %", th_avg: "Avg", sum: "Total", other: "Other", unknown: "Unknown", legend_follow: "Follow = follow-up of an earlier incident", legend_bl: "BL = blacklisted address count",
      briefing: "Briefing", latest_briefing: "Latest briefing", day_incidents: "Incidents that day", follow: "Follow", new_label: "new", background: "Background", method: "Method", summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses", sources: "Sources", actors: "Actors",
      tx: "Transactions", blacklist: "Blacklist", copy: "Copy", copied: "Copied", back: "All incidents", incident_date: "Incident date", report_date: "Reported", amount_unknown: "amount unknown", not_found: "Incident not found", loss_label: "Amount", revised_from: "previously",
      all_types: "Type: all", all_chains: "Chain: all", all_sources: "Source: all", sort: "Sort", sort_day: "Report date", sort_amount: "Amount", sort_date: "Incident date", related: "Related", report: "GitHub report", show_more: "Show {n} more", show_less: "Show less", all_roles: "All", note: "Note",
      addr_ph: "Wallet address (6+ chars)", addr_scope: "Scope: incident addresses · OFAC SDN · blacklist", addr_found_in: "In incidents", addr_sdn: "OFAC SDN", addr_bl: "Blacklist", addr_none: "No match", addr_role: "Role", lookup: "Look up",
      th_entity: "Entity", th_programs: "Programs", th_first_seen: "First listed",
      known_addresses: "All addresses", sanctioned_addresses: "Sanctioned (OFAC)", incidents_total: "Incidents total", days_covered: "Days collected", legal: "Enforcement", tab_value: "Loss", tab_type: "Type", tab_chain: "Chain", mode_amount: "Amount", mode_count: "Count",
      day: "Day", count: "Count", amount: "Amount", type: "Type", chain: "Chain", foot: "Auto-collected · LLM summaries · re-verify addresses at the source", load_error: "Could not load data", retry: "Retry",
      a_theme: "Toggle theme", a_lang: "Toggle language", a_prev: "Previous page", a_next: "Next page", page_total: "{n} incidents", total_amount: "Total {v} (excl. follow-ups)",
      types: { hack_exploit: "Hack", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing", scam_fraud: "Scam", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Enforcement", laundering_report: "Laundering", other: "Other" },
      types_full: { hack_exploit: "Hack / Exploit", private_key_compromise: "Private key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Drainer", scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions designation", law_enforcement_action: "Law enforcement action", laundering_report: "Laundering report", other: "Other" },
      roles_map: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const TYPE_COLOR = { hack_exploit: "var(--t-hack)", private_key_compromise: "var(--t-key)", rug_pull: "var(--t-rug)", phishing_social_engineering: "var(--t-phish)", scam_fraud: "var(--t-scam)", ransomware: "var(--t-ransom)", sanctions_designation: "var(--t-sanction)", law_enforcement_action: "var(--t-law)", laundering_report: "var(--t-launder)", other: "var(--t-other)" };
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs", chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer",
    "rss:cointelegraph_hacks": "Cointelegraph (hacks)", "rss:cointelegraph_scams": "Cointelegraph (scams)", "rss:boannews": "보안뉴스", "rss:blockmedia": "블록미디어", "rss:tokenpost": "토큰포스트", "rss:sec_litigation": "SEC" };
  const REPO = "https://github.com/lala-david/crypto_test";
  const PAGES = [["index.html", "nav_home"], ["incidents.html", "nav_incidents"], ["stats.html", "nav_stats"], ["briefings.html", "nav_briefings"], ["addresses.html", "nav_addresses"]];
  const state = { lang: localStorage.getItem("lang") || "ko" };
  const t = (k) => (I18N[state.lang][k] ?? I18N.ko[k] ?? k);
  const typeName = (k) => I18N[state.lang].types[k] || k;
  const typeFull = (k) => I18N[state.lang].types_full[k] || k;
  const roleName = (k) => I18N[state.lang].roles_map[k] || k;
  const srcLabel = (s) => SOURCE_LABEL[s] || (s || "").replace(/^rss:/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtInt = (v) => Math.round(v || 0).toLocaleString("en-US");
  const fmtPct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + "%" : "-");
  const trim0 = (s) => s.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  const money = (v) => v == null ? "-" : v >= 1e9 ? `$${trim0((v / 1e9).toFixed(2))}B` : v >= 1e6 ? `$${trim0((v / 1e6).toFixed(1))}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const moneyFull = (v) => v == null ? "-" : `$${fmtInt(v)}`;
  const moneyCell = (v) => v == null ? "-" : `<span title="${moneyFull(v)}">${money(v)}</span>`;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (d) => { if (!d) return "-"; const [y, m, dd] = d.split("-"); return state.lang === "ko" ? `${y}.${m}.${dd}` : `${MON[+m - 1]} ${dd} ${y}`; };
  const fmtMD = (d) => (d ? d.slice(5).replace("-", ".") : "-");
  const dayOf = (i) => i.incident_date || i.day;
  const txt = (i, f) => i[`${f}_${state.lang}`] || i[`${f}_${state.lang === "ko" ? "en" : "ko"}`] || "";
  const explorer = (chain, addr) => { const c = (chain || "").toUpperCase();
    if (addr.startsWith("0x")) return c === "BSC" ? `https://bscscan.com/address/${addr}` : c === "ARBITRUM" ? `https://arbiscan.io/address/${addr}` : c === "POLYGON" ? `https://polygonscan.com/address/${addr}` : c === "BASE" ? `https://basescan.org/address/${addr}` : `https://etherscan.io/address/${addr}`;
    if (c === "TRON" || c === "TRX" || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return `https://tronscan.org/#/address/${addr}`;
    if (c === "BITCOIN" || c === "BTC") return `https://mempool.space/address/${addr}`; if (c === "SOLANA" || c === "SOL") return `https://solscan.io/account/${addr}`; return ""; };
  const txExplorer = (chain, h) => { const c = (chain || "").toUpperCase();
    if (c === "BSC") return `https://bscscan.com/tx/${h}`; if (c === "ARBITRUM") return `https://arbiscan.io/tx/${h}`; if (c === "POLYGON") return `https://polygonscan.com/tx/${h}`; if (c === "BASE") return `https://basescan.org/tx/${h}`;
    if (c === "TRON") return `https://tronscan.org/#/transaction/${h}`; if (c === "BITCOIN" || c === "LIQUID") return `https://mempool.space/tx/${h}`; if (c === "SOLANA") return `https://solscan.io/tx/${h}`; return `https://etherscan.io/tx/${h}`; };
  const ADDR_RE = /(0x[0-9a-fA-F]{6,}|T[1-9A-HJ-NP-Za-km-z]{6,}|bc1[0-9a-z]{6,}|[13][1-9A-HJ-NP-Za-km-z]{20,})\S*/g;
  const stripAddr = (s) => (s || "").replace(ADDR_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([,.)])/g, "$1").trim();
  const isAddrLike = (s) => /^(0x[0-9a-fA-F]{20,}|T[1-9A-HJ-NP-Za-km-z]{33}|bc1[0-9a-z]{20,}|[13][1-9A-HJ-NP-Za-km-z]{25,})$/.test((s || "").trim());
  const sw = (type) => `<span class="sw" style="background:${TYPE_COLOR[type] || "var(--t-other)"}"></span>`;
  const pill = (i) => `<span class="pill" title="${esc(typeFull(i.type))}">${sw(i.type)}${esc(typeName(i.type))}</span>`;
  const chainPills = (chains, max = 1) => (chains || []).slice(0, max).map((c) => `<span class="chain">${esc(c)}</span>`).join(" ") + ((chains || []).length > max ? ` <span class="faint small" title="${esc(chains.slice(max).join(", "))}">+${chains.length - max}</span>` : "") + (!(chains || []).length ? '<span class="faint">-</span>' : "");
  const detailUrl = (i) => `incident.html?id=${encodeURIComponent(i.uid)}`;
  const mdToHtml = (md, max = 99) => { const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, "")).slice(0, max);
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`; };
  const api = async (path, params) => { const u = new URL(path, location.origin); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) u.searchParams.set(k, v); });
    const r = await fetch(u, { cache: "no-store" }); if (!r.ok) { let m = `${r.status}`; try { m = (await r.json()).detail || m; } catch (_) {} throw new Error(m); } return r.json(); };
  const errorBox = (e) => `<div class="card empty c12">${esc(t("load_error"))} <span class="faint">(${esc(e.message)})</span> · <a href="javascript:location.reload()">${esc(t("retry"))}</a></div>`;

  // ---- 크롬 ----
  function renderNav(active, meta) {
    const nav = $("#nav"); if (!nav) return;
    const upd = meta && meta.generated_at ? meta.generated_at.replace("T", " ").slice(5, 16) : "";
    nav.innerHTML = `<a class="brand" href="index.html"><span class="mark"></span><span>Incident Ledger</span></a>
      <div class="tabs">${PAGES.map(([h, k]) => `<a class="tab ${active === h ? "on" : ""}" href="${h}">${esc(t(k))}</a>`).join("")}</div>
      <div class="nav-r"><span class="upd" title="${esc(meta && meta.generated_at ? meta.generated_at.replace("T", " ") : "")}">${upd ? esc(t("updated")) + " " + esc(upd) : ""}</span><button id="themeBtn" class="ibtn" type="button" aria-label="${esc(t("a_theme"))}" title="${esc(t("a_theme"))}">◐</button><button id="langBtn" class="ibtn" type="button" aria-label="${esc(t("a_lang"))}">${state.lang === "ko" ? "EN" : "KO"}</button></div>`;
  }
  function renderFoot() { const f = $("#foot"); if (f) f.innerHTML = `<span>${esc(t("foot"))}</span><span><a href="${REPO}" target="_blank" rel="noopener">GitHub</a> · <a href="/api" target="_blank" rel="noopener">API</a></span>`; }
  function applyI18n() { document.documentElement.lang = state.lang; $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); }); $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); }); $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); }); }
  function applyTheme(th) { document.documentElement.dataset.theme = th; }
  function bindChrome(onLang) {
    applyTheme(new URLSearchParams(location.search).get("theme") || localStorage.getItem("theme") || "dark");
    const tb = $("#themeBtn"); if (tb) tb.onclick = () => { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", n); applyTheme(n); };
    const lb = $("#langBtn"); if (lb) lb.onclick = () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); onLang && onLang(); };
  }
  function rangeSeg(el, current, onChange) {
    if (!el) return;
    el.innerHTML = [["7", t("days_n").replace("{n}", 7)], ["30", t("days_n").replace("{n}", 30)], ["90", t("days_n").replace("{n}", 90)], ["all", t("all")]].map(([v, l]) => `<button data-range="${v}" class="${current === v ? "on" : ""}" type="button">${esc(l)}</button>`).join("");
    $$("button", el).forEach((b) => b.addEventListener("click", () => onChange(b.dataset.range)));
  }
  function basisSeg(el, current, onChange) {
    if (!el) return;
    el.innerHTML = [["event", t("event_date")], ["collected", t("collected_date")]].map(([v, l]) => `<button data-basis="${v}" class="${current === v ? "on" : ""}" type="button">${esc(l)}</button>`).join("");
    $$("button", el).forEach((b) => b.addEventListener("click", () => onChange(b.dataset.basis)));
  }
  const bindTips = (root) => $$("[data-tip]", root).forEach((el) => {
    el.addEventListener("mousemove", (e) => { const tp = $("#tip"); if (!tp) return; tp.innerHTML = el.dataset.tip; tp.classList.add("show"); tp.classList.toggle("below", e.clientY < 70); tp.style.left = e.clientX + "px"; tp.style.top = (e.clientY < 70 ? e.clientY + 14 : e.clientY - 8) + "px"; });
    el.addEventListener("mouseleave", () => { const tp = $("#tip"); if (tp) tp.classList.remove("show"); }); });

  // ---- 차트 (viewBox = 실제 px → 글자 크기가 카드 폭에 따라 변하지 않음) ----
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const niceStep = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const ticks = (max, n = 4) => { const st = niceStep(max / n); const out = []; for (let v = 0; v <= max + 1e-9; v += st) out.push(v); return out; };
  const widthOf = (el, fallback) => { const w = el.clientWidth || (el.parentElement && el.parentElement.clientWidth) || 0; return w > 200 ? w : fallback; };
  function columns(el, buckets, fmt, label, opts = {}) {
    if (!buckets.length) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const W = widthOf(el, 640) - 2, H = opts.height || 210, m = { l: 56, r: 10, t: 18, b: 26 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const rawMax = Math.max(...buckets.map((b) => b.v)); const few = buckets.length <= 12; const tk = ticks(niceMax(rawMax), few ? 2 : 4); const max = tk[tk.length - 1];
    const slot = pw / buckets.length; const bw = Math.max(4, Math.min(few ? 56 : 28, slot * 0.55));
    const x = (k) => m.l + (k + 0.5) * slot, y = (v) => m.t + ph - (v / max) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">`;
    tk.forEach((v) => { s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    buckets.forEach((b, k) => {
      s += `<g class="col">`;
      if (b.v) s += `<rect class="bar ${b.dim ? "dim" : ""}" x="${x(k) - bw / 2}" y="${y(b.v)}" width="${bw}" height="${Math.max(1, y(0) - y(b.v))}" rx="2"/>`;
      if (b.v && few) s += `<text class="val" x="${x(k)}" y="${y(b.v) - 5}" text-anchor="middle">${esc(fmt(b.v))}</text>`;
      s += `<rect class="hit" x="${x(k) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}" data-tip="<b>${esc(b.label)}</b><br>${esc(fmt(b.v))}${b.extra ? " · " + esc(b.extra) : ""}"/></g>`;
    });
    const step = Math.max(1, Math.ceil(buckets.length / Math.max(4, Math.floor(pw / 64))));
    let lastDrawn = -Infinity;
    buckets.forEach((b, k) => {
      const isLast = k === buckets.length - 1;
      if (k % step === 0 || (isLast && k - lastDrawn >= step * 0.6)) { s += `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${esc(few ? b.label : (b.short || b.label))}</text>`; lastDrawn = k; }
    });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function hbars(el, items, fmt, label) {
    if (!items.length) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const W = Math.min(widthOf(el, 360) - 2, 560), rowH = 30, m = { l: 96, r: 64, t: 4, b: 4 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r; const max = Math.max(...items.map((i) => i.v), 1);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">`;
    items.forEach((it, k) => { const yy = m.t + k * rowH + 6, w = Math.max(2, (it.v / max) * pw);
      s += `<text class="lbl" x="${m.l - 10}" y="${yy + 13}" text-anchor="end">${esc(it.k.length > 12 ? it.k.slice(0, 11) + "…" : it.k)}</text><rect class="track" x="${m.l}" y="${yy}" width="${pw}" height="18" rx="3"/><rect class="bar" x="${m.l}" y="${yy}" width="${w}" height="18" rx="3" style="${it.color ? `fill:${it.color}` : ""}"/><text class="val" x="${m.l + pw + 8}" y="${yy + 13}">${esc(fmt(it.v))}${it.pct != null ? ` <tspan class="pct">${esc(fmtPct(it.pct, 0))}</tspan>` : ""}</text>`;
      s += `<rect class="hit" x="0" y="${yy - 6}" width="${W}" height="${rowH}" data-tip="<b>${esc(it.k)}</b><br>${esc(fmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function donut(el, items, centerNum, centerLbl, fmtV, minShare = 0.03) {
    const total = items.reduce((a, i) => a + i.v, 0);
    if (!total) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const big = items.filter((i) => i.v / total >= minShare), small = items.filter((i) => i.v / total < minShare);
    const list = small.length > 1 ? [...big, { k: `${t("other")} (${small.length})`, v: small.reduce((a, i) => a + i.v, 0), color: "var(--t-other)", title: small.map((i) => `${i.k} ${fmtV ? fmtV(i.v) : fmtInt(i.v)}`).join(", ") }] : items;
    const R = 46, C = 2 * Math.PI * R; let off = 0; const gap = list.length > 1 ? 2 : 0;
    let s = `<div class="donut"><svg viewBox="0 0 120 120">`;
    list.forEach((it) => { const len = (it.v / total) * C; const vis = Math.max(0, len - gap); s += `<circle class="seg" r="${R}" cx="60" cy="60" fill="none" stroke="${it.color}" stroke-width="13" stroke-dasharray="${vis} ${C - vis}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${esc(it.k)} · ${esc(fmtV ? fmtV(it.v) : fmtInt(it.v))} · ${fmtPct(it.v / total)}</title></circle>`; off += len; });
    s += `<text class="center-num" x="60" y="58" text-anchor="middle" dominant-baseline="middle">${esc(centerNum)}</text><text class="center-lbl" x="60" y="77" text-anchor="middle">${esc(centerLbl)}</text></svg>`;
    s += `<div class="legend"><ul>${list.map((it) => `<li title="${esc(it.title || it.k)}"><span class="sw" style="background:${it.color};margin:0"></span><span class="k">${esc(it.k)}</span><span class="v">${esc(fmtV ? fmtV(it.v) : fmtInt(it.v))}</span><span class="p">${fmtPct(it.v / total)}</span></li>`).join("")}</ul></div></div>`;
    el.innerHTML = s;
  }
  function spark(values) {
    if (!values || values.length < 2) return "";
    const W = 92, H = 32, max = Math.max(...values, 1); const pt = (v, k) => [(k / (values.length - 1)) * (W - 4) + 2, H - 3 - (v / max) * (H - 8)];
    const pts = values.map(pt); const id = "sg" + Math.random().toString(36).slice(2, 7); const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart)" stop-opacity=".35"/><stop offset="1" stop-color="var(--chart)" stop-opacity="0"/></linearGradient></defs><polygon class="area" style="fill:url(#${id});opacity:1" points="${pts[0][0]},${H} ${pts.map((p) => p.join(",")).join(" ")} ${last[0]},${H}"/><polyline points="${pts.map((p) => p.join(",")).join(" ")}"/><circle class="dot" cx="${last[0]}" cy="${last[1]}" r="2.5"/></svg>`;
  }
  function statCard(label, value, sub, sparkValues, opts = {}) {
    return `<div class="card stat ${opts.cls || ""}" ${opts.title ? `title="${esc(opts.title)}"` : ""}><div class="label">${esc(label)}</div><div class="value">${value}</div>${sparkValues ? spark(sparkValues) : '<span class="spark"></span>'}<div class="delta">${sub || ""}</div></div>`;
  }

  // ---- 표 ----
  const badges = (i) => `${i.followup_of ? `<span class="tag" title="${esc(t("legend_follow"))} · ${esc(i.followup_of.day || "")}">${esc(t("follow"))}</span>` : ""}${i.blacklist_hits ? `<span class="tag warn" title="${esc(t("legend_bl"))}">BL ${i.blacklist_hits}</span>` : ""}${i.amount_revised_from ? `<span class="tag" title="${esc(t("revised_from"))} ${moneyFull(i.amount_revised_from)}">↑</span>` : ""}`;
  const amountCell = (i) => i.amount_usd != null ? `<span title="${moneyFull(i.amount_usd)}">${moneyFull(i.amount_usd)}</span>` : `<span class="faint" title="${esc(i.amount_text || "")}">${esc(t("unknown"))}</span>`;
  const zeroDash = (n) => (n ? fmtInt(n) : '<span class="faint">–</span>');
  function incidentRow(i, compact = false) {
    compact = compact === true;
    const name = `<td>${sw(i.type)}<a class="name" href="${detailUrl(i)}">${esc(i.project)}</a>${badges(i)}</td>`;
    const amt = `<td class="num">${amountCell(i)}</td>`;
    const ev = i.event_date || i.incident_date || i.day;
    if (compact) return `<tr class="link" data-href="${detailUrl(i)}">${name}${amt}<td>${pill(i)}</td><td class="date">${esc(fmtDate(ev))}</td></tr>`;
    return `<tr class="link" data-href="${detailUrl(i)}">${name}${amt}<td class="date">${esc(fmtDate(ev))}</td><td class="date faint">${esc(fmtDate(i.day))}</td><td>${pill(i)}</td><td>${chainPills(i.chains, 2)}</td><td class="num">${zeroDash(i.addresses.length)}</td><td class="num">${zeroDash(i.sources.length)}</td></tr>`;
  }
  const TABLE_HEAD = (compact = false) => compact
    ? `<thead><tr><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_date"))}</th></tr></thead>`
    : `<thead><tr><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th>${esc(t("th_date"))}</th><th>${esc(t("th_report"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_chain"))}</th><th class="num">${esc(t("th_addr"))}</th><th class="num">${esc(t("th_src"))}</th></tr></thead>`;
  const tableLegend = () => `<div class="legend-line"><span class="tag">${esc(t("follow"))}</span> ${esc(t("legend_follow"))} · <span class="tag warn">BL</span> ${esc(t("legend_bl"))}</div>`;
  function bindRows(root) { $$("tr[data-href]", root).forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("a")) return; location.href = tr.dataset.href; })); }
  function fillSelect(sel, values, allLabel, current) { sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join(""); }
  const typeColorHex = (k) => { const v = TYPE_COLOR[k] || "var(--t-other)"; return getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() || "#888"; };
  const chainName = (k) => (k === "unknown" ? t("unknown") : k);

  return { $, $$, TYPE_COLOR, REPO, state, t, typeName, typeFull, roleName, srcLabel, esc, fmtInt, fmtPct, money, moneyFull, moneyCell, fmtDate, fmtMD, dayOf, txt, explorer, txExplorer, stripAddr, isAddrLike, sw, pill, chainPills, detailUrl, mdToHtml, api, errorBox,
    renderNav, renderFoot, applyI18n, applyTheme, bindChrome, rangeSeg, basisSeg, bindTips, columns, hbars, donut, spark, statCard, amountCell, incidentRow, TABLE_HEAD, tableLegend, bindRows, fillSelect, typeColorHex, chainName, niceMax };
})();
