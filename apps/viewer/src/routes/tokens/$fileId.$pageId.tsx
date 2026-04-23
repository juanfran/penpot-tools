import { getFileSummaryFn, getPageTokensFn, type PageTokens } from '#/lib/server/penpot-api';
import { Input } from '#/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip';
import { COLOR_FORMATS, UNIT_FORMATS, transformValue } from '#/components/inspector-sidebar/format-prefs';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';
import { Segmented } from '#/components/inspector-sidebar/segmented';
import type { TokenCategory, TokenInfo } from '@penpot-random/converter/tokens';
import { tokenToCssVarName } from '@penpot-random/converter/tokens';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Check, Copy, ExternalLink, Loader2, Search } from 'lucide-react';
import { Suspense, useDeferredValue, useMemo, useState } from 'react';
import { z } from 'zod';

const fileSummaryOptions = (fileId: string) =>
  queryOptions({
    queryKey: ['get-file', fileId],
    queryFn: () => getFileSummaryFn({ data: { fileId } }),
  });

const pageTokensOptions = (fileId: string, pageId: string) =>
  queryOptions<PageTokens>({
    queryKey: ['page-tokens', fileId, pageId],
    queryFn: () => getPageTokensFn({ data: { fileId, pageId } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute('/tokens/$fileId/$pageId')({
  validateSearch: z.object({ teamId: z.string().optional() }).parse,
  component: RouteComponent,
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  beforeLoad: async ({ params, search, context }) => {
    if (params.pageId !== '0000-0000-0000-0000') return;
    const file = await context.queryClient.ensureQueryData(fileSummaryOptions(params.fileId));
    const firstPageId = file.data.pages[0];
    if (!firstPageId) throw new Error('File has no pages');
    throw redirect({
      to: '/tokens/$fileId/$pageId',
      params: { fileId: params.fileId, pageId: firstPageId },
      search: { teamId: search.teamId },
      replace: true,
    });
  },
  loader: ({ params, context }) => {
    context.queryClient.prefetchQuery(fileSummaryOptions(params.fileId));
    context.queryClient.prefetchQuery(pageTokensOptions(params.fileId, params.pageId));
  },
});

const CATEGORY_ORDER: TokenCategory[] = [
  'color',
  'typography',
  'spacing',
  'radius',
  'dimension',
  'stroke',
  'rotation',
];

const CATEGORY_LABEL: Record<TokenCategory, string> = {
  color: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  dimension: 'Dimensions',
  stroke: 'Stroke',
  rotation: 'Rotation',
};

function RouteComponent() {
  const { fileId, pageId } = Route.useParams();
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Suspense fallback={<HeaderFallback />}>
        <Header fileId={fileId} pageId={pageId} />
      </Suspense>
      <Suspense fallback={<BodyFallback />}>
        <TokensBody fileId={fileId} pageId={pageId} />
      </Suspense>
    </div>
  );
}

function Header({ fileId, pageId }: { fileId: string; pageId: string }) {
  const { data: file } = useSuspenseQuery(fileSummaryOptions(fileId));
  const { data: page } = useSuspenseQuery(pageTokensOptions(fileId, pageId));
  const { teamId } = Route.useSearch();
  const penpotParams = new URLSearchParams({ 'file-id': fileId, 'page-id': pageId });
  if (teamId) penpotParams.set('team-id', teamId);
  const penpotUrl = `https://design.penpot.app/#/workspace?${penpotParams.toString()}`;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <Link to="/" search={{ teamId }} className="text-sm font-semibold text-gray-900 hover:text-gray-600">
        Penpot Viewer
      </Link>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-600">{file.name}</span>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-900">{page.pageName}</span>
      <span className="ml-2 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
        Tokens
      </span>
      <div className="ml-auto flex items-center gap-4">
        <Link
          to="/workspace/$fileId/$pageId"
          params={{ fileId, pageId }}
          search={{ teamId }}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Workspace
        </Link>
        <a
          href={penpotUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          Open in Penpot <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  );
}

function HeaderFallback() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
      <span className="text-gray-300">/</span>
      <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
      <div className="ml-auto h-3 w-24 animate-pulse rounded bg-gray-100" />
    </header>
  );
}

function BodyFallback() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading tokens…
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <HeaderFallback />
      <BodyFallback />
    </div>
  );
}

function TokensBody({ fileId, pageId }: { fileId: string; pageId: string }) {
  const { data } = useSuspenseQuery(pageTokensOptions(fileId, pageId));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const colorFormat = useInspectorPrefs((s) => s.colorFormat);
  const setColorFormat = useInspectorPrefs((s) => s.setColorFormat);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const setUnitFormat = useInspectorPrefs((s) => s.setUnitFormat);

  const displayTokens = useMemo<DisplayToken[]>(
    () =>
      data.tokens.map((t) => ({
        ...t,
        displayValue: shouldTransform(t)
          ? transformValue(t.value, colorFormat, unitFormat)
          : t.value,
      })),
    [data.tokens, colorFormat, unitFormat],
  );

  const grouped = useMemo(
    () => groupTokens(displayTokens, deferredQuery),
    [displayTokens, deferredQuery],
  );
  const totalCount = data.tokens.length;
  const visibleCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

  if (totalCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">No design tokens are applied on this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar groups={grouped} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search tokens by name or value…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
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
            <span className="text-xs whitespace-nowrap text-gray-500">
              {visibleCount} / {totalCount} tokens
            </span>
          </div>

          {grouped.length === 0 ? (
            <p className="text-sm text-gray-500">No tokens match your search.</p>
          ) : (
            grouped.map((group) => (
              <CategorySection key={group.category} category={group.category} items={group.items} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

interface DisplayToken extends TokenInfo {
  displayValue: string;
}

interface TokenGroup {
  category: TokenCategory;
  items: DisplayToken[];
}

/**
 * Skip transform for tokens whose value is already plain text (fontFamily,
 * textCase, textDecoration, rotation). These have no color literals or px
 * units, so running the regex is wasted work.
 */
function shouldTransform(t: TokenInfo): boolean {
  if (t.category === 'color') return true;
  if (t.numericValue != null) return true;
  return false;
}

function groupTokens(tokens: DisplayToken[], query: string): TokenGroup[] {
  const q = query.trim().toLowerCase();
  const buckets = new Map<TokenCategory, DisplayToken[]>();
  for (const t of tokens) {
    if (q) {
      const hay = `${t.name} ${t.displayValue} ${t.attribute}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    let list = buckets.get(t.category);
    if (!list) {
      list = [];
      buckets.set(t.category, list);
    }
    list.push(t);
  }
  const groups: TokenGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = buckets.get(category);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => {
      if (a.numericValue != null && b.numericValue != null) return a.numericValue - b.numericValue;
      return a.name.localeCompare(b.name);
    });
    groups.push({ category, items });
  }
  return groups;
}

function Sidebar({ groups }: { groups: TokenGroup[] }) {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-gray-200 bg-white px-3 py-6 md:block">
      <h2 className="mb-3 px-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        Categories
      </h2>
      <nav className="flex flex-col gap-0.5">
        {groups.map((g) => (
          <a
            key={g.category}
            href={`#cat-${g.category}`}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>{CATEGORY_LABEL[g.category]}</span>
            <span className="text-xs text-gray-400">{g.items.length}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}

function CategorySection({
  category,
  items,
}: {
  category: TokenCategory;
  items: DisplayToken[];
}) {
  return (
    <section id={`cat-${category}`} className="mb-8 scroll-mt-4" style={{ contentVisibility: 'auto' }}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{CATEGORY_LABEL[category]}</h2>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      <div
        className={
          category === 'color'
            ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
            : 'grid grid-cols-1 gap-3 md:grid-cols-2'
        }
      >
        {items.map((t) => (
          <TokenCard key={`${t.attribute}::${t.name}`} token={t} />
        ))}
      </div>
    </section>
  );
}

function TokenCard({ token }: { token: DisplayToken }) {
  const cssVar = `var(--${tokenToCssVarName(token.name)})`;
  return (
    <div className="group relative flex gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      <TokenPreview token={token} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[13px] text-gray-900">{token.name}</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">
          {token.displayValue}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
          <span className="rounded bg-gray-100 px-1.5 py-0.5">{token.attribute}</span>
          <span>
            Used {token.usageCount}
            {token.usageCount === 1 ? ' time' : ' times'}
          </span>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton text={cssVar} label="Copy CSS var" />
        <CopyButton text={token.displayValue} label="Copy value" />
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        }
      />
      <TooltipContent>
        <div>{copied ? 'Copied!' : label}</div>
        <div className="mt-0.5 max-w-60 truncate font-mono text-[10px] opacity-70">{text}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function TokenPreview({ token }: { token: DisplayToken }) {
  switch (token.category) {
    case 'color':
      return (
        <div
          className="h-14 w-14 shrink-0 rounded-md border border-gray-200"
          style={{ background: token.value }}
          aria-label={`Color swatch ${token.displayValue}`}
        />
      );
    case 'radius':
      return <RadiusPreview token={token} />;
    case 'spacing':
    case 'dimension':
      return <BarPreview value={token.numericValue ?? 0} />;
    case 'stroke':
      return <StrokePreview width={token.numericValue ?? 1} />;
    case 'rotation':
      return <RotationPreview deg={token.numericValue ?? 0} />;
    case 'typography':
      return <TypographyPreview token={token} />;
    default:
      return <div className="h-14 w-14 shrink-0 rounded-md bg-gray-100" />;
  }
}

function BarPreview({ value }: { value: number }) {
  const w = Math.min(Math.max(value, 2), 48);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-50">
      <div
        className="rounded-sm bg-gray-900"
        style={{ width: `${w}px`, height: `${Math.min(w, 10)}px`, minHeight: 3 }}
      />
    </div>
  );
}

function RadiusPreview({ token }: { token: DisplayToken }) {
  const r = Math.min(token.numericValue ?? 0, 22);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-gray-50">
      <div
        className="h-10 w-10 border border-gray-900"
        style={{ borderRadius: `${r}px` }}
      />
    </div>
  );
}

function StrokePreview({ width }: { width: number }) {
  const h = Math.min(Math.max(width, 1), 12);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-50">
      <div className="bg-gray-900" style={{ height: `${h}px`, width: '36px' }} />
    </div>
  );
}

function RotationPreview({ deg }: { deg: number }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-50">
      <div
        className="h-8 w-8 border border-gray-900"
        style={{ transform: `rotate(${deg}deg)` }}
      />
    </div>
  );
}

function TypographyPreview({ token }: { token: DisplayToken }) {
  const style: React.CSSProperties = {};
  switch (token.attribute) {
    case 'fontSize':
      style.fontSize = `${Math.min(token.numericValue ?? 16, 32)}px`;
      break;
    case 'fontFamily':
      style.fontFamily = token.value;
      break;
    case 'lineHeight':
      style.lineHeight = token.value;
      break;
    case 'letterSpacing':
      style.letterSpacing = token.value;
      break;
    case 'textCase':
      style.textTransform = token.value as React.CSSProperties['textTransform'];
      break;
    case 'textDecoration':
      style.textDecoration = token.value;
      break;
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-900">
      <span style={style} className="font-semibold leading-none">
        Aa
      </span>
    </div>
  );
}
