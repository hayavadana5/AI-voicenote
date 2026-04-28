/**
 * Audio Controller
 *
 * POST /api/upload          — upload audio, transcribe, store session
 * POST /api/summarize       — summarize a session transcript
 * POST /api/text-to-speech  — convert text to speech audio
 */

const path = require('path');
const Session = require('../models/Session');
const { transcribeAudio } = require('../services/speechToTextService');
const { summarizeTranscript } = require('../services/summarizationService');
const { convertTextToSpeech } = require('../services/textToSpeechService');
const { sendSuccess, sendCreated, sendError } = require('../utils/responseHelper');

// ─── POST /api/upload ─────────────────────────────────────────────────────────
const uploadAudio = async (req, res) => {
  if (!req.file) {
    return sendError(res, 'No audio file provided. Use multipart/form-data with field name "audio"', 400);
  }

  const { userId = 'anonymous', title, tags, language } = req.body;
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const audioUrl = `${base}/audio/${req.file.filename}`;

  // Create session immediately so the client gets an ID to poll
  const session = await Session.create({
    userId,
    title: title || `Session ${new Date().toLocaleString()}`,
    tags: tags ? tags.split(',').map((t) => t.trim()) : [],
    language: language || 'en',
    audioFileName: req.file.originalname,
    audioFilePath: req.file.path,
    audioMimeType: req.file.mimetype,
    audioUrl,
    status: 'transcribing',
    'processingSteps.upload.status': 'completed',
    'processingSteps.upload.completedAt': new Date(),
    'processingSteps.transcription.status': 'processing',
    'processingSteps.transcription.startedAt': new Date(),
  });

  // Respond immediately — transcription runs in background
  sendCreated(res, formatSession(session), 'Audio uploaded. Transcription in progress.');

  // ── Background processing ──────────────────────────────────────────────────
  try {
    const sttResult = await transcribeAudio(req.file.path);

    await Session.findByIdAndUpdate(session._id, {
      transcript: sttResult.transcript,
      timestampedSentences: sttResult.timestampedSentences,
      audioDuration: sttResult.duration,
      wordCount: sttResult.transcript.split(/\s+/).filter(Boolean).length,
      status: 'summarizing',
      'processingSteps.transcription.status': 'completed',
      'processingSteps.transcription.completedAt': new Date(),
      'processingSteps.summarization.status': 'processing',
      'processingSteps.summarization.startedAt': new Date(),
    });

    const summaryResult = await summarizeTranscript(sttResult.transcript);

    await Session.findByIdAndUpdate(session._id, {
      summary: summaryResult.summary,
      keyPoints: summaryResult.keyPoints,
      status: 'completed',
      'processingSteps.summarization.status': 'completed',
      'processingSteps.summarization.completedAt': new Date(),
    });

    console.log(`✅ Session ${session._id} fully processed`);
  } catch (err) {
    console.error(`❌ Background processing failed for session ${session._id}:`, err.message);
    await Session.findByIdAndUpdate(session._id, {
      status: 'failed',
      errorMessage: err.message,
    });
  }
};

// ─── POST /api/summarize ──────────────────────────────────────────────────────
const summarizeSession = async (req, res) => {
  const { sessionId, transcript } = req.body;

  if (!sessionId && !transcript) {
    return sendError(res, 'Provide either sessionId or transcript text', 400);
  }

  let session = null;
  let textToSummarize = transcript;

  if (sessionId) {
    session = await Session.findById(sessionId);
    if (!session) return sendError(res, 'Session not found', 404);
    if (!session.transcript) return sendError(res, 'Session has no transcript yet. Wait for transcription to complete.', 409);
    textToSummarize = session.transcript;
  }

  if (!textToSummarize || textToSummarize.trim().length < 10) {
    return sendError(res, 'Transcript is too short to summarize', 422);
  }

  const result = await summarizeTranscript(textToSummarize);

  if (session) {
    await Session.findByIdAndUpdate(sessionId, {
      summary: result.summary,
      keyPoints: result.keyPoints,
      'processingSteps.summarization.status': 'completed',
      'processingSteps.summarization.completedAt': new Date(),
    });
  }

  return sendSuccess(res, {
    sessionId: session?._id || null,
    summary: result.summary,
    keyPoints: result.keyPoints,
    provider: result.provider,
  }, 'Transcript summarized successfully');
};

// ─── POST /api/text-to-speech ─────────────────────────────────────────────────
const textToSpeech = async (req, res) => {
  const { text, sessionId } = req.body;

  if (!text && !sessionId) {
    return sendError(res, 'Provide either text or a sessionId', 400);
  }

  let inputText = text;
  let session = null;

  if (sessionId) {
    session = await Session.findById(sessionId);
    if (!session) return sendError(res, 'Session not found', 404);

    inputText = session.summary || session.transcript;
    if (!inputText) return sendError(res, 'Session has no summary or transcript to convert', 409);
  }

  if (!inputText || inputText.trim().length === 0) {
    return sendError(res, 'Text cannot be empty', 422);
  }

  const ttsResult = await convertTextToSpeech(inputText);

  if (session) {
    await Session.findByIdAndUpdate(sessionId, {
      ttsAudioUrl: ttsResult.audioUrl,
      ttsAudioPath: ttsResult.audioPath,
    });
  }

  return sendSuccess(res, {
    sessionId: session?._id || null,
    audioUrl: ttsResult.audioUrl,
    provider: ttsResult.provider,
    voice: ttsResult.voice || null,
    inputTextLength: inputText.length,
  }, 'Text converted to speech successfully');
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatSession = (s) => ({
  id: s._id,
  userId: s.userId,
  title: s.title,
  status: s.status,
  audioUrl: s.audioUrl,
  createdAt: s.createdAt,
  processingSteps: s.processingSteps,
});

module.exports = { uploadAudio, summarizeSession, textToSpeech };
