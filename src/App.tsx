import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Star, Coffee, Plus, X, Check, AlertCircle, Edit, CheckCircle, User, Link, Copy, Trophy, Clock } from 'lucide-react';

const ChineseFoodFlashcards = () => {
  const [currentKid, setCurrentKid] = useState(null);
  const [showKidSelector, setShowKidSelector] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [addForBoth, setAddForBoth] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Timed Game state
  const [isGameMode, setIsGameMode] = useState(false);
  const [countdown, setCountdown] = useState(0); // 0 when not counting down
  const [gameOrder, setGameOrder] = useState([]); // array of indices into cards
  const [gamePosition, setGamePosition] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [finalTimeMs, setFinalTimeMs] = useState(null);

  // Mastery tracking (IDs by `simplified`)
  const [masteredKeys, setMasteredKeys] = useState<string[]>([]);

  // Replace with your Google Sheet CSV URL
  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTyy3u177SKD7E0rercRBFdARVuQMAhlYuMm_7ug1y_xgbVJIGNRpquACUyxdj6BB3zJ0bNqpH4Dyky/pub?gid=0&single=true&output=csv';

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      // naive CSV split; if your data may contain commas/quotes, consider a CSV parser
      const cells = line.split(',').map(c => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
      return row;
    });
  }

  const [allCards, setAllCards] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  
  // Load cards from Google Sheets CSV on initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(SHEET_CSV_URL);
        const text = await res.text();
        const rows = parseCsv(text);
  
        // normalize rows to app shape; ensures fields exist
        const mapped = rows
          .filter(r => r.simplified || r.english)
          .map(r => ({
            simplified: r.simplified || '',
            traditional: r.traditional || r.simplified || '',
            pinyin: r.pinyin || '',
            english: r.english || '',
            unitNumber: r.unitNumber || '',
            unitName: r.unitName || '',
          }));
  
        if (!cancelled) {
          setAllCards(mapped);
          setCards(mapped);
        }
      } catch (e) {
        console.error('Failed to load Google Sheet CSV:', e);
        // Optional: keep cards empty or fallback to previous local data if desired
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Save to URL whenever cards change
  const updateURL = (kidName, cardData) => {
    try {
      const encodedData = encodeURIComponent(btoa(JSON.stringify(cardData)));
      const newURL = `${window.location.pathname}?kid=${kidName}&data=${encodedData}`;
      window.history.replaceState({}, '', newURL);
    } catch (e) {
      console.error('Failed to update URL:', e);
    }
  };

  useEffect(() => {
    if (currentKid && cards.length > 0 && !showKidSelector) {
      updateURL(currentKid, cards);
    }
  }, [cards, currentKid, showKidSelector]);

  const selectKid = (kidName) => {
    setCurrentKid(kidName);
    setCards(allCards);
    setShowKidSelector(false);
    updateURL(kidName, allCards);
  };

  const switchKid = () => {
    // Clear URL params when switching
    window.history.replaceState({}, '', window.location.pathname);
    setShowKidSelector(true);
    setCurrentKid(null);
    setCurrentCard(0);
    setShowAnswer(false);
  };

  const generateShareableLink = () => {
    try {
      const encodedData = encodeURIComponent(btoa(JSON.stringify(cards)));
      return `${window.location.origin}${window.location.pathname}?kid=${currentKid}&data=${encodedData}`;
    } catch (e) {
      return window.location.href;
    }
  };

  const copyLinkToClipboard = () => {
    const link = generateShareableLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setError('Link copied! Save this link to access your progress on any device.');
        setTimeout(() => setError(''), 4000);
      }).catch(() => {
        setError('Please copy the link manually from the box above');
        setTimeout(() => setError(''), 4000);
      });
    } else {
      setError('Please copy the link manually from the box above');
      setTimeout(() => setError(''), 4000);
    }
  };

  const isChinese = (text) => {
    return /[\u4e00-\u9fff]/.test(text);
  };

  const translateWord = async (word) => {
    setIsLoading(true);
    setError('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const inputWord = word.trim();
      const isEnglishInput = !isChinese(inputWord);
      
      if (isEnglishInput) {
        const result = englishLookup[inputWord.toLowerCase()];
        if (result) {
          return result;
        } else {
          return {
            simplified: `[${inputWord}的中文]`,
            traditional: `[${inputWord}的中文]`,
            pinyin: '[pinyin needed]',
            english: inputWord.toLowerCase()
          };
        }
      } else {
        const result = vocabularyDatabase[inputWord];
        if (result) {
          return result;
        } else {
          return {
            simplified: inputWord,
            traditional: inputWord,
            pinyin: '[pinyin needed]',
            english: `[English for ${inputWord}]`
          };
        }
      }
      
    } catch (err) {
      throw new Error('Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Leaderboard helpers
  const getLeaderboard = (kid) => {
    try {
      const key = `timedLeaderboard:${kid}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const formatMs = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    return `${seconds}.${tenths}s`;
  };

  const flipCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setShowAnswer(!showAnswer);
      setIsFlipping(false);
    }, 200);
  };

  const startTimedGame = () => {
    if (cards.length === 0 || isGameMode || countdown > 0) return;
    // Prepare randomized order of indices
    const order = cards.map((_, i) => i).sort(() => Math.random() - 0.5);
    setGameOrder(order);
    setGamePosition(0);
    setShowAnswer(false);
    setCountdown(3);
  };

  // Countdown effect
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // When countdown finishes, start game timer
  useEffect(() => {
    if (countdown === 0 && gameOrder.length > 0 && !isGameMode) {
      // enter game mode
      setIsGameMode(true);
      setElapsedMs(0);
      // Jump to first card in order
      setCurrentCard(gameOrder[0]);
      const id = window.setInterval(() => {
        setElapsedMs((t) => t + 100);
      }, 100);
      setTimerId(id);
    }
  }, [countdown, gameOrder, isGameMode]);

  const endTimedGame = (finalMs) => {
    setIsGameMode(false);
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
    setFinalTimeMs(finalMs);
    // Save to leaderboard (top 3) scoped by kid
    try {
      const key = `timedLeaderboard:${currentKid || 'default'}`;
      const existingRaw = localStorage.getItem(key);
      const list = existingRaw ? JSON.parse(existingRaw) : [];
      list.push(finalMs);
      list.sort((a, b) => a - b);
      const top3 = list.slice(0, 3);
      localStorage.setItem(key, JSON.stringify(top3));
    } catch {}
    // reset game-specific state
    setGameOrder([]);
    setGamePosition(0);
    setCountdown(0);
  };

  const nextCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      if (isGameMode && gameOrder.length > 0) {
        setGamePosition((pos) => {
          const nextPos = (pos + 1) % gameOrder.length;
          setCurrentCard(gameOrder[nextPos]);
          return nextPos;
        });
      } else {
        setCurrentCard((prev) => (prev + 1) % cards.length);
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
        setGamePosition((pos) => {
          const nextPos = (pos - 1 + gameOrder.length) % gameOrder.length;
          setCurrentCard(gameOrder[nextPos]);
          return nextPos;
        });
      } else {
        setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length);
      }
      setShowAnswer(false);
      setIsFlipping(false);
    }, 200);
  };

  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentCard(0);
    setShowAnswer(false);
  };

  const resetCards = () => {
    setCards(allCards);
    setCurrentCard(0);
    setShowAnswer(false);
    setIsGameMode(false);
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
    setElapsedMs(0);
    setFinalTimeMs(null);
  };

  const handleAddWord = async () => {
    if (!newWord.trim()) {
      setError('Please enter a word');
      return;
    }

    try {
      const translation = await translateWord(newWord.trim());
      
      const exists = cards.some(card => 
        card.english.toLowerCase() === translation.english.toLowerCase() ||
        card.simplified === translation.simplified
      );
      
      if (exists) {
        setError('This word is already in your deck');
        return;
      }
      
      // Add to current kid's deck
      setCards(prevCards => [...prevCards, translation]);
      
      // If "Add for both" is checked, also add to the other kid's deck
      if (addForBoth) {
        const otherKid = currentKid === 'sophie' ? 'joyce' : 'sophie';
        const urlParams = new URLSearchParams(window.location.search);
        
        // Try to get the other kid's data from a stored link if available
        // For now, we'll just show a message
        setError(`Word added to ${currentKid === 'sophie' ? "小潔's" : "文文's"} deck! To add to ${otherKid === 'sophie' ? "小潔's" : "文文's"} deck, switch profiles and add it there.`);
      } else {
        setError('Word added successfully!');
      }
      
      setNewWord('');
      setAddForBoth(false);
      setShowAddForm(false);
      setTimeout(() => setError(''), 3000);
      
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditCard = () => {
    setEditingCard({
      ...cards[currentCard],
      originalIndex: currentCard
    });
    setShowEditForm(true);
  };

  const handleSaveEdit = () => {
    if (!editingCard) return;
    const updatedCards = [...cards];
    updatedCards[editingCard.originalIndex] = {
      english: editingCard.english,
      simplified: editingCard.simplified,
      traditional: editingCard.traditional,
      pinyin: editingCard.pinyin
    };
    setCards(updatedCards);
    setShowEditForm(false);
    setEditingCard(null);
    setError('Card updated!');
    setTimeout(() => setError(''), 2000);
  };

  const handleDeleteCard = () => {
    if (cards.length <= 1) {
      setError('Cannot delete the last card');
      return;
    }
    const updatedCards = cards.filter((_, index) => index !== currentCard);
    setCards(updatedCards);
    if (currentCard >= updatedCards.length) {
      setCurrentCard(updatedCards.length - 1);
    }
    setShowEditForm(false);
    setEditingCard(null);
    setShowAnswer(false);
  };

  const handleMarkAsMastered = () => {
    const current = cards[currentCard];
    if (!current) return;
    const id = current.simplified;

    // Track as mastered (idempotent)
    setMasteredKeys(prev => (prev.includes(id) ? prev : [...prev, id]));

    if (isGameMode) {
      if (gameOrder.length === 0) return;
      const currentIndex = currentCard;
      // Remove current card index from gameOrder
      setGameOrder((order) => {
        const idxInOrder = order.indexOf(currentIndex);
        const newOrder = order.filter((i) => i !== currentIndex);
        if (newOrder.length === 0) {
          // Game finished
          endTimedGame(elapsedMs);
        } else {
          // Move to next available position
          const nextPos = idxInOrder % newOrder.length;
          setGamePosition(nextPos);
          setCurrentCard(newOrder[nextPos]);
        }
        return newOrder;
      });
      setShowAnswer(false);
    } else {
      if (cards.length <= 1) return;
      const masteredCard = cards[currentCard];
      const updatedCards = cards.filter((_, index) => index !== currentCard);
      setCards(updatedCards);
      if (currentCard >= updatedCards.length) {
        setCurrentCard(updatedCards.length - 1);
      }
      setShowAnswer(false);
      setError(`"${masteredCard.english}" mastered!`);
      setTimeout(() => setError(''), 3000);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        prevCard();
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        nextCard();
      } else if (event.code === 'Space') {
        event.preventDefault();
        flipCard();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipping]);

  const card = cards[currentCard];
  const timerDisplay = (isGameMode || countdown > 0) ? `${(elapsedMs/1000).toFixed(1)}s` : (finalTimeMs !== null ? `${(finalTimeMs/1000).toFixed(1)}s` : '');
  const progress = ((currentCard + 1) / cards.length) * 100;

  // Show kid selector screen
  if (showKidSelector || !currentKid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 p-4 rounded-3xl shadow-lg mb-4">
              <Coffee className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              Chinese Flashcards
            </h1>
            <p className="text-slate-500">Select your profile to start learning</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => selectKid('sophie')}
              className="w-full bg-white hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white text-slate-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-4 border-2 border-slate-200 hover:border-transparent transform hover:-translate-y-1"
            >
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-xl">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xl font-bold">小潔</h3>
                <p className="text-sm opacity-70">Start learning</p>
              </div>
              <ChevronRight className="w-6 h-6" />
            </button>

            <button
              onClick={() => selectKid('joyce')}
              className="w-full bg-white hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white text-slate-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-4 border-2 border-slate-200 hover:border-transparent transform hover:-translate-y-1"
            >
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-3 rounded-xl">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xl font-bold">文文</h3>
                <p className="text-sm opacity-70">Start learning</p>
              </div>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Leaderboard */}
          <div className="mt-8 bg-white/70 backdrop-blur rounded-2xl border border-slate-200 p-4">
            <h4 className="text-slate-700 font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Top Times</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 font-medium mb-1">小潔</p>
                {getLeaderboard('sophie').length === 0 ? (
                  <p className="text-slate-400">No times yet</p>
                ) : (
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    {getLeaderboard('sophie').map((t, i) => (
                      <li key={i}>{formatMs(t)}</li>
                    ))}
                  </ol>
                )}
              </div>
              <div>
                <p className="text-slate-500 font-medium mb-1">文文</p>
                {getLeaderboard('joyce').length === 0 ? (
                  <p className="text-slate-400">No times yet</p>
                ) : (
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    {getLeaderboard('joyce').map((t, i) => (
                      <li key={i}>{formatMs(t)}</li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Your progress is saved in your personal link
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 p-4">
      <div className="max-w-4xl mx-auto text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-3 rounded-2xl shadow-lg">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Chinese Food Vocabulary
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
            <p className="text-slate-500">Database: {allCards.length} words</p>
              <span className="text-slate-300">•</span>
              <button onClick={switchKid} className="text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                <User className="w-4 h-4" />
                {currentKid === 'sophie' ? '小潔' : '文文'}
              </button>
              <span className="text-slate-300">•</span>
              <button onClick={() => setShowLinkModal(true)} className="text-emerald-500 hover:text-emerald-600 font-medium flex items-center gap-1">
                <Link className="w-4 h-4" />
                Save Link
              </button>
            </div>
          </div>
          {(isGameMode || countdown > 0 || finalTimeMs !== null) && (
            <div className="absolute right-4 top-4">
              <div className="bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-mono flex items-center gap-3">
                <span>{timerDisplay}</span>
                {(isGameMode || finalTimeMs !== null) && <span className="text-white/70">|</span>}
                {(isGameMode || finalTimeMs !== null) && <span>Remaining Cards: {isGameMode ? gameOrder.length : 0}</span>}
              </div>
            </div>
          )}
        </div>
        
        {!isGameMode && !countdown && finalTimeMs === null && (
          <div className="max-w-md mx-auto mb-4">
            <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
              <span>Progress</span>
              <div className="flex items-center gap-3">
                <span>{currentCard + 1} / {cards.length}</span>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className={`relative w-full h-96 cursor-pointer transition-all duration-500 ${isFlipping ? 'scale-95' : 'hover:scale-105'}`} onClick={flipCard}>
            {(countdown > 0) && (
              <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center rounded-3xl">
                <div className="text-white text-6xl font-bold">{countdown}</div>
              </div>
            )}
            {(finalTimeMs !== null && !isGameMode) && (
              <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center rounded-3xl">
                <div className="text-white text-4xl font-bold">
                  Final Time: {formatMs(finalTimeMs)}
                </div>
              </div>
            )}
            <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              <div className="w-full h-full bg-gradient-to-br from-rose-600 via-rose-500 to-pink-500 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-8 left-8 w-24 h-24 border-4 border-white rounded-full"></div>
                  <div className="absolute bottom-8 right-8 w-16 h-16 border-4 border-white rounded-full"></div>
                </div>
                <div className="text-center p-8 text-white z-10">
                  <div className="inline-block px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full text-sm font-medium mb-6">Chinese Characters</div>
                  <div className="mb-8">
                    <p className="text-rose-100 text-lg font-medium mb-3">Simplified</p>
                    <h3 className="text-7xl font-bold leading-none drop-shadow-lg mb-2">{card.simplified}</h3>
                  </div>
                  <div className="pt-6 border-t border-rose-400 border-opacity-30">
                    <p className="text-rose-100 text-lg font-medium mb-3">Traditional</p>
                    <p className="text-5xl font-bold drop-shadow-lg">{card.traditional}</p>
                  </div>
                  <p className="text-rose-100 text-lg font-medium mt-6">Tap to see pinyin</p>
                </div>
              </div>
            </div>

            <div className={`absolute inset-0 transition-all duration-500 ${showAnswer ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-4 right-4 opacity-10"><Star className="w-12 h-12 text-white" /></div>
                <div className="text-center p-8 z-10 text-white">
                  <div className="inline-block px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full text-sm font-medium mb-6">Pinyin + English</div>
                  <h3 className="text-6xl font-bold leading-tight drop-shadow-lg mb-4">{card.pinyin}</h3>
                  <div className="pt-4 border-t border-white border-opacity-30">
                    <p className="text-blue-100 text-2xl font-semibold">{card.english}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center gap-6 mb-8">
          <button onClick={prevCard} disabled={isFlipping} className="bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl p-4 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <button onClick={nextCard} disabled={isFlipping} className="bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-2xl p-4 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            <ChevronRight className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={startTimedGame}
              disabled={isGameMode || countdown > 0}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg border border-amber-300/50 flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Timed Game
            </button>
            <button
              onClick={resetCards}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-yellow-400 hover:to-amber-500 text-white px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg border border-yellow-300/50 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={shuffleCards}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg border border-indigo-400/40 flex items-center gap-2"
            >
              <Shuffle className="w-4 h-4" />
              Shuffle
            </button>
            <button
              onClick={handleMarkAsMastered}
              disabled={cards.length <= 1}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium shadow-md hover:shadow-lg border border-indigo-400/40 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Mastered
            </button>
          </div>
        </div>


        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Add New Word</h3>
                <button onClick={() => { setShowAddForm(false); setNewWord(''); setError(''); }} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-600" /></button>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Enter a word in English or Chinese
                </label>
                <input type="text" value={newWord} onChange={(e) => setNewWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAddWord()} placeholder="e.g., 'good morning' or '早上好'" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg" disabled={isLoading} />
                
                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={addForBoth} 
                      onChange={(e) => setAddForBoth(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-600">
                      Remember to add for {currentKid === 'sophie' ? '文文' : '小潔'} too
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-2 ml-6">
                    (You'll need to switch profiles and add it manually for now)
                  </p>
                </div>
                
                {error && <div className={`flex items-center gap-2 mt-3 text-sm ${error.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>{error.includes('success') ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{error}</div>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddForm(false); setNewWord(''); setError(''); }} className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
                <button onClick={handleAddWord} disabled={isLoading || !newWord.trim()} className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">{isLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Loading...</> : <><Plus className="w-4 h-4" />Add</>}</button>
              </div>
            </div>
          </div>
        )}

        {showEditForm && editingCard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Edit Card</h3>
                <button onClick={() => { setShowEditForm(false); setEditingCard(null); }} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-600" /></button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">English</label>
                  <input type="text" value={editingCard.english} onChange={(e) => setEditingCard({...editingCard, english: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="English word or phrase" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Simplified Chinese</label>
                  <input type="text" value={editingCard.simplified} onChange={(e) => setEditingCard({...editingCard, simplified: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Traditional Chinese</label>
                  <input type="text" value={editingCard.traditional} onChange={(e) => setEditingCard({...editingCard, traditional: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pinyin</label>
                  <input type="text" value={editingCard.pinyin} onChange={(e) => setEditingCard({...editingCard, pinyin: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Pinyin with spaces" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleDeleteCard} className="px-4 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50">Delete</button>
                <button onClick={() => { setShowEditForm(false); setEditingCard(null); }} className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveEdit} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl">Save</button>
              </div>
            </div>
          </div>
        )}

        {showLinkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Save Your Progress Link</h3>
                <button onClick={() => setShowLinkModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-600" /></button>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-600 mb-4">
                  {currentKid === 'sophie' ? "小潔's" : "文文's"} progress is saved in this link. Bookmark it or save it to use on any device!
                </p>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Your Personal Link:</p>
                  <p className="text-sm text-slate-700 break-all font-mono">{generateShareableLink()}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>📱 How to use:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Bookmark this page on each iPad</li>
                    <li>Or copy the link and save it somewhere safe</li>
                    <li>Open the link on any device to continue</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowLinkModal(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Close</button>
                <button onClick={copyLinkToClipboard} className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChineseFoodFlashcards;

