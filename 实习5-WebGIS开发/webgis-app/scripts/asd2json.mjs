// ASD spectra -> public/data/asd_spectra.json.
// Photos and labels come from the ASD image folder.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SRC, OUT_DIR } from './paths.mjs';

// Copy photos to public/asd_photos/<num>.jpg.
const PHOTO_OUT = fileURLToPath(new URL('../public/asd_photos/', import.meta.url));
mkdirSync(PHOTO_OUT, { recursive: true });

// Build a number -> {label, photo} map from image names.
const catMap = {};
try {
  for (const f of readdirSync(SRC.asdImgDir)) {
    const m = f.match(/^(\d+)\s*(.+?)\.(jpg|png|jpeg)$/i);
    if (m) {
      const num = parseInt(m[1], 10);
      const photo = `${num}.${m[3].toLowerCase()}`;
      copyFileSync(join(SRC.asdImgDir, f), join(PHOTO_OUT, photo));
      catMap[num] = { label: m[2].trim(), photo: `/asd_photos/${photo}` };
    }
  }
} catch (e) {
  console.warn('WARN: could not read ASD image dir for category names:', e.message);
}

const files = readdirSync(SRC.asdDir)
  .filter((f) => /\.asd\.txt$/i.test(f))
  .sort();

const samples = [];
for (const f of files) {
  const numMatch = f.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : samples.length;
  const cat = catMap[num];
  const label = cat ? cat.label : `未标注_${String(num).padStart(2, '0')}`;

  const txt = readFileSync(join(SRC.asdDir, f), 'utf-8');
  const wavelengths = [];
  const reflectance = [];
  for (const line of txt.split(/\r?\n/)) {
    const parts = line.split(/[\t,]/).map((s) => s.trim());
    if (parts.length < 2) continue;
    const wl = parseFloat(parts[0]);
    const rf = parseFloat(parts[1]);
    if (!Number.isFinite(wl) || !Number.isFinite(rf)) continue; // skips header row
    wavelengths.push(wl);
    reflectance.push(+rf.toFixed(6));
  }
  if (wavelengths.length === 0) continue;
  samples.push({
    id: num,
    file: f,
    label,
    category: cat ? label : null,
    photo: cat ? cat.photo : null,
    range: [wavelengths[0], wavelengths[wavelengths.length - 1]],
    n: wavelengths.length,
    wavelengths,
    reflectance,
  });
}

mkdirSync(fileURLToPath(OUT_DIR), { recursive: true });
writeFileSync(
  fileURLToPath(new URL('asd_spectra.json', OUT_DIR)),
  JSON.stringify({ count: samples.length, samples }),
);

const named = samples.filter((s) => s.category).length;
console.log(
  `asd2json: ${samples.length} spectra (${named} labelled), ` +
  `${samples[0]?.n} bands each (${samples[0]?.range?.join('-')} nm) -> asd_spectra.json`,
);
