/* ===== 点击特效（爱心迸发 + 星光粒子 + 长按浪漫氛围） ===== */
(function () {
  const layer = document.createElement("div");
  layer.id = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const HEART_COLORS = ["#ff6f9c", "#ff8e7a", "#ffd6a5", "#b18cff", "#ff9ec4", "#ffffff"];
  const HEARTS = ["\u2665", "\u2661", "\u2764", "\uD83D\uDC96", "\uD83D\uDC97"];

  function spawnHeart(x, y, o) {
    o = o || {};
    const el = document.createElement("span");
    el.className = "fx-heart";
    el.textContent = o.char || HEARTS[(Math.random() * HEARTS.length) | 0];
    const size = o.size || 10 + Math.random() * 16;
    const angle = o.angle !== undefined ? o.angle : Math.random() * Math.PI * 2;
    const dist = o.dist || 36 + Math.random() * 84;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 26;
    el.style.cssText = [
      "left:" + x + "px", "top:" + y + "px", "font-size:" + size + "px",
      "color:" + (o.color || HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0]),
      "--dx:" + dx.toFixed(1) + "px", "--dy:" + dy.toFixed(1) + "px",
      "--rot:" + ((Math.random() - 0.5) * 200).toFixed(1) + "deg",
      "--dur:" + (o.dur || 0.6 + Math.random() * 0.55).toFixed(2) + "s",
      "--delay:" + (o.delay || 0).toFixed(2) + "s",
    ].join(";");
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function spawnSpark(x, y, o) {
    o = o || {};
    const el = document.createElement("span");
    el.className = "fx-spark";
    const size = o.size || 3 + Math.random() * 5;
    const dx = (Math.random() - 0.5) * 140;
    const dy = (Math.random() - 0.5) * 140;
    el.style.cssText = [
      "left:" + x + "px", "top:" + y + "px",
      "width:" + size + "px", "height:" + size + "px",
      "background:" + (o.color || "#ffffff"),
      "--dx:" + dx.toFixed(1) + "px", "--dy:" + dy.toFixed(1) + "px",
      "--dur:" + (0.5 + Math.random() * 0.6).toFixed(2) + "s",
      "--delay:" + (o.delay || 0).toFixed(2) + "s",
    ].join(";");
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  function heartBurst(x, y, count, opts) {
    opts = opts || {};
    for (let i = 0; i < count; i++) {
      spawnHeart(x, y, {
        angle: opts.angle !== undefined ? opts.angle + (i - count / 2) * 0.28 : undefined,
        dist: opts.dist,
        size: opts.size,
        color: opts.color,
      });
    }
    if (opts.sparkle) spawnSpark(x, y, {});
  }

  function ringBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      spawnHeart(x, y, { angle: (i / 8) * Math.PI * 2, dist: 60 + Math.random() * 40, size: 12 + Math.random() * 10 });
    }
  }

  document.addEventListener("pointerdown", function (e) {
    const interactive = e.target.closest(
      ".btn, .nav-btn, .icon-btn, .seg-btn, .bg-option, .mood-btn, .photo-cell, .recent-item, .entry-card, .toggle-item, .brand"
    );
    const x = e.clientX, y = e.clientY;
    if (interactive) {
      if (e.target.closest(".brand") || e.target.closest(".nav-btn.active") === null && e.target.closest(".nav-btn")) {
        heartBurst(x, y, 6);
      } else {
        heartBurst(x, y, 4, { sparkle: true });
      }
    } else {
      heartBurst(x, y, 2);
      spawnSpark(x, y, {});
    }
  }, { passive: true });

  // 双击：一圈爱心
  document.addEventListener("dblclick", function (e) {
    ringBurst(e.clientX, e.clientY);
    spawnSpark(e.clientX, e.clientY, { size: 8 });
  });

  window.__loveEffects = { heartBurst, ringBurst, spawnSpark };
})();
