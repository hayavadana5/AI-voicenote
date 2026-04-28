import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  CalendarDays,
  Clock,
  LogOut,
  Mic,
  MicOff,
  Moon,
  Sparkles,
  Sun,
  User,
  Volume2,
  Wand2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (isSignup && form.name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }

    if (!form.email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const data = await api(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: form
      });

      localStorage.setItem("voice_ai_token", data.token);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb44,transparent_35%),radial-gradient(circle_at_bottom_right,#9333ea44,transparent_35%)]" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-glow">
            <Sparkles />
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Voice Scheduler AI
          </h1>

          <p className="mt-2 text-slate-300">
            Login and start scheduling meetings with your voice.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isSignup && (
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-400"
              placeholder="Your name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          )}

          <input
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-400"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
          />

          <input
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-400"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />

          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-blue-500 px-4 py-3 font-bold text-white shadow-glow transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait..." : isSignup ? "Create account" : "Login"}
          </button>
        </form>

        <button
          onClick={() => setMode(isSignup ? "login" : "signup")}
          className="mt-6 w-full text-sm text-slate-300 hover:text-white"
        >
          {isSignup
            ? "Already have an account? Login"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

function MeetingCard({ meeting }) {
  const isCancelled = meeting.status === "cancelled";

  return (
    <div
      className={classNames(
        "rounded-2xl border p-4 transition",
        isCancelled
          ? "border-slate-300/20 bg-slate-500/10 opacity-60"
          : "border-blue-400/20 bg-white/70 shadow-sm dark:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">
            {meeting.title}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1">
              <CalendarDays size={14} />
              {meeting.date}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1">
              <Clock size={14} />
              {meeting.startTime} - {meeting.endTime}
            </span>
          </div>
        </div>

        <span
          className={classNames(
            "rounded-full px-2 py-1 text-xs font-bold",
            isCancelled
              ? "bg-slate-500/20 text-slate-500 dark:text-slate-300"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          )}
        >
          {meeting.status}
        </span>
      </div>

      {meeting.participants?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {meeting.participants.map((p) => (
            <span
              key={p}
              className="rounded-full bg-slate-900/5 px-2 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {meeting.notes && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {meeting.notes}
        </p>
      )}
    </div>
  );
}

function EntityPanel({ extracted }) {
  if (!extracted) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        Extracted intent, date, time, participants, and notes will appear here.
      </div>
    );
  }

  const chips = [
    ["Intent", extracted.intent],
    ["Title", extracted.title],
    ["Date", extracted.date || extracted.newDate],
    ["Time", extracted.time || extracted.newTime],
    [
      "Duration",
      extracted.durationMinutes ? `${extracted.durationMinutes} min` : null
    ],
    [
      "Confidence",
      extracted.confidence != null
        ? `${Math.round(extracted.confidence * 100)}%`
        : null
    ]
  ].filter(([, value]) => value);

  return (
    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
        <Wand2 size={18} />
        Extracted Entities
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map(([label, value]) => (
          <span
            key={label}
            className="rounded-full border border-blue-400/20 bg-white px-3 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-100"
          >
            <b>{label}:</b> {String(value)}
          </span>
        ))}

        {extracted.participants?.map((p) => (
          <span
            key={p}
            className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-700 dark:text-purple-200"
          >
            Participant: {p}
          </span>
        ))}
      </div>

      {extracted.followUpQuestion && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-300">
          Follow-up: {extracted.followUpQuestion}
        </p>
      )}
    </div>
  );
}

function Dashboard({ token, user, onLogout }) {
  const [dark, setDark] = useState(true);
  const [meetings, setMeetings] = useState([]);
  const [conversation, setConversation] = useState([
    {
      role: "assistant",
      text: "Hi! Click Start Listening and say something like: Schedule a meeting with John tomorrow at 5 PM."
    }
  ]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const lastProcessedRef = useRef("");
  const contextRef = useRef({});

  const timezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    api("/api/meetings", { token })
      .then((data) => setMeetings(data.meetings))
      .catch((err) => setError(err.message));

    const socket = io(API_URL, {
      auth: { token }
    });

    socket.on("meetings:changed", (items) => {
      setMeetings(items);
    });

    socket.on("connect_error", () => {
      setError("Real-time socket connection failed.");
    });

    return () => socket.disconnect();
  }, [token]);

  function addMessage(role, text) {
    setConversation((items) => [
      ...items,
      {
        role,
        text,
        at: new Date().toISOString()
      }
    ]);
  }

  function resetSpeechBuffer() {
    liveTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    setLiveTranscript("");
  }

  function stopRecognitionOnly() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Browser may throw if recognition is already stopped.
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    assistantSpeakingRef.current = true;
    setAssistantSpeaking(true);

    stopRecognitionOnly();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    utterance.onend = () => {
      assistantSpeakingRef.current = false;
      setAssistantSpeaking(false);

      if (listeningRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {
            // Ignore duplicate start errors.
          }
        }, 400);
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function processTranscript() {
    const transcript = liveTranscriptRef.current.trim();

    if (!transcript || transcript.length < 2) return;
    if (transcript === lastProcessedRef.current) return;

    lastProcessedRef.current = transcript;
    resetSpeechBuffer();

    try {
      setProcessing(true);
      setError("");
      addMessage("user", transcript);

      const data = await api("/api/assistant/process", {
        method: "POST",
        token,
        body: {
          transcript,
          timezone,
          nowISO: new Date().toISOString(),
          context: contextRef.current
        }
      });

      setExtracted(data.extracted);
      addMessage("assistant", data.reply);
      speak(data.reply);

      const meetingFromAction = data.action?.meeting || data.meeting;

      if (meetingFromAction?.id) {
        contextRef.current = {
          ...contextRef.current,
          lastMeetingId: meetingFromAction.id,
          lastMeeting: meetingFromAction
        };
      }

      contextRef.current = {
        ...contextRef.current,
        lastTranscript: transcript,
        lastReply: data.reply,
        lastExtracted: data.extracted
      };
    } catch (err) {
      setError(err.message);
      addMessage("assistant", "Sorry, I could not process that.");
      speak("Sorry, I could not process that.");
    } finally {
      setProcessing(false);
    }
  }

  function scheduleSilenceDetection() {
    clearTimeout(silenceTimerRef.current);

    silenceTimerRef.current = setTimeout(() => {
      processTranscript();
    }, 2500);
  }

  function startListening() {
    setError("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onerror = (event) => {
        if (event.error !== "no-speech") {
          setError(`Speech error: ${event.error}`);
        }
      };

      recognition.onresult = (event) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            finalTranscriptRef.current += `${text} `;
          } else {
            interim += text;
          }
        }

        const live = `${finalTranscriptRef.current}${interim}`.trim();

        liveTranscriptRef.current = live;
        setLiveTranscript(live);

        if (live.length > 0) {
          scheduleSilenceDetection();
        }
      };

      recognition.onend = () => {
        setListening(false);

        if (listeningRef.current && !assistantSpeakingRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Ignore duplicate start errors.
            }
          }, 350);
        }
      };

      recognitionRef.current = recognition;
    }

    listeningRef.current = true;

    try {
      recognitionRef.current.start();
      speak("I am listening.");
    } catch {
      // If already started, ignore.
    }
  }

  function stopListening() {
    listeningRef.current = false;
    setListening(false);

    clearTimeout(silenceTimerRef.current);

    stopRecognitionOnly();

    window.speechSynthesis?.cancel();

    setAssistantSpeaking(false);
    assistantSpeakingRef.current = false;
  }

  function logout() {
    stopListening();
    localStorage.removeItem("voice_ai_token");
    onLogout();
  }

  const activeMeetings = meetings.filter((m) => m.status !== "cancelled");
  const cancelledMeetings = meetings.filter((m) => m.status === "cancelled");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 transition dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-glow">
                <Sparkles />
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight">
                  AI Voice Meeting Scheduler
                </h1>

                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Continuous voice loop: speech → AI → schedule → voice response
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10">
              <User size={16} />
              <span>{user.name}</span>
            </div>

            <button
              onClick={() => setDark((v) => !v)}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/10"
              title="Toggle dark mode"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={logout}
              className="rounded-2xl border border-red-300/40 bg-red-500/10 p-3 text-red-600 dark:text-red-300"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <main className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Scheduled Meetings</h2>

                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Updates instantly through Socket.IO.
                </p>
              </div>

              <div className="rounded-2xl bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-600 dark:text-blue-300">
                {activeMeetings.length} active
              </div>
            </div>

            <div className="space-y-3">
              {activeMeetings.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No meetings yet. Try saying: “Schedule a team sync tomorrow at 5 PM.”
                </div>
              )}

              {activeMeetings.map((meeting) => (
                <MeetingCard key={meeting.id || meeting._id} meeting={meeting} />
              ))}

              {cancelledMeetings.length > 0 && (
                <details className="pt-2">
                  <summary className="cursor-pointer text-sm font-bold text-slate-500 dark:text-slate-300">
                    Cancelled meetings ({cancelledMeetings.length})
                  </summary>

                  <div className="mt-3 space-y-3">
                    {cancelledMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id || meeting._id}
                        meeting={meeting}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">Live Assistant</h2>

                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Silence detection triggers AI after about 2.5 seconds.
                  </p>
                </div>

                <button
                  onClick={listeningRef.current ? stopListening : startListening}
                  className={classNames(
                    "relative flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black text-white transition",
                    listeningRef.current
                      ? "bg-red-500 hover:bg-red-400"
                      : "bg-blue-500 shadow-glow hover:bg-blue-400"
                  )}
                >
                  {listeningRef.current && (
                    <span className="pulse-ring absolute inset-0 rounded-2xl bg-red-400" />
                  )}

                  <span className="relative flex items-center gap-2">
                    {listeningRef.current ? (
                      <MicOff size={18} />
                    ) : (
                      <Mic size={18} />
                    )}

                    {listeningRef.current
                      ? "Stop Listening"
                      : "Start Listening"}
                  </span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Mic
                  </div>

                  <div className="mt-1 font-bold">
                    {listening
                      ? "Listening"
                      : listeningRef.current
                      ? "Restarting"
                      : "Off"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    AI
                  </div>

                  <div className="mt-1 font-bold">
                    {processing ? "Thinking..." : "Ready"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/80">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Volume2 size={14} />
                    Voice
                  </div>

                  <div className="mt-1 font-bold">
                    {assistantSpeaking ? "Speaking" : "Idle"}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/80">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">Live Transcription</h3>

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {liveTranscript ? "speech detected" : "waiting for speech"}
                  </span>
                </div>

                <p className="min-h-[76px] whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {liveTranscript ||
                    "Your words will appear here in real time..."}
                </p>
              </div>
            </div>

            <EntityPanel extracted={extracted} />

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
              <h2 className="mb-4 text-xl font-black">Conversation</h2>

              <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                {conversation.map((msg, index) => (
                  <div
                    key={`${msg.role}-${index}`}
                    className={classNames(
                      "rounded-2xl p-4 text-sm",
                      msg.role === "user"
                        ? "ml-8 bg-blue-500 text-white"
                        : "mr-8 bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100"
                    )}
                  >
                    <div className="mb-1 text-xs font-bold uppercase opacity-70">
                      {msg.role === "user" ? "You" : "Assistant"}
                    </div>

                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    token: localStorage.getItem("voice_ai_token"),
    user: null
  });

  useEffect(() => {
    const token = localStorage.getItem("voice_ai_token");

    if (!token) {
      setAuthState({
        loading: false,
        token: null,
        user: null
      });

      return;
    }

    api("/api/auth/me", { token })
      .then((data) =>
        setAuthState({
          loading: false,
          token,
          user: data.user
        })
      )
      .catch(() => {
        localStorage.removeItem("voice_ai_token");

        setAuthState({
          loading: false,
          token: null,
          user: null
        });
      });
  }, []);

  if (authState.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading voice assistant...
      </div>
    );
  }

  if (!authState.token || !authState.user) {
    return (
      <AuthScreen
        onAuth={(data) =>
          setAuthState({
            loading: false,
            token: data.token,
            user: data.user
          })
        }
      />
    );
  }

  return (
    <Dashboard
      token={authState.token}
      user={authState.user}
      onLogout={() =>
        setAuthState({
          loading: false,
          token: null,
          user: null
        })
      }
    />
  );
}