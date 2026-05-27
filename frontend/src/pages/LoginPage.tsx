import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { AlertCircle, Loader2, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { fetchGoogleClientId, googleVerify, login } from '../lib/auth-api';
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
  const [googleError, setGoogleError] = useState('');
  const from = (location.state as { from?: { pathname?: string; search?: string }; sessionExpired?: boolean } | null)?.from;
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
    },
  });

  const googleMutation = useMutation({
    mutationFn: googleVerify,
    onSuccess: (data) => {
      setGoogleError('');
      setSession(data.access_token, data.user);
      navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: string }>;
      setGoogleError(axiosError.response?.data?.detail ?? 'Google sign-in failed.');
    },
  });

  const googleMutateRef = useRef(googleMutation.mutate);
  googleMutateRef.current = googleMutation.mutate;

  useEffect(() => {
    let canceled = false;

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis="true"]');
        if (existing) {
          if (existing.dataset.loaded === 'true') {
            resolve();
            return;
          }
          const onLoad = () => {
            existing.dataset.loaded = 'true';
            resolve();
          };
          const onError = () => reject(new Error('Failed to load Google Identity Services script.'));
          existing.addEventListener('load', onLoad, { once: true });
          existing.addEventListener('error', onError, { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleGis = 'true';
        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
        document.head.appendChild(script);
      });

    const init = async () => {
      try {
        const clientId = await fetchGoogleClientId();
        await loadScript();
        if (canceled) return;

        const google = (window as any).google;
        if (!google?.accounts?.id) {
          throw new Error('Google Identity Services unavailable.');
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            const credential = response.credential;
            if (!credential) {
              setGoogleError('Google sign-in failed.');
              return;
            }
            setGoogleError('');
            googleMutateRef.current({ credential });
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const container = document.getElementById('google-signin-button');
        if (!container) return;
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 360,
        });
      } catch (err) {
        if (!canceled) {
          setGoogleError(err instanceof Error ? err.message : 'Google sign-in failed.');
        }
      }
    };

    void init();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <AuthShell
      title="Sign in"
      description="Access your inventory workspace."
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-slate-950 underline-offset-4 transition hover:underline dark:text-white" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {sessionExpired ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
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
            <Link className="text-xs font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-950 hover:underline dark:text-white/70 dark:hover:text-white" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </div>
        {mutation.isError ? (
          <p className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            Invalid email or password.
          </p>
        ) : null}
        <Button
          className="mt-2 h-10 w-full rounded-md border border-slate-950 bg-slate-950 shadow-sm shadow-slate-200 transition duration-200 hover:bg-slate-900 hover:shadow-md hover:shadow-slate-200 dark:border-white dark:bg-[#ffffff] dark:text-black dark:hover:bg-[#f2f2f2]"
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
        {googleError ? (
          <p className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            {googleError}
          </p>
        ) : null}
        <div className="mt-2 flex w-full justify-center">
          <div id="google-signin-button" />
        </div>
      </form>
    </AuthShell>
  );
}
