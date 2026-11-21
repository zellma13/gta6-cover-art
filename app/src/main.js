// Wires the poster maker: photo slots, layout / grade / size picks, drag-to-pan and
// zoom per panel, caption editing, and PNG export at the chosen post size.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawPoster, SIZES, LAYOUTS, GRADES } from './poster.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const taglineInput = document.getElementById('tagline');
const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoom-val');
const panelHint = document.getElementById('panel-hint');

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'square',
  title: 'Sunset Heist',
  tagline: 'One last job under the neon sky',
  photos: [null, null, null, null],
  pans: [{ x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 }],
  selected: 0,
  fillAll: true,
};

const PANEL_COUNT = { hero: 4, grid: 4, strip: 3, duo: 2 };

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function panelRects() {
  return LAYOUTS[state.layout].panels.map(([fx, fy, fw, fh]) => ({
    x: fx * canvas.width,
    y: fy * canvas.height,
    w: fw * canvas.width,
    h: fh * canvas.height,
  }));
}

/** Redraws the preview canvas at the export size, then fits it on screen with CSS. */
function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawPoster(canvas, state);
  const count = PANEL_COUNT[state.layout];
  panelHint.textContent = `Panel ${Math.min(state.selected + 1, count)} of ${count} — drag the photo to move it, zoom below to get closer.`;
  document.getElementById('export').textContent = `Export PNG ${size.w} × ${size.h}`;
  zoomInput.value = String(state.pans[state.selected].s);
  zoomVal.textContent = `${state.pans[state.selected].s.toFixed(2)}×`;
}

function selectPanel(i) {
  const count = PANEL_COUNT[state.layout];
  state.selected = Math.max(0, Math.min(count - 1, i));
  document.querySelectorAll('.slot').forEach((el, j) => el.classList.toggle('active', j === state.selected));
  redraw();
}

function applyPhotosToState() {
  // drawPoster reads state.photos per panel; with fill-all every panel mirrors slot 1.
  state.photos = state.photos.map((p, i) => (state.fillAll ? state.photos[0] : p));
  redraw();
}

// --- Photo slots -----------------------------------------------------------
document.querySelectorAll('.slot input[type=file]').forEach((input) => {
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const i = Number(input.dataset.slot);
    state.photos[i] = await loadImage(URL.createObjectURL(file));
    applyPhotosToState();
    status.textContent = `Photo loaded into panel ${i + 1}.`;
  });
});
document.querySelectorAll('.slot .sample').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const i = Number(btn.dataset.slot);
    const name = btn.dataset.sample;
    state.photos[i] = await loadImage(`samples/${name}.jpg`);
    applyPhotosToState();
    status.textContent = `Sample ${name} loaded into panel ${i + 1}.`;
  });
});
document.querySelectorAll('.slot .clear').forEach((btn) => {
  btn.addEventListener('click', () => {
    const i = Number(btn.dataset.slot);
    state.photos[i] = null;
    applyPhotosToState();
  });
});
document.querySelectorAll('.slot').forEach((el, i) => {
  el.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') selectPanel(i);
  });
});
document.getElementById('fill-all').addEventListener('change', (e) => {
  state.fillAll = e.target.checked;
  applyPhotosToState();
});

// --- Layout, grade, size ----------------------------------------------------
function wireGroup(selector, key) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener('click', () => {
      state[key] = btn.dataset[key];
      document.querySelectorAll(selector).forEach((b) => b.classList.toggle('on', b === btn));
      if (key === 'layout') selectPanel(Math.min(state.selected, PANEL_COUNT[state.layout] - 1));
      redraw();
    });
  });
}
wireGroup('.layout-btn', 'layout');
wireGroup('.grade-btn', 'grade');
wireGroup('.size-btn', 'size');

// --- Caption, zoom, reset ---------------------------------------------------
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
taglineInput.addEventListener('input', () => { state.tagline = taglineInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  state.pans[state.selected].s = Number(zoomInput.value);
  redraw();
});
document.getElementById('reset-view').addEventListener('click', () => {
  state.pans[state.selected] = { x: 0, y: 0, s: 1 };
  redraw();
});

// --- Drag to pan the selected panel's photo ---------------------------------
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelRects().findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  if (i < 0) return;
  selectPanel(i);
  drag = { start: p, pan: { ...state.pans[i] } };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const rect = panelRects()[state.selected];
  const pan = state.pans[state.selected];
  pan.x = Math.max(-0.4, Math.min(0.4, drag.pan.x + (p.x - drag.start.x) / rect.w));
  pan.y = Math.max(-0.4, Math.min(0.4, drag.pan.y + (p.y - drag.start.y) / rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// --- Export ------------------------------------------------------------------
document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawPoster(off, state);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    status.textContent = `Saved vice-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
});

/** Marks the layout / grade / size buttons that match the current state. */
function syncButtons() {
  document.querySelectorAll('.layout-btn').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('.grade-btn').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('.size-btn').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.getElementById('fill-all').checked = state.fillAll;
}

// --- Screenshot scenes -------------------------------------------------------
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (scene) => {
    if (scene.layout) state.layout = scene.layout;
    if (scene.size) state.size = scene.size;
    if (scene.grade) state.grade = scene.grade;
    if (scene.title !== undefined) { state.title = scene.title; titleInput.value = scene.title; }
    if (scene.tagline !== undefined) { state.tagline = scene.tagline; taglineInput.value = scene.tagline; }
    if (scene.fillAll !== undefined) state.fillAll = scene.fillAll;
    if (scene.photos) {
      for (let i = 0; i < scene.photos.length; i++) {
        state.photos[i] = scene.photos[i] ? await loadImage(`samples/${scene.photos[i]}.jpg`) : null;
      }
    }
    syncButtons();
    applyPhotosToState();
    selectPanel(0);
    redraw();
  });
} else {
  redraw();
}
