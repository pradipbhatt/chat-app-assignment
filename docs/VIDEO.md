# Video plan

Two recordings, matching the convention used across the PRIME lab's own project
pages: a short silent-ish preview and a longer narrated walkthrough.

The guiding rule: **narrate the reasoning, not the interface.** "Here is the
message list, here is the send button" is a feature tour. "Messages arrive while
you are reading history, so the view only follows you when you are already at
the bottom" is design reasoning. The second is what is being assessed.

---

## Before recording

- [ ] Clear the test data from the database, or the room picker shows
      `checkroom-720905`, `cleartest` and rows of `burst` and `history line`
      messages
- [ ] Start the server, confirm `/health` reports `database: connected`
- [ ] Two browser windows side by side, both at a readable zoom
- [ ] Sign the second window out of any admin session — administrator state is
      per tab, so check it rather than assuming
- [ ] Pick the theme you want on camera and set it in both windows
- [ ] Close unrelated tabs, silence notifications

---

## Preview cut — about 30 seconds, no narration needed

One continuous take, two windows visible at once:

1. Join a room in the left window (3s)
2. Join the same room as someone else in the right (3s)
3. Type a message on the left — it appears on the right (5s)
4. Reply on the right, with the typing indicator visible on the left first (6s)
5. Open the moderation panel, delete a message, it disappears from both (8s)
6. End on the two windows in conversation (5s)

---

## Walkthrough — 3 to 5 minutes, narrated

### 1. What this is (20s)
A chat room where several people in the same named room exchange messages over a
persistent WebSocket connection. Say what the task asked for, and that the
interesting part is the interaction rather than the messaging.

### 2. Joining (30s)
Show the join screen. Point out that the room list is **live** — occupancy comes
from the server, not a hardcoded list. Mention deliberately that there is no
sign-up: the assumption was that a registration wall would sit in front of the
very interaction being assessed.

### 3. The core requirement (45s)
Two windows, same room. Send a message each way. Say plainly: no refresh, no
polling, a persistent connection.

Then the detail worth stating: **the sender's own message also arrives through
the room broadcast**, so everyone renders from one path and sees one ordering.

### 4. Awareness (60s) — the strongest section
- **Typing indicator**: appears for the other person, clears itself if they stop
- **Roster**: who is present, updating on join and leave
- **Delivery state**: send several messages quickly, let the rate limit refuse
  one, show it marked failed with Retry — the sender is never left guessing
- **Scroll behaviour**: scroll up to read history, have the other window send a
  message. The view does **not** jump. Say why: in a busy room that makes
  reading impossible

### 5. History (30s)
Rejoin and show past messages replayed. Click "load older" and point out the
scroll anchoring — the message you were reading stays where it was.

### 6. Moderation (45s)
Sign in as an administrator. Point out the panel is only visible because the
**server** reports the role, not because the interface chose to show it — a
client claiming to be an admin gets nothing, and there is a test for that.

Delete a message, show it vanishing from the other window. Kick the other user
and show that they are told why.

### 7. Robustness (30s)
Kill the server on camera. Both windows show the connection state change. Restart
it. They reconnect, rejoin their room, and can send again. Say why this needs
saying: a reconnected socket is not the same as a rejoined room, and a client
that forgets to rejoin looks connected while messages go nowhere.

### 8. Close (20s)
One sentence on what was deliberately left out and why, pointing at
`DECISIONS.md`. Ending on a stated limitation reads as judgement, not omission.

---

## Things to say because they will not be visible

- Message id and timestamp come from the server, so one client's wrong clock
  cannot reorder a room
- Message text is rendered as text, never as markup
- Presence is in memory and history is in the database, for different reasons
- The server has 27 tests; three real defects were found by testing and fixed

## Things not to do

- Do not read the interface aloud
- Do not apologise for what is missing — state scope decisions as decisions
- Do not rush the scroll and reconnect moments; they are the two beats that
  separate this from a tutorial chat app
