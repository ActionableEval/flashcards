import React, { useState, useRef } from 'react';
import { X, Camera, Check, Loader, Pencil, Upload } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Props {
  user: UserData;
  onClose: () => void;
  onUpdate: (updated: UserData) => void;
}

// Built-in animal emoji avatars users can pick instead of uploading
const ANIMAL_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅',
  '🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌',
  '🐞','🐜','🦟','🦗','🕷','🐢','🐍','🦎','🐊','🐙',
  '🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🦈',
];

function EmojiAvatar({ emoji, size = 'md' }: { emoji: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'text-2xl w-9 h-9' : size === 'lg' ? 'text-5xl w-20 h-20' : 'text-3xl w-14 h-14';
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center border-2 border-white shadow`}>
      {emoji}
    </div>
  );
}

export function Avatar({ user, size = 'md' }: { user: Pick<UserData, 'display_name' | 'avatar_url'>; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-base';

  if (user.avatar_url) {
    // Emoji avatar stored as text
    if (!user.avatar_url.startsWith('/')) {
      return <EmojiAvatar emoji={user.avatar_url} size={size} />;
    }
    // File upload
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className={`${s} rounded-full object-cover border-2 border-white shadow`}
      />
    );
  }

  // Fallback: initial letter
  const initial = user.display_name?.[0]?.toUpperCase() || '?';
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-white shadow`}>
      {initial}
    </div>
  );
}

export default function ProfileEditor({ user, onClose, onUpdate }: Props) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'emoji' | 'upload'>('emoji');
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatar_url || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3500);
  };

  const handleSaveName = async () => {
    if (!displayName.trim()) { notify('Display name cannot be empty', true); return; }
    if (displayName.trim() === user.display_name) { notify('No changes to save', true); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        notify('Display name updated!');
      } else {
        const d = await res.json();
        notify(d.error || 'Failed to update', true);
      }
    } catch { notify('Server error', true); }
    finally { setSaving(false); }
  };

  const handleEmojiPick = async (emoji: string) => {
    setPreviewUrl(emoji);
    setUploading(true);
    try {
      // Store emoji as avatar_url directly
      const res = await fetch(`/api/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: user.display_name, avatar_url: emoji }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        notify('Avatar updated!');
      } else {
        notify('Failed to save avatar', true);
      }
    } catch { notify('Server error', true); }
    finally { setUploading(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notify('Image must be under 5 MB', true); return; }

    // Local preview
    const reader = new FileReader();
    reader.onload = ev => setPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch(`/api/users/${user.username}/avatar`, { method: 'POST', body: form });
      if (res.ok) {
        const updated = await res.json();
        setPreviewUrl(updated.avatar_url);
        onUpdate(updated);
        notify('Photo uploaded!');
      } else {
        const d = await res.json();
        notify(d.error || 'Upload failed', true);
      }
    } catch { notify('Server error', true); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Edit Profile</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Status messages */}
          {(error || success) && (
            <div className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {error ? <X className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
              {error || success}
            </div>
          )}

          {/* Current avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {previewUrl ? (
                previewUrl.startsWith('/') ? (
                  <img src={previewUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-5xl border-4 border-white shadow-lg">
                    {previewUrl}
                  </div>
                )
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-4xl text-white font-bold border-4 border-white shadow-lg">
                  {user.display_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                  <Loader className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">@{user.username}</p>
          </div>

          {/* Avatar picker tabs */}
          <div>
            <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
              <button
                onClick={() => setActiveTab('emoji')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'emoji' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🐾 Choose Animal
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="flex items-center justify-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload Photo</span>
              </button>
            </div>

            {activeTab === 'emoji' ? (
              <div className="grid grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-1">
                {ANIMAL_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiPick(emoji)}
                    disabled={uploading}
                    className={`text-2xl w-9 h-9 rounded-xl hover:bg-indigo-50 hover:scale-110 transition-all flex items-center justify-center disabled:opacity-50 ${previewUrl === emoji ? 'bg-indigo-100 ring-2 ring-indigo-400' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors hover:bg-indigo-50/30"
              >
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Click to upload a photo</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF — max 5 MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
              <Pencil className="w-3.5 h-3.5" /> Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !saving && handleSaveName()}
                maxLength={60}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800"
                placeholder="Your display name"
              />
              <button
                onClick={handleSaveName}
                disabled={saving || !displayName.trim() || displayName.trim() === user.display_name}
                className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-1 text-sm transition-all"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
