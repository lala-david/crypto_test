/* 사건 목록: 서버 필터/정렬/페이지 */
(() => {
  "use strict";
  const { $, t, typeName, srcLabel, esc, fmtInt, money, moneyFull, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, incidentRow, TABLE_HEAD, tableLegend, bindRows, bindHead, optsType, optsChain, errorBox } = KL;
  const S = { days: "30", type: "", chain: "", source: "", q: "", hide: false, sort: "date", dir: "desc", page: 1, size: 25 };
  let meta = null, facets = null;
  const qs = new URLSearchParams(location.search);
  ["type", "chain", "source", "q", "days"].forEach((k) => { if (qs.get(k)) S[k] = qs.get(k); });

  async function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; reset(); });
    const res = await api("/api/incidents", { days: S.days, type: S.type, chain: S.chain, source: S.source, q: S.q, hide_followups: S.hide ? 1 : 0, page: S.page, size: S.size, sort: S.sort, dir: S.dir, basis: S.sort === "day" ? "collected" : "event" });
    if (!facets || (!S.type && !S.chain && !S.source && !S.q)) facets = res.facets;
    const ctl = { sort: { key: S.sort, dir: S.dir }, filters: { type: S.type, chain: S.chain }, options: { type: optsType(facets.types), chain: optsChain(facets.chains) },
      onSort: (k, d) => { S.sort = k; S.dir = d; reset(); }, onFilter: (k, v) => { S[k] = v; reset(); } };
    $("#sub").innerHTML = `<span class="m">${esc(t("page_total").replace("{n}", fmtInt(res.total)))}</span>${res.followup_total ? `<span class="m">${esc(t("follow_n").replace("{n}", fmtInt(res.followup_total)))}</span>` : ""}<span class="m" title="${moneyFull(res.amount_total)}">${esc(t("total_amount").replace("{v}", money(res.amount_total)))}</span>`;
    const tb = $("#incTable");
    tb.innerHTML = TABLE_HEAD(false, ctl) + `<tbody>${res.items.length ? res.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="6" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb); bindHead(tb, ctl);
    const pages = Math.max(1, Math.ceil(res.total / S.size));
    $("#pager").innerHTML = `<span>${res.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(res.total, S.page * S.size)} / ${res.total}</span><button id="pgPrev" type="button" aria-label="${esc(t("a_prev"))}" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" aria-label="${esc(t("a_next"))}" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; render(); }; $("#pgNext").onclick = () => { S.page++; render(); };
  }
  const reset = () => { S.page = 1; render(); };
  $("#hideFollow").addEventListener("change", (e) => { S.hide = e.target.checked; reset(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; reset(); }, 200); });
  if (S.q) $("#q").value = S.q;
  api("/api/meta").then((m) => { meta = m; return render(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
