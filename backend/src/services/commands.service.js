const prisma = require('../lib/prisma');
const { publishCommand } = require('../mqtt/handlers');

class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

/**
 * Creates a Command record and immediately publishes it to the device's
 * command topic - this is the "OTA/config-push" mechanism simulating a
 * fleet update being rolled out (e.g. OTA_TRIGGER pointing at a new
 * firmware URL+version, or CONFIG_UPDATE changing publish interval).
 */
async function createCommand(organizationId, deviceId, createdByUserId, { type, payload }) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, organizationId } });
  if (!device) throw new HttpError(404, 'Device not found');

  const command = await prisma.command.create({
    data: { deviceId, type, payload, createdByUserId, status: 'PENDING' },
  });

  publishCommand(organizationId, device.deviceKey, {
    id: command.id,
    type: command.type,
    payload: command.payload,
  });

  return prisma.command.update({
    where: { id: command.id },
    data: { status: 'SENT', sentAt: new Date() },
  });
}

async function listCommands(deviceId) {
  return prisma.command.findMany({ where: { deviceId }, orderBy: { createdAt: 'desc' } });
}

async function acknowledgeCommand(deviceId, commandId) {
  const command = await prisma.command.findFirst({ where: { id: commandId, deviceId } });
  if (!command) throw new HttpError(404, 'Command not found');

  return prisma.command.update({
    where: { id: commandId },
    data: { status: 'ACKED', ackedAt: new Date() },
  });
}

module.exports = { createCommand, listCommands, acknowledgeCommand, HttpError };
