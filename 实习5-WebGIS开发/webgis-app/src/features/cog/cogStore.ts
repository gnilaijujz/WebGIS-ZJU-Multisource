import { create } from 'zustand';

export type CogMode = 'single' | 'rgb' | 'expression';

// Colormaps exposed by tiff-imagery-provider.
export const COLOR_SCALES = [
  'viridis',
  'turbo',
  'jet',
  'rainbow',
  'magma',
  'plasma',
  'hot',
  'greys',
  'ylgnbu',
  'greens',
  'rdbu',
  'coolwarm',
] as const;
export type ColorScale = (typeof COLOR_SCALES)[number];

// Preset band expressions.
export interface ExprPreset {
  key: string;
  label: string;
  expression: string;
  domain: [number, number];
  colorScale: ColorScale;
  description: string;
}
export const EXPR_PRESETS: ExprPreset[] = [
  {
    key: 'ndvi',
    label: 'NDVI 植被指数',
    expression: '(b99 - b67) / (b99 + b67 + 0.000001)',
    domain: [-0.2, 0.8],
    colorScale: 'greens',
    description: 'NIR 802.2 nm (b99) 与 Red 663.9 nm (b67)。植被通常更高。',
  },
  {
    key: 'ndwi_green_nir',
    label: 'NDWI 水体指数',
    expression: '(b42 - b112) / (b42 + b112 + 0.000001)',
    domain: [-0.6, 0.6],
    colorScale: 'rdbu',
    description: 'Green 558.4 nm (b42) 与 NIR 859.3 nm (b112)，为 McFeeters Green-NIR 版本；本数据无 SWIR。',
  },
  {
    key: 'gndvi',
    label: 'GNDVI 绿归一化植被',
    expression: '(b99 - b42) / (b99 + b42 + 0.000001)',
    domain: [-0.2, 0.8],
    colorScale: 'greens',
    description: 'NIR 802.2 nm (b99) 与 Green 558.4 nm (b42)，对叶绿素/冠层差异更敏感。',
  },
  {
    key: 'ndre',
    label: 'NDRE 红边指数',
    expression: '(b87 - b77) / (b87 + b77 + 0.000001)',
    domain: [-0.1, 0.5],
    colorScale: 'ylgnbu',
    description: 'NIR 749.9 nm (b87) 与 Red-edge 706.8 nm (b77)，用于观察红边附近的植被差异。',
  },
  {
    key: 'vari',
    label: 'VARI 可见光植被',
    expression: '(b42 - b67) / (b42 + b67 - b23 + 0.000001)',
    domain: [-1, 1],
    colorScale: 'coolwarm',
    description: 'Green 558.4 nm (b42)、Red 663.9 nm (b67)、Blue 479.5 nm (b23)，仅用可见光估计植被差异。',
  },
];

export interface CogState {
  mode: CogMode;
  band: number;
  colorScale: ColorScale;
  domain: [number, number];
  clampLow: boolean;
  clampHigh: boolean;
  rgb: { r: number; g: number; b: number };
  exprKey: string;
  rev: number;

  setMode: (m: CogMode) => void;
  setBand: (b: number) => void;
  setColorScale: (c: ColorScale) => void;
  setDomain: (d: [number, number]) => void;
  setClamp: (low: boolean, high: boolean) => void;
  setRgb: (rgb: Partial<{ r: number; g: number; b: number }>) => void;
  setExprKey: (k: string) => void;
}

const bump = (s: CogState) => ({ rev: s.rev + 1 });

export const useCogStore = create<CogState>((set) => ({
  mode: 'single',
  band: 60,
  colorScale: 'viridis',
  domain: [0, 0.6],
  clampLow: true,
  clampHigh: true,
  rgb: { r: 100, g: 60, b: 30 },
  exprKey: EXPR_PRESETS[0].key,
  rev: 0,

  setMode: (mode) => set((s) => ({ mode, ...bump(s) })),
  setBand: (band) => set((s) => ({ band, ...bump(s) })),
  setColorScale: (colorScale) => set((s) => ({ colorScale, ...bump(s) })),
  setDomain: (domain) => set((s) => ({ domain, ...bump(s) })),
  setClamp: (clampLow, clampHigh) => set((s) => ({ clampLow, clampHigh, ...bump(s) })),
  setRgb: (rgb) => set((s) => ({ rgb: { ...s.rgb, ...rgb }, ...bump(s) })),
  setExprKey: (exprKey) => set((s) => ({ exprKey, ...bump(s) })),
}));
