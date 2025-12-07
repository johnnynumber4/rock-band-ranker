import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { Band } from '@/lib/bands';

export async function GET() {
  try {
    const db = await getDatabase();
    const bandsCollection = db.collection('user_bands');

    // Get all user-added bands from the global collection
    const userBands = await bandsCollection
      .find({})
      .sort({ addedCount: -1, name: 1 })
      .toArray();

    // Convert to Band format
    const addedBands: Band[] = userBands.map((band: any) => ({
      id: band.id,
      name: band.name,
      isNewAddition: true,
    }));

    return NextResponse.json({
      addedBands,
      count: addedBands.length,
    });
  } catch (error) {
    console.error('Added bands fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch added bands' },
      { status: 500 }
    );
  }
}
