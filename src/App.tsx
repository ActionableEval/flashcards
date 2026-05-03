import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Star, Coffee, Plus, X, Check, AlertCircle, CheckCircle, User, Link, Copy, Trophy, Clock, Users, LogOut, Settings, Pencil, LayoutDashboard, Mic, MicOff } from 'lucide-react';
import UserLogin from './UserLogin';
import TeamManager from './TeamManager';
import ProfileEditor, { Avatar } from './ProfileEditor';
import Dashboard from './Dashboard';

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
  status?: string;
}

const ChineseFoodFlashcards = () => {
  // ─── App screen state ─────────────────────────────────────────────
  // 'login' | 'dashboard' | 'app'
  const savedUser = (() => { try { const s = localStorage.getItem('flashcards_user'); return s ? JSON.parse(s) as UserData : null; } catch { return null; } })();
  const [screen, setScreen] = useState<'login' | 'dashboard' | 'app'>(savedUser ? 'dashboard' : 'login');
  const [currentUser, setCurrentUser] = useState<UserData | null>(savedUser);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [managedTeam, setManagedTeam] = useState<Team | null>(null);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  // ─── Flashcard state ──────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState('');
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [editingCard, setEditingCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Mastery & lesson tracking
  const [masteredKeys, setMasteredKeys] = useState<string[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [lessonJustCompleted, setLessonJustCompleted] = useState(false);

  // User/unit menu
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Speech recognition
  const [isListening, setIsListening] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [speakModeActive, setSpeakModeActive] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const noSpeechCountRef = useRef(0);
  const speakModeRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const listenCallbackRef = useRef<(() => void) | null>(null);


  // Timed game state
  const [isGameMode, setIsGameMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [gameOrder, setGameOrder] = useState<number[]>([]);
  const [gamePosition, setGamePosition] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerId, setTimerId] = useState<number | null>(null);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);

  // Cards
  const [allCards, setAllCards] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);

  const getAvailableUnits = () => {
    const units = [...new Set(allCards.map(c => c.unitNumber).filter(Boolean))];
    return units.sort((a, b) => parseInt(a) - parseInt(b));
  };

  // ─── Load cards from database ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/flashcards');
        if (!res.ok) throw new Error('Failed to load cards');
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length) {
          setAllCards(data);
          setCards(data);
        }
      } catch (e) {
        console.error('Failed to load flashcards from DB:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Restore teams for persisted session ──────────────────────────
  useEffect(() => {
    if (!savedUser) return;
    loadProgress(savedUser.username);
    fetch(`/api/users/${savedUser.id}/teams`)
      .then(r => r.json())
      .then(teams => setUserTeams(Array.isArray(teams) ? teams.filter((t: any) => t.status === 'approved') : []))
      .catch(() => setUserTeams([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Database API helpers ─────────────────────────────────────────
  const loadProgress = async (username: string) => {
    try {
      const res = await fetch(`/api/progress/${username}`);
      if (!res.ok) return;
      const data = await res.json();
      setMasteredKeys(data.masteredCards.map((c: any) => c.simplified));
      setCompletedLessons(data.completedLessons.map((l: any) => l.unit_number));
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
  };

  const saveMastered = async (username: string, simplified: string, unit_number: string) => {
    try {
      await fetch('/api/mastered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: username, simplified, unit_number }),
      });
    } catch (e) {
      console.error('Failed to save mastered card:', e);
    }
  };

  const saveCompletedLesson = async (username: string, unit_number: string, unit_name: string, time_ms?: number) => {
    try {
      await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: username, unit_number, unit_name, time_ms: time_ms ?? null }),
      });
      setCompletedLessons(prev => prev.includes(unit_number) ? prev : [...prev, unit_number]);
    } catch (e) {
      console.error('Failed to save completed lesson:', e);
    }
  };

  // ─── User / Team flow ─────────────────────────────────────────────
  const handleLogin = async (user: UserData) => {
    setCurrentUser(user);
    try { localStorage.setItem('flashcards_user', JSON.stringify(user)); } catch {}
    try {
      const res = await fetch(`/api/users/${user.id}/teams`);
      const teams = await res.json();
      setUserTeams(Array.isArray(teams) ? teams.filter((t: any) => t.status === 'approved') : []);
    } catch {
      setUserTeams([]);
    }
    loadProgress(user.username);
    setScreen('dashboard');
  };

  const handleStartLesson = (units: string[], _label?: string, studyAll = false) => {
    const byUnit = units.length === 0
      ? allCards
      : units.length === 1
        ? allCards.filter(c => String(c.unitNumber) === String(units[0]))
        : allCards.filter(c => units.map(String).includes(String(c.unitNumber)));
    const filtered = studyAll ? byUnit : byUnit.filter(c => !masteredKeys.includes(c.simplified));
    setSelectedUnit(units.length === 1 ? units[0] : '');
    setCards(filtered.length > 0 ? filtered : byUnit);
    setCurrentCard(0);
    setShowAnswer(false);
    setIsGameMode(false);
    setGameOrder([]);
    setFinalTimeMs(null);
    setLessonJustCompleted(false);
    setScreen('app');
  };

  const handleLogout = () => {
    try { localStorage.removeItem('flashcards_user'); } catch {}
    setCurrentUser(null);
    setUserTeams([]);
    setScreen('login');
    setMasteredKeys([]);
    setCompletedLessons([]);
    setSelectedUnit('');
    setCurrentCard(0);
    setShowAnswer(false);
    setIsGameMode(false);
    setGameOrder([]);
    setFinalTimeMs(null);
  };

  const handleTeamLeave = (teamId: number) => {
    setUserTeams(prev => prev.filter(t => t.id !== teamId));
    setManagedTeam(null);
    setShowTeamManager(false);
  };

  // ─── Close user menu on outside click ────────────────────────────
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const node = userMenuRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ─── URL helpers ──────────────────────────────────────────────────
  const updateURL = (username: string, cardData: any[]) => {
    try {
      const encoded = encodeURIComponent(btoa(JSON.stringify(cardData)));
      window.history.replaceState({}, '', `${window.location.pathname}?user=${username}&data=${encoded}`);
    } catch {}
  };

  useEffect(() => {
    if (currentUser && cards.length > 0 && screen === 'app') {
      updateURL(currentUser.username, cards);
    }
  }, [cards, currentUser, screen]);

  // ─── Card navigation ──────────────────────────────────────────────
  const flipCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => { setShowAnswer(s => !s); setIsFlipping(false); }, 200);
  };

  const nextCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      if (isGameMode && gameOrder.length > 0) {
        setGamePosition(pos => {
          const next = (pos + 1) % gameOrder.length;
          setCurrentCard(gameOrder[next]);
          return next;
        });
      } else {
        setCurrentCard(prev => (prev + 1) % cards.length);
      }
      setShowAnswer(false);
      setIsFlipping(false);
    }, 200);
  };

  const prevCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      if (isGameMode && gameOrder.length > 0) {
        setGamePosition(pos => {
          const next = (pos - 1 + gameOrder.length) % gameOrder.length;
          setCurrentCard(gameOrder[next]);
          return next;
        });
      } else {
        setCurrentCard(prev => (prev - 1 + cards.length) % cards.length);
      }
      setShowAnswer(false);
      setIsFlipping(false);
    }, 200);
  };

  const shuffleCards = () => {
    setCards(c => [...c].sort(() => Math.random() - 0.5));
    setCurrentCard(0);
    setShowAnswer(false);
  };

  const resetCards = () => {
    setIsGameMode(false);
    setCountdown(0);
    setGameOrder([]);
    setGamePosition(0);
    if (timerId) { clearInterval(timerId); setTimerId(null); }
    setElapsedMs(0);
    setFinalTimeMs(null);
    const filtered = selectedUnit
      ? allCards.filter(c => String(c.unitNumber) === String(selectedUnit))
      : allCards;
    setCards(filtered);
    setMasteredKeys([]);
    setLessonJustCompleted(false);
    if (selectedUnit) {
      setCompletedLessons(prev => prev.filter(u => u !== selectedUnit));
      if (currentUser) {
        fetch('/api/mastered', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kid: currentUser.username, unit_number: selectedUnit }),
        }).catch(() => {});
      }
    }
    setCurrentCard(0);
    setShowAnswer(false);
    if (currentUser) updateURL(currentUser.username, filtered);
  };

  // ─── Timed game ───────────────────────────────────────────────────
  const startTimedGame = () => {
    if (isGameMode || countdown > 0) return;
    const unitCards = selectedUnit
      ? allCards.filter(c => String(c.unitNumber) === String(selectedUnit))
      : allCards;
    if (unitCards.length === 0) return;
    const order = unitCards.map((_, i) => i).sort(() => Math.random() - 0.5);
    setCards(unitCards);
    setGameOrder(order);
    setGamePosition(0);
    setShowAnswer(false);
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && gameOrder.length > 0 && !isGameMode) {
      setIsGameMode(true);
      setElapsedMs(0);
      setCurrentCard(gameOrder[0]);
      const id = window.setInterval(() => setElapsedMs(t => t + 100), 100);
      setTimerId(id);
    }
  }, [countdown, gameOrder, isGameMode]);

  const endTimedGame = (finalMs: number) => {
    setIsGameMode(false);
    if (timerId) { clearInterval(timerId); setTimerId(null); }
    setFinalTimeMs(finalMs);
    // Save timed result to DB
    if (currentUser && selectedUnit) {
      const unitCards = allCards.filter(c => String(c.unitNumber) === String(selectedUnit));
      const unitName = unitCards[0]?.unitName || `Unit ${selectedUnit}`;
      saveCompletedLesson(currentUser.username, String(selectedUnit), unitName, finalMs);
    }
    // Restore unmastered cards for regular study
    const restorePool = selectedUnit
      ? allCards.filter(c => String(c.unitNumber) === String(selectedUnit))
      : allCards;
    const unmastered = restorePool.filter(c => !masteredKeys.includes(c.simplified));
    setCards(unmastered.length > 0 ? unmastered : restorePool);
    try {
      const key = `timedLeaderboard:${currentUser?.username}:unit:${selectedUnit || 'all'}`;
      const raw = localStorage.getItem(key);
      let prev: number | null = null;
      if (raw) { const p = JSON.parse(raw); prev = typeof p === 'number' ? p : (Array.isArray(p) && p.length ? Math.min(...p) : null); }
      localStorage.setItem(key, JSON.stringify(prev === null ? finalMs : Math.min(prev, finalMs)));
    } catch {}
    setGameOrder([]);
    setGamePosition(0);
    setCountdown(0);
  };

  // ─── Mastery ──────────────────────────────────────────────────────
  const handleMarkAsMastered = () => {
    noSpeechCountRef.current = 0;
    setNoSpeechCount(0);
    const current = cards[currentCard];
    if (!current) return;
    const id = current.simplified;

    const updatedMastered = masteredKeys.includes(id) ? masteredKeys : [...masteredKeys, id];
    setMasteredKeys(updatedMastered);
    if (currentUser) {
      saveMastered(currentUser.username, id, current.unitNumber);
    }

    if (isGameMode) {
      const currentIndex = currentCard;
      setGameOrder(order => {
        const idx = order.indexOf(currentIndex);
        const newOrder = order.filter(i => i !== currentIndex);
        if (newOrder.length === 0) { endTimedGame(elapsedMs); }
        else {
          const nextPos = idx % newOrder.length;
          setGamePosition(nextPos);
          setCurrentCard(newOrder[nextPos]);
        }
        return newOrder;
      });
      setShowAnswer(false);
    } else {
      if (cards.length <= 1) {
        // Last card mastered — show completion overlay
        setLessonJustCompleted(true);
        if (currentUser && selectedUnit) {
          const unitCards = allCards.filter(c => String(c.unitNumber) === String(selectedUnit));
          const unitName = unitCards[0]?.unitName || `Unit ${selectedUnit}`;
          saveCompletedLesson(currentUser.username, String(selectedUnit), unitName);
        }
        return;
      }
      const masteredCard = cards[currentCard];
      const updated = cards.filter((_, i) => i !== currentCard);
      setCards(updated);
      if (currentCard >= updated.length) setCurrentCard(updated.length - 1);
      setShowAnswer(false);
      setError(`"${masteredCard.english}" mastered!`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─── Success chime ────────────────────────────────────────────────
  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [880, 1320];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {}
  };

  // ─── Speech recognition core ──────────────────────────────────────
  // listenCallbackRef always holds a fresh closure so onend never has stale state
  listenCallbackRef.current = () => {
    if (!speakModeRef.current || isListening || cards.length === 0) return;
    startSingleListen(cards[currentCard]);
  };

  const startSingleListen = (current: any) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !current) return;

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'zh-TW';
    recognition.interimResults = true;   // catch partial results for single-char words
    recognition.maxAlternatives = 8;
    recognition.continuous = false;

    const simplified = current.simplified.trim();
    const traditional = current.traditional.trim();
    const len = simplified.length;
    let accepted = false; // prevent double-processing

    // For interim results on 1-char words: accept any length (recognizer needs
    // context, so user may say "冰水" and we catch "冰" mid-stream)
    const checkMatchInterim = (transcripts: string[]): boolean => {
      if (len !== 1) return false;
      return transcripts.some(t => t && (t.includes(simplified) || t.includes(traditional)));
    };

    const checkMatch = (transcripts: string[]): boolean => {
      return transcripts.some(t => {
        if (!t) return false;
        if (len === 1) {
          // final result: accept if heard text contains the char and is short (≤3 chars)
          return (t.includes(simplified) || t.includes(traditional)) && t.length <= 3;
        }
        if (len === 2) {
          return t === simplified || t === traditional;
        }
        return t === simplified || t === traditional ||
               t.includes(simplified) || t.includes(traditional) ||
               simplified.includes(t) || traditional.includes(t);
      });
    };

    const accept = (bestHeard: string) => {
      if (accepted) return;
      accepted = true;
      noSpeechCountRef.current = 0;
      setNoSpeechCount(0);
      recognition.stop();
      setLastHeard(bestHeard);
      playSuccessSound();
      setSpeechFeedback('correct');
      setTimeout(() => { setSpeechFeedback(null); setLastHeard(''); }, 1800);
      setTimeout(() => handleMarkAsMastered(), 400);
    };

    recognition.onstart = () => {
      console.log('[Speech] Listening for:', simplified);
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (speakModeRef.current) {
        setTimeout(() => listenCallbackRef.current?.(), 600);
      }
    };

    recognition.onresult = (event: any) => {
      if (accepted) return;

      const latest = event.results[event.resultIndex];
      const isFinal = latest.isFinal;
      const alternatives = Array.from(latest) as any[];
      const transcripts = alternatives.map((r: any) => r.transcript.trim());
      const bestHeard = transcripts[0] || '';

      console.log(`[Speech] ${isFinal ? 'Final' : 'Interim'}:`, transcripts, '| Expected:', simplified);

      // For single-char words: check interim results with no length cap
      // (recognizer may hear "冰水" while user says "冰" — we accept it mid-stream)
      if (!isFinal && checkMatchInterim(transcripts)) {
        accept(bestHeard);
        return;
      }

      // Only process final results from here
      if (!isFinal) return;

      setLastHeard(bestHeard);
      if (checkMatch(transcripts) || checkMatchInterim(transcripts)) {
        accept(bestHeard);
      } else {
        setSpeechFeedback('wrong');
        setTimeout(() => { setSpeechFeedback(null); setLastHeard(''); }, 3000);
      }
    };

    recognition.onerror = (event: any) => {
      console.log('[Speech] Error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        noSpeechCountRef.current += 1;
        setNoSpeechCount(noSpeechCountRef.current);
      } else {
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone access denied — open the app in a full browser tab and allow mic permission.',
          'network': 'Network error — speech recognition needs an internet connection.',
          'aborted': '',
        };
        const msg = messages[event.error] ?? `Mic error: ${event.error}`;
        if (msg) { setError(msg); setTimeout(() => setError(''), 5000); }
      }
      // onend fires after onerror, which will restart if in auto mode
    };

    try { recognition.start(); } catch (e: any) {
      console.error('[Speech] Start error:', e);
      setError(`Could not start mic: ${e.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const toggleSpeakMode = () => {
    if (speakModeActive) {
      speakModeRef.current = false;
      setSpeakModeActive(false);
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        setError('Speech recognition not supported — please use Chrome or Edge.');
        setTimeout(() => setError(''), 5000);
        return;
      }
      speakModeRef.current = true;
      setSpeakModeActive(true);
      startSingleListen(cards[currentCard]);
    }
  };

  // ─── Unit selection applies immediately ───────────────────────────
  const applyUnit = (unit: string) => {
    setSelectedUnit(unit);
    const filtered = unit ? allCards.filter(c => String(c.unitNumber) === String(unit)) : allCards;
    setCards(filtered);
    setCurrentCard(0);
    setShowAnswer(false);
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'app') return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); prevCard(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); nextCard(); }
      else if (e.code === 'Space') { e.preventDefault(); flipCard(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFlipping, screen]);

  // ─── Leaderboard ──────────────────────────────────────────────────
  const getLeaderboard = (username: string, unit: string): number | null => {
    try {
      const key = `timedLeaderboard:${username}:unit:${unit || 'all'}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p === 'number') return p;
      if (Array.isArray(p) && p.length) return Math.min(...p);
      return null;
    } catch { return null; }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const t = Math.floor((ms % 1000) / 100);
    return m > 0 ? `${m}:${(s % 60).toString().padStart(2, '0')}.${t}` : `${s}.${t}s`;
  };

  // ─── Derived values ───────────────────────────────────────────────
  const card = cards[currentCard];
  const progress = cards.length > 0 ? ((currentCard + 1) / cards.length) * 100 : 0;
  const timerDisplay = (isGameMode || countdown > 0) ? `${(elapsedMs / 1000).toFixed(1)}s` : (finalTimeMs !== null ? `${(finalTimeMs / 1000).toFixed(1)}s` : '');

  const headerTitle = React.useMemo(() => {
    if (selectedUnit) {
      const unitCards = allCards.filter(c => c.unitNumber === selectedUnit);
      const unitName = unitCards[0]?.unitName || `Unit ${selectedUnit}`;
      return `Unit ${selectedUnit}: ${unitName}`;
    }
    return 'All Units';
  }, [selectedUnit, allCards]);

  // ─── Screens ──────────────────────────────────────────────────────
  if (screen === 'login') {
    return <UserLogin onLogin={handleLogin} />;
  }

  if (screen === 'dashboard') {
    return (
      <>
        <Dashboard
          user={currentUser!}
          userTeams={userTeams}
          allCards={allCards}
          onStartLesson={handleStartLesson}
          onEditProfile={() => setShowProfileEditor(true)}
          onManageTeam={(team) => { setManagedTeam(team); setShowTeamManager(true); }}
          onTeamsChange={setUserTeams}
          onLogout={handleLogout}
        />
        {showTeamManager && currentUser && managedTeam && (
          <TeamManager
            user={currentUser}
            team={managedTeam}
            onClose={() => setShowTeamManager(false)}
            onLeave={() => handleTeamLeave(managedTeam.id)}
          />
        )}
        {showProfileEditor && currentUser && (
          <ProfileEditor
            user={currentUser}
            onClose={() => setShowProfileEditor(false)}
            onUpdate={(updated) => setCurrentUser(updated)}
          />
        )}
      </>
    );
  }

  // ─── Main app (flashcard study) ───────────────────────────────────
  const availableUnits = getAvailableUnits();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {/* Left: back button + logo + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScreen('dashboard')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <LayoutDashboard className="w-3.5 h-3.5" />
            </button>
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2.5 rounded-2xl shadow-lg">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{headerTitle}</h1>
            </div>
          </div>

          {/* Right: timer + user menu */}
          <div className="flex items-center gap-3">
            {(isGameMode || countdown > 0 || finalTimeMs !== null) && (
              <div className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-mono flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{timerDisplay}</span>
                {isGameMode && <span className="text-white/60">· {gameOrder.length} left</span>}
              </div>
            )}

            {/* User menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(s => !s)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 shadow-sm"
              >
                {currentUser && <Avatar user={currentUser} size="sm" />}
                <span className="text-sm font-medium text-slate-700">{currentUser?.display_name}</span>
                {userTeams.length > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{userTeams[0].name}</span>
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
                    {currentUser && <Avatar user={currentUser} size="sm" />}
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{currentUser?.display_name}</p>
                      <p className="text-xs text-slate-400">@{currentUser?.username}</p>
                    </div>
                  </div>

                  {/* Edit profile */}
                  <button
                    onClick={() => { setShowProfileEditor(true); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700"
                  >
                    <Pencil className="w-4 h-4 text-rose-400" />
                    Edit Profile
                  </button>

                  {/* Unit selector */}
                  <div className="px-3 py-2 border-t border-b border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-medium">Unit</p>
                    <select
                      value={selectedUnit}
                      onChange={e => { applyUnit(e.target.value); setShowUserMenu(false); }}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-rose-400 outline-none"
                    >
                      <option value="">All Units</option>
                      {availableUnits.map(u => {
                        const uc = allCards.filter(c => c.unitNumber === u);
                        return <option key={u} value={u}>Unit {u}: {uc[0]?.unitName || ''} ({uc.length})</option>;
                      })}
                    </select>
                  </div>

                  <button
                    onClick={() => { setScreen('dashboard'); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700"
                  >
                    <Users className="w-4 h-4 text-slate-400" />
                    Switch Team
                  </button>
                  <button
                    onClick={() => { handleLogout(); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 flex items-center gap-2 text-sm text-red-500"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            {masteredKeys.length} mastered
          </span>
          {completedLessons.length > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              {completedLessons.length} {completedLessons.length === 1 ? 'lesson' : 'lessons'} completed
            </span>
          )}
          {selectedUnit && completedLessons.includes(selectedUnit) && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <Check className="w-3.5 h-3.5" /> This unit complete!
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isGameMode && !countdown && finalTimeMs === null && cards.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Card {currentCard + 1} of {cards.length}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Flashcard */}
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div
            className={`relative w-full h-80 cursor-pointer transition-all duration-500 ${isFlipping ? 'scale-95' : 'hover:scale-105'}`}
            onClick={flipCard}
          >
            {countdown > 0 && (
              <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center rounded-3xl">
                <div className="text-white text-6xl font-bold">{countdown}</div>
              </div>
            )}
            {selectedUnit && lessonJustCompleted && finalTimeMs === null && (
              <div className="absolute inset-0 bg-emerald-600/90 z-20 flex flex-col items-center justify-center rounded-3xl gap-3 p-6" onClick={e => e.stopPropagation()}>
                <div className="text-5xl">🏆</div>
                <p className="text-white font-bold text-xl">Lesson Complete!</p>
                <p className="text-emerald-100 text-sm">All cards mastered</p>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <button
                    onClick={() => setScreen('dashboard')}
                    className="flex items-center justify-center gap-2 bg-white text-emerald-700 font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-emerald-50 transition-colors text-sm w-full"
                  >
                    <LayoutDashboard className="w-4 h-4" /> Back to Dashboard
                  </button>
                  <button
                    onClick={resetCards}
                    className="flex items-center justify-center gap-2 bg-emerald-500/60 hover:bg-emerald-500/80 text-white font-semibold px-6 py-2.5 rounded-2xl transition-colors text-sm w-full"
                  >
                    <RotateCcw className="w-4 h-4" /> Restart
                  </button>
                </div>
              </div>
            )}
            {finalTimeMs !== null && !isGameMode && (
              <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center rounded-3xl gap-3 p-6" onClick={e => e.stopPropagation()}>
                <div className="text-5xl">🎉</div>
                <div className="text-white text-3xl font-bold">{formatMs(finalTimeMs)}</div>
                <p className="text-white/80 text-sm">Lesson complete!</p>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <button
                    onClick={() => setScreen('dashboard')}
                    className="flex items-center justify-center gap-2 bg-white text-slate-800 font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-rose-50 hover:text-rose-600 transition-colors text-sm w-full"
                  >
                    <LayoutDashboard className="w-4 h-4" /> Back to Dashboard
                  </button>
                  <button
                    onClick={resetCards}
                    className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-2.5 rounded-2xl transition-colors text-sm w-full"
                  >
                    <RotateCcw className="w-4 h-4" /> Restart
                  </button>
                </div>
              </div>
            )}

            {/* Front */}
            <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              <div className="w-full h-full bg-gradient-to-br from-rose-600 via-rose-500 to-pink-500 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-6 left-6 w-20 h-20 border-4 border-white rounded-full" />
                  <div className="absolute bottom-6 right-6 w-14 h-14 border-4 border-white rounded-full" />
                </div>
                <div className="text-center p-8 text-white z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium mb-4">
                    Chinese Characters
                    {card && masteredKeys.includes(card.simplified) && (
                      <span className="bg-emerald-400/40 px-2 py-0.5 rounded-full text-xs">✓ Mastered</span>
                    )}
                  </div>
                  <p className="text-rose-100 text-sm font-medium mb-2">Simplified</p>
                  <h3 className="text-6xl font-bold drop-shadow-lg mb-3">{card?.simplified}</h3>
                  <div className="pt-4 border-t border-rose-400/30">
                    <p className="text-rose-100 text-sm mb-1">Traditional</p>
                    <p className="text-4xl font-bold">{card?.traditional}</p>
                  </div>
                  <p className="text-rose-200 text-sm mt-4">Tap to reveal</p>
                </div>
              </div>
            </div>

            {/* Back */}
            <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-4 right-4 opacity-10"><Star className="w-10 h-10 text-white" /></div>
                <div className="text-center p-8 z-10 text-white">
                  <div className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium mb-4">Pinyin + English</div>
                  <h3 className="text-5xl font-bold drop-shadow-lg mb-4">{card?.pinyin}</h3>
                  <div className="pt-4 border-t border-white/30">
                    <p className="text-blue-100 text-xl font-semibold">{card?.english}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nav arrows */}
        <div className="flex justify-center gap-6 mb-6">
          <button onClick={prevCard} disabled={isFlipping} className="bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl p-3.5 shadow-md hover:shadow-lg">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={nextCard} disabled={isFlipping} className="bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl p-3.5 shadow-md hover:shadow-lg">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <button
            onClick={startTimedGame}
            disabled={isGameMode || countdown > 0}
            className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium shadow-md flex items-center gap-2 text-sm"
          >
            <Clock className="w-4 h-4" /> Timed Game
          </button>
          <button
            onClick={resetCards}
            className="bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={shuffleCards}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-md flex items-center gap-2 text-sm"
          >
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
          <button
            onClick={handleMarkAsMastered}
            disabled={cards.length === 0}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium shadow-md flex items-center gap-2 text-sm"
          >
            <CheckCircle className="w-4 h-4" /> Mastered
          </button>
          <button
            onClick={toggleSpeakMode}
            disabled={cards.length === 0}
            className={`relative disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium shadow-md flex items-center gap-2 text-sm transition-all ${
              speakModeActive
                ? isListening
                  ? 'bg-red-500 animate-pulse'
                  : speechFeedback === 'correct'
                  ? 'bg-emerald-500'
                  : speechFeedback === 'wrong'
                  ? 'bg-rose-600'
                  : 'bg-red-400 hover:bg-red-500'
                : 'bg-gradient-to-r from-violet-700 to-purple-800 hover:from-violet-800 hover:to-purple-900'
            }`}
          >
            {speakModeActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {speakModeActive
              ? isListening ? 'Listening…' : speechFeedback === 'correct' ? '✓ Correct!' : speechFeedback === 'wrong' ? '✗ Try again' : 'Auto ON'
              : 'Auto'}
          </button>
        </div>

        {/* No-speech hint for stubborn single-char cards */}
        {noSpeechCount >= 3 && cards[currentCard]?.simplified.length === 1 && !lastHeard && (
          <div className="max-w-md mx-auto mb-3 flex items-center justify-center gap-2 p-3 rounded-xl text-sm border bg-amber-50 text-amber-700 border-amber-200">
            <span>💡</span>
            <span>Try saying it in a short phrase, e.g. <strong>{cards[currentCard]?.simplified}水</strong> or <strong>{cards[currentCard]?.simplified}{cards[currentCard]?.simplified}</strong></span>
          </div>
        )}

        {/* Speech heard feedback */}
        {lastHeard && (
          <div className={`max-w-md mx-auto mb-3 flex items-center justify-center gap-3 p-3 rounded-xl text-sm font-medium border ${
            speechFeedback === 'correct'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : speechFeedback === 'wrong'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-violet-50 text-violet-700 border-violet-200'
          }`}>
            <span className="text-xs text-gray-400 font-normal">Heard:</span>
            <span className="text-lg tracking-wide">{lastHeard}</span>
            {speechFeedback === 'correct' && <span className="text-emerald-500 text-base">✓</span>}
            {speechFeedback === 'wrong' && <span className="text-rose-500 text-base">✗</span>}
          </div>
        )}

        {/* Notification */}
        {error && (
          <div className={`max-w-md mx-auto mb-4 flex items-center gap-2 p-3 rounded-xl text-sm ${
            error.includes('mastered') || error.includes('completed') || error.includes('🎉')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {(error.includes('mastered') || error.includes('completed') || error.includes('🎉'))
              ? <Check className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {error}
          </div>
        )}

        {/* Edit card form */}
        {showEditForm && editingCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Edit Card</h3>
                <button onClick={() => { setShowEditForm(false); setEditingCard(null); }} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                {['english', 'simplified', 'traditional', 'pinyin'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">{field}</label>
                    <input
                      type="text"
                      value={editingCard[field]}
                      onChange={e => setEditingCard({ ...editingCard, [field]: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (cards.length <= 1) { setError('Cannot delete the last card'); return; }
                    const updated = cards.filter((_, i) => i !== editingCard.originalIndex);
                    setCards(updated);
                    if (currentCard >= updated.length) setCurrentCard(updated.length - 1);
                    setShowEditForm(false);
                    setEditingCard(null);
                    setShowAnswer(false);
                  }}
                  className="px-4 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50"
                >
                  Delete
                </button>
                <button onClick={() => { setShowEditForm(false); setEditingCard(null); }} className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
                <button
                  onClick={() => {
                    const updated = [...cards];
                    updated[editingCard.originalIndex] = {
                      english: editingCard.english,
                      simplified: editingCard.simplified,
                      traditional: editingCard.traditional,
                      pinyin: editingCard.pinyin,
                    };
                    setCards(updated);
                    setShowEditForm(false);
                    setEditingCard(null);
                    setError('Card updated!');
                    setTimeout(() => setError(''), 2000);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Manager Modal */}
      {showTeamManager && currentUser && managedTeam && (
        <TeamManager
          user={currentUser}
          team={managedTeam}
          onClose={() => setShowTeamManager(false)}
          onLeave={() => handleTeamLeave(managedTeam.id)}
        />
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && currentUser && (
        <ProfileEditor
          user={currentUser}
          onClose={() => setShowProfileEditor(false)}
          onUpdate={(updated) => setCurrentUser(updated)}
        />
      )}
    </div>
  );
};

export default ChineseFoodFlashcards;
