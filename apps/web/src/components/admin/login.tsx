'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/admin/api';
import { Feedback } from './ui';

export function Login({ expired }: { expired: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="admin-app a-login">
      <div className="a-login-story">
        <span className="a-login-symbol">✧</span>
        <p className="a-eyebrow">SHREE RAM JEWELLERS</p>
        <h1>
          Your showroom.
          <br />
          Beautifully managed.
        </h1>
        <p>
          A considered space for your collections,
          <br />
          customers and everyday details.
        </p>
        <a href="/">← Return to the website</a>
      </div>
      <div className="a-login-form">
        <p className="a-eyebrow">OWNER ACCESS</p>
        <h2>Welcome back.</h2>
        <p>Sign in to manage your showroom.</p>
        {expired && (
          <div className="a-notice" role="status">
            Your session has expired. Please sign in again.
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            const form = new FormData(e.currentTarget);
            try {
              await adminApi('auth/login', 'POST', {
                email: String(form.get('email')).trim(),
                password: String(form.get('password')),
              });
              window.location.replace('/admin');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to sign in.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="a-field">
            <span>Email address</span>
            <input name="email" type="email" maxLength={254} autoComplete="username" required />
          </label>
          <label className="a-field">
            <span>Password</span>
            <div className="a-password-wrapper">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                maxLength={72}
                autoComplete="current-password"
                required
                className="a-password-input"
              />
              <button
                type="button"
                className="a-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </label>
          <Feedback error={error} />
          <button className="a-btn a-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>
        <p className="a-muted">Owner access only. Account recovery is pending Milestone 6.</p>
      </div>
    </div>
  );
}
