# Interview Task — WebSocket Chat Room Application

Source: Professor / Computational Ethics Lab, University of Vermont.
Recorded: 2026-09-14. This file is the authoritative statement of the task.

## Task

Develop an interactive web application that implements a simple chat room using
WebSocket. The application should feature the following key functionalities:

1. **User Interface**
   - Allow users to join the chat room.
   - Enable users to send and receive messages in real time.

2. **Real-Time Communication**
   - Set up a server to handle WebSocket connections.
   - Manage real-time communication between clients.

## Deliverables

1. A video demonstration with voice-over walking through the user experience of
   the chat room application.
2. A GitHub repository link containing all the code.
   **Remove any sensitive information such as API keys.**
3. (Optional) The deployed application URL on Netlify.

## Requirements / Constraints

- The UI may be designed freely; the primary challenge is the **interaction** —
  specifically real-time messaging over WebSocket.
- Possible tools/frameworks:
  - WebSocket for real-time messaging
  - Any suitable frontend framework (e.g. React)
  - Any suitable backend framework (e.g. Express.js for Node.js)

## Scope Notes (derived from the project README)

In scope for this implementation:

- Enter a username and join a chat room
- Persistent WebSocket connection with visible connection state
- Room-based message broadcasting to multiple simultaneous clients
- Instant message delivery with no page refresh
- Connect / disconnect / reconnect handling on the server

Explicitly out of scope (listed as future improvements):

- Persistent message history / database storage
- User authentication
- Private messaging, typing indicators, presence, reactions, file sharing

## Notes

- Netlify hosts static frontends only — it cannot host the WebSocket server.
  If the optional deployment is done, the client goes to Netlify and the
  Socket.IO server goes to a Node-capable host (Render / Railway / Fly.io),
  with the client pointing at that server's URL via an env var.
- `.env` files, keys, tokens and credentials must never be committed.
