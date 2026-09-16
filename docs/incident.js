/* 사건 상세 페이지 — incident.html?id=<uid>&d=<YYYY-MM-DD> */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, avatarColor, initials, explorer, pill, chainPills, gauge, detailUrl,
          fetchJson, applyI18n, bindChrome, bindTips, REPO, state } = KL;
  const params = new URLSearchParams(location.search);
  const id = params.get("id"), day = params.get("d") || "";
  let all = [], inc = null, roleFilter = "";

  async function load() {
    all = await fetchJson("data/incidents.json");
    inc = all.find((i) => i.uid === id);
    if (!inc && day) {
      try { const arch = await fetchJson(`data/archive/${day.slice(0, 7)}.json`); inc = arch.find((i) => i.uid === id); all = all.concat(arch.filter((a) => !all.some((b) => b.uid === a.uid))); } catch (_) {}
    }
    render();
  }

  const norm = (s) => (s || "").toLowerCase().replace(/\b(finance|protocol|network|labs|dao|exchange|the|amm|swap|bridge|chain|token|v\d)\b/g, "").replace(/[^a-z0-9가-힣]+/g, "");
  function related() {
    const key = norm(inc.project);
    const addrs = new Set(inc.addresses.map((a) => a.address.toLowerCase()));
    return all.filter((o) => o.uid !== inc.uid && (
      (key && key.length >= 3 && (norm(o.project) === key || norm(o.project).startsWith(key) || key.startsWith(norm(o.project)))) ||
      (o.followup_of && o.followup_of.uid === inc.uid) || (inc.followup_of && inc.followup_of.uid === o.uid) ||
      o.addresses.some((a) => addrs.has(a.address.toLowerCase()) && ["attacker", "laundering", "sanctioned"].includes(a.role))
    )).slice(0, 8);
  }

  function render() {
    applyI18n();
    const root = $("#detail");
    if (!inc) { root.innerHTML = `<div class="panel empty">${esc(t("not_found"))}</div>`; return; }
    document.title = `${inc.project} · Kloint Incident Monitor`;
    const d = dayOf(inc);
    const sec = (title, body) => body ? `<section class="d-card"><h3>${esc(title)}</h3><p>${esc(body)}</p></section>` : "";
    const roles = [...new Set(inc.addresses.map((a) => a.role))];
    const addrRows = inc.addresses.filter((a) => !roleFilter || a.role === roleFilter).map((a) => {
      const url = explorer(a.chain, a.address);
      return `<tr><td class="muted mono">${esc(a.chain)}</td><td><span class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(a.address)}</a>` : esc(a.address)}</span><button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button></td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="muted small">${esc(a.note || "")}</td></tr>`;
    }).join("");
    const rel = related();
    root.innerHTML = `
      <a class="crumb" href="./#hacks">← ${esc(t("back"))}</a>
      <header class="d-hero">
        <div class="d-hero-l">
          <div class="d-head">
            <span class="avatar lg" style="background:${avatarColor(inc.project)}">${esc(initials(inc.project))}</span>
            <div>
              <h1 class="d-title">${esc(inc.project)}</h1>
              <div class="d-meta">${pill(inc)} ${chainPills(inc.chains, 4)} <span class="date">${esc(fmtDate(d))}</span>${inc.followup_of ? ` <span class="tag">↩ ${esc(t("follow"))}</span>` : ""}${inc.blacklist_hits ? ` <span class="tag warn">⚠ ${esc(t("blacklist"))} ${inc.blacklist_hits}</span>` : ""}</div>
            </div>
          </div>
          <div class="d-amount">${inc.amount_usd != null ? moneyFull(inc.amount_usd) : `<span class="muted">${esc(t("amount_unknown"))}</span>`}${inc.amount_text ? `<div class="d-amount-text">${esc(inc.amount_text)}</div>` : ""}</div>
        </div>
        <div class="d-hero-r">
          <div class="d-conf" title="${esc(t("cross_desc"))}">${gauge(inc.sources.length)}<div class="small muted">${esc(t("cross_check"))} · ${esc(t("sources_n").replace("{n}", inc.sources.length))}</div></div>
        </div>
      </header>
      ${inc.followup_of ? `<div class="d-banner">↩ ${esc(t("follow"))} — ${esc(t("first_reported"))}: <a href="${esc(inc.followup_of.url || "#")}" target="_blank" rel="noopener">${esc(inc.followup_of.day)} · ${esc(inc.followup_of.project)}</a></div>` : ""}

      <div class="d-grid">
        <div class="d-main">
          ${sec(t("background"), txt(inc, "background"))}
          ${sec(t("method"), txt(inc, "attack_method"))}
          ${sec(t("summary"), txt(inc, "summary"))}
          ${sec(t("flow"), txt(inc, "fund_flow"))}
          ${inc.addresses.length ? `<section class="d-card">
            <div class="d-card-head"><h3>${esc(t("addresses"))} <span class="muted">(${inc.addresses.length})</span></h3>
              <div class="seg small" id="roleSeg"><button data-role="" class="${roleFilter ? "" : "on"}" type="button">${esc(t("all_roles"))}</button>${roles.map((r) => `<button data-role="${esc(r)}" class="${roleFilter === r ? "on" : ""}" type="button">${esc(roleName(r))} ${inc.addresses.filter((a) => a.role === r).length}</button>`).join("")}</div></div>
            <div class="table-wrap"><table class="addrs">${addrRows}</table></div></section>` : ""}
          ${inc.tx_hashes && inc.tx_hashes.length ? `<section class="d-card"><h3>${esc(t("tx"))} <span class="muted">(${inc.tx_hashes.length})</span></h3><p class="addr small">${inc.tx_hashes.map((h) => `<a href="https://etherscan.io/tx/${esc(h)}" target="_blank" rel="noopener">${esc(h)}</a>`).join("<br>")}</p></section>` : ""}
        </div>
        <aside class="d-side">
          <section class="d-card">
            <h3>${esc(t("facts"))}</h3>
            <dl class="facts">
              <dt>${esc(t("type"))}</dt><dd>${esc(typeName(inc.type))}</dd>
              <dt>${esc(t("chain"))}</dt><dd>${esc((inc.chains || []).join(", ") || "-")}</dd>
              <dt>${esc(t("incident_date"))}</dt><dd class="mono">${esc(fmtDate(inc.incident_date))}</dd>
              <dt>${esc(t("report_date"))}</dt><dd class="mono">${esc(fmtDate(inc.day))}</dd>
              <dt>${esc(t("loss_label"))}</dt><dd class="mono">${inc.amount_usd != null ? "$" + fmtInt(inc.amount_usd) : "-"}</dd>
              <dt>${esc(t("th_addr"))}</dt><dd class="mono">${inc.addresses.length}</dd>
              ${inc.actors && inc.actors.length ? `<dt>${esc(t("actors"))}</dt><dd>${esc(inc.actors.join(", "))}</dd>` : ""}
            </dl>
          </section>
          <section class="d-card">
            <h3>${esc(t("sources"))} <span class="muted">(${inc.sources.length})</span></h3>
            <ul class="src-list">${inc.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(srcLabel(s.source))}</b><span>${esc(s.title || s.url)}</span></a></li>`).join("")}
              <li><a href="${REPO}/blob/main/reports/${inc.day.slice(0, 7)}/${inc.day}.${state.lang}.md" target="_blank" rel="noopener"><b>GitHub</b><span>${esc(t("report"))}</span></a></li></ul>
          </section>
          ${rel.length ? `<section class="d-card"><h3>${esc(t("related"))}</h3><ul class="rel-list">${rel.map((o) => `<li><a href="${detailUrl(o)}"><span class="avatar sm" style="background:${avatarColor(o.project)}">${esc(initials(o.project))}</span><span class="rel-name">${esc(o.project)}</span><span class="mono muted small">${esc(fmtDate(dayOf(o)))}</span><span class="mono">${esc(money(o.amount_usd))}</span></a></li>`).join("")}</ul></section>` : ""}
          ${inc.tags && inc.tags.length ? `<section class="d-card"><h3>${esc(t("tags"))}</h3><div class="tags">${inc.tags.map((g) => `<span class="pill chain">${esc(g)}</span>`).join(" ")}</div></section>` : ""}
        </aside>
      </div>`;
    $$(".copy", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    $$("#roleSeg button", root).forEach((b) => b.addEventListener("click", () => { roleFilter = b.dataset.role; render(); }));
    bindTips(root);
  }

  bindChrome(render);
  load().catch((e) => { $("#detail").innerHTML = `<div class="panel empty">${esc(e.message)}</div>`; });
})();
