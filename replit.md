# Chinese Flashcards

A flashcard learning app for two kids (小潔/sophie and 文文/joyce) to practice Chinese vocabulary.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (port 5000)
- **Backend**: Express.js API server (port 3001)
- **Database**: PostgreSQL (Replit managed)
- **Cards source**: Google Sheets CSV

## Running the App

Two workflows run simultaneously:
1. **Backend API** — `node server.js` on port 3001
2. **Start application** — `npm run dev` (Vite) on port 5000

Vite proxies all `/api/*` requests to the backend at port 3001.

## Database Schema

### `mastered_cards`
Tracks which flashcards each kid has mastered (persists across sessions).
- `id` SERIAL PRIMARY KEY
- `kid` VARCHAR(50) — "sophie" or "joyce"
- `simplified` VARCHAR(100) — the Chinese simplified character(s)
- `unit_number` VARCHAR(20)
- `mastered_at` TIMESTAMP
- UNIQUE(kid, simplified)

### `completed_lessons`
Tracks which units/lessons each kid has fully completed.
- `id` SERIAL PRIMARY KEY
- `kid` VARCHAR(50)
- `unit_number` VARCHAR(20)
- `unit_name` VARCHAR(200)
- `completed_at` TIMESTAMP
- UNIQUE(kid, unit_number)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/progress/:kid` | Full progress summary (mastered cards + completed lessons) |
| GET | `/api/mastered/:kid` | All mastered cards for a kid |
| POST | `/api/mastered` | Mark a card as mastered |
| DELETE | `/api/mastered` | Unmark a card (or clear all for a kid) |
| GET | `/api/lessons/:kid` | All completed lessons for a kid |
| POST | `/api/lessons` | Mark a lesson as completed |
| DELETE | `/api/lessons` | Unmark a lesson (or clear all for a kid) |

## Key Features

- Two kid profiles: 小潔 (sophie) and 文文 (joyce)
- Cards loaded from Google Sheets CSV
- Unit/lesson filtering
- Mastery tracking — saved to DB, persists across sessions
- Lesson completion auto-detected when all cards in a unit are mastered
- Timed game mode with leaderboard (localStorage)
- Keyboard shortcuts: Arrow keys to navigate, Space to flip
