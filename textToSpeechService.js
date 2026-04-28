/**
 * Text-to-Speech Service
 *
 * Provider priority:
 *   1. OpenAI TTS   (OPENAI_API_KEY + TTS_PROVIDER=openai or no explicit choice)
 *   2. Google Cloud TTS  (GOOGLE_TTS_API_KEY)
 *   3. Mock          (dev fallback — returns a pre-existing silence file)
 *
 * Output: saves .mp3 to uploads/ and returns { audioPath, audioUrl, provider }
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { UPLOAD_DIR } = require('../middleware/uploadMiddleware');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildAudioUrl = (filename) => {
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base}/audio/${filename}`;
};

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

const ttsWithOpenAI = async (text) => {
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy'; // alloy|echo|fable|onyx|nova|shimmer
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text.slice(0, 4096), voice }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI TTS error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const filename = `tts_${uuidv4()}.mp3`;
  const audioPath = path.join(UPLOAD_DIR, filename);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));

  return { audioPath, audioUrl: buildAudioUrl(filename), provider: 'openai-tts', voice };
};

// ─── Google Cloud TTS ─────────────────────────────────────────────────────────

const ttsWithGoogle = async (text) => {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  const voiceName = process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-C';
  const languageCode = process.env.GOOGLE_TTS_LANGUAGE || 'en-US';

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.slice(0, 5000) },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Google TTS error ${response.status}: ${JSON.stringify(err)}`);
  }

  const { audioContent } = await response.json();
  const filename = `tts_${uuidv4()}.mp3`;
  const audioPath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(audioPath, Buffer.from(audioContent, 'base64'));

  return { audioPath, audioUrl: buildAudioUrl(filename), provider: 'google-tts', voice: voiceName };
};

// ─── Mock fallback ────────────────────────────────────────────────────────────

const ttsMock = async (text) => {
  console.warn('⚠️  No TTS API key found. Returning mock TTS response.');
  // Write a tiny placeholder file so the URL actually resolves
  const filename = `tts_mock_${uuidv4()}.mp3`;
  const audioPath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(audioPath, Buffer.alloc(0)); // empty file — replace with real audio in prod

  return {
    audioPath,
    audioUrl: buildAudioUrl(filename),
    provider: 'mock',
    note: 'Set OPENAI_API_KEY or GOOGLE_TTS_API_KEY to generate real audio',
    inputTextLength: text.length,
  };
};

// ─── Main export ──────────────────────────────────────────────────────────────

const convertTextToSpeech = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS conversion');
  }

  const provider = process.env.TTS_PROVIDER?.toLowerCase();

  if (provider === 'google' && process.env.GOOGLE_TTS_API_KEY) return ttsWithGoogle(text);
  if (process.env.OPENAI_API_KEY) return ttsWithOpenAI(text);
  if (process.env.GOOGLE_TTS_API_KEY) return ttsWithGoogle(text);

  return ttsMock(text);
};

module.exports = { convertTextToSpeech };
