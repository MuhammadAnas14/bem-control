const { WebSocketServer } = require('ws');
const { verifyUserToken } = require('../lib/jwt');
const prisma = require('../lib/prisma');
const env = require('../config/env');

// orgId -> Set<WebSocket>. Kept in-process (fine for a single backend
// instance; a multi-instance deployment would fan this out through the
// MQTT broker or a pub/sub layer like Redis instead).
const orgSubscribers = new Map();

function subscribe(orgId, socket) {
  if (!orgSubscribers.has(orgId)) orgSubscribers.set(orgId, new Set());
  orgSubscribers.get(orgId).add(socket);
}

function unsubscribe(orgId, socket) {
  orgSubscribers.get(orgId)?.delete(socket);
}

/** Pushes a JSON event to every connected client watching this organization. */
function broadcastToOrg(orgId, event) {
  const sockets = orgSubscribers.get(orgId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

/**
 * Clients connect to ws://host:WS_PORT?token=<jwt>&orgId=<id>. The JWT is
 * the same one issued at login - this WebSocket is authenticated exactly
 * like the REST API, just over a different transport, and only relays
 * telemetry/status for organizations the connecting user actually belongs to.
 */
function startWsServer() {
  const wss = new WebSocketServer({ port: env.WS_PORT });

  wss.on('connection', async (socket, request) => {
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const orgId = url.searchParams.get('orgId');

    try {
      const payload = verifyUserToken(token);
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: payload.sub, organizationId: orgId } },
      });
      if (!membership) throw new Error('not a member');
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    subscribe(orgId, socket);
    socket.on('close', () => unsubscribe(orgId, socket));
  });

  console.log(`[ws] Realtime server listening on port ${env.WS_PORT}`);
  return wss;
}

module.exports = { startWsServer, broadcastToOrg };
