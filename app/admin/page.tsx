'use client';

import { useState, useEffect } from 'react';

const ROUND_LABELS: Record<string, string> = {
  round1: 'Round 1 — Rerank Top 50',
  round2: 'Round 2 — Add Missing Bands',
  round3: 'Round 3 — Vote on Missing Bands',
  round4: 'Round 4 — Admin Insertion',
  results: 'Results',
};

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locks, setLocks] = useState<Record<string, boolean>>({
    round1: false,
    round2: false,
    round3: false,
    round4: false,
    results: false,
  });
  const [locksLoading, setLocksLoading] = useState(true);
  const [lockUpdating, setLockUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sessions/aggregate')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));

    fetch('/api/admin/round-locks')
      .then(res => res.json())
      .then(data => {
        setLocks({
          round1: !!data.round1,
          round2: !!data.round2,
          round3: !!data.round3,
          round4: !!data.round4,
          results: !!data.results,
        });
      })
      .finally(() => setLocksLoading(false));
  }, []);

  const toggleLock = async (round: string) => {
    setLockUpdating(round);
    const updated = { ...locks, [round]: !locks[round] };
    try {
      const res = await fetch('/api/admin/round-locks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setLocks(updated);
      }
    } catch (error) {
      console.error('Failed to update lock:', error);
    } finally {
      setLockUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8 flex items-center justify-center">
        <div className="text-2xl text-spotify-green flex items-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-spotify-green rounded-full border-t-transparent"></div>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spotify-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">Admin Dashboard</h1>
          <a href="/" className="bg-spotify-gray hover:bg-spotify-gray/80 text-white px-6 py-2 rounded-full transition-all border border-spotify-light-gray/30">
            ← Back
          </a>
        </div>

        {/* Round Locks */}
        <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 border border-spotify-gray mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Round Locks</h2>
          <p className="text-spotify-light-gray text-sm mb-6">Lock rounds to prevent users from entering them. Locked rounds show a waiting screen.</p>
          {locksLoading ? (
            <div className="text-spotify-light-gray">Loading lock status...</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(ROUND_LABELS).map(([round, label]) => (
                <div
                  key={round}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border ${
                    locks[round]
                      ? 'bg-red-900/20 border-red-500/40'
                      : 'bg-spotify-black border-spotify-gray'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {locks[round] ? '🔒' : '🔓'}
                    </span>
                    <span className="text-white font-medium text-sm sm:text-base">{label}</span>
                  </div>
                  <button
                    onClick={() => toggleLock(round)}
                    disabled={lockUpdating === round}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                      locks[round]
                        ? 'bg-spotify-green hover:bg-spotify-green-dark text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    } disabled:opacity-50`}
                  >
                    {lockUpdating === round
                      ? '...'
                      : locks[round]
                        ? 'Unlock'
                        : 'Lock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aggregated Results */}
        {(!data || data.sessionCount === 0) ? (
          <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-6 sm:p-8 border border-spotify-gray">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-white">Aggregated Results</h2>
              <p className="text-spotify-light-gray">No completed sessions yet.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-lg sm:text-xl text-spotify-light-gray mb-4">
              From <span className="text-spotify-green font-bold">{data.sessionCount}</span> completed sessions
            </p>
            <div className="bg-spotify-dark-gray rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 border border-spotify-gray">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Final Rankings</h2>
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                {data.aggregatedResults.map((band: any) => {
                  const isTopTen = band.position <= 10;
                  return (
                    <div
                      key={band.id}
                      className={`flex items-center justify-between border rounded-lg p-3 sm:p-4 ${
                        isTopTen
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
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-spotify-light-gray font-mono flex-shrink-0 ml-2">
                        {Math.round(band.score)} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
