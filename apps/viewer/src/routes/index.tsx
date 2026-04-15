import { createFileRoute, redirect, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { isAuthenticatedFn } from '#/lib/auth';
import { getTeamsFn, getRecentFilesFn, getThumbnailUrl, type Team } from '#/lib/server/penpot-api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

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

function App() {
  const { teamId: selectedTeamId } = Route.useSearch();
  const navigate = useNavigate({ from: '/' });

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => getTeamsFn(),
  });

  const filesQuery = useQuery({
    queryKey: ['files', selectedTeamId],
    queryFn: () => getRecentFilesFn({ data: { teamId: selectedTeamId! } }),
    enabled: !!selectedTeamId,
  });

  function handleTeamChange(value: string) {
    navigate({
      search: { teamId: value || undefined },
      replace: true,
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pt-14 pb-8">
      <h1 className="text-foreground mb-6 text-2xl font-semibold">Penpot Files</h1>

      <div className="mb-6 w-2xs space-y-4">
        <div>
          <label className="text-foreground mb-1.5 block text-sm font-medium">Team</label>
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
              onValueChange={handleTeamChange}
            >
              <SelectTrigger className="w-full">
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
      </div>

      {filesQuery.isLoading && <p className="text-muted-foreground text-sm">Loading files...</p>}
      {filesQuery.isError && (
        <p className="text-destructive text-sm">Failed to load files: {filesQuery.error.message}</p>
      )}

      {filesQuery.data && filesQuery.data.length === 0 && (
        <p className="text-muted-foreground text-sm">No files found.</p>
      )}

      {filesQuery.data && filesQuery.data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filesQuery.data.map((file) => (
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
