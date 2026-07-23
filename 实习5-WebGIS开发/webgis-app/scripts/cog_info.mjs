// Read COG metadata into public/data/cog_meta.json.
import { fromFile } from 'geotiff';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OUT_DIR, SRC } from './paths.mjs';

const COG = SRC.cogTif;

const tiff = await fromFile(COG);
const n = await tiff.getImageCount();
const img = await tiff.getImage(0)

const meta = {
  imageCount: n,
  width: img.getWidth(),
  height: img.getHeight(),
  samplesPerPixel: img.getSamplesPerPixel(),
  bbox: img.getBoundingBox(),
  origin: img.getOrigin(),
  resolution: img.getResolution(),
  tileWidth: img.getTileWidth?.() ?? null,
  tileHeight: img.getTileHeight?.() ?? null,
};

// Pull GeoTIFF tags when available.
const fd = img.fileDirectory;
meta.geoKeys = img.geoKeys || null;
meta.epsg = img.geoKeys?.ProjectedCSTypeGeoKey || img.geoKeys?.GeographicTypeGeoKey || null;
meta.modelPixelScale = fd.ModelPixelScale || null;
meta.modelTiepoint = fd.ModelTiepoint || null;
meta.modelTransformation = fd.ModelTransformation || null;
meta.gdalNoData = fd.GDAL_NODATA ?? null;
meta.bitsPerSample = fd.BitsPerSample?.[0] ?? null;
meta.sampleFormat = fd.SampleFormat?.[0] ?? null;

writeFileSync(fileURLToPath(new URL('cog_meta.json', OUT_DIR)), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
