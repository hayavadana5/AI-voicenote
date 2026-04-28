/**
 * Standardised JSON response helpers.
 * All API responses follow { success, message, data, meta } shape.
 */

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const body = {
    success: false,
    message,
    meta: { timestamp: new Date().toISOString() },
  };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const sendCreated = (res, data, message = 'Resource created successfully') =>
  sendSuccess(res, data, message, 201);

module.exports = { sendSuccess, sendError, sendCreated };
