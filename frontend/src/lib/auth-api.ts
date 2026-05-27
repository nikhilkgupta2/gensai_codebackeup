import { api, type ApiEnvelope } from './api';
import type { AuthUser } from './auth-store';

export type AuthResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
};

export type RegisterPendingVerificationResponse = {
  pending_verification: true;
  email: string;
};

export type RegisterResponse = AuthResponse | RegisterPendingVerificationResponse;

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  company_name: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type VerifyResetOTPPayload = {
  email: string;
  otp: string;
};

export type VerifyResetOTPResponse = {
  reset_token: string;
};

export type ResetPasswordPayload = {
  email: string;
  reset_token: string;
  new_password: string;
};

export async function register(payload: RegisterPayload) {
  const response = await api.post<ApiEnvelope<RegisterResponse>>('/auth/register', payload);
  return response.data.data;
}

export async function login(payload: LoginPayload) {
  const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', payload);
  return response.data.data;
}

export async function googleLogin(payload: { email: string }) {
  const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/google-login', payload);
  return response.data.data;
}

export async function fetchGoogleClientId() {
  const response = await api.get<ApiEnvelope<{ client_id: string }>>('/auth/google-client-id');
  return response.data.data.client_id;
}

export async function googleVerify(payload: { credential: string }) {
  const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/google-verify', payload);
  return response.data.data;
}

export async function fetchCurrentUser() {
  const response = await api.get<ApiEnvelope<AuthUser>>('/auth/me');
  return response.data.data;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const response = await api.post<ApiEnvelope<{ accepted: boolean }>>('/auth/forgot-password', payload);
  return response.data.data;
}

export async function verifyResetOTP(payload: VerifyResetOTPPayload) {
  const response = await api.post<ApiEnvelope<VerifyResetOTPResponse>>('/auth/verify-reset-otp', payload);
  if (!response.data.data?.reset_token) {
    throw new Error('OTP verification response did not include a reset token.');
  }
  return response.data.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const response = await api.post<ApiEnvelope<{ accepted: boolean }>>('/auth/reset-password', payload);
  return response.data.data;
}

export type VerifyEmailOTPPayload = {
  email: string;
  otp: string;
};

export async function verifyEmailVerificationOTP(payload: VerifyEmailOTPPayload) {
  const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/verify-email-otp', payload);
  return response.data.data;
}

export async function resendEmailVerificationOTP(payload: { email: string }) {
  const response = await api.post<ApiEnvelope<{ accepted: boolean }>>('/auth/resend-email-otp', payload);
  return response.data.data;
}
