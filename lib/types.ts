import { Band } from './bands';
import { RankedBand } from './scoring';

export interface VotingSession {
  _id?: string;
  sessionName: string;
  currentRound: 'round1' | 'round2' | 'round3' | 'round4' | 'results';
  isAdmin: boolean;
  round1Bands: Band[]; // User's ranked Billboard top 50
  round2MissingBands: string[]; // Just band names submitted by user
  round3Votes: MissingBandVote[]; // User's votes for missing band rankings
  allBands: Band[]; // Combined final list (for admin Round 4)
  knockedOutBands: KnockedOutBand[]; // Bands removed in admin insertion
  finalRankings: RankedBand[];
  createdAt: Date;
  updatedAt: Date;
  completed: boolean;
}

export interface MissingBand {
  _id?: string;
  id: string;
  name: string;
  submittedBy: string[]; // Session names that submitted this band
  addedCount: number; // How many users submitted this
  finalRank?: number; // Final collaborative ranking
  createdAt: Date;
}

export interface MissingBandVote {
  _id?: string;
  sessionName: string;
  bandId: string;
  rank: number; // User's vote for this band's position
  createdAt: Date;
}

export interface KnockedOutBand {
  bandId: string;
  bandName: string;
  originalPosition: number;
  knockedOutBy: string; // ID of missing band that replaced it
  knockedOutByName: string;
}

export interface CollaborativeRanking {
  bandId: string;
  bandName: string;
  totalScore: number;
  voteCount: number;
  averageRank: number;
  finalPosition: number;
}
