import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Building2, Loader2, Mail, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { register } from '../lib/auth-api';
import { useAuthStore } from '../lib/auth-store';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  company_name: z.string().min(2, 'Company name must be at least 2 characters'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type RegisterForm = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<RegisterForm>({ resolver: zodResolver(schema) });
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
    },
  });

  return (
    <AuthShell
      title="Create workspace"
      description="Start with a retailer admin account."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-white underline-offset-4 transition hover:underline" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <AuthField
          label="Name"
          icon={UserRound}
          autoComplete="name"
          placeholder="Your name"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <AuthField
          label="Company"
          icon={Building2}
          autoComplete="organization"
          placeholder="Company name"
          error={form.formState.errors.company_name?.message}
          {...form.register('company_name')}
        />
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Use at least 8 characters"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {mutation.isError ? (
          <p className="flex items-center gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4" />
            Registration failed. Try another email.
          </p>
        ) : null}
        <Button
          className="mt-2 h-10 w-full rounded-md border border-white bg-black shadow-sm shadow-black/50 transition duration-200 hover:bg-neutral-900 hover:shadow-md hover:shadow-black/60"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </span>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
