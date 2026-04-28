/**
 * Session Controller
 *
 * GET  /api/sessions          — list all sessions (paginated)
 * GET  /api/sessions/:id      — get one session (full detail)
 * DELETE /api/sessions/:id    — delete a session
 * PATCH  /api/sessions/:id    — partial update (title, tags)
 */

const fs = require('fs');
const Session = require('../models/Session');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// ─── GET /api/sessions ────────────────────────────────────────────────────────
const getAllSessions = async (req, res) => {
  const {
    userId,
    status,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc',
  } = req.query;

  const filter = {};
  if (userId) filter.userId = userId;
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [sessions, total] = await Promise.all([
    Session.find(filter)
      .select('userId title status audioUrl audioDuration wordCount createdAt updatedAt keyPoints tags')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Session.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    { sessions },
    'Sessions retrieved successfully',
    200,
    {
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    }
  );
};

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────
const getSessionById = async (req, res) => {
  const session = await Session.findById(req.params.id).lean();
  if (!session) return sendError(res, 'Session not found', 404);

  // Remove internal file paths before sending to client
  delete session.audioFilePath;
  delete session.ttsAudioPath;

  return sendSuccess(res, { session }, 'Session retrieved successfully');
};

// ─── DELETE /api/sessions/:id ─────────────────────────────────────────────────
const deleteSession = async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return sendError(res, 'Session not found', 404);

  // Clean up audio files from disk
  const filesToDelete = [session.audioFilePath, session.ttsAudioPath].filter(Boolean);
  filesToDelete.forEach((fp) => {
    try { fs.unlinkSync(fp); } catch (_) { /* already gone */ }
  });

  await session.deleteOne();
  return sendSuccess(res, { id: req.params.id }, 'Session deleted successfully');
};

// ─── PATCH /api/sessions/:id ──────────────────────────────────────────────────
const updateSession = async (req, res) => {
  const allowed = ['title', 'tags'];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (Object.keys(updates).length === 0) {
    return sendError(res, 'No valid fields to update. Allowed: title, tags', 400);
  }

  const session = await Session.findByIdAndUpdate(req.params.id, updates, { new: true, lean: true });
  if (!session) return sendError(res, 'Session not found', 404);

  delete session.audioFilePath;
  delete session.ttsAudioPath;

  return sendSuccess(res, { session }, 'Session updated successfully');
};

module.exports = { getAllSessions, getSessionById, deleteSession, updateSession };
