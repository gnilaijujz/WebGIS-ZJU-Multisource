// Relative paths to READ-ONLY source data under the 3230100670-于佳灵 root.
// Never write into these locations.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const SRC = {
  gisRoot: ROOT,
  // D4 flight POS (already WGS84 lon/lat)
  posCsv: join(
    ROOT,
    '实习1-无人机摄影测量',
    '202602-成果数据',
    'AT',
    'report',
    'POS_residual_of_camera.csv',
  ),
  // D5 RTK polygon shapefile (Gauss-Kruger, CM 120)
  rtkShp: join(ROOT, '实习4-RTK外业测量', 'RTK要素面', 'RTK要素面.shp'),
  rtkDbf: join(ROOT, '实习4-RTK外业测量', 'RTK要素面', 'RTK要素面.dbf'),
  // D7 ASD field spectra (350-2500 nm reflectance)
  asdDir: join(ROOT, '实习3-便携式地物波谱仪(ASD)', '2(1)'),
  asdImgDir: join(ROOT, '实习3-便携式地物波谱仪(ASD)', 'asd地物图片', 'asd地物图片'),
  // D6 3DGS control points + tileset (for ECEF placement)
  zjuCpDir: join(ROOT, '实习5-WebGIS开发', 'zju_big-3dtiles'),
  zjuTileset: join(ROOT, '实习5-WebGIS开发', 'zju_big-3dtiles', 'tileset.json'),
  osgbCpDir: join(ROOT, '实习5-WebGIS开发', 'GIS_drone', 'terra_osgbs-3dtiles'),
  osgbTileset: join(ROOT, '实习5-WebGIS开发', 'GIS_drone', 'terra_osgbs-3dtiles', 'tileset.json'),
  cogDir: join(ROOT, '实习5-WebGIS开发', 'bip_cogtiff'),
  cogTif: join(ROOT, '实习5-WebGIS开发', 'bip_cogtiff', 'final-cog.tif'),
};

// proj4 definition for the RTK shapefile CRS:
// Gauss-Kruger 3-degree zone, central meridian 120E, false easting 500000, WGS84 datum.
export const RTK_PROJ =
  '+proj=tmerc +lat_0=0 +lon_0=120 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

// Output directory for derived (small) files consumed by the frontend.
export const OUT_DIR = new URL('../public/data/', import.meta.url);
