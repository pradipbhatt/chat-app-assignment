# Frontend Conventions — rules for every client file

These are binding rules, not suggestions. If a rule has to be broken, note why
in a comment at the break.

---

## 1. Theming

### 1.1 Dark is the default

`index.html` ships `<html data-theme="dark">` in the markup. The theme is never
applied by React after mount — if it were, the page would paint light, then
flip. A tiny blocking script in `<head>` reads the stored preference and
overwrites the attribute **before first paint**:

```html
<script>
  try {
    var t = localStorage.getItem('theme');
    if (t) document.documentElement.dataset.theme = t;
  } catch (e) {}
</script>
```

This is the one place inline script is allowed.

### 1.2 Colors are defined once, as tokens, in `tailwind.config.js`

**No component may contain a color literal.** Banned in `.jsx`:

- hex / `rgb()` / `hsl()` values
- Tailwind's stock palette — `bg-zinc-900`, `text-gray-400`, `border-slate-700`
- arbitrary values — `bg-[#18181b]`, `text-[rgb(24,24,27)]`

Allowed: semantic token classes only — `bg-surface`, `text-fg-muted`,
`border-border`, `bg-accent hover:bg-accent-hover`.

The reason is not tidiness. A stock-palette class is a **hardcoded theme**: it
renders the same in every theme, so a single `bg-zinc-800` in one component is
a light-mode bug that no amount of theme switching can fix. Semantic tokens make
a new theme a data change, not a code change.

### 1.3 How the token layer works

Three layers, each with one job:

```text
styles/themes.css      raw channel values per theme   --color-surface: 24 24 27;
tailwind.config.js     semantic names → var()         surface: rgb(var(--color-surface) / <alpha-value>)
components             semantic classes only          className="bg-surface"
```

Values are stored as **space-separated RGB channels, not `rgb()` strings**, so
Tailwind's `<alpha-value>` placeholder works and `bg-surface/50` stays valid.
`--color-surface: #18181b` silently breaks every opacity modifier in the app.

Honest framing: the values themselves have to live in CSS — a `:root` block is
the only place a browser lets a theme be swapped at runtime without a rebuild.
What lives in `tailwind.config.js` is the **name and the contract**: the config
is the single registry of what colors exist, and `themes.css` only fills in
numbers per theme. Components never see either file.

### 1.4 Adding a theme

1. Add a `[data-theme="name"] { ... }` block in `styles/themes.css` filling in
   **every** token the other themes define.
2. Add the name to the `THEMES` array in `lib/themes.js`.
3. Done — no component, and no `tailwind.config.js` change.

If step 1 misses a token, that token falls back to `:root` (dark) and will look
wrong on a light theme. Keep the blocks in the same token order so a missing
line is visible on inspection.

### 1.5 Token set

Every theme must define all of these:

| Token | Use |
|---|---|
| `bg` | page background |
| `surface` | cards, sidebar, composer |
| `elevated` | hover states, menus, own-message bubble |
| `fg` | primary text |
| `fg-muted` | timestamps, usernames, labels |
| `fg-subtle` | system notices, placeholders |
| `border` | all hairlines and dividers |
| `accent` / `accent-fg` / `accent-hover` | primary buttons, focus ring, links |
| `success` / `warning` / `danger` | connection states, errors |

Shipping themes: `dark` (default), `light`, plus one distinct third
(`midnight`) — a third theme is what proves the system is a theme engine and not
a light/dark boolean in disguise.

### 1.6 Spacing, radius, typography

Same rule, less strictly: radii and fonts go through
`tailwind.config.js → theme.extend` (`rounded-bubble`, `font-sans`) so the
visual identity is adjustable in one file. Spacing uses the stock scale —
`p-4` is not a theme decision.

---

## 2. React

- **Function components + hooks only.** No class components.
- **One component per file**, named export matching the filename.
- **No component over ~150 lines.** Past that, split the presentational part out.
- **Socket logic never lives in a component.** Components call a hook
  (`useChat`, `useSocketStatus`); the hook owns the listeners.
- **Every `useEffect` that subscribes must return a cleanup** that unsubscribes.
  In dev, React 18 StrictMode mounts twice — an effect without cleanup produces
  duplicate listeners and every message renders twice. If messages appear
  doubled, this is the cause; do not "fix" it by disabling StrictMode.
- **`key` is the server-issued message `id`.** Never the array index — the list
  only ever appends, but index keys break the moment a system notice is
  inserted, and they defeat React's reconciliation on re-render.
- **Derive, don't duplicate.** `isConnected` comes from socket state; it is not
  a second `useState` kept in sync by hand.

## 3. Rendering messages — security

- Message text is rendered as **plain text children**. React escapes it.
- `dangerouslySetInnerHTML` is banned in this codebase, without exception.
- Usernames are rendered as text too — a username is user input like any other.
- If link auto-detection is ever added, build it by splitting into text/anchor
  React nodes. Never by building an HTML string.

The app broadcasts untrusted input from one user to every other user in the
room. That is the exact shape of stored XSS, and the single-line HTML shortcut
is what turns the demo into a vulnerability.

## 4. State

- Server state (messages, roster, room) lives in the chat context/hook.
- UI state (input draft, menu open, theme) lives in the owning component or the
  theme context.
- **No state library.** Context + hooks cover this app; Redux here is overhead
  with no payoff at this size.
- Messages are append-only in a single array — the server orders them, the
  client does not sort.

## 5. Config

- The server URL comes from `import.meta.env.VITE_SERVER_URL`, never a literal.
- `.env.example` is committed; `.env` is git-ignored.
- Anything named `VITE_*` is **compiled into the public bundle** and is readable
  by anyone who opens devtools. No secret ever gets a `VITE_` prefix.

## 6. Accessibility

- The message list is `aria-live="polite"` so incoming messages are announced.
- The composer is a real `<form>`; Enter submits without a keydown handler.
- Focus ring uses the `accent` token and is never removed without a replacement.
- Connection state is text or an icon with a label — never color alone, which is
  invisible to a colorblind user and to a screen reader both.

## 7. Naming

| Thing | Convention | Example |
|---|---|---|
| Component file | PascalCase | `MessageList.jsx` |
| Hook | camelCase, `use` prefix | `useChat.js` |
| Non-component module | camelCase | `socket.js` |
| Socket event | `domain:action` | `message:send` |
| CSS token | `--color-<token>` | `--color-fg-muted` |
