/* 홈: Velaris 히어로(브리핑 헤드라인 + KPI) · 소스 네트워크 · 오늘 브리핑 · 최근 사건 · 30일 차트 */
(() => {
  "use strict";
  const { $, t, esc, fmtInt, money, fmtDate, api, renderNav, renderFoot, applyI18n, bindChrome, columns, hbars, incidentRow, TABLE_HEAD, bindRows, mdToHtml, srcLabel, velaris, network, state: K } = KL;
  let D = {};

  function render() {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(render);
    const lastDay = D.meta.last_day || "";
    const nSrc = (D.meta.sources || []).length;
    velaris($("#hero"));
    $("#heroPillText").textContent = `${t("hero_pill").replace("{n}", nSrc)} · ${t("updated")} ${(D.meta.generated_at || "").replace("T", " ").slice(5, 16)}`;
    if (D.brief) {
      $("#briefingHeadline").textContent = D.brief[`headline_${K.lang}`] || D.brief.headline_ko;
      $("#heroSub").textContent = `${t("latest_briefing")} · ${fmtDate(D.brief.day)} · ${t("hero_sub")}`;
    } else { $("#briefingHeadline").textContent = t("hero_fallback"); $("#heroSub").textContent = t("hero_sub"); }
    // KPI
    const s7 = D.s7, s14 = D.s14, prev = { new_count: s14.new_count - s7.new_count, total_amount: s14.total_amount - s7.total_amount, addresses: Math.max(0, s14.addresses - s7.addresses) };
    const delta = (cur, before, fmt = (x) => x) => { const diff = cur - before; const cls = diff > 0 ? "up" : diff < 0 ? "down" : ""; return `<div class="delta ${cls}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "="} ${fmt(Math.abs(diff))} ${esc(t("vs_prev"))}</div>`; };
    const tiles = [
      { cls: "primary", label: t("kpi_today"), value: D.today.new_count, sub: `<div class="delta">${esc(lastDay)}</div>` },
      { label: t("kpi_7d"), value: s7.new_count, sub: delta(s7.new_count, prev.new_count) },
      { label: t("kpi_loss"), value: money(s7.total_amount), sub: delta(s7.total_amount, prev.total_amount, money) },
      { label: t("kpi_addr"), value: fmtInt(s7.addresses), sub: delta(s7.addresses, prev.addresses, fmtInt) },
      { label: t("kpi_sdn"), value: fmtInt(D.meta.sdn_addresses || 0), sub: `<div class="delta">OFAC SDN.XML</div>` },
    ];
    $("#kpis").innerHTML = tiles.map((k) => `<div class="tile ${k.cls || ""}"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div>${k.sub}</div>`).join("");
    // 소스 네트워크 (Integration Card 포팅)
    const PRIORITY = ["rekt", "trm", "chainalysis", "ofac", "doj", "slowmist", "defillama", "zachxbt", "defihacklabs", "scamsniffer"];
    const srcs = [...(D.meta.sources || [])].sort((a, b) => (PRIORITY.indexOf(a) + 1 || 99) - (PRIORITY.indexOf(b) + 1 || 99));
    const runAt = Object.fromEntries((D.meta.source_runs || []).map((r) => [r.name, r.last_run_at]));
    network($("#network"), srcs.slice(0, 6).map((s) => ({ label: KL.monogram(s), sub: srcLabel(s), title: `${srcLabel(s)} · ${(runAt[s] || "").replace("T", " ").slice(5, 16)}` })));
    $("#netTitle").textContent = t("net_title").replace("{n}", nSrc);
    $("#netDesc").textContent = t("net_desc").replace("{list}", srcs.slice(0, 6).map(srcLabel).join(", ")).replace("{m}", Math.max(0, nSrc - 6));
    // 오늘 브리핑
    if (D.brief) { $("#briefDay").textContent = fmtDate(D.brief.day); $("#briefHeadline").textContent = D.brief[`headline_${K.lang}`] || D.brief.headline_ko; $("#briefingBody").innerHTML = mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko); }
    else { $("#briefHeadline").textContent = ""; $("#briefingBody").innerHTML = `<p class="muted">${esc(t("no_data"))}</p>`; }
    // 최근 사건 · 차트
    const tb = $("#recentTable"); tb.innerHTML = TABLE_HEAD() + `<tbody>${D.recent.map(incidentRow).join("")}</tbody>`; bindRows(tb);
    columns($("#homePlot"), D.s30.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.amount, extra: `${d.count}${t("unit")}` })), money, t("tab_value"));
    hbars($("#homeTop"), D.s30.top.map((x) => ({ k: x.project, v: x.amount_usd, extra: fmtDate(x.incident_date || x.day) })), money, "");
  }

  async function load() {
    const meta = await api("/api/meta");
    const [s7, s14, s30, today, recent, briefs] = await Promise.all([
      api("/api/stats", { days: 7 }), api("/api/stats", { days: 14 }), api("/api/stats", { days: 30 }),
      api("/api/stats", { from: meta.last_day, to: meta.last_day }), api("/api/incidents", { days: 30, size: 8 }), api("/api/briefings"),
    ]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, s7, s14, s30, today, recent: recent.items, brief };
    render();
  }
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)} — server.py 가 실행 중인지 확인하세요.</div>`); });
})();
