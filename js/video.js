/* ===== 视频导出模块（Canvas + MediaRecorder） ===== */
(function () {
  const SERIF = '"Noto Serif SC","STZhongsong","SimSun",serif';
  const SANS = '"Noto Sans SC","Microsoft YaHei","PingFang SC",sans-serif';
  const CURSIVE = '"Great Vibes",cursive';

  const QUALITY = {
    "720": { w: 1280, h: 720, bitrate: 5000000 },
    "1080": { w: 1920, h: 1080, bitrate: 9000000 },
    "1440": { w: 2560, h: 1440, bitrate: 14000000 },
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const out = [];
    for (const raw of text.split("\n")) {
      if (!raw) { out.push(""); continue; }
      let line = "";
      for (const ch of raw) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = ch; }
        else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawGradientBg(ctx, w, h, t) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#3a1230");
    g.addColorStop(0.5, "#23112c");
    g.addColorStop(1, "#140a1e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 柔和光斑
    const spots = [[0.15, 0.2, "#ff6f9c"], [0.85, 0.3, "#b18cff"], [0.5, 0.9, "#ff8e7a"], [0.9, 0.85, "#ffd6a5"]];
    for (let i = 0; i < spots.length; i++) {
      const [sx, sy, sc] = spots[i];
      const cx = sx * w + Math.sin(t * 0.5 + i) * w * 0.04;
      const cy = sy * h + Math.cos(t * 0.4 + i) * h * 0.04;
      const rad = Math.max(w, h) * 0.32;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, sc + "44");
      rg.addColorStop(1, sc + "00");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawHeart(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(0, 1, -5, -4, -9, -4);
    ctx.bezierCurveTo(-14, -4, -14, 4, -14, 4);
    ctx.bezierCurveTo(-14, 9, -8, 13, 0, 18);
    ctx.bezierCurveTo(8, 13, 14, 9, 14, 4);
    ctx.bezierCurveTo(14, 4, 14, -4, 9, -4);
    ctx.bezierCurveTo(5, -4, 0, 1, 0, 5);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // ---- 各类型幻灯片绘制 ----
  function drawTitle(ctx, slide, w, h, t) {
    drawGradientBg(ctx, w, h, t);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pulse = 1 + Math.sin(t * 1.6) * 0.05;
    drawHeart(ctx, w / 2, h * 0.32, 90 * pulse, "#ff6f9c", 0.95);
    ctx.fillStyle = "#ffd6a5";
    ctx.font = `900 ${Math.round(w * 0.075)}px ${SERIF}`;
    ctx.fillText(slide.title || "我们的时光", w / 2, h * 0.52, w * 0.86);
    if (slide.names) {
      ctx.font = `${Math.round(w * 0.04)}px ${CURSIVE}`;
      ctx.fillStyle = "rgba(255,247,251,0.9)";
      ctx.fillText(slide.names, w / 2, h * 0.62, w * 0.8);
    }
    if (slide.range) {
      ctx.font = `500 ${Math.round(w * 0.026)}px ${SANS}`;
      ctx.fillStyle = "rgba(255,247,251,0.7)";
      ctx.fillText(slide.range, w / 2, h * 0.71, w * 0.8);
    }
  }

  function drawPhoto(ctx, slide, w, h, t, progress) {
    // Ken Burns 效果
    const kb = Math.min(progress, 1);
    const scale = 1.06 + kb * 0.1;
    const img = slide.img;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const baseScale = Math.max(w / iw, h / ih);
    const s = baseScale * scale;
    const dw = iw * s, dh = ih * s;
    const dx = (w - dw) / 2 + Math.sin(kb * Math.PI) * w * 0.01;
    const dy = (h - dh) / 2 - kb * h * 0.02;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
    // 底部渐变信息条
    const g = ctx.createLinearGradient(0, h * 0.62, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffd6a5";
    ctx.font = `500 ${Math.round(w * 0.024)}px ${SANS}`;
    ctx.fillText(slide.date, w * 0.05, h * 0.86);
    if (slide.caption) {
      ctx.fillStyle = "#fff";
      ctx.font = `500 ${Math.round(w * 0.034)}px ${SERIF}`;
      ctx.fillText(slide.caption, w * 0.05, h * 0.92, w * 0.9);
    }
  }

  function drawEntry(ctx, slide, w, h, t) {
    drawGradientBg(ctx, w, h, t);
    const cardX = w * 0.09, cardY = h * 0.16, cardW = w * 0.82, cardH = h * 0.68;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 40;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffd6a5";
    ctx.font = `500 ${Math.round(w * 0.024)}px ${SANS}`;
    ctx.fillText(slide.date, cardX + w * 0.04, cardY + h * 0.065);

    if (slide.mood) {
      ctx.textAlign = "right";
      ctx.font = `${Math.round(w * 0.05)}px ${SANS}`;
      ctx.fillText(slide.mood, cardX + cardW - w * 0.04, cardY + h * 0.075);
      ctx.textAlign = "left";
    }

    let y = cardY + h * 0.16;
    if (slide.title) {
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(w * 0.042)}px ${SERIF}`;
      const tl = wrapText(ctx, slide.title, cardW * 0.92);
      for (const line of tl.slice(0, 2)) { ctx.fillText(line, cardX + w * 0.04, y); y += h * 0.062; }
      y += h * 0.02;
    }

    // 正文自适应字号
    const maxLines = Math.floor((cardH * 0.72 - (y - cardY)) / (h * 0.042));
    let size = Math.round(w * 0.026);
    let lines;
    do {
      ctx.font = `400 ${size}px ${SANS}`;
      lines = wrapText(ctx, slide.content || "", cardW * 0.92);
      if (lines.length <= maxLines || size <= 12) break;
      size -= 2;
    } while (true);
    ctx.fillStyle = "rgba(255,247,251,0.88)";
    const lh = size * 1.55;
    for (const line of lines.slice(0, maxLines)) {
      ctx.fillText(line, cardX + w * 0.04, y);
      y += lh;
    }
    if (lines.length > maxLines) {
      ctx.fillStyle = "rgba(255,247,251,0.5)";
      ctx.fillText("…", cardX + w * 0.04, y - lh + size);
    }
  }

  function drawEnd(ctx, slide, w, h, t) {
    drawGradientBg(ctx, w, h, t);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pulse = 1 + Math.sin(t * 1.4) * 0.06;
    drawHeart(ctx, w / 2, h * 0.36, 80 * pulse, "#ff6f9c", 0.9);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.round(w * 0.07)}px ${SERIF}`;
    ctx.fillText("未完待续", w / 2, h * 0.55);
    if (slide.names) {
      ctx.fillStyle = "#ffd6a5";
      ctx.font = `${Math.round(w * 0.034)}px ${CURSIVE}`;
      ctx.fillText(slide.names, w / 2, h * 0.68);
    }
    ctx.fillStyle = "rgba(255,247,251,0.6)";
    ctx.font = `500 ${Math.round(w * 0.022)}px ${SANS}`;
    ctx.fillText("由「恋爱记录」生成", w / 2, h * 0.8);
  }

  function drawSlide(ctx, slide, w, h, t, progress) {
    switch (slide.type) {
      case "title": drawTitle(ctx, slide, w, h, t); break;
      case "photo": drawPhoto(ctx, slide, w, h, t, progress); break;
      case "entry": drawEntry(ctx, slide, w, h, t); break;
      case "end": drawEnd(ctx, slide, w, h, t); break;
    }
  }

  function buildSlides(opts) {
    const slides = [];
    const range = `${opts.start || ""} — ${opts.end || ""}`;
    const names = `${opts.names[0]}  \u2665  ${opts.names[1]}`;
    const D = opts.duration;
    slides.push({ type: "title", title: opts.title || "我们的时光", names, range, duration: Math.max(4, D * 1.3) });

    const items = [];
    if (opts.includePhotos) for (const p of opts.photos) items.push({ kind: "photo", date: p.date, data: p });
    if (opts.includeEntries) for (const e of opts.entries) items.push({ kind: "entry", date: e.date, data: e });
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    for (const it of items) {
      if (it.kind === "photo") {
        slides.push({ type: "photo", date: it.date, caption: it.data.caption || "", img: it.data._img, duration: D });
      } else {
        slides.push({ type: "entry", date: it.date, title: it.data.title || "", content: it.data.content || "", mood: it.data.mood || "", duration: D });
      }
    }
    slides.push({ type: "end", names, duration: Math.max(4, D * 1.2) });
    return slides;
  }

  async function loadImages(photos) {
    await Promise.all(photos.map((p) => {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(p.blob);
        const img = new Image();
        img.onload = () => { p._img = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = url;
        p._url = url;
      });
    }));
    return photos.filter((p) => p._img);
  }

  function pickMime() {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  }

  async function exportVideo(opts, onProgress) {
    if (!window.MediaRecorder) throw new Error("当前浏览器不支持视频导出，请使用最新版 Chrome / Edge。");
    if (!opts.photos.length && !opts.entries.length) throw new Error("所选时间段内没有照片或随笔。");

    await (document.fonts && document.fonts.ready);
    try { await document.fonts.load(`900 40px ${SERIF}`); } catch (e) {}
    try { await document.fonts.load(`400 30px ${SANS}`); } catch (e) {}

    const photos = await loadImages(opts.photos);
    opts.photos = photos;
    const slides = buildSlides(opts);

    const q = QUALITY[opts.quality] || QUALITY["1080"];
    const canvas = document.createElement("canvas");
    canvas.width = q.w; canvas.height = q.h;
    const ctx = canvas.getContext("2d");

    // 时间轴：相邻幻灯片重叠 transition 秒交叉淡化（支持每个幻灯片不同时长）
    const T = Math.min(1.0, opts.duration / 2);
    let cursor = 0;
    slides.forEach((s) => { s.start = cursor; cursor += s.duration - T; });
    const total = cursor + T;

    function slideAt(t) {
      let idx = slides.length - 1;
      for (let i = 0; i < slides.length; i++) {
        if (t < slides[i].start + slides[i].duration) { idx = i; break; }
      }
      let next = null, blend = 0;
      const nxt = slides[idx + 1];
      if (nxt && t >= nxt.start) {
        next = nxt;
        blend = Math.min(1, (t - nxt.start) / T);
      }
      return { cur: slides[idx], next, blend };
    }

    const stream = canvas.captureStream(30);
    let audioCtx = null, audioEl = null, audioSrc = null, combinedStream = stream;

    if (opts.music) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.resume().catch(() => {});
        audioEl = new Audio();
        audioEl.src = URL.createObjectURL(opts.music);
        audioEl.loop = true;
        audioSrc = audioCtx.createMediaElementSource(audioEl);
        const dest = audioCtx.createMediaStreamDestination();
        audioSrc.connect(dest);
        combinedStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      } catch (e) { combinedStream = stream; }
    }

    const mime = pickMime();
    const rec = new MediaRecorder(combinedStream, { mimeType: mime || undefined, videoBitsPerSecond: q.bitrate });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const finished = new Promise((resolve) => { rec.onstop = resolve; });

    let startTime = null;
    let stopped = false;
    const start0 = performance.now();

    function frame(now) {
      if (stopped) return;
      if (startTime === null) startTime = now;
      const t = Math.min((now - startTime) / 1000, total);
      const { cur, next, blend } = slideAt(t);
      const progress = (t - cur.start) / (cur.duration || 1);
      drawSlide(ctx, cur, q.w, q.h, t, progress);
      if (next) {
        ctx.save();
        ctx.globalAlpha = blend;
        const np = (t - next.start) / (next.duration || 1);
        drawSlide(ctx, next, q.w, q.h, t, np);
        ctx.restore();
      }
      onProgress && onProgress(Math.min(1, t / total));
      if (t >= total) {
        stopped = true;
        try { rec.stop(); } catch (e) {}
        return;
      }
      requestAnimationFrame(frame);
    }

    // 预渲染首帧
    drawSlide(ctx, slides[0], q.w, q.h, 0, 0);
    rec.start(250);
    if (audioEl) {
      if (audioCtx) await audioCtx.resume().catch(() => {});
      await audioEl.play().catch(() => {});
    }
    requestAnimationFrame(frame);
    await finished;
    if (audioEl) { audioEl.pause(); audioEl.src = ""; }
    if (audioCtx) audioCtx.close().catch(() => {});

    const blob = new Blob(chunks, { type: mime || "video/webm" });
    for (const p of photos) { if (p._url) URL.revokeObjectURL(p._url); p._img = null; p._url = null; }
    return { blob, mime: mime || "video/webm", duration: total, slideCount: slides.length };
  }

  window.VideoExporter = { exportVideo, QUALITY };
})();
