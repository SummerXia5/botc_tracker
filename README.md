# 🔮 血染钟楼 · 周五狂欢夜数据追踪器

**FRIDAY NIGHT CLOCKTOWER ARENA — Data Tracker**

A full-stack web application for tracking Blood on the Clocktower game sessions, player statistics, and leaderboards.

## 🏗️ Architecture

```
血染钟楼/
├── server/          # Express.js + SQLite Backend
│   ├── server.js    # Main entry point
│   ├── db.js        # Database initialization
│   ├── seed.js      # Data seeding (12 players + 45 games)
│   ├── middleware/
│   │   └── auth.js  # JWT authentication middleware
│   └── routes/
│       ├── auth.js    # Register, Login, Me
│       ├── players.js # CRUD players
│       └── games.js   # CRUD games with participants
│
├── client/          # Vite + React Frontend
│   ├── src/
│   │   ├── App.jsx           # Main orchestrator
│   │   ├── api.js            # API client with JWT
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/       # 12 UI components
│   │   │   ├── Header.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HallOfFame.jsx
│   │   │   ├── PlayerList.jsx
│   │   │   ├── PlayerCard.jsx
│   │   │   ├── PlayerModal.jsx   # With SVG Radar Chart
│   │   │   ├── GameHistory.jsx
│   │   │   ├── RecordGameModal.jsx
│   │   │   ├── AddPlayerModal.jsx
│   │   │   ├── LoginModal.jsx
│   │   │   ├── RadarChart.jsx
│   │   │   └── Toast.jsx
│   │   └── utils/
│   │       └── stats.js      # Stats computation engine
│   └── index.html
│
└── README.md
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js** v18+ (recommend v20+)

### 1. Start Backend

```bash
cd server
npm install
node server.js
```

The server will:
- Create SQLite database automatically
- Seed 12 initial players and 45 mock games
- Start listening on **http://localhost:5001**

### 2. Start Frontend

```bash
cd client
npm install
npx vite
```

The Vite dev server starts on **http://localhost:3000** with API proxy to the backend.

### 3. Open the App

Visit **http://localhost:3000** in your browser.

## 🔑 First-Time Setup

1. Click the **管理员登录** (Admin Login) button in the header
2. Switch to the **注册** (Register) tab
3. Create your admin account (first registration only — subsequent registrations are blocked)
4. After logging in, you'll see **新玩家** and **记录赛果** buttons

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register admin (first user only) |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Current user info |
| GET | `/api/players` | ❌ | List all players |
| POST | `/api/players` | ✅ | Create new player |
| GET | `/api/games?page=1&limit=20` | ❌ | List games (paginated) |
| GET | `/api/games/:id` | ❌ | Single game detail |
| POST | `/api/games` | ✅ | Record new game |
| GET | `/api/health` | ❌ | Health check |

## 🎯 Features

### For Everyone (Guest)
- 📊 **Data Dashboard** — Total games, good vs evil win rates, recent games
- 🏆 **Hall of Fame** — Awards for MVP, Logic Master, Best Actor, Survivor, Voter
- 👥 **Player Profiles** — Sortable player list with power scores, star ratings
- 📈 **Radar Charts** — 5-dimension player ability visualization
- 📜 **Game History** — Paginated game records with participant details

### For Admins (Logged In)
- ➕ **Add New Players** — With emoji avatar picker
- 🎮 **Record Game Results** — 4-step wizard for match recording
- 🔒 **JWT Authentication** — Secure 7-day tokens

## 🎨 Design

- Premium dark theme with glassmorphism effects
- Red/crimson + purple accent gradients
- Gold/amber highlights for rankings
- SVG radar charts (zero chart library dependencies)
- Smooth animations and micro-interactions
- Mobile-first responsive design
- Google Font "Inter" typography

## 🚢 Production Deployment

### Option A: Render

1. Push code to GitHub
2. Create a **Web Service** on [Render](https://render.com)
3. Set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**:
     - `JWT_SECRET` = (generate a strong secret)
     - `PORT` = `10000` (Render default)
     - `NODE_ENV` = `production`
     - `CORS_ORIGINS` = `https://your-frontend.onrender.com`
4. For the frontend, create a **Static Site**:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npx vite build`
   - **Publish Directory**: `dist`
   - Set `VITE_API_URL` = `https://your-backend.onrender.com`

### Option B: Railway

1. Push to GitHub
2. Create project on [Railway](https://railway.app)
3. Add backend service (server directory) and set env vars
4. Add frontend service (client directory) with build commands
5. Railway auto-detects Node.js and handles the rest

### Option C: Single Server (Serve Frontend from Express)

Add to `server.js` for production:
```js
import path from 'path';
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../client/dist/index.html'));
  });
}
```

Build frontend: `cd client && npx vite build`

## 📊 Database

- **Engine**: SQLite (via better-sqlite3)
- **File**: `server/clocktower.db` (auto-created)
- **Tables**: users, players, games, game_participants
- **Seed Data**: 12 players + 45 deterministic mock games (mulberry32 PRNG, seed 42)

## 📄 License

MIT
