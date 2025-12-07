# Rock Band Ranked Choice Voting

A Next.js web application for reranking the greatest rock bands of all time using a weighted ranked choice voting system.

## Features

### Three-Round Voting System

1. **Round 1: Rerank Billboard's Top 50**
   - Drag and drop to reorder Billboard's original list
   - See real-time point calculations based on position

2. **Round 2: Add Missing Bands**
   - Add bands you think should be on the list
   - Rank your additions

3. **Round 3: Final Ranking**
   - Rank all bands together (original 50 + your additions)
   - New additions are highlighted in green

### Weighted Scoring System

Uses a modified Borda Count with top-heavy weighting:

- **Positions 1-10**: Each rank = 5 points apart (1st=500, 10th=455)
- **Positions 11-30**: Each rank = 2 points apart
- **Positions 31+**: Each rank = 1 point apart

This ensures the top 10 positions carry significantly more weight while still giving every position value.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build

```bash
npm run build
npm start
```

## Deployment

### Deploy to Vercel

The easiest way to deploy is using the Vercel platform:

1. Push your code to GitHub
2. Import your repository to Vercel
3. Vercel will automatically detect Next.js and deploy

Or use the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit
- **Deployment**: Vercel

## How It Works

1. Users go through three rounds of ranking
2. Each position is assigned points based on the weighted scoring system
3. Final rankings are calculated by aggregating all votes
4. Results show each band's position and total score

## License

ISC
