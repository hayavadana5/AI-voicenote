const mongoose = require('mongoose');

const TimestampedSentenceSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    startTime: { type: Number, default: null }, // seconds from audio start
    endTime: { type: Number, default: null },
  },
  { _id: false }
);

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: 'anonymous',
      index: true,
    },

    // ── Audio ──────────────────────────────────────────────────────────────
    audioFileName: { type: String, default: null },
    audioFilePath: { type: String, default: null },
    audioMimeType: { type: String, default: null },
    audioDuration: { type: Number, default: null }, // seconds
    audioUrl: { type: String, default: null },

    // ── Transcript ─────────────────────────────────────────────────────────
    transcript: { type: String, default: null },
    timestampedSentences: { type: [TimestampedSentenceSchema], default: [] },

    // ── Summary ────────────────────────────────────────────────────────────
    summary: { type: String, default: null },
    keyPoints: { type: [String], default: [] },

    // ── TTS Output ─────────────────────────────────────────────────────────
    ttsAudioUrl: { type: String, default: null },
    ttsAudioPath: { type: String, default: null },

    // ── Processing Status ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'uploading', 'transcribing', 'summarizing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    processingSteps: {
      upload: {
        status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
        completedAt: { type: Date, default: null },
      },
      transcription: {
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
      },
      summarization: {
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
      },
    },
    errorMessage: { type: String, default: null },

    // ── Metadata ───────────────────────────────────────────────────────────
    title: { type: String, default: null },
    tags: { type: [String], default: [] },
    language: { type: String, default: 'en' },
    wordCount: { type: Number, default: null },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: human-readable duration
SessionSchema.virtual('audioDurationFormatted').get(function () {
  if (!this.audioDuration) return null;
  const m = Math.floor(this.audioDuration / 60);
  const s = Math.floor(this.audioDuration % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
});

module.exports = mongoose.model('Session', SessionSchema);
