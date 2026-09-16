/* 사건 상세 — incident.html?id=<uid> (API: /api/incidents/{uid}) */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, avatarColor, initials, explorer, pill, chainPills, gauge, detailUrl,
          api, renderNav, renderFoot, applyI18n, bindChrome, REPO, state } = KL;
  const id = new URLSearchParams(location.search).get("id");
  let meta = null, inc = null, roleFilter = "", showAll = false;
  const ADDR_LIMIT = 12;

  function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    const root = $("#detail");
    if (!inc) { root.innerHTML = `<div class="panel empty">${esc(t("not_found"))}</div>`; return; }
    document.title = `${inc.project} · Kloint Incident Monitor`;
    const d = dayOf(inc);
    const sec = (title, body) => body ? `<section class="d-card"><h3>${esc(title)}</h3><p>${esc(body)}</p></section>` : "";
    const fold = (title, body) => body ? `<details class="d-card fold"><summary>${esc(title)}</summary><p>${esc(body)}</p></details>` : "";
    const roles = [...new Set(inc.addresses.map((a) => a.role))];
    const addrAll = inc.addresses.filter((a) => !roleFilter || a.role === roleFilter);
    const addrShown = showAll ? addrAll : addrAll.slice(0, ADDR_LIMIT);
    const addrRows = addrShown.map((a) => {
      const url = explorer(a.chain, a.address); const bl = inc.blacklist_detail && inc.blacklist_detail[a.address];
      return `<tr><td class="muted mono">${esc(a.chain)}</td><td><span class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}</span><span class="addr-actions"><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button><a class="copy" href="addresses.html?q=${encodeURIComponent(a.address)}">⌕</a></span>${bl ? `<span class="tag warn">⚠ ${esc((bl.sources || []).slice(0, 2).join(", "))}</span>` : ""}</td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="muted small">${esc(a.note || "")}</td></tr>`;
    }).join("");
    const rel = inc.related || [];
    root.innerHTML = `
      <a class="crumb" href="incidents.html">← ${esc(t("back"))}</a>
      <header class="d-hero">
        <div class="d-hero-l">
          <div class="d-head"><div><span class="pill-glass"><span class="dot"></span>${esc(t("nav_incidents"))} · ${esc(inc.day)}</span></div>
            <div><h1 class="d-title">${esc(inc.project)}</h1>
              <div class="d-meta">${pill(inc)} ${chainPills(inc.chains, 2)} <span class="date">${esc(fmtDate(d))}</span>${inc.followup_of ? ` <span class="tag">↩ ${esc(t("follow"))}</span>` : ""}${inc.blacklist_hits ? ` <span class="tag warn">⚠ ${inc.blacklist_hits}</span>` : ""}</div></div></div>
          <div class="d-amount">${inc.amount_usd != null ? moneyFull(inc.amount_usd) : `<span class="muted">${esc(inc.amount_text || t("amount_unknown"))}</span>`}</div>
        </div>
        <div class="d-hero-r"><div class="d-conf" title="${esc(t("cross_desc"))}">${gauge(inc.sources.length)}<div class="small">${esc(t("sources"))}</div></div></div>
      </header>
      ${inc.followup_of ? `<div class="d-banner">↩ ${esc(t("follow"))} — ${esc(t("first_reported"))}: <a href="incident.html?id=${esc(inc.followup_of.uid)}">${esc(inc.followup_of.day)} · ${esc(inc.followup_of.project)}</a></div>` : ""}
      <div class="d-grid">
        <div class="d-main">
          ${sec(t("summary"), txt(inc, "summary"))}${fold(t("method"), txt(inc, "attack_method"))}${fold(t("background"), txt(inc, "background"))}${fold(t("flow"), txt(inc, "fund_flow"))}
          ${inc.addresses.length ? `<section class="d-card"><div class="d-card-head"><h3>${esc(t("addresses"))} <span class="muted">(${inc.addresses.length})</span></h3>
            <div class="seg small" id="roleSeg"><button data-role="" class="${roleFilter ? "" : "on"}" type="button">${esc(t("all_roles"))}</button>${roles.map((r) => `<button data-role="${esc(r)}" class="${roleFilter === r ? "on" : ""}" type="button">${esc(roleName(r))} ${inc.addresses.filter((a) => a.role === r).length}</button>`).join("")}</div></div>
            <div class="table-wrap"><table class="addrs">${addrRows}</table></div>${addrAll.length > ADDR_LIMIT ? `<div class="center" style="padding-top:12px"><button class="btn-ghost sm" id="moreAddr" type="button">${esc(showAll ? t("show_less") : t("show_more").replace("{n}", addrAll.length - ADDR_LIMIT))}</button></div>` : ""}</section>` : ""}
          ${inc.tx_hashes && inc.tx_hashes.length ? `<section class="d-card"><h3>${esc(t("tx"))} <span class="muted">(${inc.tx_hashes.length})</span></h3><p class="addr small">${inc.tx_hashes.map((h) => `<a href="https://etherscan.io/tx/${esc(h)}" target="_blank" rel="noopener">${esc(h)}</a>`).join("<br>")}</p></section>` : ""}
        </div>
        <aside class="d-side">
          <section class="d-card"><h3>${esc(t("facts"))}</h3><dl class="facts">
            <dt>${esc(t("type"))}</dt><dd>${esc(typeName(inc.type))}</dd><dt>${esc(t("chain"))}</dt><dd>${esc((inc.chains || []).join(", ") || "-")}</dd>
            <dt>${esc(t("incident_date"))}</dt><dd class="mono">${esc(fmtDate(inc.incident_date))}</dd><dt>${esc(t("report_date"))}</dt><dd class="mono">${esc(fmtDate(inc.day))}</dd>
            ${inc.actors && inc.actors.length ? `<dt>${esc(t("actors"))}</dt><dd>${esc(inc.actors.slice(0, 3).join(", "))}</dd>` : ""}</dl></section>
          <section class="d-card"><h3>${esc(t("sources"))} <span class="muted">(${inc.sources.length})</span></h3><div class="chips">${(() => { const seen = {}; return inc.sources.map((s) => { const l = srcLabel(s.source); seen[l] = (seen[l] || 0) + 1; return `<a class="chip" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || s.url)}">${esc(l)}${seen[l] > 1 ? ` <span class="muted">${seen[l]}</span>` : ""}</a>`; }).join(""); })()}<a class="chip ghost" href="${REPO}/blob/main/reports/${inc.day.slice(0, 7)}/${inc.day}.${state.lang}.md" target="_blank" rel="noopener">${esc(t("report"))}</a></div></section>
          ${rel.length ? `<section class="d-card"><h3>${esc(t("related"))}</h3><ul class="rel-list">${rel.map((o) => `<li><a href="${detailUrl(o)}" style="--type:${KL.TYPE_COLOR[o.type] || "var(--t-other)"}"><span class="rel-name">${esc(o.project)}</span><span class="mono muted small">${esc(fmtDate(o.incident_date || o.day))}</span><span class="mono">${esc(money(o.amount_usd))}</span></a></li>`).join("")}</ul></section>` : ""}
        </aside>
      </div>`;
    const heroEl = $(".d-hero", root); const tvar = (KL.TYPE_COLOR[inc.type] || "var(--t-other)").slice(4, -1);
    const tc = getComputedStyle(document.documentElement).getPropertyValue(tvar).trim() || "#34d399";
    KL.velaris(heroEl, { colors: KL.typeGradient(tc), speed: 1.1, grain: 0.22 });
    $$(".copy[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $$("#roleSeg button", root).forEach((b) => b.addEventListener("click", () => { roleFilter = b.dataset.role; showAll = false; render(); }));
    const mb = $("#moreAddr", root); if (mb) mb.addEventListener("click", () => { showAll = !showAll; render(); });
  }
  (async () => { meta = await api("/api/meta"); try { inc = await api(`/api/incidents/${encodeURIComponent(id)}`); } catch (_) { inc = null; } render(); })()
    .catch((e) => { $("#detail").innerHTML = `<div class="panel empty">${esc(e.message)}</div>`; });
})();
