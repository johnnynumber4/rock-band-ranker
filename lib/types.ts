import { Band } from './bands';
import { RankedBand } from './scoring';

export interface VotingSession {
  _id?: string;
  sessionName: string;
  currentRound: 'round1' | 'round2' | 'round3' | 'round4' | 'results';
  round1Bands: Band[];
  round2Bands: Band[];
  round3Bands: Band[];
  allBands: Band[];
  finalRankings: RankedBand[];
  createdAt: Date;
  updatedAt: Date;
  completed: boolean;
}
