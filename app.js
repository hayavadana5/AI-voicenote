/* =====================================================
   Personal Voice Assistant — JavaScript
   Features: MediaRecorder, SpeechRecognition,
   SpeechSynthesis, localStorage, dark mode, search
   ===================================================== */

'use strict';

// ── DOM References ──────────────────────────────────
const recordBtn          = document.getElementById('recordBtn');
const micIcon            = document.getElementById('micIcon');
const stopIcon           = document.getElementById('stopIcon');
const recDot             = document.getElementById('recDot');
const recStatus          = document.getElementById('recStatus');
const timerEl            = document.getElementById('timer');
const transcriptionBox   = document.getElementById('transcriptionBox');
const transcriptionText  = document.getElementById('transcriptionText');
const transcriptionPH    = document.getElementById('transcriptionPlaceholder');
const saveBtn            = document.getElementById('saveBtn');
const recordHint         = document.getElementById('recordHint');
const sessionsGrid       = document.getElementById('sessionsGrid');
const emptyState         = document.getElementById('emptyState');
const sessionCountEl     = document.getElementById('sessionCount');
const searchInput        = document.getElementById('searchInput');
const themeToggle        = document.getElementById('themeToggle');
const toast              = document.getElementById('toast');
const cardTemplate       = document.getElementById('sessionCardTemplate');

// ── State ────────────────────────────────────────────
let isRecording     = false;
let mediaRecorder   = null;
let recognition     = null;
let timerInterval   = null;
let timerSeconds    = 0;
let fullTranscript  = '';   // accumulated final transcript
let liveTranscript  = '';   // interim (in-progress) text
let currentSearchQuery = '';
let speakingCardId  = null; // which card is currently being spoken

// ── Keywords to highlight (can be expanded) ──────────
const KEYWORDS = [
  'important', 'note', 'remember', 'deadline', 'urgent', 'task',
  'action', 'key', 'critical', 'follow up', 'meeting', 'idea',
  'project', 'goal', 'priority', 'review', 'decision', 'plan'
];

// ── Toast Utility ─────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Timer ─────────────────────────────────────────────
function startTimer() {
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ── Transcription Display ─────────────────────────────
function setTranscription(text, isRecordingNow = false) {
  if (!text) {
    transcriptionText.textContent = '';
    transcriptionText.classList.remove('has-text', 'recording');
    transcriptionPH.style.display = '';
    return;
  }
  transcriptionText.textContent = text;
  transcriptionText.classList.add('has-text');
  transcriptionText.classList.toggle('recording', isRecordingNow);
  transcriptionPH.style.display = 'none';
}

// ── Speech Recognition (Web Speech API) ──────────────
function setupRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('⚠️ Speech recognition not supported in this browser.');
    return null;
  }

  const rec = new SpeechRecognition();
  rec.continuous    = true;
  rec.interimResults = true;
  rec.lang          = 'en-US';

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        fullTranscript += result[0].transcript + ' ';
      } else {
        interim += result[0].transcript;
      }
    }
    liveTranscript = interim;
    // Show final + live text
    const displayText = fullTranscript + liveTranscript;
    setTranscription(displayText, true);
    // Enable save if there's something to save
    saveBtn.disabled = displayText.trim() === '';
  };

  rec.onerror = (event) => {
    if (event.error === 'not-allowed') {
      showToast('🎤 Microphone access denied.');
      stopRecording();
    } else if (event.error !== 'no-speech') {
      console.warn('SpeechRecognition error:', event.error);
    }
  };

  rec.onend = () => {
    // Auto-restart recognition while recording is still active
    if (isRecording) {
      try { rec.start(); } catch (_) {}
    }
  };

  return rec;
}

// ── MediaRecorder (Audio Capture) ─────────────────────
async function startMediaRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    return true;
  } catch (err) {
    showToast('🎤 Cannot access microphone. Please allow permission.');
    console.error(err);
    return false;
  }
}

function stopMediaRecorder() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    // Stop all tracks to release mic
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
}

// ── Start / Stop Recording ────────────────────────────
async function startRecording() {
  // Reset state
  fullTranscript = '';
  liveTranscript = '';
  setTranscription('');
  saveBtn.disabled = true;

  // Setup recognition
  recognition = setupRecognition();

  // Request mic access
  const granted = await startMediaRecorder();
  if (!granted) return;

  isRecording = true;

  // Start recognition
  if (recognition) {
    try { recognition.start(); } catch (_) {}
  }

  // UI updates
  recordBtn.classList.add('recording');
  micIcon.classList.add('hidden');
  stopIcon.classList.remove('hidden');
  recDot.classList.add('active');
  recStatus.textContent = 'Recording…';
  recordHint.textContent = 'Tap to stop recording';
  transcriptionBox.classList.add('active');
  startTimer();
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  // Stop recognition
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }

  // Stop media
  stopMediaRecorder();
  stopTimer();

  // Final transcript
  const finalText = (fullTranscript + liveTranscript).trim();
  setTranscription(finalText || '', false);

  // UI updates
  recordBtn.classList.remove('recording');
  micIcon.classList.remove('hidden');
  stopIcon.classList.add('hidden');
  recDot.classList.remove('active');
  recStatus.textContent = finalText ? 'Done — ready to save' : 'Ready to record';
  recordHint.textContent = 'Tap to start recording';
  transcriptionBox.classList.remove('active');

  // Enable save only if there's text
  saveBtn.disabled = !finalText;
}

// Toggle handler
recordBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

// ── Session Management (localStorage) ─────────────────
const STORAGE_KEY = 'pva_sessions';

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function saveNewSession() {
  const text = (fullTranscript + liveTranscript).trim();
  if (!text) { showToast('Nothing to save — record some audio first.'); return; }

  const sessions = loadSessions();
  const newSession = {
    id:        Date.now().toString(),
    timestamp: new Date().toISOString(),
    text,
    duration:  timerSeconds
  };

  sessions.unshift(newSession); // newest first
  saveSessions(sessions);

  // Reset recording panel
  fullTranscript = '';
  liveTranscript = '';
  setTranscription('');
  saveBtn.disabled = true;
  timerSeconds = 0;
  updateTimerDisplay();
  recStatus.textContent = 'Ready to record';

  renderSessions();
  showToast('✅ Session saved!');
}

saveBtn.addEventListener('click', saveNewSession);

// ── Render Sessions ────────────────────────────────────
function renderSessions(query = '') {
  let sessions = loadSessions();
  const q = query.trim().toLowerCase();

  if (q) {
    sessions = sessions.filter(s => s.text.toLowerCase().includes(q));
  }

  // Update count
  const total = loadSessions().length;
  sessionCountEl.textContent = `${total} session${total !== 1 ? 's' : ''}`;

  // Show/hide empty state
  const allSessions = loadSessions();
  emptyState.style.display = allSessions.length === 0 ? '' : 'none';

  sessionsGrid.innerHTML = '';

  if (sessions.length === 0 && q) {
    sessionsGrid.innerHTML = `<p style="color:var(--text-3);font-size:14px;padding:20px 0">No sessions match "<strong>${escapeHtml(q)}</strong>"</p>`;
    return;
  }

  sessions.forEach((session, index) => {
    const card = buildCard(session, q);
    // Stagger animation
    card.style.animationDelay = `${index * 0.05}s`;
    sessionsGrid.appendChild(card);
  });
}

// ── Build a Session Card ───────────────────────────────
function buildCard(session, highlightQuery = '') {
  const tpl = cardTemplate.content.cloneNode(true);
  const card = tpl.querySelector('.session-card');

  card.dataset.id = session.id;

  // Date
  const date = new Date(session.timestamp);
  card.querySelector('.card-date').textContent = formatDate(date);

  // Duration badge
  card.querySelector('.card-duration').textContent =
    session.duration ? formatDuration(session.duration) : '';

  // Text (with keyword highlighting + search highlighting)
  const textEl = card.querySelector('.card-text');
  textEl.innerHTML = highlightText(session.text, highlightQuery);

  // Keyword tags
  const keywordsEl = card.querySelector('.card-keywords');
  const foundKeywords = extractKeywords(session.text);
  foundKeywords.forEach(kw => {
    const tag = document.createElement('span');
    tag.className = 'keyword-tag';
    tag.textContent = kw;
    keywordsEl.appendChild(tag);
  });

  // ── Speak button
  const speakBtn = card.querySelector('.btn-speak');
  speakBtn.addEventListener('click', () => {
    speakText(session.text, session.id, speakBtn);
  });

  // ── Copy button
  const copyBtn = card.querySelector('.btn-copy');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(session.text)
      .then(() => showToast('📋 Copied to clipboard!'))
      .catch(() => showToast('Could not copy text.'));
  });

  // ── Delete button
  const deleteBtn = card.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => {
    deleteSession(session.id);
  });

  return card;
}

// ── Text Helpers ───────────────────────────────────────
function formatDate(date) {
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Highlights:
 * 1. Predefined keywords
 * 2. Current search query
 */
function highlightText(text, searchQuery = '') {
  let safe = escapeHtml(text);

  // Highlight keywords
  KEYWORDS.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    safe = safe.replace(regex, '<mark class="keyword-highlight">$1</mark>');
  });

  // Highlight search query
  if (searchQuery) {
    const regex = new RegExp(`(${escapeRegex(escapeHtml(searchQuery))})`, 'gi');
    safe = safe.replace(regex, '<mark style="background:rgba(232,112,74,0.4);border-radius:3px;padding:0 2px">$1</mark>');
  }

  return safe;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywords(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter(kw => lower.includes(kw)).slice(0, 4);
}

// ── Delete Session ─────────────────────────────────────
function deleteSession(id) {
  // Animate out
  const card = sessionsGrid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.95)';
    setTimeout(() => {
      const sessions = loadSessions().filter(s => s.id !== id);
      saveSessions(sessions);
      renderSessions(currentSearchQuery);
    }, 200);
  } else {
    const sessions = loadSessions().filter(s => s.id !== id);
    saveSessions(sessions);
    renderSessions(currentSearchQuery);
  }
  showToast('🗑️ Session deleted.');
}

// ── Text-to-Speech (SpeechSynthesis) ──────────────────
function speakText(text, id, btn) {
  if (!window.speechSynthesis) {
    showToast('❌ Speech synthesis not supported.');
    return;
  }

  // If already speaking this card, stop it
  if (speakingCardId === id) {
    window.speechSynthesis.cancel();
    speakingCardId = null;
    btn.classList.remove('speaking');
    btn.querySelector('svg + span, span')?.textContent;
    btn.innerHTML = btn.innerHTML.replace('Stop', 'Speak');
    return;
  }

  // Cancel any existing speech
  window.speechSynthesis.cancel();

  // Reset previous speaking button if any
  document.querySelectorAll('.btn-speak.speaking').forEach(b => {
    b.classList.remove('speaking');
  });

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate   = 0.95;
  utterance.pitch  = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    speakingCardId = id;
    btn.classList.add('speaking');
  };

  utterance.onend = utterance.onerror = () => {
    speakingCardId = null;
    btn.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utterance);
}

// ── Search ─────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  currentSearchQuery = searchInput.value;
  renderSessions(currentSearchQuery);
});

// ── Dark Mode Toggle ───────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('pva_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pva_theme', next);
});

// ── Keyboard Shortcut ──────────────────────────────────
// Press Space to start/stop (when not focused on an input)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    recordBtn.click();
  }
});

// ── Init ───────────────────────────────────────────────
function init() {
  initTheme();
  renderSessions();
}

init();
