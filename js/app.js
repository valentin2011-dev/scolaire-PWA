/* ===========================================================
   Constantes & helpers
   =========================================================== */
const STORAGE_KEY = "vscol_state_v1";
const USER_NAME = "Valentin";
const DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function uid() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function emptyWeek() {
  return { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [] };
}

function defaultState() {
  return {
    settings: { theme: "dark", lang: "fr" },
    homework: { current: emptyWeek(), next: emptyWeek() },
    schedule: { A: null, B: null },
    thrive: { lundi: null, mardi: null, mercredi: null, jeudi: null, vendredi: null },
    evaluations: [],
    notes: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      settings: { ...base.settings, ...(parsed.settings || {}) },
      homework: {
        current: { ...base.homework.current, ...((parsed.homework || {}).current || {}) },
        next: { ...base.homework.next, ...((parsed.homework || {}).next || {}) },
      },
      schedule: { ...base.schedule, ...(parsed.schedule || {}) },
      thrive: { ...base.thrive, ...(parsed.thrive || {}) },
      evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch (e) {
    console.warn("Lecture du stockage impossible, réinitialisation.", e);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Sauvegarde impossible (stockage plein ?)", e);
    showToast(state.settings.lang === "fr" ? "Stockage plein, impossible d'enregistrer" : "Storage full, could not save");
  }
}

let state = loadState();
const ui = {
  week: "current",       // 'current' | 'next'
  currentDay: null,       // jour ouvert dans la feuille "day"
  thriveDay: null,        // jour sélectionné dans la feuille "thrive"
  noteEditId: null,       // id de la note en cours d'édition, ou null si création
  photoWeek: null,        // semaine (A/B) affichée dans la feuille "photo"
  pendingPhotoWeek: null, // semaine (A/B) en attente de sélection de fichier
};

/* ===========================================================
   Utilitaires métier
   =========================================================== */
function computeProgress(week) {
  let total = 0, done = 0;
  DAY_KEYS.forEach((d) => {
    const items = state.homework[week][d] || [];
    total += items.length;
    done += items.filter((i) => i.done).length;
  });
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { pct, total, done };
}

function formatDate(lang) {
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const s = new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function compressImage(file, maxDim = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ===========================================================
   Rendu — i18n & thème
   =========================================================== */
function applyI18n() {
  const lang = state.settings.lang;
  $$("[data-i18n]").forEach((el) => { el.textContent = tr(lang, el.dataset.i18n); });
  $$("[data-i18n-placeholder]").forEach((el) => { el.placeholder = tr(lang, el.dataset.i18nPlaceholder); });
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.settings.theme);
  const color = state.settings.theme === "dark" ? "#14151a" : "#eef0f3";
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

/* ===========================================================
   Rendu — Menu 1 (accueil / devoirs)
   =========================================================== */
function renderHome() {
  const lang = state.settings.lang;
  $("#home-hello").textContent = tr(lang, "greeting", USER_NAME);
  $("#home-date").textContent = formatDate(lang);

  $("#next-week-mode-banner").style.display = ui.week === "next" ? "flex" : "none";

  const { pct, total } = computeProgress(ui.week);
  $("#progress-label").textContent = tr(lang, ui.week === "current" ? "this_week" : "next_week");
  $("#progress-value").textContent = pct + "%";
  const fill = $("#progress-fill");
  fill.style.width = pct + "%";
  fill.classList.toggle("complete", pct === 100 && total > 0);

  $("#next-week-title").textContent = tr(lang, ui.week === "current" ? "next_week" : "back_to_current_week");
  $("#next-week-sub").textContent = tr(lang, ui.week === "current" ? "next_week_sub" : "back_to_current_week_sub");

  renderDaysList();
}

function renderDaysList() {
  const lang = state.settings.lang;
  const container = $("#days-list");
  container.innerHTML = "";
  DAY_KEYS.forEach((day, idx) => {
    const items = state.homework[ui.week][day] || [];
    const row = document.createElement("div");
    row.className = "pill-row";
    row.style.cursor = "pointer";
    row.setAttribute("data-action", "open-day");
    row.setAttribute("data-day", day);
    row.innerHTML = `
      <div class="pill day-row tappable"><span>${tr(lang, "days_full")[idx]}</span></div>
      <div class="pill-side">${tr(lang, "homework_count", items.length)}</div>
    `;
    container.appendChild(row);
  });
}

function openDaySheet(day) {
  ui.currentDay = day;
  const lang = state.settings.lang;
  const idx = DAY_KEYS.indexOf(day);
  const suffix = ui.week === "next" ? ` · ${tr(lang, "next_week")}` : "";
  $("#day-sheet-title").textContent = tr(lang, "days_full")[idx] + suffix;
  $("#new-homework-input").value = "";
  renderDayHomeworkList();
  openSheet("day");
}

function renderDayHomeworkList() {
  const lang = state.settings.lang;
  const list = state.homework[ui.week][ui.currentDay] || [];
  const container = $("#day-homework-list");
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">${tr(lang, "no_homework")}</div>`;
    return;
  }
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "homework-item" + (item.done ? " done" : "");
    row.innerHTML = `
      <div class="check">✓</div>
      <div class="hw-text">${escapeHtml(item.text)}</div>
      <button data-action="delete-homework" data-id="${item.id}" aria-label="Supprimer" style="color:var(--text-faint);font-size:17px;line-height:1;padding:6px;flex-shrink:0;">×</button>
    `;
    container.appendChild(row);
    attachLongPress(row, () => {
      item.done = !item.done;
      saveState();
      renderDayHomeworkList();
      renderHome();
    });
  });
}

/* ===========================================================
   Rendu — Menu 2 (emploi du temps)
   =========================================================== */
function renderSchedule() {
  const lang = state.settings.lang;

  ["A", "B"].forEach((w) => {
    const btn = $("#photo-btn-" + w);
    const has = !!state.schedule[w];
    btn.textContent = has ? tr(lang, "photo_view") : tr(lang, "photo_add");
    btn.classList.toggle("has-photo", has);
  });

  const thriveList = $("#thrive-list");
  thriveList.innerHTML = "";
  DAY_KEYS.forEach((day, idx) => {
    const val = state.thrive[day];
    const row = document.createElement("div");
    row.className = "thrive-row";
    row.innerHTML = `
      <div class="thrive-day-badge">${tr(lang, "days_short")[idx]}</div>
      <div class="thrive-slot${val ? " filled" : ""}" data-action="open-thrive-slot" data-day="${day}">${val ? escapeHtml(val) : "—"}</div>
    `;
    thriveList.appendChild(row);
  });

  const sorted = [...state.evaluations].sort((a, b) => b.ts - a.ts);
  const avgEl = $("#eval-average");
  avgEl.textContent = sorted.length === 0
    ? "—"
    : Math.round(sorted.reduce((s, e) => s + e.score, 0) / sorted.length) + "/100";

  const listEl = $("#eval-list");
  listEl.innerHTML = "";
  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${tr(lang, "no_evals")}</div>`;
  } else {
    sorted.slice(0, 3).forEach((ev) => {
      listEl.appendChild(buildEvalRow(ev, false));
    });
  }
}

function buildEvalRow(ev, withDelete) {
  const scoreClass = ev.score >= 80 ? "good" : ev.score >= 50 ? "mid" : "low";
  const row = document.createElement("div");
  row.className = "pill-row";
  row.innerHTML = `
    <div class="pill eval-item"><span class="name">${escapeHtml(ev.subject)}</span></div>
    <div class="pill-side eval-score ${scoreClass}">${ev.score}/100</div>
    ${withDelete ? `<button data-action="delete-eval" data-id="${ev.id}" aria-label="Supprimer" style="color:var(--text-faint);font-size:18px;padding:8px;flex-shrink:0;">×</button>` : ""}
  `;
  return row;
}

function openEvalsAllSheet() {
  const lang = state.settings.lang;
  const sorted = [...state.evaluations].sort((a, b) => b.ts - a.ts);
  const container = $("#evals-all-list");
  container.innerHTML = "";
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state">${tr(lang, "no_evals")}</div>`;
  } else {
    sorted.forEach((ev) => container.appendChild(buildEvalRow(ev, true)));
  }
  openSheet("evals-all");
}

function openPhotoSheet(week) {
  ui.photoWeek = week;
  $("#photo-sheet-title").textContent = tr(state.settings.lang, week === "A" ? "week_a" : "week_b");
  $("#photo-preview-img").src = state.schedule[week];
  openSheet("photo");
}

function openThriveSheet(day) {
  ui.thriveDay = day;
  renderThriveDaySelect();
  const existing = day ? state.thrive[day] : null;
  $("#thrive-input").value = existing || "";
  $("#thrive-delete-btn").style.display = existing ? "inline-block" : "none";
  openSheet("thrive");
}

function renderThriveDaySelect() {
  const lang = state.settings.lang;
  const container = $("#thrive-day-select");
  container.innerHTML = "";
  DAY_KEYS.forEach((day, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tr(lang, "days_short")[idx];
    btn.setAttribute("data-action", "pick-thrive-day");
    btn.setAttribute("data-day", day);
    if (ui.thriveDay === day) btn.classList.add("selected");
    container.appendChild(btn);
  });
}

/* ===========================================================
   Rendu — Menu 3 (réglages)
   =========================================================== */
function renderSettings() {
  const grid = $("#notes-grid");
  grid.innerHTML = "";

  const addTile = document.createElement("button");
  addTile.className = "note-tile add tappable";
  addTile.setAttribute("data-action", "add-note");
  addTile.setAttribute("aria-label", "Nouvelle note");
  addTile.textContent = "+";
  grid.appendChild(addTile);

  [...state.notes].sort((a, b) => b.ts - a.ts).forEach((n) => {
    const tile = document.createElement("button");
    tile.className = "note-tile filled tappable";
    tile.setAttribute("data-action", "edit-note");
    tile.setAttribute("data-id", n.id);
    tile.textContent = n.text.length > 70 ? n.text.slice(0, 70) + "…" : n.text;
    grid.appendChild(tile);
  });

  $$(".swatch").forEach((s) => s.classList.toggle("selected", s.dataset.theme === state.settings.theme));
  $$(".lang-chip").forEach((c) => c.classList.toggle("selected", c.dataset.lang === state.settings.lang));
}

/* ===========================================================
   Feuilles modales (sheets) & toasts
   =========================================================== */
function openSheet(name) {
  $$(".sheet").forEach((s) => (s.style.display = "none"));
  const sheet = document.querySelector(`.sheet[data-sheet="${name}"]`);
  if (sheet) sheet.style.display = "block";
  $("#overlay").classList.add("active");
}

function closeSheet() {
  $("#overlay").classList.remove("active");
}

let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ===========================================================
   Appui long (marquer un devoir terminé)
   =========================================================== */
function attachLongPress(el, onLongPress, duration = 550) {
  let timer = null;
  const start = () => { timer = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(12); onLongPress(); }, duration); };
  const cancel = () => clearTimeout(timer);
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ===========================================================
   Navigation entre écrans
   =========================================================== */
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  $("#bottom-nav").style.display = id === "screen-schedule" ? "none" : "flex";
}

/* ===========================================================
   Rendu global
   =========================================================== */
function renderAll() {
  applyI18n();
  renderHome();
  renderSchedule();
  renderSettings();
}

/* ===========================================================
   Gestion centralisée des actions (délégation d'événements)
   =========================================================== */
function handleAction(e) {
  const el = e.target.closest("[data-action]");
  if (!el) {
    if (e.target.id === "overlay") closeSheet();
    return;
  }
  const lang = state.settings.lang;
  const action = el.dataset.action;

  switch (action) {
    case "logo-home": {
      if (ui.week === "next") ui.week = "current";
      showScreen("screen-home");
      renderHome();
      break;
    }
    case "go-schedule":
      showScreen("screen-schedule");
      renderSchedule();
      break;
    case "go-settings":
      showScreen("screen-settings");
      renderSettings();
      break;
    case "toggle-week":
      ui.week = ui.week === "current" ? "next" : "current";
      renderHome();
      break;
    case "open-day":
      openDaySheet(el.dataset.day);
      break;
    case "save-homework": {
      const text = $("#new-homework-input").value.trim();
      if (!text) { showToast(tr(lang, "toast_missing_text")); return; }
      state.homework[ui.week][ui.currentDay].push({ id: uid(), text, done: false });
      saveState();
      $("#new-homework-input").value = "";
      renderDayHomeworkList();
      renderHome();
      showToast(tr(lang, "toast_hw_added"));
      break;
    }
    case "delete-homework": {
      e.stopPropagation();
      const id = el.dataset.id;
      state.homework[ui.week][ui.currentDay] = state.homework[ui.week][ui.currentDay].filter((i) => i.id !== id);
      saveState();
      renderDayHomeworkList();
      renderHome();
      showToast(tr(lang, "toast_hw_deleted"));
      break;
    }
    case "photo-week": {
      const week = el.dataset.week;
      if (state.schedule[week]) {
        openPhotoSheet(week);
      } else {
        ui.pendingPhotoWeek = week;
        $("#photo-input").click();
      }
      break;
    }
    case "replace-photo":
      ui.pendingPhotoWeek = ui.photoWeek;
      $("#photo-input").click();
      break;
    case "delete-photo":
      state.schedule[ui.photoWeek] = null;
      saveState();
      closeSheet();
      renderSchedule();
      showToast(tr(lang, "toast_photo_deleted"));
      break;
    case "add-thrive":
      openThriveSheet(null);
      break;
    case "open-thrive-slot":
      openThriveSheet(el.dataset.day);
      break;
    case "pick-thrive-day": {
      ui.thriveDay = el.dataset.day;
      renderThriveDaySelect();
      const existing = state.thrive[ui.thriveDay];
      $("#thrive-input").value = existing || "";
      $("#thrive-delete-btn").style.display = existing ? "inline-block" : "none";
      break;
    }
    case "save-thrive": {
      const day = ui.thriveDay;
      const text = $("#thrive-input").value.trim();
      if (!day) { showToast(tr(lang, "toast_missing_day")); return; }
      if (!text) { showToast(tr(lang, "toast_missing_text")); return; }
      state.thrive[day] = text;
      saveState();
      closeSheet();
      renderSchedule();
      showToast(tr(lang, "toast_thrive_saved"));
      break;
    }
    case "delete-thrive":
      if (ui.thriveDay) { state.thrive[ui.thriveDay] = null; saveState(); }
      closeSheet();
      renderSchedule();
      showToast(tr(lang, "toast_thrive_deleted"));
      break;
    case "add-eval":
      $("#eval-subject-input").value = "";
      $("#eval-score-input").value = "";
      openSheet("eval");
      break;
    case "save-eval": {
      const subject = $("#eval-subject-input").value.trim();
      const scoreVal = $("#eval-score-input").value;
      const score = Number(scoreVal);
      if (!subject) { showToast(tr(lang, "toast_missing_text")); return; }
      if (scoreVal === "" || Number.isNaN(score) || score < 0 || score > 100) { showToast(tr(lang, "toast_missing_score")); return; }
      state.evaluations.push({ id: uid(), subject, score: Math.round(score), ts: Date.now() });
      saveState();
      closeSheet();
      renderSchedule();
      showToast(tr(lang, "toast_eval_added"));
      break;
    }
    case "see-all-evals":
      openEvalsAllSheet();
      break;
    case "delete-eval": {
      const id = el.dataset.id;
      state.evaluations = state.evaluations.filter((ev) => ev.id !== id);
      saveState();
      openEvalsAllSheet();
      renderSchedule();
      showToast(tr(lang, "toast_eval_deleted"));
      break;
    }
    case "add-note":
      ui.noteEditId = null;
      $("#note-input").value = "";
      $("#note-delete-btn").style.display = "none";
      $("#note-sheet-title").textContent = tr(lang, "new_note");
      openSheet("note");
      break;
    case "edit-note": {
      const note = state.notes.find((n) => n.id === el.dataset.id);
      if (!note) return;
      ui.noteEditId = note.id;
      $("#note-input").value = note.text;
      $("#note-delete-btn").style.display = "inline-block";
      $("#note-sheet-title").textContent = tr(lang, "edit_note");
      openSheet("note");
      break;
    }
    case "save-note": {
      const text = $("#note-input").value.trim();
      if (!text) { showToast(tr(lang, "toast_missing_text")); return; }
      if (ui.noteEditId) {
        const note = state.notes.find((n) => n.id === ui.noteEditId);
        if (note) { note.text = text; note.ts = Date.now(); }
      } else {
        state.notes.push({ id: uid(), text, ts: Date.now() });
      }
      saveState();
      closeSheet();
      renderSettings();
      showToast(tr(lang, "toast_note_saved"));
      break;
    }
    case "delete-note":
      if (ui.noteEditId) { state.notes = state.notes.filter((n) => n.id !== ui.noteEditId); saveState(); }
      closeSheet();
      renderSettings();
      showToast(tr(lang, "toast_note_deleted"));
      break;
    case "set-theme":
      state.settings.theme = el.dataset.theme;
      saveState();
      applyTheme();
      renderSettings();
      break;
    case "set-lang":
      state.settings.lang = el.dataset.lang;
      saveState();
      document.documentElement.lang = state.settings.lang;
      renderAll();
      break;
    case "close-sheet":
      closeSheet();
      break;
  }
}

function handlePhotoInputChange(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  compressImage(file)
    .then((dataUrl) => {
      const week = ui.pendingPhotoWeek;
      if (!week) return;
      state.schedule[week] = dataUrl;
      saveState();
      ui.pendingPhotoWeek = null;
      renderSchedule();
      closeSheet();
      showToast(tr(state.settings.lang, "toast_photo_saved"));
    })
    .catch(() => showToast(state.settings.lang === "fr" ? "Impossible de lire cette image" : "Could not read this image"));
}

/* ===========================================================
   Service worker (mode hors-ligne)
   =========================================================== */
function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

/* ===========================================================
   Initialisation
   =========================================================== */
function init() {
  applyTheme();
  document.documentElement.lang = state.settings.lang;
  renderAll();
  document.addEventListener("click", handleAction);
  $("#photo-input").addEventListener("change", handlePhotoInputChange);
  registerSW();
}

document.addEventListener("DOMContentLoaded", init);
