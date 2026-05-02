import React, { useState } from 'react';
import { User, ArrowRight, Loader } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  display_name: string;
}

interface Props {
  onLogin: (user: UserData) => void;
}

export default function UserLogin({ onLogin }: Props) {
  const [step, setStep] = useState<'username' | 'create'>('username');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUsernameSubmit = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setError('Please enter a username'); return; }
    if (!/^[a-z0-9_]{2,30}$/.test(trimmed)) {
      setError('Username must be 2–30 characters: letters, numbers, underscores only');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${trimmed}`);
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
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

  const handleCreate = async () => {
    if (!displayName.trim()) { setError('Please enter a display name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), display_name: displayName.trim() }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else if (res.status === 409) {
        setError('Username already taken. Go back and try another.');
      } else {
        setError('Failed to create account. Try again.');
      }
    } catch {
      setError('Cannot reach server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 p-4 rounded-3xl shadow-lg mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Welcome</h1>
          <p className="text-slate-500 text-sm">
            {step === 'username' ? 'Enter your username to continue' : 'Create your account'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {step === 'username' ? (
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
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <p className="text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded-lg text-sm">{username.trim().toLowerCase()}</p>
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
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={loading || !displayName.trim()}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Create Account</>}
              </button>
              <button
                onClick={() => { setStep('username'); setError(''); }}
                className="w-full text-slate-500 hover:text-slate-700 text-sm py-2"
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
