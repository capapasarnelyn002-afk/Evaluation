import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, KeyRound, Lock } from 'lucide-react';
import { DatabaseStatusIndicator } from './DatabaseStatusIndicator';

export const LoginModal: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, loginError, clearLoginError } = useApp();
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    clearLoginError();
    setIsSubmitting(true);
    const success = await loginWithEmail(inputEmail.trim(), inputPassword);
    if (!success) setErrorMessage('Sign-in failed. Check your email and password, then try again.');
    setIsSubmitting(false);
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setIsGoogleSubmitting(true);
    const error = await loginWithGoogle();
    if (error) {
      setErrorMessage(error);
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-amber-400 shadow-lg">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Southern Leyte State University</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Extension Evaluation System</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in with your registered account to continue.</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Welcome back</h2>
                <p className="text-xs text-slate-500">Use your email and password, or continue with Google.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 p-6">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              value={inputEmail}
              onChange={event => { setInputEmail(event.target.value); setErrorMessage(''); clearLoginError(); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={inputPassword}
              onChange={event => { setInputPassword(event.target.value); setErrorMessage(''); clearLoginError(); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
          {(errorMessage || loginError) && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {loginError || errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="w-4 h-4" />
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          </form>
          <div className="flex items-center gap-3 px-6 pb-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={isSubmitting || isGoogleSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleMark />
              {isGoogleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}
            </button>
          </div>
        </section>
        <div className="mt-4 flex justify-center">
          <DatabaseStatusIndicator showHint />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Authorized users only · Your session is securely verified.</p>
      </div>
    </main>
  );
};

const GoogleMark: React.FC = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.05 46.98 31.9 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" transform="translate(1 0)" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>
);
