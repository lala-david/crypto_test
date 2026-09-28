/* 게임 HUD: 등급(S~D) · 자원 표시줄(상단 우측: 사건·피해액·주소, StarCraft 자원 카운터 식) · 위협 게이지 · 숫자 카운트업 */
(() => {
  "use strict";
  const { $, $$, esc, fmtInt, money, api } = KL;
  // 피해액 등급: S ≥ $100M · A ≥ $10M · B ≥ $1M · C ≥ $100K · D 그 외 (미상은 –)
  const TIERS = [["S", 1e8], ["A", 1e7], ["B", 1e6], ["C", 1e5], ["D", 0]];
  const tier = (amount) => { if (amount == null || !(amount > 0)) return ""; for (const [k, min] of TIERS) if (amount >= min) return k; return "D"; };
  const TIER_TIP = { S: "S · $100M 이상", A: "A · $10M 이상", B: "B · $1M 이상", C: "C · $100K 이상", D: "D · $100K 미만" };
  const tierChip = (amount) => { const k = tier(amount); return k ? `<span class="tier t-${k}" title="${esc(TIER_TIP[k])} (${esc(money(amount))})">${k}</span>` : ""; };
  // 위협 레벨 1~5: 기간 피해액 기준
  const threat = (loss) => (loss >= 5e8 ? 5 : loss >= 1e8 ? 4 : loss >= 1e7 ? 3 : loss >= 1e6 ? 2 : loss > 0 ? 1 : 0);
  const threatBar = (loss, label = "THREAT") => { const lv = threat(loss); const names = ["", "LOW", "GUARDED", "ELEVATED", "HIGH", "CRITICAL"];
    return `<div class="threat lv${lv}" title="${esc(money(loss))}"><span class="tl">${esc(label)}</span><span class="segs">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= lv ? "on" : ""}"></i>`).join("")}</span><span class="tn">${names[lv]}</span></div>`; };
  // 카운트업
  const countUp = (el, to, fmt = fmtInt, ms = 900) => { const t0 = performance.now(); const from = 0;
    const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); };
  const countUpAll = (root = document) => $$("[data-countup]", root).forEach((el) => { const v = parseFloat(el.dataset.countup); if (!isNaN(v)) countUp(el, v, el.dataset.money ? money : fmtInt); el.removeAttribute("data-countup"); });
  // 자원 표시줄 아이콘 (미네랄 결정 · 가스 방울 · 보급 육각)
  const RES = {
    crystal: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l5 6-2 12H9L7 8z"/><path d="M7 8h10M12 2v18"/></svg>`,
    gas: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/></svg>`,
    supply: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z"/><path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z"/></svg>`,
  };
  let resCache = null;
  async function resourceBar(el) {
    if (!el) return;
    try { resCache = resCache || await api("/api/stats", { days: "all" }); } catch (_) { return; }
    const s = resCache;
    const T = KL.t;
    el.innerHTML = `<span class="res r-crystal" title="${esc(T("tip_res_new"))}">${RES.crystal}<span class="rl">${esc(T("res_new"))}</span><b data-countup="${s.new_count}">0</b></span><span class="res r-gas" title="${esc(T("tip_res_loss"))}">${RES.gas}<span class="rl">${esc(T("res_loss"))}</span><b data-countup="${s.loss_amount}" data-money="1">$0</b></span><span class="res r-supply" title="${esc(T("tip_res_addr"))}">${RES.supply}<span class="rl">${esc(T("res_addr"))}</span><b data-countup="${s.addresses}">0</b></span>`;
    countUpAll(el);
  }
  Object.assign(KL, { tier, tierChip, threat, threatBar, countUp, countUpAll, resourceBar, RES });
})();
