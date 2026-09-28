/* 통계: 기간·유형·체인 필터 → 시계열 + 유형/체인 표(신규 기준) + 일별 표 + 제재·수사 + 주소 역할 */
(() => {
  "use strict";
  const { $, $$, t, typeName, typeFull, roleName, esc, fmtInt, fmtPct, money, moneyFull, fmtDate, fmtMD, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, columns, typeColorHex, hbars, fillSelect, sw, chainName, errorBox } = KL;
  const S = { days: "30", mode: "amount" };
  let meta = null, st = null;

  async function load() { st = await api("/api/stats", { days: S.days }); render(); }
  function render() {
    renderNav("stats.html", meta); renderFoot(); applyI18n(); bindChrome(render);
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    $$("#valueMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
    $("#sub").innerHTML = `<span>${esc(fmtDate(st.range.from))} – ${esc(fmtDate(st.range.to))}</span><span class="m">${esc(t("new_label"))} ${fmtInt(st.new_count)}${esc(t("unit"))}</span><span class="m">${esc(t("follow"))} ${fmtInt(st.followup_count)}</span><span class="m" title="${moneyFull(st.total_amount)}">${esc(money(st.total_amount))}</span>`;
    const byAmt = S.mode === "amount"; const cnt = (v) => String(Math.round(v));
    $("#tsTitle").textContent = byAmt ? t("daily_amount") : t("daily_count");
    columns($("#tsPlot"), st.daily.map((d) => ({ label: fmtMD(d.day), v: byAmt ? d.amount : d.count, extra: byAmt ? `${d.count}${t("unit")}` : money(d.amount) })), byAmt ? money : cnt, $("#tsTitle").textContent, { height: 240 });
    // 공통 열: 이름 | 건수 | 막대 | 비중 | 금액(또는 사건). 세 표가 같은 colgroup 을 써서 칸이 맞는다.
    const COLS = `<colgroup><col class="s-name"><col class="s-new"><col class="s-bar"><col class="s-pct"><col class="s-amt"></colgroup>`;
    const head = (k, cnt = t("th_new"), last = t("th_amount")) => `${COLS}<thead><tr><th>${esc(k)}</th><th class="num">${esc(cnt)}</th><th></th><th class="num">${esc(t("th_share"))}</th><th class="num">${esc(last)}</th></tr></thead>`;
    const bar = (v, mx, col) => `<td class="barcol"><div class="bar"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${col}"></i></div></td>`;
    const rows = (list, key, color, mx, n) => { n = n || list.reduce((a, r) => a + r.new, 0) || 1; mx = mx || Math.max(...list.map((r) => r.new), 1);
      return `<tbody>${list.map((r) => `<tr class="${r.key === "unknown" ? "faint-row" : ""}"><td class="nowrap">${key(r)}</td><td class="num">${fmtInt(r.new)}</td>${bar(r.new, mx, color ? color(r) : "var(--chart)")}<td class="num">${fmtPct(r.new / n)}</td><td class="num">${r.known ? money(r.amount) : '<span class="faint">–</span>'}</td></tr>`).join("")}</tbody>`; };
    // 유형
    const types = st.by_type.filter((r) => r.new).sort((a, b) => b.new - a.new || b.amount - a.amount);
    $("#typeTable").innerHTML = head(t("type")) + rows(types, (r) => `${KL.avatar({ type: r.key })}<span title="${esc(typeFull(r.key))}">${esc(typeName(r.key))}</span>`, (r) => typeColorHex(r.key));
    $("#metaType").textContent = `${types.length}`;
    // 체인: 전부 표시(2열), unknown 은 마지막
    const chainsAll = st.by_chain.filter((r) => r.new).sort((a, b) => (a.key === "unknown") - (b.key === "unknown") || b.new - a.new || b.amount - a.amount);
    const cn = chainsAll.reduce((a, r) => a + r.new, 0) || 1, cmx = Math.max(...chainsAll.map((r) => r.new), 1), half = Math.ceil(chainsAll.length / 2);
    const chainKey = (r) => KL.chainPill(r.key, true), chainCol = (r) => (r.key === "unknown" ? "var(--ink-3)" : KL.chainColor(r.key));
    $("#chainTable").innerHTML = head(t("chain")) + rows(chainsAll.slice(0, half), chainKey, chainCol, cmx, cn);
    const right = chainsAll.slice(half), filler = right.length && right.length < half ? `<tr class="filler"><td colspan="5"></td></tr>`.repeat(half - right.length) : "";
    $("#chainTable2").innerHTML = right.length ? head(t("chain")) + rows(right, chainKey, chainCol, cmx, cn).replace("</tbody>", filler + "</tbody>") : "";
    $("#chainTable2").hidden = chainsAll.length <= half;
    $("#metaChain").textContent = `${chainsAll.filter((r) => r.key !== "unknown").length}`;
    // 주소 역할: 역할 | 주소 | 막대 | 비중 | 사건 (+ BL 태그) + 합계 행
    const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
    const rinc = st.roles_inc || {}, rbl = st.roles_bl || {}, rmx = Math.max(...roles.map((r) => r[1]), 1);
    const RCOL = { sanctioned: "var(--t-sanction)", attacker: "var(--up)", laundering: "var(--warn)", victim: "var(--t-law)", unknown: "var(--ink-3)" };
    $("#rolesTable").innerHTML = head(t("addr_role"), t("th_addr_count"), t("th_incidents")) + `<tbody>${roles.map(([k, v]) => `<tr class="${k === "unknown" ? "faint-row" : ""}"><td class="nowrap">${KL.roleBadge(k)}${rbl[k] ? `<span class="tag warn" title="${esc(t("legend_bl"))}">BL ${fmtInt(rbl[k])}</span>` : ""}</td><td class="num">${fmtInt(v)}</td>${bar(v, rmx, RCOL[k] || "var(--chart)")}<td class="num">${fmtPct(v / rt)}</td><td class="num">${rinc[k] != null ? fmtInt(rinc[k]) : '<span class="faint">–</span>'}</td></tr>`).join("")}<tr class="total"><td>${esc(t("sum"))}</td><td class="num">${fmtInt(rt)}</td><td></td><td class="num">100%</td><td class="num">${fmtInt(st.new_count)}</td></tr></tbody>`;
    $("#metaRoles").textContent = `${fmtInt(st.addresses)} ${t("addresses")}`;
    KL.countUpAll();
  }
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; render(); }));
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
