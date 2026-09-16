/* Crypto Incident Monitor — Lumos 톤 정적 대시보드 (docs/data/*.json 을 fetch) */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const I18N = {
    ko: {
      nav_hacks: "사건", nav_briefing: "브리핑", nav_stats: "통계",
      hero_1: "가상자산 해킹의", hero_2: "그림자를", hero_3: "비춥니다", hero_sub: "12개 소스 · 매시간 수집 · 한/영 사건 카드", updated: "갱신",
      total: "Total", all: "전체", tab_value: "총 피해 금액", tab_type: "공격 유형", tab_chain: "체인별 피해", tab_legal: "제재·수사·주소",
      mode_amount: "피해 금액 (USD)", mode_count: "사건 수", table_view: "표로 보기", latest_briefing: "브리핑", search_ph: "프로젝트 이름, 주소, 키워드 검색",
      hide_follow: "후속 보도 숨기기", th_incident: "사건", th_amount: "피해 금액", th_date: "사건일", th_type: "공격 유형", th_chain: "체인", th_addr: "주소", th_conf: "교차 검증",
      foot: "데이터는 공개 소스에서 자동 수집·LLM 요약된 것으로 오류가 있을 수 있습니다. 주소는 반드시 원문으로 재확인하세요.",
      kpi_today: "오늘 사건", kpi_7d: "7일 사건", kpi_loss: "7일 피해·관련 금액", kpi_addr: "7일 수집 주소", kpi_sdn: "OFAC 제재 주소", vs_prev: "지난 7일 대비",
      total_value: "기간 내 피해·관련 금액", total_count: "기간 내 사건", top_projects: "피해액 상위 5", by_type: "유형별", by_chain: "체인별", legal_side: "역할별 주소",
      follow: "후속", first_reported: "첫 보도", background: "사건 배경", method: "공격/범죄 수법", summary: "요약", flow: "자금 흐름", addresses: "지갑 주소",
      sources: "출처", actors: "관련 주체", tx: "트랜잭션", blacklist: "기존 블랙리스트 재등장", copy: "복사", copied: "복사됨", no_data: "해당 조건의 사건이 없습니다",
      day: "날짜", count: "건수", type: "유형", chain: "체인", amount: "금액", report: "상세 리포트 (GitHub)", all_types: "모든 유형", all_chains: "모든 체인", all_sources: "모든 소스",
      was_hacked: "{amt} 피해 · {who} · {date}", reported: "보고", page: "페이지", sources_n: "출처 {n}개", unit: "건",
      types: { hack_exploit: "해킹/익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱/드레이너",
               scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사/기소/압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles: { attacker: "공격자", laundering: "세탁/경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      nav_hacks: "Hacks", nav_briefing: "Briefing", nav_stats: "Stats",
      hero_1: "Illuminating", hero_2: "the Shadows of", hero_3: "Crypto Hacks", hero_sub: "12 sources · hourly collection · KO/EN incident cards", updated: "Updated",
      total: "Total", all: "All", tab_value: "Total Exploited Value", tab_type: "Attack Vector", tab_chain: "Loss by Chain", tab_legal: "Sanctions · Enforcement · Addresses",
      mode_amount: "Exploited Value (USD)", mode_count: "Incident Count", table_view: "Table view", latest_briefing: "Briefing", search_ph: "Search project name, address, keyword",
      hide_follow: "Hide follow-ups", th_incident: "Project", th_amount: "Hacked Amount", th_date: "Hacked Date", th_type: "Attack Vector", th_chain: "Chain", th_addr: "Addr.", th_conf: "Cross-check",
      foot: "Data is auto-collected from public sources and summarized by an LLM; errors are possible. Always re-verify addresses against the original source.",
      kpi_today: "Today", kpi_7d: "Incidents (7d)", kpi_loss: "Loss & related (7d)", kpi_addr: "Addresses (7d)", kpi_sdn: "OFAC sanctioned addresses", vs_prev: "vs previous 7d",
      total_value: "Total Exploited Value (period)", total_count: "Incidents (period)", top_projects: "Top 5 Exploited Projects", by_type: "By type", by_chain: "By chain", legal_side: "Addresses by role",
      follow: "follow-up", first_reported: "first reported", background: "Background", method: "Attack / Modus operandi", summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses",
      sources: "Sources", actors: "Actors", tx: "Transactions", blacklist: "Known blacklist re-hits", copy: "Copy", copied: "Copied", no_data: "No incidents match the filters",
      day: "Day", count: "Count", type: "Type", chain: "Chain", amount: "Amount", report: "Full report (GitHub)", all_types: "All types", all_chains: "All chains", all_sources: "All sources",
      was_hacked: "{amt} was hacked from {who} on {date}", reported: "reported", page: "Page", sources_n: "{n} sources", unit: "",
      types: { hack_exploit: "Hack / Exploit", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Drainer",
               scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Law enforcement", laundering_report: "Laundering report", other: "Other" },
      roles: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const TYPE_COLOR = { hack_exploit: "var(--t-hack)", private_key_compromise: "var(--t-key)", rug_pull: "var(--t-rug)", phishing_social_engineering: "var(--t-phish)",
    scam_fraud: "var(--t-scam)", ransomware: "var(--t-ransom)", sanctions_designation: "var(--t-sanction)", law_enforcement_action: "var(--t-law)", laundering_report: "var(--t-law)", other: "var(--t-other)" };
  const AVATAR = ["#7243ef", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5", "#0d9488", "#65a30d"];
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs",
    chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer" };
  const srcLabel = (s) => SOURCE_LABEL[s] || (s || "").replace(/^rss:/, "");
  const PAGE = 20;

  const state = { lang: localStorage.getItem("lang") || "ko", range: "30", type: "", chain: "", source: "", q: "", hideFollow: false, tab: "value", mode: "amount", page: 0,
                  incidents: [], briefings: [], meta: {} };
  const t = (k) => (I18N[state.lang][k] ?? I18N.ko[k] ?? k);
  const typeName = (k) => I18N[state.lang].types[k] || k;
  const roleName = (k) => I18N[state.lang].roles[k] || k;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
  const money = (v) => v == null ? "-" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
  const moneyFull = (v) => v == null ? null : `<span class="money"><span class="cur">$</span>${fmtInt(v)}</span>`;
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

  // ---------- data ----------
  async function load() {
    const [inc, br, meta] = await Promise.all(["incidents", "briefings", "meta"].map((n) => fetch(`data/${n}.json`, { cache: "no-store" }).then((r) => r.json())));
    state.incidents = inc; state.briefings = br; state.meta = meta;
    render();
  }

  function filtered() {
    const today = new Date(state.meta.last_day || new Date().toISOString().slice(0, 10));
    let cutoff = null;
    if (state.range !== "all") { const d = new Date(today); d.setDate(d.getDate() - Number(state.range) + 1); cutoff = d.toISOString().slice(0, 10); }
    const q = state.q.trim().toLowerCase();
    return state.incidents.filter((i) => {
      if (cutoff && i.day < cutoff) return false;
      if (state.type && i.type !== state.type) return false;
      if (state.chain && !(i.chains || []).some((c) => c.toLowerCase() === state.chain.toLowerCase())) return false;
      if (state.source && !i.sources.some((s) => s.source === state.source)) return false;
      if (state.hideFollow && i.followup_of) return false;
      if (q) {
        const hay = [i.project, i.title, ...(i.actors || []), ...(i.tags || []), ...(i.chains || []), txt(i, "summary"), txt(i, "attack_method"),
          ...(i.addresses || []).map((a) => a.address), ...(i.tx_hashes || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  const fillSelect = (sel, values, allLabel, current) => {
    sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join("");
  };

  // ---------- render ----------
  function render() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $("#langBtn").textContent = state.lang === "ko" ? "EN" : "한국어";
    $("#updated").textContent = `${t("updated")} ${(state.meta.generated_at || "").replace("T", " ").slice(0, 16)}`;
    const types = [...new Set(state.incidents.map((i) => i.type))].sort();
    fillSelect($("#typeSel"), types.map((v) => ({ value: v, label: typeName(v) })), t("all_types"), state.type);
    const chains = [...new Set(state.incidents.flatMap((i) => i.chains || []))].sort((a, b) => a.localeCompare(b));
    fillSelect($("#chainSel"), chains.map((v) => ({ value: v, label: v })), t("all_chains"), state.chain);
    const sources = [...new Set(state.incidents.flatMap((i) => i.sources.map((s) => s.source)))].sort();
    fillSelect($("#sourceSel"), sources.map((v) => ({ value: v, label: srcLabel(v) })), t("all_sources"), state.source);
    renderTicker(); renderKpis(); renderBriefing();
    const rows = filtered();
    $("#incCount").textContent = rows.length.toLocaleString();
    renderStats(rows); renderTable(rows);
  }

  function renderTicker() {
    const top = [...state.incidents].filter((i) => i.amount_usd && !i.followup_of).sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 14);
    if (!top.length) { $("#ticker").innerHTML = ""; return; }
    const line = (i) => `<div>${t("was_hacked").replace("{amt}", `<span class="amt">$${fmtInt(i.amount_usd)}</span>`).replace("{who}", `<span class="who">${esc(i.project)}</span>`).replace("{date}", fmtDate(dayOf(i)))}</div>`;
    $("#ticker").innerHTML = top.map(line).join("") + top.map(line).join("");
  }

  function renderKpis() {
    const last = state.meta.last_day || ""; const d = new Date(last);
    const cut7 = new Date(d); cut7.setDate(d.getDate() - 6); const cut14 = new Date(d); cut14.setDate(d.getDate() - 13);
    const s7 = cut7.toISOString().slice(0, 10), s14 = cut14.toISOString().slice(0, 10);
    const w = state.incidents.filter((i) => i.day >= s7 && !i.followup_of), prev = state.incidents.filter((i) => i.day >= s14 && i.day < s7 && !i.followup_of);
    const today = state.incidents.filter((i) => i.day === last && !i.followup_of);
    const loss = (arr) => arr.reduce((a, i) => a + (i.amount_usd || 0), 0);
    const addrs = (arr) => new Set(arr.flatMap((i) => i.addresses.map((a) => a.address.toLowerCase()))).size;
    const delta = (cur, before, fmt = (x) => x) => { if (!before) return ""; const diff = cur - before; const cls = diff > 0 ? "up" : diff < 0 ? "down" : "";
      return `<div class="delta ${cls}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} ${fmt(Math.abs(diff))} ${esc(t("vs_prev"))}</div>`; };
    const tiles = [
      { label: t("kpi_today"), value: today.length, sub: `<div class="delta">${last}</div>` },
      { label: t("kpi_7d"), value: w.length, sub: delta(w.length, prev.length) },
      { label: t("kpi_loss"), value: money(loss(w)), sub: delta(loss(w), loss(prev), money) },
      { label: t("kpi_addr"), value: addrs(w).toLocaleString(), sub: delta(addrs(w), addrs(prev), (x) => x.toLocaleString()) },
      { label: t("kpi_sdn"), value: (state.meta.sdn_addresses || 0).toLocaleString(), sub: `<div class="delta">SDN.XML</div>` },
    ];
    $("#kpis").innerHTML = tiles.map((k) => `<div class="tile"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div>${k.sub}</div>`).join("");
  }

  const mdToHtml = (md) => {
    const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, ""));
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`;
  };
  function renderBriefing() {
    const sel = $("#briefingDay");
    if (sel.options.length !== state.briefings.length) sel.innerHTML = state.briefings.map((b) => `<option value="${b.day}">${b.day} · ${b.relevant}${t("unit")}</option>`).join("");
    const b = state.briefings.find((x) => x.day === sel.value) || state.briefings[0];
    if (!b) { $("#briefingHeadline").textContent = ""; $("#briefingBody").innerHTML = `<p class="muted">${t("no_data")}</p>`; return; }
    if (sel.value !== b.day) sel.value = b.day;
    $("#briefingHeadline").textContent = b[`headline_${state.lang}`] || b.headline_ko;
    $("#briefingBody").innerHTML = mdToHtml(b[`briefing_${state.lang}`] || b.briefing_ko);
  }

  // ---------- charts ----------
  const tip = $("#tip");
  const showTip = (e, html) => { tip.innerHTML = html; tip.classList.add("show"); tip.style.left = e.clientX + "px"; tip.style.top = (e.clientY - 8) + "px"; };
  const hideTip = () => tip.classList.remove("show");
  const bindTips = (root) => $$("[data-tip]", root).forEach((el) => { el.addEventListener("mousemove", (e) => showTip(e, el.dataset.tip)); el.addEventListener("mouseleave", hideTip); });
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const GRAD = `<defs><linearGradient id="gradBar" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--chart-dim)"/><stop offset="1" stop-color="var(--chart-2)"/></linearGradient></defs>`;
  let tableData = { head: [], rows: [] };

  function columns(el, buckets, fmt, ariaLabel) {
    if (!buckets.length) { el.innerHTML = `<div class="empty">${t("no_data")}</div>`; return; }
    const W = 640, H = 260, m = { l: 52, r: 10, t: 10, b: 28 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = niceMax(Math.max(...buckets.map((b) => b.v))); const slot = pw / buckets.length; const bw = Math.max(3, Math.min(22, slot * 0.6));
    const x = (k) => m.l + (k + 0.5) * slot; const y = (v) => m.t + ph - (v / max) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${GRAD}`;
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const v = max * f; s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    buckets.forEach((b, k) => {
      if (b.v) s += `<rect class="bar" x="${x(k) - bw / 2}" y="${y(b.v)}" width="${bw}" height="${Math.max(1, y(0) - y(b.v))}" rx="2"/>`;
      s += `<rect class="hit" x="${x(k) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}" data-tip="<b>${esc(b.label)}</b><br>${esc(fmt(b.v))}${b.extra ? " · " + esc(b.extra) : ""}"/>`;
    });
    const step = Math.max(1, Math.ceil(buckets.length / 7));
    buckets.forEach((b, k) => { if (k % step === 0 || k === buckets.length - 1) s += `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${esc(b.short || b.label)}</text>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function hbars(el, items, fmt, title) {
    if (!items.length) { el.innerHTML = `<h4>${esc(title)}</h4><div class="empty">${t("no_data")}</div>`; return; }
    const W = 360, rowH = 34, m = { l: 96, r: 54, t: 6, b: 22 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r;
    const max = niceMax(Math.max(...items.map((i) => i.v)));
    let s = `<h4>${esc(title)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${GRAD}`;
    [0, 0.5, 1].forEach((f) => { const xx = m.l + pw * f; s += `<line class="grid" x1="${xx}" x2="${xx}" y1="${m.t}" y2="${H - m.b}"/><text x="${xx}" y="${H - 6}" text-anchor="middle">${esc(fmt(max * f))}</text>`; });
    items.forEach((it, k) => {
      const yy = m.t + k * rowH + 5, w = Math.max(2, (it.v / max) * pw);
      s += `<text class="lbl" x="${m.l - 8}" y="${yy + 15}" text-anchor="end">${esc(it.k.length > 14 ? it.k.slice(0, 13) + "…" : it.k)}</text>`;
      s += `<rect class="bar grad" x="${m.l}" y="${yy}" width="${w}" height="22" rx="2"/>`;
      s += `<rect class="hit" x="0" y="${yy - 4}" width="${W}" height="${rowH}" data-tip="<b>${esc(it.k)}</b><br>${esc(fmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`;
    });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }

  function renderStats(rows) {
    const main = $("#mainPlot"), side = $("#sidePlot"), kpi = $("#panelKpi");
    $$("#statTabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
    $("#valueMode").style.visibility = state.tab === "value" ? "visible" : "hidden";
    const byAmount = state.tab !== "value" || state.mode === "amount";
    const fmtV = byAmount ? money : (v) => String(Math.round(v));
    const loss = rows.reduce((a, i) => a + (i.amount_usd || 0), 0);
    kpi.innerHTML = `${esc(t("total_value"))} <b>${money(loss)}</b> &nbsp;·&nbsp; ${esc(t("total_count"))} <b>${rows.length}</b>`;

    if (state.tab === "value") {
      const days = [...new Set(rows.map((i) => i.day))].sort();
      let buckets = [];
      if (days.length) {
        const start = new Date(days[0]), end = new Date(days[days.length - 1]);
        for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const key = d.toISOString().slice(0, 10); const arr = rows.filter((i) => i.day === key);
          buckets.push({ label: fmtDate(key), short: key.slice(5), v: byAmount ? arr.reduce((a, i) => a + (i.amount_usd || 0), 0) : arr.length, extra: byAmount ? `${arr.length}${t("unit")}` : money(arr.reduce((a, i) => a + (i.amount_usd || 0), 0)) });
        }
      }
      columns(main, buckets, fmtV, t("tab_value"));
      const top = [...rows].filter((i) => i.amount_usd).sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 5).map((i) => ({ k: i.project, v: i.amount_usd, extra: fmtDate(dayOf(i)) }));
      hbars(side, top, money, t("top_projects"));
      tableData = { head: [t("day"), byAmount ? t("amount") : t("count")], rows: buckets.map((b) => [b.label, fmtV(b.v)]) };
    } else if (state.tab === "type") {
      const map = {}; rows.forEach((i) => { const k = i.type; map[k] = map[k] || { n: 0, v: 0 }; map[k].n++; map[k].v += i.amount_usd || 0; });
      const items = Object.entries(map).map(([k, o]) => ({ label: typeName(k), short: typeName(k).slice(0, 6), v: o.v, extra: `${o.n}${t("unit")}` })).sort((a, b) => b.v - a.v);
      columns(main, items, money, t("tab_type"));
      hbars(side, Object.entries(map).map(([k, o]) => ({ k: typeName(k), v: o.n, extra: money(o.v) })).sort((a, b) => b.v - a.v), (v) => String(Math.round(v)), t("by_type") + " · " + t("count"));
      tableData = { head: [t("type"), t("amount"), t("count")], rows: Object.entries(map).map(([k, o]) => [typeName(k), money(o.v), o.n]) };
    } else if (state.tab === "chain") {
      const map = {}; rows.forEach((i) => (i.chains || []).slice(0, 1).forEach((c) => { map[c] = map[c] || { n: 0, v: 0 }; map[c].n++; map[c].v += i.amount_usd || 0; }));
      const items = Object.entries(map).map(([k, o]) => ({ label: k, short: k.slice(0, 8), v: o.v, extra: `${o.n}${t("unit")}` })).sort((a, b) => b.v - a.v).slice(0, 12);
      columns(main, items, money, t("tab_chain"));
      hbars(side, Object.entries(map).map(([k, o]) => ({ k, v: o.n, extra: money(o.v) })).sort((a, b) => b.v - a.v).slice(0, 8), (v) => String(Math.round(v)), t("by_chain") + " · " + t("count"));
      tableData = { head: [t("chain"), t("amount"), t("count")], rows: Object.entries(map).map(([k, o]) => [k, money(o.v), o.n]) };
    } else {
      const legal = rows.filter((i) => i.type === "sanctions_designation" || i.type === "law_enforcement_action");
      const days = [...new Set(rows.map((i) => i.day))].sort();
      const buckets = days.map((d) => { const arr = legal.filter((i) => i.day === d); return { label: fmtDate(d), short: d.slice(5), v: arr.length, extra: arr.map((i) => i.project).slice(0, 3).join(", ") }; });
      columns(main, buckets, (v) => String(Math.round(v)), t("tab_legal"));
      const roles = {}; rows.forEach((i) => i.addresses.forEach((a) => { roles[a.role] = (roles[a.role] || 0) + 1; }));
      hbars(side, Object.entries(roles).map(([k, v]) => ({ k: roleName(k), v })).sort((a, b) => b.v - a.v), (v) => String(Math.round(v)), t("legal_side"));
      tableData = { head: [t("day"), t("count")], rows: buckets.map((b) => [b.label, b.v]) };
    }
  }

  // ---------- table ----------
  const gauge = (n) => {
    const pct = Math.min(1, n / 5); const r = 16, cx = 30, cy = 26; const a0 = Math.PI, a1 = Math.PI + Math.PI * pct;
    const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const color = n >= 3 ? "var(--good)" : n === 2 ? "var(--warning)" : "var(--critical)";
    const arc = pct > 0 ? `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>` : "";
    return `<svg class="gauge" viewBox="0 0 60 40"><path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" stroke="var(--raised)" stroke-width="3" fill="none"/>${arc}<text x="30" y="30" text-anchor="middle">${n}</text></svg>`;
  };
  function renderTable(rows) {
    const tb = $("#incTable tbody");
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); state.page = Math.min(state.page, pages - 1);
    const slice = rows.slice(state.page * PAGE, (state.page + 1) * PAGE);
    if (!rows.length) { tb.innerHTML = `<tr><td colspan="7" class="empty">${t("no_data")}</td></tr>`; $("#pager").innerHTML = ""; return; }
    tb.innerHTML = slice.map((i, k) => {
      const d = dayOf(i); const rep = i.day !== d && Math.abs((new Date(i.day) - new Date(d)) / 864e5) > 3 ? `<div class="psub">${esc(t("reported"))} ${i.day}</div>` : "";
      return `<tr data-k="${k}">
        <td><div class="proj"><span class="avatar" style="background:${avatarColor(i.project)}">${esc(initials(i.project))}</span><div><span class="pname">${esc(i.project)}</span>${i.followup_of ? `<span class="tag">↩ ${esc(t("follow"))} ${esc((i.followup_of.day || "").slice(5))}</span>` : ""}${i.blacklist_hits ? `<span class="tag warn">⚠ ${i.blacklist_hits}</span>` : ""}${rep}</div></div></td>
        <td>${i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="muted">${esc(shortText(i.amount_text))}</span>`}</td>
        <td><span class="date">${esc(fmtDate(d))}</span></td>
        <td><span class="pill"><span class="dot" style="background:${TYPE_COLOR[i.type] || "var(--t-other)"}"></span>${esc(typeName(i.type))}</span></td>
        <td>${(i.chains || []).slice(0, 2).map((c) => `<span class="pill chain">${esc(c)}</span>`).join(" ")}${(i.chains || []).length > 2 ? ` <span class="muted small">+${i.chains.length - 2}</span>` : ""}${!(i.chains || []).length ? '<span class="muted">-</span>' : ""}</td>
        <td class="num mono">${i.addresses.length}</td>
        <td class="center" title="${esc(t("sources_n").replace("{n}", i.sources.length))}">${gauge(i.sources.length)}</td>
      </tr>`;
    }).join("");
    $$("tr[data-k]", tb).forEach((tr) => tr.addEventListener("click", () => openDrawer(slice[Number(tr.dataset.k)])));
    $("#pager").innerHTML = `<span>${state.page * PAGE + 1}-${Math.min(rows.length, (state.page + 1) * PAGE)} / ${rows.length}</span>
      <button id="pgPrev" type="button" ${state.page === 0 ? "disabled" : ""}>‹</button><button id="pgNext" type="button" ${state.page >= pages - 1 ? "disabled" : ""}>›</button>`;
    $("#pgPrev").addEventListener("click", () => { state.page--; renderTable(rows); });
    $("#pgNext").addEventListener("click", () => { state.page++; renderTable(rows); });
  }

  // ---------- drawer ----------
  function openDrawer(i) {
    const repo = "https://github.com/lala-david/crypto_test";
    const sec = (title, body) => body ? `<div class="d-sec"><h4>${esc(title)}</h4><p>${esc(body)}</p></div>` : "";
    const addrRows = i.addresses.map((a) => `<tr><td class="muted">${esc(a.chain)}</td><td><span class="addr">${explorer(a.chain, a.address) ? `<a href="${explorer(a.chain, a.address)}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}</span><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button></td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="muted small">${esc(a.note || "")}</td></tr>`).join("");
    $("#drawerBody").innerHTML = `
      <div class="d-head"><span class="avatar" style="background:${avatarColor(i.project)}">${esc(initials(i.project))}</span><div class="d-title">${esc(i.project)}</div></div>
      <div class="d-meta">
        <span class="pill"><span class="dot" style="background:${TYPE_COLOR[i.type] || "var(--t-other)"}"></span>${esc(typeName(i.type))}</span>
        ${(i.chains || []).map((c) => `<span class="pill chain">${esc(c)}</span>`).join("")}
        <span class="date">${esc(fmtDate(i.incident_date))}</span>
        ${i.amount_usd != null ? moneyFull(i.amount_usd) : ""}${i.amount_text ? ` <span class="muted">(${esc(i.amount_text)})</span>` : ""}
      </div>
      ${i.followup_of ? `<div class="d-sec"><span class="tag">↩ ${esc(t("follow"))}</span> ${esc(t("first_reported"))}: <a href="${esc(i.followup_of.url || "#")}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(i.followup_of.day)} · ${esc(i.followup_of.project)}</a></div>` : ""}
      ${sec(t("background"), txt(i, "background"))}
      ${sec(t("method"), txt(i, "attack_method"))}
      ${sec(t("summary"), txt(i, "summary"))}
      ${sec(t("flow"), txt(i, "fund_flow"))}
      ${i.actors && i.actors.length ? sec(t("actors"), i.actors.join(", ")) : ""}
      ${i.addresses.length ? `<div class="d-sec"><h4>${esc(t("addresses"))} (${i.addresses.length})${i.blacklist_hits ? ` · ⚠ ${esc(t("blacklist"))} ${i.blacklist_hits}` : ""}</h4><table class="addrs">${addrRows}</table></div>` : ""}
      ${i.tx_hashes && i.tx_hashes.length ? `<div class="d-sec"><h4>${esc(t("tx"))} (${i.tx_hashes.length})</h4><p class="addr small">${i.tx_hashes.slice(0, 6).map(esc).join("<br>")}</p></div>` : ""}
      <div class="d-sec d-links"><h4>${esc(t("sources"))}</h4>${i.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(srcLabel(s.source))} ↗</a>`).join("")}<a href="${repo}/blob/main/reports/${i.day.slice(0, 7)}/${i.day}.${state.lang}.md" target="_blank" rel="noopener">${esc(t("report"))} ↗</a></div>`;
    $$(".copy", $("#drawerBody")).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#backdrop").classList.add("show");
  }
  const closeDrawer = () => { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#backdrop").classList.remove("show"); };
  const openTable = () => {
    $("#tableBody").innerHTML = `<table><thead><tr>${tableData.head.map((h, k) => `<th class="${k ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${tableData.rows.map((r) => `<tr>${r.map((c, k) => `<td class="${k ? "num" : ""}">${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    $("#tableModal").classList.add("show"); $("#tableModal").setAttribute("aria-hidden", "false");
  };
  const closeTable = () => { $("#tableModal").classList.remove("show"); $("#tableModal").setAttribute("aria-hidden", "true"); };

  // ---------- events ----------
  const rerender = () => { state.page = 0; render(); };
  $("#langBtn").addEventListener("click", () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); $("#briefingDay").innerHTML = ""; render(); });
  const applyTheme = (th) => { document.documentElement.dataset.theme = th; $("#themeBtn").textContent = th === "dark" ? "☀" : "☾"; };
  applyTheme(localStorage.getItem("theme") || "dark");
  $("#themeBtn").addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", next); applyTheme(next); });
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { $$("#rangeSeg button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); state.range = b.dataset.range; rerender(); }));
  $$("#statTabs .tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; renderStats(filtered()); }));
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { $$("#valueMode button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); state.mode = b.dataset.mode; renderStats(filtered()); }));
  $("#typeSel").addEventListener("change", (e) => { state.type = e.target.value; rerender(); });
  $("#chainSel").addEventListener("change", (e) => { state.chain = e.target.value; rerender(); });
  $("#sourceSel").addEventListener("change", (e) => { state.source = e.target.value; rerender(); });
  $("#hideFollow").addEventListener("change", (e) => { state.hideFollow = e.target.checked; rerender(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value; rerender(); }, 150); });
  $("#briefingDay").addEventListener("change", renderBriefing);
  $("#drawerClose").addEventListener("click", closeDrawer); $("#backdrop").addEventListener("click", closeDrawer);
  $("#tableViewBtn").addEventListener("click", openTable); $("#tableClose").addEventListener("click", closeTable);
  $("#tableModal").addEventListener("click", (e) => { if (e.target === $("#tableModal")) closeTable(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeTable(); } });
  $$(".nav-link").forEach((a) => a.addEventListener("click", () => { $$(".nav-link").forEach((x) => x.classList.remove("on")); a.classList.add("on"); }));

  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`); });
})();
