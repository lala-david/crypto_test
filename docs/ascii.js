/* 21st.dev "All about the Benjamins" ASCII-art 효과의 Canvas2D 재구현 (KL.ascii)
   파이프라인: 소스 이미지 → cellSize 격자 샘플링(평균 밝기·색) → renderMode 별 프리미티브 → 색 보정(brightness/contrast/saturation/grayscale) → tint 오버레이
   → 후처리(vignette/scanLines/chromatic/bloom/filmGrain/glitch/pixelate/halftone/filmDust) → 애니메이션(flicker/wave/pulse/shimmer/ripple)
   사용: KL.ascii(canvas, { source: <img|canvas|function(ctx,w,h)>, params: {...JSON...} }) → { stop(), setSource(src) } */
(() => {
  "use strict";
  const DEFAULTS = {
    renderMode: "dither", bgMode: "solid", bgBlur: 12, bgOpacity: 90, cellSize: 14, coverage: 96, invert: false, styleBlend: "source-over",
    charSet: "binary", customChars: "", brightness: 0, contrast: 115, edgeEmphasis: 40, density: 0, toneCurve: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    tint: "#00ff66", tintOpacity: 45, overlayBlend: "overlay", saturation: 100, grayscale: 0, blurType: "off", blurAmount: 35,
    pfx: { vignette: { enabled: true, intensity: 38 }, scanLines: { enabled: true, intensity: 28 }, chromatic: { enabled: true, intensity: 40 }, bloom: { enabled: true, intensity: 60 },
      filmGrain: { enabled: true, intensity: 40 }, glitch: { enabled: true, intensity: 20 }, pixelate: { enabled: false, intensity: 15 }, halftone: { enabled: false, intensity: 20 }, filmDust: { enabled: false, intensity: 20 } },
    animated: true, animStyle: "flicker", animSpeed: { enabled: true, intensity: 100 }, animIntensity: { enabled: true, intensity: 60 },
    lights: { enabled: false, points: [] }, mask: { enabled: false, dataUrl: null, invert: false },
  };
  const CHARSETS = { binary: "01", ascii: " .:-=+*#%@", blocks: " ░▒▓█", hex: "0123456789ABCDEF", dots: " ·•●", katakana: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ" };
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const hex2rgb = (h) => { const s = h.replace("#", ""); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };

  function ascii(canvas, opts = {}) {
    const P = deepMerge(DEFAULTS, opts.params || {});
    const ctx = canvas.getContext("2d");
    let src = null, srcCanvas = document.createElement("canvas"), cells = null, W = 0, H = 0, cols = 0, rows = 0;
    let raf = 0, running = true, t0 = performance.now(), frame = 0;
    const off = document.createElement("canvas"), octx = off.getContext("2d");
    const fx = document.createElement("canvas"), fctx = fx.getContext("2d");
    const grain = document.createElement("canvas"), gctx = grain.getContext("2d");
    const tint = hex2rgb(P.tint);
    const chars = P.charSet === "custom" && P.customChars ? P.customChars : (CHARSETS[P.charSet] || CHARSETS.ascii);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth || canvas.parentElement.clientWidth || 800, h = canvas.clientHeight || 240;
      W = Math.max(64, Math.round(w * dpr)); H = Math.max(64, Math.round(h * dpr));
      canvas.width = W; canvas.height = H; off.width = fx.width = W; off.height = fx.height = H; grain.width = 128; grain.height = 128;
      sample();
    }
    function setSource(s) { src = s; sample(); }
    function drawSource() {
      srcCanvas.width = W; srcCanvas.height = H; const c = srcCanvas.getContext("2d");
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      if (typeof src === "function") src(c, W, H);
      else if (src && (src.width || src.naturalWidth)) { // cover-fit
        const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height; const s = Math.max(W / sw, H / sh);
        c.drawImage(src, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
      }
      return c;
    }
    function sample() {
      if (!W) return;
      const c = drawSource(); const cs = Math.max(4, Math.round(P.cellSize * (W / (canvas.clientWidth || W))));
      cols = Math.ceil(W / cs); rows = Math.ceil(H / cs);
      const data = c.getImageData(0, 0, W, H).data;
      const lum = new Float32Array(cols * rows), col = new Uint8ClampedArray(cols * rows * 3);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = j * cs; y < Math.min(H, (j + 1) * cs); y += 2) for (let x = i * cs; x < Math.min(W, (i + 1) * cs); x += 2) { const k = (y * W + x) * 4; r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        const k = j * cols + i; col[k * 3] = r / n; col[k * 3 + 1] = g / n; col[k * 3 + 2] = b / n;
        let L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255;
        L = clamp(((L - 0.5) * (P.contrast / 100)) + 0.5 + P.brightness / 100, 0, 1);
        lum[k] = P.invert ? 1 - L : L;
      }
      // edge emphasis: Sobel on cell luminance
      const edge = new Float32Array(cols * rows);
      if (P.edgeEmphasis > 0) for (let j = 1; j < rows - 1; j++) for (let i = 1; i < cols - 1; i++) {
        const g = (k) => lum[k]; const k = j * cols + i;
        const gx = -g(k - cols - 1) - 2 * g(k - 1) - g(k + cols - 1) + g(k - cols + 1) + 2 * g(k + 1) + g(k + cols + 1);
        const gy = -g(k - cols - 1) - 2 * g(k - cols) - g(k - cols + 1) + g(k + cols - 1) + 2 * g(k + cols) + g(k + cols + 1);
        edge[k] = clamp(Math.hypot(gx, gy), 0, 1);
      }
      cells = { cs, lum, col, edge };
      makeGrain();
    }
    function makeGrain() { const id = gctx.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gctx.putImageData(id, 0, 0); }

    function drawCells(time) {
      const { cs, lum, col, edge } = cells; const x = octx;
      x.globalCompositeOperation = "source-over";
      // background
      if (P.bgMode === "solid") { x.fillStyle = "#000"; x.fillRect(0, 0, W, H); }
      else if (P.bgMode === "blur" || P.bgMode === "photo") { x.filter = P.bgMode === "blur" ? `blur(${P.bgBlur}px)` : "none"; x.globalAlpha = P.bgOpacity / 100; x.drawImage(srcCanvas, 0, 0); x.filter = "none"; x.globalAlpha = 1; }
      else x.clearRect(0, 0, W, H);
      x.globalCompositeOperation = P.styleBlend || "source-over";
      const anim = P.animated && P.animIntensity.enabled ? P.animIntensity.intensity / 100 : 0;
      const speed = P.animSpeed.enabled ? P.animSpeed.intensity / 100 : 1;
      const T = time * 0.001 * speed;
      const [tr, tg, tb] = tint;
      x.font = `${Math.round(cs * 0.95)}px "JetBrains Mono", monospace`; x.textAlign = "center"; x.textBaseline = "middle";
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i; const h = hash(i, j);
        if (h > P.coverage / 100) continue;
        let L = lum[k]; let e = (edge[k] || 0) * (P.edgeEmphasis / 100); L = clamp(L + e * 0.8, 0, 1);
        // animation
        let a = 1;
        if (anim) {
          if (P.animStyle === "wave") L = clamp(L + Math.sin(T * 2 + i * 0.35) * 0.15 * anim, 0, 1);
          else if (P.animStyle === "pulse") a = 1 - anim * 0.5 * (0.5 + 0.5 * Math.sin(T * 3));
          else if (P.animStyle === "shimmer") a = 1 - anim * 0.6 * hash(i + Math.floor(T * 8), j);
          else if (P.animStyle === "ripple") L = clamp(L + Math.sin(T * 3 - Math.hypot(i - cols / 2, j - rows / 2) * 0.4) * 0.12 * anim, 0, 1);
          else /* flicker */ { const f = hash(Math.floor(T * 14) + i * 7, j * 3); a = f < 0.08 * anim ? 0.25 : 1 - anim * 0.15 * hash(Math.floor(T * 30), i + j); }
        }
        const px = i * cs, py = j * cs, sat = P.saturation / 100, gs = P.grayscale / 100;
        let r = col[k * 3], g = col[k * 3 + 1], b = col[k * 3 + 2];
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = gray + (r - gray) * sat; g = gray + (g - gray) * sat; b = gray + (b - gray) * sat;
        r = r * (1 - gs) + gray * gs; g = g * (1 - gs) + gray * gs; b = b * (1 - gs) + gray * gs;
        const bright = 40 + L * 215; // 밝기 기반 톤 (색은 tint 오버레이에서 입힘)
        x.fillStyle = `rgba(${Math.round(bright)},${Math.round(bright)},${Math.round(bright)},${a})`;
        const mode = P.renderMode;
        if (mode === "dither") {
          const thr = (BAYER[j & 3][i & 3] + 0.5) / 16; if (L < thr * (1 - P.density / 200)) continue;
          const s = cs * (0.55 + 0.4 * L); x.fillRect(px + (cs - s) / 2, py + (cs - s) / 2, s, s);
        } else if (mode === "characters" || mode === "hexdump" || mode === "matrix") {
          const set = mode === "hexdump" ? CHARSETS.hex : mode === "matrix" ? CHARSETS.katakana + "01" : chars;
          const ch = set[Math.min(set.length - 1, Math.floor(L * set.length))]; if (ch === " ") continue;
          x.fillText(ch, px + cs / 2, py + cs / 2);
        } else if (mode === "dots" || mode === "bubbles") { const rr = cs * 0.5 * L; if (rr < 0.6) continue; x.beginPath(); x.arc(px + cs / 2, py + cs / 2, rr, 0, Math.PI * 2); x.fill(); }
        else if (mode === "pixel" || mode === "mosaic" || mode === "voxel" || mode === "lego") { if (L < 0.06) continue; x.fillRect(px + 1, py + 1, cs - 2, cs - 2); }
        else if (mode === "lines" || mode === "hatch" || mode === "diagonal") { if (L < 0.1) continue; x.fillRect(px, py + cs / 2 - 1, cs * L, 2); }
        else if (mode === "cross" || mode === "stars") { if (L < 0.15) continue; const s = cs * L; x.fillRect(px + cs / 2 - 1, py + (cs - s) / 2, 2, s); x.fillRect(px + (cs - s) / 2, py + cs / 2 - 1, s, 2); }
        else if (mode === "diamond" || mode === "triangles" || mode === "hexagons") { if (L < 0.1) continue; const s = cs * 0.5 * L; x.beginPath(); x.moveTo(px + cs / 2, py + cs / 2 - s); x.lineTo(px + cs / 2 + s, py + cs / 2); x.lineTo(px + cs / 2, py + cs / 2 + s); x.lineTo(px + cs / 2 - s, py + cs / 2); x.closePath(); x.fill(); }
        else if (mode === "rings" || mode === "hearts") { if (L < 0.1) continue; x.beginPath(); x.lineWidth = 1.5; x.strokeStyle = x.fillStyle; x.arc(px + cs / 2, py + cs / 2, cs * 0.45 * L, 0, Math.PI * 2); x.stroke(); }
        else if (mode === "halfblocks") { const a1 = L > 0.5 ? 1 : 0, a2 = L > 0.25 ? 1 : 0; if (a1) x.fillRect(px, py, cs, cs / 2); if (a2) x.fillRect(px, py + cs / 2, cs, cs / 2); }
        else if (mode === "contour") { const band = Math.floor(L * 8); if (band % 2 === 0) continue; x.fillRect(px, py, cs, 1); }
        else if (mode === "braille") { for (let q = 0; q < 8; q++) if (hash(i * 8 + q, j) < L) x.fillRect(px + (q % 2) * cs / 2 + 1, py + Math.floor(q / 2) * cs / 4 + 1, 2, 2); }
        else { const thr = (BAYER[j & 3][i & 3] + 0.5) / 16; if (L < thr) continue; x.fillRect(px + 1, py + 1, cs - 2, cs - 2); }
      }
      x.globalCompositeOperation = "source-over";
      // tint overlay
      if (P.tintOpacity > 0) { x.globalCompositeOperation = P.overlayBlend || "overlay"; x.globalAlpha = P.tintOpacity / 100; x.fillStyle = `rgb(${tr},${tg},${tb})`; x.fillRect(0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; }
      // 색 있는 톤: 화면 위에 tint 를 multiply 로 한 번 더 (초록 CRT 느낌)
      x.globalCompositeOperation = "multiply"; x.fillStyle = `rgb(${Math.round(tr * 0.75 + 64)},${Math.round(tg * 0.75 + 64)},${Math.round(tb * 0.75 + 64)})`; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
    }

    function post(time) {
      const f = fctx, p = P.pfx; f.globalCompositeOperation = "source-over"; f.globalAlpha = 1; f.filter = "none";
      f.clearRect(0, 0, W, H); f.drawImage(off, 0, 0);
      const on = (k) => p[k] && p[k].enabled; const I = (k) => (p[k] ? p[k].intensity : 0) / 100;
      if (on("bloom")) { f.globalCompositeOperation = "lighter"; f.globalAlpha = 0.35 * I("bloom") + 0.15; f.filter = `blur(${Math.round(4 + 10 * I("bloom"))}px)`; f.drawImage(off, 0, 0); f.filter = "none"; f.globalAlpha = 1; f.globalCompositeOperation = "source-over"; }
      if (on("chromatic")) { const d = Math.round(1 + 6 * I("chromatic")); f.globalCompositeOperation = "lighter"; f.globalAlpha = 0.35 * I("chromatic");
        f.filter = "none"; f.drawImage(off, -d, 0); f.drawImage(off, d, 0); f.globalAlpha = 1; f.globalCompositeOperation = "source-over"; }
      if (on("glitch")) { const T = time * 0.001; const n = Math.floor(2 + 4 * I("glitch")); for (let k = 0; k < n; k++) { if (hash(Math.floor(T * 6) + k, 3) > 0.35 * I("glitch") + 0.05) continue; const y = Math.floor(hash(k, Math.floor(T * 6)) * H), h = 4 + Math.floor(hash(k + 9, Math.floor(T * 6)) * 24), dx = Math.round((hash(k + 2, Math.floor(T * 6)) - 0.5) * 40 * I("glitch") * 2); f.drawImage(off, 0, y, W, h, dx, y, W, h); } }
      if (on("scanLines")) { f.globalAlpha = 0.6 * I("scanLines"); f.fillStyle = "#000"; const step = Math.max(2, Math.round(3 * (W / 1200))); for (let y = 0; y < H; y += step * 2) f.fillRect(0, y, W, step); f.globalAlpha = 1; }
      if (on("filmGrain")) { f.globalCompositeOperation = "overlay"; f.globalAlpha = 0.9 * I("filmGrain"); const pat = f.createPattern(grain, "repeat"); f.fillStyle = pat; f.save(); f.translate(Math.floor(hash(frame, 1) * 128), Math.floor(hash(1, frame) * 128)); f.fillRect(-128, -128, W + 256, H + 256); f.restore(); f.globalAlpha = 1; f.globalCompositeOperation = "source-over"; }
      if (on("vignette")) { const g = f.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${0.95 * I("vignette")})`); f.fillStyle = g; f.fillRect(0, 0, W, H); }
      if (on("pixelate")) { const s = Math.max(2, Math.round(2 + 10 * I("pixelate"))); f.imageSmoothingEnabled = false; f.drawImage(fx, 0, 0, W / s, H / s); f.drawImage(fx, 0, 0, W / s, H / s, 0, 0, W, H); f.imageSmoothingEnabled = true; }
      if (on("filmDust")) { f.fillStyle = "rgba(255,255,255,.35)"; for (let k = 0; k < 20 * I("filmDust"); k++) f.fillRect(hash(frame + k, 5) * W, hash(5, frame + k) * H, 1, 1 + hash(k, frame) * 3); }
      if (P.lights && P.lights.enabled) for (const l of P.lights.points || []) { const g = f.createRadialGradient(l.x * W, l.y * H, 0, l.x * W, l.y * H, (l.radius || 0.3) * W); g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${(l.intensity || 50) / 100})`); g.addColorStop(1, "rgba(0,0,0,0)"); f.globalCompositeOperation = "lighter"; f.fillStyle = g; f.fillRect(0, 0, W, H); f.globalCompositeOperation = "source-over"; }
      ctx.clearRect(0, 0, W, H); ctx.drawImage(fx, 0, 0);
    }
    let last = 0;
    function loop(ms) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (ms - last < 1000 / 24) return; last = ms; frame++;
      if (!cells) return;
      if (frame % 6 === 0) makeGrain();
      drawCells(ms - t0); post(ms - t0);
      if (!P.animated) { running = false; cancelAnimationFrame(raf); }
    }
    const ro = new ResizeObserver(() => resize()); ro.observe(canvas);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) P.animated = false;
    if (opts.source) src = opts.source;
    resize(); raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running && P.animated) { running = true; raf = requestAnimationFrame(loop); } });
    return { stop() { running = false; cancelAnimationFrame(raf); ro.disconnect(); }, setSource, params: P };
  }
  function deepMerge(a, b) { const o = Array.isArray(a) ? a.slice() : { ...a }; for (const k of Object.keys(b || {})) o[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") ? deepMerge(a[k], b[k]) : b[k]; return o; }
  window.KL = window.KL || {}; window.KL.ascii = ascii; window.KL.ASCII_DEFAULTS = DEFAULTS;
})();
