// POS CSV -> flight_route.geojson, photo_points.geojson, flight.czml.
// Capture time comes from the DJI filename.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SRC, OUT_DIR } from './paths.mjs';

const raw = readFileSync(SRC.posCsv, 'latin1'); // Labels are mojibake; only the timestamp digits matter.
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
// Drop the WKT and header rows.
const dataLines = lines.slice(2);

/** Parse the DJI timestamp. */
function parseTime(label) {
  const m = label.match(/(\d{14})/);
  if (!m) return null;
  const s = m[1];
  const [Y, Mo, D, H, Mi, Se] = [
    s.slice(0, 4), s.slice(4, 6), s.slice(6, 8),
    s.slice(8, 10), s.slice(10, 12), s.slice(12, 14),
  ];
  return new Date(`${Y}-${Mo}-${D}T${H}:${Mi}:${Se}Z`);
}

const records = [];
for (const line of dataLines) {
  // Labels have no commas, so split() is safe.
  const parts = line.split(',');
  if (parts.length < 4) continue;
  const label = parts[0];
  const lon = parseFloat(parts[1]);
  const lat = parseFloat(parts[2]);
  const alt = parseFloat(parts[3]);
  const err = parseFloat(parts[4]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
  const t = parseTime(label);
  records.push({
    name: (label.match(/DJI_[\dA-Za-z_]+\.JPG/i) || [`photo_${records.length}`])[0],
    lon, lat, alt, err,
    time: t,
  });
}

if (records.length === 0) throw new Error('No POS records parsed.');

// Keep CZML timestamps strictly increasing.
const MIN_STEP_S = 0.5;
let last = null;
for (const r of records) {
  let t = r.time ? r.time.getTime() / 1000 : (last ?? 0) + 1;
  if (last !== null && t <= last) t = last + MIN_STEP_S;
  r.epoch = t;
  last = t;
}
const start = records[0].epoch;
const stop = records[records.length - 1].epoch;
const iso = (s) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');

mkdirSync(fileURLToPath(OUT_DIR), { recursive: true });
const out = (name) => fileURLToPath(new URL(name, OUT_DIR));


const route = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'flight_route', count: records.length },
      geometry: {
        type: 'LineString',
        coordinates: records.map((r) => [r.lon, r.lat, r.alt]),
      },
    },
  ],
};
writeFileSync(out('flight_route.geojson'), JSON.stringify(route));


const points = {
  type: 'FeatureCollection',
  features: records.map((r, i) => ({
    type: 'Feature',
    properties: {
      index: i,
      name: r.name,
      altitude: r.alt,
      error_m: r.err,
      time: r.time ? iso(r.epoch) : null,
    },
    geometry: { type: 'Point', coordinates: [r.lon, r.lat, r.alt] },
  })),
};
writeFileSync(out('photo_points.geojson'), JSON.stringify(points));


const epochISO = iso(start);
const cartographicDegrees = [];
for (const r of records) {
  cartographicDegrees.push(+(r.epoch - start).toFixed(3), r.lon, r.lat, r.alt);
}
const czml = [
  {
    id: 'document',
    name: 'UAV flight',
    version: '1.0',
    clock: {
      interval: `${epochISO}/${iso(stop)}`,
      currentTime: epochISO,
      multiplier: 1,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER',
    },
  },
  {
    id: 'drone',
    name: 'UAV',
    availability: `${epochISO}/${iso(stop)}`,
    position: {
      epoch: epochISO,
      cartographicDegrees,
      interpolationAlgorithm: 'LAGRANGE',
      interpolationDegree: 1,
    },
    path: {
      material: { polylineGlow: { color: { rgba: [0, 200, 255, 255] }, glowPower: 0.25 } },
      width: 4,
      leadTime: 0,
      trailTime: 1e9,
      resolution: 1,
    },
    point: { pixelSize: 12, color: { rgba: [255, 220, 0, 255] }, outlineColor: { rgba: [0, 0, 0, 255] }, outlineWidth: 2 },
  },
];
writeFileSync(out('flight.czml'), JSON.stringify(czml));

console.log(
  `pos2route: ${records.length} photos | ${epochISO} -> ${iso(stop)} | ` +
  `wrote flight_route.geojson, photo_points.geojson, flight.czml`,
);
