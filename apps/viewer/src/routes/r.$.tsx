import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/r/$')({ component: RedirectPage });

function parsePenpotHash(hash: string) {
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  const fileId = params.get('file-id');
  const pageId = params.get('page-id');
  if (!fileId || !pageId) return null;
  return {
    fileId,
    pageId,
    teamId: params.get('team-id') ?? undefined,
  };
}

function RedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parsePenpotHash(window.location.hash);
    if (!parsed) {
      setError('Could not find file-id and page-id in the Penpot URL.');
      return;
    }
    navigate({
      to: '/workspace/$fileId/$pageId',
      params: { fileId: parsed.fileId, pageId: parsed.pageId },
      search: { teamId: parsed.teamId },
      replace: true,
    });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">
        {error ?? 'Redirecting...'}
      </p>
    </main>
  );
}
