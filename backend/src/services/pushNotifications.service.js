const prisma = require('../lib/prisma');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends an Expo push notification to every member of an organization who has
 * registered a device via the mobile app - this is what lets an alert (e.g.
 * "device went offline") reach a user even when they aren't looking at the
 * app, unlike the WebSocket channel which only works while connected.
 */
async function notifyOrganization(organizationId, { title, body, data }) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  if (memberships.length === 0) return;

  const pushTokens = await prisma.pushToken.findMany({
    where: { userId: { in: memberships.map((m) => m.userId) } },
    select: { token: true },
  });
  if (pushTokens.length === 0) return;

  const messages = pushTokens.map(({ token }) => ({ to: token, title, body, data, sound: 'default' }));

  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[push] failed to reach Expo push API:', err.message);
  }
}

async function registerPushToken(userId, token) {
  return prisma.pushToken.upsert({
    where: { token },
    update: { userId },
    create: { userId, token },
  });
}

module.exports = { notifyOrganization, registerPushToken };
