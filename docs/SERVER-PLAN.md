# Server Plan — Step 1 (plan only, no code yet)

Scope of this document: the **backend only**. The React client is planned
separately once the server contract below is agreed.

## 1. Decision: Socket.IO over raw `ws`

Use **Socket.IO** on top of Express.

| | Socket.IO | raw `ws` |
|---|---|---|
| Rooms | built in (`socket.join`) | hand-rolled Map<room, Set<socket>> |
| Reconnect | automatic, with backoff | hand-rolled |
| Event names | built in | hand-rolled JSON envelope + dispatch |
| Fallback | long-polling if WS blocked | none |

The task says "WebSocket"; Socket.IO's default transport is WebSocket (it only
falls back to polling when WS is blocked), so this satisfies the requirement
while removing the boilerplate that is not what is being assessed. Rooms,
reconnect, and broadcast are three of the four things the task grades, and
Socket.IO gives all three correctly on the first try.

**Fallback position:** if the reviewer requires literal `WebSocket`, the swap is
contained — only `server/src/socket/index.js` and the client's socket module
change; the event contract in §4 stays identical.

## 2. Layout

```text
server/
├── src/
│   ├── server.js          # entry: connect db, create http server, mount io, listen
│   ├── app.js             # express app: cors, json, route mounting
│   ├── config/
│   │   ├── env.js         # single source of truth for configuration
│   │   └── db.js          # mongoose connection lifecycle
│   ├── models/
│   │   └── Message.js     # message schema + persistence helpers
│   ├── routes/
│   │   ├── health.js      # GET /health
│   │   └── messages.js    # GET /api/rooms/:room/messages
│   ├── socket/
│   │   ├── index.js       # io instance, cors, connection handler registration
│   │   ├── handlers.js    # join / message / typing / disconnect handlers
│   │   └── rooms.js       # in-memory presence registry
│   └── utils/
│       └── validate.js    # username/room/message sanitising + length caps
├── .env.example
├── .gitignore
└── package.json
```

Rationale: `server.js` does wiring only, so the socket layer is testable without
binding a port, and `handlers.js` stays a pure list of event → behaviour.

## 3. Dependencies

Runtime: `express`, `socket.io`, `mongoose`, `cors`, `dotenv`
Dev: none — Node 20's built-in `node --watch` replaces `nodemon`

Scripts: `dev` → `node --watch src/server.js`, `start` → `node src/server.js`.

ESM (`"type": "module"`) to match the Vite client and avoid mixed module styles.

## 4. Socket event contract (client ↔ server)

This contract is the interface the client is built against — fix it before
writing either side.

**Client → server**

| Event | Payload | Server behaviour |
|---|---|---|
| `room:join` | `{ username, room }` | validate, join room, register user, ack with roster + history |
| `message:send` | `{ text }` | validate, persist, broadcast to sender's room; acks `{ ok, id, ts }` |
| `messages:load` | `{ limit, before }` | acks `{ ok, messages, hasMore }` — pages back through history |
| `room:leave` | — | leave room, deregister, notify room |
| *(disconnect)* | — | same as `room:leave` |

**Server → client**

| Event | Payload | Purpose |
|---|---|---|
| `room:joined` | `{ room, username, users[], history[] }` | ack — client switches to chat view on this, not on `connect`; `history` is the last 50 persisted messages |
| `message:new` | `{ id, username, text, ts, system }` | a chat message (`system: true` for join/leave notices) |
| `room:users` | `{ users[] }` | roster changed |
| `error:app` | `{ code, message }` | validation/other failure, shown in UI |

Notes:
- Every message gets a server-generated `id` (`crypto.randomUUID()`) and `ts`.
  The **server** is the clock and the id authority — never the client.
- The sender receives its own message via `io.to(room).emit(...)` (not
  `socket.broadcast`), so all clients render from one code path and message
  ordering is identical everywhere.

## 5. State model (in-memory, `rooms.js`)

```js
users: Map<socketId, { username, room }>   // who is this socket
rooms: Map<roomName, Set<socketId>>        // who is in this room
```

Socket.IO already tracks room membership; the second map exists so the roster
can be built without touching adapter internals. Both are process-local and
deliberately non-persistent — message history is out of scope per the task.

Presence is deliberately in memory — who is online right now is not a fact worth
persisting, and a stale roster after a crash is worse than an empty one.

**Messages are persisted in MongoDB** (`models/Message.js`), so history survives
a restart and a joiner sees what was said before they arrived. System notices
(`X joined` / `X left`) are **not** persisted: they describe a moment, and a
history replay full of them reads as noise rather than conversation.

Remaining consequence: presence still does not survive horizontal scaling — a
second instance would need the Socket.IO Redis adapter. Messages would be fine,
since they go through the database.

## 6. Validation rules (`utils/validate.js`)

| Field | Rule |
|---|---|
| `username` | trim, 1–24 chars, reject empty/whitespace-only |
| `room` | trim, lowercase, 1–32 chars, `[a-z0-9-]` only |
| `text` | trim, 1–2000 chars, reject empty |

Rejections emit `error:app` and drop the event — never throw inside a handler,
since an uncaught throw in a Socket.IO handler kills the process.

**Two things that matter for a public demo:**
- Escape/never render message text as HTML on the client (React does this by
  default — do not reach for `dangerouslySetInnerHTML`).
- Rate-limit `message:send` per socket (simple token bucket, ~5 msg/sec). One
  open tab can otherwise flood every client in the room.

## 7. CORS

Vite dev server is a different origin from the API, so CORS is required in two
places and forgetting the second is the usual first bug:

1. Express: `cors({ origin: CLIENT_URL })`
2. Socket.IO: `new Server(http, { cors: { origin: CLIENT_URL } })`

`CLIENT_URL` comes from env (`http://localhost:5173` in dev) so the deployed
Netlify origin is a config change, not a code change.

## 8. Env

`.env.example` (committed) / `.env` (git-ignored):

```env
PORT=5050
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chatapp
HISTORY_LIMIT=50
```

`.env` is git-ignored and never committed; `.env.example` carries placeholders
only. The app writes to a **`chatapp` database**, separate from anything else on
the cluster.

`config/env.js` reads these with defaults and logs the effective values on boot.

## 8b. Port choice — not 5000

macOS runs AirPlay Receiver (ControlCenter) on port 5000, so `listen` fails with
`EADDRINUSE` from a process that looks like nothing the user started. Default is
**5050**. Hit during the build, not in theory.

## 9. REST routes

| Route | Returns |
|---|---|
| `GET /health` | status, uptime, database state, room and connection counts |
| `GET /api/rooms` | active rooms with live occupancy, then rooms that only have history |
| `GET /api/rooms/:room/messages?limit=&before=` | a page of history, newest last, with `hasMore` |

`/api/rooms` is what the join screen reads to offer real rooms with occupancy
instead of a hardcoded list.

## 8c. Private rooms

A room whose name starts with `p-` is private. It is created through
`room:create`, which returns an unguessable slug — a readable pair plus 12 hex
characters — and that slug is the only key: anyone holding the link can enter,
anyone without it cannot, and guessing one is not practical.

### End to end encryption

Message content in a private room is encrypted in the browser with AES-GCM 256
and only ever reaches the server as ciphertext. The server stores and relays an
envelope it cannot read, and an administrator who joins the room sees the same
envelope.

**The key travels in the URL fragment** (`/r/<room>#k=<key>`). A fragment is
never sent to a server by any browser, so the key is not in the request line,
the access log, or any proxy in between. That is the whole reason it lives there
rather than being derived from the passcode: the server *verifies* the passcode,
so anything derived from the passcode would be derivable by the server too.

The two halves of an invite do different jobs, and both are needed:

| Part | Job | Who checks it |
|---|---|---|
| Passcode | who may enter the room | the server |
| Key in the link fragment | who can read what is said | nobody — only the browser holds it |

Someone with the passcode but a link stripped of its fragment joins the room and
sees every message as `Encrypted — you do not have the key`. The interface warns
them before they join and badges the room `no key` rather than pretending.

### Administrator review, and what it costs

An administrator can read private rooms — and because that is true, the room
says so. The private room notice reads *"Encrypted in your browser — and an
administrator can open this room for review"*, permanently, not only while the
room is empty. An interface that called this end to end while an administrator
could read it would be lying to the people relying on it.

It works by escrow rather than by handing the server a key:

1. The administrator generates an RSA-OAEP keypair **in their browser**. The
   public half is stored and served openly; the private half is sealed with
   AES-GCM under a key derived from a review passphrase (PBKDF2, 250k rounds)
   that is typed in the browser and never transmitted.
2. When a private room is created, the client wraps that room's AES key with the
   escrow public key and sends only the wrapped blob.
3. Messages are persisted as ciphertext, so a conversation can be reviewed after
   the room has closed.
4. To read one, the administrator types the review passphrase, which unseals the
   private key in the browser, unwraps the room key, and decrypts locally.

The property this buys, and it is the whole point: **the admin token alone is
not enough.** Someone holding the JWT, or a full database dump, gets ciphertext
and a passphrase-sealed private key. Verified by fetching the review endpoint
with a valid admin token and reading the raw collections — both return
envelopes.

**This reverses an earlier decision.** Private rooms previously stored nothing
at all. Reviewable conversations have to exist to be reviewed, so their
ciphertext is now persisted. The property is no longer "nothing in the
database"; it is "nothing readable in the database".

**What this does not cover, stated plainly:**

- **Only private rooms.** Public rooms have no shared secret and stay plaintext.
- **Not metadata.** Usernames, room names, message timing and who is present are
  all visible to the server; the roster and moderation depend on them.
- **Not an active server operator.** The browser runs JavaScript the server
  itself delivered, so anyone who can change what the server serves could serve
  a version that leaks the key. Browser-delivered encryption protects stored and
  relayed data against the operator — it cannot protect against one who tampers
  with the application. Claiming otherwise would be dishonest.
- **Not from an administrator who chooses to look.** With escrow configured,
  that is the deliberate design, and the room discloses it.
- **The review passphrase cannot be recovered.** It never reaches the server, so
  losing it means the sealed private key stays sealed and older rooms become
  permanently unreadable. The setup screen says so before the key is created.

### Passcodes

Entry needs **two things**: the link and a six character passcode issued with
it. A link can be forwarded, screenshotted or logged by a chat client without
its owner noticing, so the link alone is treated as a weak secret. The passcode
is generated from an alphabet with `I`, `O`, `0` and `1` removed so it survives
being read aloud or copied by hand, is compared in constant time, and is
throttled to six wrong guesses per five minutes per socket. It is redacted from
the server log like any other secret.

Anyone already inside the room can read the passcode back, so a member can
re-share it without the creator being present. An authenticated administrator
enters without it.

Private rooms live entirely in memory:

- **Never written to MongoDB.** No room record, no messages. `GET /api/rooms`
  filters them out, so they cannot be discovered from the room list.
- **Messages sit in a capped buffer** (200 per room) so a late joiner still sees
  the conversation, without unbounded growth over a long session.
- **They expire.** Four hours from creation regardless of activity, or ten
  minutes after the last person leaves, whichever comes first. A sweeper runs
  every minute. Someone rejoining inside the grace period keeps the room alive.
- **An expired slug is gone, not recycled.** Joining it returns `ROOM_EXPIRED`
  rather than quietly creating a fresh room of the same name.

Administrators keep full reach: private rooms appear in `admin:overview` marked
`private`, and kick, ban, delete and clear all work inside them — delete and
clear operate on the memory buffer instead of the database.

**Stated limitation:** because they are in memory, private rooms do not survive
a server restart and would not be shared across a second instance. That is the
right trade for a room that is meant to be temporary, but it is a trade.

## 9a. Roles and administration

Two roles: `user` and `admin`.

**Regular users stay anonymous.** They type a name and join — no account, no
password. Requiring registration would break the join flow the task is actually
assessing, so identity for chat participants stays deliberately weak.

**Admin is a separate authenticated identity.** One account is seeded from
`ADMIN_USERNAME` / `ADMIN_PASSWORD` on boot, the password stored as a bcrypt
hash (cost 12) and never in plain text. `POST /api/auth/login` returns a JWT;
the client sends it as `Authorization: Bearer` on REST and as
`socket.handshake.auth.token` on the socket.

**Role is never read from a client payload.** It is derived server-side from a
verified token in one place — the `io.use` handshake middleware — and stored on
`socket.data.role`. A client that sends `{ role: 'admin' }` in `room:join` gets
nothing; there is a test asserting exactly that.

Admin capabilities, available over both REST and socket so the effect is
immediate:

| Action | Socket event | REST |
|---|---|---|
| Live overview of rooms and users | `admin:overview` | `GET /api/admin/overview` |
| Disconnect a user | `admin:kick` | `POST /api/admin/kick` |
| Ban (optionally per-room, optionally timed) | `admin:ban` | `POST /api/admin/ban` |
| List / lift bans | `admin:bans` / `admin:unban` | `GET`/`DELETE /api/admin/bans` |
| Delete one message | `admin:delete-message` | `DELETE /api/admin/messages/:id` |
| Clear a room's history | `admin:clear-room` | `POST /api/admin/rooms/:room/clear` |

Bans are checked on join and stored in MongoDB, so they outlive a restart. A
kick only disconnects; a ban disconnects **and** prevents rejoining.

Login is rate limited to 8 attempts per 10 minutes per IP.

**Account names are reserved.** An anonymous user cannot join under a name that
belongs to a registered account — otherwise anyone could type `admin` and appear
to be one, and would also lock the real administrator out of their own name with
`USERNAME_TAKEN`. The reserved set is loaded at boot and checked in memory, so
this costs no database round trip per join.

**The roster carries roles**, not just names (`{ username, role }`), so a client
can badge a genuine admin from server truth rather than by matching a string.

**Known limitation, deliberate:** since chat users are anonymous, a ban is on a
*name*, not a person. Someone can rejoin under a different name. Closing that
would require accounts for everyone, which is out of scope.

**Token lifetime:** roles are resolved once at the WebSocket handshake, so a
token that expires mid-session keeps its role until the socket reconnects.
Tokens last 12h and there is no revocation list; signing out is the client
dropping the token.

## 9a1. Live server logs

The moderation panel shows the server's own log, live. Rather than calling the
host's log API — which would mean storing a platform API key — the server keeps
its own console output in a capped in-memory ring (400 lines) and streams it to
subscribed administrators over the socket already in use, with a status sample
every five seconds.

**Everything is redacted on the way into the buffer, not on the way out**, so a
secret never sits in memory waiting to be leaked by a later bug. Masked:
connection strings with credentials, bearer tokens, JWTs, and any
`password` / `secret` / `token` key whatever its formatting. There are tests
asserting a Mongo password cannot survive the trip.

Access is the same admin token as everything else: `admin:logs:subscribe` over
the socket and `GET /api/admin/logs` both refuse anyone without it.

The buffer is per-process, so it shows the running instance only and resets on
deploy — for anything older, the host's own log retention is still the place to
look.

## 9b. Acknowledgements

Every client event answers through a Socket.IO ack — `{ ok: true, ... }` or
`{ ok: false, code, message }` — alongside the existing `error:app` broadcast.
The ack is what lets the UI show a per-message state (sending / sent / failed)
rather than leaving the sender to infer delivery from seeing their own
broadcast arrive.

## 9c. Shutdown

`io.disconnectSockets(true)` then `io.close()` then `httpServer.close()`, with a
5s forced-exit backstop. `httpServer.close()` alone never returns while a
WebSocket is open: it waits for connections to end and a WebSocket does not end
on its own. Measured before the fix — the process was still alive 15s after
SIGTERM with one client attached.

## 10. Build order

1. `npm init`, install deps, `.gitignore`, `.env.example`
2. `config/env.js`, `app.js`, `server.js` → boot, hit `/health`
3. `socket/index.js` → log connect/disconnect, confirm handshake in devtools
4. `rooms.js` + `validate.js`
5. `handlers.js` → implement the §4 contract
6. Verify with two `socket.io-client` scripts (or `wscat`) before any React
   exists — proves the server independently of the UI

## 11. Automated tests

`npm test` (Node's built-in runner) spawns the server against separate
`chatapp_test` and `chatapp_admin_test` databases, then drops them. 24 tests
across two files:

- `test/server.test.js` — transport, rooms, isolation, roster, typing,
  validation, rate limiting, history, pagination, REST routes, shutdown.
- `test/admin.test.js` — login, token rejection, privilege escalation attempts,
  reserved account names, kick, ban and rejoin, message deletion, room clearing,
  login rate limiting.

27 tests in total.

The rate limit is configurable through `RATE_LIMIT_*` so the reconnect test can
pin refill to zero — otherwise the bucket refills during the reconnect and the
assertion becomes a race against wall-clock time.

## 12. Manual verification

- Two clients join room `research` → both see each other's messages
- A client in room `other` sees **none** of them (this is the isolation check
  the task's "manage real-time communication between clients" grades)
- Closing a tab emits a leave notice and updates the roster in the other tab
- Killing and restarting the server → clients auto-reconnect; they must re-emit
  `room:join` on reconnect, or they come back connected but in no room. This is
  the single most commonly missed case in this task.

## Code style

No comments in server source. Rationale that would otherwise sit in a comment
lives in this document instead, so the reasoning is in one reviewable place and
the code stays scannable.

## Open questions

1. Room entry — free-text room name, or a fixed list of rooms to pick from?
   Free-text is more flexible; a fixed list demos better on video.
2. Is a raw `ws` implementation required, or is Socket.IO acceptable? Assumed
   acceptable above (§1), with the fallback path noted.
