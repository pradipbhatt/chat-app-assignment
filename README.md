# Real-Time WebSocket Chat Room

A chat room where several people join a named room and exchange messages
instantly over a persistent WebSocket connection, with an authenticated
administrator who can moderate what happens in it.

Built for the WebSocket Chat Room Application task from Prof. Yan Chen's PRIME
lab, Computer Science, Virginia Tech.

## Status

| Part | State |
|---|---|
| Server | Complete — 36 automated tests passing |
| React client | Complete — chat, awareness, themes and moderation |
| Deployment | Live |

**Try it:** [pradipchat.vercel.app](https://pradipchat.vercel.app) — open it in two
windows and join the same room in both.

The API runs separately at `chat-room-server-mmdq.onrender.com`. It is on a free
plan that sleeps after 15 minutes of inactivity, so the first request after a
quiet spell takes up to a minute to wake it.

The sections below describe what actually works today.

## What it does

**For someone using it**

- Pick a display name and a room, and start talking — no sign-up
- Start a private room in one tap and share its link; anyone who opens
  `/r/<room>` lands on a join screen for that room with only a name to fill in
- Private rooms are unlisted and unguessable, need a passcode as well as the
  link, keep nothing in the database, and close themselves a few hours later or
  shortly after everyone leaves
- Rooms on the join screen show live occupancy, not a hardcoded list
- Messages arrive instantly in every window in that room
- See who is present, and who is typing
- Every message shows whether it was delivered, with retry if it was not
- History is replayed on join, and older messages page in on demand
- Three themes, dark by default, remembered per browser
- Works down to a 375px phone viewport

**Under that**

## What the server does

**Chat**

- Named rooms, with messages delivered only to the room they were sent in
- Instant broadcast to every client in the room, sender included
- Live roster of who is present, updated on join, leave and disconnect
- Typing indicators that expire on their own if a client vanishes mid-sentence
- Message history stored in MongoDB and replayed to whoever joins next
- Paging back through older messages with a cursor
- Per-message acknowledgement, so a client can show sending / sent / failed

**Moderation**

- One authenticated administrator account, seeded from the environment
- Live view of every connected user and room
- Live server log and status inside the app, streamed over the socket with
  credentials redacted before they are ever buffered
- Kick a user, ban them (per room or everywhere, permanently or for a period),
  delete a single message, or wipe a room's history
- Bans are stored, so they outlive a restart, and expire on their own

**Safeguards**

- Every value from a client is validated; a bad payload is refused, never thrown
- Rate limit of 5 messages per second per user, which reconnecting does not reset
- Socket and JSON payloads capped at 16KB
- Registered account names cannot be claimed by anonymous users
- Roles come only from a verified token, never from anything a client sends

## Architecture

```text
   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │   User A     │        │   User B     │        │    Admin     │
   │   browser    │        │   browser    │        │   browser    │
   └──────┬───────┘        └──────┬───────┘        └──────┬───────┘
          │                       │                       │
          │  WebSocket            │  WebSocket            │  WebSocket + JWT
          └───────────┬───────────┘                       │
                      │                                   │
              ┌───────▼───────────────────────────────────▼───────┐
              │              Node.js  ·  Express  ·  Socket.IO    │
              │                                                   │
              │   handshake auth  →  role on the socket           │
              │   rooms, presence, typing      (in memory)        │
              │   validation, rate limiting                       │
              │   moderation service                              │
              └───────────────────────┬───────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │    MongoDB     │
                              │  messages      │
                              │  users, bans   │
                              └────────────────┘
```

Presence is deliberately in memory: who is online right now is not worth
persisting, and a stale roster after a crash is worse than an empty one.
Messages, accounts and bans go to MongoDB, so they survive a restart.

## Technology

Node.js 20 · Express · Socket.IO · MongoDB with Mongoose · JSON Web Tokens ·
bcrypt · Node's built-in test runner.

The client will be React with Vite and Tailwind CSS.

Socket.IO is used rather than a bare `ws` server. Its default transport is a
real WebSocket — the test suite asserts the negotiated transport is `websocket`
and not the long-polling fallback — and it supplies rooms, acknowledgements and
reconnection, which are the parts of this task worth spending attention on
rather than rebuilding.

## Running it

**Requirements:** Node.js 20 or newer, and a MongoDB connection string
(MongoDB Atlas is fine).

### Server

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env`, then:

```bash
npm run dev
```

It listens on `http://localhost:5050`. Check it with:

```bash
curl http://localhost:5050/health
```

### Client

In a second terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. To see the point of the thing, open it in two
windows and join the same room in both.

### Signing in as an administrator

There are no accounts for chat participants. Moderation needs the account seeded
from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the server's `.env`; use **Admin
sign in** on the join screen. The session is scoped to that browser tab.

### Configuration

| Variable | Purpose |
|---|---|
| `PORT` | Port for both the REST routes and the WebSocket handshake. Defaults to 5050 — **not** 5000, which macOS uses for AirPlay Receiver |
| `CLIENT_URL` | Allowed CORS origin. Accepts a comma-separated list for deployment |
| `MONGODB_URI` | MongoDB connection string, including the database name |
| `HISTORY_LIMIT` | Messages replayed when someone joins a room |
| `MAX_PAYLOAD_BYTES` | Cap on socket and JSON payloads |
| `RATE_LIMIT_CAPACITY` / `RATE_LIMIT_REFILL_PER_SECOND` | Message rate limit |
| `SHUTDOWN_TIMEOUT_MS` | How long a graceful shutdown may take before forcing exit |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | The admin account, re-seeded from these on every boot |

`.env` is git-ignored and never committed. `.env.example` holds placeholders
only.

## Tests

```bash
cd server
npm test
```

27 tests across two files. They spawn a real server, talk to it as real
clients, run against their own `chatapp_test` and `chatapp_admin_test`
databases, and drop those databases afterwards, so application data is never
touched.

- `test/server.test.js` — transport, rooms, isolation, roster, typing,
  validation, rate limiting, history, pagination, REST routes, shutdown
- `test/admin.test.js` — login, forged and missing tokens, privilege escalation
  attempts, reserved account names, kick, ban and rejoin, message deletion,
  room clearing, login rate limiting

## Socket events

**Client to server** — every one answers through an acknowledgement of
`{ ok: true, ... }` or `{ ok: false, code, message }`.

| Event | Payload |
|---|---|
| `room:join` | `{ username, room }` |
| `message:send` | `{ text }` |
| `messages:load` | `{ limit, before }` |
| `typing:start` / `typing:stop` | — |
| `room:leave` | — |
| `admin:overview` | — |
| `admin:kick` | `{ username, room, reason }` |
| `admin:ban` | `{ username, room, reason, minutes }` |
| `admin:unban` | `{ id }` |
| `admin:bans` | — |
| `admin:delete-message` | `{ id }` |
| `admin:clear-room` | `{ room }` |

**Server to client**

| Event | Payload |
|---|---|
| `room:joined` | `{ room, username, role, users[], history[], hasMore }` |
| `message:new` | `{ id, username, text, ts, system }` |
| `message:deleted` | `{ id, by }` |
| `room:users` | `{ users: [{ username, role }] }` |
| `room:cleared` | `{ room, by }` |
| `typing:start` / `typing:stop` | `{ username }` |
| `moderation:kicked` | `{ reason, by }` |
| `error:app` | `{ code, message }` |

Message `id` and `ts` are always assigned by the server. A client's clock never
decides the order a room sees.

## REST API

| Route | Access | Purpose |
|---|---|---|
| `GET /health` | public | status, uptime, database state, counts |
| `GET /api/rooms` | public | active rooms with occupancy, then rooms with only history |
| `GET /api/rooms/:room/messages?limit=&before=` | public | a page of history |
| `POST /api/auth/login` | public | returns a token and the account |
| `GET /api/auth/me` | token | the current account |
| `GET /api/admin/overview` | admin | live rooms and users |
| `POST /api/admin/kick` | admin | disconnect a user |
| `POST /api/admin/ban` | admin | ban a user |
| `GET /api/admin/bans` · `DELETE /api/admin/bans/:id` | admin | list and lift bans |
| `DELETE /api/admin/messages/:id` | admin | delete one message |
| `POST /api/admin/rooms/:room/clear` | admin | wipe a room's history |

## Roles

Two roles, `user` and `admin`.

Regular users stay anonymous: type a name, join. Requiring registration would
break the join flow the task is about, so identity for participants is
deliberately light.

An administrator is a real account with a bcrypt-hashed password. Signing in
returns a token, sent as `Authorization: Bearer` on REST and as
`socket.handshake.auth.token` on the socket. The role is derived from that token
in a single place — the handshake middleware — and stored on the socket. Nothing
a client puts in a message payload can change it, and a test asserts that.

**Known limitations, stated rather than hidden:**

- A ban is on a name, not a person. Anonymous users can return under a new name.
  Preventing that means accounts for everyone, which is out of scope here.
- A role is resolved once at the handshake, so a token expiring mid-session
  keeps its role until the socket reconnects.
- There is no token revocation; signing out is the client discarding the token.

## Project structure

```text
.
├── docs/
│   ├── DECISIONS.md            assumptions, trade-offs, known limitations
│   ├── SERVER-PLAN.md          decisions, event contract, rationale
│   ├── CLIENT-PLAN.md          React structure
│   ├── CLIENT-SPRINT.md        build order and checkpoints
│   ├── FRONTEND-CONVENTIONS.md theming and component rules
│   ├── VIDEO.md                walkthrough plan
│   └── INSTRUCTIONS.md         the task as received
├── client/
│   ├── index.html              pre-paint theme script
│   ├── tailwind.config.js      semantic colour tokens
│   └── src/
│       ├── context/            theme, auth and chat providers
│       ├── components/         message list, composer, roster, admin panel
│       ├── pages/              join and chat
│       ├── hooks/              rooms, admin actions, auto scroll
│       ├── lib/                socket, api, validation, formatting
│       └── styles/             theme token definitions
└── server/
    ├── src/
    │   ├── server.js           entry: database, http server, socket server
    │   ├── app.js              express app and route mounting
    │   ├── config/             environment and database connection
    │   ├── models/             Message, User, Ban
    │   ├── routes/             health, auth, admin, rooms, messages
    │   ├── middleware/         token authentication and role guards
    │   ├── services/           moderation actions shared by REST and socket
    │   ├── socket/             handshake auth, handlers, presence, rate limit
    │   └── utils/              validation and tokens
    └── test/                   server and admin test suites
```

Source carries no comments by choice; the reasoning that would sit in them
lives in `docs/SERVER-PLAN.md` and `docs/DECISIONS.md`, where it can be read as
a whole.

## Theming

Colours are never written into components. `client/src/styles/themes.css` holds
raw RGB channel values per theme, `tailwind.config.js` registers the semantic
names, and components use only those names — `bg-surface`, `text-fg-muted`,
`border-border`. Adding a theme means adding one block of values and one entry
to a list; no component changes. A stray `bg-zinc-800` would be a light-mode bug
that no theme switch could fix, so there are none.

## Deployment

The client is on Vercel and the server on Render; a static host cannot hold
WebSocket connections, so the two halves deploy separately and reference each
other by URL. `render.yaml` and `client/vercel.json` carry the configuration,
and `docs/DEPLOYMENT.md` has the full walkthrough.

## Remaining work

1. Video walkthrough — planned in `docs/VIDEO.md`

## Author

**Pradip Bhatt** — B.E. Computer Engineering, Far Western University, Nepal

[Portfolio](https://www.pradipbhatt.com.np) ·
[GitHub](https://github.com/pradipbhatt) ·
[LinkedIn](https://www.linkedin.com/in/pradipbhatt2126/)
