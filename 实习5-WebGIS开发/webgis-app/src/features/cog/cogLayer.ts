// COG imagery layer controller.
import {
  Event as CesiumEvent,
  GeographicTilingScheme,
  ImageryLayer,
  Rectangle,
  type Credit,
  type ImageryLayerFeatureInfo,
  type ImageryProvider,
  type ImageryTypes,
  type Proxy,
  type Request as CesiumRequest,
  type TileDiscardPolicy,
  type TilingScheme,
} from 'cesium';
import TIFFImageryProvider, {
  type TIFFImageryProviderRenderOptions,
} from 'tiff-imagery-provider';
import { layerManager } from '../../cesium/LayerManager';
import { useCogStore, EXPR_PRESETS, type CogState, type ExprPreset } from './cogStore';
import { cogReader } from './cogReader';
import { ENDPOINTS } from '../../config';

const LAYER_ID = 'cog';

class CanvasSingleTileImageryProvider {
  private readonly canvas: HTMLCanvasElement;
  private readonly scheme: GeographicTilingScheme;
  private readonly errors = new CesiumEvent();

  constructor(canvas: HTMLCanvasElement, rectangle: Rectangle) {
    this.canvas = canvas;
    this.scheme = new GeographicTilingScheme({
      rectangle,
      numberOfLevelZeroTilesX: 1,
      numberOfLevelZeroTilesY: 1,
    });
  }

  get tileWidth(): number {
    return this.canvas.width;
  }

  get tileHeight(): number {
    return this.canvas.height;
  }

  get maximumLevel(): number {
    return 0;
  }

  get minimumLevel(): number {
    return 0;
  }

  get tilingScheme(): TilingScheme {
    return this.scheme;
  }

  get rectangle(): Rectangle {
    return this.scheme.rectangle;
  }

  get tileDiscardPolicy(): TileDiscardPolicy | undefined {
    return undefined;
  }

  get errorEvent(): CesiumEvent {
    return this.errors;
  }

  get credit(): Credit | undefined {
    return undefined;
  }

  get proxy(): Proxy | undefined {
    return undefined;
  }

  get hasAlphaChannel(): boolean {
    return true;
  }

  getTileCredits(_x: number, _y: number, _level: number): Credit[] {
    return [];
  }

  requestImage(_x: number, _y: number, _level: number, _request?: CesiumRequest): Promise<ImageryTypes> {
    return Promise.resolve(this.canvas);
  }

  pickFeatures(
    _x: number,
    _y: number,
    _level: number,
    _longitude: number,
    _latitude: number,
  ): Promise<ImageryLayerFeatureInfo[]> | undefined {
    return undefined;
  }
}

class CogLayerController {
  private layer: ImageryLayer | null = null;
  private token = 0;
  private started = false;
  private debounceTimer: number | null = null;

  /** Create and watch the COG layer. */
  async start() {
    if (this.started) return;
    this.started = true;
    // Debounce render changes.
    useCogStore.subscribe(() => this.scheduleRebuild());
    await this.rebuild(true);
  }

  private scheduleRebuild() {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.rebuild(), 300);
  }

  private buildRenderOptions(s: CogState): TIFFImageryProviderRenderOptions {
    if (s.mode === 'rgb') {
      const [min, max] = s.domain;
      return {
        nodata: 0,
        multi: {
          r: { band: s.rgb.r, min, max },
          g: { band: s.rgb.g, min, max },
          b: { band: s.rgb.b, min, max },
        },
      };
    }
    if (s.mode === 'expression') {
      const p = EXPR_PRESETS.find((e) => e.key === s.exprKey) ?? EXPR_PRESETS[0];
      return {
        nodata: 0,
        single: {
          expression: p.expression,
          domain: p.domain,
          colorScale: p.colorScale,
          clampLow: true,
          clampHigh: true,
        },
      };
    }

    return {
      nodata: 0,
      single: {
        band: s.band,
        colorScale: s.colorScale,
        domain: s.domain,
        clampLow: s.clampLow,
        clampHigh: s.clampHigh,
      },
    };
  }

  private async rebuild(first = false) {
    const my = ++this.token;
    const s = useCogStore.getState();
    const viewer = layerManager.cesium;

    try {
      const provider = s.mode === 'expression'
        ? await this.buildCpuIndexProvider(EXPR_PRESETS.find((e) => e.key === s.exprKey) ?? EXPR_PRESETS[0])
        : await TIFFImageryProvider.fromUrl(ENDPOINTS.cog, {
            renderOptions: this.buildRenderOptions(s),
            hasAlphaChannel: true,
            cacheSize: 32,
            // Keep the cache modest.
            workerPoolSize: 2,
          });
      if (my !== this.token) {
        if ('destroy' in provider && typeof provider.destroy === 'function') provider.destroy();
        return; // superseded by a newer rebuild
      }
      // Bridge the provider type mismatch.
      const newLayer = new ImageryLayer(provider as unknown as ImageryProvider);
      viewer.imageryLayers.add(newLayer);

      if (this.layer) {
        const old = this.layer;
        viewer.imageryLayers.remove(old, true);
      }
      this.layer = newLayer;

      if (first) {
        layerManager.registerImagery(LAYER_ID, '高光谱影像 (COG)', '高光谱', newLayer, true);
      } else {
        layerManager.replaceImagery(LAYER_ID, newLayer);
      }
    } catch (e) {
      console.error('COG layer build failed', e);
    }
  }

  getLayer(): ImageryLayer | null {
    return this.layer;
  }

  private async buildCpuIndexProvider(preset: ExprPreset): Promise<ImageryProvider> {
    const { bands, w, h, bbox } = await cogReader.overviewCube();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    const img = ctx.createImageData(w, h);
    const [min, max] = preset.domain;
    const span = max - min || 1;

    for (let i = 0; i < w * h; i++) {
      const value = this.evalIndex(preset.key, bands, i);
      const off = i * 4;
      if (!Number.isFinite(value)) {
        img.data[off + 3] = 0;
        continue;
      }
      const t = Math.max(0, Math.min(1, (value - min) / span));
      const [r, g, b] = this.colorForIndex(preset.key, t);
      img.data[off] = r;
      img.data[off + 1] = g;
      img.data[off + 2] = b;
      img.data[off + 3] = 210;
    }
    ctx.putImageData(img, 0, 0);

    const [west, south, east, north] = bbox;
    const rectangle = Rectangle.fromDegrees(west, south, east, north);
    return new CanvasSingleTileImageryProvider(canvas, rectangle) as unknown as ImageryProvider;
  }

  private evalIndex(key: string, bands: number[][], i: number): number {
    const b = (band: number) => {
      const v = bands[band - 1]?.[i];
      return Number.isFinite(v) && v !== 0 ? v : NaN;
    };
    const ratio = (a: number, c: number) => {
      const den = a + c;
      return Math.abs(den) > 1e-6 ? (a - c) / den : NaN;
    };

    switch (key) {
      case 'ndvi':
        return ratio(b(99), b(67));
      case 'ndwi_green_nir':
        return ratio(b(42), b(112));
      case 'gndvi':
        return ratio(b(99), b(42));
      case 'ndre':
        return ratio(b(87), b(77));
      case 'vari': {
        const green = b(42);
        const red = b(67);
        const blue = b(23);
        const den = green + red - blue;
        return Math.abs(den) > 1e-6 ? (green - red) / den : NaN;
      }
      default:
        return NaN;
    }
  }

  private colorForIndex(key: string, t: number): [number, number, number] {
    if (key === 'ndwi_green_nir') {
      return this.ramp(t, [
        [120, 72, 34],
        [240, 238, 210],
        [33, 145, 204],
        [8, 48, 107],
      ]);
    }
    if (key === 'vari') {
      return this.ramp(t, [
        [165, 0, 38],
        [255, 255, 191],
        [0, 104, 55],
      ]);
    }
    if (key === 'ndre') {
      return this.ramp(t, [
        [94, 60, 153],
        [230, 245, 152],
        [49, 163, 84],
      ]);
    }
    return this.ramp(t, [
      [166, 97, 26],
      [245, 245, 180],
      [120, 190, 80],
      [0, 104, 55],
    ]);
  }

  private ramp(t: number, stops: [number, number, number][]): [number, number, number] {
    const scaled = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
    const f = scaled - i;
    const a = stops[i];
    const b = stops[i + 1];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ];
  }
}

export const cogLayer = new CogLayerController();
