import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Trophy, BookOpen, Check, ChevronRight,
  Users, LogOut, Coffee, X, Play, Layers, CheckCircle2,
  Circle, BarChart2,
} from 'lucide-react';
import { Avatar } from './ProfileEditor';

interface UserData {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  role?: string;
}

interface Card {
  simplified: string;
  traditional: string;
  pinyin: string;
  english: string;
  unitNumber: string;
  unitName: string;
}

interface CompletedLesson {
  unit_number: string;
  unit_name: string;
  time_ms?: number | null;
}

interface MasteredCard {
  simplified: string;
  unit_number: string;
}

interface TeamRecord {
  unit_number: string;
  unit_name: string;
  time_ms: number;
  display_name: string;
  avatar_url: string | null;
  username: string;
  rn: number;
}

interface LessonStats {
  unit_number: string;
  unit_name: string;
  total: number;
  mastered: number;
  learning: number;
  completed: boolean;
  personal_best: number | null;
}

interface Props {
  user: UserData;
  team: Team | null;
  allCards: Card[];
  onStartLesson: (units: string[], label: string) => void;
  onEditProfile: () => void;
  onSwitchTeam: () => void;
  onManageTeam: () => void;
  onLogout: () => void;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const tenth = Math.floor((ms % 1000) / 100);
  return m > 0 ? `${m}:${(s % 60).toString().padStart(2, '0')}.${tenth}` : `${s}.${tenth}s`;
}

export default function Dashboard({
  user, team, allCards,
  onStartLesson, onEditProfile, onSwitchTeam, onManageTeam, onLogout,
}: Props) {
  const [search, setSearch] = useState('');
  const [masteredCards, setMasteredCards] = useState<MasteredCard[]>([]);
  const [completedLessons, setCompletedLessons] = useState<CompletedLesson[]>([]);
  const [teamRecords, setTeamRecords] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [termsLesson, setTermsLesson] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [progressRes, teamRes] = await Promise.all([
          fetch(`/api/progress/${user.username}`),
          team ? fetch(`/api/teams/${team.id}/lesson-records`) : Promise.resolve(null),
        ]);
        if (progressRes.ok && !cancelled) {
          const data = await progressRes.json();
          setMasteredCards(data.masteredCards);
          setCompletedLessons(data.completedLessons);
        }
        if (teamRes && teamRes.ok && !cancelled) {
          setTeamRecords(await teamRes.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.username, team?.id]);

  const units = useMemo(() => {
    const seen = new Map<string, string>();
    allCards.forEach(c => { if (c.unitNumber && !seen.has(c.unitNumber)) seen.set(c.unitNumber, c.unitName); });
    return [...seen.entries()]
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([unit_number, unit_name]) => ({ unit_number, unit_name }));
  }, [allCards]);

  const lessonStats = useMemo((): LessonStats[] => {
    return units.map(({ unit_number, unit_name }) => {
      const unitCards = allCards.filter(c => String(c.unitNumber) === unit_number);
      const mastered = unitCards.filter(c => masteredCards.some(m => m.simplified === c.simplified)).length;
      const completedInfo = completedLessons.find(l => String(l.unit_number) === unit_number);
      return {
        unit_number, unit_name,
        total: unitCards.length,
        mastered,
        learning: unitCards.length - mastered,
        completed: !!completedInfo,
        personal_best: completedInfo?.time_ms ?? null,
      };
    });
  }, [units, allCards, masteredCards, completedLessons]);

  const teamRecordsByUnit = useMemo(() => {
    const map = new Map<string, TeamRecord[]>();
    teamRecords.forEach(r => {
      const list = map.get(r.unit_number) || [];
      list.push(r);
      map.set(r.unit_number, list);
    });
    return map;
  }, [teamRecords]);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    return allCards.filter(c =>
      c.simplified.includes(q) ||
      c.traditional.includes(q) ||
      c.pinyin.toLowerCase().includes(ql) ||
      c.english.toLowerCase().includes(ql)
    ).slice(0, 40);
  }, [search, allCards]);

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit); else next.add(unit);
      return next;
    });
  };

  const termsModalCards = useMemo(() =>
    termsLesson ? allCards.filter(c => String(c.unitNumber) === termsLesson) : [],
    [termsLesson, allCards]);
  const termsLessonName = termsLesson
    ? (units.find(u => u.unit_number === termsLesson)?.unit_name || `Unit ${termsLesson}`)
    : '';

  const unitsWithTeamRecords = units.filter(u => teamRecordsByUnit.has(u.unit_number));

  const totalMastered = masteredCards.length;
  const totalCards = allCards.length;
  const totalCompleted = completedLessons.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50">
      {/* Sticky header */}
      <div className="bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-xl shadow">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight text-sm sm:text-base">中文 Flashcards</h1>
              {team && <p className="text-xs text-indigo-500 font-medium">{team.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEditProfile}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Avatar user={user} size="sm" />
              <span className="hidden sm:inline text-sm font-medium text-slate-700">{user.display_name}</span>
            </button>
            {team && (
              <button onClick={onManageTeam} title="Manage team" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl">
                <Users className="w-4 h-4" />
              </button>
            )}
            <button onClick={onSwitchTeam} title="Switch team" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
              <Layers className="w-4 h-4" />
            </button>
            <button onClick={onLogout} title="Sign out" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Summary pills */}
        {!loading && totalCards > 0 && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <BarChart2 className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-semibold text-slate-700">{totalMastered}</span>
              <span className="text-sm text-slate-400">/ {totalCards} mastered</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-slate-700">{totalCompleted}</span>
              <span className="text-sm text-slate-400">/ {units.length} lessons complete</span>
            </div>
          </div>
        )}

        {/* ── 1. Search ─────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" /> Search
          </h2>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any Chinese term, pinyin, or English…"
              className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-400 outline-none text-slate-800 bg-white shadow-sm text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {search.trim() && (
            <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">No results found for "{search}"</div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                  {searchResults.map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl font-bold text-slate-800 flex-shrink-0">{c.simplified}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-600 truncate">{c.pinyin} · {c.english}</p>
                          {c.traditional !== c.simplified && <p className="text-xs text-slate-400">{c.traditional}</p>}
                          {masteredCards.some(m => m.simplified === c.simplified) && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                              <Check className="w-3 h-3" /> mastered
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setSearch(''); onStartLesson([c.unitNumber], `Unit ${c.unitNumber}: ${c.unitName}`); }}
                        className="flex-shrink-0 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1"
                      >
                        Unit {c.unitNumber} <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 2. Team Records ───────────────────────────────── */}
        {team && unitsWithTeamRecords.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Team Records
              <span className="text-sm font-normal text-slate-400">— {team.name}</span>
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {unitsWithTeamRecords.map(({ unit_number, unit_name }) => {
                  const records = (teamRecordsByUnit.get(unit_number) || []).sort((a, b) => a.rn - b.rn);
                  return (
                    <div key={unit_number} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-36 flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-700">Unit {unit_number}</p>
                        <p className="text-xs text-slate-400 truncate">{unit_name}</p>
                      </div>
                      <div className="flex gap-5 flex-1 flex-wrap">
                        {records.map((r, idx) => (
                          <div key={r.username} className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                              {idx + 1}
                            </div>
                            <Avatar user={r} size="sm" />
                            <div>
                              <p className="text-xs font-semibold text-slate-700 leading-tight">{r.display_name}</p>
                              <p className="text-xs font-mono text-slate-400">{formatMs(r.time_ms)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. Personal Records ───────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> My Lessons
              {loading && <span className="text-xs text-slate-400 font-normal animate-pulse">Loading…</span>}
            </h2>
            <div className="flex gap-2 flex-wrap">
              {selectedUnits.size > 0 && (
                <button
                  onClick={() => onStartLesson([...selectedUnits], `${selectedUnits.size} lessons`)}
                  className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" /> Study Selected ({selectedUnits.size})
                </button>
              )}
              <button
                onClick={() => onStartLesson([], 'All Lessons')}
                className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm"
              >
                <Play className="w-3.5 h-3.5" /> Study All
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {lessonStats.length === 0 && !loading ? (
              <div className="px-4 py-12 text-center text-slate-400 text-sm">
                Cards are loading — please wait a moment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lessonStats.map(ls => {
                  const pct = ls.total > 0 ? Math.round((ls.mastered / ls.total) * 100) : 0;
                  const isSelected = selectedUnits.has(ls.unit_number);

                  return (
                    <div
                      key={ls.unit_number}
                      className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Checkbox */}
                      <button onClick={() => toggleUnit(ls.unit_number)} className="flex-shrink-0">
                        {isSelected
                          ? <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                          : <Circle className="w-5 h-5 text-slate-200 hover:text-slate-300" />}
                      </button>

                      {/* Lesson name + progress bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <button
                            onClick={() => setTermsLesson(ls.unit_number)}
                            className="text-sm font-semibold text-slate-800 hover:text-indigo-600 hover:underline text-left leading-tight"
                          >
                            Unit {ls.unit_number}: {ls.unit_name}
                          </button>
                          {ls.completed && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> done
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${ls.completed ? 'bg-emerald-400' : pct > 0 ? 'bg-rose-400' : 'bg-slate-200'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 w-8 text-right">{pct}%</span>
                        </div>
                      </div>

                      {/* Card counts */}
                      <div className="hidden sm:flex items-center gap-3 flex-shrink-0 text-xs">
                        <div className="text-center w-8">
                          <p className="font-semibold text-slate-700">{ls.total}</p>
                          <p className="text-slate-400">total</p>
                        </div>
                        <div className="text-center w-8">
                          <p className="font-semibold text-emerald-600">{ls.mastered}</p>
                          <p className="text-slate-400">done</p>
                        </div>
                        <div className="text-center w-8">
                          <p className="font-semibold text-rose-500">{ls.learning}</p>
                          <p className="text-slate-400">left</p>
                        </div>
                      </div>

                      {/* Personal best */}
                      <div className="hidden md:block w-20 flex-shrink-0 text-center">
                        {ls.personal_best != null ? (
                          <>
                            <p className="text-xs font-mono font-semibold text-indigo-600">{formatMs(ls.personal_best)}</p>
                            <p className="text-xs text-slate-400">best time</p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-200">—</p>
                        )}
                      </div>

                      {/* Study button */}
                      <button
                        onClick={() => onStartLesson([ls.unit_number], `Unit ${ls.unit_number}: ${ls.unit_name}`)}
                        className="flex-shrink-0 flex items-center gap-1.5 bg-slate-800 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Play className="w-3 h-3" /> Study
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Terms Modal ───────────────────────────────────── */}
      {termsLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setTermsLesson(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">Unit {termsLesson}: {termsLessonName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{termsModalCards.length} terms</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTermsLesson(null); onStartLesson([termsLesson], `Unit ${termsLesson}: ${termsLessonName}`); }}
                  className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl text-sm font-semibold"
                >
                  <Play className="w-3.5 h-3.5" /> Study
                </button>
                <button onClick={() => setTermsLesson(null)} className="p-1.5 hover:bg-slate-100 rounded-xl">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              <div className="space-y-1.5">
                {termsModalCards.map((c, i) => {
                  const isMastered = masteredCards.some(m => m.simplified === c.simplified);
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isMastered ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50'}`}>
                      <span className="text-2xl font-bold text-slate-800 w-10 flex-shrink-0 text-center leading-none">{c.simplified}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 font-medium">{c.pinyin}</p>
                        <p className="text-xs text-slate-500 truncate">{c.english}</p>
                      </div>
                      {c.traditional !== c.simplified && (
                        <span className="text-sm text-slate-400 flex-shrink-0">{c.traditional}</span>
                      )}
                      {isMastered
                        ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <div className="w-4 h-4 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
