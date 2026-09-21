/* 사건 케이스 패널 (LUMOS 스타일): 헤더 → 큰 금액 → 핵심 값 2열 → 요약 → 경과 타임라인 → 자금 흐름(주소·tx 표) → 출처·관련 → 자세히
   KL.caseView(inc, {standalone}) → HTML, KL.bindCase(root, inc), KL.openCase(uid) (오른쪽 슬라이드 패널), 목록의 incident.html 링크는 패널로 가로챈다. */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, txt, explorer, txExplorer, stripAddr, kindName, chainPills, api, REPO, state, TYPE_COLOR } = KL;
  const PAGE = 6;
  const pageState = new Map(); // uid → { page, detail }

  const avatar = (i) => `<span class="avatar" style="--c:${TYPE_COLOR[i.type] || "var(--t-other)"}">${esc((i.project || i.title || "?").trim().charAt(0).toUpperCase())}</span>`;
  const badge = (label, color) => `<span class="badge"${color ? ` style="--c:${color}"` : ""}><span class="dot"></span>${esc(label)}</span>`;
  const shortText = (s, n) => { s = (s || "").trim(); if (!s) return ""; const cut = s.split(/(?<=[.。!?])\s|,|;|\(/)[0].trim(); return (cut.length > n ? cut.slice(0, n - 1) + "…" : cut); };
  const d10 = (s) => (s || "").slice(0, 10);

  function timeline(inc) {
    const rel = inc.related || [];
    const follow = rel.filter((o) => o.followup_of && o.followup_of.uid === inc.uid).sort((a, b) => (a.day > b.day ? 1 : -1));
    const blSrc = [...new Set(Object.values(inc.blacklist_detail || {}).flatMap((b) => b.sources || []))];
    const checked = inc.addresses.map((a) => a.checked_at || "").filter(Boolean).sort().pop();
    const eoa = inc.addresses.filter((a) => a.kind === "eoa" || a.kind === "wallet").length, ca = inc.addresses.filter((a) => a.kind === "contract").length;
    const first = d10(inc.published_at) || inc.day;
    const items = [
      { on: !!inc.incident_date, k: t("ev_occurred"), v: inc.incident_date ? fmtDate(inc.incident_date) : t("not_yet") },
      { on: true, k: t("ev_reported"), v: `${fmtDate(first)} · ${srcLabel(inc.source)}` },
      { on: follow.length > 0, k: t("ev_followup"), v: follow.length ? follow.map((o) => `<a href="incident.html?id=${esc(o.uid)}">${esc(fmtDate(o.day))}</a>`).join(" · ") : t("none") },
      { on: inc.blacklist_hits > 0, k: t("ev_blacklist"), v: inc.blacklist_hits ? `${fmtInt(inc.blacklist_hits)}${t("unit_addr")} · ${esc(blSrc.slice(0, 3).join(", "))}` : t("none") },
      { on: !!checked, k: t("ev_verified"), v: checked ? `${fmtDate(checked)} · EOA ${eoa} · CA ${ca}` : t("not_yet") },
    ];
    if (inc.followup_of) items.splice(1, 0, { on: true, k: t("ev_original"), v: `<a href="incident.html?id=${esc(inc.followup_of.uid)}">${esc(inc.followup_of.project || "")} · ${esc(fmtDate(inc.followup_of.day))}</a>` });
    return `<ol class="tl">${items.map((x) => `<li class="${x.on ? "on" : ""}"><b>${esc(x.k)}</b><span>${x.v}</span></li>`).join("")}</ol>`;
  }

  function flowTable(inc, page) {
    const primary = inc.chains[0] || "";
    const rows = inc.addresses.map((a) => ({ kind: "addr", a })).concat((inc.tx_hashes || []).map((h) => ({ kind: "tx", h })));
    const total = rows.length, pages = Math.max(1, Math.ceil(total / PAGE)); page = Math.min(Math.max(1, page), pages);
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    const body = slice.map((r) => {
      if (r.kind === "tx") { const url = txExplorer(primary, r.h); return `<tr><td class="addr" title="tx"><span class="mono">${esc(r.h)}</span><button class="icopy" data-copy="${esc(r.h)}" type="button" title="${esc(t("copy"))}">⧉</button></td><td><span class="kind other">TX</span></td><td class="faint">–</td><td class="num">${url ? `<a class="go" href="${url}" target="_blank" rel="noopener">↗</a>` : ""}</td></tr>`; }
      const a = r.a; const url = explorer(a.chain, a.address); const bl = inc.blacklist_detail && inc.blacklist_detail[a.address]; const k = kindName(a);
      return `<tr><td class="addr" title="${esc(stripAddr(a.note))}"><span class="mono">${esc(a.address)}</span><button class="icopy" data-copy="${esc(a.address)}" type="button" title="${esc(t("copy"))}">⧉</button>${bl ? `<span class="tag warn" title="${esc((bl.sources || []).join(", "))}">BL</span>` : ""}${a.label ? `<div class="faint small ell">${esc(a.label)}</div>` : ""}</td><td class="nowrap">${k ? `<span class="kind ${a.kind === "contract" ? "ca" : "eoa"}">${esc(k)}</span>` : '<span class="faint">–</span>'}</td><td class="nowrap"><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td class="num">${url ? `<a class="go" href="${url}" target="_blank" rel="noopener" title="${esc(a.chain)}">↗</a>` : `<span class="faint">${esc(a.chain)}</span>`}</td></tr>`;
    }).join("");
    const pager = total > PAGE ? `<div class="pager"><span>${(page - 1) * PAGE + 1}–${Math.min(total, page * PAGE)} / ${total}</span><button data-cpage="${page - 1}" type="button" ${page <= 1 ? "disabled" : ""}>‹</button><span>${page}/${pages}</span><button data-cpage="${page + 1}" type="button" ${page >= pages ? "disabled" : ""}>›</button></div>` : "";
    return `<div class="table-wrap"><table class="tbl case-tbl"><thead><tr><th>${esc(t("th_addr_tx"))}</th><th>${esc(t("th_kind"))}</th><th>${esc(t("addr_role"))}</th><th class="num">${esc(t("th_link"))}</th></tr></thead><tbody>${body || `<tr><td colspan="4" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody></table></div>${pager}`;
  }

  function caseView(inc, opts = {}) {
    const st = pageState.get(inc.uid) || { page: 1, detail: false }; pageState.set(inc.uid, st);
    const amountLbl = inc.legal ? t("k_legal") : t("loss_label");
    const STOP = /^(defihacklabs|latest news|news|crypto|암호화폐|가상자산|blockchain|defi|hack)$/i;
    const tag = (inc.tags || []).map((x) => String(x).trim()).find((x) => x && x.length <= 18 && !/^0x/.test(x) && !STOP.test(x));
    const method = tag || shortText(txt(inc, "attack_method"), 22);
    const eoa = inc.addresses.filter((a) => a.kind === "eoa" || a.kind === "wallet").length, ca = inc.addresses.filter((a) => a.kind === "contract").length;
    const roleCounts = ["attacker", "victim", "laundering", "sanctioned"].map((r) => [r, inc.addresses.filter((a) => a.role === r).length]).filter(([, n]) => n);
    const srcRows = inc.sources.map((s) => `<a class="case-row" href="${esc(s.url)}" target="_blank" rel="noopener"><span class="who">${esc(srcLabel(s.source))}</span><span class="what">${esc(s.title || s.url)}</span><span class="go">↗</span></a>`).join("")
      + `<a class="case-row" href="${REPO}/blob/main/reports/${inc.day.slice(0, 7)}/${inc.day}.${state.lang}.md" target="_blank" rel="noopener"><span class="who">GitHub</span><span class="what">${esc(t("report"))} · ${esc(fmtDate(inc.day))}</span><span class="go">↗</span></a>`;
    const rel = (inc.related || []).filter((o) => !(o.followup_of && o.followup_of.uid === inc.uid));
    const relRows = rel.map((o) => `<a class="case-row" href="incident.html?id=${esc(o.uid)}"><span class="who">${avatar(o)}${esc(o.project)}</span><span class="what">${esc(typeName(o.type))} · ${esc(fmtDate(o.day))}</span><span class="mono">${esc(money(o.amount_usd))}</span></a>`).join("");
    const more = [["method", t("method")], ["background", t("background")], ["fund_flow", t("flow")]].filter(([k]) => txt(inc, k === "method" ? "attack_method" : k));
    return `<div class="case" data-uid="${esc(inc.uid)}">
      <div class="case-h">
        <div class="case-id">${avatar(inc)}<div class="min0"><div class="case-name">${esc(inc.project)}</div><div class="case-sub">${badge(typeName(inc.type), TYPE_COLOR[inc.type] || "var(--t-other)")}${chainPills(inc.chains, 3)}${inc.followup_of ? `<span class="tag">${esc(t("follow"))}</span>` : ""}</div></div></div>
        <div class="case-actions">${opts.standalone ? "" : `<a class="btn" href="incident.html?id=${esc(inc.uid)}" title="${esc(t("open_page"))}">${esc(t("open_page"))}</a>`}<button class="btn primary" data-share type="button">${esc(t("share"))}</button>${opts.standalone ? "" : `<button class="case-close" data-close type="button" aria-label="close">×</button>`}</div>
      </div>
      <div class="case-amt">
        <div><div class="l">${esc(amountLbl)}</div><div class="v">${inc.amount_usd != null ? `<span class="cur">$</span>${fmtInt(inc.amount_usd)}` : `<span class="faint" style="font-size:18px">${esc(t("amount_unknown"))}</span>`}</div>${inc.amount_text && inc.amount_text.length <= 40 ? `<div class="s">${esc(inc.amount_text)}</div>` : ""}${inc.amount_revised_from ? `<div class="s">${esc(t("revised_from"))} ${moneyFull(inc.amount_revised_from)}</div>` : ""}</div>
        <div class="case-mini"><div><div class="l">${esc(t("addresses"))}</div><div class="v">${fmtInt(inc.addresses.length)}</div></div><div><div class="l">${esc(t("blacklist"))}</div><div class="v ${inc.blacklist_hits ? "up" : ""}">${fmtInt(inc.blacklist_hits)}</div></div></div>
      </div>
      <div class="case-kv">
        <div><span class="k">${esc(t("incident_date"))}</span><span class="val">${esc(fmtDate(inc.incident_date))}</span></div>
        <div><span class="k">${esc(t("case_code"))}</span><span class="val"><span class="code">${esc(inc.uid.slice(0, 8).toUpperCase())}</span></span></div>
        <div><span class="k">${esc(t("report_date"))}</span><span class="val">${esc(fmtDate(d10(inc.published_at) || inc.day))}</span></div>
        <div><span class="k">${esc(t("chain"))}</span><span class="val">${esc(inc.chains.join(", ") || "–")}</span></div>
        <div><span class="k">${esc(t("type"))}</span><span class="val" title="${esc(typeFull(inc.type))}">${badge(typeName(inc.type), TYPE_COLOR[inc.type] || "var(--t-other)")}</span></div>
        <div><span class="k">${esc(t("method_short"))}</span><span class="val" title="${esc(txt(inc, "attack_method") || "")}">${method ? `<span class="badge">${esc(method)}</span>` : "–"}</span></div>
      </div>
      ${txt(inc, "summary") ? `<section class="case-sec"><h3>${esc(t("summary"))}</h3><p class="prose">${esc(txt(inc, "summary"))}</p></section>` : ""}
      <section class="case-sec"><h3>${esc(t("case_timeline"))}</h3>${timeline(inc)}</section>
      <section class="case-sec"><h3>${esc(t("flow"))}<span class="meta">${roleCounts.map(([r, n]) => `${esc(roleName(r))} ${n}`).join(" · ")}${roleCounts.length ? " · " : ""}EOA ${eoa} · CA ${ca}${(inc.tx_hashes || []).length ? ` · TX ${inc.tx_hashes.length}` : ""}</span></h3><div class="case-flow">${flowTable(inc, st.page)}</div></section>
      <section class="case-sec"><h3>${esc(t("sources"))}<span class="meta">${inc.sources.length}</span></h3><div class="case-rows">${srcRows}</div></section>
      ${rel.length ? `<section class="case-sec"><h3>${esc(t("related"))}<span class="meta">${rel.length}</span></h3><div class="case-rows">${relRows}</div></section>` : ""}
      ${more.length ? `<section class="case-sec">${st.detail ? more.map(([k, lbl]) => `<h3>${esc(lbl)}</h3><p class="prose">${esc(txt(inc, k === "method" ? "attack_method" : k))}</p>`).join("") : ""}<div class="center"><button class="btn" data-detail type="button">${esc(st.detail ? t("show_less") : t("detail_more"))}</button></div></section>` : ""}
    </div>`;
  }

  function bindCase(root, inc, rerender) {
    const st = pageState.get(inc.uid);
    $$("[data-copy]", root).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "✓"; setTimeout(() => (b.textContent = "⧉"), 1200); } catch (_) {} }));
    $$("[data-cpage]", root).forEach((b) => b.addEventListener("click", () => { st.page = parseInt(b.dataset.cpage, 10); rerender(); }));
    const dt = $("[data-detail]", root); if (dt) dt.addEventListener("click", () => { st.detail = !st.detail; rerender(); });
    const sh = $("[data-share]", root); if (sh) sh.addEventListener("click", async () => { const u = `${location.origin}/incident.html?id=${encodeURIComponent(inc.uid)}`; try { await navigator.clipboard.writeText(u); sh.textContent = t("copied_link"); setTimeout(() => (sh.textContent = t("share")), 1500); } catch (_) {} });
  }

  // ---- 슬라이드 패널 ----
  let drawer = null, backdrop = null, current = null;
  function ensureDrawer() {
    if (drawer) return true;
    drawer = $("#caseDrawer"); backdrop = $("#caseBackdrop");
    if (!drawer || !backdrop) return false;
    backdrop.addEventListener("click", closeCase);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCase(); });
    return true;
  }
  function paint() {
    if (!current) return;
    drawer.innerHTML = caseView(current);
    bindCase(drawer, current, paint);
    const c = $("[data-close]", drawer); if (c) c.addEventListener("click", closeCase);
  }
  async function openCase(uid, push = true) {
    if (!ensureDrawer()) { location.href = `incident.html?id=${encodeURIComponent(uid)}`; return; }
    drawer.innerHTML = `<div class="empty">…</div>`; drawer.classList.add("open"); backdrop.classList.add("show"); document.body.classList.add("case-open");
    try { current = await api(`/api/incidents/${encodeURIComponent(uid)}`); } catch (e) { drawer.innerHTML = `<div class="empty">${esc(t("not_found"))}</div>`; return; }
    paint(); drawer.scrollTop = 0;
    if (push) { const u = new URL(location.href); u.searchParams.set("case", uid); history.pushState({ case: uid }, "", u); }
  }
  function closeCase() {
    if (!drawer) return;
    drawer.classList.remove("open"); backdrop.classList.remove("show"); document.body.classList.remove("case-open"); current = null;
    const u = new URL(location.href); if (u.searchParams.has("case")) { u.searchParams.delete("case"); history.pushState({}, "", u); }
  }
  // 목록의 incident.html 링크·행 클릭 → 패널 (새 탭 단축키는 그대로)
  document.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.target.closest('a[href^="incident.html?id="]');
    const tr = !a && e.target.closest("tr[data-href]");
    const href = a ? a.getAttribute("href") : tr ? tr.dataset.href : "";
    if (!href || !href.startsWith("incident.html?id=")) return;
    if (e.target.closest("a") && !a) return; // 행 안의 다른 링크(탐색기 등)
    if (!$("#caseDrawer")) return;
    e.preventDefault(); e.stopPropagation();
    openCase(decodeURIComponent(href.slice("incident.html?id=".length)));
  }, true);
  window.addEventListener("popstate", () => { const uid = new URLSearchParams(location.search).get("case"); if (uid) openCase(uid, false); else closeCase(); });
  const boot = new URLSearchParams(location.search).get("case"); if (boot) setTimeout(() => openCase(boot, false), 0);

  Object.assign(KL, { caseView, bindCase, openCase, closeCase, avatar });
})();
