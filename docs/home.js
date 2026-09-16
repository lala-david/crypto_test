/* 홈 = 원장 피드: 날짜별 사건 카드(왼쪽) + 브리핑·차트 레일(오른쪽) */
(() => {
  "use strict";
  const { $, t, typeName, esc, money, moneyFull, fmtDate, dayOf, txt, api, renderNav, renderFoot, applyI18n, bindChrome, columns, hbars, mdToHtml, srcLabel, velaris, network, detailUrl, pill, chainPills, TYPE_COLOR, state: K } = KL;
  let D = {};

  function card(i) {
    const sum = txt(i, "summary") || txt(i, "attack_method");
    return `<a class="fcard" href="${detailUrl(i)}" style="--type:${TYPE_COLOR[i.type] || "var(--t-other)"}">
      <div class="fc-body">
        <div class="fc-top"><span class="fc-name">${esc(i.project)}</span>${pill(i)}${chainPills(i.chains, 1)}${i.followup_of ? `<span class="tag" title="${esc(t("follow"))}">↩</span>` : ""}${i.blacklist_hits ? `<span class="tag warn">⚠ ${i.blacklist_hits}</span>` : ""}</div>
        ${sum ? `<p class="fc-sum">${esc(sum)}</p>` : ""}
        <div class="fc-meta"><span>${esc(fmtDate(dayOf(i)))}</span><span>${esc(t("sources"))} ${i.sources.length}</span>${i.addresses.length ? `<span>${esc(t("th_addr"))} ${i.addresses.length}</span>` : ""}</div>
      </div>
      <div class="fc-amt">${i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="muted small">${esc(KL.shortText(i.amount_text, 14))}</span>`}</div>
    </a>`;
  }

  function render() {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(render);
    const nSrc = (D.meta.sources || []).length;
    velaris($("#hero"), { speed: 1.2, grain: 0.22 });
    $("#slimDate").textContent = fmtDate(D.meta.last_day || "");
    $("#heroPillText").textContent = `${t("hero_pill").replace("{n}", nSrc)} · ${t("updated")} ${(D.meta.generated_at || "").slice(11, 16)}`;
    // 피드: 날짜별 그룹
    const groups = new Map();
    D.items.forEach((i) => { if (!groups.has(i.day)) groups.set(i.day, []); groups.get(i.day).push(i); });
    $("#feed").innerHTML = [...groups.entries()].map(([day, rows]) => {
      const amt = rows.reduce((a, r) => a + (r.amount_usd || 0), 0);
      const fresh = rows.filter((r) => !r.followup_of).length;
      return `<section class="day-group"><h3 class="day-head"><span>${esc(fmtDate(day))}</span><span class="muted">${fresh}${esc(t("unit"))}${rows.length - fresh ? ` · ${esc(t("follow"))} ${rows.length - fresh}` : ""} · ${money(amt)}</span></h3>${rows.map(card).join("")}</section>`;
    }).join("") || `<div class="panel empty">${esc(t("no_data"))}</div>`;
    // 레일
    if (D.brief) { $("#briefHeadline").textContent = D.brief[`headline_${K.lang}`] || D.brief.headline_ko; $("#briefingBody").innerHTML = mdToHtml(D.brief[`briefing_${K.lang}`] || D.brief.briefing_ko, 6); }
    else { $("#briefHeadline").textContent = ""; $("#briefingBody").innerHTML = `<p class="muted">${esc(t("no_data"))}</p>`; }
    columns($("#homePlot"), D.s30.daily.map((d) => ({ label: fmtDate(d.day), short: d.day.slice(5), v: d.amount, extra: `${d.count}${t("unit")}` })), money, t("tab_value"));
    hbars($("#homeTypes"), [...D.s30.by_type].sort((a, b) => b.count - a.count).slice(0, 6).map((x) => ({ k: typeName(x.key), v: x.count, extra: money(x.amount) })), (v) => String(Math.round(v)), "");
    const PRIORITY = ["rekt", "trm", "chainalysis", "ofac", "doj", "slowmist", "defillama", "zachxbt", "defihacklabs", "scamsniffer"];
    const srcs = [...(D.meta.sources || [])].sort((a, b) => (PRIORITY.indexOf(a) + 1 || 99) - (PRIORITY.indexOf(b) + 1 || 99));
    network($("#network"), srcs.slice(0, 6).map((s) => ({ label: KL.monogram(s), sub: srcLabel(s) })));
    $("#netTitle").textContent = t("net_title").replace("{n}", nSrc);
  }

  async function load() {
    const meta = await api("/api/meta");
    const [s30, list, briefs] = await Promise.all([api("/api/stats", { days: 30 }), api("/api/incidents", { days: 14, size: 40 }), api("/api/briefings")]);
    const brief = briefs.length ? await api(`/api/briefings/${briefs[0].day}`) : null;
    D = { meta, s30, items: list.items, brief };
    render();
  }
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">API 오류: ${esc(e.message)} — server.py 가 실행 중인지 확인하세요.</div>`); });
})();
