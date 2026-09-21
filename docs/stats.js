/* 통계: 기간·유형·체인 필터 → 시계열 + 유형/체인 표(신규 기준) + 일별 표 + 제재·수사 + 주소 역할 */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, columns, hbars, fillSelect, sw, chainName, errorBox } = KL;
  const S = { days: "30", mode: "amount" };
  let meta = null, st = null;

  async function load() { st = await api("/api/stats", { days: S.days }); render(); }
  function render() {
    renderNav("stats.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    $$("#valueMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
    $("#sub").innerHTML = `<span>${esc(fmtDate(st.range.from))} – ${esc(fmtDate(st.range.to))}</span><span class="m">${esc(t("new_label"))} ${fmtInt(st.new_count)}${esc(t("unit"))}</span><span class="m">${esc(t("follow"))} ${fmtInt(st.followup_count)}</span><span class="m" title="${moneyFull(st.total_amount)}">${esc(money(st.total_amount))}</span>`;
    const byAmt = S.mode === "amount"; const cnt = (v) => String(Math.round(v));
    $("#tsTitle").textContent = byAmt ? t("daily_amount") : t("daily_count");
    columns($("#tsPlot"), st.daily.map((d) => ({ label: fmtMD(d.day), v: byAmt ? d.amount : d.count, extra: byAmt ? `${d.count}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, $("#tsTitle").textContent, { height: 240 });
    const rows = (list, key) => { const n = list.reduce((a, r) => a + r.new, 0) || 1;
      return `<tbody>${list.map((r) => `<tr><td>${key(r)}</td><td class="num">${fmtInt(r.new)}</td><td class="num">${fmtPct(r.new / n)}</td><td class="num">${r.known ? money(r.amount) : '<span class="faint">–</span>'}</td></tr>`).join("")}</tbody>`; };
    const head = (k) => `<thead><tr><th>${esc(k)}</th><th class="num">${esc(t("th_new"))}</th><th class="num">${esc(t("th_share"))}</th><th class="num">${esc(t("th_amount"))}</th></tr></thead>`;
    const types = st.by_type.filter((r) => r.new).sort((a, b) => b.new - a.new);
    $("#typeTable").innerHTML = head(t("type")) + rows(types, (r) => `<span title="${esc(typeFull(r.key))}">${sw(r.key)}${esc(typeName(r.key))}</span>`);
    $("#metaType").textContent = `${types.length}`;
    const chainsAll = st.by_chain.filter((r) => r.new).sort((a, b) => b.new - a.new);
    const TOP = 8; const chains = chainsAll.slice(0, TOP);
    if (chainsAll.length > TOP) { const rest = chainsAll.slice(TOP); chains.push({ key: `${t("other")} (${rest.length})`, new: rest.reduce((a, r) => a + r.new, 0), known: rest.reduce((a, r) => a + r.known, 0), amount: rest.reduce((a, r) => a + r.amount, 0), _other: true }); }
    $("#chainTable").innerHTML = head(t("chain")) + rows(chains, (r) => esc(r._other ? r.key : chainName(r.key)));
    $("#metaChain").textContent = `${chainsAll.filter((r) => r.key !== "unknown").length}`;
    const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
    hbars($("#rolesBars"), roles.map(([k, v]) => ({ k: roleName(k), v, pct: v / rt })), cnt, t("roles"));
    $("#metaRoles").textContent = `${fmtInt(st.addresses)} ${t("addresses")}`;
  }
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; render(); }));
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
