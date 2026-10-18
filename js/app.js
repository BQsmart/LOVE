/* ===== 恋爱记录 · 主应用逻辑 ===== */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let settings = null;
  let entries = [];
  let photos = [];
  const photoUrls = new Map();

  let editingEntryId = null;
  let selectedMood = "";
  let pendingPhotos = []; // {blob, url, name}
  let currentLightboxId = null;
  let musicFile = null;
  let exportQualityVar = "1080";
  let bgType = "default";
  let bgObjectUrl = null;
  let exporting = false;

  // ===== 工具 =====
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fmtDate(ymd) {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-");
    return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
  }
  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  function toast(msg, isErr) {
    const el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    $("#toastContainer").appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 2600);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
  }

  function setPhotoUrl(p) {
    if (!photoUrls.has(p.id)) photoUrls.set(p.id, URL.createObjectURL(p.blob));
    return photoUrls.get(p.id);
  }
  function revokePhotoUrl(id) {
    if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); }
  }

  // 图片降采样到最长边 1920
  function downscaleImage(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        let { width: w, height: h } = img;
        const scale = Math.min(1, MAX / Math.max(w, h));
        if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale); }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const cx = c.getContext("2d");
        cx.fillStyle = "#fff";
        cx.fillRect(0, 0, w, h);
        cx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // ===== 水波纹 =====
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".btn, .nav-btn, .icon-btn, .seg-btn, .bg-option");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = size + "px";
    span.style.left = e.clientX - rect.left - size / 2 + "px";
    span.style.top = e.clientY - rect.top - size / 2 + "px";
    el.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });

  // ===== 路由 =====
  function switchView(name) {
    $$(".view").forEach((v) => v.classList.remove("active"));
    $("#view-" + name).classList.add("active");
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "home") renderHome();
    else if (name === "records") renderTimeline();
    else if (name === "photos") renderPhotos();
    else if (name === "export") renderExport();
    else if (name === "settings") renderSettings();
  }
  $$(".nav-btn").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  $$("[data-view-target]").forEach((el) => el.addEventListener("click", () => switchView(el.dataset.viewTarget)));
  $("#brandTitle").addEventListener("click", () => switchView("home"));

  // ===== 计时 =====
  function yearsMonthsDays(start, now) {
    let y = now.getFullYear() - start.getFullYear();
    let m = now.getMonth() - start.getMonth();
    let d = now.getDate() - start.getDate();
    if (d < 0) {
      m -= 1;
      d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (m < 0) { y -= 1; m += 12; }
    if (y < 0) { y = 0; m = 0; d = 0; }
    return { y, m, d };
  }

  function updateClock() {
    const now = new Date();
    $("#homeWeekday").textContent = WEEKDAYS[now.getDay()];
    $("#homeDate").textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
    $("#homeTime").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const start = new Date(settings.startDate + "T00:00:00");
    const diff = now - start;

    if (diff >= 0) {
      const fullDays = Math.floor(diff / 86400000);
      const totalDays = fullDays + 1;
      const rest = diff % 86400000;
      const hh = Math.floor(rest / 3600000), mm = Math.floor((rest % 3600000) / 60000), ss = Math.floor((rest % 60000) / 1000);
      const { y, m, d } = yearsMonthsDays(start, now);
      $("#elapsedMain").textContent = `${totalDays} 天`;
      $("#elapsedDetail").textContent = `${y} 年 ${m} 个月 ${d} 天`;
      $("#elapsedLive").textContent = `已相伴 ${fullDays} 天 ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
      $("#statDays").textContent = totalDays;
    } else {
      $("#elapsedMain").textContent = "即将开始";
      $("#elapsedDetail").textContent = "期待与你相恋";
      $("#elapsedLive").textContent = "";
      $("#statDays").textContent = "0";
    }

    const target = new Date(settings.countdownTarget + "T00:00:00");
    const cd = target - now;
    if (cd > 0) {
      const days = Math.floor(cd / 86400000);
      const hh = Math.floor((cd % 86400000) / 3600000);
      const mm = Math.floor((cd % 3600000) / 60000);
      const ss = Math.floor((cd % 60000) / 1000);
      $("#countdownMain").textContent = `${days} 天`;
      const units = $("#countdownUnits").querySelectorAll("b");
      units[0].textContent = days;
      units[1].textContent = pad(hh);
      units[2].textContent = pad(mm);
      units[3].textContent = pad(ss);
      $("#countdownTarget").textContent = `${fmtDate(settings.countdownTarget)}`;
    } else {
      const past = Math.floor((-cd) / 86400000);
      $("#countdownMain").textContent = past === 0 ? "就是今天" : `已过 ${past} 天`;
      $("#countdownUnits").querySelectorAll("b").forEach((b) => (b.textContent = "0"));
      $("#countdownTarget").textContent = `${fmtDate(settings.countdownTarget)} · 已到达`;
    }
  }

  // ===== 数据加载 =====
  async function refreshAll() {
    [settings, entries, photos] = await Promise.all([
      window.DBStore.getSettings(),
      window.DBStore.listEntries(),
      window.DBStore.listPhotos(),
    ]);
    $("#partner1Name").textContent = settings.partner1;
    $("#partner2Name").textContent = settings.partner2;
    $("#countdownLabel").textContent = settings.countdownLabel;
    $("#coupleLine").textContent = settings.countdownTarget ? `期待 · ${settings.countdownLabel}` : "在一起的每一天，都值得纪念";
    $("#brandTitle").textContent = `${settings.partner1} ❤ ${settings.partner2}`;
  }

  // ===== 首页 =====
  function renderHome() {
    updateClock();
    $("#statEntries").textContent = entries.length;
    $("#statPhotos").textContent = photos.length;
    const recent = entries.slice(0, 4);
    const box = $("#recentEntries");
    if (!recent.length) {
      box.innerHTML = '<p class="empty-hint">还没有记录，去写第一篇吧 ~</p>';
      return;
    }
    box.innerHTML = recent.map((e) => `
      <div class="recent-item" data-entry-id="${e.id}">
        <span class="recent-date">${fmtDate(e.date)}</span>
        <div class="recent-body">
          <div class="recent-title">${escapeHtml(e.title || "无标题")}</div>
          <div class="recent-text">${escapeHtml(e.content || "")}</div>
        </div>
        ${e.mood ? `<span class="recent-mood">${e.mood}</span>` : ""}
      </div>`).join("");
    box.querySelectorAll(".recent-item").forEach((el) => el.addEventListener("click", () => {
      switchView("records");
      setTimeout(() => {
        const card = document.querySelector(`#timeline [data-entry-id="${el.dataset.entryId}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
    }));
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ===== 随笔 =====
  function renderTimeline() {
    const box = $("#timeline");
    if (!entries.length) {
      box.innerHTML = '<p class="empty-hint">还没有随笔，点击「写随笔」开始记录吧。</p>';
      return;
    }
    box.innerHTML = entries.map((e) => `
      <article class="entry-card glass" data-entry-id="${e.id}">
        <div class="entry-top">
          <span class="entry-date">${fmtDate(e.date)}</span>
          ${e.mood ? `<span class="entry-mood">${e.mood}</span>` : ""}
        </div>
        ${e.title ? `<div class="entry-title">${escapeHtml(e.title)}</div>` : ""}
        <div class="entry-content">${escapeHtml(e.content || "")}</div>
        <div class="entry-actions">
          <button class="icon-btn entry-edit" title="编辑">&#9998;</button>
          <button class="icon-btn entry-del" title="删除">&#128465;</button>
        </div>
      </article>`).join("");
    box.querySelectorAll(".entry-card").forEach((card) => {
      const id = card.dataset.entryId;
      card.querySelector(".entry-edit").addEventListener("click", () => openEntryModal(entries.find((e) => e.id === id)));
      card.querySelector(".entry-del").addEventListener("click", async () => {
        if (!confirm("确定删除这篇随笔吗？")) return;
        await window.DBStore.deleteEntry(id);
        entries = await window.DBStore.listEntries();
        renderTimeline(); renderHome();
        toast("已删除");
      });
    });
  }

  function openEntryModal(entry) {
    editingEntryId = entry ? entry.id : null;
    selectedMood = entry ? entry.mood || "" : "";
    $("#entryModalTitle").textContent = entry ? "编辑随笔" : "写随笔";
    $("#entryDate").value = entry ? entry.date : todayStr();
    $("#entryTitle").value = entry ? entry.title || "" : "";
    $("#entryContent").value = entry ? entry.content || "" : "";
    $$(".mood-btn").forEach((b) => b.classList.toggle("active", b.dataset.mood === selectedMood));
    $("#entryModal").classList.remove("hidden");
    setTimeout(() => $("#entryContent").focus(), 100);
  }

  $("#btnNewEntry").addEventListener("click", () => openEntryModal(null));
  $$(".mood-btn").forEach((b) => b.addEventListener("click", () => {
    selectedMood = selectedMood === b.dataset.mood ? "" : b.dataset.mood;
    $$(".mood-btn").forEach((x) => x.classList.toggle("active", x.dataset.mood === selectedMood));
  }));
  $("#btnSaveEntry").addEventListener("click", async () => {
    const date = $("#entryDate").value;
    const title = $("#entryTitle").value.trim();
    const content = $("#entryContent").value.trim();
    if (!date) return toast("请选择日期", true);
    if (!content && !title) return toast("写点什么吧", true);
    const data = { date, title, content, mood: selectedMood };
    if (editingEntryId) {
      await window.DBStore.updateEntry({ ...entries.find((e) => e.id === editingEntryId), ...data });
      toast("已更新");
    } else {
      await window.DBStore.addEntry(data);
      toast("已保存这段心动");
    }
    closeModal("entryModal");
    entries = await window.DBStore.listEntries();
    renderTimeline(); renderHome();
  });

  // ===== 相册 =====
  function renderPhotos() {
    const grid = $("#photoGrid");
    const month = $("#photoMonthFilter").value;
    const list = photos.filter((p) => !month || (p.date || "").startsWith(month));
    if (!list.length) {
      grid.innerHTML = '<p class="empty-hint">该时间段还没有照片，点击「添加照片」上传吧。</p>';
      return;
    }
    grid.innerHTML = list.map((p) => `
      <figure class="photo-cell" data-photo-id="${p.id}">
        <img src="${setPhotoUrl(p)}" alt="" loading="lazy" />
        <span class="photo-date-badge">${fmtDate(p.date)}</span>
        ${p.caption ? `<figcaption class="photo-cap">${escapeHtml(p.caption)}</figcaption>` : ""}
      </figure>`).join("");
    grid.querySelectorAll(".photo-cell").forEach((cell) => cell.addEventListener("click", () => openLightbox(cell.dataset.photoId)));
  }

  function openPhotoModal() {
    pendingPhotos = [];
    renderPendingPhotos();
    $("#photoDate").value = todayStr();
    $("#photoCaption").value = "";
    $("#photoModal").classList.remove("hidden");
  }
  function renderPendingPhotos() {
    const box = $("#photoPreviewList");
    box.innerHTML = pendingPhotos.map((p, i) => `
      <div class="preview-thumb"><img src="${p.url}" alt="" /><button class="rm" data-i="${i}">&times;</button></div>`).join("");
    box.querySelectorAll(".rm").forEach((b) => b.addEventListener("click", () => {
      URL.revokeObjectURL(pendingPhotos[+b.dataset.i].url);
      pendingPhotos.splice(+b.dataset.i, 1);
      renderPendingPhotos();
    }));
  }
  function addPendingFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      pendingPhotos.push({ blob: f, url: URL.createObjectURL(f), name: f.name });
    }
    renderPendingPhotos();
  }

  $("#btnAddPhoto").addEventListener("click", openPhotoModal);
  $("#dropZone").addEventListener("click", () => $("#photoInput").click());
  $("#photoInput").addEventListener("change", (e) => { addPendingFiles(e.target.files); e.target.value = ""; });
  ["dragover", "dragenter"].forEach((ev) => $("#dropZone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropZone").classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => $("#dropZone").addEventListener(ev, (e) => { e.preventDefault(); $("#dropZone").classList.remove("drag"); }));
  $("#dropZone").addEventListener("drop", (e) => { addPendingFiles(e.dataTransfer.files); });

  $("#btnSavePhotos").addEventListener("click", async () => {
    if (!pendingPhotos.length) return toast("请先选择照片", true);
    const date = $("#photoDate").value || todayStr();
    const caption = $("#photoCaption").value.trim();
    const btn = $("#btnSavePhotos");
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      for (const p of pendingPhotos) {
        const blob = await downscaleImage(p.blob);
        await window.DBStore.addPhoto({ date, caption, blob, type: blob.type || "image/jpeg" });
      }
      for (const p of pendingPhotos) URL.revokeObjectURL(p.url);
      pendingPhotos = [];
      closeModal("photoModal");
      photos = await window.DBStore.listPhotos();
      renderPhotos(); renderHome();
      toast(`已保存 ${photos.length} 张照片`);
    } catch (err) {
      toast("保存失败：" + err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = "保存照片";
    }
  });

  function openLightbox(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    currentLightboxId = id;
    $("#lightboxImg").src = setPhotoUrl(p);
    $("#lightboxDate").textContent = fmtDate(p.date);
    $("#lightboxCaption").textContent = p.caption || "";
    $("#lightbox").classList.remove("hidden");
  }
  function closeLightbox() { $("#lightbox").classList.add("hidden"); currentLightboxId = null; }
  $("#lightboxClose").addEventListener("click", closeLightbox);
  $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
  $("#lightboxDel").addEventListener("click", async () => {
    if (!currentLightboxId || !confirm("确定删除这张照片吗？")) return;
    await window.DBStore.deletePhoto(currentLightboxId);
    revokePhotoUrl(currentLightboxId);
    closeLightbox();
    photos = await window.DBStore.listPhotos();
    renderPhotos(); renderHome();
    toast("已删除");
  });

  $("#photoMonthFilter").addEventListener("change", renderPhotos);
  $("#btnClearPhotoFilter").addEventListener("click", () => { $("#photoMonthFilter").value = ""; renderPhotos(); });

  // ===== 导出 =====
  function exportRangeItems() {
    const start = $("#exportStart").value;
    const end = $("#exportEnd").value;
    const ps = photos.filter((p) => (!start || p.date >= start) && (!end || p.date <= end));
    const es = entries.filter((e) => (!start || e.date >= start) && (!end || e.date <= end));
    return { ps, es };
  }
  function renderExport() {
    if (!$("#exportStart").value) {
      $("#exportStart").value = settings.startDate || todayStr();
      $("#exportEnd").value = todayStr();
    }
    if (!$("#exportTitle").value) $("#exportTitle").value = "我们的时光";
    updateExportSummary();
  }
  function updateExportSummary() {
    const { ps, es } = exportRangeItems();
    const includeP = $("#exportPhotos").checked;
    const includeE = $("#exportEntries").checked;
    const n = (includeP ? ps.length : 0) + (includeE ? es.length : 0);
    const dur = parseFloat($("#exportDuration").value) || 4;
    const total = n ? Math.ceil(n * dur + 6) : 0;
    $("#exportSummary").textContent = n
      ? `已选择 ${includeP ? ps.length + " 张照片、" : ""}${includeE ? es.length + " 篇随笔、" : ""}共 ${n} 个画面，成片约 ${total} 秒。`
      : "所选时间段内没有可导出的内容。";
  }
  ["exportStart", "exportEnd", "exportPhotos", "exportEntries", "exportDuration"].forEach((id) => {
    $("#" + id).addEventListener("input", () => { $("#durationVal").textContent = (+$("#exportDuration").value).toFixed(1) + " 秒"; updateExportSummary(); });
    $("#" + id).addEventListener("change", updateExportSummary);
  });
  $("#durationVal").textContent = "4.0 秒";
  $$("#exportQuality .seg-btn").forEach((b) => b.addEventListener("click", () => {
    $$("#exportQuality .seg-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    exportQualityVar = b.dataset.q;
  }));

  const musicInput = document.createElement("input");
  musicInput.type = "file"; musicInput.accept = "audio/*"; musicInput.className = "hidden";
  document.body.appendChild(musicInput);
  $("#btnPickMusic").addEventListener("click", () => musicInput.click());
  musicInput.addEventListener("change", () => {
    if (musicInput.files[0]) {
      musicFile = musicInput.files[0];
      $("#musicName").textContent = musicFile.name;
      $("#btnClearMusic").classList.remove("hidden");
    }
    musicInput.value = "";
  });
  $("#btnClearMusic").addEventListener("click", () => {
    musicFile = null;
    $("#musicName").textContent = "未选择";
    $("#btnClearMusic").classList.add("hidden");
  });

  $("#btnExport").addEventListener("click", async () => {
    if (exporting) return;
    const start = $("#exportStart").value;
    const end = $("#exportEnd").value;
    const { ps, es } = exportRangeItems();
    const includeP = $("#exportPhotos").checked;
    const includeE = $("#exportEntries").checked;
    if ((!includeP || !ps.length) && (!includeE || !es.length)) return toast("所选时间段内没有内容", true);

    exporting = true;
    $("#btnExport").disabled = true;
    $("#exportProgress").classList.remove("hidden");
    $("#progressFill").style.width = "0%";
    $("#progressText").textContent = "正在准备…";
    try {
      const result = await window.VideoExporter.exportVideo({
        start, end, includePhotos: includeP, includeEntries: includeE,
        photos: ps, entries: es,
        title: $("#exportTitle").value.trim() || "我们的时光",
        duration: parseFloat($("#exportDuration").value) || 4,
        quality: exportQualityVar,
        music: musicFile,
        names: [settings.partner1, settings.partner2],
      }, (p) => {
        $("#progressFill").style.width = Math.round(p * 100) + "%";
        $("#progressText").textContent = `正在渲染 ${Math.round(p * 100)}% …`;
      });
      const name = (($("#exportTitle").value.trim() || "恋爱记录") + "_" + todayStr() + ".webm").replace(/[\\/:*?"<>|]/g, "_");
      downloadBlob(result.blob, name);
      $("#progressText").textContent = "完成！视频已开始下载。";
      toast("视频已生成");
    } catch (err) {
      toast("导出失败：" + err.message, true);
      $("#progressText").textContent = "导出失败：" + err.message;
    } finally {
      exporting = false;
      $("#btnExport").disabled = false;
      setTimeout(() => $("#exportProgress").classList.add("hidden"), 2600);
    }
  });

  // ===== 设置 =====
  function renderSettings() {
    $("#setPartner1").value = settings.partner1;
    $("#setPartner2").value = settings.partner2;
    $("#setStartDate").value = settings.startDate;
    $("#setCountdownTarget").value = settings.countdownTarget;
    $("#setCountdownLabel").value = settings.countdownLabel;
    bgType = settings.background.type || "default";
    $$(".bg-option").forEach((b) => b.classList.toggle("active", b.dataset.bg === bgType));
    $("#bgCurrentName").textContent = bgType === "default" ? "默认动态梦幻背景" : bgType === "image" ? "自定义图片背景" : "自定义视频背景";
  }

  async function saveSettingsInfo() {
    settings.partner1 = $("#setPartner1").value.trim() || "宝贝";
    settings.partner2 = $("#setPartner2").value.trim() || "亲爱的";
    settings.startDate = $("#setStartDate").value || "2024-01-01";
    settings.countdownTarget = $("#setCountdownTarget").value || settings.startDate;
    settings.countdownLabel = $("#setCountdownLabel").value.trim() || "恋爱纪念日";
    await window.DBStore.saveSettings(settings);
    await refreshAll();
    updateClock();
    renderHome();
    toast("设置已保存");
  }
  ["setPartner1", "setPartner2", "setStartDate", "setCountdownTarget", "setCountdownLabel"].forEach((id) => {
    $("#" + id).addEventListener("change", saveSettingsInfo);
  });

  async function setBackground(type, mediaBlob, mime) {
    if (type === "default") {
      await window.DBStore.clearBgMedia().catch(() => {});
      settings.background = { type: "default" };
      bgType = "default";
      window.Background.defaultBg();
    } else {
      await window.DBStore.saveBgMedia(mediaBlob, mime);
      settings.background = { type };
      bgType = type;
      if (bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = null; }
      bgObjectUrl = URL.createObjectURL(mediaBlob);
      window.Background.apply(type, bgObjectUrl);
    }
    await window.DBStore.saveSettings(settings);
    $("#bgCurrentName").textContent = type === "default" ? "默认动态梦幻背景" : type === "image" ? "自定义图片背景" : "自定义视频背景";
    $$(".bg-option").forEach((b) => b.classList.toggle("active", b.dataset.bg === type));
  }

  $$(".bg-option").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.bg;
    if (t === "default") { setBackground("default"); toast("已切换为默认背景"); return; }
    if (t === "image") $("#bgImageInput").click();
    else $("#bgVideoInput").click();
  }));
  $("#bgImageInput").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await setBackground("image", f, f.type);
    toast("已设置图片背景");
    e.target.value = "";
  });
  $("#bgVideoInput").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await setBackground("video", f, f.type);
    toast("已设置视频背景");
    e.target.value = "";
  });

  // ===== 数据管理 =====
  $("#btnExportData").addEventListener("click", async () => {
    try {
      const data = await window.DBStore.exportData();
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `恋爱记录备份_${todayStr()}.json`);
      toast("备份已导出");
    } catch (err) { toast("导出失败：" + err.message, true); }
  });
  $("#btnImportData").addEventListener("click", () => $("#importInput").click());
  $("#importInput").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      await window.DBStore.importData(data);
      for (const [id, url] of photoUrls) URL.revokeObjectURL(url);
      photoUrls.clear();
      await refreshAll();
      await window.Background.loadSaved();
      renderHome();
      toast("备份导入成功");
    } catch (err) { toast("导入失败：" + err.message, true); }
    e.target.value = "";
  });
  $("#btnClearData").addEventListener("click", async () => {
    if (!confirm("确定清空全部数据（随笔、照片、背景）吗？此操作不可恢复！")) return;
    if (!confirm("再次确认：真的要清空所有数据吗？")) return;
    try {
      await window.DBStore.DB.clear("entries");
      await window.DBStore.DB.clear("photos");
      await window.DBStore.DB.clear("bg");
      for (const [id, url] of photoUrls) URL.revokeObjectURL(url);
      photoUrls.clear();
      await refreshAll();
      window.Background.defaultBg();
      settings.background = { type: "default" };
      await window.DBStore.saveSettings(settings);
      renderHome();
      toast("已清空数据");
    } catch (err) { toast("清空失败：" + err.message, true); }
  });

  // ===== 弹窗关闭 =====
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
  $$(".modal-backdrop").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $$(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
      closeLightbox();
    }
  });
  function closeModal(id) { $("#" + id).classList.add("hidden"); }

  // ===== 初始化 =====
  async function init() {
    window.Background.init();
    await refreshAll();
    renderHome();
    setInterval(updateClock, 1000);
  }
  init();
})();
