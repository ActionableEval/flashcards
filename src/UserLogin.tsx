import React, { useState } from 'react';
import { User, ArrowRight, Loader, Mail } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Props {
  onLogin: (user: UserData) => void;
}

type Step = 'username' | 'verify-email' | 'add-email' | 'create';

export default function UserLogin({ onLogin }: Props) {
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmedUsername = username.trim().toLowerCase();

  const handleUsernameSubmit = async () => {
    if (!trimmedUsername) { setError('Please enter a username'); return; }
    if (!/^[a-z0-9_]{2,30}$/.test(trimmedUsername)) {
      setError('Username must be 2–30 characters: letters, numbers, underscores only');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${trimmedUsername}`);
      if (res.ok) {
        const user = await res.json();
        // Existing account — go to email verification or first-time email association
        setStep(user.has_email ? 'verify-email' : 'add-email');
      } else if (res.status === 404) {
        setStep('create');
      } else {
        setError('Something went wrong. Try again.');
      }
    } catch {
      setError('Cannot reach server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Used for both 'verify-email' and 'add-email'
  const handleEmailVerify = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, email: trimmedEmail }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else if (res.status === 401) {
        setError('That email doesn\'t match this account. Try again.');
      } else if (res.status === 409) {
        setError('That email is already linked to another account.');
      } else {
        setError('Something went wrong. Try again.');
      }
    } catch {
      setError('Cannot reach server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!displayName.trim()) { setError('Please enter a display name'); return; }
    if (!trimmedEmail) { setError('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, display_name: displayName.trim(), email: trimmedEmail }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else if (res.status === 409) {
        const data = await res.json();
        setError(data.error === 'Email already in use'
          ? 'That email is already linked to another account.'
          : 'Username already taken. Go back and try another.');
      } else {
        setError('Failed to create account. Try again.');
      }
    } catch {
      setError('Cannot reach server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('username');
    setEmail('');
    setDisplayName('');
    setError('');
  };

  const stepSubtitle: Record<Step, string> = {
    'username': 'Enter your username to continue',
    'verify-email': 'Enter your email to verify it\'s you',
    'add-email': 'Add your email to secure this account',
    'create': 'Create your account',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 p-4 rounded-3xl shadow-lg mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Welcome</h1>
          <p className="text-slate-500 text-sm">{stepSubtitle[step]}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {/* Step 1: Username */}
          {step === 'username' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleUsernameSubmit()}
                  placeholder="e.g. sophie123"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">Letters, numbers, underscores (2–30 chars)</p>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleUsernameSubmit}
                disabled={loading || !username.trim()}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Continue</>}
              </button>
            </>
          )}

          {/* Step 2a: Verify email for existing account */}
          {step === 'verify-email' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <p className="text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded-lg text-sm">{trimmedUsername}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && !loading && handleEmailVerify()}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleEmailVerify}
                disabled={loading || !email.trim()}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Sign In</>}
              </button>
              <button onClick={goBack} className="w-full text-slate-500 hover:text-slate-700 text-sm py-2">← Back</button>
            </>
          )}

          {/* Step 2b: Add email to existing account (first time) */}
          {step === 'add-email' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <p className="text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded-lg text-sm">{trimmedUsername}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                This account doesn't have an email yet. Add one to secure it — only you will be able to sign in.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Your Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && !loading && handleEmailVerify()}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleEmailVerify}
                disabled={loading || !email.trim()}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Save & Sign In</>}
              </button>
              <button onClick={goBack} className="w-full text-slate-500 hover:text-slate-700 text-sm py-2">← Back</button>
            </>
          )}

          {/* Step 3: Create new account */}
          {step === 'create' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <p className="text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded-lg text-sm">{trimmedUsername}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleCreate()}
                  placeholder="Your name (e.g. 小潔)"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">This is what others will see</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && !loading && handleCreate()}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Secures your username — only you can sign in</p>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={loading || !displayName.trim() || !email.trim()}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Create Account</>}
              </button>
              <button onClick={goBack} className="w-full text-slate-500 hover:text-slate-700 text-sm py-2">← Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
