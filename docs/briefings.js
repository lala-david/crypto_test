/* 브리핑 아카이브 */
(() => {
  "use strict";
  const { $, $$, t, esc, money, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, mdToHtml, incidentRow, TABLE_HEAD, bindRows, state: K } = KL;
  let meta = null, days = [], cur = null;
  const qs = new URLSearchParams(location.search);

  async function show(day) {
    cur = await api(`/api/briefings/${day}`);
    history.replaceState(null, "", `briefings.html?day=${day}`);
    render();
  }
  function render() {
    renderNav("briefings.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    $("#dayList").innerHTML = days.map((b) => `<li class="${cur && cur.day === b.day ? "on" : ""}" data-day="${b.day}"><b class="mono">${fmtDate(b.day)}</b><span>${esc(b[`headline_${K.lang}`] || b.headline_ko)}</span></li>`).join("");
    $$("#dayList li").forEach((li) => li.addEventListener("click", () => show(li.dataset.day)));
    if (!cur) return;
    $("#briefTitle").textContent = fmtDate(cur.day);
    $("#briefMeta").textContent = `${cur.relevant}${t("unit")} · ${money(cur.amount_usd)}`;
    $("#briefingHeadline").textContent = cur[`headline_${K.lang}`] || cur.headline_ko;
    $("#briefingBody").innerHTML = mdToHtml(cur[`briefing_${K.lang}`] || cur.briefing_ko);
    const tb = $("#dayTable"); tb.innerHTML = TABLE_HEAD(true) + `<tbody>${cur.incidents.map((i) => incidentRow(i, true)).join("")}</tbody>`; bindRows(tb);
  }
  (async () => {
    meta = await api("/api/meta"); days = await api("/api/briefings");
    if (days.length) await show(qs.get("day") && days.some((d) => d.day === qs.get("day")) ? qs.get("day") : days[0].day); else render();
  })().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)}</div>`); });
})();
