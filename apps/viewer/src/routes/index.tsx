import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { isAuthenticatedFn } from '#/lib/auth';
import {
  getTeamsFn,
  getRecentFilesFn,
  getThumbnailUrl,
  type PenpotFile,
  type Team,
} from '#/lib/server/penpot-api';
import { getFileAccessesFn } from '#/lib/server/file-access';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import { useEffect, useMemo, useState } from 'react';

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    teamId: typeof search.teamId === 'string' ? search.teamId : undefined,
  }),
  beforeLoad: async () => {
    const authenticated = await isAuthenticatedFn();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: App,
});

type FileSort =
  | 'modified-desc'
  | 'modified-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name-asc'
  | 'name-desc'
  | 'last-accessed-desc';

const DEFAULT_FILE_SORT: FileSort = 'modified-desc';
const FILE_SORT_STORAGE_KEY = 'penpot-tools:file-sort';

const FILE_SORT_OPTIONS: Array<{ value: FileSort; label: string }> = [
  { value: 'modified-desc', label: 'Recently modified' },
  { value: 'modified-asc', label: 'Oldest modified' },
  { value: 'created-desc', label: 'Recently created' },
  { value: 'created-asc', label: 'Oldest created' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'last-accessed-desc', label: 'Last opened' },
];

function isFileSort(value: string): value is FileSort {
  return FILE_SORT_OPTIONS.some((option) => option.value === value);
}

function compareDateDesc(a?: string, b?: string): number {
  const aTime = a ? new Date(a).getTime() : Number.NEGATIVE_INFINITY;
  const bTime = b ? new Date(b).getTime() : Number.NEGATIVE_INFINITY;
  return bTime - aTime;
}

function sortFiles(
  files: PenpotFile[],
  sort: FileSort,
  lastAccessedAtByFileId: Record<string, string> | undefined,
): PenpotFile[] {
  return [...files].sort((a, b) => {
    switch (sort) {
      case 'modified-asc':
        return compareDateDesc(b.modifiedAt, a.modifiedAt) || a.name.localeCompare(b.name);
      case 'created-desc':
        return compareDateDesc(a.createdAt, b.createdAt) || a.name.localeCompare(b.name);
      case 'created-asc':
        return compareDateDesc(b.createdAt, a.createdAt) || a.name.localeCompare(b.name);
      case 'name-asc':
        return a.name.localeCompare(b.name) || compareDateDesc(a.modifiedAt, b.modifiedAt);
      case 'name-desc':
        return b.name.localeCompare(a.name) || compareDateDesc(a.modifiedAt, b.modifiedAt);
      case 'last-accessed-desc':
        return (
          compareDateDesc(lastAccessedAtByFileId?.[a.id], lastAccessedAtByFileId?.[b.id]) ||
          compareDateDesc(a.modifiedAt, b.modifiedAt) ||
          a.name.localeCompare(b.name)
        );
      case 'modified-desc':
      default:
        return compareDateDesc(a.modifiedAt, b.modifiedAt) || a.name.localeCompare(b.name);
    }
  });
}

function App() {
  const { teamId: selectedTeamId } = Route.useSearch();
  const navigate = useNavigate({ from: '/' });
  const [fileSort, setFileSort] = useState<FileSort>(DEFAULT_FILE_SORT);

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => getTeamsFn(),
  });

  const filesQuery = useQuery({
    queryKey: ['files', selectedTeamId],
    queryFn: () => getRecentFilesFn({ data: { teamId: selectedTeamId! } }),
    enabled: !!selectedTeamId,
  });

  const fileIds = useMemo(() => filesQuery.data?.map((file) => file.id) ?? [], [filesQuery.data]);

  const fileAccessesQuery = useQuery({
    queryKey: ['file-accesses', fileIds],
    queryFn: () => getFileAccessesFn({ data: { fileIds } }),
    enabled: fileIds.length > 0,
  });

  const sortedFiles = useMemo(
    () => sortFiles(filesQuery.data ?? [], fileSort, fileAccessesQuery.data),
    [fileAccessesQuery.data, filesQuery.data, fileSort],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(FILE_SORT_STORAGE_KEY);
    if (stored && isFileSort(stored)) {
      setFileSort(stored);
    }
  }, []);

  const handleFileSortChange = (value: FileSort | null) => {
    if (!value) return;
    if (!isFileSort(value)) return;
    setFileSort(value);
    window.localStorage.setItem(FILE_SORT_STORAGE_KEY, value);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pt-14 pb-8">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">Penpot Files</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="team-select" className="text-foreground mb-1.5 block text-sm font-medium">
            Team
          </label>
          {teamsQuery.isLoading && (
            <p className="text-muted-foreground text-sm">Loading teams...</p>
          )}
          {teamsQuery.isError && (
            <p className="text-destructive text-sm">
              Failed to load teams: {teamsQuery.error.message}
            </p>
          )}
          {teamsQuery.data && (
            <Select
              value={selectedTeamId ?? ''}
              onValueChange={(value) =>
                navigate({ search: { teamId: value || undefined }, replace: true })
              }
            >
              <SelectTrigger id="team-select" className="w-full">
                <SelectValue placeholder="Select a team">
                  {selectedTeamId
                    ? teamsQuery.data?.find((t: Team) => t.id === selectedTeamId)?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {teamsQuery.data.map((team: Team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name} {team.isDefault ? '(default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <label
            htmlFor="file-sort-select"
            className="text-foreground mb-1.5 block text-sm font-medium"
          >
            Sort by
          </label>
          <Select value={fileSort} onValueChange={handleFileSortChange}>
            <SelectTrigger id="file-sort-select" className="w-full">
              <SelectValue>
                {FILE_SORT_OPTIONS.find((option) => option.value === fileSort)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FILE_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filesQuery.isLoading && <p className="text-muted-foreground text-sm">Loading files...</p>}
      {filesQuery.isError && (
        <p className="text-destructive text-sm">Failed to load files: {filesQuery.error.message}</p>
      )}

      {filesQuery.data && filesQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No files found.</p>
      )}

      {filesQuery.data && sortedFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sortedFiles.map((file) => (
            <Link
              key={file.id}
              to="/workspace/$fileId/$pageId"
              params={{ fileId: file.id, pageId: '0000-0000-0000-0000' }}
              search={{ teamId: selectedTeamId ?? undefined }}
              className="border-border bg-card group overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
            >
              <div className="bg-muted relative aspect-4/3 overflow-hidden">
                {file.thumbnailId ? (
                  <img
                    src={getThumbnailUrl(file.thumbnailId)}
                    alt={file.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  </div>
                )}
                {file.isShared && (
                  <span className="bg-primary text-primary-foreground absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs">
                    Shared
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-foreground truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {new Date(file.modifiedAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
