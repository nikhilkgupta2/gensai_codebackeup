import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { resendEmailVerificationOTP, verifyEmailVerificationOTP } from '../lib/auth-api';
import { useAuthStore } from '../lib/auth-store';

const RESEND_SECONDS = 60;

type LocationState = {
  email?: string;
  from?: { pathname?: string; search?: string };
};

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const state = (location.state as LocationState | null) ?? null;
  const from = state?.from;
  const email = useMemo(() => {
    const fromState = state?.email?.trim().toLowerCase();
    if (fromState) {
      return fromState;
    }
    const fromQuery = searchParams.get('email')?.trim().toLowerCase();
    return fromQuery ?? '';
  }, [searchParams, state?.email]);

  const [otp, setOtp] = useState('');
  const [formError, setFormError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: verifyEmailVerificationOTP,
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      navigate(`${from?.pathname ?? '/app'}${from?.search ?? ''}`, { replace: true });
    },
    onError: () => setFormError('The code is invalid, expired, or has too many failed attempts.'),
  });

  const resendMutation = useMutation({
    mutationFn: resendEmailVerificationOTP,
    onSuccess: () => {
      setCooldown(RESEND_SECONDS);
      setFormError('');
    },
    onError: () => setFormError('Verification email could not be sent. Check SMTP configuration and try again.'),
  });

  const submitOTP = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setFormError('Return to registration and try again.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setFormError('Enter the 6-digit verification code.');
      return;
    }
    verifyMutation.mutate({ email, otp });
  };

  const resendCode = () => {
    if (!email || cooldown > 0 || resendMutation.isPending) {
      return;
    }
    resendMutation.mutate({ email });
  };

  useEffect(() => {
    if (!email) {
      return;
    }
    setCooldown(RESEND_SECONDS);
  }, [email]);

  return (
    <AuthShell
      title="Verify your email"
      description="Enter the 6-digit code sent to your email. Codes expire after 10 minutes."
      footer={
        <>
          Need to change your details?{' '}
          <Link className="font-medium text-slate-950 underline-offset-4 transition hover:underline dark:text-white" to="/register">
            Back to sign up
          </Link>
        </>
      }
    >
      {formError ? (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          {formError}
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={submitOTP}>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-white/70">
          Code sent to <span className="font-semibold text-slate-900 dark:text-white">{email || 'your email'}</span>
        </div>
        <AuthField
          label="Verification code"
          icon={ShieldCheck}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <Button
          className="h-10 w-full rounded-md dark:border dark:border-white dark:bg-[#ffffff] dark:text-black dark:hover:bg-[#f2f2f2]"
          disabled={verifyMutation.isPending || !email}
        >
          {verifyMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            'Verify & continue'
          )}
        </Button>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
          disabled={!email || cooldown > 0 || resendMutation.isPending}
          onClick={resendCode}
        >
          <RotateCcw className="h-4 w-4" />
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend code'}
        </button>
      </form>
    </AuthShell>
  );
}
