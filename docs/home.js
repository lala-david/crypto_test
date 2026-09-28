/* 개요: 히어로(제목 + Incident Report 카드) → AnimatedCard 3장 → 패널(전체 · 유형/체인/기간 필터 · 탭: 피해액/유형/체인/주소 · 차트 + Top 5) → 검색 → 사건 표(20행) */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, bindTips, columns, hbars, donut, fillSelect, incidentRow, TABLE_HEAD, bindRows, typeColorHex, chainName, errorBox } = KL;
  const S = { days: "90", type: "", chain: "", q: "", page: 1, size: 20, tab: "amount", mode: "amount" };
  let meta = null, st = null, allSt = null, facets = null, list = null, addrs = null, flowRows = null;

  async function load(tableOnly = false) {
    const f = { days: S.days, type: S.type, chain: S.chain };
    const jobs = [api("/api/incidents", { ...f, q: S.q, page: S.page, size: S.size, sort: "date" })];
    if (!tableOnly) jobs.push(api("/api/stats", f), api("/api/addresses", { ...f, size: 1 }), api("/api/incidents", { ...f, size: 400, sort: "amount" }));
    if (!allSt) jobs.push(api("/api/stats", { days: "all" }));
    const res = await Promise.all(jobs);
    list = res[0];
    if (!tableOnly) { st = res[1]; addrs = res[2]; flowRows = res[3].items; if (!facets || (!S.type && !S.chain)) facets = st.facets;
    }
    if (!allSt) allSt = res[res.length - 1];
    render();
  }

  // ---- 21st.dev 카드 2종 (cards.js) ----
  const TYPE_SHADES = ["#5B14C5", "#B58BF3", "#DAC5F9"];  // area-chart-1 원본 팔레트(DLP · SysLog · Threat Intel)
  function bucketize(rows, from, to) {
    const d0 = new Date(from + "T00:00:00"), d1 = new Date(to + "T00:00:00"); const days = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
    const step = days <= 14 ? 1 : days <= 100 ? 7 : 30; const nb = Math.ceil(days / step);
    const labels = []; for (let k = 0; k < nb; k++) { const d = new Date(d0.getTime() + k * step * 86400000); labels.push(fmtMD(d.toISOString().slice(0, 10))); }
    const idx = (r) => Math.min(nb - 1, Math.max(0, Math.floor((new Date((r.event_date || r.day) + "T00:00:00") - d0) / 86400000 / step)));
    return { labels, idx };
  }
  function renderCards() {
    // (1) Incident Report: 상위 3개 유형의 기간별 신규 건수(스무스 그룹 영역) + 지표 3행(이전 같은 길이 기간 대비 추세)
    const byType = {}; flowRows.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + 1; });
    const top3 = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const { labels, idx } = bucketize(flowRows, st.range.from, st.range.to);
    const series = top3.map((tp, k) => { const data = new Array(labels.length).fill(0); flowRows.forEach((r) => { if (r.type === tp) data[idx(r)] += 1; }); return { key: typeName(tp), color: TYPE_SHADES[k], data }; });
    KL.reportCard($("#reportCard"), { title: "Incident Report", series, labels, metrics: [], wide: true });
    // (2) AnimatedCard × 3: 도넛 = 1위 비중(호버: 1+2위 누적), 알약 = 상위 6 항목
    const mk = (id, list, name, opts) => {
      const total = list.reduce((a, r) => a + r.v, 0) || 1; const sorted = list.slice().sort((a, b) => b.v - a.v);
      const p1 = (sorted[0] ? sorted[0].v / total : 0) * 100, p2 = ((sorted[0] ? sorted[0].v : 0) + (sorted[1] ? sorted[1].v : 0)) / total * 100;
      KL.animatedCard($(id), { ...opts, mainPct: p1, hoverMainPct: p1, hoverSecondaryPct: p2,
        badgeTitle: sorted[0] ? `${name(sorted[0])} ${Math.round(p1)}%` : "–", badgeSub: `${fmtInt(total)}${opts.unit || ""}`,
        pills: sorted.slice(0, 6).map(name), description: sorted.slice(0, 3).map((r) => `${name(r)} ${Math.round(r.v / total * 100)}%`).join(" · ") });
    };
    mk("#acType", st.by_type.filter((r) => r.new).map((r) => ({ k: r.key, v: r.new })), (r) => typeName(r.k), { title: t("tab_type"), mainColor: "#8b5cf6", secondaryColor: "#fbbf24", unit: t("unit"), onClick: () => { S.tab = "type"; renderPanel(); $("#tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } });
    mk("#acChain", st.by_chain.filter((r) => r.new).map((r) => ({ k: r.key, v: r.new })), (r) => chainName(r.k), { title: t("tab_chain"), mainColor: "#ff6900", secondaryColor: "#f54900", unit: t("unit"), onClick: () => { S.tab = "chain"; renderPanel(); $("#tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } });
    mk("#acRoles", Object.entries(st.roles || {}).map(([k, v]) => ({ k, v })), (r) => roleName(r.k), { title: t("roles"), mainColor: "#34d399", secondaryColor: "#40E5D1", unit: "", onClick: () => { S.tab = "roles"; renderPanel(); $("#tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  }

  function renderPanel() {
    const tabs = [["amount", t("tab_amount")], ["type", t("tab_type")], ["chain", t("tab_chain")], ["roles", t("roles")]];
    $("#tabs").innerHTML = tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}" type="button">${esc(l)}</button>`).join("");
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; renderPanel(); }));
    const byAmt = S.mode === "amount";
    const modeEl = $("#modeSeg");
    if (S.tab === "roles") modeEl.innerHTML = "";
    else { modeEl.innerHTML = [["amount", t("mode_amount")], ["count", t("mode_count")]].map(([k, l]) => `<button data-mode="${k}" class="${S.mode === k ? "on" : ""}" type="button">${esc(l)}</button>`).join(""); $$("#modeSeg button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; renderPanel(); })); }
    const cnt = (v) => String(Math.round(v));
    const plot = $("#mainPlot"), top = $("#top5"), tt = $("#top5Title"), pt = $("#panelTotal");
    if (S.tab === "amount") {
      pt.innerHTML = byAmt ? `${esc(t("k_loss"))} <b>${esc(money(st.loss_amount))}</b>${st.legal_amount ? ` <span class="faint">· ${esc(t("k_legal"))} ${esc(money(st.legal_amount))}</span>` : ""}` : `${esc(t("k_new"))} <b>${fmtInt(st.new_count)}</b>`;
      columns(plot, st.daily.map((d) => ({ label: fmtMD(d.day), v: byAmt ? d.amount : d.new, extra: byAmt ? `${d.new}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, t("daily_amount"), { height: 230 });
      tt.textContent = t("top5_title");
      const top5 = (st.top || []).slice(0, 5);
      hbars(top, top5.map((x) => ({ k: x.project, v: x.amount_usd, extra: fmtDate(x.event_date || x.day) })), money, t("top5_title"));
      $$(".hit", top).forEach((h, k) => { h.style.cursor = "pointer"; h.addEventListener("click", () => { if (top5[k]) KL.openCase(top5[k].uid); }); });
    } else if (S.tab === "type" || S.tab === "chain") {
      const rows = (S.tab === "type" ? st.by_type : st.by_chain).filter((r) => r.new);
      const key = S.tab === "type" ? (r) => typeName(r.key) : (r) => chainName(r.key);
      const items = rows.map((r) => ({ k: key(r), v: byAmt ? r.amount : r.new, color: S.tab === "type" ? typeColorHex(r.key) : "var(--chart)", title: S.tab === "type" ? typeFull(r.key) : r.key })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      pt.innerHTML = `${esc(S.tab === "type" ? t("tab_type") : t("tab_chain"))} <b>${rows.length}</b>`;
      donut(plot, items, byAmt ? money(items.reduce((a, x) => a + x.v, 0)) : fmtInt(st.new_count), byAmt ? t("k_loss") : t("new_label"), byAmt ? money : null);
      tt.textContent = byAmt ? t("top5_amount") : t("top5_count");
      hbars(top, items.slice(0, 5), byAmt ? money : cnt, tt.textContent);
    } else {
      const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
      pt.innerHTML = `${esc(t("addresses"))} <b>${fmtInt(st.addresses)}</b>`;
      hbars(plot, roles.map(([k, v]) => ({ k: roleName(k), v, pct: v / rt })), cnt, t("roles"));
      tt.textContent = t("top5_chains_addr");
      const ch = Object.entries((addrs && addrs.chains) || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
      hbars(top, ch.map(([k, v]) => ({ k, v })), cnt, tt.textContent);
    }
  }

  function render() {
    renderNav("index.html", meta); renderFoot(); applyI18n(); bindChrome(() => render());
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; S.page = 1; load(); });
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: `${typeName(v)} (${facets.types[v]})` })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: `${v} (${facets.chains[v]})` })), t("all_chains"), S.chain);
    renderCards();
    $("#total").textContent = fmtInt(list.total);
    renderPanel();
    const tb = $("#incTable");
    tb.innerHTML = TABLE_HEAD() + `<tbody>${list.items.length ? list.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="6" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb);
    const pages = Math.max(1, Math.ceil(list.total / S.size));
    $("#pager").innerHTML = `<span>${list.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(list.total, S.page * S.size)} / ${list.total}</span><button id="pgPrev" type="button" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; load(true); }; $("#pgNext").onclick = () => { S.page++; load(true); };
  }
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; S.page = 1; load(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; S.page = 1; load(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load(true); }, 250); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
