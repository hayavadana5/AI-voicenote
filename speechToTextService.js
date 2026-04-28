/**
 * Speech-to-Text Service
 *
 * Primary:  OpenAI Whisper API  (set OPENAI_API_KEY)
 * Fallback: AssemblyAI          (set ASSEMBLYAI_API_KEY)
 *
 * Both return:
 *   { transcript: string, timestampedSentences: [{text, startTime, endTime}], duration: number|null }
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ─── OpenAI Whisper ───────────────────────────────────────────────────────────

const transcribeWithWhisper = async (filePath) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: 'audio/mpeg',
  });
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Whisper API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();

  const timestampedSentences = (data.segments || []).map((seg) => ({
    text: seg.text.trim(),
    startTime: Math.round(seg.start * 10) / 10,
    endTime: Math.round(seg.end * 10) / 10,
  }));

  return {
    transcript: data.text?.trim() || '',
    timestampedSentences,
    duration: data.duration ?? null,
    language: data.language || null,
    provider: 'openai-whisper',
  };
};

// ─── AssemblyAI (fallback) ────────────────────────────────────────────────────

const transcribeWithAssemblyAI = async (filePath) => {
  const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
  if (!ASSEMBLYAI_API_KEY) throw new Error('ASSEMBLYAI_API_KEY not set');

  // Step 1: Upload file
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/octet-stream' },
    body: fileBuffer,
  });
  const { upload_url } = await uploadRes.json();

  // Step 2: Request transcription
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, auto_highlights: true }),
  });
  const { id } = await transcriptRes.json();

  // Step 3: Poll for completion
  const MAX_POLLS = 60;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
    });
    const result = await pollRes.json();

    if (result.status === 'completed') {
      const timestampedSentences = (result.sentences || result.words || []).map((s) => ({
        text: s.text,
        startTime: Math.round((s.start / 1000) * 10) / 10,
        endTime: Math.round((s.end / 1000) * 10) / 10,
      }));
      return {
        transcript: result.text || '',
        timestampedSentences,
        duration: result.audio_duration ?? null,
        language: result.language_code || null,
        provider: 'assemblyai',
      };
    }

    if (result.status === 'error') {
      throw new Error(`AssemblyAI error: ${result.error}`);
    }
  }

  throw new Error('AssemblyAI transcription timed out after 3 minutes');
};

// ─── Main export (with provider auto-selection) ───────────────────────────────

const transcribeAudio = async (filePath) => {
  if (process.env.OPENAI_API_KEY) {
    return transcribeWithWhisper(filePath);
  }
  if (process.env.ASSEMBLYAI_API_KEY) {
    return transcribeWithAssemblyAI(filePath);
  }

  // Demo/dev mode — return a mock transcript so the API still works without keys
  console.warn('⚠️  No STT API key found. Returning mock transcript for development.');
  return {
    transcript:
      'This is a mock transcript generated in development mode. Please set OPENAI_API_KEY or ASSEMBLYAI_API_KEY to enable real speech-to-text processing.',
    timestampedSentences: [
      { text: 'This is a mock transcript generated in development mode.', startTime: 0, endTime: 4.5 },
      { text: 'Please set OPENAI_API_KEY or ASSEMBLYAI_API_KEY to enable real speech-to-text processing.', startTime: 4.5, endTime: 9.0 },
    ],
    duration: 9.0,
    language: 'en',
    provider: 'mock',
  };
};

module.exports = { transcribeAudio };
