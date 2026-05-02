import React, { useState, useEffect } from 'react';
import { X, Shield, UserPlus, Check, Trash2, ChevronDown, Loader, Crown, User } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  display_name: string;
}

interface Member {
  id: number;
  username: string;
  display_name: string;
  role: string;
  status: string;
  joined_at: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
}

interface Props {
  user: UserData;
  team: Team;
  onClose: () => void;
  onLeave: () => void;
}

export default function TeamManager({ user, team, onClose, onLeave }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState('member');
  const [addUsername, setAddUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`);
      const data = await res.json();
      setMembers(data.members || []);
      const me = (data.members || []).find((m: Member) => m.id === user.id);
      if (me) setMyRole(me.role);
    } catch {
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const canManage = myRole === 'owner' || myRole === 'manager';

  const handleApprove = async (memberId: number) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${memberId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: user.id }),
      });
      if (res.ok) { notify('Member approved!'); await load(); }
      else { const d = await res.json(); notify(d.error || 'Error', true); }
    } catch { notify('Server error', true); }
    finally { setActionLoading(null); }
  };

  const handleRemove = async (memberId: number, displayName: string) => {
    if (memberId === user.id) {
      if (!confirm(`Leave team "${team.name}"?`)) return;
    } else {
      if (!confirm(`Remove ${displayName} from the team?`)) return;
    }
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: user.id }),
      });
      if (res.ok) {
        if (memberId === user.id) { onLeave(); }
        else { notify('Member removed'); await load(); }
      } else {
        const d = await res.json();
        notify(d.error || 'Error', true);
      }
    } catch { notify('Server error', true); }
    finally { setActionLoading(null); }
  };

  const handleRoleChange = async (memberId: number, newRole: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: user.id, role: newRole }),
      });
      if (res.ok) { notify('Role updated'); await load(); }
      else { const d = await res.json(); notify(d.error || 'Error', true); }
    } catch { notify('Server error', true); }
    finally { setActionLoading(null); }
  };

  const handleAdd = async () => {
    if (!addUsername.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: user.id, username: addUsername.trim() }),
      });
      if (res.ok) {
        notify(`@${addUsername.trim()} added to the team!`);
        setAddUsername('');
        await load();
      } else {
        const d = await res.json();
        notify(d.error || 'Error', true);
      }
    } catch { notify('Server error', true); }
    finally { setAdding(false); }
  };

  const approved = members.filter(m => m.status === 'approved');
  const pending = members.filter(m => m.status === 'pending');

  const roleBadge = (role: string) => {
    if (role === 'owner') return (
      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
        <Crown className="w-3 h-3" /> Owner
      </span>
    );
    if (role === 'manager') return (
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
        <Shield className="w-3 h-3" /> Manager
      </span>
    );
    return (
      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
        <User className="w-3 h-3" /> Member
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{team.name}</h2>
            {team.description && <p className="text-sm text-slate-500">{team.description}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Status messages */}
          {(error || success) && (
            <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {error ? <X className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
              {error || success}
            </div>
          )}

          {/* Add member (owner/manager only) */}
          {canManage && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                <UserPlus className="w-4 h-4" /> Add Member
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !adding && handleAdd()}
                  placeholder="Enter username"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={adding || !addUsername.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1"
                >
                  {adding ? <Loader className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Add</>}
                </button>
              </div>
            </div>
          )}

          {/* Pending join requests */}
          {canManage && pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Pending Requests ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{m.display_name}</p>
                      <p className="text-xs text-slate-500">@{m.username}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(m.id)}
                        disabled={actionLoading === m.id}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        {actionLoading === m.id ? <Loader className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Approve</>}
                      </button>
                      <button
                        onClick={() => handleRemove(m.id, m.display_name)}
                        disabled={actionLoading === m.id}
                        className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members list */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Members ({approved.length})
              </h3>
              <div className="space-y-2">
                {approved.map(m => {
                  const isMe = m.id === user.id;
                  const canChangeRole = myRole === 'owner' && !isMe && m.role !== 'owner';
                  const canRemove = isMe || (canManage && m.role !== 'owner' && !(myRole === 'manager' && m.role === 'manager'));
                  return (
                    <div key={m.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${isMe ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">
                          {m.display_name} {isMe && <span className="text-xs text-indigo-500">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-400">@{m.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canChangeRole ? (
                          <select
                            value={m.role}
                            onChange={e => handleRoleChange(m.id, e.target.value)}
                            disabled={actionLoading === m.id}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-400 outline-none bg-white"
                          >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                          </select>
                        ) : (
                          roleBadge(m.role)
                        )}
                        {canRemove && (
                          <button
                            onClick={() => handleRemove(m.id, m.display_name)}
                            disabled={actionLoading === m.id}
                            className={`p-1.5 rounded-lg disabled:opacity-50 transition-colors ${isMe ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                            title={isMe ? 'Leave team' : 'Remove member'}
                          >
                            {actionLoading === m.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
