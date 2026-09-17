/* 공통: i18n · API · 상단 바 · 포맷 · 차트(막대/가로막대/도넛/스파크) · 표 행 */
window.KL = (() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const I18N = {
    ko: {
      nav_home: "개요", nav_incidents: "사건", nav_briefings: "브리핑", nav_stats: "분석", nav_addresses: "주소 조회",
      updated: "갱신", all: "전체", unit: "건", no_data: "데이터 없음", search_ph: "검색", hide_follow: "후속 제외",
      k_today: "오늘 신규", k_7d: "7일 사건", k_7d_amt: "7일 피해액", k_30d_amt: "30일 피해액", k_addr: "수집 주소", k_sdn: "OFAC 제재 주소", vs_prev: "이전 기간 대비", days_n: "{n}일",
      daily_count: "일별 사건 수", daily_amount: "일별 피해액 (USD)", share_type: "유형 비중", share_chain: "체인 비중", by_source: "소스별 수집", top_amount: "피해액 상위", recent: "최근 사건", roles: "주소 역할",
      th_incident: "사건", th_amount: "금액", th_date: "날짜", th_type: "유형", th_chain: "체인", th_addr: "주소", th_src: "출처", th_count: "건수", th_share: "비중", th_last: "마지막 수집", th_source: "소스", th_rank: "#",
      briefing: "브리핑", latest_briefing: "최신 브리핑", follow: "후속", new_label: "신규", background: "배경", method: "수법", summary: "요약", flow: "자금 흐름", addresses: "지갑 주소", sources: "출처", actors: "관련 주체",
      tx: "트랜잭션", blacklist: "블랙리스트 재등장", copy: "복사", copied: "복사됨", back: "사건 목록", incident_date: "사건일", report_date: "보고일", amount_unknown: "금액 미상", not_found: "사건을 찾을 수 없습니다",
      all_types: "모든 유형", all_chains: "모든 체인", all_sources: "모든 소스", sort: "정렬", sort_day: "보고일", sort_amount: "금액", sort_date: "사건일", related: "관련 사건", report: "GitHub 리포트", show_more: "더 보기 {n}", show_less: "접기", all_roles: "모두",
      addr_ph: "주소 또는 일부 입력 (6자 이상)", addr_found_in: "사건 카드", addr_sdn: "OFAC SDN", addr_bl: "crimial_hunter 블랙리스트", addr_none: "일치하는 기록 없음", addr_role: "역할",
      known_addresses: "수집 주소", sanctioned_addresses: "제재 주소", incidents_total: "누적 사건", days_covered: "수집 일수", legal: "제재·수사", tab_value: "피해액", tab_type: "유형", tab_chain: "체인", tab_legal: "제재·수사·주소", mode_amount: "금액", mode_count: "건수",
      day: "날짜", count: "건수", amount: "금액", type: "유형", chain: "체인", foot: "공개 소스 자동 수집 · LLM 요약 · 주소는 원문으로 재확인",
      types: { hack_exploit: "해킹/익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱/드레이너", scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사/기소/압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles_map: { attacker: "공격자", laundering: "세탁/경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      nav_home: "Overview", nav_incidents: "Incidents", nav_briefings: "Briefings", nav_stats: "Analysis", nav_addresses: "Address lookup",
      updated: "Updated", all: "All", unit: "", no_data: "No data", search_ph: "Search", hide_follow: "Hide follow-ups",
      k_today: "New today", k_7d: "Incidents (7d)", k_7d_amt: "Loss (7d)", k_30d_amt: "Loss (30d)", k_addr: "Addresses", k_sdn: "OFAC sanctioned addr.", vs_prev: "vs previous period", days_n: "{n}d",
      daily_count: "Incidents per day", daily_amount: "Loss per day (USD)", share_type: "Share by type", share_chain: "Share by chain", by_source: "By source", top_amount: "Top by loss", recent: "Recent incidents", roles: "Address roles",
      th_incident: "Incident", th_amount: "Amount", th_date: "Date", th_type: "Type", th_chain: "Chain", th_addr: "Addr.", th_src: "Src", th_count: "Count", th_share: "Share", th_last: "Last run", th_source: "Source", th_rank: "#",
      briefing: "Briefing", latest_briefing: "Latest briefing", follow: "follow-up", new_label: "new", background: "Background", method: "Method", summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses", sources: "Sources", actors: "Actors",
      tx: "Transactions", blacklist: "Blacklist re-hits", copy: "Copy", copied: "Copied", back: "All incidents", incident_date: "Incident date", report_date: "Reported", amount_unknown: "amount unknown", not_found: "Incident not found",
      all_types: "All types", all_chains: "All chains", all_sources: "All sources", sort: "Sort", sort_day: "Report date", sort_amount: "Amount", sort_date: "Incident date", related: "Related", report: "GitHub report", show_more: "Show {n} more", show_less: "Show less", all_roles: "All",
      addr_ph: "Address or fragment (6+ chars)", addr_found_in: "Incident cards", addr_sdn: "OFAC SDN", addr_bl: "crimial_hunter blacklist", addr_none: "No matching records", addr_role: "Role",
      known_addresses: "Collected addresses", sanctioned_addresses: "Sanctioned addresses", incidents_total: "Incidents total", days_covered: "Days covered", legal: "Sanctions · Enforcement", tab_value: "Loss", tab_type: "Type", tab_chain: "Chain", tab_legal: "Sanctions · Enforcement · Addresses", mode_amount: "Amount", mode_count: "Count",
      day: "Day", count: "Count", amount: "Amount", type: "Type", chain: "Chain", foot: "Auto-collected · LLM summaries · re-verify addresses at the source",
      types: { hack_exploit: "Hack / Exploit", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Drainer", scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Law enforcement", laundering_report: "Laundering report", other: "Other" },
      roles_map: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const TYPE_COLOR = { hack_exploit: "var(--t-hack)", private_key_compromise: "var(--t-key)", rug_pull: "var(--t-rug)", phishing_social_engineering: "var(--t-phish)", scam_fraud: "var(--t-scam)", ransomware: "var(--t-ransom)", sanctions_designation: "var(--t-sanction)", law_enforcement_action: "var(--t-law)", laundering_report: "var(--t-launder)", other: "var(--t-other)" };
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs", chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer",
    "rss:cointelegraph_hacks": "Cointelegraph", "rss:cointelegraph_scams": "Cointelegraph", "rss:boannews": "보안뉴스", "rss:blockmedia": "블록미디어", "rss:tokenpost": "토큰포스트", "rss:sec_litigation": "SEC" };
  const REPO = "https://github.com/lala-david/crypto_test";
  const PAGES = [["index.html", "nav_home"], ["incidents.html", "nav_incidents"], ["stats.html", "nav_stats"], ["briefings.html", "nav_briefings"], ["addresses.html", "nav_addresses"]];
  const state = { lang: localStorage.getItem("lang") || "ko" };
  const t = (k) => (I18N[state.lang][k] ?? I18N.ko[k] ?? k);
  const typeName = (k) => I18N[state.lang].types[k] || k;
  const roleName = (k) => I18N[state.lang].roles_map[k] || k;
  const srcLabel = (s) => SOURCE_LABEL[s] || (s || "").replace(/^rss:/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtInt = (v) => Math.round(v || 0).toLocaleString("en-US");
  const fmtPct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + "%" : "-");
  const money = (v) => v == null ? "-" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const moneyFull = (v) => v == null ? "-" : `$${fmtInt(v)}`;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (d) => { if (!d) return "-"; const [y, m, dd] = d.split("-"); return state.lang === "ko" ? `${y}.${m}.${dd}` : `${MON[+m - 1]} ${dd} ${y}`; };
  const dayOf = (i) => i.incident_date || i.day;
  const txt = (i, f) => i[`${f}_${state.lang}`] || i[`${f}_${state.lang === "ko" ? "en" : "ko"}`] || "";
  const explorer = (chain, addr) => { const c = (chain || "").toUpperCase();
    if (addr.startsWith("0x")) return c === "BSC" ? `https://bscscan.com/address/${addr}` : c === "ARB" ? `https://arbiscan.io/address/${addr}` : c === "POLYGON" ? `https://polygonscan.com/address/${addr}` : c === "BASE" ? `https://basescan.org/address/${addr}` : `https://etherscan.io/address/${addr}`;
    if (c === "TRX" || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return `https://tronscan.org/#/address/${addr}`;
    if (c === "BTC") return `https://mempool.space/address/${addr}`; if (c === "SOL") return `https://solscan.io/account/${addr}`; return ""; };
  const shortText = (s, n = 16) => { s = (s || "").replace(/\s*\(.*$/, "").trim(); return s ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "-"; };
  const pill = (i) => `<span class="pill"><span class="sw" style="background:${TYPE_COLOR[i.type] || "var(--t-other)"};margin:0"></span>${esc(typeName(i.type))}</span>`;
  const chainPills = (chains, max = 1) => (chains || []).slice(0, max).map((c) => `<span class="chain">${esc(c)}</span>`).join(" ") + ((chains || []).length > max ? ` <span class="faint small">+${chains.length - max}</span>` : "") + (!(chains || []).length ? '<span class="faint">-</span>' : "");
  const detailUrl = (i) => `incident.html?id=${encodeURIComponent(i.uid)}`;
  const mdToHtml = (md, max = 99) => { const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, "")).slice(0, max);
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`; };
  const api = async (path, params) => { const u = new URL(path, location.origin); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) u.searchParams.set(k, v); });
    const r = await fetch(u, { cache: "no-store" }); if (!r.ok) { let m = `${r.status}`; try { m = (await r.json()).detail || m; } catch (_) {} throw new Error(m); } return r.json(); };

  // ---- 크롬 ----
  function renderNav(active, meta) {
    const nav = $("#nav"); if (!nav) return;
    const upd = meta && meta.generated_at ? meta.generated_at.replace("T", " ").slice(5, 16) : "";
    nav.innerHTML = `<a class="brand" href="index.html"><span class="mark"></span><span>Incident Ledger</span></a>
      <div class="tabs">${PAGES.map(([h, k]) => `<a class="tab ${active === h ? "on" : ""}" href="${h}">${esc(t(k))}</a>`).join("")}</div>
      <div class="nav-r"><span class="upd">${upd ? esc(t("updated")) + " " + esc(upd) : ""}</span><button id="themeBtn" class="ibtn" type="button" aria-label="theme">◐</button><button id="langBtn" class="ibtn" type="button" aria-label="language">${state.lang === "ko" ? "EN" : "KO"}</button></div>`;
  }
  function renderFoot() { const f = $("#foot"); if (f) f.innerHTML = `<span>${esc(t("foot"))}</span><span><a href="${REPO}" target="_blank" rel="noopener">GitHub</a> · <a href="/api" target="_blank" rel="noopener">API</a></span>`; }
  function applyI18n() { document.documentElement.lang = state.lang; $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); }); $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); }); }
  function applyTheme(th) { document.documentElement.dataset.theme = th; }
  function bindChrome(onLang) {
    applyTheme(new URLSearchParams(location.search).get("theme") || localStorage.getItem("theme") || "dark");
    const tb = $("#themeBtn"); if (tb) tb.onclick = () => { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", n); applyTheme(n); };
    const lb = $("#langBtn"); if (lb) lb.onclick = () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); onLang && onLang(); };
  }
  const bindTips = (root) => $$("[data-tip]", root).forEach((el) => {
    el.addEventListener("mousemove", (e) => { const tp = $("#tip"); if (!tp) return; tp.innerHTML = el.dataset.tip; tp.classList.add("show"); tp.style.left = e.clientX + "px"; tp.style.top = (e.clientY - 8) + "px"; });
    el.addEventListener("mouseleave", () => { const tp = $("#tip"); if (tp) tp.classList.remove("show"); }); });

  // ---- 차트 ----
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const niceStep = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const ticks = (max) => { const st = niceStep(max / 4); const out = []; for (let v = 0; v <= max + 1e-9; v += st) out.push(v); return out; };
  function columns(el, buckets, fmt, label, opts = {}) {
    if (!buckets.length) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const W = opts.width || 640, H = opts.height || 200, m = { l: 50, r: 8, t: 8, b: 24 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const rawMax = Math.max(...buckets.map((b) => b.v)); const tk = ticks(niceMax(rawMax)); const max = tk[tk.length - 1]; const slot = pw / buckets.length; const bw = Math.max(3, Math.min(26, slot * 0.62));
    const x = (k) => m.l + (k + 0.5) * slot, y = (v) => m.t + ph - (v / max) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    tk.forEach((v) => { s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 3}" text-anchor="end">${esc(fmt(v))}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    buckets.forEach((b, k) => { if (b.v) s += `<rect class="bar ${b.dim ? "dim" : ""}" x="${x(k) - bw / 2}" y="${y(b.v)}" width="${bw}" height="${Math.max(1, y(0) - y(b.v))}" rx="2"/>`;
      s += `<rect class="hit" x="${x(k) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}" data-tip="<b>${esc(b.label)}</b><br>${esc(fmt(b.v))}${b.extra ? " · " + esc(b.extra) : ""}"/>`; });
    const step = Math.max(1, Math.ceil(buckets.length / (W > 900 ? 16 : 8)));
    buckets.forEach((b, k) => { if (k % step === 0 || k === buckets.length - 1) s += `<text x="${x(k)}" y="${H - 7}" text-anchor="middle">${esc(b.short || b.label)}</text>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function hbars(el, items, fmt, label) {
    if (!items.length) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const W = 360, rowH = 26, m = { l: 110, r: 54, t: 4, b: 18 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r; const max = niceMax(Math.max(...items.map((i) => i.v)));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    [0, 0.5, 1].forEach((f) => { const xx = m.l + pw * f; s += `<line class="grid" x1="${xx}" x2="${xx}" y1="${m.t}" y2="${H - m.b}"/><text x="${xx}" y="${H - 5}" text-anchor="middle">${esc(fmt(max * f))}</text>`; });
    items.forEach((it, k) => { const yy = m.t + k * rowH + 5, w = Math.max(2, (it.v / max) * pw);
      s += `<text class="lbl" x="${m.l - 8}" y="${yy + 12}" text-anchor="end">${esc(it.k.length > 15 ? it.k.slice(0, 14) + "…" : it.k)}</text><rect class="bar" x="${m.l}" y="${yy}" width="${w}" height="16" rx="2" style="${it.color ? `fill:${it.color}` : ""}"/><text x="${m.l + w + 5}" y="${yy + 12}">${esc(fmt(it.v))}</text>`;
      s += `<rect class="hit" x="0" y="${yy - 4}" width="${W}" height="${rowH}" data-tip="<b>${esc(it.k)}</b><br>${esc(fmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function donut(el, items, centerNum, centerLbl, fmtV) {
    const total = items.reduce((a, i) => a + i.v, 0);
    if (!total) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    const R = 44, C = 2 * Math.PI * R; let off = 0;
    let s = `<div class="donut"><svg viewBox="0 0 120 120">`;
    items.forEach((it) => { const len = (it.v / total) * C; s += `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${it.color}" stroke-width="14" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${esc(it.k)} ${fmtPct(it.v / total)}</title></circle>`; off += len; });
    s += `<text class="center-num" x="60" y="60" text-anchor="middle" dominant-baseline="middle">${esc(centerNum)}</text><text class="center-lbl" x="60" y="78" text-anchor="middle">${esc(centerLbl)}</text></svg>`;
    s += `<div class="legend"><ul>${items.map((it) => `<li><span class="sw" style="background:${it.color};margin:0"></span><span class="k" title="${esc(it.k)}">${esc(it.k)}</span><span class="v">${esc(fmtV ? fmtV(it.v) : fmtInt(it.v))}</span><span class="p">${fmtPct(it.v / total)}</span></li>`).join("")}</ul></div></div>`;
    el.innerHTML = s;
  }
  function spark(values) {
    if (!values || values.length < 2) return "";
    const W = 80, H = 28, max = Math.max(...values, 1); const pts = values.map((v, k) => `${(k / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polygon class="area" points="0,${H} ${pts.join(" ")} ${W},${H}"/><polyline points="${pts.join(" ")}"/></svg>`;
  }
  function statCard(label, value, delta, sparkValues) {
    const d = delta == null ? "" : `<div class="delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}">${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${esc(Math.abs(delta * 100).toFixed(0))}% ${esc(t("vs_prev"))}</div>`;
    return `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sparkValues ? spark(sparkValues) : ""}${d}</div>`;
  }

  // ---- 표 ----
  const badges = (i) => `${i.followup_of ? `<span class="tag" title="${esc(t("follow"))} ${esc(i.followup_of.day || "")}">↩</span>` : ""}${i.blacklist_hits ? `<span class="tag warn">⚠ ${i.blacklist_hits}</span>` : ""}`;
  function incidentRow(i, compact = false) {
    compact = compact === true;
    const name = `<td><span class="sw" style="background:${TYPE_COLOR[i.type] || "var(--t-other)"}"></span><a class="name" href="${detailUrl(i)}">${esc(i.project)}</a>${badges(i)}</td>`;
    const amt = `<td class="num">${i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="faint">${esc(shortText(i.amount_text, 12))}</span>`}</td>`;
    if (compact) return `<tr class="link" data-href="${detailUrl(i)}">${name}${amt}<td>${pill(i)}</td><td class="date">${esc(fmtDate(dayOf(i)))}</td></tr>`;
    return `<tr class="link" data-href="${detailUrl(i)}">${name}${amt}<td class="date">${esc(fmtDate(dayOf(i)))}</td><td>${pill(i)}</td><td>${chainPills(i.chains, 1)}</td><td class="num">${i.addresses.length}</td><td class="num">${i.sources.length}</td></tr>`;
  }
  const TABLE_HEAD = (compact = false) => compact
    ? `<thead><tr><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_date"))}</th></tr></thead>`
    : `<thead><tr><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th>${esc(t("th_date"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_chain"))}</th><th class="num">${esc(t("th_addr"))}</th><th class="num">${esc(t("th_src"))}</th></tr></thead>`;
  function bindRows(root) { $$("tr[data-href]", root).forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("a")) return; location.href = tr.dataset.href; })); }
  function fillSelect(sel, values, allLabel, current) { sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join(""); }
  const typeColorHex = (k) => { const v = TYPE_COLOR[k] || "var(--t-other)"; return getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() || "#888"; };

  return { $, $$, TYPE_COLOR, REPO, state, t, typeName, roleName, srcLabel, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, dayOf, txt, explorer, shortText, pill, chainPills, detailUrl, mdToHtml, api,
    renderNav, renderFoot, applyI18n, applyTheme, bindChrome, bindTips, columns, hbars, donut, spark, statCard, incidentRow, TABLE_HEAD, bindRows, fillSelect, typeColorHex, niceMax };
})();
