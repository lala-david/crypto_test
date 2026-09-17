/* 개요: 지표 6 · 일별 건수/금액 · 유형/체인 비중 · 주소 역할 · 피해액 순위 · 소스별 수집 · 최근 사건 · 최신 브리핑 */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, srcLabel, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, columns, hbars, donut, statCard, incidentRow, TABLE_HEAD, bindRows, mdToHtml, typeColorHex, detailUrl, pill, state: K } = KL;
  const S = { days: "30" };
  let D = null;

  async function load() {
    const meta = await api("/api/meta");
    const n = S.days === "all" ? null : +S.days;
    const [cur, prev, today, recent, briefs] = await Promise.all([
      api("/api/stats", { days: S.days }),
      n ? api("/api/stats", { days: n * 2 }) : Promise.resolve(null),
      api("/api/stats", { from: meta.last_day, to: meta.last_day }),
      api("/api/incidents", { days: S.days, size: 10 }),
      api("/api/briefings"),
    ]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, cur, prev, today, recent: recent.items, facets: recent.facets, brief };
    render();
  }
  const ratio = (a, b) => (b > 0 ? (a - b) / b : null);
  const shareTable = (rows, total, keyFmt) => rows.map((r) => `<tr><td>${keyFmt(r)}</td><td class="num">${fmtInt(r.count)}</td><td class="num">${money(r.amount)}</td><td class="num">${fmtPct(r.amount / (total || 1))}</td></tr>`).join("");

  function render() {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(render);
    $$("#rangeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.range === S.days));
    const c = D.cur, p = D.prev, daily = c.daily, last14 = daily.slice(-14);
    const prevOnly = p ? { count: p.total_count - c.total_count, amount: p.total_amount - c.total_amount, addresses: Math.max(0, p.addresses - c.addresses) } : null;
    const rangeLbl = S.days === "all" ? t("all") : t("days_n").replace("{n}", S.days);
    $("#sub").textContent = `${fmtDate(D.meta.first_day)} – ${fmtDate(D.meta.last_day)} · ${D.meta.days}${t("unit") ? "일" : " days"} · ${rangeLbl}: ${fmtInt(c.total_count)}${t("unit")} · ${money(c.total_amount)}`;
    $("#stats").innerHTML = [
      statCard(t("k_today"), fmtInt(D.today.new_count), null, last14.map((d) => d.new)),
      statCard(`${rangeLbl} ${t("count")}`, fmtInt(c.total_count), prevOnly ? ratio(c.total_count, prevOnly.count) : null, last14.map((d) => d.count)),
      statCard(`${rangeLbl} ${t("amount")}`, money(c.total_amount), prevOnly ? ratio(c.total_amount, prevOnly.amount) : null, last14.map((d) => d.amount)),
      statCard(`${rangeLbl} ${t("follow")}`, fmtInt(c.followup_count), null, null),
      statCard(t("k_addr"), fmtInt(c.addresses), prevOnly ? ratio(c.addresses, prevOnly.addresses) : null, null),
      statCard(t("k_sdn"), fmtInt(D.meta.sdn_addresses), null, null),
    ].map((h) => h.replace('class="card stat"', 'class="card stat c2"')).join("");
    // 일별
    columns($("#plotCount"), daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.count, extra: `${t("new_label")} ${d.new}` })), (v) => String(Math.round(v)), t("daily_count"));
    $("#metaCount").textContent = `Σ ${fmtInt(c.total_count)} · avg ${(c.total_count / Math.max(1, daily.length)).toFixed(1)}/d`;
    columns($("#plotAmt"), daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.amount, extra: `${d.count}${t("unit")}` })), money, t("daily_amount"));
    const peak = daily.reduce((a, d) => (d.amount > a.amount ? d : a), { amount: 0 });
    $("#metaAmt").textContent = `Σ ${money(c.total_amount)} · max ${money(peak.amount)}${peak.day ? " (" + peak.day.slice(5) + ")" : ""}`;
    // 비중
    const byType = c.by_type.slice().sort((a, b) => b.count - a.count);
    donut($("#donutType"), byType.map((x) => ({ k: typeName(x.key), v: x.count, color: typeColorHex(x.key) })), fmtInt(c.total_count), t("count"));
    $("#metaType").textContent = `${byType.length} ${t("type")}`;
    const chains = c.by_chain.slice().sort((a, b) => b.count - a.count); const top5 = chains.slice(0, 5), rest = chains.slice(5).reduce((a, x) => a + x.count, 0);
    const CH = ["#3f7fe8", "#34d399", "#e0521c", "#8f66f0", "#d9408a", "#7a8290"];
    donut($("#donutChain"), [...top5.map((x, k) => ({ k: x.key, v: x.count, color: CH[k] })), ...(rest ? [{ k: t("all") === "All" ? "Other" : "기타", v: rest, color: CH[5] }] : [])], fmtInt(chains.reduce((a, x) => a + x.count, 0)), t("count"));
    $("#metaChain").textContent = `${chains.length} ${t("chain")}`;
    const roles = Object.entries(c.roles || {}).sort((a, b) => b[1] - a[1]);
    hbars($("#rolesBars"), roles.map(([k, v]) => ({ k: roleName(k), v })), (v) => String(Math.round(v)), t("roles"));
    $("#metaRoles").textContent = `Σ ${fmtInt(roles.reduce((a, r) => a + r[1], 0))}`;
    // 순위
    const top = D.recent.slice().filter((i) => i.amount_usd).sort((a, b) => b.amount_usd - a.amount_usd);
    const allTop = c.top || [];
    $("#topTable").innerHTML = `<thead><tr><th class="rank">${esc(t("th_rank"))}</th><th>${esc(t("th_incident"))}</th><th>${esc(t("th_date"))}</th><th class="num">${esc(t("th_amount"))}</th><th class="num">${esc(t("th_share"))}</th><th></th></tr></thead><tbody>${
      allTop.map((x, k) => `<tr class="link" data-href="incident.html?id=${esc(x.uid)}"><td class="rank">${k + 1}</td><td><a class="name" href="incident.html?id=${esc(x.uid)}">${esc(x.project)}</a></td><td class="date">${esc(fmtDate(x.incident_date || x.day))}</td><td class="num">${moneyFull(x.amount_usd)}</td><td class="num">${fmtPct(x.amount_usd / (c.total_amount || 1))}</td><td><div class="bar"><i style="width:${Math.round((x.amount_usd / (allTop[0].amount_usd || 1)) * 100)}%"></i></div></td></tr>`).join("")}</tbody>`;
    $("#metaTop").textContent = `top ${allTop.length} = ${fmtPct(allTop.reduce((a, x) => a + x.amount_usd, 0) / (c.total_amount || 1))}`;
    bindRows($("#topTable"));
    // 소스
    const runAt = Object.fromEntries((D.meta.source_runs || []).map((r) => [r.name, r]));
    const srcs = Object.entries(D.facets.sources || {}).sort((a, b) => b[1] - a[1]);
    const srcTotal = srcs.reduce((a, s) => a + s[1], 0);
    $("#srcTable").innerHTML = `<thead><tr><th>${esc(t("th_source"))}</th><th class="num">${esc(t("th_count"))}</th><th class="num">${esc(t("th_share"))}</th><th>${esc(t("th_last"))}</th></tr></thead><tbody>${
      srcs.map(([s, n]) => `<tr><td>${esc(srcLabel(s))}</td><td class="num">${fmtInt(n)}</td><td class="num">${fmtPct(n / (srcTotal || 1))}</td><td class="date">${esc(((runAt[s] || {}).last_run_at || "").replace("T", " ").slice(5, 16) || "-")}</td></tr>`).join("")}</tbody>`;
    $("#metaSrc").textContent = `${srcs.length} src · Σ ${fmtInt(srcTotal)}`;
    // 최근 사건 · 브리핑
    const tb = $("#recentTable"); tb.innerHTML = TABLE_HEAD(true) + `<tbody>${D.recent.map((i) => incidentRow(i, true)).join("")}</tbody>`; bindRows(tb);
    if (D.brief) { $("#briefHeadline").textContent = `${fmtDate(D.brief.day)} · ${D.brief[`headline_${K.lang}`] || D.brief.headline_ko}`; $("#briefBody").innerHTML = mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko); }
    else { $("#briefHeadline").textContent = ""; $("#briefBody").innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; }
  }
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { S.days = b.dataset.range; load(); }));
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="card empty">API 오류: ${esc(e.message)} — server.py 확인</div>`); });
})();
