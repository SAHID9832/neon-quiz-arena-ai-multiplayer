# Neon Quiz Arena — AI Multiplayer Showdown

A browser-based 2–8 player quiz game inspired by modern live quiz-show lobby experiences. It uses original branding and UI while providing a familiar flow: create a game, share a room code, join, answer timed multiple-choice questions, and compete on a live leaderboard.

## Features
- 2–8 real-time players with Socket.IO
- 6-character room codes
- Host-controlled game start
- AI-generated 10-question quizzes by topic using the OpenAI Responses API
- Safe fallback question banks when no API key is configured
- 15-second question timer
- Speed + correctness + streak scoring
- Live leaderboard
- Explanations after answers
- Final ranking and replay-to-lobby flow
- Responsive UI inspired by the supplied reference screenshot, but with original branding/assets

## Run locally

1. Install Node.js 18+.
2. Open this folder in VS Code.
3. Run:

```powershell
npm install
npm start
```

4. Open `http://localhost:3000`.
5. Open a second browser/incognito window and join the same room to test multiplayer.

## Enable AI question generation

Copy `.env.example` to `.env` and set:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-6-luna
```

Never commit `.env` to GitHub. The server calls the OpenAI Responses API; the browser never receives the API key.

## Deployment

Render can use:
- Build: `npm install`
- Start: `npm start`
- Environment: `OPENAI_API_KEY`, `OPENAI_MODEL`

The included `render.yaml` can be used as a starting point.
