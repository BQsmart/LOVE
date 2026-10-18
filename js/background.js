/* ===== 动态背景（粒子 + 图片/视频） ===== */
(function () {
  const canvas = document.getElementById("particleCanvas");
  const ctx = canvas.getContext("2d");
  const blobs = document.getElementById("bgBlobs");
  const imgEl = document.getElementById("bgImage");
  const videoEl = document.getElementById("bgVideo");
  const layer = document.getElementById("bgLayer");

  let W = 0, H = 0, DPR = 1;
  const particles = [];
  const COLORS = ["#ff6f9c", "#ff8e7a", "#ffd6a5", "#b18cff", "#ffffff", "#ff9ec4"];
  let currentBgUrl = null;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = layer.clientWidth;
    H = layer.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function makeParticle(initial) {
    const isHeart = Math.random() < 0.55;
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + 30,
      size: isHeart ? 7 + Math.random() * 16 : 2 + Math.random() * 5,
      speed: 0.25 + Math.random() * 0.8,
      sway: 0.4 + Math.random() * 1.2,
      swaySpeed: 0.004 + Math.random() * 0.01,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.25 + Math.random() * 0.5,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      isHeart,
      rot: (Math.random() - 0.5) * 0.6,
      rotSpeed: (Math.random() - 0.5) * 0.01,
    };
  }

  function drawHeart(x, y, size, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
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
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.restore();
  }

  function drawDot(x, y, size, color, alpha) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.y -= p.speed;
      p.x += Math.sin(p.phase) * p.sway;
      p.phase += p.swaySpeed;
      p.rot += p.rotSpeed;
      if (p.isHeart) drawHeart(p.x, p.y, p.size, p.rot, p.color, p.alpha);
      else drawDot(p.x, p.y, p.size, p.color, p.alpha);
      if (p.y < -40) Object.assign(p, makeParticle(false));
    }
    requestAnimationFrame(tick);
  }

  function seed(count) {
    for (let i = 0; i < count; i++) particles.push(makeParticle(true));
  }

  function setLayerState(type, url) {
    if (currentBgUrl && currentBgUrl.startsWith("blob:")) URL.revokeObjectURL(currentBgUrl);
    imgEl.classList.remove("show");
    videoEl.classList.remove("show");
    blobs.style.display = type === "default" ? "block" : "none";
    canvas.style.display = type === "video" ? "none" : "block";
    if (type === "default") {
      imgEl.removeAttribute("src");
      videoEl.removeAttribute("src");
      currentBgUrl = null;
    } else if (type === "image") {
      currentBgUrl = url;
      imgEl.src = url;
      imgEl.classList.add("show");
      videoEl.removeAttribute("src");
    } else if (type === "video") {
      currentBgUrl = url;
      videoEl.src = url;
      videoEl.classList.add("show");
      imgEl.removeAttribute("src");
      videoEl.play().catch(() => {});
    }
  }

  async function loadSaved() {
    const settings = await window.DBStore.getSettings();
    const bg = settings.background || { type: "default" };
    if (bg.type === "default") {
      setLayerState("default");
      return;
    }
    const media = await window.DBStore.getBgMedia().catch(() => null);
    if (media && media.blob) {
      const url = URL.createObjectURL(media.blob);
      setLayerState(bg.type, url);
    } else {
      setLayerState("default");
    }
  }

  window.Background = {
    init() {
      resize();
      seed(Math.min(70, Math.floor(W / 22)));
      requestAnimationFrame(tick);
      window.addEventListener("resize", () => {
        resize();
        const target = Math.min(70, Math.floor(W / 22));
        while (particles.length < target) particles.push(makeParticle(true));
        while (particles.length > target) particles.pop();
      });
      loadSaved();
    },
    apply(type, url) {
      setLayerState(type, url);
    },
    defaultBg() {
      setLayerState("default");
    },
  };
})();
