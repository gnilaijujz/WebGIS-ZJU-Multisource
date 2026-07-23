// COG query helper.
import { fromUrl, type GeoTIFF, type GeoTIFFImage } from 'geotiff';
import { ENDPOINTS } from '../../config';

export const SPECTRAL_BANDS = 150; // usable bands; sample 151 is alpha

export interface CogGeo {
  width: number;
  height: number;
  origin: number[]; // [lon, lat] of top-left corner
  resolution: number[]; // [dLon, dLat] per pixel (dLat negative)
  bbox: number[]; // [west, south, east, north]
  samplesPerPixel: number;
  levels: number; // overview count
}

class CogReader {
  private tiff: GeoTIFF | null = null;
  private full: GeoTIFFImage | null = null;
  private geo: CogGeo | null = null;
  private opening: Promise<void> | null = null;
  // Cache the query overview.
  private queryImg: GeoTIFFImage | null = null;
  // Cache the query cube.
  private queryCube: { bands: number[][]; w: number; h: number } | null = null;
  private queryCubePromise: Promise<void> | null = null;

  /** Open the COG. */
  async ready(): Promise<CogGeo> {
    if (this.geo) return this.geo;
    if (!this.opening) {
      this.opening = (async () => {
        this.tiff = await fromUrl(ENDPOINTS.cog);
        this.full = await this.tiff.getImage(0);
        const count = await this.tiff.getImageCount();
        // Use the smallest overview.
        this.queryImg = await this.tiff.getImage(Math.max(0, count - 1));
        this.geo = {
          width: this.full.getWidth(),
          height: this.full.getHeight(),
          origin: this.full.getOrigin(),
          resolution: this.full.getResolution(),
          bbox: this.full.getBoundingBox(),
          samplesPerPixel: this.full.getSamplesPerPixel(),
          levels: count,
        };
      })();
    }
    await this.opening;
    return this.geo!;
  }

  /** Map lon/lat to the cached overview. */
  private lonLatToQueryPixel(lon: number, lat: number): { col: number; row: number } | null {
    if (!this.queryImg || !this.geo) return null;
    const { origin, resolution, width, height } = this.geo;
    const colFull = (lon - origin[0]) / resolution[0];
    const rowFull = (lat - origin[1]) / resolution[1]; // resolution[1] < 0
    const qw = this.queryImg.getWidth();
    const qh = this.queryImg.getHeight();
    const col = Math.floor((colFull / width) * qw);
    const row = Math.floor((rowFull / height) * qh);
    if (col < 0 || row < 0 || col >= qw || row >= qh) return null;
    return { col, row };
  }

  /** Map lon/lat to full resolution. */
  lonLatToPixel(lon: number, lat: number): { col: number; row: number } | null {
    if (!this.geo) return null;
    const { origin, resolution, width, height } = this.geo;
    const col = Math.floor((lon - origin[0]) / resolution[0]);
    const row = Math.floor((lat - origin[1]) / resolution[1]); // resolution[1] < 0
    if (col < 0 || row < 0 || col >= width || row >= height) return null;
    return { col, row };
  }

  /** Check coverage. */
  contains(lon: number, lat: number): boolean {
    if (!this.geo) return false;
    const [w, s, e, n] = this.geo.bbox;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  }

  /** Build the query cube once. */
  private async ensureQueryCube(): Promise<void> {
    if (this.queryCube) return;
    if (!this.queryCubePromise) {
      this.queryCubePromise = (async () => {
        await this.ready();
        const samples = Array.from({ length: SPECTRAL_BANDS }, (_, i) => i);
        const rasters = (await this.queryImg!.readRasters({ samples })) as unknown as {
          length: number;
          width: number;
          height: number;
          [i: number]: ArrayLike<number>;
        };
        const w = this.queryImg!.getWidth();
        const h = this.queryImg!.getHeight();
        const bands: number[][] = [];
        for (let b = 0; b < SPECTRAL_BANDS; b++) {
          const src = rasters[b];
          const arr = new Array<number>(w * h);
          for (let i = 0; i < w * h; i++) arr[i] = Number(src?.[i] ?? NaN);
          bands.push(arr);
        }
        this.queryCube = { bands, w, h };
      })();
    }
    await this.queryCubePromise;
  }

  /** Read one band value at lon/lat. */
  async readBandValue(lon: number, lat: number, band: number): Promise<number | null> {
    await this.ensureQueryCube();
    const px = this.lonLatToQueryPixel(lon, lat);
    if (!px || !this.queryCube) return null;
    const idx = px.row * this.queryCube.w + px.col;
    const v = this.queryCube.bands[band - 1]?.[idx];
    return typeof v === 'number' ? v : null;
  }

  /** Read the full spectrum at lon/lat. */
  async readSpectrum(lon: number, lat: number): Promise<number[]> {
    await this.ensureQueryCube();
    const px = this.lonLatToQueryPixel(lon, lat);
    if (!px || !this.queryCube) return [];
    const idx = px.row * this.queryCube.w + px.col;
    return this.queryCube.bands.map((b) => b[idx]);
  }

  /** Build a histogram, min, max, and mean for one band. */
  async bandHistogram(
    band: number,
    bins = 40,
  ): Promise<{ min: number; max: number; mean: number; counts: number[]; edges: number[] }> {
    // Reuse the cube.
    await this.ensureQueryCube();
    const data = (this.queryCube?.bands[band - 1] ?? []) as ArrayLike<number>;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let valid = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || v === 0) continue; // treat 0 as nodata
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      valid++;
    }
    if (!Number.isFinite(min)) {
      min = 0;
      max = 1;
    }
    const counts = new Array(bins).fill(0);
    const span = max - min || 1;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || v === 0) continue;
      let b = Math.floor(((v - min) / span) * bins);
      if (b < 0) b = 0;
      if (b >= bins) b = bins - 1;
      counts[b]++;
    }
    const edges = Array.from({ length: bins + 1 }, (_, i) => min + (span * i) / bins);
    return { min, max, mean: valid ? sum / valid : 0, counts, edges };
  }

  getGeo(): CogGeo | null {
    return this.geo;
  }

  /** Cached overview cube for CPU-side index rendering. */
  async overviewCube(): Promise<{ bands: number[][]; w: number; h: number; bbox: number[] }> {
    await this.ensureQueryCube();
    return {
      bands: this.queryCube!.bands,
      w: this.queryCube!.w,
      h: this.queryCube!.h,
      bbox: this.geo!.bbox,
    };
  }
}

export const cogReader = new CogReader();
