// RTK shp -> public/data/rtk_area.geojson and rtk_points.geojson.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open } from 'shapefile';
import proj4 from 'proj4';
import { SRC, RTK_PROJ, OUT_DIR } from './paths.mjs';

const toWgs84 = proj4(RTK_PROJ, 'EPSG:4326'); // [x,y] meters -> [lon,lat]

/** Reproject GeoJSON coordinates. */
function reproject(coords) {
  if (typeof coords[0] === 'number') {
    const [lon, lat] = toWgs84.forward([coords[0], coords[1]]);
    return [+lon.toFixed(9), +lat.toFixed(9)];
  }
  return coords.map(reproject);
}

// Force UTF-8 for the DBF to avoid mojibake.
const source = await open(SRC.rtkShp, SRC.rtkDbf, { encoding: 'utf-8' });
const features = [];
const vertices = [];
let result = await source.read();
let fid = 0;
while (!result.done) {
  const f = result.value;
  if (f && f.geometry) {
    f.geometry.coordinates = reproject(f.geometry.coordinates);
    f.properties = { fid, ...(f.properties || {}) };
    features.push(f);
    // Collect exterior-ring vertices as points.
    const rings = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat();
    rings.forEach((ring) =>
      ring.forEach(([lon, lat], vi) =>
        vertices.push({
          type: 'Feature',
          properties: { fid, vertex: vi },
          geometry: { type: 'Point', coordinates: [lon, lat] },
        }),
      ),
    );
    fid++;
  }
  result = await source.read();
}

mkdirSync(fileURLToPath(OUT_DIR), { recursive: true });
const out = (name) => fileURLToPath(new URL(name, OUT_DIR));
writeFileSync(out('rtk_area.geojson'), JSON.stringify({ type: 'FeatureCollection', features }));
writeFileSync(out('rtk_points.geojson'), JSON.stringify({ type: 'FeatureCollection', features: vertices }));

// Quick sanity check.
console.log(
  `shp2geojson: ${features.length} polygons, ${vertices.length} vertices -> rtk_area.geojson, rtk_points.geojson`,
);
if (features[0]) {
  const c = features[0].geometry.coordinates.flat(Infinity);
  console.log(`  first vertex lon/lat = ${c[0]}, ${c[1]}`);
}
