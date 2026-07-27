// Device-facing REST endpoints, authenticated with X-Device-Key /
// X-Device-Api-Key (see middleware/deviceAuth.js) rather than a user JWT.
// These exist as a fallback path for a device that can't reach MQTT (e.g.
// blocked outbound port on a restrictive network) - MQTT is the primary,
// lower-latency transport for telemetry and commands.
const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../lib/asyncHandler');
const deviceAuth = require('../../middleware/deviceAuth');
const telemetryService = require('../../services/telemetry.service');
const commandsService = require('../../services/commands.service');

const router = Router();

router.use(deviceAuth);

const telemetrySchema = z.object({
  metrics: z.record(z.number()),
  ts: z.string().datetime().optional(),
});

router.post(
  '/telemetry',
  asyncHandler(async (req, res) => {
    const { metrics, ts } = telemetrySchema.parse(req.body);
    await telemetryService.ingestViaRest(req.device, metrics, ts ? new Date(ts) : new Date());
    res.status(202).json({ ok: true });
  })
);

router.post(
  '/commands/:commandId/ack',
  asyncHandler(async (req, res) => {
    const command = await commandsService.acknowledgeCommand(req.device.id, req.params.commandId);
    res.json(command);
  })
);

module.exports = router;
