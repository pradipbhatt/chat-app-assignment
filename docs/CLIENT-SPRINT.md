# Client Build Plan — small tasks, in order

Companion to [CLIENT-PLAN.md](./CLIENT-PLAN.md) (structure) and
[FRONTEND-CONVENTIONS.md](./FRONTEND-CONVENTIONS.md) (rules). This file is the
running order: what to build next, and how to know it is finished.

Each task has a **done-when** that can be checked in a browser or a terminal.
A task is not finished because the code exists; it is finished when its
done-when is true.

---

## S0 — Foundation

Nothing here is a feature. It exists so every feature after it inherits the
theme system instead of being retrofitted into it.

| # | Task | Done when |
|---|---|---|
| 0.1 | `npm create vite` in `client/`, React + JS, remove the starter template | `npm run dev` serves a blank page on :5173 |
| 0.2 | Install Tailwind **v3.4**, `postcss.config.js`, `tailwind.config.js`, directives in `styles/index.css` | a `text-3xl` test element renders styled |
| 0.3 | `styles/themes.css` — `dark`, `light`, `midnight` blocks, every token from conventions §1.5, as space-separated RGB channels | file exists, all three blocks define the same token list |
| 0.4 | Map tokens to semantic names in `tailwind.config.js` with `<alpha-value>` | `bg-surface` and `bg-surface/50` both render |
| 0.5 | `data-theme="dark"` in `index.html` plus the pre-paint script | hard-editing the attribute to `light` flips colors with no reload |
| 0.6 | `lib/themes.js`, `context/ThemeContext.jsx`, `components/ThemeSwitcher.jsx` | switching persists across reload, no light flash on load |
| 0.7 | `.env.example` + `VITE_SERVER_URL`, `lib/api.js` fetch helper | `GET /health` renders on screen from the real server |

**Checkpoint:** three themes switch cleanly and the client can reach the server.

## S1 — Join

| # | Task | Done when |
|---|---|---|
| 1.1 | `pages/JoinPage.jsx` — username field, room field, submit | renders, submit disabled while empty |
| 1.2 | Preset room chips from `GET /api/rooms`, with live occupancy, plus a custom room field | chips show real rooms and counts from the server |
| 1.3 | Client-side validation mirroring the server rules (1–24, `[a-z0-9-]`) | invalid input is caught before a round trip |
| 1.4 | Error surface for `USERNAME_TAKEN`, `USERNAME_RESERVED`, `BANNED`, `ROOM_CHARSET` | joining as `admin` shows the reserved-name message, not a crash |

## S2 — Chat core (first demoable milestone)

| # | Task | Done when |
|---|---|---|
| 2.1 | `lib/socket.js` — one instance, `autoConnect: false` | no socket opens before a join |
| 2.2 | `context/ChatContext.jsx` — connect, emit `room:join`, switch view on `room:joined` | two browser windows join the same room |
| 2.3 | `MessageList` + `MessageBubble` — own / other / system variants | history from the server renders on join |
| 2.4 | `MessageComposer` — form, Enter to send, trims, clears | a message typed in window A appears in window B |
| 2.5 | Listener cleanup in every effect | with StrictMode on, messages appear once, not twice |
| 2.6 | Re-emit `room:join` inside the `connect` handler after a reconnect | restart the server; both windows recover and can still send |

**Checkpoint:** this is the task's core requirement working end to end. If
everything after this is cut, there is still something to record.

## S3 — Awareness

The CSCW layer: not "can I send a message" but "do I know what is happening".

| # | Task | Done when |
|---|---|---|
| 3.1 | `UserList` from `room:users`, with an admin badge driven by `role` | a signed-in admin shows a badge, a user named `admin` cannot exist |
| 3.2 | `ConnectionBadge` — connected / connecting / disconnected, text as well as color | pulling the network shows the state change |
| 3.3 | Typing indicator — emit on input with a stop timer, render peers | B sees "Alice is typing" and it clears on its own |
| 3.4 | Per-message delivery state from the `message:send` ack | a message shows sending, then sent; a rate-limited one shows failed |
| 3.5 | `useAutoScroll` — pin to bottom only when already near it, else a "new messages" affordance | scrolled up, an incoming message does not yank the view |
| 3.6 | "Load older" using `messages:load` with the `before` cursor | older messages prepend without losing scroll position |

## S4 — Admin

| # | Task | Done when |
|---|---|---|
| 4.1 | `AdminLogin` — posts to `/api/auth/login`, stores the token | wrong password shows an error, right one returns a token |
| 4.2 | Pass the token as `socket.handshake.auth.token` on connect | the socket reports `role: admin` in `room:joined` |
| 4.3 | `AdminPanel` — live rooms and users from `admin:overview` | the panel lists what is actually connected |
| 4.4 | Kick and ban controls, with a reason field | a kicked window is disconnected and says why |
| 4.5 | Delete a message; handle `message:deleted` in every client | the message disappears from both windows live |
| 4.6 | Clear a room; handle `room:cleared` | history empties everywhere at once |
| 4.7 | Hide every admin control unless `role === 'admin'` from the server | a normal user sees no admin UI at all |

## S5 — Polish

| # | Task | Done when |
|---|---|---|
| 5.1 | Empty states: no messages yet, no rooms yet, room cleared | none of these render as a blank rectangle |
| 5.2 | Error and disconnected states in the composer, with the reason visible | a disabled composer always says why |
| 5.3 | Responsive pass at 375px — sidebar collapses, composer reachable | no horizontal scroll on the page body |
| 5.4 | Accessibility: `aria-live` on the list, real form, visible focus ring | tab-only navigation works through join and send |
| 5.5 | Theme audit | `grep -rE "zinc|slate|gray|#[0-9a-f]{3,6}" client/src --include=*.jsx` returns nothing |
| 5.6 | XSS check | sending `<img src=x onerror=alert(1)>` renders as text, no dialog |

## S6 — Deliverables

| # | Task | Done when |
|---|---|---|
| 6.1 | `DECISIONS.md` — assumptions, trade-offs, what was deliberately left out | covers rooms, anonymity, bans-by-name, Socket.IO, persistence |
| 6.2 | Update `README.md` — status table, client setup, screenshots | describes a working app, not a planned one |
| 6.3 | Video shot list and narration notes | a written running order before recording |
| 6.4 | Record the walkthrough: ~30s preview plus 3–5 min demo | narrates design reasoning, not a feature tour |
| 6.5 | Optional deploy — client on Netlify, server on a Node host, `CLIENT_URL` updated | two strangers' browsers can chat through the deployed URL |

---

## Order and risk

S0 → S2 is the critical path. **S2 is the milestone that matters**: it is the
task's stated requirement, and once it is done there is something recordable no
matter what happens to the rest.

S3 is what makes it look considered rather than minimal, and it is the layer
closest to what the lab actually studies.

S4 is the largest block and the one furthest from the brief. If time gets
short, cut S4 before cutting S3 or S5 — a polished chat with awareness cues
demos better than a feature-rich app with a rough interface.

## Server contract the client must match

- Roster entries are `{ username, role }`, not strings
- `room:joined` carries `{ room, username, role, users, history, hasMore }`
- Every client event answers with `{ ok }` or `{ ok: false, code, message }`
- Message `id` and `ts` come from the server; never generate them client-side
- Admin access needs the token at the handshake, not in an event payload
