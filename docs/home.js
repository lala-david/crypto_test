/* 개요(간결판): 지표 4 · 일별 피해액 · 유형 비중 · 최근 수집 주소 · 금액 상위 5 · 최근 사건 · 최신 브리핑 */
(() => {
  "use strict";
  const { $, t, typeName, typeFull, roleName, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, fmtMD, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, basisSeg, columns, donut, statCard, incidentRow, TABLE_HEAD, tableLegend, bindRows, mdToHtml, typeColorHex, sw, errorBox, state: K } = KL;
  const S = { days: "30", basis: "event" };
  let D = null;

  async function load() {
    const meta = await api("/api/meta");
    const [cur, recent, addrs, briefs] = await Promise.all([
      api("/api/stats", { days: S.days, basis: S.basis }),
      api("/api/incidents", { days: S.days, size: 8, basis: S.basis, sort: S.basis === "event" ? "date" : "day" }),
      api("/api/addresses", { days: S.days, basis: S.basis, size: 60 }),
      api("/api/briefings"),
    ]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, cur, recent: recent.items, addrs, brief };
    render();
  }
  const shortAddr = (a) => (a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a);

  let render = function () {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(() => render());
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    basisSeg($("#basisSeg"), S.basis, (v) => { S.basis = v; load(); });
    const basisLbl = S.basis === "event" ? t("basis_event") : t("basis_collected");
    const c = D.cur, daily = c.daily, last14 = daily.slice(-14);
    const rangeLbl = S.days === "all" ? t("all") : t("days_n").replace("{n}", S.days);
    $("#sub").innerHTML = `<span>${esc(fmtDate(c.range.from))} – ${esc(fmtDate(c.range.to))}</span><span class="m">${esc(basisLbl)}</span>`;
    $("#stats").innerHTML = [
      statCard(`${t("k_new")} · ${rangeLbl}`, fmtInt(c.new_count), `<span class="faint">${esc(t("follow"))} ${fmtInt(c.followup_count)}</span>`, last14.map((d) => d.new)),
      statCard(`${t("k_loss")} · ${rangeLbl}`, money(c.loss_amount), `<span class="faint">${esc(t("k_unknown_amt"))} ${fmtInt(c.unknown_amount_count)}${esc(t("unit"))}</span>`, last14.map((d) => d.amount), { title: moneyFull(c.loss_amount) }),
      statCard(`${t("k_legal")} · ${rangeLbl}`, money(c.legal_amount), `<span class="faint">${fmtInt(c.legal_count)}${esc(t("unit"))}</span>`, last14.map((d) => d.legal), { title: moneyFull(c.legal_amount) }),
      statCard(`${t("k_addr")} · ${rangeLbl}`, fmtInt(D.addrs.total), `<span class="faint">${esc(roleName("attacker"))} ${fmtInt(D.addrs.roles.attacker || 0)} · ${esc(roleName("sanctioned"))} ${fmtInt(D.addrs.roles.sanctioned || 0)}</span>`, last14.map((d) => d.addresses || 0)),
    ].map((h) => h.replace('class="card stat ', 'class="card stat c3 ')).join("");
    columns($("#plotAmt"), daily.map((d) => ({ label: fmtMD(d.day), v: d.amount, extra: `${d.count}${t("unit")}` })), money, t("daily_amount"));
    const peak = daily.reduce((a, d) => (d.amount > a.amount ? d : a), { amount: 0 });
    $("#metaAmt").textContent = `${basisLbl} · ${t("peak")} ${money(peak.amount)}${peak.day ? " (" + fmtMD(peak.day) + ")" : ""}`;
    const byType = c.by_type.filter((x) => x.new).sort((a, b) => b.new - a.new);
    donut($("#donutType"), byType.map((x) => ({ k: typeName(x.key), v: x.new, color: typeColorHex(x.key), title: typeFull(x.key) })), fmtInt(c.new_count), t("new_label"));
    $("#metaType").textContent = t("basis_new");
    // 최근 수집 주소 (제재·공격자·세탁 우선)
    const pri = { sanctioned: 0, attacker: 1, laundering: 2, victim: 3, unknown: 4 };
    const addrs = D.addrs.items.filter((a) => a.role !== "unknown").sort((a, b) => (b.first_day > a.first_day ? 1 : b.first_day < a.first_day ? -1 : pri[a.role] - pri[b.role])).slice(0, 10);
    $("#addrTable").innerHTML = `<thead><tr><th>${esc(t("th_address"))}</th><th>${esc(t("chain"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_date"))}</th></tr></thead><tbody>${
      addrs.map((a) => { const i = a.incidents[0]; const url = explorer(a.chain, a.address);
        return `<tr><td class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener" title="${esc(a.address)}">${esc(shortAddr(a.address))}</a>` : `<span title="${esc(a.address)}">${esc(shortAddr(a.address))}</span>`}<button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button>${a.blacklist ? `<span class="tag warn">BL</span>` : ""}</td><td class="mono muted">${esc(a.chain)}</td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td>${sw(i.type)}<a class="name" href="incident.html?id=${esc(i.uid)}">${esc(i.project)}</a>${a.incidents.length > 1 ? ` <span class="faint small">+${a.incidents.length - 1}</span>` : ""}</td><td class="date">${esc(fmtDate(i.event_date || i.day))}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    $$(".copy[data-copy]", $("#addrTable")).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
    // 금액 상위 5
    const top = (c.top || []).slice(0, 5); const tot = c.total_amount || 1;
    $("#topTable").innerHTML = `<thead><tr><th class="rank">${esc(t("th_rank"))}</th><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th class="num">${esc(t("th_share"))}</th></tr></thead><tbody>${
      top.map((x, k) => `<tr class="link" data-href="incident.html?id=${esc(x.uid)}"><td class="rank ${k < 3 ? "top" : ""}">${k + 1}</td><td>${sw(x.type)}<a class="name" href="incident.html?id=${esc(x.uid)}">${esc(x.project)}</a><div class="faint small">${esc(typeName(x.type))} · ${esc(fmtDate(x.event_date || x.day))}</div></td><td class="num">${moneyFull(x.amount_usd)}</td><td class="num">${fmtPct(x.amount_usd / tot)}</td></tr>`).join("")}</tbody>`;
    bindRows($("#topTable"));
    const tb = $("#recentTable"); tb.innerHTML = TABLE_HEAD(true) + `<tbody>${D.recent.map((i) => incidentRow(i, true)).join("")}</tbody>`; bindRows(tb);
    $("#recentLegend").innerHTML = tableLegend();
    if (D.brief) { $("#briefHeadline").textContent = D.brief[`headline_${K.lang}`] || D.brief.headline_ko; $("#briefBody").innerHTML = mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko); }
    else { $("#briefHeadline").textContent = ""; $("#briefBody").innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; }
  };
  const $$ = KL.$$;
  // ---- 상단 배너: 21st.dev "All about the Benjamins" ASCII/디더 효과 ----
  // 소스 = 검정 바탕 + 왼쪽 초상(docs/hero.jpg, 없으면 생략) + 오른쪽 이번 기간 피해액(흰 굵은 글자 → 디더 후 픽셀 글자로 읽힘)
  let fxInst = null, heroImg = null, heroTried = false;
  const FX_PARAMS = { renderMode: "dither", bgMode: "solid", cellSize: 9, coverage: 96, charSet: "binary", contrast: 115, edgeEmphasis: 40, tint: "#00ff66", tintOpacity: 45, overlayBlend: "overlay",
    pfx: { vignette: { enabled: true, intensity: 38 }, scanLines: { enabled: true, intensity: 28 }, chromatic: { enabled: true, intensity: 40 }, bloom: { enabled: true, intensity: 60 }, filmGrain: { enabled: true, intensity: 40 }, glitch: { enabled: true, intensity: 20 } },
    animated: true, animStyle: "flicker", animSpeed: { enabled: true, intensity: 100 }, animIntensity: { enabled: true, intensity: 60 } };
  function heroSource(ctx, w, h) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    let x0 = 0;
    if (heroImg && w > h * 2.6) { // 초상: 왼쪽에 높이 맞춤, 오른쪽 가장자리는 검정으로 페이드
      ctx.drawImage(heroImg, 0, 0, h, h);
      const g = ctx.createLinearGradient(h * 0.78, 0, h, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "#000");
      ctx.fillStyle = g; ctx.fillRect(h * 0.78, 0, h * 0.22, h);
      x0 = h;
    }
    const big = money(D.cur.loss_amount);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    let size = Math.round(h * 0.5); ctx.font = `800 ${size}px Inter, "Noto Sans KR", sans-serif`;
    const left = x0 + h * 0.16, avail = w - left - w * 0.03; const tw = ctx.measureText(big).width;
    if (tw > avail) { size = Math.max(24, Math.floor(size * avail / tw)); ctx.font = `800 ${size}px Inter, "Noto Sans KR", sans-serif`; }
    ctx.fillText(big, left, h * 0.5);
  }
  function initFx() {
    const cv = $("#fx"); if (!cv || !KL.ascii) return;
    if (!fxInst) fxInst = KL.ascii(cv, { params: FX_PARAMS, source: heroSource }); else fxInst.setSource(heroSource);
    if (!heroTried) { heroTried = true; const img = new Image(); img.onload = () => { heroImg = img; fxInst.setSource(heroSource); }; img.src = "hero.jpg"; }
    $("#fxPill").textContent = `${fmtDate(D.cur.range.from)} – ${fmtDate(D.cur.range.to)} · ${t("k_loss")} ${money(D.cur.loss_amount)} · ${t("k_new")} ${fmtInt(D.cur.new_count)}`;
  }
  const _render = render; render = function () { _render(); initFx(); };
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
