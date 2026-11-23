import type { DesignCommentThread } from '@penpot-tools/converter/comments';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTransformContext } from 'react-zoom-pan-pinch';

import { type CommentVisibility } from '#/components/comments/comments-prefs';
import {
  COMMENT_CARD_CLOSE_ATTR,
  CommentThreadCard,
  ThreadNumber,
} from '#/components/comments/thread-card';

import { placeCard } from './card-placement';

/** Above the hit zone (1) and selection highlights (2, 3). */
const PIN_Z_INDEX = 10;
const ACTIVE_PIN_Z_INDEX = 11;
/** Pin size in screen px (`size-7`). */
const PIN_SIZE = 28;
/** Space between the pin, its card and the canvas edges, in screen px. */
const CARD_GAP = 8;

export function visibleThreads(
  threads: readonly DesignCommentThread[],
  visibility: CommentVisibility,
  activeThreadId: string | undefined,
): DesignCommentThread[] {
  return threads.filter(
    (t) =>
      // The open thread always shows, e.g. when opened from the inspector
      // while pins are hidden.
      t.id === activeThreadId || visibility === 'all' || (visibility === 'open' && !t.resolved),
  );
}

/**
 * Comment pins on the canvas, drawn in page coordinates inside the zoomable
 * content. Pins and the open thread card keep a constant on-screen size: a
 * `--inv-scale` custom property (1 / zoom) on the layer counter-scales them,
 * updated straight from the zoom library so pan/zoom never re-renders React.
 *
 * Like Penpot, the pin's bottom-left corner sits exactly on the comment point.
 * The open card is re-placed on every pan/zoom/resize so it stays inside the
 * visible canvas (right of the pin, else left, clamped vertically).
 */
export function CommentPins({
  threads,
  activeThreadId,
  onActiveThreadChange,
  onSelectShape,
  onRevealPoint,
}: {
  threads: DesignCommentThread[];
  activeThreadId?: string;
  onActiveThreadChange: (id: string | undefined) => void;
  onSelectShape: (shapeId: string) => void;
  /** Pan the canvas so a page point is in view (keyboard focus on an off-screen pin). */
  onRevealPoint?: (x: number, y: number) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());
  const zoom = useTransformContext();

  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const apply = (scale: number) => el.style.setProperty('--inv-scale', String(1 / scale));
    apply(zoom.state.scale);
    return zoom.onChange((ctx) => apply(ctx.instance.state.scale));
  }, [zoom]);

  useLayoutEffect(() => {
    if (!activeThreadId) return;
    const card = cardRef.current;
    const pin = pinRefs.current.get(activeThreadId);
    const canvas = layerRef.current?.closest('[role="application"]');
    if (!card || !pin || !canvas) return;
    const place = () => {
      const p = pin.getBoundingClientRect();
      const { left, top } = placeCard({
        origin: { x: p.left, y: p.bottom },
        pin: PIN_SIZE,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        bounds: canvas.getBoundingClientRect(),
        gap: CARD_GAP,
      });
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    };
    place();
    // Move focus into the card without letting the browser scroll the
    // transformed canvas to it.
    card.querySelector<HTMLElement>(`[${COMMENT_CARD_CLOSE_ATTR}]`)?.focus({ preventScroll: true });
    const unsubscribe = zoom.onChange(place);
    // The canvas narrows when the inspector opens; the card grows when replies load.
    const observer = new ResizeObserver(place);
    observer.observe(canvas);
    observer.observe(card);
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [activeThreadId, zoom]);

  const setPinRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) pinRefs.current.set(id, el);
    else pinRefs.current.delete(id);
  }, []);

  /** Close from inside the card (X / Escape) and hand focus back to its pin. */
  const closeCard = (threadId: string) => {
    onActiveThreadChange(undefined);
    pinRefs.current.get(threadId)?.focus({ preventScroll: true });
  };

  return (
    <div ref={layerRef} className="absolute top-0 left-0" style={{ zIndex: PIN_Z_INDEX }}>
      {threads.map((thread) => {
        const active = thread.id === activeThreadId;
        return (
          <div
            key={thread.id}
            className="absolute"
            style={{
              left: thread.position.x,
              top: thread.position.y,
              zIndex: active ? ACTIVE_PIN_Z_INDEX : undefined,
            }}
          >
            <div className="origin-top-left" style={{ transform: 'scale(var(--inv-scale, 1))' }}>
              <button
                ref={(el) => setPinRef(thread.id, el)}
                type="button"
                className="pointer-events-auto absolute bottom-0 left-0 cursor-pointer rounded-full rounded-bl-none shadow-md transition-transform hover:scale-110"
                style={{ transformOrigin: '0 100%' }}
                aria-label={`Comment thread #${thread.seqn}${thread.resolved ? ' (resolved)' : ''}`}
                aria-expanded={active}
                title={thread.comments[0]?.text}
                onClick={(e) => {
                  e.stopPropagation();
                  onActiveThreadChange(active ? undefined : thread.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  const canvas = layerRef.current?.closest('[role="application"]');
                  if (!canvas || !onRevealPoint) return;
                  const p = e.currentTarget.getBoundingClientRect();
                  const c = canvas.getBoundingClientRect();
                  const visible =
                    p.left >= c.left &&
                    p.right <= c.right &&
                    p.top >= c.top &&
                    p.bottom <= c.bottom;
                  if (!visible) onRevealPoint(thread.position.x, thread.position.y);
                }}
              >
                <ThreadNumber thread={thread} active={active} className="size-7 text-xs" />
              </button>
              {active && (
                <CommentThreadCard
                  ref={cardRef}
                  thread={thread}
                  className="pointer-events-auto absolute"
                  // Placed by the layout effect above before the first paint.
                  style={{ left: PIN_SIZE + CARD_GAP, top: -PIN_SIZE }}
                  onClose={() => closeCard(thread.id)}
                  onSelectShape={onSelectShape}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
