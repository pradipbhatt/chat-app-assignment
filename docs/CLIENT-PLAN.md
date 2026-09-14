# Client Plan — React frontend (plan only, no code yet)

Pairs with [SERVER-PLAN.md](./SERVER-PLAN.md). The event contract in its §4 is
the interface this client is built against. Rules that apply while writing any
of these files are in [FRONTEND-CONVENTIONS.md](./FRONTEND-CONVENTIONS.md).

## 1. Stack

| Choice | Why |
|---|---|
| **Vite + React 18** (JS, not TS) | instant HMR; JS keeps the diff readable for a reviewer, and there is no domain model here big enough to earn TS |
| **Tailwind CSS v3.4** | `tailwind.config.js` is the token registry the theming rules depend on. **Not v4** — v4 moves config into CSS-first `@theme` and drops the JS config, which is the opposite of the layering we want |
| **socket.io-client** | must match the server's major version |
| **No state library, no UI kit** | Context + hooks are sufficient at this size; a UI kit would bring its own hardcoded palette and fight the token system |

## 2. Layout

```text
client/
├── index.html                   # <html data-theme="dark"> + pre-paint theme script
├── tailwind.config.js           # THE color registry — semantic tokens → CSS vars
├── postcss.config.js
├── .env.example                 # VITE_SERVER_URL
└── src/
    ├── main.jsx                 # mount, providers
    ├── App.jsx                  # route: not-joined → JoinPage, joined → ChatPage
    ├── styles/
    │   ├── index.css            # tailwind directives + base layer
    │   └── themes.css           # [data-theme="..."] blocks: raw channel values
    ├── context/
    │   ├── ThemeContext.jsx     # theme state, localStorage, sets data-theme
    │   └── ChatContext.jsx      # socket lifecycle, messages, roster, room
    ├── hooks/
    │   ├── useChat.js           # consumer for ChatContext
    │   └── useAutoScroll.js     # stick-to-bottom behaviour for the list
    ├── lib/
    │   ├── socket.js            # single socket instance, created lazily
    │   ├── themes.js            # THEMES array + labels
    │   └── format.js            # timestamp formatting, initials for avatars
    ├── pages/
    │   ├── JoinPage.jsx
    │   └── ChatPage.jsx
    └── components/
        ├── ThemeSwitcher.jsx
        ├── ConnectionBadge.jsx
        ├── UserList.jsx
        ├── MessageList.jsx
        ├── MessageBubble.jsx
        └── MessageComposer.jsx
```

No router. Two views selected by `joined` state — a router for two views is
dependency weight with no benefit, and the join step is state, not a URL.

## 3. Theming implementation

Covered in full by FRONTEND-CONVENTIONS.md §1. The three files:

`styles/themes.css` — channel values per theme:

```css
:root, [data-theme="dark"] {
  --color-bg:        9 9 11;
  --color-surface:  24 24 27;
  --color-fg:      250 250 250;
  --color-accent:   99 102 241;
  /* ...every token in §1.5 */
}
[data-theme="light"] { /* same token list, different numbers */ }
[data-theme="midnight"] { /* same token list again */ }
```

`tailwind.config.js` — names and the alpha contract:

```js
colors: {
  bg:      'rgb(var(--color-bg) / <alpha-value>)',
  surface: 'rgb(var(--color-surface) / <alpha-value>)',
  fg:      'rgb(var(--color-fg) / <alpha-value>)',
  accent:  'rgb(var(--color-accent) / <alpha-value>)',
  // ...
}
```

Components — `className="bg-surface text-fg border border-border"`. Nothing else.

`ThemeContext` does three things: read `localStorage.theme` (already applied
pre-paint by the inline script), expose `{ theme, setTheme, themes }`, and on
change write both `document.documentElement.dataset.theme` and `localStorage`.
It holds no colors.

## 4. Socket integration

`lib/socket.js` exports one lazily-created instance with
`autoConnect: false`. Creating it at import time opens a connection on page
load, before the user has a username — the server would then hold a connected
socket belonging to nobody.

`ChatContext` owns the whole lifecycle:

| Trigger | Action |
|---|---|
| `join(username, room)` | `socket.connect()`, then emit `room:join` |
| `room:joined` | set `joined: true`, seed roster — **the view switches on this, not on `connect`** |
| `message:new` | append to messages |
| `room:users` | replace roster |
| `error:app` | surface to UI, stay on the join screen if not yet joined |
| `connect_error` / `disconnect` | update connection status, keep messages |
| `leave()` | emit `room:leave`, `socket.disconnect()`, clear state |

**The reconnect case** (server plan §11): Socket.IO reconnects the transport
automatically, but the server's room membership is gone with the old socket id.
So the client keeps the last `{ username, room }` in a ref and **re-emits
`room:join` inside the `connect` handler** whenever that ref is set. Without
this, the UI shows "connected" after a server restart while messages silently
go nowhere — the most plausible way this demo breaks on video.

Every listener is registered in one `useEffect` and removed in its cleanup.

## 5. Views

**JoinPage** — centered card: username, room, Join. Disabled until both are
non-empty; mirrors the server's validation rules (§6 of the server plan) so bad
input is caught before a round trip, with the server still authoritative.
Carries the `ThemeSwitcher`, so the theme can be shown before joining.

**ChatPage** — header (room name, `ConnectionBadge`, `ThemeSwitcher`, Leave),
sidebar (`UserList`, collapses below `md`), `MessageList`, `MessageComposer`.

**MessageBubble** — three variants off one component:
- `system: true` → centered muted line, no bubble ("Alice joined")
- own message → right aligned, `bg-accent text-accent-fg`
- other message → left aligned, `bg-elevated text-fg`, username shown

Own-vs-other is decided by comparing the message `username` to the local one.
Noted honestly: usernames are not unique in this app, so two users with the same
name see each other's messages as their own. Acceptable at this scope; the fix
is a server-issued client id, which is a server-side change.

**MessageComposer** — form, Enter to send, trims, blocks empty, clears on
submit, disabled while disconnected (with the reason visible, not a mystery
greyed-out box).

**ConnectionBadge** — `connected` / `connecting` / `disconnected`, using the
`success` / `warning` / `danger` tokens **plus a text label** (conventions §6).

## 6. Auto-scroll

`useAutoScroll` pins to the bottom on new messages **only when the user is
already within ~80px of the bottom**. If they have scrolled up to read history,
an incoming message must not yank them down; show a "new messages" affordance
instead. Unconditional `scrollIntoView` on every message is the usual version of
this and it makes the app unusable in a busy room.

## 7. Build order

1. `npm create vite`, install Tailwind v3.4, wire `postcss.config.js`
2. `themes.css` + `tailwind.config.js` + the pre-paint script → **verify theming
   before any feature exists**: hardcode `data-theme="light"` by hand and
   confirm a test block flips color. Retrofitting tokens after the UI is built
   is where the stray `bg-zinc-800`s come from
3. `ThemeContext` + `ThemeSwitcher`
4. `JoinPage` (static, no socket)
5. `lib/socket.js` + `ChatContext` → join flow against the real server
6. `MessageList` / `MessageBubble` / `MessageComposer`
7. `UserList`, `ConnectionBadge`, system messages
8. `useAutoScroll`, responsive pass, empty and error states

Steps 1–4 need no server. Step 5 needs server steps 1–6 done.

## 8. Verification

- Two browser windows, same room → messages appear in both instantly
- A third window in a different room sees none of them
- Switch theme → every surface, bubble, border and icon changes; **nothing
  stays the old color** (a leftover is a hardcoded class — grep the `.jsx` for
  `zinc|slate|gray|#` to find it)
- Reload → theme persists, no light flash before paint
- Close one tab → leave notice + roster update in the other
- Restart the server → badge goes red, then green, and **messages still send**
  (this is the §4 reconnect fix; it is the check most likely to fail)
- Send `<img src=x onerror=alert(1)>` → renders as literal text (conventions §3)
- Narrow to ~375px → sidebar collapses, composer stays reachable

## Open questions

1. Avatars: colored initials, or no avatars? Initials read better on video; the
   color must come from a token set, not a random hex.
2. Should the theme choice sit on the join screen, or only inside the chat
   header? Currently planned for both.
3. Carried from the server plan: free-text room name vs. a fixed room list —
   this changes `JoinPage` from an input to a select.
