const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../lib/asyncHandler');
const requireAuth = require('../../middleware/requireAuth');
const { registerPushToken } = require('../../services/pushNotifications.service');

const router = Router();

const registerSchema = z.object({ token: z.string().min(1) });

// Called by the mobile app once it has obtained an Expo push token, so the
// backend can alert this user even when the app is backgrounded/closed.
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = registerSchema.parse(req.body);
    await registerPushToken(req.user.id, token);
    res.status(201).json({ ok: true });
  })
);

module.exports = router;
