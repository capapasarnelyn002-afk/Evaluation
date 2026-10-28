import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, KeyRound, Lock } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { loginWithEmail } = useApp();
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    const success = await loginWithEmail(inputEmail.trim(), inputPassword);
    if (!success) setErrorMessage('Sign-in failed. Check your email and password, then try again.');
    setIsSubmitting(false);
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
                <p className="text-xs text-slate-500">Enter your email and password.</p>
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
              onChange={event => { setInputEmail(event.target.value); setErrorMessage(''); }}
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
              onChange={event => { setInputPassword(event.target.value); setErrorMessage(''); }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
          {errorMessage && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
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
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">Authorized users only · Your session is securely verified.</p>
      </div>
    </main>
  );
};
