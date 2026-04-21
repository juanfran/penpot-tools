import { Circle, Frame, GitMerge, Image, Layers, Minus, Square, Star, Type } from 'lucide-react';

export function shapeIcon(type: string) {
  const cls = 'shrink-0 text-gray-400';
  switch (type) {
    case 'frame':
      return <Frame size={14} className={cls} />;
    case 'group':
      return <Layers size={14} className={cls} />;
    case 'rect':
      return <Square size={14} className={cls} />;
    case 'circle':
      return <Circle size={14} className={cls} />;
    case 'text':
      return <Type size={14} className={cls} />;
    case 'image':
      return <Image size={14} className={cls} />;
    case 'path':
      return <Minus size={14} className={cls} />;
    case 'bool':
      return <GitMerge size={14} className={cls} />;
    case 'svg-raw':
      return <Star size={14} className={cls} />;
    default:
      return <Square size={14} className={cls} />;
  }
}
