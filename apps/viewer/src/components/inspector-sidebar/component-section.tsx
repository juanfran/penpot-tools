import { getLibraryComponentsFn } from '#/lib/server/penpot-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { Component, ExternalLink } from 'lucide-react';

const libraryComponentsOptions = (fileId: string) =>
  queryOptions({
    queryKey: ['library-components', fileId],
    queryFn: () => getLibraryComponentsFn({ data: { fileId } }),
    staleTime: Infinity,
    gcTime: Infinity,
  });

export interface ComponentRef {
  componentId: string;
  componentFile: string;
  fallbackName: string;
  isExternal: boolean;
  isNested: boolean;
  nestedShapeName?: string;
}

export function ComponentSection({ info }: { info: ComponentRef }) {
  const { data, isLoading, isError } = useQuery(libraryComponentsOptions(info.componentFile));

  const comp = data?.components[info.componentId];
  const name = comp?.name ?? info.fallbackName;
  const path = comp?.path ?? '';
  const variants = comp?.variantProperties ?? [];

  return (
    <div className="border-t border-gray-100 px-4 pt-3 pb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Component size={12} className="text-violet-500" />
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Component
        </span>
        {info.isExternal && (
          <span className="ml-auto flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
            <ExternalLink size={9} />
            Library
          </span>
        )}
      </div>

      <div className="rounded-md bg-violet-50/40 px-3 py-2">
        {path && (
          <p
            className="truncate text-[10px] tracking-wide text-violet-400/90 uppercase"
            title={path}
          >
            {path}
          </p>
        )}
        <p className="truncate text-sm font-semibold text-gray-900" title={name}>
          {name}
        </p>

        {info.isNested && info.nestedShapeName && (
          <p className="mt-0.5 truncate text-[11px] text-gray-500" title={info.nestedShapeName}>
            Child: <span className="font-medium text-gray-700">{info.nestedShapeName}</span>
          </p>
        )}

        {isLoading && (
          <p className="mt-1 text-[11px] text-gray-400">Loading variant data…</p>
        )}

        {isError && (
          <p className="mt-1 text-[11px] text-amber-600">
            Could not load component library.
          </p>
        )}

        {!isLoading && !isError && variants.length === 0 && (
          <p className="mt-1 text-[11px] text-gray-400">No variants</p>
        )}

        {variants.length > 0 && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            {variants.map((v) => (
              <div key={v.name} className="contents">
                <dt className="text-gray-500">{v.name}</dt>
                <dd className="truncate font-medium text-gray-900" title={v.value}>
                  {v.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
