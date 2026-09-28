/* 사건 목록: 서버 필터/정렬/페이지 */
(() => {
  "use strict";
  const { $, t, typeName, srcLabel, esc, fmtInt, money, moneyFull, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, incidentRow, TABLE_HEAD, tableLegend, bindRows, fillSelect, errorBox } = KL;
  const S = { days: "30", type: "", chain: "", source: "", q: "", hide: false, sort: "date", page: 1, size: 25 };
  let meta = null, facets = null;
  const qs = new URLSearchParams(location.search);
  ["type", "chain", "source", "q", "days"].forEach((k) => { if (qs.get(k)) S[k] = qs.get(k); });

  async function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; reset(); });
    const res = await api("/api/incidents", { days: S.days, type: S.type, chain: S.chain, source: S.source, q: S.q, hide_followups: S.hide ? 1 : 0, page: S.page, size: S.size, sort: S.sort, basis: S.sort === "day" ? "collected" : "event" });
    if (!facets || (!S.type && !S.chain && !S.source && !S.q)) facets = res.facets;
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: `${typeName(v)} (${facets.types[v]})` })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: `${v} (${facets.chains[v]})` })), t("all_chains"), S.chain);
    $("#sortSel").innerHTML = [["date", t("sort_date")], ["day", t("sort_day")], ["amount", t("sort_amount")]].map(([v, l]) => `<option value="${v}"${S.sort === v ? " selected" : ""}>${esc(t("sort"))}: ${esc(l)}</option>`).join("");
    $("#sub").innerHTML = `<span class="m">${esc(t("page_total").replace("{n}", fmtInt(res.total)))}</span>${res.followup_total ? `<span class="m">${esc(t("follow_n").replace("{n}", fmtInt(res.followup_total)))}</span>` : ""}<span class="m" title="${moneyFull(res.amount_total)}">${esc(t("total_amount").replace("{v}", money(res.amount_total)))}</span>`;
    const tb = $("#incTable");
    tb.innerHTML = TABLE_HEAD() + `<tbody>${res.items.length ? res.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="6" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb);
    const pages = Math.max(1, Math.ceil(res.total / S.size));
    $("#pager").innerHTML = `<span>${res.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(res.total, S.page * S.size)} / ${res.total}</span><button id="pgPrev" type="button" aria-label="${esc(t("a_prev"))}" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" aria-label="${esc(t("a_next"))}" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; render(); }; $("#pgNext").onclick = () => { S.page++; render(); };
  }
  const reset = () => { S.page = 1; render(); };
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; reset(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; reset(); });
  $("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; reset(); });
  $("#hideFollow").addEventListener("change", (e) => { S.hide = e.target.checked; reset(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; reset(); }, 200); });
  if (S.q) $("#q").value = S.q;
  api("/api/meta").then((m) => { meta = m; return render(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
