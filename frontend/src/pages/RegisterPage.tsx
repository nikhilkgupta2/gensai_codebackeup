import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { AlertCircle, Building2, Check, Loader2, Mail, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { register } from '../lib/auth-api';
import { useAuthStore } from '../lib/auth-store';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    company_name: z.string().min(2, 'Company name must be at least 2 characters'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(20, 'Use at most 20 characters')
      .regex(/[A-Z]/, 'Add at least one capital letter')
      .regex(/\d/, 'Add at least one number')
      .regex(/[^A-Za-z0-9]/, 'Add at least one special character')
      .regex(/^\S+$/, 'No spaces allowed'),
    confirm_password: z.string().min(1, 'Confirm your password'),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type RegisterForm = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<RegisterForm>({ resolver: zodResolver(schema) });
  const [formError, setFormError] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      setFormError('');
      if ('access_token' in data) {
        setSession(data.access_token, data.user);
        navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
        return;
      }

      navigate('/verify-email', { replace: true, state: { email: data.email, from } });
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;

      if (status === 409) {
        setFormError('Email already exists Try Another.');
        return;
      }

      if (detail) {
        setFormError(detail);
        return;
      }

      setFormError('Registration failed. Try another email.');
    },
  });

  const passwordRegister = form.register('password');
  const passwordValue = form.watch('password') ?? '';
  const passwordChecks = {
    length: passwordValue.length >= 8 && passwordValue.length <= 20,
    capital: /[A-Z]/.test(passwordValue),
    number: /\d/.test(passwordValue),
    special: /[^A-Za-z0-9]/.test(passwordValue),
    noSpaces: /^\S*$/.test(passwordValue),
  };
  const showPasswordHint = passwordFocused;

  return (
    <AuthShell
      title="Create workspace"
      description="Start with a retailer admin account."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-slate-950 underline-offset-4 transition hover:underline dark:text-white" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setFormError('');
          const { confirm_password, ...payload } = values;
          mutation.mutate(payload);
        })}
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
          {...passwordRegister}
          onFocus={() => setPasswordFocused(true)}
          onBlur={(event) => {
            setPasswordFocused(false);
            passwordRegister.onBlur(event);
          }}
          sideHint={
            showPasswordHint ? (
              <div className="absolute left-full top-0 z-20 ml-3 hidden w-60 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg shadow-slate-200/60 dark:border-white/15 dark:bg-[#0f0f0f] dark:text-white/80 dark:shadow-none md:block">
                <p className="mb-2 font-semibold text-slate-700 dark:text-white">Password must include:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    {passwordChecks.length ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>8–20 characters</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {passwordChecks.capital ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>At least one capital letter</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {passwordChecks.number ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>At least one number</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {passwordChecks.special ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>At least one special character</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {passwordChecks.noSpaces ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span>No spaces</span>
                  </li>
                </ul>
              </div>
            ) : null
          }
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          error={form.formState.errors.confirm_password?.message}
          {...form.register('confirm_password')}
        />
        {formError ? (
          <p className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            {formError}
          </p>
        ) : null}
        <Button
          className="mt-2 h-10 w-full rounded-md border border-slate-950 bg-slate-950 shadow-sm shadow-slate-200 transition duration-200 hover:bg-slate-900 hover:shadow-md hover:shadow-slate-200 dark:border-white dark:bg-[#ffffff] dark:text-black dark:hover:bg-[#f2f2f2]"
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
