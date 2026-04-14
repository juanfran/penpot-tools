import { createFileRoute, redirect } from '@tanstack/react-router';
import { getApiKey } from '#/lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!getApiKey()) {
      throw redirect({ to: '/login' });
    }
  },
  component: App,
});

function App() {
  return <main className="px-4 pt-14 pb-8">Init</main>;
}
