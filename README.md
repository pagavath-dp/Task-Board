# task/board

A real-time collaborative Kanban board with JWT authentication, private personal boards, and team boards joined via an 8-character invite code. Built with Node.js, Socket.io, and PostgreSQL.

**Live demo:** https://task-board-production-fc2c.up.railway.app

---

## Features

- **JWT Authentication** — register, login, persistent sessions via localStorage
- **Personal Board** — private task space visible only to you
- **Team Boards** — create a team, get an 8-character invite code, share it with teammates
- **Real-time sync** — drag a card in one tab, it moves instantly in every other connected tab (Socket.io rooms scoped per board)
- **Full CRUD** — create, edit, delete tasks with title, description, and status
- **Drag and drop** — move tasks across To Do / In Progress / Done columns
- **Board selection page** — choose between personal board or any team board after login
- **Dark themed UI** — built with Tailwind CSS, Space Grotesk + JetBrains Mono typography

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5, Socket.io 4 |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Frontend | Vanilla JS, Tailwind CSS (CDN) |
| Fonts | Space Grotesk, Inter, JetBrains Mono |

---

## Project Structure

```
task-board/
├── backend/
│   ├── index.js              # Entry point, Express + Socket.io setup
│   ├── db.js                 # PostgreSQL connection pool
│   ├── auth.js               # JWT middleware + socket token verifier
│   ├── socketHandler.js      # Socket.io rooms and real-time event broadcasting
│   └── routes/
│       ├── authRoutes.js     # POST /api/auth/register, /api/auth/login
│       ├── taskRoutes.js     # CRUD /api/tasks — scoped to personal or team
│       └── teamRoutes.js     # CRUD /api/teams — create, join, leave
├── frontend/
│   ├── index.html            # Login / Register page
│   ├── boardSelection.html   # Board picker — personal, join team, create team
│   ├── board.html            # Kanban board
│   ├── boardSelection.js     # Board selection logic
│   ├── app.js                # Board logic — tasks, drag-drop, socket events
│   └── style.css             # Custom styles (cards, drag states, ticket accent)
├── schema.sql                # Full PostgreSQL schema
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+

### 1. Clone the repo

```bash
git clone https://github.com/pagavath-dp/Task-Board.git
cd Task-Board
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/taskboard
JWT_SECRET=your_secret_key_here
```

### 4. Set up the database

```bash
psql -U your_user -d postgres -c "CREATE DATABASE taskboard;"
psql -U your_user -d taskboard -f schema.sql
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

### Auth flow
Register or log in → JWT stored in localStorage → all API requests and Socket.io connections authenticated via Bearer token.

### Board scoping
After login, users land on `boardSelection.html` where they can open their personal board, create a team (generates an 8-char invite code), or join an existing team via code.

Personal tasks are scoped by `created_by` with `team_id IS NULL` in the DB — completely invisible to other users. Team tasks are scoped by `team_id` with membership verified server-side on every request.

### Real-time sync
Socket.io rooms isolate broadcasts per board — `user:<id>` for personal boards, `team:<id>` for team boards. When a task is created, updated, or deleted, the event only reaches clients in the same room.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks?team_id=X` | Get tasks (personal if no team_id) |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

### Teams
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/teams` | List teams user belongs to |
| POST | `/api/teams` | Create team |
| POST | `/api/teams/join` | Join team via code |
| DELETE | `/api/teams/:id/leave` | Leave a team |

---

## Known Limitations

- Touch/mobile drag-and-drop not supported (HTML5 drag API is desktop only)
- No "delete team" — only leave; orphaned teams persist if all members leave
- Last-write-wins on concurrent edits to the same task — no conflict resolution
- No assigned-to feature yet (schema column exists, not yet surfaced in UI)

---

## Author

**Pagavath D P**
[github.com/pagavath-dp](https://github.com/pagavath-dp)
