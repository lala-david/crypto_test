/* 개요 (LUMOS 구조): 히어로(제목 + 사건 티커) → 패널(전체 · 유형/체인/기간 필터 · 탭: 피해액/유형/체인/주소 · 차트 + Top 5) → 검색 → 사건 표(20행) */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, money, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, columns, hbars, donut, fillSelect, incidentRow, TABLE_HEAD, bindRows, typeColorHex, chainName, errorBox } = KL;
  const S = { days: "90", type: "", chain: "", q: "", page: 1, size: 20, tab: "amount", mode: "amount" };
  let meta = null, st = null, facets = null, list = null, addrs = null, tickerRows = null;

  async function load(tableOnly = false) {
    const f = { days: S.days, type: S.type, chain: S.chain };
    const jobs = [api("/api/incidents", { ...f, q: S.q, page: S.page, size: S.size, sort: "date" })];
    if (!tableOnly) jobs.push(api("/api/stats", f), api("/api/addresses", { ...f, size: 1 }));
    const res = await Promise.all(jobs);
    list = res[0];
    if (!tableOnly) { st = res[1]; addrs = res[2]; if (!facets || (!S.type && !S.chain)) facets = st.facets; }
    if (!tickerRows) tickerRows = (await api("/api/incidents", { days: "all", size: 24, sort: "amount" })).items.filter((i) => i.amount_usd);
    render();
  }

  function ticker() {
    const el = $("#ticker"); if (!el || !tickerRows) return;
    const li = tickerRows.map((i) => `<li><b class="amt"><span class="cur">$</span>${fmtInt(i.amount_usd)}</b><span class="w">${esc(t("ticker_mid"))}</span><a href="incident.html?id=${esc(i.uid)}">${esc(i.project)}</a><span class="w">${esc(t("ticker_on"))} ${esc(fmtMD(i.event_date || i.day))}</span></li>`).join("");
    el.innerHTML = `<ul>${li}${li}</ul>`;
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
    const lossAll = tickerRows.reduce((a, i) => a + (i.legal ? 0 : i.amount_usd || 0), 0);
    $("#heroSub").innerHTML = `<span>${esc(t("hero_since").replace("{d}", fmtDate(meta.first_day)))}</span><span class="dot">·</span><span>${esc(t("k_new"))} <b>${fmtInt(meta.new_total)}</b></span><span class="dot">·</span><span>${esc(t("k_addr"))} <b>${fmtInt(meta.addresses_total)}</b></span><span class="dot">·</span><span>${esc(t("k_loss"))} <b>${esc(money(lossAll))}</b></span>`;
    $("#total").textContent = fmtInt(list.total);
    ticker(); renderPanel();
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
