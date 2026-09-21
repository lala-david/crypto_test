(() => {
  "use strict";
  const { $, $$, t, roleName, esc, fmtInt, money, moneyFull, fmtDate, explorer, api, renderNav, renderFoot, applyI18n, bindChrome, rangeSeg, statCard, sw, chainPills, detailUrl, bindRows, errorBox } = KL;
  const S = { days: "30" };
  let D = null;

  async function load() {
    const meta = await api("/api/meta");
    const [cur, recent, addrs] = await Promise.all([
      api("/api/stats", { days: S.days }),
      api("/api/incidents", { days: S.days, size: 10, sort: "date" }),
      api("/api/addresses", { days: S.days, size: 60 }),
    ]);
    D = { meta, cur, recent: recent.items, addrs };
    render();
  }
  const shortAddr = (a) => (a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a);
  const amountCell = (i) => (i.amount_usd != null ? moneyFull(i.amount_usd) : `<span class="faint">${esc(t("unknown"))}</span>`);

  let render = function () {
    renderNav("index.html", D.meta); renderFoot(); applyI18n(); bindChrome(() => render());
    rangeSeg($("#rangeSeg"), S.days, (v) => { S.days = v; load(); });
    const c = D.cur;
    $("#sub").innerHTML = `<span>${esc(fmtDate(c.range.from))} – ${esc(fmtDate(c.range.to))}</span>`;
    $("#stats").innerHTML = [
      statCard(t("k_new"), fmtInt(c.new_count), "", null, { cls: "plain" }),
      statCard(t("k_loss"), money(c.loss_amount), "", null, { cls: "plain", title: moneyFull(c.loss_amount) }),
      statCard(t("k_addr"), fmtInt(D.addrs.total), "", null, { cls: "plain" }),
    ].map((h) => h.replace('class="card stat ', 'class="card stat c4 ')).join("");
    // 최근 사건: 사건 · 금액($) · 체인 · 사건일
    const tb = $("#recentTable");
    tb.innerHTML = `<thead><tr><th>${esc(t("th_incident"))}</th><th class="num">${esc(t("th_amount"))}</th><th>${esc(t("th_chain"))}</th><th>${esc(t("th_date"))}</th></tr></thead><tbody>${
      D.recent.map((i) => `<tr class="link" data-href="${detailUrl(i)}"><td>${sw(i.type)}<a class="name" href="${detailUrl(i)}">${esc(i.project)}</a>${i.followup_of ? ` <span class="tag">${esc(t("follow"))}</span>` : ""}</td><td class="num">${amountCell(i)}</td><td>${chainPills(i.chains, 2) || '<span class="faint">–</span>'}</td><td class="date">${esc(fmtDate(i.event_date || i.incident_date || i.day))}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    bindRows(tb);
    // 최근 수집 주소: 주소 · 체인 · 역할 · 사건 (제재·공격자·세탁 우선)
    const pri = { sanctioned: 0, attacker: 1, laundering: 2, victim: 3, unknown: 4 };
    const addrs = D.addrs.items.filter((a) => a.role !== "unknown").sort((a, b) => (b.first_day > a.first_day ? 1 : b.first_day < a.first_day ? -1 : pri[a.role] - pri[b.role])).slice(0, 10);
    $("#addrTable").innerHTML = `<thead><tr><th>${esc(t("th_address"))}</th><th>${esc(t("chain"))}</th><th>${esc(t("addr_role"))}</th><th>${esc(t("th_incident"))}</th></tr></thead><tbody>${
      addrs.map((a) => { const i = a.incidents[0]; const url = explorer(a.chain, a.address);
        return `<tr><td class="addr">${url ? `<a href="${url}" target="_blank" rel="noopener" title="${esc(a.address)}">${esc(shortAddr(a.address))}</a>` : `<span title="${esc(a.address)}">${esc(shortAddr(a.address))}</span>`}<button class="copy" data-copy="${esc(a.address)}" type="button">${esc(t("copy"))}</button>${a.blacklist ? `<span class="tag warn">BL</span>` : ""}</td><td class="mono muted">${esc(a.chain)}</td><td><span class="role ${esc(a.role)}">${esc(roleName(a.role))}</span></td><td>${sw(i.type)}<a class="name" href="incident.html?id=${esc(i.uid)}">${esc(i.project)}</a></td></tr>`; }).join("") || `<tr><td colspan="4" class="empty">${esc(t("no_data"))}</td></tr>`}</tbody>`;
    $$(".copy[data-copy]", $("#addrTable")).forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1200); } catch (_) {} }));
  };
  // ---- 상단 배너: 21st.dev "All about the Benjamins" 디더 효과 (배너 안에만) ----
  // 소스 = 검정 바탕 + 왼쪽 초상(docs/hero.jpg, 달러) + $ 코인 · ₿ 코인 · Ξ 다이아몬드(가상자산). 글자·숫자 텍스트 없음, 글리치 끔.
  let fxInst = null, heroImg = null, heroTried = false;
  const FX_PARAMS = { renderMode: "dither", bgMode: "solid", cellSize: 8, coverage: 96, charSet: "binary", contrast: 115, edgeEmphasis: 40, tint: "#00ff66", tintOpacity: 45, overlayBlend: "overlay",
    pfx: { vignette: { enabled: true, intensity: 38 }, scanLines: { enabled: true, intensity: 28 }, chromatic: { enabled: true, intensity: 25 }, bloom: { enabled: true, intensity: 60 }, filmGrain: { enabled: true, intensity: 40 }, glitch: { enabled: false, intensity: 0 } },
    animated: true, animStyle: "flicker", animSpeed: { enabled: true, intensity: 100 }, animIntensity: { enabled: true, intensity: 25 } };
  function coin(ctx, cx, cy, r, glyph) { // 밝은 코인 + 어두운 기호 (디더 후 기호가 구멍으로 읽힘)
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); g.addColorStop(0, "#f2f2f2"); g.addColorStop(0.7, "#b4b4b4"); g.addColorStop(1, "#5a5a5a");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.07); ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); if (glyph === "B") ctx.rotate(-14 * Math.PI / 180);
    ctx.fillStyle = "#101010"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `800 ${Math.round(r * 1.25)}px Inter, Arial, sans-serif`;
    ctx.fillText(glyph, 0, r * 0.04);
    if (glyph === "B") { const bw = r * 0.09, bh = r * 0.2; ctx.fillRect(-r * 0.2, -r * 0.72, bw, bh); ctx.fillRect(-r * 0.02, -r * 0.72, bw, bh); ctx.fillRect(-r * 0.2, r * 0.52, bw, bh); ctx.fillRect(-r * 0.02, r * 0.52, bw, bh); }
    ctx.restore();
  }
  function ethDiamond(ctx, cx, cy, H) { // 이더리움 다이아몬드: 상단 4면 + 하단 2면, 면마다 밝기 차이
    const W = H * 0.62, y0 = cy - H / 2, L = cx - W / 2, R = cx + W / 2, yM = y0 + H * 0.62, yC = y0 + H * 0.78, yL = y0 + H * 0.68, yB = y0 + H, yI = y0 + H * 0.42;
    const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath(); ctx.fill(); };
    poly([[cx, y0], [L, yM], [cx, yI]], "#d8d8d8"); poly([[cx, y0], [R, yM], [cx, yI]], "#8c8c8c");
    poly([[cx, yI], [L, yM], [cx, yC]], "#a8a8a8"); poly([[cx, yI], [R, yM], [cx, yC]], "#5e5e5e");
    poly([[L, yL], [cx, yB], [cx, yL + H * 0.16]], "#cfcfcf"); poly([[R, yL], [cx, yB], [cx, yL + H * 0.16]], "#707070");
  }
  function heroSource(ctx, w, h) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    let x0 = 0;
    if (heroImg && w > h * 2.4) { // 초상: 왼쪽에 높이 맞춤, 오른쪽 가장자리 검정 페이드
      ctx.drawImage(heroImg, 0, 0, h, h);
      const g = ctx.createLinearGradient(h * 0.8, 0, h, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "#000");
      ctx.fillStyle = g; ctx.fillRect(h * 0.8, 0, h * 0.2, h); x0 = h;
    }
    const A = w - x0; const n = A / h > 2.2 ? 3 : 2; const slot = A / n; const r = Math.min(h * 0.34, slot * 0.3);
    const items = [(x) => coin(ctx, x, h / 2, r, "$"), (x) => coin(ctx, x, h / 2, r, "B"), (x) => ethDiamond(ctx, x, h / 2, r * 2.1)].slice(0, n);
    items.forEach((f, k) => f(x0 + slot * (k + 0.5)));
  }
  function initFx() {
    const cv = $("#fx"); if (!cv || !KL.ascii) return;
    if (!fxInst) { fxInst = KL.ascii(cv, { params: FX_PARAMS, source: heroSource }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fxInst.setSource(heroSource)); }
    else fxInst.setSource(heroSource);
    if (!heroTried) { heroTried = true; const img = new Image(); img.onload = () => { heroImg = img; fxInst.setSource(heroSource); }; img.src = "hero.jpg"; }
  }
  const _render = render; render = function () { _render(); initFx(); };
  load().catch((e) => { $("main").insertAdjacentHTML("afterbegin", errorBox(e)); });
})();
