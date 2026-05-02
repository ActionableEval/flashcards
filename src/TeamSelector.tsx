import React, { useState, useEffect } from 'react';
import { Users, Plus, ArrowRight, Search, Loader, Check, X, Shield, ChevronDown, ChevronUp } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  display_name: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  member_count: number;
  role?: string;
  status?: string;
}

interface Props {
  user: UserData;
  onSelect: (team: Team | null) => void;
}

export default function TeamSelector({ user, onSelect }: Props) {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [allRes, myRes] = await Promise.all([
        fetch('/api/teams'),
        fetch(`/api/users/${user.id}/teams`),
      ]);
      const [allData, myData] = await Promise.all([allRes.json(), myRes.json()]);
      setAllTeams(Array.isArray(allData) ? allData : []);
      setMyTeams(Array.isArray(myData) ? myData : []);
    } catch {
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newTeamName.trim()) { setError('Team name is required'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim(), description: newTeamDesc.trim() || null, creator_id: user.id }),
      });
      if (res.ok) {
        const team = await res.json();
        setSuccess(`Team "${team.name}" created!`);
        setShowCreate(false);
        setNewTeamName('');
        setNewTeamDesc('');
        await load();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create team');
      }
    } catch {
      setError('Server error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (teamId: number) => {
    setJoining(teamId);
    setError('');
    try {
      const res = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (res.ok) {
        setSuccess('Join request sent! An owner or manager must approve it.');
        await load();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to join');
      }
    } catch {
      setError('Server error');
    } finally {
      setJoining(null);
    }
  };

  const myTeamIds = new Set(myTeams.map(t => t.id));
  const filtered = allTeams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const approvedTeams = myTeams.filter(t => t.status === 'approved');
  const pendingTeams = myTeams.filter(t => t.status === 'pending');

  const roleBadge = (role: string) => {
    if (role === 'owner') return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Owner</span>;
    if (role === 'manager') return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Shield className="w-3 h-3" />Manager</span>;
    return <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Member</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="inline-block bg-gradient-to-r from-indigo-500 to-purple-500 p-4 rounded-3xl shadow-lg mb-3">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Teams</h1>
          <p className="text-slate-500 text-sm">Welcome, <strong>{user.display_name}</strong> (@{user.username})</p>
        </div>

        {(error || success) && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {error ? <X className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
            {error || success}
            <button className="ml-auto" onClick={() => { setError(''); setSuccess(''); }}>✕</button>
          </div>
        )}

        {/* My Teams */}
        {approvedTeams.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-3">My Teams</h2>
            <div className="space-y-2">
              {approvedTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all text-left"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{t.name}</p>
                    {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.role && roleBadge(t.role)}
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending requests */}
        {pendingTeams.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <h2 className="text-sm font-semibold text-amber-700 mb-2">Pending Requests</h2>
            {pendingTeams.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1">
                <p className="text-slate-700 text-sm font-medium">{t.name}</p>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Awaiting approval</span>
              </div>
            ))}
          </div>
        )}

        {/* Browse & Join Teams */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-600">Browse Teams</h2>
            <button
              onClick={() => setShowAll(s => !s)}
              className="text-xs text-indigo-600 flex items-center gap-1"
            >
              {showAll ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Show all</>}
            </button>
          </div>

          {showAll && (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search teams…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-4"><Loader className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-3">No teams found</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {filtered.map(t => {
                    const membership = myTeams.find(m => m.id === t.id);
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{t.name}</p>
                          {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                          <p className="text-xs text-slate-400">{t.member_count} member{t.member_count !== 1 ? 's' : ''}</p>
                        </div>
                        {membership ? (
                          membership.status === 'approved'
                            ? <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Joined</span>
                            : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
                        ) : (
                          <button
                            onClick={() => handleJoin(t.id)}
                            disabled={joining === t.id}
                            className="text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                          >
                            {joining === t.id ? <Loader className="w-3 h-3 animate-spin" /> : 'Request'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Team */}
        {showCreate ? (
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Create a New Team</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newTeamName}
                onChange={e => { setNewTeamName(e.target.value); setError(''); }}
                placeholder="Team name"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                autoFocus
              />
              <input
                type="text"
                value={newTeamDesc}
                onChange={e => setNewTeamDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setError(''); }} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTeamName.trim()}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1"
                >
                  {creating ? <Loader className="w-3 h-3 animate-spin" /> : 'Create'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-white hover:bg-slate-50 border-2 border-dashed border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all mb-4"
          >
            <Plus className="w-4 h-4" /> Create a new team
          </button>
        )}

        {/* Skip / Study alone */}
        <button
          onClick={() => onSelect(null)}
          className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors"
        >
          Skip — study without a team →
        </button>
      </div>
    </div>
  );
}
