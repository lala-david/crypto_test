/* Crypto Incident Monitor — 정적 대시보드 (docs/data/*.json 을 fetch) */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const I18N = {
    ko: {
      title: "가상자산 해킹·범죄 지갑 동향", subtitle: "rekt · SlowMist · DeFiLlama · DeFiHackLabs · ZachXBT · TRM · Chainalysis · OFAC · DOJ 등 12개 소스를 매시간 수집",
      latest_briefing: "브리핑", all: "전체", hide_follow: "후속 보도 숨기기", search_ph: "프로젝트 · 주소 · 키워드 검색",
      chart_daily: "일별 신규 사건 (보고일 기준)", chart_type: "유형별 사건 수", chart_chain: "체인별 피해액 (상위 8)", table_view: "표로 보기",
      incidents: "사건 목록", click_hint: "행을 누르면 상세 카드가 열립니다",
      th_date: "사건일", th_incident: "사건", th_type: "유형", th_chain: "체인", th_amount: "금액", th_addr: "주소", th_source: "출처",
      foot: "데이터는 공개 소스에서 자동 수집·LLM 요약된 것으로 오류가 있을 수 있습니다. 주소는 반드시 원문으로 재확인하세요.",
      updated: "갱신", kpi_today: "오늘 사건", kpi_7d: "7일 사건", kpi_loss: "7일 피해·관련 금액", kpi_addr: "7일 수집 주소", kpi_sdn: "OFAC 제재 주소",
      vs_prev: "지난 7일 대비", follow: "후속", first_reported: "첫 보도", background: "사건 배경", method: "공격/범죄 수법",
      summary: "요약", flow: "자금 흐름", addresses: "지갑 주소", sources: "출처", actors: "관련 주체", tx: "트랜잭션",
      blacklist: "기존 블랙리스트 재등장", copy: "복사", copied: "복사됨", no_data: "해당 조건의 사건이 없습니다", incidents_unit: "건",
      day: "날짜", count: "건수", type: "유형", chain: "체인", amount: "피해액", report: "상세 리포트(GitHub)", all_types: "모든 유형", all_chains: "모든 체인", all_sources: "모든 소스",
      types: { hack_exploit: "해킹/익스플로잇", private_key_compromise: "개인키 탈취", rug_pull: "러그풀", phishing_social_engineering: "피싱/소셜엔지니어링",
               scam_fraud: "사기", ransomware: "랜섬웨어", sanctions_designation: "제재 지정", law_enforcement_action: "수사/기소/압수", laundering_report: "자금세탁 분석", other: "기타" },
      roles: { attacker: "공격자", laundering: "세탁/경유", victim: "피해자", sanctioned: "제재 대상", unknown: "미분류" },
    },
    en: {
      title: "Crypto Hack & Illicit Wallet Monitor", subtitle: "Hourly collection from 12 sources: rekt · SlowMist · DeFiLlama · DeFiHackLabs · ZachXBT · TRM · Chainalysis · OFAC · DOJ …",
      latest_briefing: "Briefing", all: "All", hide_follow: "Hide follow-ups", search_ph: "Search project · address · keyword",
      chart_daily: "New incidents per day (by report date)", chart_type: "Incidents by type", chart_chain: "Loss by chain (top 8)", table_view: "Table view",
      incidents: "Incidents", click_hint: "Click a row for the full card",
      th_date: "Date", th_incident: "Incident", th_type: "Type", th_chain: "Chains", th_amount: "Amount", th_addr: "Addr.", th_source: "Source",
      foot: "Data is auto-collected from public sources and summarized by an LLM; errors are possible. Always re-verify addresses against the original source.",
      updated: "Updated", kpi_today: "Today", kpi_7d: "Incidents (7d)", kpi_loss: "Loss & related (7d)", kpi_addr: "Addresses (7d)", kpi_sdn: "OFAC sanctioned addresses",
      vs_prev: "vs previous 7d", follow: "follow-up", first_reported: "first reported", background: "Background", method: "Attack / Modus operandi",
      summary: "Summary", flow: "Fund flow", addresses: "Wallet addresses", sources: "Sources", actors: "Actors", tx: "Transactions",
      blacklist: "Known blacklist re-hits", copy: "Copy", copied: "Copied", no_data: "No incidents match the filters", incidents_unit: "",
      day: "Day", count: "Count", type: "Type", chain: "Chain", amount: "Loss", report: "Full report (GitHub)", all_types: "All types", all_chains: "All chains", all_sources: "All sources",
      types: { hack_exploit: "Hack / Exploit", private_key_compromise: "Key compromise", rug_pull: "Rug pull", phishing_social_engineering: "Phishing / Social eng.",
               scam_fraud: "Scam / Fraud", ransomware: "Ransomware", sanctions_designation: "Sanctions", law_enforcement_action: "Law enforcement", laundering_report: "Laundering report", other: "Other" },
      roles: { attacker: "attacker", laundering: "laundering", victim: "victim", sanctioned: "sanctioned", unknown: "unknown" },
    },
  };
  const SOURCE_LABEL = { rekt: "rekt.news", slowmist: "SlowMist", defillama: "DeFiLlama", defihacklabs: "DeFiHackLabs", zachxbt: "ZachXBT", trm: "TRM Labs",
    chainalysis: "Chainalysis", ofac: "OFAC", ofac_sdn: "OFAC SDN", doj: "US DOJ", scamsniffer: "ScamSniffer" };
  const srcLabel = (s) => SOURCE_LABEL[s] || (s || "").replace(/^rss:/, "");

  const state = { lang: localStorage.getItem("lang") || "ko", range: "30", type: "", chain: "", source: "", q: "", hideFollow: false,
                  incidents: [], briefings: [], meta: {} };
  const t = (k) => (I18N[state.lang][k] ?? I18N.ko[k] ?? k);
  const typeName = (k) => I18N[state.lang].types[k] || k;
  const roleName = (k) => I18N[state.lang].roles[k] || k;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v, text) => {
    if (v == null) return text || "-";
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
    return `$${Math.round(v)}`;
  };
  const sev = (i) => i.type === "sanctions_designation" || i.type === "law_enforcement_action" ? "legal"
    : (i.amount_usd || 0) >= 1e7 ? "critical" : (i.amount_usd || 0) >= 1e6 ? "serious" : "warning";
  const explorer = (chain, addr) => {
    const c = (chain || "").toUpperCase();
    if (addr.startsWith("0x")) return c === "BSC" ? `https://bscscan.com/address/${addr}` : c === "ARB" ? `https://arbiscan.io/address/${addr}`
      : c === "POLYGON" ? `https://polygonscan.com/address/${addr}` : c === "BASE" ? `https://basescan.org/address/${addr}` : `https://etherscan.io/address/${addr}`;
    if (c === "TRX" || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return `https://tronscan.org/#/address/${addr}`;
    if (c === "BTC") return `https://mempool.space/address/${addr}`;
    if (c === "SOL") return `https://solscan.io/account/${addr}`;
    if (c === "LTC") return `https://blockchair.com/litecoin/address/${addr}`;
    return "";
  };
  const txt = (i, field) => i[`${field}_${state.lang}`] || i[`${field}_${state.lang === "ko" ? "en" : "ko"}`] || "";
  const dayOf = (i) => i.incident_date || i.day;
  const fmtDay = (d) => d || "-";
  const shortText = (s, n = 22) => { s = (s || "").replace(/\s*\(.*$/, "").trim(); return s ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "-"; };
  const dateCell = (i) => { const d = dayOf(i); const rep = i.day && d !== i.day && Math.abs((new Date(i.day) - new Date(d)) / 864e5) > 3 ? `<div class="small muted">${state.lang === "ko" ? "보고" : "reported"} ${i.day.slice(5)}</div>` : ""; return `<span class="nowrap">${esc(fmtDay(d))}</span>${rep}`; };

  // ---------- data ----------
  async function load() {
    const [inc, br, meta] = await Promise.all(["incidents", "briefings", "meta"].map((n) => fetch(`data/${n}.json`, { cache: "no-store" }).then((r) => r.json())));
    state.incidents = inc; state.briefings = br; state.meta = meta;
    render();
  }

  // ---------- filters ----------
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

  function fillSelect(sel, values, allLabel, current) {
    sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join("");
  }

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

    renderKpis(); renderBriefing();
    const rows = filtered();
    renderDaily(rows); renderType(rows); renderChain(rows); renderTable(rows);
  }

  function renderKpis() {
    const last = state.meta.last_day || "";
    const d = new Date(last); const cut7 = new Date(d); cut7.setDate(d.getDate() - 6); const cut14 = new Date(d); cut14.setDate(d.getDate() - 13);
    const s7 = cut7.toISOString().slice(0, 10), s14 = cut14.toISOString().slice(0, 10);
    const w = state.incidents.filter((i) => i.day >= s7 && !i.followup_of);
    const prev = state.incidents.filter((i) => i.day >= s14 && i.day < s7 && !i.followup_of);
    const today = state.incidents.filter((i) => i.day === last && !i.followup_of);
    const loss = (arr) => arr.reduce((a, i) => a + (i.amount_usd || 0), 0);
    const addrs = (arr) => new Set(arr.flatMap((i) => i.addresses.map((a) => a.address.toLowerCase()))).size;
    const delta = (cur, before, fmt = (x) => x) => {
      if (!before) return "";
      const diff = cur - before; const cls = diff > 0 ? "up" : diff < 0 ? "down" : "";
      return `<div class="delta ${cls}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} ${fmt(Math.abs(diff))} ${t("vs_prev")}</div>`;
    };
    const tiles = [
      { label: t("kpi_today"), value: today.length, sub: last },
      { label: t("kpi_7d"), value: w.length, sub: delta(w.length, prev.length) },
      { label: t("kpi_loss"), value: money(loss(w)), sub: delta(loss(w), loss(prev), money) },
      { label: t("kpi_addr"), value: addrs(w).toLocaleString(), sub: delta(addrs(w), addrs(prev), (x) => x.toLocaleString()) },
      { label: t("kpi_sdn"), value: (state.meta.sdn_addresses || 0).toLocaleString(), sub: `<div class="delta">SDN.XML</div>` },
    ];
    $("#kpis").innerHTML = tiles.map((k) => `<div class="tile"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div>${k.sub && k.sub.startsWith("<") ? k.sub : `<div class="delta">${esc(k.sub || "")}</div>`}</div>`).join("");
  }

  function mdToHtml(md) {
    const items = (md || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, ""));
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return `<ul>${items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`;
  }
  function renderBriefing() {
    const sel = $("#briefingDay");
    if (!sel.options.length || sel.options.length !== state.briefings.length) {
      sel.innerHTML = state.briefings.map((b) => `<option value="${b.day}">${b.day} · ${b.relevant}${state.lang === "ko" ? "건" : ""}</option>`).join("");
    }
    const b = state.briefings.find((x) => x.day === sel.value) || state.briefings[0];
    if (!b) { $("#briefingHeadline").textContent = ""; $("#briefingBody").innerHTML = `<p class="muted">${t("no_data")}</p>`; return; }
    if (sel.value !== b.day) sel.value = b.day;
    $("#briefingHeadline").textContent = b[`headline_${state.lang}`] || b.headline_ko;
    $("#briefingBody").innerHTML = mdToHtml(b[`briefing_${state.lang}`] || b.briefing_ko);
  }

  // ---------- charts (SVG, 단일 계열 = slot-1, 가는 막대, 헤어라인 그리드, 툴팁) ----------
  const tip = $("#tip");
  const showTip = (e, html) => { tip.innerHTML = html; tip.classList.add("show"); tip.style.left = e.clientX + "px"; tip.style.top = (e.clientY - 8) + "px"; };
  const hideTip = () => tip.classList.remove("show");
  const bindTips = (svg) => {
    $$("[data-tip]", svg).forEach((el) => {
      el.addEventListener("mousemove", (e) => showTip(e, el.dataset.tip)); el.addEventListener("mouseleave", hideTip);
      el.addEventListener("focus", (e) => { const r = el.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.top }, el.dataset.tip); });
      el.addEventListener("blur", hideTip);
    });
  };
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

  let lastDaily = [], lastType = [], lastChain = [];
  function renderDaily(rows) {
    const el = $("#dailyPlot");
    const days = [...new Set(rows.map((i) => i.day))].sort();
    if (!days.length) { el.innerHTML = `<div class="empty">${t("no_data")}</div>`; lastDaily = []; return; }
    const start = new Date(days[0]), end = new Date(days[days.length - 1]);
    const seq = []; for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) seq.push(d.toISOString().slice(0, 10));
    const counts = seq.map((d) => ({ d, n: rows.filter((i) => i.day === d).length, loss: rows.filter((i) => i.day === d).reduce((a, i) => a + (i.amount_usd || 0), 0) }));
    lastDaily = counts;
    const W = 560, H = 220, m = { l: 28, r: 8, t: 8, b: 26 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = niceMax(Math.max(...counts.map((c) => c.n))); const bw = Math.max(2, Math.min(18, pw / counts.length - 2));
    const x = (k) => m.l + (k + 0.5) * (pw / counts.length); const y = (v) => m.t + ph - (v / max) * ph;
    const ticks = [0, max / 2, max];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("chart_daily"))}">`;
    ticks.forEach((v) => { s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    counts.forEach((c, k) => {
      const h = Math.max(0, y(0) - y(c.n));
      if (c.n) s += `<rect class="bar" x="${x(k) - bw / 2}" y="${y(c.n)}" width="${bw}" height="${h}" rx="3" ry="3"/>`;
      s += `<rect class="hit" x="${x(k) - pw / counts.length / 2}" y="${m.t}" width="${pw / counts.length}" height="${ph}" tabindex="0" data-tip="<b>${c.d}</b><br>${c.n} ${esc(t("incidents_unit"))} · ${money(c.loss)}"/>`;
    });
    const step = Math.ceil(counts.length / 6);
    counts.forEach((c, k) => { if (k % step === 0 || k === counts.length - 1) s += `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${c.d.slice(5)}</text>`; });
    const peak = counts.reduce((a, b) => (b.n > a.n ? b : a), counts[0]);
    if (peak.n) s += `<text class="val" x="${x(counts.indexOf(peak))}" y="${y(peak.n) - 5}" text-anchor="middle">${peak.n}</text>`;
    el.innerHTML = s + "</svg>"; bindTips(el);
  }

  function hbars(el, items, valueFmt, label) {
    if (!items.length) { el.innerHTML = `<div class="empty">${t("no_data")}</div>`; return; }
    const W = 560, rowH = 26, m = { l: 150, r: 60, t: 6, b: 6 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r;
    const max = niceMax(Math.max(...items.map((i) => i.v)));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    s += `<line class="axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>`;
    items.forEach((it, k) => {
      const yy = m.t + k * rowH + 6, w = (it.v / max) * pw;
      s += `<text class="lbl" x="${m.l - 8}" y="${yy + 11}" text-anchor="end">${esc(it.k.length > 22 ? it.k.slice(0, 21) + "…" : it.k)}</text>`;
      s += `<rect class="bar" x="${m.l}" y="${yy}" width="${Math.max(2, w)}" height="14" rx="3" ry="3"/>`;
      s += `<text class="val" x="${m.l + Math.max(2, w) + 6}" y="${yy + 11}">${esc(valueFmt(it.v))}</text>`;
      s += `<rect class="hit" x="0" y="${yy - 5}" width="${W}" height="${rowH}" tabindex="0" data-tip="<b>${esc(it.k)}</b><br>${esc(valueFmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`;
    });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function renderType(rows) {
    const map = {}; rows.forEach((i) => { map[i.type] = (map[i.type] || 0) + 1; });
    lastType = Object.entries(map).map(([k, v]) => ({ k: typeName(k), v })).sort((a, b) => b.v - a.v);
    hbars($("#typePlot"), lastType, (v) => `${v}`, t("chart_type"));
  }
  function renderChain(rows) {
    const map = {}, cnt = {};
    rows.forEach((i) => { (i.chains || []).slice(0, 1).forEach((c) => { map[c] = (map[c] || 0) + (i.amount_usd || 0); cnt[c] = (cnt[c] || 0) + 1; }); });
    lastChain = Object.entries(map).filter(([, v]) => v > 0).map(([k, v]) => ({ k, v, extra: `${cnt[k]} ${t("incidents_unit")}`.trim() })).sort((a, b) => b.v - a.v).slice(0, 8);
    hbars($("#chainPlot"), lastChain, (v) => money(v), t("chart_chain"));
  }

  function renderTable(rows) {
    $("#incCount").textContent = `${rows.length}${t("incidents_unit") ? " " + t("incidents_unit") : ""}`;
    const tb = $("#incTable tbody");
    if (!rows.length) { tb.innerHTML = `<tr><td colspan="7" class="empty">${t("no_data")}</td></tr>`; return; }
    tb.innerHTML = rows.map((i, k) => `<tr data-k="${k}">
      <td class="muted">${dateCell(i)}</td>
      <td><span class="sev ${sev(i)}"></span><span class="name">${esc(i.project)}</span>${i.followup_of ? ` <span class="tag follow">↩ ${esc(t("follow"))} ${esc((i.followup_of.day || "").slice(5))}</span>` : ""}${i.blacklist_hits ? ` <span class="tag">⚠ ${i.blacklist_hits}</span>` : ""}</td>
      <td>${esc(typeName(i.type))}</td>
      <td>${esc((i.chains || []).join(", ")) || "-"}</td>
      <td class="num">${esc(i.amount_usd != null ? money(i.amount_usd) : shortText(i.amount_text))}</td>
      <td class="num">${i.addresses.length}</td>
      <td class="muted">${esc(srcLabel(i.source))}${i.sources.length > 1 ? ` +${i.sources.length - 1}` : ""}</td>
    </tr>`).join("");
    $$("tr[data-k]", tb).forEach((tr) => tr.addEventListener("click", () => openDrawer(rows[Number(tr.dataset.k)])));
  }

  // ---------- drawer ----------
  function openDrawer(i) {
    const repo = $("#repoLink").href;
    const sec = (title, body) => body ? `<div class="d-sec"><h4>${esc(title)}</h4><p>${esc(body)}</p></div>` : "";
    const addrRows = i.addresses.map((a) => `<tr><td class="muted">${esc(a.chain)}</td><td><span class="addr">${explorer(a.chain, a.address) ? `<a href="${explorer(a.chain, a.address)}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}</span><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button></td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="muted small">${esc(a.note || "")}</td></tr>`).join("");
    $("#drawerBody").innerHTML = `
      <div class="d-title"><span class="sev ${sev(i)}"></span>${esc(i.project)}</div>
      <div class="d-meta">${esc(typeName(i.type))} · ${esc((i.chains || []).join(", ") || "-")} · ${esc(fmtDay(i.incident_date))} · <b>${esc(money(i.amount_usd, i.amount_text))}</b>${i.amount_text && i.amount_usd ? ` <span class="muted">(${esc(i.amount_text)})</span>` : ""}</div>
      ${i.followup_of ? `<div class="d-sec"><span class="tag follow">↩ ${esc(t("follow"))}</span> ${esc(t("first_reported"))}: <a href="${esc(i.followup_of.url || "#")}" target="_blank" rel="noopener">${esc(i.followup_of.day)} · ${esc(i.followup_of.project)}</a></div>` : ""}
      ${sec(t("background"), txt(i, "background"))}
      ${sec(t("method"), txt(i, "attack_method"))}
      ${sec(t("summary"), txt(i, "summary"))}
      ${sec(t("flow"), txt(i, "fund_flow"))}
      ${i.actors && i.actors.length ? sec(t("actors"), i.actors.join(", ")) : ""}
      ${i.addresses.length ? `<div class="d-sec"><h4>${esc(t("addresses"))} (${i.addresses.length})${i.blacklist_hits ? ` · ⚠ ${esc(t("blacklist"))} ${i.blacklist_hits}` : ""}</h4><table class="addrs">${addrRows}</table></div>` : ""}
      ${i.tx_hashes && i.tx_hashes.length ? `<div class="d-sec"><h4>${esc(t("tx"))} (${i.tx_hashes.length})</h4><p class="addr">${i.tx_hashes.slice(0, 6).map(esc).join("<br>")}</p></div>` : ""}
      <div class="d-sec"><h4>${esc(t("sources"))}</h4><p>${i.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(srcLabel(s.source))}</a>`).join(" · ")}
        · <a href="${repo}/blob/main/reports/${i.day.slice(0, 7)}/${i.day}.${state.lang}.md" target="_blank" rel="noopener">${esc(t("report"))}</a></p></div>`;
    $$(".copy", $("#drawerBody")).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#backdrop").classList.add("show");
  }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#backdrop").classList.remove("show"); }

  // ---------- table view (charts' accessible twin) ----------
  function openTable(kind) {
    let head, rows;
    if (kind === "daily") { head = [t("day"), t("count"), t("amount")]; rows = lastDaily.map((c) => [c.d, c.n, money(c.loss)]); }
    else if (kind === "type") { head = [t("type"), t("count")]; rows = lastType.map((c) => [c.k, c.v]); }
    else { head = [t("chain"), t("amount"), t("count")]; rows = lastChain.map((c) => [c.k, money(c.v), c.extra]); }
    $("#tableBody").innerHTML = `<table><thead><tr>${head.map((h, k) => `<th class="${k ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => `<td class="${k ? "num" : ""}">${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    $("#tableModal").classList.add("show"); $("#tableModal").setAttribute("aria-hidden", "false");
  }
  function closeTable() { $("#tableModal").classList.remove("show"); $("#tableModal").setAttribute("aria-hidden", "true"); }

  // ---------- events ----------
  $("#langBtn").addEventListener("click", () => { state.lang = state.lang === "ko" ? "en" : "ko"; localStorage.setItem("lang", state.lang); $("#briefingDay").innerHTML = ""; render(); });
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("theme", next);
  });
  const savedTheme = localStorage.getItem("theme"); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { $$("#rangeSeg button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); state.range = b.dataset.range; render(); }));
  $("#typeSel").addEventListener("change", (e) => { state.type = e.target.value; render(); });
  $("#chainSel").addEventListener("change", (e) => { state.chain = e.target.value; render(); });
  $("#sourceSel").addEventListener("change", (e) => { state.source = e.target.value; render(); });
  $("#hideFollow").addEventListener("change", (e) => { state.hideFollow = e.target.checked; render(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value; render(); }, 150); });
  $("#briefingDay").addEventListener("change", renderBriefing);
  $("#drawerClose").addEventListener("click", closeDrawer); $("#backdrop").addEventListener("click", closeDrawer);
  $("#tableClose").addEventListener("click", closeTable); $("#tableModal").addEventListener("click", (e) => { if (e.target === $("#tableModal")) closeTable(); });
  $$("[data-table]").forEach((b) => b.addEventListener("click", () => openTable(b.dataset.table)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeTable(); } });

  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="card empty">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`); });
})();
