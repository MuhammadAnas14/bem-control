const prisma = require('../lib/prisma');

async function getHistory(deviceId, { metric, from, to, limit = 200 }) {
  return prisma.telemetryReading.findMany({
    where: {
      deviceId,
      ...(metric ? { metric } : {}),
      ...(from || to
        ? {
            recordedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { recordedAt: 'desc' },
    take: Math.min(Number(limit) || 200, 1000),
  });
}

/** REST fallback ingestion path for a device that can't reach MQTT (e.g. captive portal / firewall). */
async function ingestViaRest(device, metrics, recordedAt) {
  const entries = Object.entries(metrics).filter(([, value]) => typeof value === 'number');

  await prisma.$transaction([
    ...entries.map(([metric, value]) =>
      prisma.telemetryReading.create({
        data: { deviceId: device.id, metric, value, recordedAt },
      })
    ),
    prisma.device.update({
      where: { id: device.id },
      data: { status: 'ONLINE', lastSeenAt: new Date() },
    }),
  ]);
}

module.exports = { getHistory, ingestViaRest };
