import { getPageShapesOptions, Render, type RenderHandle } from '#/components/render';
import { PagesSidebar } from '#/components/pages-sidebar';
import { InspectorSidebar } from '#/components/inspector-sidebar';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';
import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Suspense, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const getFileSummaryQueryOptions = (fileId: string) => {
  return queryOptions({
    queryKey: ['get-file', fileId],
    queryFn: () => {
      return getFileSummaryFn({ data: { fileId } });
    },
  });
};

export const Route = createFileRoute('/workspace/$fileId/$pageId')({
  validateSearch: z.object({
    teamId: z.string().optional(),
  }).parse,
  component: RouteComponent,
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  beforeLoad: async ({ params, search, context }) => {
    if (params.pageId !== '0000-0000-0000-0000') {
      return;
    }

    const file = await context.queryClient.ensureQueryData(
      getFileSummaryQueryOptions(params.fileId),
    );

    const firstPageId = file.data.pages[0];
    if (!firstPageId) {
      throw new Error('File has no pages');
    }
    throw redirect({
      to: '/workspace/$fileId/$pageId',
      params: { fileId: params.fileId, pageId: firstPageId },
      search: { teamId: search.teamId },
      replace: true,
    });
  },
  loader: ({ params, context }) => {
    context.queryClient.prefetchQuery(getFileSummaryQueryOptions(params.fileId));
    context.queryClient.prefetchQuery(getPageShapesOptions(params.fileId, params.pageId));
  },
});

function Header({ fileId, pageId }: { fileId: string; pageId: string }) {
  const { data: file } = useSuspenseQuery(getFileSummaryQueryOptions(fileId));
  const { teamId } = Route.useSearch();

  const penpotParams = new URLSearchParams({ 'file-id': fileId, 'page-id': pageId });
  if (teamId) penpotParams.set('team-id', teamId);
  const penpotUrl = `https://design.penpot.app/#/workspace?${penpotParams.toString()}`;

  return (
    <header className="flex h-12 items-center gap-3 border-b border-gray-200 px-4">
      <Link
        to="/"
        search={{ teamId }}
        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
      >
        Penpot Viewer
      </Link>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-600">{file.name}</span>
      <a
        href={penpotUrl}
        target="_blank"
        rel="noreferrer"
        className="ml-auto text-sm text-gray-500 hover:text-gray-800"
      >
        Open in Penpot ↗
      </a>
    </header>
  );
}

function PageSkeleton() {
  const inspectorWidth = useInspectorPrefs((s) => s.width);
  return (
    <div className="flex h-screen flex-col">
      <HeaderFallback />
      <div className="flex flex-1 overflow-hidden">
        <PagesSidebarFallback />
        <main className="relative flex-1 overflow-auto">
          <RenderFallback />
        </main>
        <InspectorSidebarFallback width={inspectorWidth} />
      </div>
    </div>
  );
}

function HeaderFallback() {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-gray-200 px-4">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
      <span className="text-gray-300">/</span>
      <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
      <div className="ml-auto h-3 w-24 animate-pulse rounded bg-gray-100" />
    </header>
  );
}

function PagesSidebarFallback() {
  return (
    <aside className="w-84 shrink-0 border-r border-gray-200 p-3">
      <div className="mb-4 h-4 w-20 animate-pulse rounded bg-gray-200" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ paddingLeft: `${(i % 4) * 12}px` }}
          >
            <div className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-gray-200" />
            <div
              className="h-3 animate-pulse rounded bg-gray-100"
              style={{ width: `${60 + ((i * 17) % 35)}%` }}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}

function RenderFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      <p className="text-xs text-gray-500">Loading page…</p>
    </div>
  );
}

function InspectorSidebarFallback({ width }: { width: number }) {
  return (
    <aside style={{ width: `${width}px` }} className="shrink-0 border-l border-gray-200 p-3">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </aside>
  );
}

function SidebarWrapper({
  fileId,
  pageId,
  selectedShapeId,
  onShapeSelect,
  onGoToShape,
}: {
  fileId: string;
  pageId: string;
  selectedShapeId: string | undefined;
  onShapeSelect: (id: string) => void;
  onGoToShape: (id: string) => void;
}) {
  const { data: file } = useSuspenseQuery(getFileSummaryQueryOptions(fileId));
  const { teamId } = Route.useSearch();

  return (
    <PagesSidebar
      fileId={fileId}
      pageId={pageId}
      fileSummary={file}
      teamId={teamId}
      selectedShapeId={selectedShapeId}
      onShapeSelect={onShapeSelect}
      onGoToShape={onGoToShape}
    />
  );
}

function RouteComponent() {
  const { fileId, pageId } = Route.useParams();
  const [selectedShapeId, setSelectedShapeId] = useState<string | undefined>(undefined);
  const renderRef = useRef<RenderHandle>(null);
  const inspectorWidth = useInspectorPrefs((s) => s.width);

  const handleGoToShape = (id: string) => {
    renderRef.current?.goToShape(id);
    setSelectedShapeId(id);
  };

  return (
    <>
      <div className="flex h-screen flex-col">
        <Suspense fallback={<HeaderFallback />}>
          <Header fileId={fileId} pageId={pageId} />
        </Suspense>
        <div className="flex flex-1 overflow-hidden">
          <Suspense fallback={<PagesSidebarFallback />}>
            <SidebarWrapper
              fileId={fileId}
              pageId={pageId}
              selectedShapeId={selectedShapeId}
              onShapeSelect={setSelectedShapeId}
              onGoToShape={handleGoToShape}
            />
          </Suspense>
          <main className="relative flex-1 overflow-auto">
            <Suspense fallback={<RenderFallback />}>
              <Render
                ref={renderRef}
                fileId={fileId}
                pageId={pageId}
                selectedShapeId={selectedShapeId}
                onShapeSelect={setSelectedShapeId}
              />
            </Suspense>
          </main>
          {selectedShapeId && (
            <Suspense fallback={<InspectorSidebarFallback width={inspectorWidth} />}>
              <InspectorSidebar
                key={selectedShapeId}
                fileId={fileId}
                pageId={pageId}
                selectedShapeId={selectedShapeId}
              />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
