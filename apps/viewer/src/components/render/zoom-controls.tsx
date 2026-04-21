import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useControls } from 'react-zoom-pan-pinch';

export const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div
      className="absolute right-4 bottom-4 z-50 flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1 shadow-xl backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => zoomIn()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
      <div className="h-4 w-px bg-white/20" />
      <button
        onClick={() => zoomOut()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <div className="h-4 w-px bg-white/20" />
      <button
        onClick={() => resetTransform()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Reset zoom"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
};
