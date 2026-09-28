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
    // 순위 막대 행: 라벨 | 건수 · 비중 · 금액 (숫자 열 고정 폭으로 세로 정렬) + 비중 막대(전체 대비 %)
    const rk = (o) => `<div class="rk ${o.cls || ""}" ${o.title ? `title="${esc(o.title)}"` : ""}><div class="rk-h"><span class="rk-l">${o.icon || ""}<span class="rk-t">${esc(o.label)}</span>${o.tag || ""}</span><span class="rk-n"><b>${fmtInt(o.n)}</b><span class="pct">${fmtPct(o.pct)}</span><span class="amt">${o.amt != null ? o.amt : ""}</span></span></div><div class="rk-bar"><i style="width:${(o.pct * 100).toFixed(1)}%;background:${o.color}"></i>${o.sub ? `<i class="sub" style="width:${(o.sub * 100).toFixed(1)}%"></i>` : ""}</div></div>`;
    const amtOf = (r) => (r.known ? `<span title="${moneyFull(r.amount)}">${esc(money(r.amount))}</span>` : `<span class="faint">–</span>`);
    // 유형
    const types = st.by_type.filter((r) => r.new).sort((a, b) => b.new - a.new || b.amount - a.amount); const tn = types.reduce((a, r) => a + r.new, 0) || 1;
    $("#typeRank").innerHTML = types.map((r) => rk({ icon: KL.avatar({ type: r.key }, "sm"), label: typeName(r.key), title: typeFull(r.key), n: r.new, pct: r.new / tn, amt: amtOf(r), color: typeColorHex(r.key) })).join("");
    $("#metaType").textContent = `${types.length}`;
    // 체인: 2건 이상은 막대, 1건 체인은 칩 격자, unknown 은 마지막(흐림)
    const chainsAll = st.by_chain.filter((r) => r.new).sort((a, b) => (a.key === "unknown") - (b.key === "unknown") || b.new - a.new || b.amount - a.amount);
    const cn = chainsAll.reduce((a, r) => a + r.new, 0) || 1;
    const main = chainsAll.filter((r) => r.new >= 2 && r.key !== "unknown"), tail = chainsAll.filter((r) => r.new < 2 && r.key !== "unknown"), unk = chainsAll.find((r) => r.key === "unknown");
    const chainIcon = (r, sz = 18) => `<span class="rk-ci">${KL.chainIcon(KL.chainName(r.key), sz)}</span>`;
    let h = main.map((r) => rk({ icon: chainIcon(r), label: r.key, n: r.new, pct: r.new / cn, amt: amtOf(r), color: KL.chainColor(r.key) })).join("");
    if (tail.length) { const tn2 = tail.reduce((a, r) => a + r.new, 0); h += rk({ icon: `<span class="rk-ci multi">${tail.slice(0, 3).map((r) => KL.chainIcon(r.key, 14)).join("")}</span>`, label: t("chains_single").replace("{n}", tail.length), n: tn2, pct: tn2 / cn, amt: amtOf({ known: tail.some((r) => r.known), amount: tail.reduce((a, r) => a + r.amount, 0) }), color: "var(--ink-3)", cls: "muted-row" }); }
    if (unk) h += rk({ icon: chainIcon(unk), label: t("unknown"), title: t("tip_chain_unknown"), n: unk.new, pct: unk.new / cn, amt: amtOf(unk), color: "var(--ink-3)", cls: "faint-row" });
    $("#chainRank").innerHTML = h;
    $("#chainTail").innerHTML = tail.length ? `<div class="tail-h">${esc(t("chains_single").replace("{n}", tail.length))}</div><div class="chips-grid">${tail.map((r) => `<div class="chip2" title="${esc(r.key)} · ${r.new}${esc(t("unit"))}${r.known ? " · " + moneyFull(r.amount) : ""}">${KL.chainIcon(r.key, 18)}<span class="cn">${esc(r.key)}</span><span class="ca">${r.known ? esc(money(r.amount)) : "–"}</span></div>`).join("")}</div>` : "";
    $("#chainTail").hidden = !tail.length;
    $("#metaChain").textContent = `${chainsAll.filter((r) => r.key !== "unknown").length}`;
    // 주소 역할: 역할 | 주소 수 · 비중 · BL n (막대 안 줄무늬 = 블랙리스트 일치 비율)
    const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]); const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
    const rbl = st.roles_bl || {};
    const RCOL = { sanctioned: "var(--t-sanction)", attacker: "var(--up)", laundering: "var(--warn)", victim: "var(--t-law)", unknown: "var(--ink-3)" };
    $("#rolesRank").innerHTML = roles.map(([k, v]) => rk({ icon: `<span class="rk-ri ${esc(k)}">${KL.roleIcon(k)}</span>`, label: roleName(k), title: t("tip_role_" + k), n: v, pct: v / rt, amt: rbl[k] ? `<span class="bl" title="${esc(t("legend_bl"))}">BL ${fmtInt(rbl[k])}</span>` : "", color: RCOL[k] || "var(--chart)", sub: rbl[k] ? rbl[k] / rt : 0, cls: k === "unknown" ? "faint-row" : "" })).join("");
    $("#metaRoles").textContent = `${fmtInt(st.addresses)} ${t("addresses")}`;
    KL.countUpAll();
  }
  $$("#valueMode button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; render(); }));
  api("/api/meta").then((m) => { meta = m; return load(); }).catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
