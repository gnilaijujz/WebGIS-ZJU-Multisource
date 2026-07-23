import { create } from 'zustand';

export type LayerKind = '3dtiles' | 'geojson' | 'points' | 'czml' | 'cog' | 'imagery' | 'model';

export interface LayerUI {
  id: string;
  name: string;
  group: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number;
  supportsOpacity: boolean;
  loading: boolean;
  error?: string;
}

interface LayerStore {
  order: string[];
  layers: Record<string, LayerUI>;
  /** Create or update a layer's UI record. */
  upsert: (l: Partial<LayerUI> & { id: string }) => void;
  patch: (id: string, p: Partial<LayerUI>) => void;
  setVisible: (id: string, visible: boolean) => void;
  setOpacity: (id: string, opacity: number) => void;
  remove: (id: string) => void;
}

export const useLayerStore = create<LayerStore>((set) => ({
  order: [],
  layers: {},
  upsert: (l) =>
    set((s) => {
      const prev = s.layers[l.id];
      const defaults: LayerUI = {
        id: l.id,
        name: l.id,
        group: '其他',
        kind: 'geojson',
        visible: true,
        opacity: 1,
        supportsOpacity: true,
        loading: false,
      };
      const merged: LayerUI = { ...defaults, ...prev, ...l };
      return {
        layers: { ...s.layers, [l.id]: merged },
        order: s.order.includes(l.id) ? s.order : [...s.order, l.id],
      };
    }),
  patch: (id, p) =>
    set((s) => (s.layers[id] ? { layers: { ...s.layers, [id]: { ...s.layers[id], ...p } } } : s)),
  setVisible: (id, visible) =>
    set((s) => (s.layers[id] ? { layers: { ...s.layers, [id]: { ...s.layers[id], visible } } } : s)),
  setOpacity: (id, opacity) =>
    set((s) => (s.layers[id] ? { layers: { ...s.layers, [id]: { ...s.layers[id], opacity } } } : s)),
  remove: (id) =>
    set((s) => {
      const layers = { ...s.layers };
      delete layers[id];
      return { layers, order: s.order.filter((x) => x !== id) };
    }),
}));
