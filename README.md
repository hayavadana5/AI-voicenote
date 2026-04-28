# 🎙️ Personalized Voice Assistant — Backend API

A production-ready Node.js/Express backend that lets users upload audio, auto-transcribes speech to text (OpenAI Whisper), summarises with AI (GPT-4o-mini), converts summaries back to speech (OpenAI TTS or Google TTS), and persists everything in MongoDB.

---

## 📁 Project Structure

```
voice-assistant-backend/
├── server.js                        # Entry point
├── package.json
├── .env.example                     # Environment variable template
├── uploads/                         # Auto-created — audio files stored here
└── src/
    ├── controllers/
    │   ├── audioController.js       # Upload, summarize, TTS logic
    │   └── sessionController.js     # CRUD for sessions
    ├── middleware/
    │   ├── uploadMiddleware.js      # Multer config
    │   └── errorMiddleware.js       # Global error + 404 handlers
    ├── models/
    │   └── Session.js               # Mongoose schema
    ├── routes/
    │   ├── audioRoutes.js           # POST /upload /summarize /text-to-speech
    │   └── sessionRoutes.js         # GET|PATCH|DELETE /sessions
    ├── services/
    │   ├── speechToTextService.js   # OpenAI Whisper / AssemblyAI
    │   ├── summarizationService.js  # GPT-4o-mini / extractive fallback
    │   └── textToSpeechService.js   # OpenAI TTS / Google TTS
    └── utils/
        ├── database.js              # MongoDB connection
        └── responseHelper.js        # Structured JSON helpers
```

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add MONGODB_URI and OPENAI_API_KEY at minimum

# 3. Start development server
npm run dev

# 4. Verify health
curl http://localhost:5000/health
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `OPENAI_API_KEY` | ✅* | Powers Whisper STT + GPT summary + TTS |
| `ASSEMBLYAI_API_KEY` | Optional | STT fallback when OpenAI key absent |
| `GOOGLE_TTS_API_KEY` | Optional | Google Cloud TTS alternative |
| `TTS_PROVIDER` | Optional | `openai` (default) or `google` |
| `PORT` | Optional | Default `5000` |
| `BASE_URL` | Optional | Used to build audio file URLs |
| `MAX_FILE_SIZE_MB` | Optional | Default `50` |

*App runs in mock/dev mode without API keys — useful for testing the flow.

---

## 📡 API Reference

### Health Check

```
GET /health
```

**Response**
```json
{
  "success": true,
  "message": "Voice Assistant API is running",
  "timestamp": "2025-06-10T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

### POST /api/upload

Upload an audio file. Returns immediately with a session ID; transcription and summarisation run in the background.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `audio` | File | ✅ | Audio file (.mp3 .wav .webm .ogg .m4a .flac) |
| `userId` | String | — | Defaults to `"anonymous"` |
| `title` | String | — | Session title |
| `tags` | String | — | Comma-separated tags |
| `language` | String | — | Default `"en"` |

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "audio=@/path/to/recording.mp3" \
  -F "userId=user_123" \
  -F "title=Team standup notes" \
  -F "tags=meeting,standup"
```

**Response** `201`
```json
{
  "success": true,
  "message": "Audio uploaded. Transcription in progress.",
  "data": {
    "id": "6657a1f3c4e5d8001a2b3c4d",
    "userId": "user_123",
    "title": "Team standup notes",
    "status": "transcribing",
    "audioUrl": "http://localhost:5000/audio/9f3b2c1a-....mp3",
    "createdAt": "2025-06-10T12:00:00.000Z",
    "processingSteps": {
      "upload": { "status": "completed", "completedAt": "2025-06-10T12:00:00.123Z" },
      "transcription": { "status": "processing", "startedAt": "2025-06-10T12:00:00.130Z", "completedAt": null },
      "summarization": { "status": "pending", "startedAt": null, "completedAt": null }
    }
  },
  "meta": { "timestamp": "2025-06-10T12:00:00.500Z" }
}
```

---

### POST /api/summarize

Summarise a session transcript (or provide raw transcript text).

**Request** `application/json`

```json
{ "sessionId": "6657a1f3c4e5d8001a2b3c4d" }
```

or

```json
{ "transcript": "Today we discussed Q3 targets. The team agreed to prioritize..." }
```

**Response** `200`
```json
{
  "success": true,
  "message": "Transcript summarized successfully",
  "data": {
    "sessionId": "6657a1f3c4e5d8001a2b3c4d",
    "summary": "The team reviewed Q3 performance targets and agreed on three priority initiatives for the next sprint. Action items were assigned to individual contributors with a two-week deadline.",
    "keyPoints": [
      "Q3 targets reviewed — revenue goal remains at $1.2M",
      "Three priority initiatives identified for next sprint",
      "Action items assigned with 2-week deadline",
      "Next sync scheduled for Friday at 10 AM",
      "Design review to be completed by Wednesday"
    ],
    "provider": "openai"
  },
  "meta": { "timestamp": "2025-06-10T12:01:00.000Z" }
}
```

---

### POST /api/text-to-speech

Convert text (or a session's summary) to speech.

**Request** `application/json`

```json
{ "sessionId": "6657a1f3c4e5d8001a2b3c4d" }
```

or

```json
{ "text": "The team reviewed Q3 targets and agreed on three priority initiatives." }
```

**Response** `200`
```json
{
  "success": true,
  "message": "Text converted to speech successfully",
  "data": {
    "sessionId": "6657a1f3c4e5d8001a2b3c4d",
    "audioUrl": "http://localhost:5000/audio/tts_7d8e9f0a-....mp3",
    "provider": "openai-tts",
    "voice": "alloy",
    "inputTextLength": 312
  },
  "meta": { "timestamp": "2025-06-10T12:02:00.000Z" }
}
```

---

### GET /api/sessions

List all sessions with pagination.

**Query params** — all optional

| Param | Default | Description |
|---|---|---|
| `userId` | — | Filter by user |
| `status` | — | `pending` `transcribing` `summarizing` `completed` `failed` |
| `page` | `1` | Page number |
| `limit` | `10` | Results per page |
| `sortBy` | `createdAt` | Sort field |
| `order` | `desc` | `asc` or `desc` |

```bash
curl "http://localhost:5000/api/sessions?userId=user_123&page=1&limit=5"
```

**Response** `200`
```json
{
  "success": true,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "_id": "6657a1f3c4e5d8001a2b3c4d",
        "userId": "user_123",
        "title": "Team standup notes",
        "status": "completed",
        "audioUrl": "http://localhost:5000/audio/9f3b2c1a-....mp3",
        "audioDuration": 183.4,
        "wordCount": 412,
        "tags": ["meeting", "standup"],
        "keyPoints": ["Q3 targets reviewed", "Three initiatives identified"],
        "createdAt": "2025-06-10T12:00:00.000Z",
        "updatedAt": "2025-06-10T12:01:45.000Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-06-10T12:05:00.000Z",
    "pagination": { "page": 1, "limit": 5, "total": 23, "pages": 5 }
  }
}
```

---

### GET /api/sessions/:id

Get full session detail including transcript, summary, key points, and TTS URL.

```bash
curl http://localhost:5000/api/sessions/6657a1f3c4e5d8001a2b3c4d
```

**Response** `200`
```json
{
  "success": true,
  "message": "Session retrieved successfully",
  "data": {
    "session": {
      "_id": "6657a1f3c4e5d8001a2b3c4d",
      "userId": "user_123",
      "title": "Team standup notes",
      "status": "completed",
      "audioUrl": "http://localhost:5000/audio/9f3b2c1a-....mp3",
      "audioDuration": 183.4,
      "audioDurationFormatted": "3:03",
      "wordCount": 412,
      "transcript": "Good morning everyone. Today we're going to review our Q3 targets...",
      "timestampedSentences": [
        { "text": "Good morning everyone.", "startTime": 0.0, "endTime": 1.8 },
        { "text": "Today we're going to review our Q3 targets.", "startTime": 1.9, "endTime": 4.5 }
      ],
      "summary": "The team reviewed Q3 performance targets and agreed on three priority initiatives.",
      "keyPoints": [
        "Q3 targets reviewed — revenue goal remains at $1.2M",
        "Three priority initiatives identified for next sprint"
      ],
      "ttsAudioUrl": "http://localhost:5000/audio/tts_7d8e9f0a-....mp3",
      "language": "en",
      "tags": ["meeting", "standup"],
      "processingSteps": {
        "upload": { "status": "completed", "completedAt": "2025-06-10T12:00:00.123Z" },
        "transcription": { "status": "completed", "startedAt": "2025-06-10T12:00:00.130Z", "completedAt": "2025-06-10T12:00:18.000Z" },
        "summarization": { "status": "completed", "startedAt": "2025-06-10T12:00:18.010Z", "completedAt": "2025-06-10T12:00:21.500Z" }
      },
      "createdAt": "2025-06-10T12:00:00.000Z",
      "updatedAt": "2025-06-10T12:00:21.500Z"
    }
  },
  "meta": { "timestamp": "2025-06-10T12:05:30.000Z" }
}
```

---

## 🔄 Processing Flow

```
User uploads audio
      │
      ▼
POST /api/upload
  ├─ Multer saves file to /uploads
  ├─ Session created (status: "transcribing")
  ├─ 201 response returned immediately ◄── client gets session ID
  └─ Background (async):
       ├─ Whisper API transcribes audio (status → "summarizing")
       ├─ GPT summarizes transcript     (status → "completed")
       └─ All stored in MongoDB

Client polls GET /api/sessions/:id until status === "completed"

      │
      ▼
POST /api/text-to-speech  { sessionId }
  └─ Summary → OpenAI TTS → MP3 stored + URL returned
```

---

## 🚀 Deploy to Render / Railway

### Render

1. Push project to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env vars in the Render dashboard (all from `.env.example`)
6. Use a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster for `MONGODB_URI`

### Railway

```bash
railway login
railway init
railway up
railway vars set OPENAI_API_KEY=sk-... MONGODB_URI=mongodb+srv://...
```

---

## 🛡️ Supported Audio Formats

`.mp3` `.wav` `.webm` `.ogg` `.m4a` `.flac` — max 50 MB (configurable via `MAX_FILE_SIZE_MB`)
