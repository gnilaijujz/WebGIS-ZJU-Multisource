import { create } from 'zustand';

// Lightweight UI-mode flags (split-screen compare, registration panel, etc.).
interface UiStore {
  compareOn: boolean;
  registrationOpen: boolean;
  setCompare: (on: boolean) => void;
  setRegistration: (open: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  compareOn: false,
  registrationOpen: false,
  setCompare: (compareOn) => set({ compareOn }),
  setRegistration: (registrationOpen) => set({ registrationOpen }),
}));
