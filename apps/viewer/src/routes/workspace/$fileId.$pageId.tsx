import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/workspace/$fileId/$pageId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/workspace/$fileId/$pageId"!</div>;
}
