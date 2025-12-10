import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { MissingBand } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch all missing bands for Round 3 voting
export async function GET() {
  try {
    const db = await getDatabase();
    const missingBandsCollection = db.collection('missing_bands');

    const missingBands = await missingBandsCollection
      .find({})
      .sort({ addedCount: -1, name: 1 })
      .toArray();

    return NextResponse.json({
      missingBands: missingBands.map(band => ({
        id: band.id,
        name: band.name,
        addedCount: band.addedCount,
        finalRank: band.finalRank
      }))
    });
  } catch (error) {
    console.error('Missing bands fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing bands' },
      { status: 500 }
    );
  }
}

// POST - Add a new missing band (Round 2)
export async function POST(request: NextRequest) {
  try {
    const { name, sessionName } = await request.json();

    if (!name || !sessionName) {
      return NextResponse.json(
        { error: 'Missing band name or session name' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const missingBandsCollection = db.collection('missing_bands');

    // Check if band already exists
    const existingBand = await missingBandsCollection.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingBand) {
      // Band exists, add this session to submittedBy if not already there
      if (!existingBand.submittedBy.includes(sessionName)) {
        await missingBandsCollection.updateOne(
          { _id: existingBand._id },
          {
            $push: { submittedBy: sessionName },
            $inc: { addedCount: 1 }
          }
        );
      }

      return NextResponse.json({
        band: {
          id: existingBand.id,
          name: existingBand.name
        },
        isNew: false
      });
    } else {
      // Create new band
      const newBand: MissingBand = {
        id: uuidv4(),
        name,
        submittedBy: [sessionName],
        addedCount: 1,
        createdAt: new Date()
      };

      await missingBandsCollection.insertOne(newBand as any);

      return NextResponse.json({
        band: {
          id: newBand.id,
          name: newBand.name
        },
        isNew: true
      });
    }
  } catch (error) {
    console.error('Missing band creation error:', error);
    return NextResponse.json(
      { error: 'Failed to add missing band' },
      { status: 500 }
    );
  }
}