import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { setApiKey } from '#/lib/auth';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      apiKey: '',
    },
    onSubmit: ({ value }) => {
      setApiKey(value.apiKey.trim());
      navigate({ to: '/' });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Penpot Viewer
          </h1>
          <p className="text-sm text-gray-500">
            Enter your Penpot access token to continue.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field
            name="apiKey"
            validators={{
              onSubmit: ({ value }) =>
                !value.trim() ? 'Access token is required' : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-gray-700"
                >
                  Access token
                </label>
                <input
                  id="apiKey"
                  type="password"
                  placeholder="your-access-token"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-600">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none"
          >
            Continue
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          You need a Penpot access token.{' '}
          <a
            href="https://help.penpot.app/technical-guide/integration/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 underline hover:text-gray-900"
          >
            Learn how to get one
          </a>
        </p>
      </div>
    </main>
  );
}
