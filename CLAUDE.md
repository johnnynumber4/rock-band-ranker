# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
- `npm run dev` - Start development server on port 3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run Next.js linter

## Architecture Overview

This is a **Next.js 14+ App Router** application implementing a rock band ranking system with a multi-round voting process.

### Core Voting Flow
The application implements a **4-round collaborative voting system**:

1. **Round 1**: Individual ranking of Billboard's top 50 bands via drag-and-drop
2. **Round 2**: Submit missing bands (collection only, no ranking)
3. **Round 3**: Collaborative voting on missing bands rankings (all users vote)
4. **Round 4**: Admin-only insertion round (drag missing bands into Billboard top 50, tracking knockouts)
5. **Results**: Display final collaborative rankings

### Scoring System
Uses a **modified Borda Count** with top-heavy weighting (lib/scoring.ts:8-21):
- Positions 1-10: 5 points apart (1st=500, 10th=455)
- Positions 11-30: 2 points apart
- Positions 31+: 1 point apart

### Key Architecture Components

**Frontend (app/page.tsx):**
- Single-page application with round-based state management
- Uses @dnd-kit for drag-and-drop functionality
- Session-based persistence with auto-save (every 1 second)
- MusicBrainz API integration for artist search

**Backend API Routes:**
- `/api/sessions` - Session CRUD operations (create/load/save)
- `/api/bands` - Legacy band management (still used by admin page)
- `/api/missing-bands` - Missing bands collection and management
- `/api/missing-bands/votes` - Collaborative voting on missing bands
- `/api/search/artists` - MusicBrainz artist search proxy
- `/api/sessions/added-bands` - Legacy aggregation (still used by admin)
- `/api/sessions/aggregate` - Calculate final aggregated results

**Data Models (lib/types.ts):**
- `VotingSession` - Contains user voting data with new structure (round2MissingBands, round3Votes, isAdmin, knockedOutBands)
- `Band` - Individual band with ID, name, and new addition flag
- `RankedBand` - Band with position and calculated score
- `MissingBand` - Global missing bands with submission tracking
- `MissingBandVote` - Individual user votes for missing band rankings
- `CollaborativeRanking` - Aggregated collaborative rankings
- `KnockedOutBand` - Tracks bands removed in admin insertion round

**Database Integration:**
- MongoDB connection via lib/mongodb.ts
- Sessions auto-save on state changes
- `missing_bands` collection: Global unique missing bands with submission tracking
- `missing_band_votes` collection: User votes for collaborative ranking
- Legacy `user_bands` collection: Still used by admin aggregation page

### Styling
- **Tailwind CSS** with custom Spotify-inspired color palette (tailwind.config.ts)
- Responsive design with mobile-first approach
- Custom drag-and-drop styling with visual feedback

### State Management
- React useState for all application state
- Real-time scoring calculations using useMemo (only for Rounds 1 & 3)
- Auto-save debouncing to prevent excessive API calls
- Admin authentication via session name ("admin" = admin user)
- Round-specific state: round2MissingBands (strings), round3MissingBands (Band objects)

## Important Files
- `lib/bands.ts` - Billboard top 50 seed data
- `lib/scoring.ts` - Core scoring algorithm
- `components/SortableBandList.tsx` - Drag-and-drop list component
- `app/admin/page.tsx` - Administrative results aggregation view