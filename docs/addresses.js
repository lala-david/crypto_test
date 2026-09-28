/* 지갑 주소: 수집 주소 목록(기간·역할·체인 필터) + 주소 조회(사건 카드·OFAC SDN·블랙리스트) */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, esc, fmtInt, money, fmtDate, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, fillSelect, sw, errorBox, kindCell, labelCell, txCell } = KL;
  const S = { days: "30", role: "", chain: "", kind: "", sort: "", dir: "", page: 1, size: 50 };
  let meta = null, res = null, list = null, q = new URLSearchParams(location.search).get("q") || "";
  const ROLES = ["", "sanctioned", "attacker", "laundering", "victim", "unknown"];

  async function loadList() { list = await api("/api/addresses", { days: S.days, role: S.role, chain: S.chain, kind: S.kind, sort: S.sort, dir: S.dir, page: S.page, size: S.size }); render(); }
  function bindCopy(root) { $$(".copy[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} })); }
  function addrCell(a) { const url = explorer(a.chain, a.address); const sh = esc(KL.shortAddr(a.address)); return `<span class="addr short" data-tip="${esc(a.address)}">${url ? `<a href="${url}" target="_blank" rel="noopener">${sh}</a>` : sh}</span><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button>${a.blacklist ? `<span class="tag warn" title="${esc(t("legend_bl"))}">BL</span>` : ""}`; }

  function render() {
    renderNav("addresses.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; S.page = 1; loadList(); });
    $("#roleSeg").innerHTML = "";
    const tiles = $("#roleTiles");
    if (tiles && list) {
      const total = Object.values(list.roles || {}).reduce((a, b) => a + b, 0);
      tiles.innerHTML = [["", total], ...ROLES.filter(Boolean).map((r) => [r, list.roles[r] || 0])].map(([r, n]) => `<button class="rtile ${r || "all"} ${S.role === r ? "on" : ""}" data-role="${r}" type="button"><span class="ic">${r ? KL.roleIcon(r) : KL.roleIcon("unknown").replace("unknown", "")}</span><b data-countup="${n}">0</b><span class="l">${esc(r ? roleName(r) : t("role_all"))}</span></button>`).join("");
      $$("button", tiles).forEach((b) => b.addEventListener("click", () => { S.role = b.dataset.role; S.page = 1; loadList(); }));
      KL.countUpAll(tiles);
    }
    $("#sub").textContent = "";
    // 조회 결과
    const out = $("#result");
    if (!res) out.innerHTML = "";
    else if (!res.found) out.innerHTML = `<div class="card empty c12">${esc(t("addr_none"))} · <span class="mono">${esc(res.query)}</span></div>`;
    else {
      let h = "";
      if (res.matches.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("lookup_title"))} · ${esc(t("addr_found_in"))}</h2><span class="meta">${res.matches.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("th_address"))}</th><th>${esc(t("th_kind"))}</th><th>${esc(t("th_label"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("amount"))}</th></tr></thead><tbody>${
        res.matches.map((m) => `<tr><td class="nowrap">${KL.chainPill(m.chain)}</td><td>${addrCell({ ...m, blacklist: false })}</td><td class="nowrap">${kindCell(m)}</td><td>${labelCell(m)}</td><td class="nowrap">${KL.roleBadge(m.role)}</td><td>${KL.avatar(m.incident, "sm")}<a class="name" href="incident.html?id=${esc(m.incident.uid)}">${esc(m.incident.project)}</a></td><td class="date">${esc(fmtDate(m.incident.event_date || m.incident.incident_date || m.incident.day))}</td><td class="num">${esc(money(m.incident.amount_usd))}</td></tr>`).join("")}</tbody></table></div></div>`;
      if (res.sdn.length) h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_sdn"))}</h2><span class="meta">${res.sdn.length}</span></div><div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("th_address"))}</th><th>${esc(t("th_entity"))}</th><th>${esc(t("th_programs"))}</th><th>${esc(t("th_first_seen"))}</th></tr></thead><tbody>${res.sdn.map((s) => `<tr><td class="mono muted">${esc(s.chain)}</td><td class="addr">${esc(s.address)}</td><td class="name">${esc(s.entity_name)}</td><td class="mono small">${esc(s.programs)}</td><td class="date">${esc((s.first_seen_at || "").slice(0, 10))}</td></tr>`).join("")}</tbody></table></div></div>`;
      if (res.blacklist) { const b = res.blacklist; h += `<div class="card c12"><div class="card-h"><h2>${esc(t("addr_bl"))}</h2></div><div class="card-b chips">${[...(b.sources || []), ...(b.categories || []), ...(b.labels || [])].map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>`; }
      out.innerHTML = h;
      bindCopy(out);
    }
    // 목록
    if (!list) return;
    $("#metaList").textContent = `${fmtInt(list.total)}`;
    const tb = $("#addrTable");
    const km = t("kinds_map") || {};
    const ctl = { sort: { key: S.sort, dir: S.dir }, filters: { chain: S.chain, kind: S.kind, role: S.role },
      options: { chain: KL.optsChain(list.chains), kind: Object.entries(list.kinds || {}).map(([v, n]) => ({ value: v, label: km[v] || v, n })),
        role: ROLES.filter(Boolean).map((r) => ({ value: r, label: roleName(r), n: list.roles[r] || 0, icon: `<span class="oi role-ic ${r}">${KL.roleIcon(r)}</span>` })) },
      onSort: (k, d) => { S.sort = k; S.dir = d; S.page = 1; loadList(); }, onFilter: (k, v) => { S[k] = v; S.page = 1; loadList(); } };
    tb.innerHTML = `<colgroup><col class="a-addr"><col class="a-chain"><col class="a-kind"><col class="a-label"><col class="a-role"><col class="a-inc"><col class="a-tx"></colgroup><thead><tr>${KL.thSort(ctl, "address", t("th_address"), t("th_address_tip"))}${KL.thFilter(ctl, "chain", t("chain"), t("tip_chain"))}${KL.thFilter(ctl, "kind", t("th_kind"), t("th_kind_tip"))}${KL.thSort(ctl, "label", t("th_label"), t("th_label_tip"))}${KL.thFilter(ctl, "role", t("addr_role"), t("th_role_tip"))}${KL.thSort(ctl, "incident", t("th_incident"), t("tip_incident"))}${KL.thSort(ctl, "tx", t("th_tx"), t("th_tx_tip"), "num")}</tr></thead><tbody>${
      list.items.map((a) => { const i = a.incidents[0]; return `<tr><td class="nowrap" title="${esc(KL.stripAddr(a.note))}">${addrCell(a)}</td><td class="nowrap">${KL.chainPill(a.chain)}</td><td class="nowrap">${kindCell(a)}</td><td>${labelCell(a)}</td><td class="nowrap">${KL.roleBadge(a.role)}</td><td class="nowrap">${KL.avatar(i, "sm")}<a class="name" href="incident.html?id=${esc(i.uid)}" title="${esc(typeName(i.type))} · ${esc(fmtDate(i.event_date || i.day))}">${esc(i.project)}</a>${a.incidents.length > 1 ? ` <span class="faint small" title="${esc(a.incidents.slice(1).map((x) => x.project).join(", "))}">+${a.incidents.length - 1}</span>` : ""}</td><td class="num">${txCell(a)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindCopy(tb); KL.bindHead(tb, ctl);
    const pages = Math.max(1, Math.ceil(list.total / S.size));
    $("#pager").innerHTML = `<span>${list.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(list.total, S.page * S.size)} / ${list.total}</span><button id="pgPrev" type="button" aria-label="${esc(t("a_prev"))}" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" aria-label="${esc(t("a_next"))}" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; loadList(); }; $("#pgNext").onclick = () => { S.page++; loadList(); };
  }
  async function lookup() { q = $("#q").value.trim(); if (q.length < 6) { res = null; render(); return; } history.replaceState(null, "", `addresses.html?q=${encodeURIComponent(q)}`);
    try { res = await api("/api/addresses/lookup", { q }); } catch (e) { res = { found: false, query: q, matches: [], sdn: [] }; } render(); }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); lookup(); });
  let qT; $("#q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(lookup, 350); });
  api("/api/meta").then((m) => { meta = m; return loadList(); }).then(() => { if (q) { $("#q").value = q; lookup(); } }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
