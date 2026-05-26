import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Mail, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../components/Button';
import { AuthField } from '../components/auth/AuthField';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordField } from '../components/auth/PasswordField';
import { forgotPassword, resetPassword, verifyResetOTP } from '../lib/auth-api';

type Step = 'email' | 'otp' | 'password' | 'success';

const RESEND_SECONDS = 60;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const forgotMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: () => {
      setStep('otp');
      setCooldown(RESEND_SECONDS);
      setFormError('');
    },
    onError: () => setFormError('Reset email could not be sent. Check SMTP configuration and try again.'),
  });

  const verifyMutation = useMutation({
    mutationFn: verifyResetOTP,
    onSuccess: (data) => {
      setResetToken(data.reset_token);
      setStep('password');
      setFormError('');
    },
    onError: () => setFormError('The code is invalid, expired, or has too many failed attempts.'),
  });

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setStep('success');
      setFormError('');
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setResetToken('');
    },
    onError: () => setFormError('Password could not be reset. Request a new code and try again.'),
  });

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmail(normalizedEmail)) {
      setFormError('Enter a valid email address.');
      return;
    }
    setEmail(normalizedEmail);
    forgotMutation.mutate({ email: normalizedEmail });
  };

  const submitOTP = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setFormError('Enter the 6-digit reset code.');
      return;
    }
    verifyMutation.mutate({ email, otp });
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setFormError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    resetMutation.mutate({ email, reset_token: resetToken, new_password: password });
  };

  const resendCode = () => {
    if (cooldown > 0 || forgotMutation.isPending) {
      return;
    }
    forgotMutation.mutate({ email });
  };

  return (
    <AuthShell
      title={step === 'success' ? 'Password updated' : 'Reset password'}
      description={
        step === 'email'
          ? 'Enter your workspace email and we will send a secure one-time reset code.'
          : step === 'otp'
            ? 'Enter the 6-digit code sent to your email. Codes expire after 10 minutes.'
            : step === 'password'
              ? 'Choose a new password for your IMS workspace.'
              : 'Your password has been reset. You can now sign in with your new password.'
      }
      footer={
        <>
          Remembered your password?{' '}
          <Link className="font-medium text-white underline-offset-4 transition hover:underline" to="/login">
            Back to login
          </Link>
        </>
      }
    >
      {formError ? (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" />
          {formError}
        </p>
      ) : null}

      {step === 'email' ? (
        <form className="space-y-4" onSubmit={submitEmail}>
          <AuthField
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button className="h-10 w-full rounded-md" disabled={forgotMutation.isPending}>
            {forgotMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending code...
              </span>
            ) : (
              'Send reset code'
            )}
          </Button>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form className="space-y-4" onSubmit={submitOTP}>
          <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70">
            Code sent to <span className="font-semibold text-white">{email}</span>
          </div>
          <AuthField
            label="Reset code"
            icon={ShieldCheck}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button className="h-10 w-full rounded-md" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify code'
            )}
          </Button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={cooldown > 0 || forgotMutation.isPending}
            onClick={resendCode}
          >
            <RotateCcw className="h-4 w-4" />
            {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      ) : null}

      {step === 'password' ? (
        <form className="space-y-4" onSubmit={submitPassword}>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            placeholder="Use at least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <Button className="h-10 w-full rounded-md" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </span>
            ) : (
              'Reset password'
            )}
          </Button>
        </form>
      ) : null}

      {step === 'success' ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-200">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Password reset successfully</p>
              <p className="mt-1 leading-6">Return to login and continue with your new password.</p>
            </div>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
