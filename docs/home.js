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
    $("#briefingHeadline").textContent = D.brief ? (D.brief[`headline_${K.lang}`] || D.brief.headline_ko) : t("hero_fallback");
    $("#heroPillText").textContent = `${D.brief ? fmtDate(D.brief.day) + " · " : ""}${t("hero_pill").replace("{n}", nSrc)}`;
    // KPI
    const s7 = D.s7;
    const tiles = [
      { cls: "primary", label: t("kpi_today"), value: D.today.new_count },
      { label: t("kpi_7d"), value: s7.new_count },
      { label: t("kpi_loss"), value: money(s7.total_amount) },
      { label: t("kpi_sdn"), value: fmtInt(D.meta.sdn_addresses || 0) },
    ];
    $("#kpis").innerHTML = tiles.map((k) => `<div class="tile ${k.cls || ""}"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div></div>`).join("");
    // 소스 네트워크 (Integration Card 포팅)
    const PRIORITY = ["rekt", "trm", "chainalysis", "ofac", "doj", "slowmist", "defillama", "zachxbt", "defihacklabs", "scamsniffer"];
    const srcs = [...(D.meta.sources || [])].sort((a, b) => (PRIORITY.indexOf(a) + 1 || 99) - (PRIORITY.indexOf(b) + 1 || 99));
    const runAt = Object.fromEntries((D.meta.source_runs || []).map((r) => [r.name, r.last_run_at]));
    network($("#network"), srcs.slice(0, 6).map((s) => ({ label: KL.monogram(s), sub: srcLabel(s), title: `${srcLabel(s)} · ${(runAt[s] || "").replace("T", " ").slice(5, 16)}` })));
    $("#netTitle").textContent = t("net_title").replace("{n}", nSrc);
    // 오늘 브리핑
    $("#briefingBody").innerHTML = D.brief ? mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko, 6) : `<p class="muted">${esc(t("no_data"))}</p>`;
    // 최근 사건 · 차트
    const tb = $("#recentTable"); tb.innerHTML = TABLE_HEAD(true) + `<tbody>${D.recent.map((i) => incidentRow(i, true)).join("")}</tbody>`; bindRows(tb);
    columns($("#homePlot"), D.s30.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.amount, extra: `${d.count}${t("unit")}` })), money, t("tab_value"));
    hbars($("#homeTop"), D.s30.top.map((x) => ({ k: x.project, v: x.amount_usd, extra: fmtDate(x.incident_date || x.day) })), money, "");
  }

  async function load() {
    const meta = await api("/api/meta");
    const [s7, s14, s30, today, recent, briefs] = await Promise.all([
      api("/api/stats", { days: 7 }), api("/api/stats", { days: 14 }), api("/api/stats", { days: 30 }),
      api("/api/stats", { from: meta.last_day, to: meta.last_day }), api("/api/incidents", { days: 30, size: 6 }), api("/api/briefings"),
    ]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, s7, s14, s30, today, recent: recent.items, brief };
    render();
  }
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)} — server.py 가 실행 중인지 확인하세요.</div>`); });
})();
