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
import { useState } from 'react';

import { Segmented } from './segmented';
import { SemanticRules } from './semantic-rules';

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

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['shape-code', fileId, pageId, shapeId, format, styling],
    queryFn: () =>
      getShapeCodeFn({ data: { fileId, pageId, shapeId, format, styling } }),
    enabled: open,
    // Rules are read server-side; SemanticRules invalidates this query on
    // every save, so we don't include rules in the key here.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="xs" title="Export shape as code" />
        }
      >
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

        <div className="flex flex-wrap gap-4">
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={FORMATS}
          />
          <Segmented
            label="Styling"
            value={styling}
            onChange={setStyling}
            options={STYLINGS}
          />
        </div>

        {isError ? (
          <p className="text-xs text-destructive">
            {error instanceof Error ? error.message : 'Failed to generate code.'}
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <CodeBlock
              title={format.toUpperCase()}
              code={data?.code ?? ''}
              loading={isFetching}
            />
            {styling === 'css' && (
              <CodeBlock
                title="CSS"
                code={data?.css ?? ''}
                loading={isFetching}
                emptyHint="Shape has no inline styles."
              />
            )}
          </div>
        )}

        <SemanticRules
          fileId={fileId}
          selectedShapeId={shapeId}
          selectedShapeName={shapeName}
        />
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({
  title,
  code,
  loading,
  emptyHint,
}: {
  title: string;
  code: string;
  loading: boolean;
  emptyHint?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const empty = !loading && !code;

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
      <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-800">
        {loading ? (
          <span className="text-gray-400">Generating…</span>
        ) : empty ? (
          <span className="text-gray-400">{emptyHint ?? 'Empty.'}</span>
        ) : (
          code
        )}
      </pre>
    </div>
  );
}
