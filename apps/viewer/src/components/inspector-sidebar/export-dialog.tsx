import { Button } from '#/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog';
import {
  getShapeCodeFn,
  type ShapeCodeFormat,
  type ShapeCodeStyling,
} from '#/lib/server/shape-code';
import { useQuery } from '@tanstack/react-query';
import { Check, Code2, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Segmented } from './segmented';
import { SemanticRules } from './semantic-rules';

type CodeLang = 'html' | 'jsx' | 'css';

const FORMATS = ['html', 'jsx'] as const;
const STYLINGS = ['css', 'tailwind'] as const;

export function ExportDialog({
  fileId,
  pageId,
  shapeId,
  shapeName,
}: {
  fileId: string;
  pageId: string;
  shapeId: string;
  shapeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShapeCodeFormat>('html');
  const [styling, setStyling] = useState<ShapeCodeStyling>('css');
  const [includeDataAttrs, setIncludeDataAttrs] = useState(false);

  // Warm the Shiki bundle while the user is inspecting — by the time they
  // click "Export" the chunk + its WASM regex engine are already loaded, so
  // the first highlight is instant instead of stalling for ~500 ms.
  useEffect(() => {
    const preload = (): void => {
      void import('shiki/bundle/web');
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(preload);
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(preload, 300);
    return () => clearTimeout(t);
  }, []);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['shape-code', fileId, pageId, shapeId, format, styling, includeDataAttrs],
    queryFn: () =>
      getShapeCodeFn({
        data: { fileId, pageId, shapeId, format, styling, includeDataAttrs },
      }),
    enabled: open,
    // Rules are read server-side; SemanticRules invalidates this query on
    // every save, so we don't include rules in the key here.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs" title="Export shape as code" />}>
        <Code2 />
        Export
      </DialogTrigger>
      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export shape</DialogTitle>
          <DialogDescription>
            Generate framework-ready code for the selected shape.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-4">
          <Segmented label="Format" value={format} onChange={setFormat} options={FORMATS} />
          <Segmented label="Styling" value={styling} onChange={setStyling} options={STYLINGS} />
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] tracking-wider text-gray-400 uppercase select-none">
            <input
              type="checkbox"
              checked={includeDataAttrs}
              onChange={(e) => setIncludeDataAttrs(e.target.checked)}
              className="h-3 w-3 cursor-pointer"
            />
            Include data-* attrs
          </label>
        </div>

        {isError ? (
          <p className="text-destructive text-xs">
            {error instanceof Error ? error.message : 'Failed to generate code.'}
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <CodeBlock
              title={format.toUpperCase()}
              code={data?.code ?? ''}
              lang={format}
              loading={isFetching}
            />
            {styling === 'css' && (
              <CodeBlock
                title="CSS"
                code={data?.css ?? ''}
                lang="css"
                loading={isFetching}
                emptyHint="Shape has no inline styles."
              />
            )}
          </div>
        )}

        <SemanticRules fileId={fileId} selectedShapeId={shapeId} selectedShapeName={shapeName} />
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({
  title,
  code,
  lang,
  loading,
  emptyHint,
}: {
  title: string;
  code: string;
  lang: CodeLang;
  loading: boolean;
  emptyHint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const highlighted = useHighlightedCode(code, lang);

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const empty = !loading && !code;
  const showHighlighted = !loading && !empty && highlighted !== null;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
          {title}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!code}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors enabled:hover:bg-gray-100 enabled:hover:text-gray-700 disabled:opacity-50"
          title="Copy"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      {showHighlighted ? (
        // Shiki emits its own `<pre>` with inline `background-color` from the
        // theme — we force-transparent it and strip its padding so the wrapper
        // owns the chrome (rounded corners, max-height, scroll). Result: theme
        // colours on tokens, our gray-50 surface around them.
        <div
          className="max-h-80 overflow-auto rounded-md px-3 py-2 font-mono text-xs leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlighted! }}
        />
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-800">
          {loading ? (
            <span className="text-gray-400">Generating…</span>
          ) : empty ? (
            <span className="text-gray-400">{emptyHint ?? 'Empty.'}</span>
          ) : (
            // Highlighter is still loading; show plain code so the user sees
            // something useful instead of a blank pre.
            code
          )}
        </pre>
      )}
    </div>
  );
}

/**
 * Lazy-loads Shiki on first call (the `shiki` import is async so it doesn't
 * land in the initial client bundle) and re-highlights when `code`/`lang`
 * change. Returns `null` until the first highlighted output is ready.
 */
function useHighlightedCode(code: string, lang: CodeLang): string | null {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    // `shiki/bundle/web` ships only the languages we actually highlight
    // (html/jsx/css among them) — roughly half the size of the default
    // bundle. The lazy import + idle-time preload above keep both initial
    // load and first dialog open snappy.
    void import('shiki/bundle/web')
      .then(({ codeToHtml }) => codeToHtml(code, { lang, theme: 'github-light' }))
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return html;
}
