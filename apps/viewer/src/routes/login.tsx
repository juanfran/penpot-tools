import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { getPenpotBaseUrlFn, saveApiKeyFn } from '#/lib/auth';
import { normalizePenpotUrl } from '#/lib/penpot-instance';
import { Input } from '#/components/ui/input';
import { Button } from '#/components/ui/button';

const loginSchema = z.object({
  apiKey: z.string().min(1, 'Access token is required'),
});

export const Route = createFileRoute('/login')({
  loader: () => getPenpotBaseUrlFn(),
  component: LoginPage,
});

function validatePenpotUrl(value: string): string | undefined {
  try {
    normalizePenpotUrl(value);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid URL';
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentBaseUrl = Route.useLoaderData();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      baseUrl: currentBaseUrl,
      apiKey: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await saveApiKeyFn({ data: { token: value.apiKey.trim(), baseUrl: value.baseUrl } });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Login failed');
        return;
      }
      // Cached teams/files belong to the previous instance.
      queryClient.clear();
      await navigate({ to: '/', search: { teamId: undefined } });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Penpot Viewer</h1>
          <p className="text-sm text-gray-500">
            Connect to your Penpot instance with an access token.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field
            name="baseUrl"
            validators={{ onSubmit: ({ value }) => validatePenpotUrl(value) }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700">
                  Penpot URL
                </label>
                <Input
                  id="baseUrl"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://design.penpot.app"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                />
                {field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-red-600">{field.state.meta.errors[0]}</p>
                ) : (
                  <p className="text-xs text-gray-400">Change it to use a self-hosted Penpot.</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="apiKey"
            validators={{
              onSubmit: ({ value }) => {
                const result = loginSchema.shape.apiKey.safeParse(value.trim());
                return result.success ? undefined : result.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                  Access token
                </label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="your-access-token"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-600">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Connecting…' : 'Continue'}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <p className="text-center text-xs text-gray-400">
          Create the token in Penpot under Your account → Access tokens, on the same instance as the
          URL above.{' '}
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
