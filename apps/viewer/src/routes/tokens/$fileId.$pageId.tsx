import { getPageTokensFn, type PageTokens } from '#/lib/server/penpot-api';
import { Input } from '#/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip';
import {
  PageHeader,
  PageHeaderFallback,
  getFileSummaryQueryOptions,
} from '#/components/page-header';
import {
  COLOR_FORMATS,
  UNIT_FORMATS,
  transformValue,
} from '#/components/inspector-sidebar/format-prefs';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';
import { Segmented } from '#/components/inspector-sidebar/segmented';
import { StyleDecl } from '#/components/inspector-sidebar/style-decl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs';
import type { TokenCategory, TokenInfo } from '@penpot-random/converter/tokens';
import { tokenToCssVarName } from '@penpot-random/converter/tokens';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Check, Copy, Loader2, Search } from 'lucide-react';
import { Suspense, useDeferredValue, useMemo, useState } from 'react';
import { z } from 'zod';

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
    const file = await context.queryClient.ensureQueryData(
      getFileSummaryQueryOptions(params.fileId),
    );
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
    context.queryClient.prefetchQuery(getFileSummaryQueryOptions(params.fileId));
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
  const { teamId } = Route.useSearch();
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Suspense fallback={<PageHeaderFallback />}>
        <TokensHeader fileId={fileId} pageId={pageId} teamId={teamId} />
      </Suspense>
      <Suspense fallback={<BodyFallback />}>
        <TokensBody fileId={fileId} pageId={pageId} />
      </Suspense>
    </div>
  );
}

function TokensHeader({
  fileId,
  pageId,
  teamId,
}: {
  fileId: string;
  pageId: string;
  teamId: string | undefined;
}) {
  const { data: page } = useSuspenseQuery(pageTokensOptions(fileId, pageId));
  return (
    <PageHeader
      fileId={fileId}
      pageId={pageId}
      teamId={teamId}
      view="tokens"
      pageName={page.pageName}
    />
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
      <PageHeaderFallback />
      <BodyFallback />
    </div>
  );
}

function TokensBody({ fileId, pageId }: { fileId: string; pageId: string }) {
  const { data } = useSuspenseQuery(pageTokensOptions(fileId, pageId));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [tab, setTab] = useState<'preview' | 'css'>('preview');

  const colorFormat = useInspectorPrefs((s) => s.colorFormat);
  const setColorFormat = useInspectorPrefs((s) => s.setColorFormat);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const setUnitFormat = useInspectorPrefs((s) => s.setUnitFormat);

  const displayTokens = useMemo<DisplayToken[]>(() => {
    const map = new Map<string, DisplayToken>();
    for (const t of data.tokens) {
      const existing = map.get(t.name);
      if (existing) {
        if (!existing.attributes.includes(t.attribute)) existing.attributes.push(t.attribute);
        existing.usageCount += t.usageCount;
        continue;
      }
      map.set(t.name, {
        name: t.name,
        category: t.category,
        value: t.value,
        numericValue: t.numericValue,
        attributes: [t.attribute],
        usageCount: t.usageCount,
        displayValue: shouldTransform(t)
          ? transformValue(t.value, colorFormat, unitFormat)
          : t.value,
      });
    }
    return Array.from(map.values());
  }, [data.tokens, colorFormat, unitFormat]);

  const grouped = useMemo(
    () => groupTokens(displayTokens, deferredQuery),
    [displayTokens, deferredQuery],
  );
  const cssGroups = useMemo(() => groupTokens(displayTokens, ''), [displayTokens]);
  const totalCount = displayTokens.length;
  const visibleCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

  if (totalCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">No design tokens are applied on this page.</p>
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as 'preview' | 'css')}
      className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
    >
      <div className="border-b border-gray-200 bg-white px-6">
        <TabsList variant="line" className="h-10 p-0">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="preview" className="flex min-h-0 overflow-hidden">
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
                <CategorySection
                  key={group.category}
                  category={group.category}
                  items={group.items}
                />
              ))
            )}
          </div>
        </main>
      </TabsContent>
      <TabsContent value="css" className="min-h-0 overflow-auto">
        <CssView groups={cssGroups} />
      </TabsContent>
    </Tabs>
  );
}

function CssView({ groups }: { groups: TokenGroup[] }) {
  const [copied, setCopied] = useState(false);
  const colorFormat = useInspectorPrefs((s) => s.colorFormat);
  const setColorFormat = useInspectorPrefs((s) => s.setColorFormat);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const setUnitFormat = useInspectorPrefs((s) => s.setUnitFormat);

  const cssText = useMemo(() => {
    const lines: string[] = [':root {'];
    groups.forEach((g, i) => {
      if (i > 0) lines.push('');
      lines.push(`  /* ${CATEGORY_LABEL[g.category]} */`);
      for (const t of g.items) {
        lines.push(`  --${tokenToCssVarName(t.name)}: ${t.displayValue};`);
      }
    });
    lines.push('}');
    return lines.join('\n');
  }, [groups]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(cssText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="text-sm font-semibold text-gray-900">CSS Custom Properties</h2>
        <div className="ml-auto flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied!' : 'Copy all'}</span>
          </button>
        </div>
      </div>
      <div className="rounded-md bg-gray-50 px-3 py-3 font-mono text-xs leading-relaxed">
        <div className="text-gray-600">:root {'{'}</div>
        {groups.map((g, i) => (
          <div key={g.category} className={i > 0 ? 'mt-2' : ''}>
            <div className="pl-3 text-gray-400">/* {CATEGORY_LABEL[g.category]} */</div>
            <div className="pl-3">
              {g.items.map((t) => (
                <StyleDecl
                  key={t.name}
                  prop={`--${tokenToCssVarName(t.name)}`}
                  value={t.displayValue}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="text-gray-600">{'}'}</div>
      </div>
    </div>
  );
}

interface DisplayToken extends Omit<TokenInfo, 'attribute'> {
  attributes: string[];
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
      const hay = `${t.name} ${t.displayValue} ${t.attributes.join(' ')}`.toLowerCase();
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

function CategorySection({ category, items }: { category: TokenCategory; items: DisplayToken[] }) {
  return (
    <section
      id={`cat-${category}`}
      className="mb-8 scroll-mt-4"
      style={{ contentVisibility: 'auto' }}
    >
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
          <TokenCard key={t.name} token={t} />
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
        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">{token.displayValue}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
          {token.attributes.map((a) => (
            <span key={a} className="rounded bg-gray-100 px-1.5 py-0.5">
              {a}
            </span>
          ))}
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
      <div className="h-10 w-10 border border-gray-900" style={{ borderRadius: `${r}px` }} />
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
      <div className="h-8 w-8 border border-gray-900" style={{ transform: `rotate(${deg}deg)` }} />
    </div>
  );
}

function TypographyPreview({ token }: { token: DisplayToken }) {
  const style: React.CSSProperties = {};
  switch (token.attributes[0]) {
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
      <span style={style} className="leading-none font-semibold">
        Aa
      </span>
    </div>
  );
}
