import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover';
import { SlidersHorizontal } from 'lucide-react';

import { COLOR_FORMATS, UNIT_FORMATS } from './format-prefs';
import { useInspectorPrefs } from './prefs-store';
import { Segmented } from './segmented';

export function FormatPrefsPopover({ className }: { className?: string }) {
  const colorFormat = useInspectorPrefs((s) => s.colorFormat);
  const setColorFormat = useInspectorPrefs((s) => s.setColorFormat);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const setUnitFormat = useInspectorPrefs((s) => s.setUnitFormat);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Format preferences"
            title={`Color: ${colorFormat} · Unit: ${unitFormat}`}
            className={
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 ' +
              (className ?? '')
            }
          >
            <SlidersHorizontal size={11} />
            <span className="font-mono text-[10px] tracking-wider uppercase">
              {colorFormat} · {unitFormat}
            </span>
          </button>
        }
      />
      <PopoverContent align="end" className="w-auto gap-2 p-2">
        <Segmented
          label="Color"
          value={colorFormat}
          onChange={setColorFormat}
          options={COLOR_FORMATS}
        />
        <Segmented
          label="Unit"
          value={unitFormat}
          onChange={setUnitFormat}
          options={UNIT_FORMATS}
        />
      </PopoverContent>
    </Popover>
  );
}
