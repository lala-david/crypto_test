/* 분석: 기간·유형·체인 필터 → 시계열 + 유형/체인/일별 표 + 제재·수사 + 주소 역할 */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, esc, fmtInt, fmtPct, money, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, columns, hbars, fillSelect, TYPE_COLOR, isWeekend } = KL;
  const S = { days: "30", type: "", chain: "", mode: "amount" };
  let meta = null, st = null, facets = null;

  async function load() { st = await api("/api/stats", { days: S.days, type: S.type, chain: S.chain }); if (!facets || (!S.type && !S.chain)) facets = st.facets; render(); }
  function render() {
    renderNav("stats.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    $$("#rangeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.range === S.days));
    $$("#valueMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: typeName(v) })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: v })), t("all_chains"), S.chain);
    $("#sub").innerHTML = `<span class="m">${fmtInt(st.total_count)}${esc(t("unit"))}</span><span class="m">${esc(money(st.total_amount))}</span><span class="m">${esc(t("addresses"))} ${fmtInt(st.addresses)}</span><span class="m">${esc(t("follow"))} ${fmtInt(st.followup_count)}</span>`;
    const byAmt = S.mode === "amount"; const cnt = (v) => String(Math.round(v));
    $("#tsTitle").textContent = byAmt ? t("daily_amount") : t("daily_count");
    columns($("#tsPlot"), st.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), weekend: isWeekend(d.day), v: byAmt ? d.amount : d.count, extra: byAmt ? `${d.count}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, $("#tsTitle").textContent, { width: 1280, height: 260 });
    const tA = st.total_amount || 1, tC = st.total_count || 1;
    const shareRows = (rows, key) => rows.map((r) => `<tr><td>${key(r)}</td><td class="num">${fmtInt(r.count)}</td><td class="num">${fmtPct(r.count / tC)}</td><td class="num">${money(r.amount)}</td><td class="num">${fmtPct(r.amount / tA)}</td><td class="num">${r.count ? money(r.amount / r.count) : "-"}</td></tr>`).join("");
    const head = (k) => `<thead><tr><th>${esc(k)}</th><th class="num">${esc(t("th_count"))}</th><th class="num">%</th><th class="num">${esc(t("th_amount"))}</th><th class="num">%</th><th class="num">avg</th></tr></thead>`;
    const foot = (rows) => { const n = rows.reduce((a, r) => a + r.count, 0), a = rows.reduce((x, r) => x + r.amount, 0); return `<tfoot><tr><td>Σ</td><td class="num">${fmtInt(n)}</td><td class="num">100%</td><td class="num">${money(a)}</td><td class="num">100%</td><td class="num">${n ? money(a / n) : "-"}</td></tr></tfoot>`; };
    const types = st.by_type.slice().sort((a, b) => b.count - a.count);
    $("#typeTable").innerHTML = head(t("type")) + `<tbody>${shareRows(types, (r) => `<span class="sw" style="background:${TYPE_COLOR[r.key] || "var(--t-other)"}"></span>${esc(typeName(r.key))}`)}</tbody>` + foot(types);
    $("#metaType").textContent = `${types.length}`;
    const chains = st.by_chain.slice().sort((a, b) => b.count - a.count);
    $("#chainTable").innerHTML = head(t("chain")) + `<tbody>${shareRows(chains, (r) => esc(r.key))}</tbody>` + foot(chains);
    $("#metaChain").textContent = `${chains.length}`;
    $("#dailyTable").innerHTML = `<thead><tr><th>${esc(t("day"))}</th><th class="num">${esc(t("count"))}</th><th class="num">${esc(t("new_label"))}</th><th class="num">${esc(t("legal"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>${st.daily.slice().reverse().map((d) => `<tr><td class="date">${esc(fmtDate(d.day))}</td><td class="num">${d.count}</td><td class="num">${d.new}</td><td class="num">${d.legal}</td><td class="num">${money(d.amount)}</td></tr>`).join("")}</tbody>`;
    $("#metaDaily").textContent = `${st.daily.length}d`;
    columns($("#legalPlot"), st.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.legal })), cnt, t("legal"), { height: 160 });
    const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]);
    hbars($("#rolesBars"), roles.map(([k, v]) => ({ k: roleName(k), v })), cnt, t("roles"));
    $("#metaLegal").textContent = `${t("legal")} Σ ${fmtInt(st.daily.reduce((a, d) => a + d.legal, 0))} · ${t("addresses")} Σ ${fmtInt(roles.reduce((a, r) => a + r[1], 0))}`;
  }
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { S.days = b.dataset.range; load(); }));
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; render(); }));
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; load(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; load(); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="card empty">API 오류: ${esc(e.message)}</div>`); });
})();
