const { sendError } = require('../utils/responseHelper');

/**
 * 404 handler — attach after all routes.
 */
const notFound = (req, res, _next) => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

/**
 * Global error handler — attach last.
 */
const errorHandler = (err, _req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, `File too large. Max allowed: ${process.env.MAX_FILE_SIZE_MB || 50}MB`, 413);
  }
  if (err.message?.startsWith('Unsupported file type')) {
    return sendError(res, err.message, 415);
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Validation failed', 422, errors);
  }

  // Mongoose cast (bad ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, `Invalid ID format: ${err.value}`, 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  sendError(res, message, statusCode);
};

module.exports = { notFound, errorHandler };
