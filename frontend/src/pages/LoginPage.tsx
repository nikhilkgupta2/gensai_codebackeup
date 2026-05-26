import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { login } from '../lib/auth-api';
import { useAuthStore } from '../lib/auth-store';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<LoginForm>({ resolver: zodResolver(schema) });
  const from = (location.state as { from?: { pathname?: string; search?: string }; sessionExpired?: boolean } | null)?.from;
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
    },
  });

  return (
    <AuthShell
      title="Sign in"
      description="Access your inventory workspace."
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-white underline-offset-4 transition hover:underline" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {sessionExpired ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            <AlertCircle className="h-4 w-4" />
            Your session expired. Sign in again to continue.
          </p>
        ) : null}
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <div className="space-y-2">
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <div className="flex justify-end">
            <Link className="text-xs font-semibold text-white/70 underline-offset-4 transition hover:text-white hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </div>
        {mutation.isError ? (
          <p className="flex items-center gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4" />
            Invalid email or password.
          </p>
        ) : null}
        <Button
          className="mt-2 h-10 w-full rounded-md border border-white bg-black shadow-sm shadow-black/50 transition duration-200 hover:bg-neutral-900 hover:shadow-md hover:shadow-black/60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
