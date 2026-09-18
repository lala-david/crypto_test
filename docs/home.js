/* 개요: 지표 6 · 일별 건수/금액 · 유형/대표 체인 비중 · 주소 역할 · 금액 상위 10 · 출처별 사건 · 최근 사건 · 최신 브리핑 */
(() => {
  "use strict";
  const { $, t, typeName, typeFull, roleName, srcLabel, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, basisSeg, columns, hbars, donut, statCard, incidentRow, TABLE_HEAD, tableLegend, bindRows, mdToHtml, typeColorHex, chainName, sw, errorBox, state: K } = KL;
  const S = { days: "30", basis: "event" };
  let D = null;

  async function load() {
    const meta = await api("/api/meta");
    const n = S.days === "all" ? null : +S.days;
    const last = new Date(meta.last_day + "T00:00:00");
    const iso = (d) => d.toISOString().slice(0, 10);
    const prevQ = n ? { from: iso(new Date(last.getTime() - (2 * n - 1) * 864e5)), to: iso(new Date(last.getTime() - n * 864e5)) } : null;
    const [cur, prev, today, recent, briefs] = await Promise.all([
      api("/api/stats", { days: S.days, basis: S.basis }), prevQ ? api("/api/stats", { ...prevQ, basis: S.basis }) : Promise.resolve(null),
      api("/api/stats", { from: meta.last_day, to: meta.last_day, basis: "collected" }), api("/api/incidents", { days: S.days, size: 10, basis: S.basis, sort: S.basis === "event" ? "date" : "day" }), api("/api/briefings"),
    ]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, cur, prev, today, recent: recent.items, facets: recent.facets, brief };
    render();
  }
  const delta = (cur, prev, key) => {
    // 이전 기간에 사건이 5건 미만이면 비율이 무의미하므로 표시하지 않는다
    if (!prev || !prev.collected_days || !prev[key] || (prev.new_count || 0) < 5) return `<span class="faint">${esc(t("vs_prev"))}: -</span>`;
    const r = (cur - prev[key]) / prev[key];
    return `<span class="chip ${r > 0 ? "up" : r < 0 ? "down" : ""}">${r > 0 ? "▲" : r < 0 ? "▼" : "="} ${Math.abs(r * 100).toFixed(0)}%</span><span class="faint">${esc(t("vs_prev"))}</span>`;
  };

  function render() {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    basisSeg($("#basisSeg"), S.basis, (v) => { S.basis = v; load(); });
    const basisLbl = S.basis === "event" ? t("basis_event") : t("basis_collected");
    const c = D.cur, p = D.prev ? { ...D.prev, collected_days: D.prev.range.collected_days } : null, daily = c.daily, last14 = daily.slice(-14);
    const rangeLbl = S.days === "all" ? t("all") : t("days_n").replace("{n}", S.days);
    $("#sub").innerHTML = `<span>${esc(fmtDate(c.range.from))} – ${esc(fmtDate(c.range.to))}</span><span class="m">${esc(basisLbl)}</span>`;
    const cnt = (v) => String(Math.round(v));
    $("#stats").innerHTML = [
      statCard(`${t("k_latest_new")} · ${fmtMD(D.meta.last_day)}`, fmtInt(D.today.new_count), `<span class="faint">${esc(t("follow"))} ${fmtInt(D.today.followup_count)}</span>`, last14.map((d) => d.new), { title: t("basis_collected") }),
      statCard(`${t("k_new")} · ${rangeLbl}`, fmtInt(c.new_count), delta(c.new_count, p, "new_count"), last14.map((d) => d.new)),
      statCard(`${t("k_follow")} · ${rangeLbl}`, fmtInt(c.followup_count), `<span class="faint">${esc(t("all"))} ${fmtInt(c.total_count)}${esc(t("unit"))}</span>`, last14.map((d) => d.count - d.new)),
      statCard(`${t("k_loss")} · ${rangeLbl}`, money(c.loss_amount), delta(c.loss_amount, p, "loss_amount"), last14.map((d) => d.amount), { title: moneyFull(c.loss_amount) }),
      statCard(`${t("k_legal")} · ${rangeLbl}`, money(c.legal_amount), `<span class="faint">${fmtInt(c.legal_count)}${esc(t("unit"))}</span>`, last14.map((d) => d.legal), { title: moneyFull(c.legal_amount) }),
      statCard(`${t("k_addr")} · ${rangeLbl}`, fmtInt(c.addresses), `<span class="faint">${esc(t("k_unknown_amt"))} ${fmtInt(c.unknown_amount_count)}${esc(t("unit"))}</span>`, last14.map((d) => d.addresses || 0)),
    ].map((h) => h.replace('class="card stat ', 'class="card stat c2 ')).join("");
    // 일별 (수집일 기준)
    const bucket = (d, v, extra) => ({ label: fmtMD(d.day), v, extra });
    columns($("#plotCount"), daily.map((d) => bucket(d, d.count, `${t("new_label")} ${d.new}`)), cnt, t("daily_count"));
    $("#metaCount").textContent = `${basisLbl} · ${t("daily_avg")} ${(c.total_count / Math.max(1, c.range.collected_days)).toFixed(1)}`;
    columns($("#plotAmt"), daily.map((d) => bucket(d, d.amount, `${d.count}${t("unit")}`)), money, t("daily_amount"));
    const peak = daily.reduce((a, d) => (d.amount > a.amount ? d : a), { amount: 0 });
    $("#metaAmt").textContent = `${basisLbl} · ${t("peak")} ${money(peak.amount)}${peak.day ? " (" + fmtMD(peak.day) + ")" : ""}`;
    // 비중 (신규 기준)
    const byType = c.by_type.filter((x) => x.new).sort((a, b) => b.new - a.new);
    donut($("#donutType"), byType.map((x) => ({ k: typeName(x.key), v: x.new, color: typeColorHex(x.key), title: typeFull(x.key) })), fmtInt(c.new_count), t("new_label"));
    $("#metaType").textContent = `${t("basis_new")} · ${byType.length} ${t("type")}`;
    const chains = c.by_chain.filter((x) => x.new).sort((a, b) => b.new - a.new);
    const CH = ["#3f7fe8", "#34d399", "#e0521c", "#8f66f0", "#d9408a", "#b8800e", "#109e8c", "#7a8290"];
    donut($("#donutChain"), chains.map((x, k) => ({ k: chainName(x.key), v: x.new, color: x.key === "unknown" ? "#5a6470" : CH[k % CH.length] })), fmtInt(c.new_count), t("new_label"), null, 0.04);
    $("#metaChain").textContent = `${t("basis_first_chain")} · ${chains.filter((x) => x.key !== "unknown").length} ${t("chain")}`;
    const roles = Object.entries(c.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
    hbars($("#rolesBars"), roles.map(([k, v]) => ({ k: roleName(k), v, pct: v / rt })), cnt, t("roles"));
    $("#metaRoles").textContent = `${fmtInt(c.addresses)} ${t("addresses")}`;
    // 금액 상위 10 (신규 기준, 후속 제외)
    const top = c.top || []; const tot = c.total_amount || 1;
    $("#topTable").innerHTML = `<thead><tr><th class="rank">${esc(t("th_rank"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_type"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("th_amount"))}</th><th class="num">${esc(t("th_share"))}</th><th class="barcol"></th></tr></thead><tbody>${
      top.map((x, k) => `<tr class="link" data-href="incident.html?id=${esc(x.uid)}"><td class="rank ${k < 3 ? "top" : ""}">${k + 1}</td><td><a class="name" href="incident.html?id=${esc(x.uid)}">${esc(x.project)}</a></td><td><span class="pill" title="${esc(typeFull(x.type))}">${sw(x.type)}${esc(typeName(x.type))}</span></td><td class="date">${esc(fmtDate(x.event_date || x.incident_date || x.day))}</td><td class="num">${moneyFull(x.amount_usd)}</td><td class="num">${fmtPct(x.amount_usd / tot)}</td><td class="barcol"><div class="bar"><i style="width:${Math.round((x.amount_usd / tot) * 100)}%"></i></div></td></tr>`).join("")}</tbody>`;
    $("#metaTop").textContent = `${t("basis_new")} · ${fmtPct(top.reduce((a, x) => a + x.amount_usd, 0) / tot, 0)}`;
    bindRows($("#topTable"));
    // 출처별 사건 (사건당 1회)
    const runAt = Object.fromEntries((D.meta.source_runs || []).map((r) => [r.name, r]));
    const srcsAll = Object.entries(D.facets.sources || {}).sort((a, b) => b[1] - a[1]); const nInc = D.facets.incidents || 1;
    const srcs = srcsAll.slice(0, 10), restN = srcsAll.slice(10).length;
    $("#srcTable").innerHTML = `<thead><tr><th>${esc(t("th_source"))}</th><th class="num">${esc(t("th_count"))}</th><th class="num">${esc(t("coverage"))}</th><th>${esc(t("th_last"))}</th></tr></thead><tbody>${
      srcs.map(([s, n]) => `<tr><td>${esc(srcLabel(s))}</td><td class="num">${fmtInt(n)}</td><td class="num">${fmtPct(n / nInc, 0)}</td><td class="date">${esc(((runAt[s] || {}).last_run_at || "").replace("T", " ").slice(5, 16) || "-")}</td></tr>`).join("")}${restN ? `<tr><td class="faint">${esc(t("other"))} ${restN}</td><td class="num">${fmtInt(srcsAll.slice(10).reduce((a, s) => a + s[1], 0))}</td><td></td><td></td></tr>` : ""}</tbody>`;
    $("#metaSrc").textContent = `${srcsAll.length} ${t("th_source")} · ${fmtInt(nInc)}${t("unit")}`;
    // 최근 사건 · 브리핑
    const tb = $("#recentTable"); tb.innerHTML = TABLE_HEAD(true) + `<tbody>${D.recent.map((i) => incidentRow(i, true)).join("")}</tbody>`; bindRows(tb);
    $("#recentLegend").innerHTML = tableLegend();
    if (D.brief) { $("#briefHeadline").textContent = D.brief[`headline_${K.lang}`] || D.brief.headline_ko; $("#briefBody").innerHTML = mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko); }
    else { $("#briefHeadline").textContent = ""; $("#briefBody").innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; }
  }
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
