import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { Band } from '@/lib/bands';
import { v4 as uuidv4 } from 'uuid';

interface UserBand extends Band {
  addedBy: string[];
  addedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function POST(request: NextRequest) {
  try {
    const { name, sessionName } = await request.json();

    if (!name || !sessionName) {
      return NextResponse.json(
        { error: 'Band name and session name are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const bandsCollection = db.collection<UserBand>('user_bands');

    // Normalize the band name for duplicate detection
    const normalizedName = name.toLowerCase().trim();

    // Check if band already exists
    const existingBand = await bandsCollection.findOne({
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
    });

    if (existingBand) {
      // Update existing band - add session to addedBy if not already there
      if (!existingBand.addedBy.includes(sessionName)) {
        await bandsCollection.updateOne(
          { _id: existingBand._id },
          {
            $push: { addedBy: sessionName },
            $inc: { addedCount: 1 },
            $set: { updatedAt: new Date() },
          }
        );
      }
      return NextResponse.json({
        band: existingBand,
        alreadyExists: true,
      });
    }

    // Create new band
    const newBand: UserBand = {
      id: uuidv4(),
      name: name.trim(),
      isNewAddition: true,
      addedBy: [sessionName],
      addedCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await bandsCollection.insertOne(newBand);

    return NextResponse.json({
      band: newBand,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('Band creation error:', error);
    return NextResponse.json(
      { error: 'Failed to add band' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = await getDatabase();
    const bandsCollection = db.collection<UserBand>('user_bands');

    // Get all user-added bands, sorted by most added
    const bands = await bandsCollection
      .find({})
      .sort({ addedCount: -1, name: 1 })
      .toArray();

    return NextResponse.json({
      bands,
      count: bands.length,
    });
  } catch (error) {
    console.error('Bands fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bands' },
      { status: 500 }
    );
  }
}
