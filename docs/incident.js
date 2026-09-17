/* 사건 상세: 숫자 헤더 · 요약 · 접힌 서술 · 주소표 · 개요 · 출처 · 관련 */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, explorer, pill, chainPills, detailUrl, api, renderNav, renderFoot, applyI18n, bindChrome, REPO, TYPE_COLOR, state } = KL;
  const id = new URLSearchParams(location.search).get("id");
  const LIMIT = 12; let meta = null, inc = null, roleFilter = "", showAll = false;

  function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    const root = $("#detail");
    if (!inc) { root.innerHTML = `<div class="card empty">${esc(t("not_found"))}</div>`; return; }
    document.title = `${inc.project} · Incident Ledger`;
    const fold = (title, body, open) => body ? `<details class="fold" ${open ? "open" : ""}><summary>${esc(title)}</summary><p class="prose">${esc(body)}</p></details>` : "";
    const roles = [...new Set(inc.addresses.map((a) => a.role))];
    const all = inc.addresses.filter((a) => !roleFilter || a.role === roleFilter); const shown = showAll ? all : all.slice(0, LIMIT);
    const rows = shown.map((a) => { const url = explorer(a.chain, a.address); const bl = inc.blacklist_detail && inc.blacklist_detail[a.address];
      return `<tr><td class="mono muted">${esc(a.chain)}</td><td class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}<span style="white-space:nowrap"><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button><a class="copy" href="addresses.html?q=${encodeURIComponent(a.address)}">⌕</a></span>${bl ? `<span class="tag warn">⚠ ${esc((bl.sources || []).slice(0, 2).join(", "))}</span>` : ""}</td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="faint small">${esc(a.note || "")}</td></tr>`; }).join("");
    const seen = {};
    const chips = inc.sources.map((s) => { const l = srcLabel(s.source); seen[l] = (seen[l] || 0) + 1; return `<a class="chip" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || s.url)}">${esc(l)}${seen[l] > 1 ? ` ${seen[l]}` : ""}</a>`; }).join("")
      + `<a class="chip" href="${REPO}/blob/main/reports/${inc.day.slice(0, 7)}/${inc.day}.${state.lang}.md" target="_blank" rel="noopener">${esc(t("report"))}</a>`;
    const rel = inc.related || [];
    root.innerHTML = `
      <a class="crumb" href="incidents.html">← ${esc(t("back"))}</a>
      <section class="card"><div class="card-b">
        <div class="d-head"><div><div class="d-title"><span class="sw" style="background:${TYPE_COLOR[inc.type] || "var(--t-other)"}"></span>${esc(inc.project)}</div>
          <div class="d-meta">${pill(inc)} ${chainPills(inc.chains, 3)} <span class="date">${esc(fmtDate(dayOf(inc)))}</span>${inc.followup_of ? ` <span class="tag">↩ ${esc(t("follow"))} <a href="incident.html?id=${esc(inc.followup_of.uid)}">${esc(inc.followup_of.day)}</a></span>` : ""}</div></div>
          <div class="d-amount">${inc.amount_usd != null ? `<span class="cur">$</span>${fmtInt(inc.amount_usd)}` : `<span class="faint" style="font-size:14px">${esc(inc.amount_text || t("amount_unknown"))}</span>`}</div></div>
        </div>
        <div class="d-nums">
          <div><div class="l">${esc(t("incident_date"))}</div><div class="v">${esc(inc.incident_date || "-")}</div></div>
          <div><div class="l">${esc(t("report_date"))}</div><div class="v">${esc(inc.day)}</div></div>
          <div><div class="l">${esc(t("addresses"))}</div><div class="v">${fmtInt(inc.addresses.length)}</div></div>
          <div><div class="l">${esc(t("sources"))}</div><div class="v">${fmtInt(inc.sources.length)}</div></div>
          <div><div class="l">${esc(t("tx"))}</div><div class="v">${fmtInt((inc.tx_hashes || []).length)}</div></div>
          <div><div class="l">${esc(t("blacklist"))}</div><div class="v ${inc.blacklist_hits ? "up" : ""}">${fmtInt(inc.blacklist_hits)}</div></div>
        </div></section>
      <section class="grid">
        <div class="c8" style="display:grid;gap:12px;min-width:0">
          <div class="card">${fold(t("summary"), txt(inc, "summary"), true)}${fold(t("method"), txt(inc, "attack_method"))}${fold(t("background"), txt(inc, "background"))}${fold(t("flow"), txt(inc, "fund_flow"))}</div>
          ${inc.addresses.length ? `<div class="card"><div class="card-h"><h2>${esc(t("addresses"))} <span class="meta">${inc.addresses.length}</span></h2><div class="seg" id="roleSeg"><button data-role="" class="${roleFilter ? "" : "on"}" type="button">${esc(t("all_roles"))}</button>${roles.map((r) => `<button data-role="${esc(r)}" class="${roleFilter === r ? "on" : ""}" type="button">${esc(roleName(r))} ${inc.addresses.filter((a) => a.role === r).length}</button>`).join("")}</div></div>
            <div class="card-b flush table-wrap"><table class="tbl">${rows}</table></div>${all.length > LIMIT ? `<div class="pager" style="justify-content:center"><button class="btn" id="moreAddr" type="button" style="width:auto">${esc(showAll ? t("show_less") : t("show_more").replace("{n}", all.length - LIMIT))}</button></div>` : ""}</div>` : ""}
          ${(inc.tx_hashes || []).length ? `<div class="card"><div class="card-h"><h2>${esc(t("tx"))} <span class="meta">${inc.tx_hashes.length}</span></h2></div><div class="card-b addr small">${inc.tx_hashes.map((h) => `<a href="https://etherscan.io/tx/${esc(h)}" target="_blank" rel="noopener">${esc(h)}</a>`).join("<br>")}</div></div>` : ""}
        </div>
        <div class="c4" style="display:grid;gap:12px;min-width:0;align-content:start">
          <div class="card"><div class="card-h"><h2>${esc(t("sources"))}</h2><span class="meta">${inc.sources.length}</span></div><div class="card-b chips">${chips}</div></div>
          ${inc.actors && inc.actors.length ? `<div class="card"><div class="card-h"><h2>${esc(t("actors"))}</h2></div><div class="card-b chips">${inc.actors.slice(0, 6).map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div></div>` : ""}
          ${rel.length ? `<div class="card"><div class="card-h"><h2>${esc(t("related"))}</h2><span class="meta">${rel.length}</span></div><div class="card-b flush table-wrap"><table class="tbl">${rel.map((o) => `<tr class="link" data-href="${detailUrl(o)}"><td><span class="sw" style="background:${TYPE_COLOR[o.type] || "var(--t-other)"}"></span><a class="name" href="${detailUrl(o)}">${esc(o.project)}</a></td><td class="date">${esc(fmtDate(o.incident_date || o.day))}</td><td class="num">${esc(money(o.amount_usd))}</td></tr>`).join("")}</table></div></div>` : ""}
        </div>
      </section>`;
    $$(".copy[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $$("#roleSeg button", root).forEach((b) => b.addEventListener("click", () => { roleFilter = b.dataset.role; showAll = false; render(); }));
    const mb = $("#moreAddr", root); if (mb) mb.addEventListener("click", () => { showAll = !showAll; render(); });
    KL.bindRows(root);
  }
  (async () => { meta = await api("/api/meta"); try { inc = await api(`/api/incidents/${encodeURIComponent(id)}`); } catch (_) { inc = null; } render(); })()
    .catch((e) => { $("#detail").innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
})();
