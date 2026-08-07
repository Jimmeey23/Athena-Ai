import React, { useState } from 'react';
import { useBackendAuth } from '@/contexts/useBackendAuth';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading, signIn, signInWithGoogle, signUp } = useBackendAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [signUpConfirmationEmail, setSignUpConfirmationEmail] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="auth-bg flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="auth-spinner" />
          <p className="text-sm font-medium text-white/50 tracking-wide">Initialising secure workspace…</p>
        </div>
      </div>
    );
  }

  if (session) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'sign-in') {
        await signIn(email, password);
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters long.');
          return;
        }
        const result = await signUp(email, password);
        if (result.needsEmailConfirmation) {
          setSignUpConfirmationEmail(email);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Authentication failed';
      setError(
        /already registered|already been registered/i.test(message)
          ? 'An account already exists for this email. Please sign in instead.'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
      setSubmitting(false);
    }
  };

  const switchMode = (next: 'sign-in' | 'sign-up') => {
    setMode(next);
    setError(null);
    setSignUpConfirmationEmail(null);
  };

  return (
    <>
      <style>{`
        .auth-bg {
          background: radial-gradient(ellipse 120% 80% at 60% 0%, #0f172a 0%, #0a0f1e 45%, #06080f 100%);
          position: relative;
          overflow: hidden;
        }
        .auth-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 15% 20%, rgba(59,130,246,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 45% 40% at 85% 75%, rgba(139,92,246,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 35% 30% at 50% 50%, rgba(6,182,212,0.06) 0%, transparent 65%);
          pointer-events: none;
        }
        .auth-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%);
          pointer-events: none;
        }
        .auth-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          animation: auth-orb-drift 12s ease-in-out infinite alternate;
        }
        .auth-orb-1 {
          width: 520px; height: 520px;
          background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%);
          top: -180px; left: -120px;
          animation-delay: 0s;
        }
        .auth-orb-2 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%);
          bottom: -100px; right: -100px;
          animation-delay: -5s;
          animation-direction: alternate-reverse;
        }
        .auth-orb-3 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%);
          top: 40%; left: 55%;
          animation-delay: -3s;
        }
        @keyframes auth-orb-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(24px, -16px) scale(1.06); }
        }
        .auth-card {
          animation: auth-card-in 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .auth-field-label {
          transition: color 0.2s;
        }
        .auth-input {
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .auth-input:focus {
          border-color: rgba(99,102,241,0.8);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15), 0 1px 3px rgba(0,0,0,0.3);
          background: rgba(15,23,42,0.7);
        }
        .auth-btn-primary {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%);
          box-shadow: 0 8px 32px rgba(99,102,241,0.38), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12);
          transition: transform 0.18s, box-shadow 0.18s, filter 0.18s;
        }
        .auth-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(99,102,241,0.48), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12);
          filter: brightness(1.05);
        }
        .auth-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-btn-google {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(12px);
          transition: background 0.18s, border-color 0.18s, transform 0.18s;
        }
        .auth-btn-google:hover:not(:disabled) {
          background: rgba(255,255,255,0.10);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-1px);
        }
        .auth-logo-ring {
          animation: auth-logo-pulse 3s ease-in-out infinite;
        }
        @keyframes auth-logo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3), 0 0 0 0 rgba(139,92,246,0.2); }
          50%       { box-shadow: 0 0 0 8px rgba(99,102,241,0.12), 0 0 0 16px rgba(139,92,246,0.06); }
        }
        .auth-spinner {
          width: 36px; height: 36px;
          border: 2.5px solid rgba(255,255,255,0.08);
          border-top-color: rgba(99,102,241,0.8);
          border-radius: 50%;
          animation: auth-spin 0.9s linear infinite;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        .auth-divider-line {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent);
        }
        .auth-badge {
          animation: auth-badge-in 0.5s 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes auth-badge-in {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        .auth-feature-row {
          animation: auth-feature-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .auth-feature-row:nth-child(1) { animation-delay: 0.82s; }
        .auth-feature-row:nth-child(2) { animation-delay: 0.90s; }
        .auth-feature-row:nth-child(3) { animation-delay: 0.98s; }
        @keyframes auth-feature-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="auth-bg flex h-screen w-screen items-center justify-center px-4">
        <div className="auth-grid" />
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />

        <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-6">

          {/* Brand lockup */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="auth-logo-ring flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)', border: '1px solid rgba(99,102,241,0.35)' }}
            >
              <img src="/athena-ai-logo.png" alt="Athena" className="h-10 w-10 rounded-xl object-cover" />
            </div>
            <div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-[26px] font-black uppercase tracking-[0.22em] text-white">Athena</span>
                <span className="text-[11px] font-bold text-indigo-400">Ai</span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
                Physique 57 · Support OS
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {['AI-powered', 'Secure workspace', 'Physique 57'].map((label, i) => (
                <span
                  key={label}
                  className="auth-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: 'rgba(99,102,241,0.10)',
                    border: '1px solid rgba(99,102,241,0.22)',
                    color: 'rgba(165,180,252,0.85)',
                    animationDelay: `${0.6 + i * 0.08}s`,
                  }}
                >
                  <span className="h-1 w-1 rounded-full bg-indigo-400/70" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Card */}
          <div
            className="auth-card rounded-3xl p-6"
            style={{
              background: 'rgba(10,14,30,0.82)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(28px)',
              boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.08) inset, 0 1px 0 rgba(255,255,255,0.06) inset',
            }}
          >
            {/* Mode toggle */}
            <div className="mb-5 flex rounded-2xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['sign-in', 'sign-up'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="flex-1 rounded-xl py-2 text-[12px] font-semibold tracking-wide transition-all duration-200"
                  style={
                    mode === m
                      ? { background: 'linear-gradient(135deg, #4338ca, #6d28d9)', color: 'white', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                      : { color: 'rgba(255,255,255,0.35)' }
                  }
                >
                  {m === 'sign-in' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              {/* Email field */}
              <label className="block">
                <span
                  className="auth-field-label mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: focused === 'email' ? 'rgba(165,180,252,0.9)' : 'rgba(255,255,255,0.35)' }}
                >
                  Email address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  className="auth-input h-11 w-full rounded-xl border px-3.5 text-sm text-white placeholder:text-white/20 outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: focused === 'email' ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.08)' }}
                  placeholder="you@physique57.com"
                  required
                  autoComplete="email"
                />
              </label>

              {/* Password field */}
              <label className="block">
                <span
                  className="auth-field-label mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: focused === 'password' ? 'rgba(165,180,252,0.9)' : 'rgba(255,255,255,0.35)' }}
                >
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  className="auth-input h-11 w-full rounded-xl border px-3.5 text-sm text-white placeholder:text-white/20 outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: focused === 'password' ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.08)' }}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />
              </label>

              {mode === 'sign-up' && (
                <p className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Use at least 8 characters.
                </p>
              )}

              {error && (
                <div
                  className="rounded-xl px-3.5 py-2.5 text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: 'rgba(252,165,165,0.95)' }}
                >
                  {error}
                </div>
              )}

              {signUpConfirmationEmail && (
                <div
                  className="rounded-xl px-3.5 py-2.5 text-xs font-medium"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: 'rgba(110,231,183,0.95)' }}
                >
                  Check <span className="font-bold">{signUpConfirmationEmail}</span> for a confirmation link, then sign in to continue.
                </div>
              )}

              {/* Google SSO */}
              <button
                type="button"
                onClick={submitGoogle}
                disabled={submitting}
                className="auth-btn-google mt-1 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GoogleMark />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="auth-divider-line h-px flex-1" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">or with email</span>
                <div className="auth-divider-line h-px flex-1" />
              </div>

              {/* Primary action */}
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                    <span>Please wait…</span>
                  </>
                ) : (
                  mode === 'sign-in' ? 'Sign in to workspace' : 'Create your account'
                )}
              </button>
            </form>
          </div>

          {/* Features row */}
          <div className="flex flex-col gap-2 px-2">
            {[
              { icon: '🔐', text: 'Protected with Supabase · encrypted in transit' },
              { icon: '🤖', text: 'Athena AI · Claude-powered ticket intelligence' },
              { icon: '📍', text: 'Mumbai · Kemps Corner · Bengaluru · Gurgaon' },
            ].map((item) => (
              <div key={item.text} className="auth-feature-row flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span className="text-[10.5px] text-white/25 leading-snug">{item.text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
};

const GoogleMark: React.FC = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
  </svg>
);
