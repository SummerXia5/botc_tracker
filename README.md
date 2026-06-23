# 🔮 血染钟楼 · 周五狂欢夜数据追踪器

**FRIDAY NIGHT CLOCKTOWER ARENA — Data Tracker & Storyteller Grimoire**

A full-stack web application for tracking Blood on the Clocktower game sessions, running games with a digital grimoire, player statistics, and leaderboards.

## 🏗️ Architecture

```
血染钟楼/
├── server/                # Express.js + SQLite Backend
│   ├── server.js          # Main entry point (serves built frontend in production)
│   ├── db.js              # Database initialization & migrations
│   ├── seed.js            # Data seeding
│   ├── middleware/
│   │   └── auth.js        # JWT authentication middleware
│   └── routes/
│       ├── auth.js        # Register, Login, Me
│       ├── players.js     # CRUD players
│       ├── games.js       # CRUD games with participants + participant updates
│       ├── groups.js      # Group management
│       └── scripts.js     # Script (剧本) management
│
├── client/                # Vite + React Frontend
│   ├── src/
│   │   ├── App.jsx                 # Main orchestrator + routing
│   │   ├── api.js                  # API client with JWT
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── data/
│   │   │   └── characters.js       # Character database (official BotC chars)
│   │   ├── components/
│   │   │   ├── Header.jsx          # Navigation + auth controls
│   │   │   ├── Dashboard.jsx       # Summary stats + charts
│   │   │   ├── HallOfFame.jsx      # Awards & leaderboards
│   │   │   ├── PlayerList.jsx      # Sortable player grid
│   │   │   ├── PlayerCard.jsx      # Individual player card
│   │   │   ├── PlayerModal.jsx     # Player detail modal with radar chart
│   │   │   ├── GameHistory.jsx     # Paginated game records
│   │   │   ├── RecordGameModal.jsx # 4-step game recording wizard
│   │   │   ├── Grimoire.jsx        # 🔮 Digital Storyteller Grimoire
│   │   │   ├── Grimoire.css        # Grimoire styles (37KB+)
│   │   │   ├── AdminPanel.jsx      # Admin: players, games, scripts
│   │   │   ├── GroupSelector.jsx   # Multi-group support
│   │   │   ├── ScriptManagement.jsx # Script import & management
│   │   │   ├── PlayerManagement.jsx # In-grimoire player management
│   │   │   ├── PlayerSelector.jsx  # Player picker for game recording
│   │   │   ├── RadarChart.jsx      # SVG radar chart (5 dimensions)
│   │   │   └── Toast.jsx           # Notification system
│   │   └── utils/
│   │       └── stats.js            # Stats computation engine
│   └── index.html
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ (recommend v20+)

### 1. Start Backend

```bash
cd server
npm install
node server.js
```

Backend starts on **http://localhost:5001** with auto-created SQLite database.

### 2. Start Frontend

```bash
cd client
npm install
npx vite
```

Dev server on **http://localhost:3000** with API proxy.

### 3. First-Time Setup

1. Click **管理员登录** → Register tab → Create admin account
2. After login, unlock admin features: record games, manage players, use grimoire

## 🎯 Features

### 🔮 Digital Grimoire (说书人魔典)
- **Circle Layout**: Players arranged in a circle, mimicking the physical game
- **Role Assignment**: Manual or random character assignment from script
- **Character Distribution**: Configurable +/- per role type (handles Baron, etc.)
- **Reminder Tokens**: Place/remove 备忘标记 (mad, drunk, poisoned, etc.)
- **Custom Reminders**: Add custom text reminder tokens
- **Game Flow**: Setup → Night 1 → Day/Night cycles
- **Alive/Dead Toggle**: Click tokens to mark death (tracks death day)
- **Player Management**: Add/remove players during setup
- **Game Export**: End game → auto-fills RecordGameModal with all data
- **Grimoire Log**: Auto-generated timestamped event log → saved as game notes

### 📊 Data & Stats
- **Dashboard**: Total games, good vs evil win rates, recent games
- **Player Profiles**: Power scores, star ratings, role-specific win rates
- **Radar Charts**: 5-dimension ability visualization (Logic, Acting, Survival, Final Round, Leadership)
- **Hall of Fame**: Awards for MVP, Logic Master, Disguise Master, Survivor, Final Round Expert
- **Game History**: Paginated records with character names, survival status, achievements

### 🎮 Game Recording
- **4-Step Wizard**: Basic info → Select players → Assign roles + stats → Review & submit
- **Per-Player Data**: Role type, character ID, death vote status, final round vote, evil team marker
- **Achievements**: 盘通逻辑线, 完美复盘, 强势带队, 带偏方向, 关键操作, 完美伪装
- **Survival Tracking**: Days survived, alive at end
- **Auto-Prefill**: Grimoire data automatically populates all fields

### 🛠️ Admin Panel
- **Player Management**: Create, edit, delete players with emoji avatars
- **Game Management**: Full edit with participant details (same UI as RecordGameModal)
- **Script Management**: Import custom JSON scripts, manage official scripts
- **Group Support**: Multiple player groups for different game circles

### 📜 Script System
- **Official Scripts**: Pre-loaded BotC scripts
- **Custom Import**: Upload JSON scripts with custom characters
- **Character Metadata**: Name, ability, team, custom images
- **Script-Specific Distribution**: Character pools per script

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register admin (first user only) |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Current user info |
| GET | `/api/players` | ❌ | List all players |
| POST | `/api/players` | ✅ | Create new player |
| PUT | `/api/players/:id` | ✅ | Update player |
| DELETE | `/api/players/:id` | ✅ | Delete player |
| GET | `/api/games?page=1&limit=20` | ❌ | List games (paginated) |
| GET | `/api/games/:id` | ❌ | Single game detail |
| POST | `/api/games` | ✅ | Record new game |
| PUT | `/api/games/:id` | ✅ | Update game + participants |
| DELETE | `/api/games/:id` | ✅ | Delete game |
| GET | `/api/groups` | ❌ | List groups |
| POST | `/api/groups` | ✅ | Create group |
| GET | `/api/scripts?group_id=` | ❌ | List scripts |
| POST | `/api/scripts` | ✅ | Create script |
| GET | `/api/health` | ❌ | Health check |

## 📊 Database Schema

- **Engine**: SQLite (via better-sqlite3)
- **File**: `server/clocktower.db` (auto-created)

| Table | Key Columns |
|-------|------------|
| `users` | id, username, password_hash |
| `groups` | id, name, description, avatar |
| `players` | id, name, avatar, desc, group_id |
| `games` | id, date, script, winner, mvp_player_id, notes, group_id |
| `game_participants` | game_id, player_id, role_type, survived, final_round, correct_vote, character_id, survival_days, achievements, player_notes |
| `scripts` | id, name, group_id, characters, char_meta, is_official |

## 🎨 Design

- Dual theme: Premium parchment light mode + dark mode
- Red/crimson accents with gold highlights
- SVG radar charts (zero chart library dependencies)
- Grimoire uses circular layout with cos/sin positioning
- Smooth animations and micro-interactions
- Responsive design
- Google Font "Inter" typography

## 🚢 Production Deployment

### Single Server (Recommended)

The server serves the built frontend in production:

```bash
cd client && npm install && npx vite build
cd ../server && npm install
NODE_ENV=production JWT_SECRET=your-secret node server.js
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Secret for JWT signing |
| `PORT` | ❌ | Server port (default: 5001) |
| `NODE_ENV` | ❌ | `production` to serve static files |
| `CORS_ORIGINS` | ❌ | Comma-separated allowed origins |

## 📄 License

MIT
