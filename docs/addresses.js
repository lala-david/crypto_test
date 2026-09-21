/* 지갑 주소: 수집 주소 목록(기간·역할·체인 필터) + 주소 조회(사건 카드·OFAC SDN·블랙리스트) */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, esc, fmtInt, money, fmtDate, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, fillSelect, sw, errorBox } = KL;
  const S = { days: "30", role: "", chain: "", page: 1, size: 50 };
  let meta = null, res = null, list = null, q = new URLSearchParams(location.search).get("q") || "";
  const ROLES = ["", "sanctioned", "attacker", "laundering", "victim", "unknown"];

  async function loadList() { list = await api("/api/addresses", { days: S.days, role: S.role, chain: S.chain, page: S.page, size: S.size }); render(); }
  function bindCopy(root) { $$(".copy[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} })); }
  function addrCell(a) { const url = explorer(a.chain, a.address); return `<span class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}</span><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button>${a.blacklist ? `<span class="tag warn" title="${esc(t("legend_bl"))}">BL</span>` : ""}`; }

  function render() {
    renderNav("addresses.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; S.page = 1; loadList(); });
    $("#roleSeg").innerHTML = ROLES.map((r) => `<button data-role="${r}" class="${S.role === r ? "on" : ""}" type="button">${esc(r ? roleName(r) : t("role_all"))}${list && r && list.roles[r] ? ` <span class="faint">${list.roles[r]}</span>` : ""}</button>`).join("");
    $$("#roleSeg button").forEach((b) => b.addEventListener("click", () => { S.role = b.dataset.role; S.page = 1; loadList(); }));
    if (list) fillSelect($("#chainSel"), Object.keys(list.chains).map((v) => ({ value: v, label: `${v} (${list.chains[v]})` })), t("all_chains"), S.chain);
    $("#sub").textContent = t("addr_list_hint");
    // 조회 결과
    const out = $("#result");
    if (!res) out.innerHTML = "";
    else if (!res.found) out.innerHTML = `<div class="card empty c12">${esc(t("addr_none"))} · <span class="mono">${esc(res.query)}</span></div>`;
    else {
      let h = "";
      if (res.matches.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("lookup_title"))} · ${esc(t("addr_found_in"))}</h2><span class="meta">${res.matches.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("th_address"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>${
        res.matches.map((m) => `<tr><td class="mono muted">${esc(m.chain)}</td><td>${addrCell({ ...m, blacklist: false })}${m.note ? `<div class="faint small">${esc(KL.stripAddr(m.note))}</div>` : ""}</td><td><span class="role ${esc(m.role)}">${esc(roleName(m.role))}</span></td><td>${sw(m.incident.type)}<a class="name" href="incident.html?id=${esc(m.incident.uid)}">${esc(m.incident.project)}</a></td><td class="date">${esc(fmtDate(m.incident.event_date || m.incident.incident_date || m.incident.day))}</td><td class="num">${esc(money(m.incident.amount_usd))}</td></tr>`).join("")}</tbody></table></div></div>`;
      if (res.sdn.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_sdn"))}</h2><span class="meta">${res.sdn.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("th_address"))}</th><th>${esc(t("th_entity"))}</th><th>${esc(t("th_programs"))}</th><th>${esc(t("th_first_seen"))}</th></tr></thead><tbody>${res.sdn.map((s) => `<tr><td class="mono muted">${esc(s.chain)}</td><td class="addr">${esc(s.address)}</td><td class="name">${esc(s.entity_name)}</td><td class="mono small">${esc(s.programs)}</td><td class="date">${esc((s.first_seen_at || "").slice(0, 10))}</td></tr>`).join("")}</tbody></table></div></div>`;
      if (res.blacklist) { const b = res.blacklist; h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_bl"))}</h2></div><div class="card-b chips">${[...(b.sources || []), ...(b.categories || []), ...(b.labels || [])].map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>`; }
      out.innerHTML = h;
      bindCopy(out);
    }
    // 목록
    if (!list) return;
    $("#metaList").textContent = `${fmtInt(list.total)}`;
    const tb = $("#addrTable");
    tb.innerHTML = `<thead><tr><th>${esc(t("th_address"))}</th><th>${esc(t("chain"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_date"))}</th><th>${esc(t("note"))}</th></tr></thead><tbody>${
      list.items.map((a) => { const i = a.incidents[0]; return `<tr><td>${addrCell(a)}</td><td class="mono muted">${esc(a.chain)}</td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td>${sw(i.type)}<a class="name" href="incident.html?id=${esc(i.uid)}">${esc(i.project)}</a>${a.incidents.length > 1 ? ` <span class="faint small" title="${esc(a.incidents.slice(1).map((x) => x.project).join(", "))}">+${a.incidents.length - 1}</span>` : ""}</td><td>${esc(typeName(i.type))}</td><td class="date">${esc(fmtDate(i.event_date || i.day))}</td><td class="faint small">${esc(KL.stripAddr(a.note)).slice(0, 60)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindCopy(tb);
    const pages = Math.max(1, Math.ceil(list.total / S.size));
    $("#pager").innerHTML = `<span>${list.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(list.total, S.page * S.size)} / ${list.total}</span><button id="pgPrev" type="button" aria-label="${esc(t("a_prev"))}" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" aria-label="${esc(t("a_next"))}" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; loadList(); }; $("#pgNext").onclick = () => { S.page++; loadList(); };
  }
  async function lookup() { q = $("#q").value.trim(); if (q.length < 6) { res = null; render(); return; } history.replaceState(null, "", `addresses.html?q=${encodeURIComponent(q)}`);
    try { res = await api("/api/addresses/lookup", { q }); } catch (e) { res = { found: false, query: q, matches: [], sdn: [] }; } render(); }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
  let qT; $("#q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(lookup, 350); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; S.page = 1; loadList(); });
  api("/api/meta").then((m) => { meta = m; return loadList(); }).then(() => { if (q) { $("#q").value = q; lookup(); } }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
