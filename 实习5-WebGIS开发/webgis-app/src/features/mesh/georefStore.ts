import { create } from 'zustand';

// UI state for the interactive georeferencing of the 2DGS mesh.
interface GeorefState {
  active: boolean;
  pairs: number; // completed mesh<->world control-point pairs
  pending: boolean; // a mesh point picked, waiting for its world match
  rmse: number | null; // residual of the last solve (metres)
  set: (p: Partial<GeorefState>) => void;
}

export const useGeorefStore = create<GeorefState>((set) => ({
  active: false,
  pairs: 0,
  pending: false,
  rmse: null,
  set: (p) => set(p),
}));
