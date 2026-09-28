/* 개요: Incident Report 카드 → AnimatedCard 3장(유형·체인·주소 역할) → 검색 + 기간 → 사건 표(20행) */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, bindTips, columns, hbars, donut, fillSelect, incidentRow, TABLE_HEAD, bindRows, typeColorHex, chainName, errorBox } = KL;
  const S = { days: "90", type: "", chain: "", q: "", sort: "date", dir: "desc", page: 1, size: 20 };
  let meta = null, st = null, allSt = null, facets = null, list = null, addrs = null, flowRows = null;

  async function load(tableOnly = false) {
    const f = { days: S.days, type: S.type, chain: S.chain };
    const jobs = [api("/api/incidents", { ...f, q: S.q, page: S.page, size: S.size, sort: S.sort, dir: S.dir })];
    if (!tableOnly) jobs.push(api("/api/stats", f), api("/api/addresses", { ...f, size: 1 }), api("/api/incidents", { ...f, size: 400, sort: "amount" }));
    if (!allSt) jobs.push(api("/api/stats", { days: "all" }));
    const res = await Promise.all(jobs);
    list = res[0];
    if (!tableOnly) { st = res[1]; addrs = res[2]; flowRows = res[3].items; if (!facets || (!S.type && !S.chain)) facets = st.facets;
    }
    if (!allSt) allSt = res[res.length - 1];
    render();
  }

  // ---- 21st.dev 카드 2종 (cards.js) ----
  const TYPE_SHADES = ["#5B14C5", "#B58BF3", "#DAC5F9"];  // area-chart-1 원본 팔레트(DLP · SysLog · Threat Intel)
  function bucketize(rows, from, to) {
    const d0 = new Date(from + "T00:00:00"), d1 = new Date(to + "T00:00:00"); const days = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
    const step = days <= 21 ? 1 : days <= 70 ? 3 : days <= 200 ? 7 : 30; const nb = Math.ceil(days / step);
    const labels = []; for (let k = 0; k < nb; k++) { const d = new Date(d0.getTime() + k * step * 86400000); labels.push(fmtMD(d.toISOString().slice(0, 10))); }
    const idx = (r) => Math.min(nb - 1, Math.max(0, Math.floor((new Date((r.event_date || r.day) + "T00:00:00") - d0) / 86400000 / step)));
    return { labels, idx };
  }
  function renderCards() {
    // (1) Incident Report: 상위 3개 유형의 기간별 신규 건수(스무스 그룹 영역) + 지표 3행(이전 같은 길이 기간 대비 추세)
    const byType = {}; flowRows.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + 1; });
    const top3 = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    // x 범위: 선택 기간이 아니라 실제 첫 사건일부터 (앞쪽 빈 구간 제거) — 버킷 폭은 남은 일수에 맞춰 1/7/30일
    const firstDay = flowRows.map((r) => r.event_date || r.day).filter(Boolean).sort()[0];
    const from = firstDay && firstDay > st.range.from ? firstDay : st.range.from;
    const { labels, idx } = bucketize(flowRows, from, st.range.to);
    const series = top3.map((tp, k) => { const data = new Array(labels.length).fill(0); flowRows.forEach((r) => { if (r.type === tp) data[idx(r)] += 1; }); return { key: typeName(tp), color: TYPE_SHADES[k], data }; });
    KL.reportCard($("#reportCard"), { title: "Incident Report", series, labels, metrics: [], wide: true });
    // (2) AnimatedCard × 3: 도넛 = 1위 비중(호버: 1+2위 누적), 알약 = 상위 6 항목
    const mk = (id, list, name, opts) => {
      const total = list.reduce((a, r) => a + r.v, 0) || 1; const sorted = list.slice().sort((a, b) => b.v - a.v);
      const p1 = (sorted[0] ? sorted[0].v / total : 0) * 100, p2 = ((sorted[0] ? sorted[0].v : 0) + (sorted[1] ? sorted[1].v : 0)) / total * 100;
      KL.animatedCard($(id), { ...opts, mainPct: p1, hoverMainPct: p1, hoverSecondaryPct: p2,
        badgeTitle: sorted[0] ? `${name(sorted[0])} ${Math.round(p1)}%` : "–", badgeSub: `${fmtInt(total)}${opts.unit || ""}`,
        pills: sorted.slice(0, 6).map(name), description: sorted.slice(0, 3).map((r) => `${name(r)} ${Math.round(r.v / total * 100)}%`).join(" · ") });
    };
    mk("#acType", st.by_type.filter((r) => r.new).map((r) => ({ k: r.key, v: r.new })), (r) => typeName(r.k), { title: t("tab_type"), mainColor: "#8b5cf6", secondaryColor: "#fbbf24", unit: t("unit"), onClick: () => { location.href = "stats.html"; } });
    mk("#acChain", st.by_chain.filter((r) => r.new).map((r) => ({ k: r.key, v: r.new })), (r) => chainName(r.k), { title: t("tab_chain"), mainColor: "#ff6900", secondaryColor: "#f54900", unit: t("unit"), onClick: () => { location.href = "stats.html"; } });
    mk("#acRoles", Object.entries(st.roles || {}).map(([k, v]) => ({ k, v })), (r) => roleName(r.k), { title: t("roles"), mainColor: "#34d399", secondaryColor: "#40E5D1", unit: "", onClick: () => { location.href = "addresses.html"; } });
  }

  function render() {
    renderNav("index.html", meta); renderFoot(); applyI18n(); bindChrome(() => render());
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; S.page = 1; load(); });
    renderCards();
    const tb = $("#incTable");
    const fc = (facets && facets.types) ? facets : list.facets;
    const ctl = { sort: { key: S.sort, dir: S.dir }, filters: { type: S.type, chain: S.chain }, options: { type: KL.optsType(fc.types), chain: KL.optsChain(fc.chains) },
      onSort: (k, d) => { S.sort = k; S.dir = d; S.page = 1; load(true); }, onFilter: (k, v) => { S[k] = v; S.page = 1; load(); } };
    tb.innerHTML = TABLE_HEAD(false, ctl) + `<tbody>${list.items.length ? list.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="6" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb); KL.bindHead(tb, ctl);
    const pages = Math.max(1, Math.ceil(list.total / S.size));
    $("#pager").innerHTML = `<span>${list.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(list.total, S.page * S.size)} / ${list.total}</span><button id="pgPrev" type="button" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; load(true); }; $("#pgNext").onclick = () => { S.page++; load(true); };
  }
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load(true); }, 250); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
