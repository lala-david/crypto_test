/* 사건 목록: 서버 필터/페이지 */
(() => {
  "use strict";
  const { $, $$, t, typeName, srcLabel, esc, api, renderNav, renderFoot, applyI18n, bindChrome, incidentRow, TABLE_HEAD, bindRows, fillSelect } = KL;
  const S = { days: "30", type: "", chain: "", source: "", q: "", hide: false, sort: "day", page: 1, size: 20 };
  let meta = null, facets = null;
  const qs = new URLSearchParams(location.search);
  ["type", "chain", "source", "q", "days"].forEach((k) => { if (qs.get(k)) S[k] = qs.get(k); });

  async function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    $$("#rangeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.range === S.days));
    const res = await api("/api/incidents", { days: S.days, type: S.type, chain: S.chain, source: S.source, q: S.q, hide_followups: S.hide ? 1 : 0, page: S.page, size: S.size, sort: S.sort });
    if (!facets || !S.type && !S.chain && !S.source && !S.q) facets = res.facets;  // 필터 없을 때의 전체 분포를 선택지에 유지
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: `${typeName(v)} (${facets.types[v]})` })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: `${v} (${facets.chains[v]})` })), t("all_chains"), S.chain);
    fillSelect($("#sourceSel"), Object.keys(facets.sources).map((v) => ({ value: v, label: `${srcLabel(v)} (${facets.sources[v]})` })), t("all_sources"), S.source);
    $("#sortSel").innerHTML = [["day", t("sort_day")], ["date", t("sort_date")], ["amount", t("sort_amount")]].map(([v, l]) => `<option value="${v}"${S.sort === v ? " selected" : ""}>${esc(t("sort"))}: ${esc(l)}</option>`).join("");
    $("#incCount").textContent = res.total.toLocaleString();
    const tb = $("#incTable");
    tb.innerHTML = TABLE_HEAD() + `<tbody>${res.items.length ? res.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="7" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb);
    const pages = Math.max(1, Math.ceil(res.total / S.size));
    $("#pager").innerHTML = `<span>${res.total ? (S.page - 1) * S.size + 1 : 0}-${Math.min(res.total, S.page * S.size)} / ${res.total}</span>
      <button id="pgPrev" type="button" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page} / ${pages}</span><button id="pgNext" type="button" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; render(); }; $("#pgNext").onclick = () => { S.page++; render(); };
  }
  const reset = () => { S.page = 1; render(); };
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { S.days = b.dataset.range; reset(); }));
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; reset(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; reset(); });
  $("#sourceSel").addEventListener("change", (e) => { S.source = e.target.value; reset(); });
  $("#sortSel").addEventListener("change", (e) => { S.sort = e.target.value; reset(); });
  $("#hideFollow").addEventListener("change", (e) => { S.hide = e.target.checked; reset(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; reset(); }, 200); });
  if (S.q) $("#q").value = S.q;

  api("/api/meta").then((m) => { meta = m; return render(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)}</div>`); });
})();
