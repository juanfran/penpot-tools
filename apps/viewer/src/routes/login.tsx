import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { saveApiKeyFn } from '#/lib/auth';
import { Input } from '#/components/ui/input';
import { Button } from '#/components/ui/button';

const loginSchema = z.object({
  apiKey: z.string().min(1, 'Access token is required'),
});

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      apiKey: '',
    },
    onSubmit: async ({ value }) => {
      await saveApiKeyFn({ data: { token: value.apiKey.trim() } });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Penpot Viewer</h1>
          <p className="text-sm text-gray-500">Enter your Penpot access token to continue.</p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await form.handleSubmit();
            if (form.state.isSubmitSuccessful) {
              navigate({ to: '/', search: { teamId: undefined } });
            }
          }}
          className="space-y-4"
        >
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

          <Button type="submit" className="w-full">
            Continue
          </Button>
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
