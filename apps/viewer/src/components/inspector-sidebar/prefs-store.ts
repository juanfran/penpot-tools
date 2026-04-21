import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorFormat, UnitFormat } from './format-prefs';

interface InspectorPrefsState {
  colorFormat: ColorFormat;
  unitFormat: UnitFormat;
  setColorFormat: (v: ColorFormat) => void;
  setUnitFormat: (v: UnitFormat) => void;
}

export const useInspectorPrefs = create<InspectorPrefsState>()(
  persist(
    (set) => ({
      colorFormat: 'hex',
      unitFormat: 'px',
      setColorFormat: (v) => set({ colorFormat: v }),
      setUnitFormat: (v) => set({ unitFormat: v }),
    }),
    { name: 'inspector-prefs' },
  ),
);
