'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, FlaskConical, AlertCircle } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SmartButton } from '@/components/ui/smart-button';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_KEY = 'qcm-remember-email';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Load saved email + focus the right field
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
      setTimeout(() => passwordRef.current?.focus(), 50);
    } else {
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, []);

  function validateEmail(val: string): boolean {
    if (!val.trim()) { setEmailError('Email is required'); return false; }
    if (!EMAIL_RE.test(val)) { setEmailError('Enter a valid email address'); return false; }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setAuthError('');
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      // Kick off background prefetches so dashboard feels instant
      queryClient.prefetchQuery({ queryKey: ['overview', undefined], queryFn: () => api.getOverview() });
      queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: api.getTeams });
      queryClient.prefetchQuery({ queryKey: ['runs', 1, 20, undefined, undefined, undefined, undefined, undefined], queryFn: () => api.getRuns({ page: 1, pageSize: 20 }) });
      router.push('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center px-4 relative overflow-hidden',
      'bg-gradient-to-br from-slate-50 via-white to-violet-50/40',
      'dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20',
    )}>
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <FlaskConical className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">QC Monitor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Quality starts here.</p>
          </div>
        </div>

        {/* Card */}
        <div className={cn(
          'bg-card border border-border rounded-2xl p-8',
          'shadow-sm shadow-black/5',
          'dark:shadow-none dark:ring-1 dark:ring-white/5',
          shake && 'animate-shake',
        )}>
          <h2 className="text-base font-semibold mb-6 text-foreground">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                  if (authError) setAuthError('');
                }}
                onBlur={e => validateEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                className={cn(
                  'w-full border rounded-lg px-3.5 py-2.5 text-sm bg-background',
                  'focus:outline-none focus:ring-2 transition-colors',
                  emailError
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-input focus:ring-ring focus:border-ring',
                )}
              />
              {emailError && (
                <p className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (authError) setAuthError(''); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border border-input rounded-lg px-3.5 py-2.5 pr-11 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Remember me
              </span>
            </label>

            {/* Auth error banner */}
            {authError && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400 leading-snug">
                  Invalid email or password. Please try again.
                </p>
              </div>
            )}

            {/* Submit */}
            <SmartButton
              type="submit"
              loading={loading}
              loadingText="Signing in..."
              disabled={loading || !email.trim() || !password}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              Sign in →
            </SmartButton>
          </form>
        </div>
      </div>
    </div>
  );
}
