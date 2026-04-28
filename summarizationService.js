/**
 * Summarization Service
 *
 * Uses OpenAI Chat Completions (gpt-4o-mini by default) to:
 *   1. Extract key bullet points from a transcript
 *   2. Generate a concise paragraph summary
 *
 * Falls back to a simple extractive summary when no API key is available.
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ─── OpenAI summarization ──────────────────────────────────────────────────────

const summarizeWithOpenAI = async (transcript) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUMMARIZE_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are a helpful assistant that summarises audio transcripts.
Return ONLY valid JSON with this exact shape:
{
  "summary": "<2-3 sentence paragraph summary>",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>", "<point 4>", "<point 5>"]
}
Rules:
- keyPoints: 3–7 concise bullet-style strings, each under 20 words
- summary: neutral, professional, third-person where possible
- No markdown, no extra keys, no trailing commas`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Transcript:\n\n${transcript.slice(0, 12000)}`, // safety truncation
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI summarize error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '{}';

  // Strip potential ```json fences
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary || '',
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    provider: 'openai',
    model,
  };
};

// ─── Extractive fallback ──────────────────────────────────────────────────────

const extractiveSummary = (transcript) => {
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
  const wordCount = transcript.split(/\s+/).length;

  // Pick every Nth sentence as a "key point"
  const stride = Math.max(1, Math.floor(sentences.length / 5));
  const keyPoints = sentences.filter((_, i) => i % stride === 0).slice(0, 6).map((s) => s.trim());

  const summary = sentences.slice(0, 3).join(' ').trim();

  return {
    summary: summary || transcript.slice(0, 300),
    keyPoints,
    wordCount,
    provider: 'extractive-fallback',
  };
};

// ─── Main export ──────────────────────────────────────────────────────────────

const summarizeTranscript = async (transcript) => {
  if (!transcript || transcript.trim().length < 10) {
    throw new Error('Transcript is too short to summarize');
  }

  if (process.env.OPENAI_API_KEY) {
    return summarizeWithOpenAI(transcript);
  }

  console.warn('⚠️  OPENAI_API_KEY not set. Using extractive fallback summarizer.');
  return extractiveSummary(transcript);
};

module.exports = { summarizeTranscript };
