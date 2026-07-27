const prisma = require('../lib/prisma');

const ROLE_RANK = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

/**
 * Ensures req.user belongs to the organization identified by :orgId, with at
 * least `minRole`. Attaches req.membership. Must run after requireAuth.
 */
function requireOrgMembership(minRole = 'MEMBER') {
  return async function (req, res, next) {
    const { orgId } = req.params;

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` });
    }

    req.membership = membership;
    next();
  };
}

module.exports = requireOrgMembership;
