/* 주소 조회: /api/addresses/lookup */
(() => {
  "use strict";
  const { $, t, typeName, roleName, esc, money, fmtDate, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, detailUrl } = KL;
  let meta = null, res = null, q = new URLSearchParams(location.search).get("q") || "";

  function render() {
    renderNav("addresses.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    if (meta) $("#addrKpis").innerHTML = [[t("known_addresses"), meta.addresses_total], [t("sanctioned_addresses"), meta.sdn_addresses], [t("incidents_total"), meta.incidents_total], [t("days_covered"), meta.days]]
      .map(([l, v]) => `<div class="tile"><div class="label">${esc(l)}</div><div class="value">${Number(v || 0).toLocaleString()}</div></div>`).join("");
    const out = $("#result");
    if (!res) { out.innerHTML = ""; return; }
    if (!res.found) { out.innerHTML = `<div class="panel empty">${esc(t("addr_none"))} — <span class="mono">${esc(res.query)}</span></div>`; return; }
    let h = "";
    if (res.matches.length) {
      h += `<section class="panel"><div class="panel-head"><h2>${esc(t("addr_found_in"))} <span class="muted">(${res.matches.length})</span></h2></div>
        <div class="table-wrap"><table class="addrs wide"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("addresses"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("addr_incident"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>
        ${res.matches.map((m) => `<tr><td class="muted mono">${esc(m.chain)}</td><td><span class="addr">${explorer(m.chain, m.address) ? `<a href="${explorer(m.chain, m.address)}" target="_blank" rel="noopener">${esc(m.address)}</a>` : esc(m.address)}</span>${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ""}</td>
          <td><span class="role ${esc(m.role)}">${esc(roleName(m.role))}</span></td><td><a class="pname" href="${detailUrl(m.incident)}">${esc(m.incident.project)}</a><div class="small muted">${esc(typeName(m.incident.type))} · ${esc((m.incident.chains || []).join(", "))}</div></td>
          <td class="date">${esc(fmtDate(m.incident.incident_date || m.incident.day))}</td><td class="num mono">${esc(money(m.incident.amount_usd))}</td></tr>`).join("")}</tbody></table></div></section>`;
    }
    if (res.sdn.length) {
      h += `<section class="panel"><div class="panel-head"><h2>🛑 ${esc(t("addr_sdn"))} <span class="muted">(${res.sdn.length})</span></h2></div>
        <div class="table-wrap"><table class="addrs wide"><tbody>${res.sdn.map((s) => `<tr><td class="muted mono">${esc(s.chain)}</td><td class="addr">${esc(s.address)}</td><td><b>${esc(s.entity_name)}</b></td><td class="mono small">${esc(s.programs)}</td><td class="muted small mono">${esc((s.first_seen_at || "").slice(0, 10))}</td></tr>`).join("")}</tbody></table></div></section>`;
    }
    if (res.blacklist) {
      const b = res.blacklist;
      h += `<section class="panel"><div class="panel-head"><h2>⚠ ${esc(t("addr_bl"))}</h2></div><div class="panel-body tags">${(b.sources || []).map((s) => `<span class="pill">${esc(s)}</span>`).join("")}${(b.categories || []).map((s) => `<span class="pill chain">${esc(s)}</span>`).join("")}${(b.labels || []).map((s) => `<span class="pill chain">${esc(s)}</span>`).join("")}</div></section>`;
    }
    out.innerHTML = h;
  }
  async function lookup() {
    q = $("#q").value.trim();
    if (q.length < 6) { res = null; render(); return; }
    history.replaceState(null, "", `addresses.html?q=${encodeURIComponent(q)}`);
    try { res = await api("/api/addresses/lookup", { q }); } catch (e) { res = { found: false, query: q, matches: [], sdn: [] }; }
    render();
  }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
  let qT; $("#q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(lookup, 350); });
  api("/api/meta").then((m) => { meta = m; render(); if (q) { $("#q").value = q; lookup(); } }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)}</div>`); });
})();
