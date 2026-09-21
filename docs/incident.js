/* 사건 상세(단독 페이지): case.js 의 케이스 패널을 그대로 그린다 */
(() => {
  "use strict";
  const { $, t, esc, api, renderNav, renderFoot, applyI18n, bindChrome, errorBox } = KL;
  const id = new URLSearchParams(location.search).get("id");
  let meta = null, inc = null;
  function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    const root = $("#detail");
    if (!inc) { root.innerHTML = `<div class="card empty">${esc(t("not_found"))}</div>`; return; }
    document.title = `${inc.project} · Incident Ledger`;
    root.innerHTML = `<a class="crumb" href="incidents.html">← ${esc(t("back"))}</a><div style="height:10px"></div>` + KL.caseView(inc, { standalone: true });
    KL.bindCase(root, inc, render);
  }
  (async () => { meta = await api("/api/meta"); try { inc = await api(`/api/incidents/${encodeURIComponent(id)}`); } catch (_) { inc = null; } render(); })()
    .catch((e) => { $("#detail").innerHTML = errorBox(e); });
})();
