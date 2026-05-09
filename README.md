# 400 UNO — Full Stack Card Game

A real-time 4-player trick-taking card game with UNO-style visuals.

---

## 🏗️ Project Structure

```
400uno/
├── backend/          ← Node.js + Socket.io server
│   ├── server.js
│   ├── gameLogic.js
│   ├── package.json
│   └── render.yaml
└── frontend/         ← HTML/CSS/JS client
    ├── index.html
    └── netlify.toml
```

---

## 🚀 DEPLOYMENT

### Step 1 — Deploy Backend to Render

1. Push the **`backend/`** folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Deploy — note your public URL (e.g. `https://400uno-backend.onrender.com`)

### Step 2 — Set Backend URL in Frontend

Open `frontend/index.html` and find:
```js
const BACKEND_URL = window.BACKEND_URL || 'http://localhost:3001';
```

Replace `http://localhost:3001` with your Render URL.

### Step 3 — Deploy Frontend to Netlify

1. Push the **`frontend/`** folder to a GitHub repo (or drag-drop to Netlify)
2. Go to [netlify.com](https://netlify.com) → New Site from Git
3. Connect your repo
4. Build settings: none needed (static HTML)
5. Deploy!

---

## 🎮 HOW TO PLAY

1. Open the Netlify URL in a browser
2. Enter your name → **Create New Room** → share the 5-letter code
3. Each of the 4 friends enters the code → **Join Room**
4. Host (first player) clicks **Start Game**
5. All 4 players bid, then play 13 tricks!

---

## 🃏 GAME RULES SUMMARY

| Rule | Details |
|------|---------|
| Trump | ♥ Hearts always — fixed, no choice |
| Follow suit | MUST play same suit if you have it |
| Bid 2 | Need 2 tricks → +2 pts if made |
| Bid 3 | Need 3 tricks → +3 pts if made |
| Bid 4 | Need 4 tricks → +4 pts if made |
| Bid 10 | Need 5 tricks → +10 pts if made |
| Bid 12 | Need 6 tricks → +12 pts if made |
| Fail | Lose full bid value (negative score) |
| Overtricks | Ignored — only success/fail matters |
| Visibility | You + teammate see each other's hands |

### UNO Card Colors
- ♥ Hearts → **Red** cards
- ♦ Diamonds → **Green** cards
- ♣ Clubs → **Blue** cards
- ♠ Spades → **Yellow** cards

### Card Center Icons
- **Ace** → `1` (like UNO)
- **King** → `⊘` (skip icon)
- **Queen** → `+2` (draw icon)
- **Jack** → `↺` (reverse icon)

---

## 🛠️ LOCAL DEV

```bash
# Backend
cd backend
npm install
npm run dev    # runs on port 3001

# Frontend
# Just open frontend/index.html in browser
# (make sure BACKEND_URL points to localhost:3001)
```

---

## ⚙️ ENVIRONMENT VARIABLES

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |

The frontend uses `window.BACKEND_URL` — set it via a `_redirects` file or Netlify env variable if needed.
