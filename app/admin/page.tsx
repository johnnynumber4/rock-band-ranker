'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sessions/aggregate')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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

  if (!data || data.sessionCount === 0) {
    return (
      <div className="min-h-screen bg-spotify-black p-4 sm:p-8">
        <div className="max-w-4xl mx-auto bg-spotify-dark-gray rounded-2xl shadow-2xl p-6 sm:p-8 border border-spotify-gray">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-spotify-green rounded-full mb-4">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Aggregated Results</h1>
            <p className="text-spotify-light-gray mb-8">No completed sessions yet!</p>
            <a href="/" className="block w-full bg-spotify-green hover:bg-spotify-green-dark text-white font-bold py-3 px-6 rounded-full text-center transition-all transform hover:scale-[1.02]">
              Go to Voting
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spotify-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">Aggregated Results</h1>
          <a href="/" className="bg-spotify-gray hover:bg-spotify-gray/80 text-white px-6 py-2 rounded-full transition-all border border-spotify-light-gray/30">
            ← Back
          </a>
        </div>
        <p className="text-lg sm:text-xl text-spotify-light-gray mb-6 sm:mb-8">
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
      </div>
    </div>
  );
}
