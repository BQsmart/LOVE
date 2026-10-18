/* ===== 数据存储层（IndexedDB） ===== */
(function () {
  const DB_NAME = "love-diary";
  const DB_VERSION = 1;
  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
        if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
        if (!db.objectStoreNames.contains("bg")) db.createObjectStore("bg");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function tx(storeName, mode, fn) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let outcome;
        try {
          outcome = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        Promise.resolve(outcome).then(resolve, reject);
      });
    });
  }

  const DB = {
    get(store, key) { return tx(store, "readonly", (s) => requestResult(s.get(key))); },
    getAll(store) { return tx(store, "readonly", (s) => requestResult(s.getAll())); },
    put(store, value, key) {
      return tx(store, "readwrite", (s) => (key !== undefined ? requestResult(s.put(value, key)) : requestResult(s.put(value))));
    },
    delete(store, key) { return tx(store, "readwrite", (s) => requestResult(s.delete(key))); },
    clear(store) { return tx(store, "readwrite", (s) => requestResult(s.clear())); },
  };

  // ---- 设置 ----
  const DEFAULT_SETTINGS = {
    partner1: "宝贝",
    partner2: "亲爱的",
    startDate: "2024-01-01",
    countdownTarget: "2025-01-01",
    countdownLabel: "恋爱纪念日",
    background: { type: "default" },
  };

  async function getSettings() {
    const s = await DB.get("settings", "main");
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  }
  async function saveSettings(settings) {
    return DB.put("settings", settings, "main");
  }

  // ---- 随笔 ----
  function listEntries() {
    return DB.getAll("entries").then((list) => (list || []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))));
  }
  function addEntry(entry) {
    entry.id = entry.id || "e_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    entry.createdAt = entry.createdAt || Date.now();
    entry.updatedAt = Date.now();
    return DB.put("entries", entry).then(() => entry);
  }
  function updateEntry(entry) {
    entry.updatedAt = Date.now();
    return DB.put("entries", entry);
  }
  function deleteEntry(id) {
    return DB.delete("entries", id);
  }

  // ---- 照片 ----
  function listPhotos() {
    return DB.getAll("photos").then((list) => (list || []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))));
  }
  function addPhoto(photo) {
    photo.id = photo.id || "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    photo.createdAt = Date.now();
    return DB.put("photos", photo).then(() => photo);
  }
  function deletePhoto(id) {
    return DB.delete("photos", id);
  }

  // ---- 背景媒体 ----
  function saveBgMedia(blob, type) {
    return DB.put("bg", { blob, type }, "media");
  }
  function getBgMedia() {
    return DB.get("bg", "media");
  }
  function clearBgMedia() {
    return DB.delete("bg", "media");
  }

  // ---- 导出/导入 ----
  async function exportData() {
    const [settings, entries, photos, bg] = await Promise.all([
      getSettings(),
      listEntries(),
      listPhotos(),
      getBgMedia().catch(() => null),
    ]);
    const data = { app: "love-diary", version: 1, exportedAt: Date.now(), settings, entries, photos: [], bg: null };
    for (const p of photos) {
      data.photos.push({ ...p, blob: await blobToBase64(p.blob) });
    }
    if (bg && bg.blob) data.bg = { type: bg.type, blob: await blobToBase64(bg.blob) };
    return data;
  }

  async function importData(data) {
    if (!data || data.app !== "love-diary") throw new Error("不是有效的恋爱记录备份文件");
    if (data.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    if (Array.isArray(data.entries)) {
      for (const e of data.entries) await DB.put("entries", e);
    }
    if (Array.isArray(data.photos)) {
      for (const p of data.photos) {
        const copy = { ...p };
        delete copy._img;
        delete copy._url;
        if (typeof p.blob === "string") copy.blob = base64ToBlob(p.blob, p.type || "image/jpeg");
        await DB.put("photos", copy);
      }
    }
    if (data.bg && data.bg.blob) {
      const type = data.bg.type || "image/jpeg";
      const blob = typeof data.bg.blob === "string" ? base64ToBlob(data.bg.blob, type) : data.bg.blob;
      await saveBgMedia(blob, type);
    }
    return true;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function base64ToBlob(b64, type) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(b64);
    const mime = (m && m[1]) || type || "image/jpeg";
    const raw = atob((m && m[2]) || b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  window.DBStore = {
    DB, getSettings, saveSettings,
    listEntries, addEntry, updateEntry, deleteEntry,
    listPhotos, addPhoto, deletePhoto,
    saveBgMedia, getBgMedia, clearBgMedia,
    exportData, importData,
  };
})();
