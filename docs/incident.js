/* 사건 상세: 숫자 헤더 · 요약/수법/배경/자금흐름(펼침) · 주소표(헤더·블랙리스트 열) · 출처(제목 포함) · 관련 */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, txt, explorer, txExplorer, stripAddr, isAddrLike, pill, chainPills, detailUrl, api, kindCell, labelCell, renderNav, renderFoot, applyI18n, bindChrome, REPO, sw, state, errorBox } = KL;
  const id = new URLSearchParams(location.search).get("id");
  const LIMIT = 12; let meta = null, inc = null, roleFilter = "", showAll = false, showDetail = false;

  function render() {
    renderNav("incidents.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    const root = $("#detail");
    if (!inc) { root.innerHTML = `<div class="card empty">${esc(t("not_found"))}</div>`; return; }
    document.title = `${inc.project} · Incident Ledger`;
    const sect = (title, body) => body ? `<section class="sect"><h3>${esc(title)}</h3><p class="prose">${esc(body)}</p></section>` : "";
    const roles = [...new Set(inc.addresses.map((a) => a.role))];
    const all = inc.addresses.filter((a) => !roleFilter || a.role === roleFilter); const shown = showAll ? all : all.slice(0, LIMIT);
    const primary = inc.chains[0] || "";
    const rows = shown.map((a) => { const url = explorer(a.chain, a.address); const bl = inc.blacklist_detail && inc.blacklist_detail[a.address]; const note = stripAddr(a.note);
      return `<tr><td class="mono muted">${esc(a.chain)}</td><td class="addr" title="${esc(note)}">${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}<span style="white-space:nowrap"><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button><a class="copy" href="addresses.html?q=${encodeURIComponent(a.address)}" title="${esc(t("nav_addresses"))}">⌕</a></span></td><td class="nowrap">${kindCell(a)}</td><td>${labelCell(a)}</td><td class="nowrap"><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td>${bl ? `<span class="tag warn" title="${esc((bl.sources || []).join(", "))}">BL</span>` : '<span class="faint">–</span>'}</td></tr>`; }).join("");
    const srcRows = inc.sources.map((s) => `<a class="chip" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || s.url)}">${esc(srcLabel(s.source))}</a>`).join("")
      + `<a class="chip" href="${REPO}/blob/main/reports/${inc.day.slice(0, 7)}/${inc.day}.${state.lang}.md" target="_blank" rel="noopener">GitHub</a>`;
    const actors = (inc.actors || []).filter((a) => !isAddrLike(a)).slice(0, 6);
    const rel = inc.related || [];
    root.innerHTML = `
      <a class="crumb" href="incidents.html">← ${esc(t("back"))}</a>
      <section class="card"><div class="card-b">
        <div class="d-head"><div><div class="d-title">${sw(inc.type)}${esc(inc.project)}</div>
          <div class="d-meta">${pill(inc)} ${chainPills(inc.chains, 3)}${inc.followup_of ? ` <span class="tag">${esc(t("follow"))} · <a href="incident.html?id=${esc(inc.followup_of.uid)}">${esc(fmtDate(inc.followup_of.day))}</a></span>` : ""}</div></div>
          <div class="d-amount"><span class="lbl">${esc(inc.legal ? t("k_legal") : t("loss_label"))}</span>${inc.amount_usd != null ? `<span class="cur">$</span>${fmtInt(inc.amount_usd)}` : `<span class="faint" style="font-size:16px">${esc(t("amount_unknown"))}</span>`}${inc.amount_text && inc.amount_text.length <= 40 ? `<span class="sub">${esc(inc.amount_text)}</span>` : ""}${inc.amount_revised_from ? `<span class="sub">${esc(t("revised_from"))} ${moneyFull(inc.amount_revised_from)}</span>` : ""}</div></div>
        </div>
        <div class="d-nums">
          <div><div class="l">${esc(t("incident_date"))}</div><div class="v">${esc(fmtDate(inc.incident_date))}</div></div>
          <div><div class="l">${esc(t("report_date"))}</div><div class="v">${esc(fmtDate(inc.day))}</div></div>
          <div><div class="l">${esc(t("addresses"))}</div><div class="v">${fmtInt(inc.addresses.length)}</div></div>
          <div><div class="l">${esc(t("blacklist"))}</div><div class="v ${inc.blacklist_hits ? "up" : ""}">${fmtInt(inc.blacklist_hits)}</div></div>
        </div></section>
      <section class="grid start">
        <div class="c8" style="display:grid;gap:12px;min-width:0">
          <div class="card">${sect(t("summary"), txt(inc, "summary"))}${showDetail ? sect(t("method"), txt(inc, "attack_method")) + sect(t("background"), txt(inc, "background")) + sect(t("flow"), txt(inc, "fund_flow")) : ""}${(txt(inc, "attack_method") || txt(inc, "background") || txt(inc, "fund_flow")) ? `<div class="pager" style="justify-content:center"><button class="btn" id="moreDetail" type="button" style="width:auto">${esc(showDetail ? t("show_less") : t("detail_more"))}</button></div>` : ""}</div>
          ${inc.addresses.length ? `<div class="card"><div class="card-h"><h2>${esc(t("addresses"))} <span class="meta">${inc.addresses.length}</span></h2><div class="seg" id="roleSeg"><button data-role="" class="${roleFilter ? "" : "on"}" type="button">${esc(t("all_roles"))}</button>${roles.map((r) => `<button data-role="${esc(r)}" class="${roleFilter === r ? "on" : ""}" type="button">${esc(roleName(r))} ${inc.addresses.filter((a) => a.role === r).length}</button>`).join("")}</div></div>
            <div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>${esc(t("chain"))}</th><th>${esc(t("addresses"))}</th><th>${esc(t("th_kind"))}</th><th>${esc(t("th_label"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("blacklist"))}</th></tr></thead><tbody>${rows}</tbody></table></div>${all.length > LIMIT ? `<div class="pager" style="justify-content:center"><button class="btn" id="moreAddr" type="button" style="width:auto">${esc(showAll ? t("show_less") : t("show_more").replace("{n}", all.length - LIMIT))}</button></div>` : ""}</div>` : ""}
          ${(inc.tx_hashes || []).length ? `<div class="card"><div class="card-h"><h2>${esc(t("tx"))} <span class="meta">${inc.tx_hashes.length}</span></h2></div><div class="card-b addr small">${inc.tx_hashes.map((h) => `<a href="${txExplorer(primary, h)}" target="_blank" rel="noopener">${esc(h)}</a>`).join("<br>")}</div></div>` : ""}
        </div>
        <div class="c4" style="display:grid;gap:12px;min-width:0;align-content:start">
          <div class="card"><div class="card-h"><h2>${esc(t("sources"))}</h2><span class="meta">${inc.sources.length}</span></div><div class="card-b chips">${srcRows}</div></div>
          ${actors.length ? `<div class="card"><div class="card-h"><h2>${esc(t("actors"))}</h2></div><div class="card-b chips">${actors.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div></div>` : ""}
          ${rel.length ? `<div class="card"><div class="card-h"><h2>${esc(t("related"))}</h2><span class="meta">${rel.length}</span></div><div class="card-b flush table-wrap"><table class="tbl">${rel.map((o) => `<tr class="link" data-href="${detailUrl(o)}"><td>${sw(o.type)}<a class="name" href="${detailUrl(o)}">${esc(o.project)}</a>${o.followup_of ? ` <span class="tag">${esc(t("follow"))}</span>` : ""}</td><td class="date">${esc(fmtDate(o.day))}</td><td class="num">${esc(money(o.amount_usd))}</td></tr>`).join("")}</table></div></div>` : ""}
        </div>
      </section>`;
    $$(".copy[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $$("#roleSeg button", root).forEach((b) => b.addEventListener("click", () => { roleFilter = b.dataset.role; showAll = false; render(); }));
    const mb = $("#moreAddr", root); if (mb) mb.addEventListener("click", () => { showAll = !showAll; render(); });
    const md = $("#moreDetail", root); if (md) md.addEventListener("click", () => { showDetail = !showDetail; render(); });
    KL.bindRows(root);
  }
  (async () => { meta = await api("/api/meta"); try { inc = await api(`/api/incidents/${encodeURIComponent(id)}`); } catch (_) { inc = null; } render(); })()
    .catch((e) => { $("#detail").innerHTML = errorBox(e); });
})();
