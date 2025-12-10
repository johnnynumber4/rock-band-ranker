import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const db = await getDatabase();

    // Check both collections for duplicates
    const results = {
      userBandsDuplicates: [] as any[],
      missingBandsDuplicates: [] as any[]
    };

    // Check user_bands collection
    const userBands = db.collection('user_bands');
    const userBandsDuplicates = await userBands.aggregate([
      {
        $group: {
          _id: '$id',
          count: { $sum: 1 },
          documents: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    results.userBandsDuplicates = userBandsDuplicates;

    // Check missing_bands collection
    const missingBands = db.collection('missing_bands');
    const missingBandsDuplicates = await missingBands.aggregate([
      {
        $group: {
          _id: '$id',
          count: { $sum: 1 },
          documents: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    results.missingBandsDuplicates = missingBandsDuplicates;

    return NextResponse.json({
      duplicatesFound: results.userBandsDuplicates.length + results.missingBandsDuplicates.length,
      results
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    return NextResponse.json(
      { error: 'Failed to check for duplicates' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const db = await getDatabase();
    let cleanedCount = 0;

    // Clean user_bands duplicates
    const userBands = db.collection('user_bands');
    const userBandsDuplicates = await userBands.aggregate([
      {
        $group: {
          _id: '$id',
          count: { $sum: 1 },
          documents: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    for (const duplicate of userBandsDuplicates) {
      // Keep the first document, remove the rest
      const documentsToRemove = duplicate.documents.slice(1);
      for (const doc of documentsToRemove) {
        await userBands.deleteOne({ _id: doc._id });
        cleanedCount++;
      }
    }

    // Clean missing_bands duplicates
    const missingBands = db.collection('missing_bands');
    const missingBandsDuplicates = await missingBands.aggregate([
      {
        $group: {
          _id: '$id',
          count: { $sum: 1 },
          documents: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    for (const duplicate of missingBandsDuplicates) {
      // Keep the first document, remove the rest
      const documentsToRemove = duplicate.documents.slice(1);
      for (const doc of documentsToRemove) {
        await missingBands.deleteOne({ _id: doc._id });
        cleanedCount++;
      }
    }

    return NextResponse.json({
      message: `Cleaned up ${cleanedCount} duplicate records`,
      cleanedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates' },
      { status: 500 }
    );
  }
}