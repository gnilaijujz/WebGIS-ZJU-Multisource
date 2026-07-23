import { create } from 'zustand';

// Picked vector feature.
export interface PickedFeature {
  layer: string;
  title: string;
  props: Record<string, unknown>;
}

// Hyperspectral pixel query result.
export interface PixelQuery {
  lon: number;
  lat: number;
  col: number;
  row: number;
  band: number; // active band
  bandValue: number | null;
  spectrum: number[] | null; // 150 values
  loading: boolean;
  error?: string;
}

interface QueryState {
  feature: PickedFeature | null;
  pixel: PixelQuery | null;
  // Pinned spectra for comparison.
  pinned: { label: string; color: string; values: number[] }[];

  setFeature: (f: PickedFeature | null) => void;
  setPixel: (p: PixelQuery | null) => void;
  patchPixel: (p: Partial<PixelQuery>) => void;
  pinSpectrum: (label: string, values: number[]) => void;
  clearPins: () => void;
  clearAll: () => void;
}

const PIN_COLORS = ['#ff922b', '#20c997', '#f06595', '#845ef7', '#fab005'];

export const useQueryStore = create<QueryState>((set) => ({
  feature: null,
  pixel: null,
  pinned: [],

  setFeature: (feature) => set({ feature }),
  setPixel: (pixel) => set({ pixel }),
  patchPixel: (p) => set((s) => (s.pixel ? { pixel: { ...s.pixel, ...p } } : s)),
  pinSpectrum: (label, values) =>
    set((s) => ({
      pinned: [
        ...s.pinned,
        { label, values, color: PIN_COLORS[s.pinned.length % PIN_COLORS.length] },
      ],
    })),
  clearPins: () => set({ pinned: [] }),
  clearAll: () => set({ feature: null, pixel: null }),
}));
