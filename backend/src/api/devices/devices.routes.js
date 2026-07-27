const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../lib/asyncHandler');
const requireAuth = require('../../middleware/requireAuth');
const requireOrgMembership = require('../../middleware/requireOrgMembership');
const devicesService = require('../../services/devices.service');
const telemetryService = require('../../services/telemetry.service');
const commandsService = require('../../services/commands.service');

const router = Router({ mergeParams: true });

router.use(requireAuth, requireOrgMembership('MEMBER'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const devices = await devicesService.listDevices(req.params.orgId);
    res.json(devices);
  })
);

const provisionSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

router.post(
  '/',
  requireOrgMembership('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = provisionSchema.parse(req.body);
    const result = await devicesService.provisionDevice(req.params.orgId, input);
    res.status(201).json(result);
  })
);

router.get(
  '/:deviceId',
  asyncHandler(async (req, res) => {
    const device = await devicesService.getDeviceOrThrow(req.params.orgId, req.params.deviceId);
    res.json(device);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  desiredConfig: z.record(z.any()).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

router.patch(
  '/:deviceId',
  requireOrgMembership('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const device = await devicesService.updateDevice(req.params.orgId, req.params.deviceId, input);
    res.json(device);
  })
);

router.delete(
  '/:deviceId',
  requireOrgMembership('ADMIN'),
  asyncHandler(async (req, res) => {
    const device = await devicesService.disableDevice(req.params.orgId, req.params.deviceId);
    res.json(device);
  })
);

const telemetryQuerySchema = z.object({
  metric: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

router.get(
  '/:deviceId/telemetry',
  asyncHandler(async (req, res) => {
    await devicesService.getDeviceOrThrow(req.params.orgId, req.params.deviceId);
    const query = telemetryQuerySchema.parse(req.query);
    const readings = await telemetryService.getHistory(req.params.deviceId, query);
    res.json(readings);
  })
);

const createCommandSchema = z.object({
  type: z.enum(['CONFIG_UPDATE', 'OTA_TRIGGER', 'REBOOT', 'CUSTOM']),
  payload: z.record(z.any()).default({}),
});

router.post(
  '/:deviceId/commands',
  requireOrgMembership('ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createCommandSchema.parse(req.body);
    const command = await commandsService.createCommand(
      req.params.orgId,
      req.params.deviceId,
      req.user.id,
      input
    );
    res.status(201).json(command);
  })
);

router.get(
  '/:deviceId/commands',
  asyncHandler(async (req, res) => {
    await devicesService.getDeviceOrThrow(req.params.orgId, req.params.deviceId);
    const commands = await commandsService.listCommands(req.params.deviceId);
    res.json(commands);
  })
);

module.exports = router;
