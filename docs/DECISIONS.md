# Decisions

The brief for this task is deliberately open, and says to resolve ambiguity with
one's own judgement rather than by asking. This file records where the brief was
ambiguous, what was assumed, what was traded away, and what is knowingly absent.

---

## Ambiguities in the brief, and how they were read

**"A simple chat room" — one room, or many?**
Built as many named rooms. One room is a special case of many, the extra cost is
a room key on each message, and messages reaching only the right people is the
part of the problem worth demonstrating. A single global room would not show
that anything was thought about.

**"Users can join" — with accounts, or without?**
Without. A name and a room, no registration. Requiring sign-up would put a
barrier in front of the interaction the task is actually assessing. The
consequence is accepted openly: names are unverified, so anyone can claim any
free name.

**"WebSocket" — a bare socket, or a library?**
Socket.IO. Its default transport is a real WebSocket, and the test suite asserts
the negotiated transport is `websocket` rather than the long-polling fallback,
so the requirement is met literally. What it supplies — rooms, acknowledgements,
reconnection — is boilerplate rather than insight, and hand-rolling it would
have consumed the time that went into the interaction instead.

**Message history — none, or persisted?**
Persisted in MongoDB. A chat room that forgets everything the moment you close
the tab is a demo, not a system. Joining a room and seeing what was already said
is also what makes the multi-client behaviour legible in a recording.

**How much interface?**
More than the brief requires, because the interface is where the judgement
shows. Deliberately restrained: no gradients, no decoration, three themes built
on one token set.

---

## Decisions worth defending

**The server assigns every message id and timestamp.**
A client clock is wrong often enough to matter, and a client-supplied id is a
client-controlled key. With the server as the authority, every participant sees
one ordering.

**Senders receive their own messages through the room broadcast.**
The obvious alternative — render locally, broadcast to everyone else — creates
two rendering paths and two orderings. One path means what the sender sees is
what everyone sees. The cost is that a message appears after a round trip, which
is why delivery state exists: a pending bubble shows immediately, and is
replaced by the real one.

**Presence in memory, messages in the database.**
Who is online right now is only true for as long as a socket is open; persisting
it would produce a roster full of people who left. Messages are the opposite.

**Roles come from a verified token, in one place.**
The role is resolved in the WebSocket handshake and stored on the socket. No
handler reads a role from a payload. A test sends `{ role: 'admin' }` in a join
payload and asserts it grants nothing.

**Registered account names are reserved.**
Without this, anyone could join as `admin` and appear to be one, and would
simultaneously lock the real administrator out of their own name. Found by
probing the server after the role work, not by reading it.

**The admin token lives in `sessionStorage`, not `localStorage`.**
`localStorage` is shared by every tab on an origin, so signing in as an
administrator in one tab silently made every tab an administrator, and it
survived a browser restart. Found while testing two roles side by side.

**Scroll position is never taken from the reader.**
Incoming messages scroll the view only when the reader is already at the bottom;
otherwise a "new messages" affordance appears. When older history is prepended,
the scroll position is anchored so the message being read stays under the eye.

---

## Trade-offs accepted

| Decision | Gained | Given up |
|---|---|---|
| Anonymous participants | no barrier to joining | unverifiable identity |
| Socket.IO | rooms, acks, reconnection | a dependency between the app and the raw protocol |
| Single-process presence | simple, no external services | will not scale past one server without a Redis adapter |
| Broadcast-only rendering | one ordering for everyone | a message appears after a round trip |
| Rate limit of 5 per second | one tab cannot flood a room | a legitimate fast burst is refused |
| Three themes | proves a theme system, not a toggle | every new colour must be added to three blocks |

---

## Known limitations

**A ban is on a name, not a person.** Anonymous users can return under another
name. Closing this requires accounts for everyone, which would undo the join
flow the task is about.

**Roles are resolved once, at the handshake.** A token expiring mid-session
keeps its role until the socket reconnects. There is no revocation list; signing
out is the client discarding the token.

**Messages sent within milliseconds of each other can be stored out of order.**
Each send awaits its own database write and is broadcast on completion, so
completion order can differ from send order. Visible only when messages are
fired by a script tens of milliseconds apart; at human typing speed it does not
occur. Serialising writes would add latency to every message to fix a case that
does not arise in use.

**Presence is process-local.** A second server instance would not share it.

**No delivery receipts, no read state, no message editing.** Out of scope.

---

## Deliberately not built

Accounts for participants · private messaging · message editing and deletion by
authors · file upload · read receipts · end-to-end encryption · moderator role
between user and admin · IP-based bans.

Each is defensible; none is what the task asked for. The brief says quality is
judged over complexity, and a smaller surface built properly was the read.

---

## What was verified, and how

The server has 27 automated tests covering transport, room isolation, presence,
validation, rate limiting, history, pagination, authorisation and shutdown. They
run against their own databases and drop them afterwards.

The client was verified by driving two browser tabs as two different users:
messages crossing live, the roster updating, typing indicators appearing and
expiring, a rate-limited message failing and being retried, history paging with
the scroll anchored, an administrator deleting a message that vanished from both
tabs, a kick and a ban with the reason shown to the person removed, and the
server being killed mid-session to confirm both clients recovered and could
still send.

Three defects were found this way and fixed rather than papered over: a
shutdown that hung with any client connected, an impersonation hole in the
reserved-name handling, and a kicked user being ejected with no explanation.
