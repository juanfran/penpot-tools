import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorFormat, UnitFormat } from './format-prefs';

export const INSPECTOR_MIN_WIDTH = 240;
export const INSPECTOR_MAX_WIDTH = 800;
export const INSPECTOR_DEFAULT_WIDTH = 320;

interface InspectorPrefsState {
  colorFormat: ColorFormat;
  unitFormat: UnitFormat;
  width: number;
  setColorFormat: (v: ColorFormat) => void;
  setUnitFormat: (v: UnitFormat) => void;
  setWidth: (v: number) => void;
}

export const useInspectorPrefs = create<InspectorPrefsState>()(
  persist(
    (set) => ({
      colorFormat: 'hex',
      unitFormat: 'px',
      width: INSPECTOR_DEFAULT_WIDTH,
      setColorFormat: (v) => set({ colorFormat: v }),
      setUnitFormat: (v) => set({ unitFormat: v }),
      setWidth: (v) => set({ width: v }),
    }),
    { name: 'inspector-prefs' },
  ),
);
