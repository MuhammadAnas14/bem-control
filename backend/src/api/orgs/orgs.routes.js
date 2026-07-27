const { Router } = require('express');
const { z } = require('zod');
const asyncHandler = require('../../lib/asyncHandler');
const prisma = require('../../lib/prisma');
const requireAuth = require('../../middleware/requireAuth');
const requireOrgMembership = require('../../middleware/requireOrgMembership');

const router = Router();

router.use(requireAuth);

// List the organizations the current user belongs to (used for the org switcher)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: { organization: true },
    });
    res.json(
      memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      }))
    );
  })
);

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

// Add an existing user to the organization by email (simplified stand-in for
// a real invite-by-email flow, which would send a signed invite link).
router.post(
  '/:orgId/members',
  requireOrgMembership('ADMIN'),
  asyncHandler(async (req, res) => {
    const { email, role } = inviteSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No user with that email exists yet' });
    }

    const membership = await prisma.membership.create({
      data: { userId: user.id, organizationId: req.params.orgId, role },
    });
    res.status(201).json(membership);
  })
);

router.get(
  '/:orgId/members',
  requireOrgMembership('MEMBER'),
  asyncHandler(async (req, res) => {
    const members = await prisma.membership.findMany({
      where: { organizationId: req.params.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(members);
  })
);

module.exports = router;
