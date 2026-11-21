// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows the cover alone. Query picks the scene: layout, size, grade, photo
// (comma list of sample names, one per panel), caption, tagline, fill (1 = one photo
// in every panel). window.__shotReady is set once painted.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photos = (query.get('photo') ?? 'pier').split(',').map((s) => s.trim()).filter(Boolean);
  await applyScene({
    layout: query.get('layout') ?? 'hero',
    size: query.get('size') ?? 'square',
    grade: query.get('grade') ?? 'sunset',
    title: query.get('caption') ?? 'Sunset Heist',
    tagline: query.get('tagline') ?? 'One last job under the neon sky',
    fillAll: query.get('fill') !== '0',
    photos,
  });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
