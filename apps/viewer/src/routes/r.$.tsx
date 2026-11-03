import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { parsePenpotLocation } from '#/lib/penpot-location';

export const Route = createFileRoute('/r/$')({ component: RedirectPage });

function RedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parsePenpotLocation(window.location);
    if (!parsed) {
      setError('Could not find file-id and page-id in the Penpot URL.');
      return;
    }
    navigate({
      to: '/workspace/$fileId/$pageId',
      params: { fileId: parsed.fileId, pageId: parsed.pageId },
      search: { teamId: parsed.teamId, shapeId: parsed.shapeId },
      replace: true,
    });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">{error ?? 'Redirecting...'}</p>
    </main>
  );
}
