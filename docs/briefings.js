/* 브리핑 아카이브 (금액은 후속 제외) */
(() => {
  "use strict";
  const { $, $$, t, esc, fmtInt, money, moneyFull, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, mdToHtml, incidentRow, TABLE_HEAD, tableLegend, bindRows, errorBox, state: K } = KL;
  let meta = null, days = [], cur = null;
  const qs = new URLSearchParams(location.search);
  async function show(day) { cur = await api(`/api/briefings/${day}`); history.replaceState(null, "", `briefings.html?day=${day}`); render(); }
  function render() {
    renderNav("briefings.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    const totN = days.reduce((a, b) => a + (b.new || 0), 0), totA = days.reduce((a, b) => a + b.amount_usd, 0);
    $("#sub").innerHTML = `<span class="m">${esc(t("collected_days").replace("{n}", days.length))}</span><span class="m">${esc(t("new_label"))} ${fmtInt(totN)}${esc(t("unit"))}</span><span class="m" title="${moneyFull(totA)}">${esc(t("total_amount").replace("{v}", money(totA)))}</span>`;
    $("#metaDays").textContent = `${days.length}`;
    const shortHead = (b) => (b[`headline_${K.lang}`] || b.headline_ko || "").replace(/^(\d+월 \d+일 브리핑|[A-Z][a-z]{2} \d+ briefing)\s*·\s*/, "");
    const mxA = Math.max(...days.map((b) => b.amount_usd || 0), 1);
    $("#dayList").innerHTML = days.map((b) => `<li class="${cur && cur.day === b.day ? "on" : ""}" data-day="${b.day}"><div class="dl-top"><b>${fmtDate(b.day)}</b><span class="dl-amt">${esc(money(b.amount_usd))}</span></div><div class="dl-bar"><i style="width:${((b.amount_usd || 0) / mxA * 100).toFixed(1)}%"></i></div><div class="dl-sub"><span>${esc(t("new_label"))} ${fmtInt(b.new)}</span>${b.followups ? `<span>${esc(t("follow"))} ${fmtInt(b.followups)}</span>` : ""}</div></li>`).join("");
    $$("#dayList li").forEach((li) => li.addEventListener("click", () => show(li.dataset.day)));
    if (!cur) return;
    $("#briefTitle").textContent = `${t("briefing")} · ${fmtDate(cur.day)}`;
    $("#briefMeta").textContent = "";
    $("#briefHeadline").textContent = cur[`headline_${K.lang}`] || cur.headline_ko;
    $("#briefBody").innerHTML = mdToHtml(cur[`briefing_${K.lang}`] || cur.briefing_ko);
    $("#metaDay").textContent = `${cur.incidents.length}${t("unit")}`;
    const tb = $("#dayTable"); tb.innerHTML = TABLE_HEAD() + `<tbody>${cur.incidents.map((i) => incidentRow(i)).join("")}</tbody>`; bindRows(tb);
  }
  (async () => { meta = await api("/api/meta"); days = await api("/api/briefings"); if (days.length) await show(qs.get("day") && days.some((d) => d.day === qs.get("day")) ? qs.get("day") : days[0].day); else render(); })()
    .catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
