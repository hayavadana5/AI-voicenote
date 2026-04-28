const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const {
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSession,
} = require('../controllers/sessionController');

/**
 * GET  /api/sessions       — list (with pagination & filters)
 * GET  /api/sessions/:id   — single session full detail
 * PATCH   /api/sessions/:id   — update title/tags
 * DELETE  /api/sessions/:id   — delete session + files
 */
router.get('/', asyncHandler(getAllSessions));
router.get('/:id', asyncHandler(getSessionById));
router.patch('/:id', asyncHandler(updateSession));
router.delete('/:id', asyncHandler(deleteSession));

module.exports = router;
