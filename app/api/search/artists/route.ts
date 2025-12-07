import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Use MusicBrainz API to search for artists
    const musicBrainzUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=10`;

    const response = await fetch(musicBrainzUrl, {
      headers: {
        'User-Agent': 'RockBandRanker/1.0.0 (contact@example.com)',
      },
    });

    if (!response.ok) {
      throw new Error('MusicBrainz API request failed');
    }

    const data = await response.json();

    // Transform MusicBrainz response to our format
    const artists = data.artists.map((artist: any) => ({
      id: artist.id,
      name: artist.name,
      disambiguation: artist.disambiguation || '',
      type: artist.type || '',
      country: artist.country || '',
      score: artist.score || 0,
    }));

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Artist search error:', error);
    return NextResponse.json(
      { error: 'Failed to search artists' },
      { status: 500 }
    );
  }
}
