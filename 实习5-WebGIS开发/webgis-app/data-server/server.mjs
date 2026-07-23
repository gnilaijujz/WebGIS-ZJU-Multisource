// Read-only data server for 3D Tiles and the COG.
// Vite proxies /data-server here.
import express from 'express';
import cors from 'cors';
import { statSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8686;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PROJECT_ROOT = join(ROOT, '实习5-WebGIS开发');

// Source mounts under the project root.
const MOUNTS = {
  '/tiles/zju': join(PROJECT_ROOT, 'zju_big-3dtiles'),
  '/tiles/osgb': join(PROJECT_ROOT, 'GIS_drone', 'terra_osgbs-3dtiles'),
  '/cog': join(PROJECT_ROOT, 'bip_cogtiff'),
};
const COG_FILE = join(MOUNTS['/cog'], 'final-cog.tif');

const app = express();
app.use(cors());

// Serve the COG without a .tif suffix so download managers leave it alone.
app.get('/cogdata', (req, res) => {
  let size;
  try {
    size = statSync(COG_FILE).size;
  } catch {
    return res.status(404).end('COG not found');
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const range = req.headers.range;
  const m = range && /bytes=(\d+)-(\d*)/.exec(range);
  if (m) {
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : size - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    createReadStream(COG_FILE, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', size);
    createReadStream(COG_FILE).pipe(res);
  }
});

// Set content types and keep Range enabled.
const setHeaders = (res, path) => {
  res.setHeader('Accept-Ranges', 'bytes');
  if (path.endsWith('.tif') || path.endsWith('.tiff')) res.setHeader('Content-Type', 'image/tiff');
  else if (path.endsWith('.b3dm')) res.setHeader('Content-Type', 'application/octet-stream');
  else if (path.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
  else if (path.endsWith('.glb')) res.setHeader('Content-Type', 'model/gltf-binary');
};

for (const [route, dir] of Object.entries(MOUNTS)) {
  try {
    statSync(dir);
    app.use(route, express.static(dir, { setHeaders, acceptRanges: true, cacheControl: true, maxAge: '1h' }));
    console.log(`  mount ${route}  ->  ${dir}`);
  } catch {
    console.warn(`  WARN: source missing, skipped: ${dir}`);
  }
}

app.get('/', (_req, res) => {
  res.json({
    service: 'webgis-data-server',
    mounts: Object.keys(MOUNTS),
    examples: ['/tiles/zju/tileset.json', '/tiles/osgb/tileset.json', '/cog/final-cog.tif'],
  });
});

app.listen(PORT, () => console.log(`data-server listening on http://localhost:${PORT}`));
