import { useState, useRef, useCallback } from "react";
import { parseManuscript, splitIntoParagraphs, countWords } from "./lib/manuscript-parser";
import { sendMessage, extractText, parseJsonResponse } from "./lib/ai-client";
import { buildPrompt, buildReviewRequest } from "./lib/prompt-builder";

// ─── DATA ───
const GENRES = [
  { id: "realistic", icon: "📖", label: "Realistisk fiktion", desc: "Samtidsroman, vardagsskildring" },
  { id: "crime", icon: "🔍", label: "Deckare / Thriller", desc: "Brott, utredning, spänning" },
  { id: "fantasy", icon: "🐉", label: "Fantasy / Sci-fi", desc: "Fiktiva världar, magi, framtid" },
  { id: "romance", icon: "💕", label: "Romantik / Feelgood", desc: "Kärleksrelationer, personlig utveckling" },
  { id: "horror", icon: "👻", label: "Skräck / Gothic", desc: "Obehag, rädsla, existentiell ångest" },
  { id: "historical", icon: "📚", label: "Historisk roman", desc: "Avgränsad historisk period" },
  { id: "ya", icon: "👶", label: "Barn & Ungdom", desc: "Upp till 18 år" },
  { id: "memoir", icon: "📝", label: "Memoar / Sakprosa", desc: "Icke-fiktivt, berättande" },
  { id: "poetry", icon: "🎭", label: "Lyrik / Poesi", desc: "Dikt, prosalyrik, versepos" },
];

const LANGUAGES = [
  { id: "en", flag: "🇬🇧", label: "Engelska", sub: "British English" },
  { id: "de", flag: "🇩🇪", label: "Tyska", sub: "Hochdeutsch" },
  { id: "es", flag: "🇪🇸", label: "Spanska", sub: "Kastiliansk" },
  { id: "ar", flag: "🇸🇦", label: "Arabiska", sub: "Modern standard" },
];

const PRIORITY = {
  red: { label: "Måste åtgärdas", color: "#c0392b", bg: "#fdf0ef" },
  yellow: { label: "Bör övervägas", color: "#b8860b", bg: "#fdf8ef" },
  green: { label: "Smaksak", color: "#27864a", bg: "#f0faf3" },
};

const LEVEL_LABELS = { 1: "Utvecklingsred.", 2: "Stilistisk", 3: "Språkgranskning", 4: "Korrektur" };

// ─── STYLES ───
const font = "'Newsreader', 'Georgia', serif";
const uiFont = "'DM Sans', 'Segoe UI', sans-serif";
const bg = "#f7f4ef";
const surface = "#ffffff";
const ink = "#1a1410";
const muted = "#8c7e6f";
const border = "#e6ddd2";
const accent = "#a0522d";
const accentLight = "#a0522d18";

// ─── ONBOARDING: STEP 1 – UPLOAD ───
function OnboardingUpload({ onNext }) {
  const [file, setFile] = useState(null);
  const [chapters, setChapters] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = useCallback(async (f) => {
    setFile(f);
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseManuscript(f);
      setChapters(parsed);
    } catch (err) {
      setError(err.message);
      setChapters(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const totalWords = chapters ? chapters.reduce((s, c) => s + c.wordCount, 0) : 0;

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, background: ink, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 18, fontWeight: 700 }}>M</div>
        <span style={{ fontSize: 24, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
      </div>
      <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 32px", textAlign: "center" }}>AI-stödd manusgranskning for författare, redaktörer och förlag</p>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: uiFont, fontSize: 12, fontWeight: 700 }}>1</div>
        <div style={{ width: 40, height: 2, background: border }} />
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: border, color: muted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: uiFont, fontSize: 12, fontWeight: 600 }}>2</div>
      </div>

      {/* Upload area */}
      <div style={{ width: "100%", maxWidth: 520, background: surface, borderRadius: 16, padding: "36px 36px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Ladda upp ditt manus</h2>
        <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 20px" }}>Dra och släpp en fil eller klicka för att välja. Stöder .docx, .pdf och .txt.</p>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? accent : border}`,
            borderRadius: 12,
            padding: "40px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? accentLight : bg,
            transition: "all 0.2s",
          }}
        >
          <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.6 }}>📄</div>
          <div style={{ fontFamily: uiFont, fontSize: 13, color: ink, fontWeight: 500 }}>
            {parsing ? "Analyserar fil..." : file ? file.name : "Dra fil hit eller klicka för att välja"}
          </div>
          {file && !parsing && (
            <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#fdf0ef", borderRadius: 8, borderLeft: `3px solid #c0392b`, fontFamily: uiFont, fontSize: 12, color: "#c0392b" }}>
            {error}
          </div>
        )}

        {chapters && (
          <div style={{ marginTop: 18, padding: "14px 16px", background: bg, borderRadius: 10 }}>
            <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Identifierade kapitel</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontFamily: uiFont, fontSize: 12 }}>
              <span style={{ color: ink, fontWeight: 600 }}>{chapters.length} kapitel</span>
              <span style={{ color: muted }}>{totalWords.toLocaleString()} ord totalt</span>
            </div>
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              {chapters.map((ch, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < chapters.length - 1 ? `1px solid ${border}` : "none", fontFamily: uiFont, fontSize: 11.5 }}>
                  <span style={{ color: ink }}>{ch.title}</span>
                  <span style={{ color: muted }}>{ch.wordCount.toLocaleString()} ord</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => chapters && onNext(file, chapters)}
          disabled={!chapters}
          style={{
            width: "100%", marginTop: 20, padding: "13px 0", borderRadius: 9, border: "none",
            background: chapters ? accent : "#d4c8bb", color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: chapters ? "pointer" : "default", fontFamily: uiFont, transition: "background 0.2s",
          }}
        >
          Nästa steg
        </button>
      </div>
    </div>
  );
}

// ─── ONBOARDING: STEP 2 – SETTINGS ───
function OnboardingSettings({ fileName, onStart, onBack }) {
  const [genres, setGenres] = useState([]);
  const [modules, setModules] = useState([]);
  const [transLangs, setTransLangs] = useState(["en"]);

  const toggle = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#27864a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: uiFont, fontSize: 14 }}>✓</div>
        <div style={{ width: 40, height: 2, background: accent }} />
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: uiFont, fontSize: 12, fontWeight: 700 }}>2</div>
      </div>

      <div style={{ width: "100%", maxWidth: 640, background: surface, borderRadius: 16, padding: "32px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Projektinställningar</h2>
          <button onClick={onBack} style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: 11, color: muted, cursor: "pointer" }}>← Tillbaka</button>
        </div>
        <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 24px" }}>{fileName}</p>

        {/* Genre */}
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Genretillägg <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— välj en eller flera</span></h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {GENRES.map(g => {
              const active = genres.includes(g.id);
              return (
                <button key={g.id} onClick={() => toggle(genres, setGenres, g.id)} style={{
                  padding: "10px 12px", borderRadius: 9, textAlign: "left", cursor: "pointer", fontFamily: uiFont,
                  border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                  background: active ? accentLight : surface, transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{g.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{g.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Modules */}
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Tilläggsmoduler</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "develop", icon: "🪶", label: "Skrivutveckling", desc: "AI-stödd textutveckling – få hjälp att utveckla, skriva om och utöka din text. Inkluderar språklig DNA-profil, emotionell kartläggning, scenutbyggnad och brainstorming.", tag: "Kreativ AI" },
              { id: "translate", icon: "🌍", label: "Översättning", desc: "Professionell litterär översättning av färdigt manus till engelska, tyska, spanska och arabiska. Kulturell anpassning och konsekvensgranskning ingår.", tag: "Export" },
            ].map(m => {
              const active = modules.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle(modules, setModules, m.id)} style={{
                  padding: "14px 16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                  border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                  background: active ? accentLight : surface, display: "flex", gap: 14, alignItems: "flex-start", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: uiFont, fontSize: 13, fontWeight: 600, color: ink }}>{m.label}</span>
                      <span style={{ fontFamily: uiFont, fontSize: 9, padding: "2px 8px", borderRadius: 10, background: active ? accent : "#e6ddd2", color: active ? "#fff" : muted, fontWeight: 600 }}>{m.tag}</span>
                    </div>
                    <p style={{ fontFamily: uiFont, fontSize: 11.5, color: muted, margin: "4px 0 0", lineHeight: 1.45 }}>{m.desc}</p>
                  </div>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: active ? accent : "#d4c8bb", position: "relative", flexShrink: 0, marginTop: 2, transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: active ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Translation languages */}
        {modules.includes("translate") && (
          <section style={{ marginBottom: 28, padding: 16, background: bg, borderRadius: 10 }}>
            <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Översättningsspråk</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LANGUAGES.map(l => {
                const active = transLangs.includes(l.id);
                return (
                  <button key={l.id} onClick={() => toggle(transLangs, setTransLangs, l.id)} style={{
                    padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: uiFont,
                    border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                    background: active ? accentLight : surface, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 18 }}>{l.flag}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{l.label}</div>
                      <div style={{ fontSize: 9, color: muted }}>{l.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <button
          onClick={() => onStart({ genres, modules, transLangs })}
          style={{ width: "100%", padding: "13px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}
        >
          Starta bearbetning
        </button>
      </div>
    </div>
  );
}

// ─── PROCESSING VIEW ───
function ProcessingView({ chapters, statusText }) {
  const progress = chapters ? Math.round((chapters.filter(c => c.status === "done").length / chapters.length) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        {/* Pulsing animation */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto",
            background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "pulse 2s ease-in-out infinite",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>M</div>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.85; } }`}</style>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Bearbetar ditt manus</h2>
        <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 28px" }}>{statusText}</p>

        {/* Progress bar */}
        <div style={{ width: "100%", height: 6, background: border, borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: accent, borderRadius: 3, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ fontFamily: uiFont, fontSize: 11, color: muted }}>{progress}%</div>

        {/* Chapter status */}
        {chapters && (
          <div style={{ marginTop: 24, textAlign: "left", background: surface, borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            {chapters.map((ch, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < chapters.length - 1 ? `1px solid ${border}` : "none", fontFamily: uiFont, fontSize: 12 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0,
                  background: ch.status === "done" ? "#27864a" : ch.status === "active" ? "#b8860b" : border,
                  color: ch.status === "pending" ? muted : "#fff",
                }}>
                  {ch.status === "done" ? "✓" : ch.status === "active" ? "..." : ""}
                </span>
                <span style={{ color: ch.status === "pending" ? muted : ink, flex: 1 }}>{ch.title}</span>
                <span style={{ fontSize: 10, color: muted }}>{ch.wordCount.toLocaleString()} ord</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EDITOR COMPONENTS ───

function Sidebar({ chapters, activeChapter, setActiveChapter, onSplitChapter }) {
  const [splitTarget, setSplitTarget] = useState(null);

  return (
    <aside style={{ width: 232, borderRight: `1px solid ${border}`, background: surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${border}` }}>
        <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Kapitel</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {chapters.map(ch => (
          <div key={ch.id} style={{ position: "relative" }}>
            <button onClick={() => setActiveChapter(ch.id)} style={{
              width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 7, border: "none",
              background: activeChapter === ch.id ? "#ede8e0" : "transparent", cursor: "pointer", fontFamily: font, marginBottom: 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 12.5, fontWeight: activeChapter === ch.id ? 600 : 400, color: ink, lineHeight: 1.35, flex: 1 }}>{ch.title}</div>
                {activeChapter === ch.id && onSplitChapter && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setSplitTarget(splitTarget === ch.id ? null : ch.id); }}
                    title="Dela kapitel"
                    style={{ fontSize: 12, color: muted, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
                  >&#9986;</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontFamily: uiFont, fontSize: 10, color: muted }}>
                <span>{ch.wordCount.toLocaleString()} ord</span>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.status === "done" ? "#27864a" : ch.status === "active" ? "#b8860b" : "#d4c8bb" }} />
              </div>
            </button>
            {splitTarget === ch.id && (
              <SplitChapterPopover
                chapter={ch}
                onSplit={(lineIndex) => { onSplitChapter(ch.id, lineIndex); setSplitTarget(null); }}
                onClose={() => setSplitTarget(null)}
              />
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}` }}>
        <div style={{ fontFamily: uiFont, fontSize: 10, color: muted, textAlign: "center" }}>
          {chapters.reduce((a, c) => a + c.wordCount, 0).toLocaleString()} ord totalt
        </div>
      </div>
    </aside>
  );
}

function SplitChapterPopover({ chapter, onSplit, onClose }) {
  const paragraphs = chapter.content.split(/\n\s*\n/).filter(p => p.trim());
  const [selectedLine, setSelectedLine] = useState(null);

  if (paragraphs.length < 2) {
    return (
      <div style={{ margin: "0 6px 6px", padding: "10px 12px", background: "#fdf8ef", borderRadius: 8, fontFamily: uiFont, fontSize: 11, color: muted, borderLeft: `3px solid #b8860b` }}>
        Kapitlet har bara ett stycke och kan inte delas.
        <button onClick={onClose} style={{ display: "block", marginTop: 6, background: "none", border: "none", color: accent, fontSize: 10, cursor: "pointer", padding: 0, fontFamily: uiFont }}>Stäng</button>
      </div>
    );
  }

  return (
    <div style={{ margin: "0 6px 6px", padding: "10px 12px", background: surface, borderRadius: 8, border: `1px solid ${border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Dela efter stycke:</div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {paragraphs.slice(0, -1).map((p, i) => (
          <button key={i} onClick={() => setSelectedLine(i)} style={{
            width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 5, marginBottom: 3, cursor: "pointer",
            border: selectedLine === i ? `1.5px solid ${accent}` : `1px solid ${border}`,
            background: selectedLine === i ? accentLight : "transparent", fontFamily: uiFont, fontSize: 10.5, color: ink,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ color: muted, marginRight: 4 }}>{i + 1}.</span>
            {p.trim().slice(0, 60)}{p.trim().length > 60 ? "..." : ""}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          onClick={() => selectedLine !== null && onSplit(selectedLine)}
          disabled={selectedLine === null}
          style={{ flex: 1, padding: "6px 0", borderRadius: 5, border: "none", background: selectedLine !== null ? accent : "#d4c8bb", color: "#fff", fontSize: 11, fontWeight: 600, cursor: selectedLine !== null ? "pointer" : "default", fontFamily: uiFont }}
        >Dela här</button>
        <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, fontSize: 11, cursor: "pointer", fontFamily: uiFont }}>Avbryt</button>
      </div>
    </div>
  );
}

function SuggestionCard({ s, isActive, onToggle, onAccept, onReject }) {
  const p = PRIORITY[s.priority];
  return (
    <div onClick={onToggle} style={{
      padding: "12px 12px", marginBottom: 6, borderRadius: 9,
      border: `1px solid ${isActive ? p.color + "50" : border}`,
      background: isActive ? p.bg : surface, cursor: "pointer", transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
        <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: p.color }}>{LEVEL_LABELS[s.level]}</span>
        <span style={{ fontFamily: uiFont, fontSize: 9, color: muted, marginLeft: "auto" }}>
          {s.type === "style" ? "✦ Stil" : s.type === "repetition" ? "↻ Upprepning" : "▧ Struktur"}
        </span>
      </div>
      {s.original && (
        <div style={{ fontFamily: uiFont, fontSize: 11.5, color: muted, marginBottom: 4, padding: "5px 7px", background: bg, borderRadius: 5, borderLeft: `2.5px solid ${p.color}40` }}>
          <span style={{ textDecoration: "line-through", opacity: 0.65 }}>{s.original}</span>
        </div>
      )}
      {s.replacement && (
        <div style={{ fontFamily: uiFont, fontSize: 11.5, color: ink, fontWeight: 500, marginBottom: 4, padding: "5px 7px", background: "#f0faf3", borderRadius: 5, borderLeft: "2.5px solid #27864a40" }}>
          {s.replacement}
        </div>
      )}
      {isActive && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontFamily: uiFont, fontSize: 11.5, color: "#5a4e42", lineHeight: 1.55, margin: "0 0 10px" }}>{s.reason}</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onAccept(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: "none", background: "#27864a", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>✓ Godkänn</button>
            <button onClick={e => { e.stopPropagation(); onReject(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>✗ Avvisa</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS MODAL (for editor) ───
function SettingsModal({ onClose, genres, setGenres, modules, setModules, transLangs, setTransLangs }) {
  const toggle = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 640, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)", padding: "32px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Projektinställningar</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: muted, padding: 4 }}>✕</button>
        </div>

        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Genretillägg <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— välj en eller flera</span></h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {GENRES.map(g => {
              const active = genres.includes(g.id);
              return (
                <button key={g.id} onClick={() => toggle(genres, setGenres, g.id)} style={{
                  padding: "10px 12px", borderRadius: 9, textAlign: "left", cursor: "pointer", fontFamily: uiFont,
                  border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                  background: active ? accentLight : surface, transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{g.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{g.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Tilläggsmoduler</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "develop", icon: "🪶", label: "Skrivutveckling", desc: "AI-stödd textutveckling – få hjälp att utveckla, skriva om och utöka din text.", tag: "Kreativ AI" },
              { id: "translate", icon: "🌍", label: "Översättning", desc: "Professionell litterär översättning av färdigt manus.", tag: "Export" },
            ].map(m => {
              const active = modules.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle(modules, setModules, m.id)} style={{
                  padding: "14px 16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                  border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                  background: active ? accentLight : surface, display: "flex", gap: 14, alignItems: "flex-start", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: uiFont, fontSize: 13, fontWeight: 600, color: ink }}>{m.label}</span>
                      <span style={{ fontFamily: uiFont, fontSize: 9, padding: "2px 8px", borderRadius: 10, background: active ? accent : "#e6ddd2", color: active ? "#fff" : muted, fontWeight: 600 }}>{m.tag}</span>
                    </div>
                    <p style={{ fontFamily: uiFont, fontSize: 11.5, color: muted, margin: "4px 0 0", lineHeight: 1.45 }}>{m.desc}</p>
                  </div>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: active ? accent : "#d4c8bb", position: "relative", flexShrink: 0, marginTop: 2, transition: "background 0.2s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: active ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {modules.includes("translate") && (
          <section style={{ marginBottom: 28, padding: 16, background: bg, borderRadius: 10 }}>
            <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>Översättningsspråk</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LANGUAGES.map(l => {
                const active = transLangs.includes(l.id);
                return (
                  <button key={l.id} onClick={() => toggle(transLangs, setTransLangs, l.id)} style={{
                    padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: uiFont,
                    border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                    background: active ? accentLight : surface, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 18 }}>{l.flag}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{l.label}</div>
                      <div style={{ fontSize: 9, color: muted }}>{l.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <button onClick={onClose} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>
          Spara inställningar
        </button>
      </div>
    </div>
  );
}

// ─── DEVELOP PANEL ───
function DevelopPanel({ dnaProfile }) {
  const [tab, setTab] = useState("dna");
  const tabs = [
    { id: "dna", label: "Språklig DNA" },
    { id: "emotion", label: "Emotionell karta" },
    { id: "develop", label: "Utveckla text" },
    { id: "brainstorm", label: "Brainstorming" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 0", border: "none", borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
            background: "transparent", fontFamily: uiFont, fontSize: 10.5, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? accent : muted, cursor: "pointer", transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "dna" && <DNAView profile={dnaProfile} />}
        {tab === "emotion" && <EmotionView />}
        {tab === "develop" && <DevelopView />}
        {tab === "brainstorm" && <BrainstormView />}
      </div>
    </div>
  );
}

function DNAView({ profile }) {
  const p = profile || {
    avgSentenceLen: "—",
    shortLongRatio: "—",
    dominantImagery: "—",
    dialogStyle: "—",
    favoriteWords: [],
    tonality: "—",
    perspective: "—",
    tense: "—",
  };
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      <div style={{ padding: "10px 12px", background: bg, borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Författarens röstprofil</div>
        {Object.entries({
          "Perspektiv": p.perspective,
          "Tempus": p.tense,
          "Tonalitet": p.tonality,
          "Meningslängd (snitt)": typeof p.avgSentenceLen === "number" ? `${p.avgSentenceLen} ord` : p.avgSentenceLen,
          "Kort/lång fördelning": p.shortLongRatio,
          "Dialogstil": p.dialogStyle,
          "Bildspråk": p.dominantImagery,
        }).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${border}` }}>
            <span style={{ color: muted }}>{k}</span>
            <span style={{ fontWeight: 500, color: ink, textAlign: "right", maxWidth: "55%" }}>{v}</span>
          </div>
        ))}
      </div>
      {p.favoriteWords.length > 0 && (
        <div style={{ padding: "10px 12px", background: bg, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Favoritord</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {p.favoriteWords.map(w => (
              <span key={w} style={{ padding: "3px 10px", borderRadius: 12, background: accentLight, color: accent, fontSize: 11, fontWeight: 500 }}>{w}</span>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: muted, lineHeight: 1.5, marginTop: 12, padding: "0 4px" }}>
        Profilen används som bas när ny text genereras – all AI-skapad text matchar din etablerade stil, meningsrytm och ordval.
      </p>
    </div>
  );
}

function EmotionView() {
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12, padding: "20px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>📊</div>
      <p style={{ color: muted, fontSize: 12 }}>Emotionell kartläggning genereras efter bearbetning av alla kapitel.</p>
    </div>
  );
}

function DevelopView() {
  const [mode, setMode] = useState(null);
  const modes = [
    { id: "expand", icon: "↔", label: "Bygga ut scen", desc: "Fördjupa en befintlig scen med sinnesintryck, dialog eller internmonolog" },
    { id: "rewrite", icon: "✎", label: "Skriva om", desc: "Omarbeta en passage – visa istället för att berätta" },
    { id: "newscene", icon: "+", label: "Ny scen / kapitel", desc: "Generera helt nytt textavsnitt som passar in i manuset" },
  ];
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      {!mode ? (
        <>
          <p style={{ color: muted, fontSize: 11.5, lineHeight: 1.5, margin: "0 0 14px", padding: "0 4px" }}>
            Markera text i manuset eller välj ett utvecklingsläge nedan. All genererad text matchar din språkliga DNA-profil.
          </p>
          {modes.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 9, cursor: "pointer", fontFamily: uiFont,
              border: `1px solid ${border}`, background: surface, marginBottom: 6, display: "flex", gap: 12, alignItems: "center",
              transition: "all 0.15s",
            }}>
              <span style={{ width: 32, height: 32, borderRadius: 7, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: accent, fontWeight: 700, flexShrink: 0 }}>{m.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: ink, fontSize: 12.5 }}>{m.label}</div>
                <div style={{ color: muted, fontSize: 10.5, marginTop: 2 }}>{m.desc}</div>
              </div>
            </button>
          ))}
        </>
      ) : (
        <>
          <button onClick={() => setMode(null)} style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: 11, color: muted, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Tillbaka</button>
          <div style={{ padding: "14px 14px", background: bg, borderRadius: 9 }}>
            <div style={{ fontWeight: 600, color: ink, fontSize: 13, marginBottom: 8 }}>{modes.find(m => m.id === mode)?.label}</div>
            <div style={{ fontSize: 11, color: muted, lineHeight: 1.5, marginBottom: 12 }}>
              {mode === "expand" && "Markera det stycke du vill bygga ut. AI:n analyserar kontexten och föreslår utökat innehåll som matchar din röst."}
              {mode === "rewrite" && "Markera den passage som ska skrivas om. Välj fokus nedan:"}
              {mode === "newscene" && "Beskriv vad den nya scenen ska uppnå. AI:n föreslår text baserad på din DNA-profil och manuskriptets kontext."}
            </div>
            {mode === "rewrite" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {["Visa istf berätta", "Mer dialog", "Mer sinnesintryck", "Höja tempot", "Sänka tempot", "Fördjupa känsla"].map(opt => (
                  <span key={opt} style={{ padding: "4px 10px", borderRadius: 12, border: `1px solid ${border}`, fontSize: 10, color: ink, cursor: "pointer", background: surface }}>{opt}</span>
                ))}
              </div>
            )}
            <textarea placeholder={mode === "newscene" ? "Beskriv scenen: vad ska hända, vilka karaktärer, vilken stämning..." : "Klistra in eller markera text i manuset..."} style={{
              width: "100%", minHeight: 80, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 11.5,
              resize: "vertical", background: surface, color: ink, outline: "none", boxSizing: "border-box",
            }} />
            <button style={{ marginTop: 8, width: "100%", padding: "10px 0", borderRadius: 7, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>
              Generera förslag
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BrainstormView() {
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      <p style={{ color: muted, fontSize: 11.5, lineHeight: 1.5, margin: "0 0 12px", padding: "0 4px" }}>
        Ställ en fråga eller beskriv ett problem med din berättelse. AI:n presenterar alltid tre alternativa vägar framåt.
      </p>
      <textarea placeholder="T.ex: Hur kan jag göra Marcus vändpunkt mer trovärdig? Eller: Behöver kapitel 3 en underplot?" style={{
        width: "100%", minHeight: 60, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 11.5,
        resize: "vertical", background: surface, color: ink, outline: "none", boxSizing: "border-box",
      }} />
      <button style={{ marginTop: 6, width: "100%", padding: "10px 0", borderRadius: 7, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>
        Brainstorma
      </button>
    </div>
  );
}

// ─── TRANSLATE PANEL ───
function TranslatePanel({ langs }) {
  const [activeLang, setActiveLang] = useState(langs[0] || "en");
  const langData = LANGUAGES.find(l => l.id === activeLang);
  const isRTL = activeLang === "ar";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: uiFont }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {langs.map(id => {
          const l = LANGUAGES.find(x => x.id === id);
          if (!l) return null;
          return (
            <button key={id} onClick={() => setActiveLang(id)} style={{
              flex: 1, padding: "10px 0", border: "none",
              borderBottom: activeLang === id ? `2px solid ${accent}` : "2px solid transparent",
              background: "transparent", fontFamily: uiFont, fontSize: 11, fontWeight: activeLang === id ? 600 : 400,
              color: activeLang === id ? accent : muted, cursor: "pointer",
            }}>{l.flag} {l.label}</button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5, marginTop: 30 }}>🌍</div>
        <p style={{ color: muted, fontSize: 12 }}>Översättning startas efter att granskningen är klar.</p>
      </div>
    </div>
  );
}

// ─── PRICING PAGE ───
function PricingPage({ onBack }) {
  const plans = [
    { name: "Prova", price: "0", unit: "", desc: "Testa med ett kapitel", features: ["1 kapitel (max 5 000 ord)", "Alla granskningsnivåer", "Grundläggande export"], cta: "Kom igång gratis", hl: false },
    { name: "Grund", price: "99", unit: "kr / mån", desc: "Plattformen + 1 granskning/mån", features: ["Alla genretillägg", "Export (markdown & docx)", "1 granskning/mån (50k ord)", "Betala per användning utöver"], cta: "Starta", hl: true },
    { name: "Förlag", price: "Offert", unit: "fr. 1 500 kr/mån", desc: "Team & företag", features: ["Flerplatslicens", "API-åtkomst", "Anpassade mallar", "SSO & fakturering"], cta: "Kontakta oss", hl: false },
  ];

  const usageServices = [
    { category: "Manusgranskning", items: [
      { name: "Korrektur + språk (nivå 3-4)", price: "0,50 kr / 1 000 ord" },
      { name: "Stilistisk + struktur (nivå 1-2)", price: "1,50 kr / 1 000 ord" },
      { name: "Full granskning (alla 4 nivåer)", price: "2,50 kr / 1 000 ord" },
    ]},
    { category: "Skrivutveckling", items: [
      { name: "Språklig DNA-profil + emotionell karta", price: "19 kr / analys" },
      { name: "Scenutbyggnad / omskrivning", price: "5 kr / anrop" },
      { name: "Brainstorming (3 alternativ)", price: "3 kr / anrop" },
    ]},
    { category: "Översättning", items: [
      { name: "Per språk", price: "4 kr / 1 000 ord" },
      { name: "Paket 3-4 språk", price: "12 kr / 1 000 ord (totalt)" },
    ]},
  ];

  const personas = [
    { name: "Hobbyförfattare", usage: "1 manus/mån (60k ord), full granskning", cost: "~175 kr", trad: "~18 000 kr" },
    { name: "Aktiv författare", usage: "2 manus/mån (80k ord), granskning + utveckling", cost: "~620 kr", trad: "~48 000 kr" },
    { name: "Internationell", usage: "1 manus (80k ord) + 4 språk", cost: "~1 280 kr", trad: "~160 000+ kr" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: uiFont, fontSize: 12, color: muted, marginBottom: 28 }}>← Tillbaka</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Grund + Användning</h1>
          <p style={{ fontFamily: uiFont, fontSize: 14, color: muted, marginTop: 10, maxWidth: 500, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Betala en låg grundavgift och sedan bara för det du använder. Ingen onödig överkostnad.
          </p>
          <div style={{ marginTop: 16, padding: "10px 18px", background: "#ede8e0", borderRadius: 8, display: "inline-block", fontFamily: uiFont, fontSize: 12, color: "#5a4e42" }}>
            Traditionell redaktör: <strong>16 000-40 000 SEK</strong> per manus (80 000 ord)
          </div>
        </div>

        {/* Plans */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 48, alignItems: "start" }}>
          {plans.map(p => (
            <div key={p.name} style={{
              background: p.hl ? ink : surface, color: p.hl ? "#f7f4ef" : ink, borderRadius: 14, padding: "28px 22px",
              border: p.hl ? `2px solid ${ink}` : `1px solid ${border}`, position: "relative",
              transform: p.hl ? "scale(1.03)" : "none",
              boxShadow: p.hl ? "0 10px 36px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              {p.hl && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: accent, color: "#fff", fontSize: 9, fontWeight: 600, padding: "3px 12px", borderRadius: 16, fontFamily: uiFont, textTransform: "uppercase", letterSpacing: "0.05em" }}>Populärast</div>}
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{p.name}</h3>
              <p style={{ fontFamily: uiFont, fontSize: 11.5, opacity: 0.6, margin: "4px 0 18px" }}>{p.desc}</p>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>{p.price}</span>
                {p.unit && <span style={{ fontFamily: uiFont, fontSize: 12, opacity: 0.5, marginLeft: 4 }}>{p.unit}</span>}
                {p.price === "0" && <span style={{ fontFamily: uiFont, fontSize: 12, opacity: 0.5 }}> kr</span>}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", fontFamily: uiFont, fontSize: 12, lineHeight: 2.1 }}>
                {p.features.map((f, i) => <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ color: p.hl ? accent : "#27864a", flexShrink: 0 }}>✓</span>{f}</li>)}
              </ul>
              <button style={{
                width: "100%", padding: "11px 0", borderRadius: 7, fontFamily: uiFont, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: p.hl ? "none" : `1px solid ${border}`, background: p.hl ? accent : "transparent", color: p.hl ? "#fff" : ink,
              }}>{p.cta}</button>
            </div>
          ))}
        </div>

        {/* Usage-based services */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: "-0.02em", textAlign: "center" }}>Användningsbaserade tjänster</h2>
          <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, textAlign: "center", margin: "0 0 24px" }}>Betala bara för det du använder, utöver grundplanen</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {usageServices.map(cat => (
              <div key={cat.category} style={{ background: surface, borderRadius: 12, padding: "20px 18px", border: `1px solid ${border}` }}>
                <h4 style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>{cat.category}</h4>
                {cat.items.map((item, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: i < cat.items.length - 1 ? `1px solid ${border}` : "none" }}>
                    <div style={{ fontFamily: uiFont, fontSize: 12, color: ink, marginBottom: 3 }}>{item.name}</div>
                    <div style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: accent }}>{item.price}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Example costs */}
        <div style={{ background: surface, borderRadius: 14, padding: "28px 28px", border: `1px solid ${border}`, marginBottom: 48 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Vad kostar det i praktiken?</h3>
          <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 18px" }}>Typiska månadskostnader jämfört med traditionell redaktör</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 120px", gap: 12, padding: "8px 0", borderBottom: `2px solid ${border}`, fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Persona</span><span>Användning</span><span>Kostnad</span><span>Trad. redaktör</span>
            </div>
            {personas.map((p, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 120px", gap: 12, padding: "10px 0", borderBottom: i < personas.length - 1 ? `1px solid ${border}` : "none", fontFamily: uiFont, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: ink }}>{p.name}</span>
                <span style={{ color: "#5a4e42" }}>{p.usage}</span>
                <span style={{ fontWeight: 600, color: accent }}>{p.cost}</span>
                <span style={{ color: muted, textDecoration: "line-through" }}>{p.trad}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  // Flow: "upload" → "settings" → "processing" → "editor"
  const [view, setView] = useState("upload");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [paragraphsByChapter, setParagraphsByChapter] = useState({});
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  const [filterPriority, setFilterPriority] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [genres, setGenres] = useState([]);
  const [modules, setModules] = useState([]);
  const [transLangs, setTransLangs] = useState(["en"]);
  const [rightPanel, setRightPanel] = useState("suggestions");
  const [processingStatus, setProcessingStatus] = useState("");
  const [dnaProfile, setDnaProfile] = useState(null);

  // Step 1 → Step 2
  const handleUploadNext = (file, parsedChapters) => {
    setUploadedFile(file);
    setChapters(parsedChapters.map(ch => ({ ...ch, status: "pending" })));
    setView("settings");
  };

  // Step 2 → Processing
  const handleStartProcessing = (settings) => {
    setGenres(settings.genres);
    setModules(settings.modules);
    setTransLangs(settings.transLangs);
    setView("processing");

    // Build paragraphs from chapters
    const parasMap = {};
    chapters.forEach(ch => {
      parasMap[ch.id] = splitIntoParagraphs(ch.content);
    });
    setParagraphsByChapter(parasMap);

    runProcessing(chapters, parasMap, settings);
  };

  const runProcessing = async (chaps, parasMap, settings) => {
    const systemPrompt = buildPrompt({
      project: { title: uploadedFile?.name?.replace(/\.[^.]+$/, '') },
      genres: settings.genres,
      modules: {
        develop: settings.modules.includes("develop"),
        translate: settings.modules.includes("translate"),
      },
      translationLanguages: settings.transLangs,
    });

    const updatedChapters = [...chaps];
    const updatedParas = { ...parasMap };

    for (let i = 0; i < updatedChapters.length; i++) {
      updatedChapters[i] = { ...updatedChapters[i], status: "active" };
      setChapters([...updatedChapters]);
      setProcessingStatus(`Analyserar ${updatedChapters[i].title} (${i + 1}/${updatedChapters.length})...`);

      try {
        const request = buildReviewRequest(systemPrompt, updatedChapters[i].content);
        const response = await sendMessage(request);

        if (response) {
          const text = extractText(response);
          const parsed = parseJsonResponse(text);
          if (parsed?.suggestions?.length) {
            // Attach suggestions to paragraphs
            const chapterParas = updatedParas[updatedChapters[i].id] || [];
            const enrichedParas = attachSuggestionsToParagraphs(chapterParas, parsed.suggestions, updatedChapters[i].id);
            updatedParas[updatedChapters[i].id] = enrichedParas;
            setParagraphsByChapter({ ...updatedParas });
          }
        }
      } catch (err) {
        console.error(`Review failed for chapter ${i + 1}:`, err);
      }

      updatedChapters[i] = { ...updatedChapters[i], status: "done" };
      setChapters([...updatedChapters]);
    }

    // DNA profile
    setProcessingStatus("Bygger språklig DNA-profil...");
    const allText = chaps.map(c => c.content).join(" ");

    try {
      const dnaResponse = await sendMessage({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt + `\n\nGenerera en språklig DNA-profil. Returnera JSON med exakt dessa fält:
{
  "avgSentenceLen": <number>,
  "shortLongRatio": "<string>",
  "dominantImagery": "<string>",
  "dialogStyle": "<string>",
  "favoriteWords": ["<string>", ...],
  "tonality": "<string>",
  "perspective": "<string>",
  "tense": "<string>"
}`,
        messages: [{ role: "user", content: `Analysera denna text och skapa en språklig DNA-profil:\n\n${allText.slice(0, 20000)}` }],
      });

      if (dnaResponse) {
        const dnaText = extractText(dnaResponse);
        const dnaParsed = parseJsonResponse(dnaText);
        if (dnaParsed) setDnaProfile(dnaParsed);
      }
    } catch (err) {
      console.error("DNA profile failed:", err);
    }

    // Fallback DNA if API didn't work
    if (!dnaProfile) {
      const words = allText.split(/\s+/);
      const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgLen = sentences.length > 0 ? Math.round((words.length / sentences.length) * 10) / 10 : 0;
      setDnaProfile({
        avgSentenceLen: avgLen, shortLongRatio: "—", dominantImagery: "—",
        dialogStyle: "—", favoriteWords: findFrequentWords(allText),
        tonality: "—", perspective: "—", tense: "—",
      });
    }

    setActiveChapter(updatedChapters[0]?.id);
    setProcessingStatus("Klart!");
    await new Promise(r => setTimeout(r, 600));
    setView("editor");
  };

  // Split chapter at a paragraph boundary
  const handleSplitChapter = (chapterId, paragraphIndex) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    const paragraphs = chapter.content.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length - 1) return;

    const firstContent = paragraphs.slice(0, paragraphIndex + 1).join("\n\n");
    const secondContent = paragraphs.slice(paragraphIndex + 1).join("\n\n");

    const chapterIndex = chapters.findIndex(c => c.id === chapterId);
    const newId = Date.now();

    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex] = {
      ...chapter,
      content: firstContent,
      wordCount: countWords(firstContent),
      title: chapter.title,
    };

    const newChapter = {
      id: newId,
      number: chapter.number + 0.5,
      title: `${chapter.title} (del 2)`,
      content: secondContent,
      wordCount: countWords(secondContent),
      status: chapter.status,
    };

    updatedChapters.splice(chapterIndex + 1, 0, newChapter);

    // Renumber
    updatedChapters.forEach((ch, i) => { ch.number = i + 1; });

    setChapters(updatedChapters);

    // Rebuild paragraphs for both chapters
    setParagraphsByChapter(prev => ({
      ...prev,
      [chapterId]: splitIntoParagraphs(firstContent),
      [newId]: splitIntoParagraphs(secondContent),
    }));
  };

  // Get current chapter paragraphs
  const currentParagraphs = paragraphsByChapter[activeChapter] || [];
  const allSuggestions = currentParagraphs.flatMap(p => p.suggestions || []);
  const filtered = allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id) && (filterPriority === "all" || s.priority === filterPriority));

  // ─── RENDER ───
  if (view === "upload") return <OnboardingUpload onNext={handleUploadNext} />;
  if (view === "settings") return <OnboardingSettings fileName={uploadedFile?.name} onStart={handleStartProcessing} onBack={() => setView("upload")} />;
  if (view === "processing") return <ProcessingView chapters={chapters} statusText={processingStatus} />;
  if (view === "pricing") return <PricingPage onBack={() => setView("editor")} />;

  const currentChapter = chapters.find(c => c.id === activeChapter) || chapters[0];

  const renderText = (para) => {
    const { text, suggestions } = para;
    if (!suggestions || !suggestions.length) return <span>{text}</span>;
    const parts = [];
    let last = 0;
    const sorted = [...suggestions].filter(s => s.original).sort((a, b) => text.indexOf(a.original) - text.indexOf(b.original));
    for (const s of sorted) {
      const idx = text.indexOf(s.original, last);
      if (idx === -1) continue;
      if (idx > last) parts.push(<span key={`t${last}`}>{text.slice(last, idx)}</span>);
      const isAcc = accepted.has(s.id), isRej = rejected.has(s.id), isAct = activeSuggestion === s.id;
      const p = PRIORITY[s.priority];
      if (p) {
        parts.push(
          <span key={`s${s.id}`} onClick={() => setActiveSuggestion(isAct ? null : s.id)} style={{
            background: isAcc ? "#dcfce7" : isRej ? "transparent" : isAct ? `${p.color}18` : `${p.color}0c`,
            borderBottom: isAcc ? "none" : `2px solid ${isRej ? "#ccc" : p.color}`,
            padding: "1px 2px", borderRadius: 3, cursor: "pointer",
            textDecoration: isRej ? "line-through" : "none", opacity: isRej ? 0.45 : 1, transition: "all 0.15s",
          }}>
            {isAcc && s.replacement ? s.replacement : s.original}
          </span>
        );
      }
      last = idx + s.original.length;
    }
    if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
    return parts.length ? parts : <span>{text}</span>;
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: font, background: bg, color: ink, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{ height: 50, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, background: ink, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 13, fontWeight: 700 }}>M</div>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
          </div>
          <div style={{ width: 1, height: 20, background: border }} />
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{uploadedFile?.name?.replace(/\.[^.]+$/, '') || "Manus"}</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
            {genres.map(id => { const g = GENRES.find(x => x.id === id); return g ? <span key={id} style={{ fontSize: 14 }} title={g.label}>{g.icon}</span> : null; })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {modules.includes("develop") && (
            <button onClick={() => setRightPanel(rightPanel === "develop" ? "suggestions" : "develop")} style={{
              fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5,
              border: rightPanel === "develop" ? `1.5px solid ${accent}` : `1px solid ${border}`,
              background: rightPanel === "develop" ? accentLight : surface, color: rightPanel === "develop" ? accent : ink, cursor: "pointer", fontWeight: 500,
            }}>Utveckla</button>
          )}
          {modules.includes("translate") && (
            <button onClick={() => setRightPanel(rightPanel === "translate" ? "suggestions" : "translate")} style={{
              fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5,
              border: rightPanel === "translate" ? `1.5px solid ${accent}` : `1px solid ${border}`,
              background: rightPanel === "translate" ? accentLight : surface, color: rightPanel === "translate" ? accent : ink, cursor: "pointer", fontWeight: 500,
            }}>Översätt</button>
          )}
          <button onClick={() => setShowSettings(true)} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}>Inställningar</button>
          <button onClick={() => setView("pricing")} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Priser</button>
        </div>
      </header>

      {/* ACTIVE MODULES BAR */}
      {(genres.length > 0 || modules.length > 0) && (
        <div style={{ padding: "6px 16px", background: surface, borderBottom: `1px solid ${border}`, display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontFamily: uiFont, fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Aktiva:</span>
          {genres.map(id => { const g = GENRES.find(x => x.id === id); return g ? <span key={id} style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: bg, color: "#5a4e42" }}>{g.icon} {g.label}</span> : null; })}
          {modules.includes("develop") && <span style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: accentLight, color: accent, fontWeight: 600 }}>Skrivutveckling</span>}
          {modules.includes("translate") && <span style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: accentLight, color: accent, fontWeight: 600 }}>Översättning: {transLangs.map(id => LANGUAGES.find(l => l.id === id)?.flag).join(" ")}</span>}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT SIDEBAR */}
        <Sidebar chapters={chapters} activeChapter={activeChapter} setActiveChapter={setActiveChapter} onSplitChapter={handleSplitChapter} />

        {/* MAIN TEXT */}
        <main style={{ flex: 1, overflowY: "auto", padding: "36px 52px", maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              {currentChapter?.title}
            </h2>
            <div style={{ display: "flex", gap: 10, marginTop: 8, fontFamily: uiFont, fontSize: 11, color: muted }}>
              <span>{currentChapter?.wordCount?.toLocaleString()} ord</span>
              <span>·</span>
              <span>{allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length} förslag kvar</span>
            </div>
          </div>
          {currentParagraphs.map(para => (
            <p key={para.id} style={{ fontSize: 16.5, lineHeight: 1.85, marginBottom: 22, color: "#3d2e23" }}>
              {renderText(para)}
            </p>
          ))}
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ width: 320, borderLeft: `1px solid ${border}`, background: surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          {rightPanel === "suggestions" && (
            <>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Förslag</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["all", "red", "yellow", "green"].map(p => (
                    <button key={p} onClick={() => setFilterPriority(p)} style={{
                      fontFamily: uiFont, fontSize: 10, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
                      border: filterPriority === p ? "none" : `1px solid ${border}`,
                      background: filterPriority === p ? (p === "all" ? ink : PRIORITY[p]?.color) : surface,
                      color: filterPriority === p ? "#fff" : muted, fontWeight: 500,
                    }}>{p === "all" ? "Alla" : PRIORITY[p].label}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 16px", fontFamily: uiFont, fontSize: 12, color: muted }}>
                    {allSuggestions.length === 0 ? "Inga förslag för detta kapitel än." : allSuggestions.length === accepted.size + rejected.size ? <><div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>Alla förslag hanterade!</> : "Inga förslag matchar filtret."}
                  </div>
                ) : filtered.map(s => (
                  <SuggestionCard key={s.id} s={s} isActive={activeSuggestion === s.id}
                    onToggle={() => setActiveSuggestion(activeSuggestion === s.id ? null : s.id)}
                    onAccept={() => { setAccepted(prev => new Set([...prev, s.id])); setActiveSuggestion(null); }}
                    onReject={() => { setRejected(prev => new Set([...prev, s.id])); setActiveSuggestion(null); }}
                  />
                ))}
              </div>
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, fontFamily: uiFont, fontSize: 10, color: muted, display: "flex", justifyContent: "space-between" }}>
                <span>✓ {accepted.size}</span><span>✗ {rejected.size}</span>
              </div>
            </>
          )}
          {rightPanel === "develop" && <DevelopPanel dnaProfile={dnaProfile} />}
          {rightPanel === "translate" && <TranslatePanel langs={transLangs} />}
        </aside>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)}
          genres={genres} setGenres={setGenres}
          modules={modules} setModules={setModules}
          transLangs={transLangs} setTransLangs={setTransLangs}
        />
      )}
    </div>
  );
}

// ─── HELPERS ───

function attachSuggestionsToParagraphs(paragraphs, suggestions, chapterId) {
  return paragraphs.map((para, pIdx) => {
    const matchingSuggestions = suggestions.filter(s => {
      if (!s.original) return false;
      return para.text.includes(s.original);
    }).map((s, sIdx) => ({
      ...s,
      id: `${chapterId}_p${pIdx}_s${sIdx}`,
    }));
    return { ...para, suggestions: matchingSuggestions };
  });
}

function findFrequentWords(text) {
  const stopWords = new Set(["och", "i", "att", "en", "ett", "det", "som", "på", "är", "av", "för", "med", "den", "till", "var", "han", "hon", "de", "inte", "hade", "sig", "om", "från", "men", "sin", "sina", "sitt", "eller", "vi", "kan", "ska", "alla", "har", "jag", "dig", "du", "mig"]);
  const words = text.toLowerCase().replace(/[^\wåäö\s]/g, "").split(/\s+/);
  const freq = {};
  for (const w of words) {
    if (w.length > 3 && !stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}
