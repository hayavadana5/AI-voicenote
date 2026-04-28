const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadAudio, summarizeSession, textToSpeech } = require('../controllers/audioController');

/**
 * POST /api/upload
 * Multipart form: field "audio" (file) + optional "userId", "title", "tags", "language"
 */
router.post('/upload', upload.single('audio'), asyncHandler(uploadAudio));

/**
 * POST /api/summarize
 * Body: { sessionId?: string, transcript?: string }
 */
router.post('/summarize', asyncHandler(summarizeSession));

/**
 * POST /api/text-to-speech
 * Body: { text?: string, sessionId?: string }
 */
router.post('/text-to-speech', asyncHandler(textToSpeech));

module.exports = router;
