'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BILLBOARD_BANDS, Band } from '@/lib/bands';
import { scoreRankings, RankedBand } from '@/lib/scoring';
import SortableItem from '@/components/SortableBandList';
import { VotingSession } from '@/lib/types';

type Round = 'round1' | 'round2' | 'round3' | 'round4' | 'results';
type View = 'login' | 'voting';

export default function Home() {
  const [view, setView] = useState<View>('login');
  const [sessionName, setSessionName] = useState('');
  const [sessionInput, setSessionInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentRound, setCurrentRound] = useState<Round>('round1');
  const [round1Bands, setRound1Bands] = useState<Band[]>([...BILLBOARD_BANDS]);
  const [round2Bands, setRound2Bands] = useState<Band[]>([]);
  const [round3Bands, setRound3Bands] = useState<Band[]>([]);
  const [newBandInput, setNewBandInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allBands, setAllBands] = useState<Band[]>([]);
  const [finalRankings, setFinalRankings] = useState<RankedBand[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts (helps with scrolling on mobile)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-save functionality
  const saveSession = async () => {
    if (!sessionName) return;

    setSaving(true);
    try {
      const sessionData: VotingSession = {
        sessionName,
        currentRound,
        round1Bands,
        round2Bands,
        round3Bands,
        allBands,
        finalRankings,
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: currentRound === 'results',
      };

      const response = await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save whenever data changes
  useEffect(() => {
    if (view === 'voting' && sessionName) {
      const timer = setTimeout(() => {
        saveSession();
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timer);
    }
  }, [currentRound, round1Bands, round2Bands, round3Bands, allBands, finalRankings]);

  const createSession = async () => {
    setError('');
    if (!sessionInput.trim()) {
      setError('Please enter a session name');
      return;
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: sessionInput.trim(), action: 'create' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create session');
        return;
      }

      setSessionName(sessionInput.trim());
      setView('voting');
    } catch (error) {
      setError('Failed to create session');
    }
  };

  const loadSession = async () => {
    setError('');
    if (!sessionInput.trim()) {
      setError('Please enter a session name');
      return;
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: sessionInput.trim(), action: 'load' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Session not found');
        return;
      }

      const session: VotingSession = data.session;
      setSessionName(session.sessionName);
      setCurrentRound(session.currentRound);
      setRound1Bands(session.round1Bands);
      setRound2Bands(session.round2Bands);
      setRound3Bands(session.round3Bands || []);
      setAllBands(session.allBands);
      setFinalRankings(session.finalRankings);
      setView('voting');
    } catch (error) {
      setError('Failed to load session');
    }
  };

  const logout = () => {
    setView('login');
    setSessionName('');
    setSessionInput('');
    setCurrentRound('round1');
    setRound1Bands([...BILLBOARD_BANDS]);
    setRound2Bands([]);
    setRound3Bands([]);
    setAllBands([]);
    setFinalRankings([]);
  };

  // Round 1: Rerank Billboard's 50
  const handleRound1DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRound1Bands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const goBack = () => {
    if (currentRound === 'round2') setCurrentRound('round1');
    else if (currentRound === 'round3') setCurrentRound('round2');
    else if (currentRound === 'round4') setCurrentRound('round3');
    else if (currentRound === 'results') setCurrentRound('round4');
  };

  const finishRound1 = () => {
    setCurrentRound('round2');
  };

  // Round 2: Add and rank missing bands
  const searchArtists = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/search/artists?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (response.ok && data.artists) {
        setSearchResults(data.artists);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (newBandInput.trim().length > 0) {
      const timer = setTimeout(() => {
        searchArtists(newBandInput);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [newBandInput]);

  const isDuplicate = (bandName: string): boolean => {
    const normalizedName = bandName.toLowerCase().trim();

    // Check against already added bands
    const alreadyAdded = round2Bands.some(
      (band) => band.name.toLowerCase().trim() === normalizedName
    );

    // Check against Billboard bands
    const inBillboard = BILLBOARD_BANDS.some(
      (band) => band.name.toLowerCase().trim() === normalizedName
    );

    return alreadyAdded || inBillboard;
  };

  const addBandFromSearch = async (artist: any) => {
    if (isDuplicate(artist.name)) {
      alert(`"${artist.name}" is already in the list!`);
      return;
    }

    try {
      // Add to global bands collection
      const response = await fetch('/api/bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artist.name, sessionName }),
      });

      const data = await response.json();

      if (response.ok && data.band) {
        const newBand: Band = {
          id: data.band.id,
          name: data.band.name,
          isNewAddition: true,
        };
        setRound2Bands([...round2Bands, newBand]);
        setNewBandInput('');
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to add band:', error);
      alert('Failed to add band. Please try again.');
    }
  };

  const addNewBand = async () => {
    const bandName = newBandInput.trim();
    if (!bandName) return;

    if (isDuplicate(bandName)) {
      alert(`"${bandName}" is already in the list!`);
      return;
    }

    try {
      // Add to global bands collection
      const response = await fetch('/api/bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bandName, sessionName }),
      });

      const data = await response.json();

      if (response.ok && data.band) {
        const newBand: Band = {
          id: data.band.id,
          name: data.band.name,
          isNewAddition: true,
        };
        setRound2Bands([...round2Bands, newBand]);
        setNewBandInput('');
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to add band:', error);
      alert('Failed to add band. Please try again.');
    }
  };

  const handleRound2DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRound2Bands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const finishRound2 = async () => {
    // Fetch all bands added by all users
    try {
      const response = await fetch('/api/sessions/added-bands');
      const data = await response.json();

      if (response.ok && data.addedBands) {
        setRound3Bands(data.addedBands);
      }
      setCurrentRound('round3');
    } catch (error) {
      console.error('Failed to fetch added bands:', error);
      // Continue to round 3 anyway with empty list
      setCurrentRound('round3');
    }
  };

  // Round 3: Rank all user-added bands from everyone
  const handleRound3DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRound3Bands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const finishRound3 = () => {
    // Combine everything for round 4
    const combined = [...round1Bands, ...round2Bands, ...round3Bands];
    setAllBands(combined);
    setCurrentRound('round4');
  };

  // Round 4: Final ranking of all bands
  const handleRound4DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAllBands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const finishRound4 = async () => {
    const bandNameMap = new Map(allBands.map(b => [b.id, b.name]));
    const scored = scoreRankings(allBands.map(b => b.id), bandNameMap);
    setFinalRankings(scored);
    setCurrentRound('results');
  };

  const round1Scored = useMemo(() => {
    if (currentRound === 'round1') {
      const bandNameMap = new Map(round1Bands.map(b => [b.id, b.name]));
      return scoreRankings(round1Bands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [round1Bands, currentRound]);

  const round2Scored = useMemo(() => {
    if (currentRound === 'round2' && round2Bands.length > 0) {
      const bandNameMap = new Map(round2Bands.map(b => [b.id, b.name]));
      return scoreRankings(round2Bands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [round2Bands, currentRound]);

  const round3Scored = useMemo(() => {
    if (currentRound === 'round3' && round3Bands.length > 0) {
      const bandNameMap = new Map(round3Bands.map(b => [b.id, b.name]));
      return scoreRankings(round3Bands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [round3Bands, currentRound]);

  const round4Scored = useMemo(() => {
    if (currentRound === 'round4') {
      const bandNameMap = new Map(allBands.map(b => [b.id, b.name]));
      return scoreRankings(allBands.map(b => b.id), bandNameMap);
    }
    return [];
  }, [allBands, currentRound]);

  // Login View
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-6 sm:p-8 border border-spotify-gray">
            {/* Logo/Title */}
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-spotify-green rounded-full mb-4">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Rock Band Ranker
              </h1>
              <p className="text-spotify-light-gray text-sm sm:text-base">
                Create or load your voting session
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-spotify-light-gray mb-2">
                Session Name
              </label>
              <input
                type="text"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSession()}
                placeholder="Enter your name or session ID"
                className="w-full px-4 py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={createSession}
                className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105"
              >
                Create New Session
              </button>
              <button
                onClick={loadSession}
                className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
              >
                Load Session
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-spotify-gray">
              <a
                href="/admin"
                className="block text-center text-sm text-spotify-green hover:text-spotify-green-dark transition-colors"
              >
                View Aggregated Results (Admin) →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Voting View
  return (
    <div className="min-h-screen bg-spotify-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="hidden sm:block sm:flex-1"></div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white text-center">
              Rock Band Ranker
            </h1>
            <div className="sm:flex-1 flex justify-end w-full sm:w-auto">
              <button
                onClick={logout}
                className="text-sm bg-spotify-gray hover:bg-spotify-gray/80 text-spotify-light-gray hover:text-white px-4 py-2 rounded-full transition-all border border-spotify-light-gray/20"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="text-center">
            <p className="text-base sm:text-lg text-spotify-light-gray">
              Session: <span className="font-bold text-spotify-green">{sessionName}</span>
            </p>
            {saving && (
              <p className="text-sm text-spotify-green mt-2 flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 bg-spotify-green rounded-full animate-pulse"></span>
                Saving...
              </p>
            )}
          </div>
        </header>

        {/* Round 1: Rerank Billboard's 50 */}
        {currentRound === 'round1' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Round 1: Rerank Billboard's Top 50
              </h2>
              <p className="text-spotify-light-gray mb-6 text-sm sm:text-base">
                Drag and drop to reorder the bands. Top 10 positions are worth significantly more points.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRound1DragEnd}
              >
                <SortableContext
                  items={round1Bands.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {round1Scored.map((band) => (
                      <SortableItem
                        key={band.id}
                        id={band.id}
                        name={band.name}
                        position={band.position}
                        score={band.score}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                onClick={finishRound1}
                className="mt-6 w-full bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02]"
              >
                Continue to Round 2 →
              </button>
            </div>
          </div>
        )}

        {/* Round 2: Add Missing Bands */}
        {currentRound === 'round2' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Round 2: Add Missing Bands
              </h2>
              <p className="text-spotify-light-gray mb-6 text-sm sm:text-base">
                Add bands you think are missing from the list, then rank them.
              </p>

              {/* Sticky Search Box */}
              <div className="mb-6 sticky top-0 bg-spotify-dark-gray z-10 pb-4 -mt-4 pt-4">
                <div className="relative">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newBandInput}
                        onChange={(e) => setNewBandInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !showSuggestions) {
                            addNewBand();
                          }
                        }}
                        placeholder="Search for a band or artist..."
                        className="w-full px-4 py-3 bg-spotify-gray border border-spotify-gray rounded-lg text-white placeholder-spotify-light-gray focus:ring-2 focus:ring-spotify-green focus:border-transparent transition-all"
                      />
                      {searching && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin h-5 w-5 border-2 border-spotify-green rounded-full border-t-transparent"></div>
                        </div>
                      )}

                      {/* Search Suggestions Dropdown */}
                      {showSuggestions && searchResults.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-spotify-gray border border-spotify-green rounded-lg shadow-2xl max-h-80 overflow-y-auto z-20">
                          {searchResults.map((artist) => {
                            const duplicate = isDuplicate(artist.name);
                            return (
                              <button
                                key={artist.id}
                                onClick={() => !duplicate && addBandFromSearch(artist)}
                                disabled={duplicate}
                                className={`w-full text-left px-4 py-3 hover:bg-spotify-green/20 border-b border-spotify-dark-gray last:border-b-0 transition-colors ${
                                  duplicate ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                <div className="font-medium text-white">
                                  {artist.name}
                                  {duplicate && (
                                    <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded-full border border-red-700">
                                      Already added
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-spotify-light-gray">
                                  {artist.type && `${artist.type}`}
                                  {artist.country && ` • ${artist.country}`}
                                  {artist.disambiguation && ` • ${artist.disambiguation}`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={addNewBand}
                      className="bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 whitespace-nowrap"
                    >
                      Add Custom
                    </button>
                  </div>
                  <p className="text-xs text-spotify-light-gray mt-2">
                    Type to search MusicBrainz database or click "Add Custom" to add any band name
                  </p>
                </div>
              </div>

              {round2Bands.length > 0 && (
                <>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
                    Your Added Bands ({round2Bands.length})
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleRound2DragEnd}
                  >
                    <SortableContext
                      items={round2Bands.map(b => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {round2Scored.map((band) => (
                          <SortableItem
                            key={band.id}
                            id={band.id}
                            name={band.name}
                            position={band.position}
                            score={band.score}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  ← Back to Round 1
                </button>
                <button
                  onClick={finishRound2}
                  disabled={round2Bands.length === 0}
                  className="flex-1 bg-spotify-green hover:bg-spotify-green-dark disabled:bg-spotify-gray disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02] disabled:transform-none"
                >
                  Continue to Round 3 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Round 3: Rank All User-Added Bands */}
        {currentRound === 'round3' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Round 3: Rank Bands Added by All Users
              </h2>
              <p className="text-spotify-light-gray mb-6 text-sm sm:text-base">
                Here are all the bands that have been added by everyone ({round3Bands.length} total).
                Rank them based on your preference.
              </p>

              {round3Bands.length === 0 ? (
                <div className="text-center py-8 text-spotify-light-gray">
                  <p className="mb-4">No bands have been added by any users yet.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={goBack}
                      className="bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                    >
                      ← Back to Round 2
                    </button>
                    <button
                      onClick={finishRound3}
                      className="bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02]"
                    >
                      Continue to Round 4 →
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleRound3DragEnd}
                  >
                    <SortableContext
                      items={round3Bands.map(b => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                        {round3Scored.map((band) => (
                          <SortableItem
                            key={band.id}
                            id={band.id}
                            name={band.name}
                            position={band.position}
                            score={band.score}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={goBack}
                      className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                    >
                      ← Back to Round 2
                    </button>
                    <button
                      onClick={finishRound3}
                      className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02]"
                    >
                      Continue to Round 4 →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Round 4: Final Ranking */}
        {currentRound === 'round4' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Round 4: Final Ranking
              </h2>
              <p className="text-spotify-light-gray mb-4 text-sm sm:text-base">
                Rank all {allBands.length} bands together (Billboard's 50 + your additions + everyone's additions).
              </p>
              <div className="flex flex-wrap gap-2 mb-6 text-xs sm:text-sm">
                <div className="flex items-center gap-2 bg-spotify-green/20 px-3 py-1 rounded-full border border-spotify-green/50">
                  <span className="w-2 h-2 bg-spotify-green rounded-full"></span>
                  <span className="text-spotify-light-gray">Your additions</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/50">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-spotify-light-gray">Others' additions</span>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRound4DragEnd}
              >
                <SortableContext
                  items={allBands.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {round4Scored.map((band) => {
                      const isMyAddition = round2Bands.some(b => b.id === band.id);
                      const isOthersAddition = round3Bands.some(b => b.id === band.id);

                      return (
                        <div
                          key={band.id}
                          className={
                            isMyAddition
                              ? 'bg-spotify-green/10 rounded-lg border-l-4 border-spotify-green'
                              : isOthersAddition
                              ? 'bg-blue-500/10 rounded-lg border-l-4 border-blue-500'
                              : ''
                          }
                        >
                          <SortableItem
                            id={band.id}
                            name={band.name}
                            position={band.position}
                            score={band.score}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={goBack}
                  className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  ← Back to Round 3
                </button>
                <button
                  onClick={finishRound4}
                  className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02]"
                >
                  Calculate Final Results →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {currentRound === 'results' && (
          <div>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Your Final Rankings
              </h2>
              <p className="text-spotify-light-gray mb-6 text-sm sm:text-base">
                Your rankings have been saved! Visit the admin page to see aggregated results from all voters.
              </p>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {finalRankings.map((band, index) => {
                  const originalBand = allBands.find(b => b.id === band.id);
                  const isTopTen = index < 10;
                  return (
                    <div
                      key={band.id}
                      className={`flex items-center justify-between border rounded-lg p-3 sm:p-4 ${
                        originalBand?.isNewAddition
                          ? 'bg-spotify-green/10 border-spotify-green/30'
                          : isTopTen
                          ? 'bg-spotify-gray border-spotify-green/50'
                          : 'bg-spotify-black border-spotify-gray'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <span className={`text-xl sm:text-2xl font-bold w-8 sm:w-12 text-right flex-shrink-0 ${
                          isTopTen ? 'text-spotify-green' : 'text-white'
                        }`}>
                          {band.position}
                        </span>
                        <span className="text-sm sm:text-lg font-medium text-white truncate">
                          {band.name}
                          {originalBand?.isNewAddition && (
                            <span className="ml-2 text-xs bg-spotify-green text-white px-2 py-1 rounded-full">
                              NEW
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-spotify-light-gray font-mono font-bold flex-shrink-0 ml-2">
                        {band.score} pts
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={goBack}
                  className="bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  ← Back to Round 4
                </button>
                <button
                  onClick={logout}
                  className="flex-1 bg-spotify-gray hover:bg-spotify-gray/80 text-white font-bold py-3 px-6 rounded-full transition-all border border-spotify-light-gray/30"
                >
                  Start New Session
                </button>
                <a
                  href="/admin"
                  className="flex-1 bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-[1.02] text-center"
                >
                  View Aggregated Results
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="flex justify-center gap-2 mt-8">
          <div className={`w-3 h-3 rounded-full transition-all ${currentRound === 'round1' ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${currentRound === 'round2' ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${currentRound === 'round3' ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${currentRound === 'round4' ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
          <div className={`w-3 h-3 rounded-full transition-all ${currentRound === 'results' ? 'bg-spotify-green scale-125' : 'bg-spotify-gray'}`} />
        </div>
      </div>
    </div>
  );
}
