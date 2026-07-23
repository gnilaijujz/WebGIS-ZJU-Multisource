// Control points -> public/data/*.geojson.
// 3D tiles points are lifted through the tileset transform; surface points are already geodetic.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { SRC, OUT_DIR } from './paths.mjs'

const DATASETS = [
  {
    id: '3dgs',
    name: '3DGS',
    cpDir: SRC.zjuCpDir,
    tileset: SRC.zjuTileset,
    output: 'gcp_3dgs_points.geojson',
  },
  {
    id: 'osgb',
    name: 'OSGB',
    cpDir: SRC.osgbCpDir,
    tileset: SRC.osgbTileset,
    output: 'gcp_osgb_points.geojson',
  },
]

/** Map local [x,y,z] to ECEF [X,Y,Z]. */
function makeLocalToEcef(transform) {
  return ([x, y, z]) => [
    transform[0] * x + transform[4] * y + transform[8] * z + transform[12],
    transform[1] * x + transform[5] * y + transform[9] * z + transform[13],
    transform[2] * x + transform[6] * y + transform[10] * z + transform[14],
  ]
}

// ECEF -> geodetic
const a = 6378137.0
const f = 1 / 298.257223563
const b = a * (1 - f)
const e2 = f * (2 - f)
const ep2 = (a * a - b * b) / (b * b)
function ecefToLonLatH([X, Y, Z]) {
  const lon = Math.atan2(Y, X)
  const p = Math.hypot(X, Y)
  const th = Math.atan2(Z * a, p * b)
  const lat = Math.atan2(
    Z + ep2 * b * Math.sin(th) ** 3,
    p - e2 * a * Math.cos(th) ** 3,
  )
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
  const h = p / Math.cos(lat) - n
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI, h]
}

function controlFiles(cpDir) {
  return readdirSync(cpDir)
    .map((file) => ({
      file,
      kind: file.startsWith('model-control-points')
        ? 'model'
        : file.startsWith('surface-control-points')
          ? 'surface'
          : null,
    }))
    .filter((item) => item.kind)
    .sort((a, b) => a.file.localeCompare(b.file))
}

function makeFeature(dataset, kind, generatedAt, point, localToEcef) {
  let lon
  let lat
  let h
  let ecef

  if (Array.isArray(point.local)) {
    ecef = localToEcef(point.local)
    const llh = ecefToLonLatH(ecef)
    lon = llh[0]
    lat = llh[1]
    h = llh[2]
  } else if (Number.isFinite(point.longitude)) {
    lon = point.longitude
    lat = point.latitude
    h = point.height
    ecef = point.ecef ? [point.ecef.x, point.ecef.y, point.ecef.z] : localToEcef([0, 0, 0])
  } else {
    return null
  }

  return {
    type: 'Feature',
    properties: {
      id: point.id,
      dataset: dataset.name,
      datasetId: dataset.id,
      kind,
      observations: point.observations ?? null,
      error: point.error ?? null,
      note: point.note ?? '',
      generatedAt,
      local: point.local ?? null,
      ecef,
    },
    geometry: { type: 'Point', coordinates: [+lon.toFixed(9), +lat.toFixed(9), +h.toFixed(3)] },
  }
}

function buildDataset(dataset) {
  const transform = JSON.parse(readFileSync(dataset.tileset, 'utf-8')).root.transform
  const localToEcef = makeLocalToEcef(transform)
  const features = []

  for (const { file, kind } of controlFiles(dataset.cpDir)) {
    const doc = JSON.parse(readFileSync(join(dataset.cpDir, file), 'utf-8'))
    for (const point of doc.points || []) {
      const feature = makeFeature(dataset, kind, doc.generatedAt ?? '', point, localToEcef)
      if (feature) features.push(feature)
    }
  }

  return { type: 'FeatureCollection', features }
}

mkdirSync(fileURLToPath(OUT_DIR), { recursive: true })

for (const dataset of DATASETS) {
  const collection = buildDataset(dataset)
  const outputUrl = new URL(dataset.output, OUT_DIR)
  writeFileSync(fileURLToPath(outputUrl), JSON.stringify(collection))
  console.log(`gcp2json: ${dataset.name} ${collection.features.length} control points -> ${dataset.output}`)
}

// Legacy alias for the 3DGS control set.
copyFileSync(
  fileURLToPath(new URL('gcp_3dgs_points.geojson', OUT_DIR)),
  fileURLToPath(new URL('gcp_points.geojson', OUT_DIR)),
)
