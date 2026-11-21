// Renders the multi-panel GTA-style poster onto a canvas at the canvas's own size.
// The poster is fully procedural: photos in comic-book panels, a Vice City sunset or
// neon grade over each panel, and a bold caption over a scrim at the foot. No external
// assets, no Rockstar artwork, no font files — system font stacks only.
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

// Panel rects in fractions of the poster: [x, y, width, height].
export const LAYOUTS = {
  hero: { name: 'Hero + 3', panels: [[0, 0, 1, 0.58], [0, 0.58, 1 / 3, 0.42], [1 / 3, 0.58, 1 / 3, 0.42], [2 / 3, 0.58, 1 / 3, 0.42]] },
  grid: { name: 'Comic grid', panels: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  strip: { name: 'Triple strip', panels: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  duo: { name: 'Split duo', panels: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
};

export const GRADES = {
  sunset: { name: 'Sunset', sky: ['#2b0f3f', '#7a1e5e', '#ff5e3a'] },
  neon: { name: 'Neon', sky: ['#0a0626', '#3b0f6e', '#ff2e88'] },
  noir: { name: 'Noir', sky: ['#0b0b12', '#232338', '#4a4a6e'] },
};

const SKYLINE = [0.42, 0.6, 0.35, 0.72, 0.5, 0.66, 0.38, 0.58, 0.46, 0.7, 0.33, 0.55];

/** Draws the whole poster for `state` onto `canvas`. State: {layout, grade, title, tagline, photos, pans}. */
export function drawPoster(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const panels = (LAYOUTS[state.layout] ?? LAYOUTS.hero).panels;
  const gutter = Math.max(3, Math.round(Math.min(w, h) * 0.008));

  // Poster ground: deep purple to magenta, so gutters read as part of the art.
  const ground = ctx.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, grade.sky[0]);
  ground.addColorStop(0.55, grade.sky[1]);
  ground.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);

  panels.forEach((frac, i) => {
    const rect = {
      x: frac[0] * w + gutter / 2,
      y: frac[1] * h + gutter / 2,
      w: frac[2] * w - gutter,
      h: frac[3] * h - gutter,
    };
    drawPanel(ctx, rect, state.photos[i] ?? null, state.pans[i] ?? { x: 0, y: 0, s: 1 }, state.grade);
  });

  drawScrim(ctx, w, h);
  drawTitle(ctx, w, h, state.title, state.tagline);
  drawHalftone(ctx, w, h);

  // Outer frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.006));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** One panel: the photo cover-fit with pan/zoom, or a procedural sunset when empty. */
function drawPanel(ctx, rect, photo, pan, gradeName) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo) {
    const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * pan.s;
    const pw = photo.naturalWidth * base;
    const ph = photo.naturalHeight * base;
    // Anchor the crop toward the top (faces sit high), then clamp so the photo
    // always covers the panel whatever the pan or zoom.
    const slackX = Math.max(0, (pw - rect.w) / 2);
    const slackY = Math.max(0, (ph - rect.h) / 2);
    let ox = rect.x - slackX + pan.x * rect.w;
    let oy = rect.y - slackY * 0.35 + pan.y * rect.h;
    ox = Math.max(rect.x + rect.w - pw, Math.min(rect.x, ox));
    oy = Math.max(rect.y + rect.h - ph, Math.min(rect.y, oy));
    if (gradeName === 'noir') ctx.filter = 'grayscale(0.85) contrast(1.18) brightness(0.96)';
    ctx.drawImage(photo, ox, oy, pw, ph);
    ctx.filter = 'none';
  } else {
    drawEmptyPanel(ctx, rect, gradeName);
  }
  gradeWash(ctx, rect, gradeName);
  vignette(ctx, rect);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(rect.w, rect.h) * 0.012));
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

/** The sunset or neon wash laid over a panel after its photo. */
function gradeWash(ctx, rect, gradeName) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (gradeName === 'neon') {
    wash.addColorStop(0, 'rgba(0,229,255,0.10)');
    wash.addColorStop(0.55, 'rgba(120,40,255,0.05)');
    wash.addColorStop(1, 'rgba(255,0,170,0.24)');
  } else if (gradeName === 'noir') {
    wash.addColorStop(0, 'rgba(20,30,80,0.05)');
    wash.addColorStop(1, 'rgba(5,5,20,0.30)');
  } else {
    wash.addColorStop(0, 'rgba(255,150,60,0.06)');
    wash.addColorStop(0.55, 'rgba(255,90,60,0.10)');
    wash.addColorStop(1, 'rgba(255,30,110,0.30)');
  }
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function vignette(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.max(rect.w, rect.h) * 0.72;
  const v = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = v;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** A procedural sunset skyline for a panel with no photo yet, so the poster is never blank. */
function drawEmptyPanel(ctx, rect, gradeName) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (gradeName === 'neon') {
    sky.addColorStop(0, '#160b3d');
    sky.addColorStop(0.6, '#a3137f');
    sky.addColorStop(1, '#ff5e8a');
  } else if (gradeName === 'noir') {
    sky.addColorStop(0, '#101018');
    sky.addColorStop(0.6, '#2c2c44');
    sky.addColorStop(1, '#565670');
  } else {
    sky.addColorStop(0, '#3d1458');
    sky.addColorStop(0.55, '#c22a6d');
    sky.addColorStop(1, '#ff8a3d');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Sun with a glow, low over the skyline.
  const sunR = Math.min(rect.w, rect.h) * 0.16;
  const sx = rect.x + rect.w * 0.68;
  const sy = rect.y + rect.h * 0.52;
  const glow = ctx.createRadialGradient(sx, sy, sunR * 0.2, sx, sy, sunR * 2.4);
  glow.addColorStop(0, 'rgba(255,220,120,0.85)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Skyline bars.
  ctx.fillStyle = 'rgba(16,6,28,0.85)';
  const n = SKYLINE.length;
  const bw = rect.w / n;
  for (let i = 0; i < n; i++) {
    const bh = rect.h * 0.34 * SKYLINE[i];
    ctx.fillRect(rect.x + i * bw, rect.y + rect.h - bh, bw * 0.82, bh);
  }
}

/** Dark scrim behind the title so the caption reads over any photo. */
function drawScrim(ctx, w, h) {
  const scrim = ctx.createLinearGradient(0, h * 0.62, 0, h);
  scrim.addColorStop(0, 'rgba(12,4,24,0)');
  scrim.addColorStop(0.55, 'rgba(12,4,24,0.55)');
  scrim.addColorStop(1, 'rgba(12,4,24,0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  // Hot diagonal accent bar above the title.
  ctx.save();
  ctx.translate(0, h * 0.80);
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  const bar = ctx.createLinearGradient(0, 0, w, 0);
  bar.addColorStop(0, '#ff5e3a');
  bar.addColorStop(0.6, '#ff2e88');
  bar.addColorStop(1, '#b537f2');
  ctx.fillStyle = bar;
  ctx.fillRect(-w * 0.1, 0, w * 0.42, Math.max(4, h * 0.012));
  ctx.restore();
}

/** The bold caption and tagline at the foot of the poster. */
function drawTitle(ctx, w, h, title, tagline) {
  const text = (title || '').trim().toUpperCase();
  const sub = (tagline || '').trim();
  const maxW = w * 0.92;
  let size = Math.round(h * 0.088);
  const stack = `'Arial Black', Impact, 'Helvetica Neue', sans-serif`;
  const setFont = (s) => { ctx.font = `900 ${s}px ${stack}`; };
  setFont(size);
  while (text && ctx.measureText(text).width > maxW && size > 12) {
    size -= 2;
    setFont(size);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const tx = w * 0.04;
  const ty = h - h * 0.055;
  if (text) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160826';
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeText(text, tx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, tx, ty);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    const subSize = Math.max(12, Math.round(size * 0.34));
    ctx.font = `700 ${subSize}px 'Helvetica Neue', Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.18)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffd166';
    ctx.fillText(sub.toUpperCase(), tx, ty - size - Math.round(h * 0.018));
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/** Halftone dots in the top-right corner, a poster-print nod. */
function drawHalftone(ctx, w, h) {
  const r = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const a = 0.55 - (row + col) * 0.055;
      if (a <= 0.05) continue;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(w - w * 0.045 - col * r * 3.4, h * 0.045 + row * r * 3.4, r * (1 - row * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
