/* 주소 조회 */
(() => {
  "use strict";
  const { $, t, typeName, roleName, esc, fmtInt, money, fmtDate, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, detailUrl, statCard, errorBox } = KL;
  let meta = null, res = null, q = new URLSearchParams(location.search).get("q") || "";
  function render() {
    renderNav("addresses.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    if (meta) $("#kpis").innerHTML = [[t("known_addresses"), meta.addresses_total], [t("sanctioned_addresses"), meta.sdn_addresses], [t("incidents_total"), meta.new_total || meta.incidents_total], [t("days_covered"), meta.days]]
      .map(([l, v]) => statCard(l, fmtInt(v), `<span class="faint">${esc(t("all"))}</span>`, null).replace('class="card stat ', 'class="card stat c3 ')).join("");
    const out = $("#result");
    if (!res) { out.innerHTML = ""; return; }
    if (!res.found) { out.innerHTML = `<div class="card empty c12">${esc(t("addr_none"))} · <span class="mono">${esc(res.query)}</span></div>`; return; }
    let h = "";
    if (res.matches.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_found_in"))}</h2><span class="meta">${res.matches.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("addresses"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>${
      res.matches.map((m) => `<tr><td class="mono muted">${esc(m.chain)}</td><td class="addr">${explorer(m.chain, m.address) ? `<a href="${explorer(m.chain, m.address)}" target="_blank" rel="noopener">${esc(m.address)}</a>` : esc(m.address)}${m.note ? `<div class="faint small">${esc(KL.stripAddr(m.note))}</div>` : ""}</td><td><span class="role ${esc(m.role)}">${esc(roleName(m.role))}</span></td><td><a class="name" href="${detailUrl(m.incident)}">${esc(m.incident.project)}</a>${m.incident.followup_of ? ` <span class="tag">${esc(t("follow"))}</span>` : ""}<div class="faint small">${esc(typeName(m.incident.type))} · ${esc((m.incident.chains || []).join(", "))}</div></td><td class="date">${esc(fmtDate(m.incident.incident_date || m.incident.day))}</td><td class="num">${esc(money(m.incident.amount_usd))}</td></tr>`).join("")}</tbody></table></div></div>`;
    if (res.sdn.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_sdn"))}</h2><span class="meta">${res.sdn.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("addresses"))}</th><th>${esc(t("th_entity"))}</th><th>${esc(t("th_programs"))}</th><th>${esc(t("th_first_seen"))}</th></tr></thead><tbody>${res.sdn.map((s) => `<tr><td class="mono muted">${esc(s.chain)}</td><td class="addr">${esc(s.address)}</td><td class="name">${esc(s.entity_name)}</td><td class="mono small">${esc(s.programs)}</td><td class="date">${esc((s.first_seen_at || "").slice(0, 10))}</td></tr>`).join("")}</tbody></table></div></div>`;
    if (res.blacklist) { const b = res.blacklist; h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_bl"))}</h2></div><div class="card-b chips">${[...(b.sources || []), ...(b.categories || []), ...(b.labels || [])].map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>`; }
    out.innerHTML = h;
  }
  async function lookup() { q = $("#q").value.trim(); if (q.length < 6) { res = null; render(); return; } history.replaceState(null, "", `addresses.html?q=${encodeURIComponent(q)}`);
    try { res = await api("/api/addresses/lookup", { q }); } catch (e) { res = { found: false, query: q, matches: [], sdn: [] }; } render(); }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
  let qT; $("#q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(lookup, 350); });
  api("/api/meta").then((m) => { meta = m; render(); if (q) { $("#q").value = q; lookup(); } }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
