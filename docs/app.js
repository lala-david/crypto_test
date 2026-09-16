/* 메인 대시보드 */
(() => {
  "use strict";
  const { $, $$, t, typeName, roleName, srcLabel, esc, fmtInt, money, moneyFull, fmtDate, dayOf, txt, avatarColor, initials, shortText, pill, chainPills, gauge, detailUrl,
          mdToHtml, loadAll, applyI18n, bindChrome, bindTips, constellation, state: K } = KL;
  const PAGE = 20;
  const S = { range: "30", type: "", chain: "", source: "", q: "", hideFollow: false, tab: "value", mode: "amount", page: 0, incidents: [], briefings: [], meta: {} };
  let tableData = { head: [], rows: [] };

  // ---------- 필터 ----------
  function filtered() {
    const today = new Date(S.meta.last_day || new Date().toISOString().slice(0, 10));
    let cutoff = null;
    if (S.range !== "all") { const d = new Date(today); d.setDate(d.getDate() - Number(S.range) + 1); cutoff = d.toISOString().slice(0, 10); }
    const q = S.q.trim().toLowerCase();
    return S.incidents.filter((i) => {
      if (cutoff && i.day < cutoff) return false;
      if (S.type && i.type !== S.type) return false;
      if (S.chain && !(i.chains || []).some((c) => c.toLowerCase() === S.chain.toLowerCase())) return false;
      if (S.source && !i.sources.some((s) => s.source === S.source)) return false;
      if (S.hideFollow && i.followup_of) return false;
      if (q) {
        const hay = [i.project, i.title, ...(i.actors || []), ...(i.tags || []), ...(i.chains || []), txt(i, "summary"), txt(i, "attack_method"),
          ...(i.addresses || []).map((a) => a.address), ...(i.tx_hashes || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  const fillSelect = (sel, values, allLabel, current) => { sel.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map((v) => `<option value="${esc(v.value)}"${v.value === current ? " selected" : ""}>${esc(v.label)}</option>`).join(""); };

  // ---------- 렌더 ----------
  function render() {
    applyI18n();
    $("#updated").textContent = `${t("updated")} ${(S.meta.generated_at || "").replace("T", " ").slice(0, 16)}`;
    fillSelect($("#typeSel"), [...new Set(S.incidents.map((i) => i.type))].sort().map((v) => ({ value: v, label: typeName(v) })), t("all_types"), S.type);
    fillSelect($("#chainSel"), [...new Set(S.incidents.flatMap((i) => i.chains || []))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v })), t("all_chains"), S.chain);
    fillSelect($("#sourceSel"), [...new Set(S.incidents.flatMap((i) => i.sources.map((s) => s.source)))].sort().map((v) => ({ value: v, label: srcLabel(v) })), t("all_sources"), S.source);
    typing(); renderTicker(); renderKpis(); renderBriefing();
    const rows = filtered();
    $("#incCount").textContent = rows.length.toLocaleString();
    renderStats(rows); renderTable(rows);
  }

  // 타이핑 헤드라인 (Kloint 홈의 "We ▌" 느낌)
  let typeTimer = null;
  function typing() {
    clearTimeout(typeTimer);
    const el = $("#typed"); const phrases = t("hero_phrases"); let pi = 0, ci = phrases[0].length, del = true;
    el.textContent = phrases[0];  // 첫 화면은 문구가 채워진 상태로 시작
    const step = () => {
      const p = phrases[pi]; ci += del ? -1 : 1; el.textContent = p.slice(0, ci);
      let wait = del ? 28 : 55;
      if (!del && ci === p.length) { del = true; wait = 2600; } else if (del && ci === 0) { del = false; pi = (pi + 1) % phrases.length; wait = 400; }
      typeTimer = setTimeout(step, wait);
    };
    typeTimer = setTimeout(step, 2600);
  }
  function renderTicker() {
    const top = [...S.incidents].filter((i) => i.amount_usd && !i.followup_of).sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 16);
    const line = (i) => `<a class="tk" href="${detailUrl(i)}"><span class="amt">$${fmtInt(i.amount_usd)}</span><span class="who">${esc(i.project)}</span><span class="when">${esc(fmtDate(dayOf(i)))}</span></a>`;
    $("#ticker").innerHTML = top.map(line).join("") + top.map(line).join("");
  }
  function renderKpis() {
    const last = S.meta.last_day || ""; const d = new Date(last);
    const cut7 = new Date(d); cut7.setDate(d.getDate() - 6); const cut14 = new Date(d); cut14.setDate(d.getDate() - 13);
    const s7 = cut7.toISOString().slice(0, 10), s14 = cut14.toISOString().slice(0, 10);
    const w = S.incidents.filter((i) => i.day >= s7 && !i.followup_of), prev = S.incidents.filter((i) => i.day >= s14 && i.day < s7 && !i.followup_of);
    const today = S.incidents.filter((i) => i.day === last && !i.followup_of);
    const loss = (arr) => arr.reduce((a, i) => a + (i.amount_usd || 0), 0);
    const addrs = (arr) => new Set(arr.flatMap((i) => i.addresses.map((a) => a.address.toLowerCase()))).size;
    const delta = (cur, before, fmt = (x) => x) => { if (!before) return ""; const diff = cur - before; const cls = diff > 0 ? "up" : diff < 0 ? "down" : ""; return `<div class="delta ${cls}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} ${fmt(Math.abs(diff))} <span>${esc(t("vs_prev"))}</span></div>`; };
    const tiles = [
      { label: t("kpi_today"), value: today.length, sub: `<div class="delta">${last}</div>` },
      { label: t("kpi_7d"), value: w.length, sub: delta(w.length, prev.length) },
      { label: t("kpi_loss"), value: money(loss(w)), sub: delta(loss(w), loss(prev), money) },
      { label: t("kpi_addr"), value: addrs(w).toLocaleString(), sub: delta(addrs(w), addrs(prev), (x) => x.toLocaleString()) },
      { label: t("kpi_sdn"), value: (S.meta.sdn_addresses || 0).toLocaleString(), sub: `<div class="delta">SDN.XML</div>` },
    ];
    $("#kpis").innerHTML = tiles.map((k) => `<div class="tile"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div>${k.sub}</div>`).join("");
  }
  function renderBriefing() {
    const sel = $("#briefingDay");
    if (sel.options.length !== S.briefings.length) sel.innerHTML = S.briefings.map((b) => `<option value="${b.day}">${b.day} · ${b.relevant}${t("unit")}</option>`).join("");
    const b = S.briefings.find((x) => x.day === sel.value) || S.briefings[0];
    if (!b) { $("#briefingHeadline").textContent = ""; $("#briefingBody").innerHTML = `<p class="muted">${t("no_data")}</p>`; return; }
    if (sel.value !== b.day) sel.value = b.day;
    $("#briefingHeadline").textContent = b[`headline_${K.lang}`] || b.headline_ko;
    $("#briefingBody").innerHTML = mdToHtml(b[`briefing_${K.lang}`] || b.briefing_ko);
  }

  // ---------- 차트 ----------
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const GRAD = `<defs><linearGradient id="gv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--chart-2)"/><stop offset="1" stop-color="var(--chart)"/></linearGradient><linearGradient id="gh" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--chart)"/><stop offset="1" stop-color="var(--chart-2)"/></linearGradient></defs>`;
  function columns(el, buckets, fmt, ariaLabel) {
    if (!buckets.length) { el.innerHTML = `<div class="empty">${t("no_data")}</div>`; return; }
    const W = 640, H = 260, m = { l: 54, r: 10, t: 10, b: 28 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = niceMax(Math.max(...buckets.map((b) => b.v))); const slot = pw / buckets.length; const bw = Math.max(3, Math.min(22, slot * 0.6));
    const x = (k) => m.l + (k + 0.5) * slot; const y = (v) => m.t + ph - (v / max) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${GRAD}`;
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const v = max * f; s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; });
    s += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`;
    buckets.forEach((b, k) => {
      if (b.v) s += `<rect class="bar v" x="${x(k) - bw / 2}" y="${y(b.v)}" width="${bw}" height="${Math.max(1, y(0) - y(b.v))}" rx="3"/>`;
      s += `<rect class="hit" x="${x(k) - slot / 2}" y="${m.t}" width="${slot}" height="${ph}" data-tip="<b>${esc(b.label)}</b><br>${esc(fmt(b.v))}${b.extra ? " · " + esc(b.extra) : ""}"/>`;
    });
    const step = Math.max(1, Math.ceil(buckets.length / 7));
    buckets.forEach((b, k) => { if (k % step === 0 || k === buckets.length - 1) s += `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${esc(b.short || b.label)}</text>`; });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function hbars(el, items, fmt, title) {
    if (!items.length) { el.innerHTML = `<h4>${esc(title)}</h4><div class="empty">${t("no_data")}</div>`; return; }
    const W = 360, rowH = 34, m = { l: 100, r: 56, t: 6, b: 22 }; const H = m.t + m.b + items.length * rowH; const pw = W - m.l - m.r;
    const max = niceMax(Math.max(...items.map((i) => i.v)));
    let s = `<h4>${esc(title)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${GRAD}`;
    [0, 0.5, 1].forEach((f) => { const xx = m.l + pw * f; s += `<line class="grid" x1="${xx}" x2="${xx}" y1="${m.t}" y2="${H - m.b}"/><text x="${xx}" y="${H - 6}" text-anchor="middle">${esc(fmt(max * f))}</text>`; });
    items.forEach((it, k) => {
      const yy = m.t + k * rowH + 5, w = Math.max(2, (it.v / max) * pw);
      s += `<text class="lbl" x="${m.l - 8}" y="${yy + 15}" text-anchor="end">${esc(it.k.length > 14 ? it.k.slice(0, 13) + "…" : it.k)}</text>`;
      s += `<rect class="bar h" x="${m.l}" y="${yy}" width="${w}" height="22" rx="3"/>`;
      s += `<rect class="hit" x="0" y="${yy - 4}" width="${W}" height="${rowH}" data-tip="<b>${esc(it.k)}</b><br>${esc(fmt(it.v))}${it.extra ? " · " + esc(it.extra) : ""}"/>`;
    });
    el.innerHTML = s + "</svg>"; bindTips(el);
  }
  function renderStats(rows) {
    const main = $("#mainPlot"), side = $("#sidePlot");
    $$("#statTabs .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
    $("#valueMode").style.visibility = S.tab === "value" ? "visible" : "hidden";
    const byAmount = S.tab !== "value" || S.mode === "amount";
    const fmtV = byAmount ? money : (v) => String(Math.round(v));
    const loss = rows.reduce((a, i) => a + (i.amount_usd || 0), 0);
    $("#panelKpi").innerHTML = `${esc(t("total_value"))} <b>${money(loss)}</b> &nbsp;·&nbsp; ${esc(t("total_count"))} <b>${rows.length}</b>`;
    if (S.tab === "value") {
      const days = [...new Set(rows.map((i) => i.day))].sort(); const buckets = [];
      if (days.length) for (const d = new Date(days[0]), end = new Date(days[days.length - 1]); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10), arr = rows.filter((i) => i.day === key), amt = arr.reduce((a, i) => a + (i.amount_usd || 0), 0);
        buckets.push({ label: fmtDate(key), short: key.slice(5), v: byAmount ? amt : arr.length, extra: byAmount ? `${arr.length}${t("unit")}` : money(amt) });
      }
      columns(main, buckets, fmtV, t("tab_value"));
      hbars(side, [...rows].filter((i) => i.amount_usd).sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 5).map((i) => ({ k: i.project, v: i.amount_usd, extra: fmtDate(dayOf(i)) })), money, t("top_projects"));
      tableData = { head: [t("day"), byAmount ? t("amount") : t("count")], rows: buckets.map((b) => [b.label, fmtV(b.v)]) };
    } else if (S.tab === "type") {
      const map = {}; rows.forEach((i) => { map[i.type] = map[i.type] || { n: 0, v: 0 }; map[i.type].n++; map[i.type].v += i.amount_usd || 0; });
      const ent = Object.entries(map).sort((a, b) => b[1].v - a[1].v);
      columns(main, ent.map(([k, o]) => ({ label: typeName(k), short: typeName(k).slice(0, 6), v: o.v, extra: `${o.n}${t("unit")}` })), money, t("tab_type"));
      hbars(side, ent.map(([k, o]) => ({ k: typeName(k), v: o.n, extra: money(o.v) })).sort((a, b) => b.v - a.v), (v) => String(Math.round(v)), t("by_type"));
      tableData = { head: [t("type"), t("amount"), t("count")], rows: ent.map(([k, o]) => [typeName(k), money(o.v), o.n]) };
    } else if (S.tab === "chain") {
      const map = {}; rows.forEach((i) => (i.chains || []).slice(0, 1).forEach((c) => { map[c] = map[c] || { n: 0, v: 0 }; map[c].n++; map[c].v += i.amount_usd || 0; }));
      const ent = Object.entries(map).sort((a, b) => b[1].v - a[1].v);
      columns(main, ent.slice(0, 12).map(([k, o]) => ({ label: k, short: k.slice(0, 8), v: o.v, extra: `${o.n}${t("unit")}` })), money, t("tab_chain"));
      hbars(side, ent.map(([k, o]) => ({ k, v: o.n, extra: money(o.v) })).sort((a, b) => b.v - a.v).slice(0, 8), (v) => String(Math.round(v)), t("by_chain"));
      tableData = { head: [t("chain"), t("amount"), t("count")], rows: ent.map(([k, o]) => [k, money(o.v), o.n]) };
    } else {
      const legal = rows.filter((i) => i.type === "sanctions_designation" || i.type === "law_enforcement_action");
      const buckets = [...new Set(rows.map((i) => i.day))].sort().map((d) => { const arr = legal.filter((i) => i.day === d); return { label: fmtDate(d), short: d.slice(5), v: arr.length, extra: arr.map((i) => i.project).slice(0, 3).join(", ") }; });
      columns(main, buckets, (v) => String(Math.round(v)), t("tab_legal"));
      const roles = {}; rows.forEach((i) => i.addresses.forEach((a) => { roles[a.role] = (roles[a.role] || 0) + 1; }));
      hbars(side, Object.entries(roles).map(([k, v]) => ({ k: roleName(k), v })).sort((a, b) => b.v - a.v), (v) => String(Math.round(v)), t("legal_side"));
      tableData = { head: [t("day"), t("count")], rows: buckets.map((b) => [b.label, b.v]) };
    }
  }

  // ---------- 표 ----------
  function renderTable(rows) {
    const tb = $("#incTable tbody");
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); S.page = Math.min(S.page, pages - 1);
    const slice = rows.slice(S.page * PAGE, (S.page + 1) * PAGE);
    if (!rows.length) { tb.innerHTML = `<tr><td colspan="7" class="empty">${t("no_data")}</td></tr>`; $("#pager").innerHTML = ""; return; }
    tb.innerHTML = slice.map((i) => {
      const d = dayOf(i); const rep = i.day !== d && Math.abs((new Date(i.day) - new Date(d)) / 864e5) > 3 ? `<div class="psub">${esc(t("reported"))} ${i.day}</div>` : "";
      return `<tr data-href="${detailUrl(i)}">
        <td><div class="proj"><span class="avatar" style="background:${avatarColor(i.project)}">${esc(initials(i.project))}</span><div><a class="pname" href="${detailUrl(i)}">${esc(i.project)}</a>${i.followup_of ? `<span class="tag">↩ ${esc(t("follow"))} ${esc((i.followup_of.day || "").slice(5))}</span>` : ""}${i.blacklist_hits ? `<span class="tag warn">⚠ ${i.blacklist_hits}</span>` : ""}${rep}</div></div></td>
        <td>${i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="muted">${esc(shortText(i.amount_text))}</span>`}</td>
        <td><span class="date">${esc(fmtDate(d))}</span></td>
        <td>${pill(i)}</td>
        <td>${chainPills(i.chains)}</td>
        <td class="num mono">${i.addresses.length}</td>
        <td class="center" title="${esc(t("sources_n").replace("{n}", i.sources.length))}">${gauge(i.sources.length)}</td>
      </tr>`;
    }).join("");
    $$("tr[data-href]", tb).forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("a")) return; location.href = tr.dataset.href; }));
    $("#pager").innerHTML = `<span>${S.page * PAGE + 1}-${Math.min(rows.length, (S.page + 1) * PAGE)} / ${rows.length}</span>
      <button id="pgPrev" type="button" ${S.page === 0 ? "disabled" : ""}>‹</button><button id="pgNext" type="button" ${S.page >= pages - 1 ? "disabled" : ""}>›</button>`;
    $("#pgPrev").addEventListener("click", () => { S.page--; renderTable(rows); });
    $("#pgNext").addEventListener("click", () => { S.page++; renderTable(rows); });
  }
  const openTable = () => {
    $("#tableBody").innerHTML = `<table><thead><tr>${tableData.head.map((h, k) => `<th class="${k ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${tableData.rows.map((r) => `<tr>${r.map((c, k) => `<td class="${k ? "num" : ""}">${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    $("#tableModal").classList.add("show"); $("#tableModal").setAttribute("aria-hidden", "false");
  };
  const closeTable = () => { $("#tableModal").classList.remove("show"); $("#tableModal").setAttribute("aria-hidden", "true"); };

  // ---------- 이벤트 ----------
  const rerender = () => { S.page = 0; render(); };
  bindChrome(() => { $("#briefingDay").innerHTML = ""; render(); });
  $$("#rangeSeg button").forEach((b) => b.addEventListener("click", () => { $$("#rangeSeg button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); S.range = b.dataset.range; rerender(); }));
  $$("#statTabs .tab").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; renderStats(filtered()); }));
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { $$("#valueMode button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); S.mode = b.dataset.mode; renderStats(filtered()); }));
  $("#typeSel").addEventListener("change", (e) => { S.type = e.target.value; rerender(); });
  $("#chainSel").addEventListener("change", (e) => { S.chain = e.target.value; rerender(); });
  $("#sourceSel").addEventListener("change", (e) => { S.source = e.target.value; rerender(); });
  $("#hideFollow").addEventListener("change", (e) => { S.hideFollow = e.target.checked; rerender(); });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; rerender(); }, 150); });
  $("#briefingDay").addEventListener("change", renderBriefing);
  $("#tableViewBtn").addEventListener("click", openTable); $("#tableClose").addEventListener("click", closeTable);
  $("#tableModal").addEventListener("click", (e) => { if (e.target === $("#tableModal")) closeTable(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTable(); });
  $$(".nav-link").forEach((a) => a.addEventListener("click", () => { $$(".nav-link").forEach((x) => x.classList.remove("on")); a.classList.add("on"); }));
  constellation($("#stars"));

  loadAll().then((d) => { Object.assign(S, d); render(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", `<div class="panel empty">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`); });
})();
