const { ZodError } = require('zod');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    return res.status(409).json({ error: 'Resource already exists', fields: err.meta?.target });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.publicMessage || 'Internal server error' });
}

module.exports = errorHandler;
