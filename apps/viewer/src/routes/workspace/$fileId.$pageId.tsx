import { getPageShapesOptions, Render, type RenderHandle } from '#/components/render';
import { PagesSidebar } from '#/components/pages-sidebar';
import { InspectorSidebar } from '#/components/inspector-sidebar';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';
import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Suspense, useRef, useState } from 'react';
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
  loader: async ({ params, context }) => {
    context.queryClient.prefetchQuery(getPageShapesOptions(params.fileId, params.pageId));

    return await context.queryClient.ensureQueryData(getFileSummaryQueryOptions(params.fileId));
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
        <Suspense fallback={<header className="h-12 border-b border-gray-200" />}>
          <Header fileId={fileId} pageId={pageId} />
        </Suspense>
        <div className="flex flex-1 overflow-hidden">
          <Suspense fallback={<aside className="w-84 border-r border-gray-200" />}>
            <SidebarWrapper
              fileId={fileId}
              pageId={pageId}
              selectedShapeId={selectedShapeId}
              onShapeSelect={setSelectedShapeId}
              onGoToShape={handleGoToShape}
            />
          </Suspense>
          <main className="relative flex-1 overflow-auto">
            <Suspense fallback={<div>Loading...</div>}>
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
            <Suspense
              fallback={
                <aside
                  style={{ width: `${inspectorWidth}px` }}
                  className="shrink-0 border-l border-gray-200"
                />
              }
            >
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
