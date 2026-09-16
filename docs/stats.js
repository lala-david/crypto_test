/* 통계: 서버 집계(/api/stats) 를 그림 */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, esc, money, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, columns, hbars, fillSelect } = KL;
  const S = { days: "30", type: "", chain: "", tab: "value", mode: "amount" };
  let meta = null, stats = null, facets = null;

  async function load() {
    stats = await api("/api/stats", { days: S.days, type: S.type, chain: S.chain });
    if (!facets || (!S.type && !S.chain)) facets = stats.facets;
    render();
  }
  function render() {
    renderNav("stats.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    $$("#rangeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.range === S.days));
    $$("#statTabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
    $("#valueMode").style.visibility = S.tab === "value" ? "visible" : "hidden";
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: typeName(v) })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: v })), t("all_chains"), S.chain);
    $("#panelKpi").innerHTML = `${esc(t("total_value"))} <b>${money(stats.total_amount)}</b> &nbsp;·&nbsp; ${esc(t("total_count"))} <b>${stats.total_count}</b> &nbsp;·&nbsp; ${esc(t("addresses"))} <b>${stats.addresses}</b>`;
    const main = $("#mainPlot"), side = $("#sidePlot"), tbl = $("#statTable");
    const cnt = (v) => String(Math.round(v));
    const table = (head, rows) => { tbl.innerHTML = `<thead><tr>${head.map((h, k) => `<th class="${k ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => `<td class="${k ? "num mono" : ""}">${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody>`; };
    if (S.tab === "value") {
      const byAmount = S.mode === "amount";
      columns(main, stats.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: byAmount ? d.amount : d.count, extra: byAmount ? `${d.count}${t("unit")}` : money(d.amount) })), byAmount ? money : cnt, t("tab_value"));
      hbars(side, stats.top.map((x) => ({ k: x.project, v: x.amount_usd, extra: fmtDate(x.incident_date || x.day) })), money, t("top_projects"));
      table([t("day"), t("count"), t("amount")], stats.daily.map((d) => [fmtDate(d.day), d.count, money(d.amount)]));
    } else if (S.tab === "type") {
      columns(main, stats.by_type.map((x) => ({ label: typeName(x.key), short: typeName(x.key).slice(0, 6), v: x.amount, extra: `${x.count}${t("unit")}` })), money, t("tab_type"));
      hbars(side, [...stats.by_type].sort((a, b) => b.count - a.count).map((x) => ({ k: typeName(x.key), v: x.count, extra: money(x.amount) })), cnt, t("by_type"));
      table([t("type"), t("count"), t("amount")], stats.by_type.map((x) => [typeName(x.key), x.count, money(x.amount)]));
    } else if (S.tab === "chain") {
      columns(main, stats.by_chain.slice(0, 12).map((x) => ({ label: x.key, short: x.key.slice(0, 8), v: x.amount, extra: `${x.count}${t("unit")}` })), money, t("tab_chain"));
      hbars(side, [...stats.by_chain].sort((a, b) => b.count - a.count).slice(0, 8).map((x) => ({ k: x.key, v: x.count, extra: money(x.amount) })), cnt, t("by_chain"));
      table([t("chain"), t("count"), t("amount")], stats.by_chain.map((x) => [x.key, x.count, money(x.amount)]));
    } else {
      columns(main, stats.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.legal })), cnt, t("legal"));
      hbars(side, Object.entries(stats.roles).map(([k, v]) => ({ k: roleName(k), v })), cnt, t("legal_side"));
      table([t("day"), t("legal")], stats.daily.map((d) => [fmtDate(d.day), d.legal]));
    }
  }
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { S.days = b.dataset.range; load(); }));
  $$("#statTabs .tab").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; render(); }));
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { $$("#valueMode button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); S.mode = b.dataset.mode; render(); }));
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; load(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; load(); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)}</div>`); });
})();
