/* 개요: 히어로(제목 + 사건 흐름 버블 차트) → 패널(전체 · 유형/체인/기간 필터 · 탭: 피해액/유형/체인/주소 · 차트 + Top 5) → 검색 → 사건 표(20행) */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, bindTips, columns, hbars, donut, fillSelect, incidentRow, TABLE_HEAD, bindRows, typeColorHex, chainName, errorBox } = KL;
  const S = { days: "90", type: "", chain: "", q: "", page: 1, size: 20, tab: "amount", mode: "amount" };
  let meta = null, st = null, allSt = null, facets = null, list = null, addrs = null, flowRows = null;

  async function load(tableOnly = false) {
    const f = { days: S.days, type: S.type, chain: S.chain };
    const jobs = [api("/api/incidents", { ...f, q: S.q, page: S.page, size: S.size, sort: "date" })];
    if (!tableOnly) jobs.push(api("/api/stats", f), api("/api/addresses", { ...f, size: 1 }), api("/api/incidents", { ...f, size: 400, sort: "amount" }));
    if (!allSt) jobs.push(api("/api/stats", { days: "all" }));
    const res = await Promise.all(jobs);
    list = res[0];
    if (!tableOnly) { st = res[1]; addrs = res[2]; flowRows = res[3].items; if (!facets || (!S.type && !S.chain)) facets = st.facets; }
    if (!allSt) allSt = res[res.length - 1];
    render();
  }

  // ---- 사건 흐름: x = 사건일, 행 = 유형, 원 크기 = 금액(√), 색 = 유형. 상위 5건 이름 표시, 클릭 → 케이스 패널 ----
  function flow(el, rows, from, to) {
    const W = Math.max(420, el.clientWidth || 560), H = 280, m = { l: 84, r: 16, t: 14, b: 28 };
    const lanesAll = {}; rows.forEach((r) => { lanesAll[r.type] = (lanesAll[r.type] || 0) + 1; });
    const lanes = Object.entries(lanesAll).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
    if (!rows.length || !lanes.length) { el.innerHTML = `<div class="empty">${esc(t("no_data"))}</div>`; return; }
    // x 범위: 선택 기간 안에서 실제 사건이 있는 구간만(앞쪽 빈 달은 잘라냄), 양쪽 2일 여유
    const dates = rows.map((r) => r.event_date || r.day).filter(Boolean).sort();
    const lo = dates.length && dates[0] > from ? dates[0] : from;
    const d0 = new Date(lo + "T00:00:00"); d0.setDate(d0.getDate() - 2); const d1 = new Date(to + "T00:00:00"); d1.setDate(d1.getDate() + 1); const span = Math.max(1, (d1 - d0) / 86400000);
    const x = (d) => m.l + Math.min(1, Math.max(0, ((new Date((d || to) + "T00:00:00") - d0) / 86400000) / span)) * (W - m.l - m.r);
    const lh = (H - m.t - m.b) / lanes.length; const y = (type) => m.t + lanes.indexOf(type) * lh + lh / 2;
    const maxA = Math.max(...rows.map((r) => r.amount_usd || 0), 1); const rad = (a) => (a ? 5 + 22 * Math.sqrt(a / maxA) : 3.5);
    const top = rows.filter((r) => r.amount_usd).sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 5).map((r) => r.uid);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="flow-svg" role="img" aria-label="${esc(t("flow_title"))}">`;
    lanes.forEach((k) => { const yy = y(k); s += `<line class="lane" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="lane-lbl" x="${m.l - 10}" y="${yy + 4}" text-anchor="end">${esc(typeName(k))}</text>`; });
    const nT = Math.min(6, Math.max(2, Math.floor((W - m.l) / 110)));
    for (let k = 0; k <= nT; k++) { const d = new Date(d0.getTime() + (span * k / nT) * 86400000); const xx = m.l + (k / nT) * (W - m.l - m.r); s += `<text class="ax" x="${xx}" y="${H - 8}" text-anchor="middle">${esc(fmtMD(d.toISOString().slice(0, 10)))}</text>`; }
    const sorted = rows.slice().sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0));
    const hash = (u) => { let h = 0; for (const c of u) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    const boxes = []; const hit = (b) => boxes.some((o) => !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2));
    let labels = "";
    sorted.forEach((r) => {
      if (!lanes.includes(r.type)) return;
      const rr = rad(r.amount_usd), col = typeColorHex(r.type);
      const cx = x(r.event_date || r.day), cy = y(r.type) + (rr < 10 ? ((hash(r.uid) % 7) - 3) * lh * 0.07 : 0);  // 작은 원은 행 안에서 살짝 흩어 겹침 완화
      const tip = `<b>${esc(r.project)}</b><br>${esc(r.amount_usd ? moneyFull(r.amount_usd) : t("unknown"))} · ${esc(fmtDate(r.event_date || r.day))}`;
      s += `<circle class="bub ${r.amount_usd ? "" : "hollow"}" cx="${cx}" cy="${cy}" r="${rr}" style="--c:${col}" data-uid="${esc(r.uid)}" data-tip="${tip}"/>`;
      boxes.push({ x1: cx - rr, x2: cx + rr, y1: cy - rr, y2: cy + rr });
      if (top.includes(r.uid)) {
        const name = r.project.length > 18 ? r.project.slice(0, 17) + "…" : r.project; const tw = name.length * 6.6 + 4;
        const cands = [[cx + rr + 6, cy + 4, "start"], [cx - rr - 6, cy + 4, "end"], [cx, cy - rr - 6, "middle"], [cx, cy + rr + 13, "middle"]];
        for (const [lx, ly, anc] of cands) {
          const x1 = anc === "start" ? lx : anc === "end" ? lx - tw : lx - tw / 2, b = { x1, x2: x1 + tw, y1: ly - 11, y2: ly + 2 };
          if (b.x1 < m.l - 4 || b.x2 > W - 2 || hit(b)) continue;
          labels += `<text class="bub-lbl" x="${lx}" y="${ly}" text-anchor="${anc}">${esc(name)}</text>`; boxes.push(b); break;
        }
      }
    });
    s += labels;
    el.innerHTML = s + "</svg>"; bindTips(el);
    $$("circle.bub", el).forEach((c) => c.addEventListener("click", () => KL.openCase(c.dataset.uid)));
  }

  function renderPanel() {
    const tabs = [["amount", t("tab_amount")], ["type", t("tab_type")], ["chain", t("tab_chain")], ["roles", t("roles")]];
    $("#tabs").innerHTML = tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? "on" : ""}" type="button">${esc(l)}</button>`).join("");
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; renderPanel(); }));
    const byAmt = S.mode === "amount";
    const modeEl = $("#modeSeg");
    if (S.tab === "roles") modeEl.innerHTML = "";
    else { modeEl.innerHTML = [["amount", t("mode_amount")], ["count", t("mode_count")]].map(([k, l]) => `<button data-mode="${k}" class="${S.mode === k ? "on" : ""}" type="button">${esc(l)}</button>`).join(""); $$("#modeSeg button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; renderPanel(); })); }
    const cnt = (v) => String(Math.round(v));
    const plot = $("#mainPlot"), top = $("#top5"), tt = $("#top5Title"), pt = $("#panelTotal");
    if (S.tab === "amount") {
      pt.innerHTML = byAmt ? `${esc(t("k_loss"))} <b>${esc(money(st.loss_amount))}</b>${st.legal_amount ? ` <span class="faint">· ${esc(t("k_legal"))} ${esc(money(st.legal_amount))}</span>` : ""}` : `${esc(t("k_new"))} <b>${fmtInt(st.new_count)}</b>`;
      columns(plot, st.daily.map((d) => ({ label: fmtMD(d.day), v: byAmt ? d.amount : d.new, extra: byAmt ? `${d.new}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, t("daily_amount"), { height: 230 });
      tt.textContent = t("top5_title");
      const top5 = (st.top || []).slice(0, 5);
      hbars(top, top5.map((x) => ({ k: x.project, v: x.amount_usd, extra: fmtDate(x.event_date || x.day) })), money, t("top5_title"));
      $$(".hit", top).forEach((h, k) => { h.style.cursor = "pointer"; h.addEventListener("click", () => { if (top5[k]) KL.openCase(top5[k].uid); }); });
    } else if (S.tab === "type" || S.tab === "chain") {
      const rows = (S.tab === "type" ? st.by_type : st.by_chain).filter((r) => r.new);
      const key = S.tab === "type" ? (r) => typeName(r.key) : (r) => chainName(r.key);
      const items = rows.map((r) => ({ k: key(r), v: byAmt ? r.amount : r.new, color: S.tab === "type" ? typeColorHex(r.key) : "var(--chart)", title: S.tab === "type" ? typeFull(r.key) : r.key })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      pt.innerHTML = `${esc(S.tab === "type" ? t("tab_type") : t("tab_chain"))} <b>${rows.length}</b>`;
      donut(plot, items, byAmt ? money(items.reduce((a, x) => a + x.v, 0)) : fmtInt(st.new_count), byAmt ? t("k_loss") : t("new_label"), byAmt ? money : null);
      tt.textContent = byAmt ? t("top5_amount") : t("top5_count");
      hbars(top, items.slice(0, 5), byAmt ? money : cnt, tt.textContent);
    } else {
      const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
      pt.innerHTML = `${esc(t("addresses"))} <b>${fmtInt(st.addresses)}</b>`;
      hbars(plot, roles.map(([k, v]) => ({ k: roleName(k), v, pct: v / rt })), cnt, t("roles"));
      tt.textContent = t("top5_chains_addr");
      const ch = Object.entries((addrs && addrs.chains) || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
      hbars(top, ch.map(([k, v]) => ({ k, v })), cnt, tt.textContent);
    }
  }

  function render() {
    renderNav("index.html", meta); renderFoot(); applyI18n(); bindChrome(() => render());
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; S.page = 1; load(); });
    fillSelect($("#typeSel"), Object.keys(facets.types).map((v) => ({ value: v, label: `${typeName(v)} (${facets.types[v]})` })), t("all_types"), S.type);
    fillSelect($("#chainSel"), Object.keys(facets.chains).map((v) => ({ value: v, label: `${v} (${facets.chains[v]})` })), t("all_chains"), S.chain);
    $("#heroSub").innerHTML = `<span>${esc(t("hero_since").replace("{d}", fmtDate(meta.first_day)))}</span><span class="dot">·</span><span>${esc(t("k_new"))} <b>${fmtInt(allSt.new_count)}</b></span><span class="dot">·</span><span>${esc(t("k_loss"))} <b>${esc(money(allSt.loss_amount))}</b></span><span class="dot">·</span><span>${esc(t("k_legal"))} <b>${esc(money(allSt.legal_amount))}</b></span><span class="dot">·</span><span>${esc(t("k_addr"))} <b>${fmtInt(meta.addresses_total)}</b></span>`;
    $("#flowTitle").textContent = t("flow_title");
    $("#flowMeta").textContent = `${fmtDate(st.range.from)} – ${fmtDate(st.range.to)} · ${fmtInt(flowRows.length)}${t("unit")}`;
    flow($("#flow"), flowRows, st.range.from, st.range.to);
    $("#total").textContent = fmtInt(list.total);
    renderPanel();
    const tb = $("#incTable");
    tb.innerHTML = TABLE_HEAD() + `<tbody>${list.items.length ? list.items.map((i) => incidentRow(i)).join("") : `<tr><td colspan="6" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb);
    const pages = Math.max(1, Math.ceil(list.total / S.size));
    $("#pager").innerHTML = `<span>${list.total ? (S.page - 1) * S.size + 1 : 0}–${Math.min(list.total, S.page * S.size)} / ${list.total}</span><button id="pgPrev" type="button" ${S.page <= 1 ? "disabled" : ""}>‹</button><span>${S.page}/${pages}</span><button id="pgNext" type="button" ${S.page >= pages ? "disabled" : ""}>›</button>`;
    $("#pgPrev").onclick = () => { S.page--; load(true); }; $("#pgNext").onclick = () => { S.page++; load(true); };
  }
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; S.page = 1; load(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; S.page = 1; load(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load(true); }, 250); });
  let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if (st && flowRows) flow($("#flow"), flowRows, st.range.from, st.range.to); }, 150); });
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
