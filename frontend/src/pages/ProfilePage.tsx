import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { updateCurrentUser } from '../lib/auth-api';
import { useAuthStore } from '../lib/auth-store';

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) {
      return detail;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
    company_name: z
      .union([z.literal(''), z.string().trim().min(2, 'Company must be at least 2 characters.')])
      .optional(),
  });

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canEditCompany = Boolean(user?.tenant_id);

  const defaults = useMemo<ProfileFormData>(() => {
    return {
      name: user?.name ?? '',
      company_name: user?.company_name ?? '',
    };
  }, [user?.company_name, user?.name]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    values: defaults,
    mode: 'onChange',
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormData) => {
      const payload: { name?: string; company_name?: string } = {
        name: values.name.trim(),
      };
      const company = values.company_name?.trim() ?? '';
      if (canEditCompany && company) {
        payload.company_name = company;
      }
      return updateCurrentUser(payload);
    },
    onSuccess: (nextUser) => {
      setUser(nextUser);
      form.reset({ name: nextUser.name, company_name: nextUser.company_name ?? '' });
      setSuccessMessage('Profile updated.');
    },
  });

  const isSubmitDisabled =
    mutation.isPending ||
    !form.formState.isDirty ||
    !form.formState.isValid ||
    !form.getValues('name')?.trim() ||
    (canEditCompany && !(form.getValues('company_name') ?? '').trim());

  if (!user) {
    return (
      <Page>
        <PageHeader title="Profile" description="Sign in to manage your profile." />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Profile" description="Update your account details. Email cannot be changed." />

      <SectionCard>
        <SectionHeader title="Account" description="Keep your profile information up to date." />
        <form
          className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-5 sm:px-5"
          onSubmit={form.handleSubmit((values) => {
            setSuccessMessage(null);
            mutation.mutate(values);
          })}
        >
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-800">Name</span>
            <Input className="h-11" {...form.register('name')} placeholder="Your name" />
            {form.formState.errors.name ? (
              <span className="text-xs font-medium text-rose-600">{form.formState.errors.name.message}</span>
            ) : (
              <span className="text-xs text-slate-500">This will be shown on your account.</span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-800">Email</span>
            <Input value={user.email} disabled className="h-11 bg-slate-50 text-slate-500" />
            <span className="text-xs text-slate-500">Email can’t be changed.</span>
          </label>

          {canEditCompany ? (
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-slate-800">Company</span>
              <Input className="h-11" {...form.register('company_name')} placeholder="e.g. Acme Retail" />
              <span className="text-xs text-slate-500">This updates your workspace company name.</span>
              {form.formState.errors.company_name ? (
                <span className="text-xs font-medium text-rose-600">{form.formState.errors.company_name.message}</span>
              ) : null}
            </label>
          ) : null}

          <div className="sm:col-span-2">
            {mutation.isError ? (
              <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {getErrorMessage(mutation.error)}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {successMessage}
              </div>
            ) : null}
            <div className="flex justify-center">
              <Button
                type="submit"
                className={`w-[260px] dark:border dark:border-white ${
                  isSubmitDisabled
                    ? 'dark:bg-slate-200 dark:text-slate-600'
                    : 'dark:bg-[#ffffff] dark:text-black dark:hover:bg-[#f2f2f2]'
                }`}
                disabled={isSubmitDisabled}
              >
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>

            <div className="mx-auto mt-8 max-w-[520px] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
              <p className="font-semibold text-slate-900 dark:text-white">Want to change your password?</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">Sign out → Forgot password → Reset password.</p>
            </div>
          </div>
        </form>
      </SectionCard>
    </Page>
  );
}
