/* 통계: 기간·유형·체인 필터 → 시계열 + 유형/체인 표(신규 기준) + 일별 표 + 제재·수사 + 주소 역할 */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, basisSeg, columns, hbars, fillSelect, sw, chainName, errorBox } = KL;
  const S = { days: "30", type: "", chain: "", mode: "amount", basis: "event" };
  let meta = null, st = null, facets = null;

  async function load() { st = await api("/api/stats", { days: S.days, type: S.type, chain: S.chain, basis: S.basis }); if (!facets || (!S.type && !S.chain)) facets = st.facets; render(); }
  function render() {
    renderNav("stats.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    basisSeg($("#basisSeg"), S.basis, (v) => { S.basis = v; load(); });
    const basisLbl = S.basis === "event" ? t("basis_event") : t("basis_collected");
    $$("#valueMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: `${typeName(v)} (${facets.types[v]})` })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: `${v} (${facets.chains[v]})` })), t("all_chains"), S.chain);
    $("#sub").innerHTML = `<span>${esc(fmtDate(st.range.from))} – ${esc(fmtDate(st.range.to))}</span><span class="m">${esc(t("new_label"))} ${fmtInt(st.new_count)}${esc(t("unit"))}</span><span class="m">${esc(t("follow"))} ${fmtInt(st.followup_count)}</span><span class="m" title="${moneyFull(st.total_amount)}">${esc(money(st.total_amount))}</span><span class="m">${esc(t("k_unknown_amt"))} ${fmtInt(st.unknown_amount_count)}</span>`;
    const byAmt = S.mode === "amount"; const cnt = (v) => String(Math.round(v));
    $("#tsTitle").textContent = `${byAmt ? t("daily_amount") : t("daily_count")} · ${basisLbl}`;
    columns($("#tsPlot"), st.daily.map((d) => ({ label: fmtMD(d.day), v: byAmt ? d.amount : d.count, extra: byAmt ? `${d.count}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, $("#tsTitle").textContent, { height: 240 });
    const rows = (list, key) => {
      const n = list.reduce((a, r) => a + r.new, 0) || 1, a = list.reduce((x, r) => x + r.amount, 0) || 1;
      return `<tbody>${list.map((r) => `<tr><td>${key(r)}</td><td class="num">${fmtInt(r.new)}</td><td class="num">${fmtPct(r.new / n)}</td><td class="num">${r.known ? money(r.amount) : '<span class="faint">–</span>'}</td><td class="num">${r.known ? fmtPct(r.amount / a) : '<span class="faint">–</span>'}</td><td class="num">${r.known ? money(r.amount / r.known) : '<span class="faint">–</span>'}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>${esc(t("sum"))}</td><td class="num">${fmtInt(n)}</td><td class="num">100%</td><td class="num">${money(a)}</td><td class="num">100%</td><td class="num">${money(a / Math.max(1, list.reduce((x, r) => x + r.known, 0)))}</td></tr></tfoot>`;
    };
    const head = (k) => `<thead><tr><th>${esc(k)}</th><th class="num">${esc(t("th_new"))}</th><th class="num">${esc(t("th_count_pct"))}</th><th class="num">${esc(t("th_amount"))}</th><th class="num">${esc(t("th_amount_pct"))}</th><th class="num">${esc(t("th_avg"))}</th></tr></thead>`;
    const types = st.by_type.filter((r) => r.new).sort((a, b) => b.new - a.new);
    $("#typeTable").innerHTML = head(t("type")) + rows(types, (r) => `<span title="${esc(typeFull(r.key))}">${sw(r.key)}${esc(typeName(r.key))}</span>`);
    $("#metaType").textContent = `${t("basis_new")} · ${types.length}`;
    const chains = st.by_chain.filter((r) => r.new).sort((a, b) => b.new - a.new);
    $("#chainTable").innerHTML = head(t("chain")) + rows(chains, (r) => esc(chainName(r.key)));
    $("#metaChain").textContent = `${t("basis_first_chain")} · ${chains.filter((r) => r.key !== "unknown").length}`;
    const dd = st.daily.filter((d) => d.count).slice().reverse();
    $("#dailyTable").innerHTML = `<thead><tr><th>${esc(t("day"))}</th><th class="num">${esc(t("th_new"))}</th><th class="num">${esc(t("follow"))}</th><th class="num">${esc(t("legal"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>${dd.map((d) => `<tr><td class="date">${esc(fmtDate(d.day))}</td><td class="num">${d.new}</td><td class="num">${d.count - d.new || '<span class="faint">–</span>'}</td><td class="num">${d.legal || '<span class="faint">–</span>'}</td><td class="num">${money(d.amount)}</td></tr>`).join("")}</tbody>`;
    $("#metaDaily").textContent = `${basisLbl} · ${st.daily.filter((d) => d.count).length}${t("unit") ? "일" : "d"}`;
    columns($("#legalPlot"), st.daily.map((d) => ({ label: fmtMD(d.day), v: d.legal })), cnt, t("legal_daily"), { height: 170 });
    $("#metaLegal").textContent = `${fmtInt(st.legal_count)}${t("unit")} · ${money(st.legal_amount)}`;
    const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
    hbars($("#rolesBars"), roles.map(([k, v]) => ({ k: roleName(k), v, pct: v / rt })), cnt, t("roles"));
    $("#metaRoles").textContent = `${fmtInt(st.addresses)} ${t("addresses")}`;
  }
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; render(); }));
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; load(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; load(); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
