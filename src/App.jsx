import { useState, useRef, useCallback, useEffect } from "react";
import { parseManuscript, splitIntoParagraphs, countWords } from "./lib/manuscript-parser";
import { sendMessage, extractText, parseJsonResponse } from "./lib/ai-client";
import { buildPrompt, buildReviewRequest } from "./lib/prompt-builder";
import { saveProject, loadProject, clearProject, hasSavedProject } from "./lib/storage";
import { exportToDocx, downloadBlob } from "./lib/export";
import { useAuth } from "./contexts/AuthContext";
import { apiClient } from "./lib/api-client";

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

function Sidebar({ chapters, activeChapter, setActiveChapter, onSplitChapter, onReanalyze, paragraphsByChapter }) {
  const [splitTarget, setSplitTarget] = useState(null);

  const chapterHasSuggestions = (chId) => {
    const paras = paragraphsByChapter?.[chId] || [];
    return paras.some(p => p.suggestions?.length > 0);
  };

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
                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  {activeChapter === ch.id && onReanalyze && (
                    <span
                      onClick={(e) => { e.stopPropagation(); onReanalyze(ch.id); }}
                      title={chapterHasSuggestions(ch.id) ? "Analysera om" : "Analysera"}
                      style={{
                        fontSize: 12, color: muted, cursor: "pointer",
                        padding: "2px 5px", lineHeight: 1, borderRadius: 4,
                        background: "transparent", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = accent; e.currentTarget.style.background = accentLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = muted; e.currentTarget.style.background = "transparent"; }}
                    >🔄</span>
                  )}
                  {activeChapter === ch.id && onSplitChapter && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setSplitTarget(splitTarget === ch.id ? null : ch.id); }}
                      title="Dela kapitel"
                      style={{
                        fontSize: 15, color: splitTarget === ch.id ? accent : muted, cursor: "pointer",
                        padding: "2px 6px", flexShrink: 0, lineHeight: 1, borderRadius: 4,
                        background: splitTarget === ch.id ? accentLight : "transparent",
                        transition: "all 0.15s", display: "flex", alignItems: "center",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                      onMouseLeave={(e) => { if (splitTarget !== ch.id) e.currentTarget.style.color = muted; }}
                    >✂</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontFamily: uiFont, fontSize: 10, color: muted }}>
                <span>{ch.wordCount.toLocaleString()} ord</span>
                {!chapterHasSuggestions(ch.id) && ch.status !== "active" && (
                  <span style={{ fontSize: 9, color: "#b8860b" }}>ej analyserad</span>
                )}
                <span style={{ width: 5, height: 5, borderRadius: "50%", marginLeft: "auto", background: ch.status === "active" ? "#b8860b" : chapterHasSuggestions(ch.id) ? "#27864a" : "#d4c8bb" }} />
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

// ─── COLLAPSIBLE PARAGRAPH EDIT SECTION ───
function ParagraphEditSection({ paragraphs, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 8px", borderRadius: 6, border: "none", background: "transparent",
          cursor: "pointer", fontFamily: uiFont, fontSize: 10.5, color: muted,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12 }}>✎</span>
          Redigera stycken ({paragraphs.length})
        </span>
        <span style={{ fontSize: 9, transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 6 }}>
          {paragraphs.map((para, i) => (
            <button
              key={para.id}
              onClick={() => onEdit(para.id, para.text)}
              style={{
                width: "100%", textAlign: "left", padding: "5px 8px", marginBottom: 2, borderRadius: 5,
                border: `1px solid ${border}`, background: surface, cursor: "pointer",
                fontFamily: uiFont, fontSize: 10, color: muted, display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = accent + "60"; }}
              onMouseLeave={e => { e.currentTarget.style.background = surface; e.currentTarget.style.borderColor = border; }}
            >
              <span style={{ color: accent, flexShrink: 0, fontSize: 10 }}>✎</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: ink, fontSize: 10.5 }}>
                Stycke {i + 1}
              </span>
              <span style={{ fontSize: 9, color: muted, flexShrink: 0 }}>{para.text.split(/\s+/).length} ord</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SELECTION TOOLBAR (floating) ───
function SelectionToolbar({ position, onEdit, onNewChapter, onClose }) {
  if (!position) return null;
  return (
    <div style={{
      position: "fixed", left: position.x, top: position.y, transform: "translate(-50%, -110%)",
      background: ink, borderRadius: 8, padding: "5px 4px", display: "flex", gap: 3, zIndex: 50,
      boxShadow: "0 6px 24px rgba(0,0,0,0.22)", animation: "fadeIn 0.12s ease-out",
    }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -100%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -110%) scale(1); } }`}</style>
      <button onClick={onEdit} style={{
        background: "transparent", border: "none", color: "#f7f4ef", fontFamily: uiFont, fontSize: 11,
        padding: "6px 12px", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
        fontWeight: 500, whiteSpace: "nowrap",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ fontSize: 13 }}>✎</span> Redigera
      </button>
      <div style={{ width: 1, background: "rgba(255,255,255,0.18)", margin: "4px 0" }} />
      <button onClick={onNewChapter} style={{
        background: "transparent", border: "none", color: "#f7f4ef", fontFamily: uiFont, fontSize: 11,
        padding: "6px 12px", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
        fontWeight: 500, whiteSpace: "nowrap",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ fontSize: 13 }}>+</span> Nytt kapitel
      </button>
      {/* Arrow */}
      <div style={{
        position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
        width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${ink}`,
      }} />
    </div>
  );
}

// ─── EDIT MODAL with formatting ───
function EditModal({ text, paragraphId, chapterTitle, onSave, onCreateChapter, onClose }) {
  const [editedText, setEditedText] = useState(text);
  const textareaRef = useRef(null);
  const wordCount = editedText.trim().split(/\s+/).filter(w => w).length;
  const hasChanges = editedText !== text;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 500) + "px";
    }
  }, []);

  // Wrap selected text with markers (e.g., *italic*, **bold**)
  const applyFormat = (marker) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = editedText.substring(start, end);

    if (start === end) return; // nothing selected

    // Check if already wrapped with this marker – toggle off
    const before = editedText.substring(0, start);
    const after = editedText.substring(end);
    const markerLen = marker.length;

    if (before.endsWith(marker) && after.startsWith(marker)) {
      // Remove markers
      const newText = before.slice(0, -markerLen) + selected + after.slice(markerLen);
      setEditedText(newText);
      setTimeout(() => {
        ta.selectionStart = start - markerLen;
        ta.selectionEnd = end - markerLen;
        ta.focus();
      }, 0);
    } else {
      // Add markers
      const newText = before + marker + selected + marker + after;
      setEditedText(newText);
      setTimeout(() => {
        ta.selectionStart = start + markerLen;
        ta.selectionEnd = end + markerLen;
        ta.focus();
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 500) + "px";
      }, 0);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyFormat('*');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyFormat('**');
    }
  };

  const FormatBtn = ({ label, title, shortcut, onClick, preview }) => (
    <button onClick={onClick} title={`${title} (${shortcut})`} style={{
      background: "none", border: `1px solid ${border}`, borderRadius: 5, padding: "4px 10px",
      cursor: "pointer", fontFamily: font, fontSize: 13, color: ink,
      display: "flex", alignItems: "center", gap: 4, transition: "all 0.12s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = border; }}
    >
      <span style={preview}>{label}</span>
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px 12px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Redigera text</h3>
              <span style={{ fontFamily: uiFont, fontSize: 11, color: muted }}>{chapterTitle} · {wordCount} ord</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: muted, padding: 4 }}>✕</button>
          </div>

          {/* Formatting toolbar */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <FormatBtn label="K" title="Kursiv" shortcut="⌘I" onClick={() => applyFormat('*')} preview={{ fontStyle: "italic" }} />
            <FormatBtn label="F" title="Fetstil" shortcut="⌘B" onClick={() => applyFormat('**')} preview={{ fontWeight: 700 }} />
            <div style={{ width: 1, height: 20, background: border, margin: "0 4px" }} />
            <span style={{ fontFamily: uiFont, fontSize: 9.5, color: muted }}>
              Markera text → klicka format. *kursiv* · **fetstil**
            </span>
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => {
              setEditedText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 500) + "px";
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", minHeight: 200, padding: 16, borderRadius: 10, border: `1px solid ${border}`,
              fontFamily: font, fontSize: 15.5, lineHeight: 1.85, color: "#3d2e23",
              resize: "none", background: bg, outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = accent}
            onBlur={e => e.target.style.borderColor = border}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 28px 20px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => onCreateChapter(editedText)} style={{
            fontFamily: uiFont, fontSize: 11.5, padding: "8px 16px", borderRadius: 6, cursor: "pointer",
            border: `1px solid ${border}`, background: surface, color: ink, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6,
          }}
            onMouseEnter={e => e.currentTarget.style.background = bg}
            onMouseLeave={e => e.currentTarget.style.background = surface}
          >
            <span style={{ fontSize: 14 }}>+</span> Skapa nytt kapitel
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              fontFamily: uiFont, fontSize: 12, padding: "8px 20px", borderRadius: 6,
              border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer",
            }}>Avbryt</button>
            <button
              onClick={() => { onSave(editedText); onClose(); }}
              disabled={!hasChanges}
              style={{
                fontFamily: uiFont, fontSize: 12, padding: "8px 24px", borderRadius: 6, border: "none",
                background: hasChanges ? accent : "#d4c8bb", color: "#fff", cursor: hasChanges ? "pointer" : "default",
                fontWeight: 600, transition: "background 0.15s",
              }}
            >Spara ändringar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ s, isActive, onToggle, onAccept, onReject, status, onUndo }) {
  const p = PRIORITY[s.priority];
  const isHandled = status === "accepted" || status === "rejected";

  return (
    <div onClick={onToggle} style={{
      padding: "12px 12px", marginBottom: 6, borderRadius: 9,
      border: `1px solid ${isActive ? p.color + "50" : border}`,
      background: isHandled ? (status === "accepted" ? "#f0faf3" : bg) : isActive ? p.bg : surface,
      cursor: "pointer", transition: "all 0.15s",
      opacity: isHandled ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
        <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: p.color }}>{LEVEL_LABELS[s.level]}</span>
        {isHandled && (
          <span style={{
            fontFamily: uiFont, fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
            background: status === "accepted" ? "#27864a20" : muted + "20",
            color: status === "accepted" ? "#27864a" : muted,
          }}>
            {status === "accepted" ? "✓ Godkänd" : "✗ Avvisad"}
          </span>
        )}
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
      {isActive && !isHandled && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontFamily: uiFont, fontSize: 11.5, color: "#5a4e42", lineHeight: 1.55, margin: "0 0 10px" }}>{s.reason}</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onAccept(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: "none", background: "#27864a", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>✓ Godkänn</button>
            <button onClick={e => { e.stopPropagation(); onReject(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>✗ Avvisa</button>
          </div>
        </div>
      )}
      {isActive && isHandled && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontFamily: uiFont, fontSize: 11.5, color: "#5a4e42", lineHeight: 1.55, margin: "0 0 8px" }}>{s.reason}</p>
          <button onClick={e => { e.stopPropagation(); onUndo(); }} style={{
            width: "100%", padding: "7px 0", borderRadius: 5, border: `1px solid ${border}`,
            background: surface, color: ink, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: uiFont,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>↩ Ångra</button>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS MODAL (for editor) ───
function SettingsModal({ onClose, genres, setGenres, modules, setModules, transLangs, setTransLangs, conventions, setConventions }) {
  const toggle = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const setConv = (key, val) => setConventions(prev => ({ ...prev, [key]: val }));

  const ConvOption = ({ label, options, value, onChange, preview }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 500, color: ink, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontFamily: uiFont, fontSize: 11.5, textAlign: "left",
            border: value === o.value ? `2px solid ${accent}` : `1px solid ${border}`,
            background: value === o.value ? accentLight : surface, color: value === o.value ? accent : ink,
            fontWeight: value === o.value ? 600 : 400, transition: "all 0.12s",
          }}>
            <div>{o.label}</div>
            <div style={{ fontFamily: font, fontSize: 12, color: muted, marginTop: 3, fontStyle: o.italic ? "italic" : "normal" }}>{o.example}</div>
          </button>
        ))}
      </div>
    </div>
  );

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

        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Textkonventioner</h3>
          <p style={{ fontFamily: uiFont, fontSize: 11, color: muted, margin: "0 0 14px", lineHeight: 1.4 }}>
            Välj standarder för ditt manus. AI:n kommer att granska och föreslå ändringar baserat på dessa val.
          </p>

          <ConvOption
            label="Dialog"
            value={conventions.dialogMark}
            onChange={v => setConv("dialogMark", v)}
            options={[
              { value: "dash", label: "Tankstreck", example: "– Hej, sa hon." },
              { value: "quotes", label: "Citattecken", example: '"Hej", sa hon.' },
            ]}
          />

          <ConvOption
            label="Bok- och filmtitlar"
            value={conventions.titleStyle}
            onChange={v => setConv("titleStyle", v)}
            options={[
              { value: "italic", label: "Kursiv", example: "Hon läste Borta med vinden.", italic: true },
              { value: "quotes", label: "Citattecken", example: 'Hon läste "Borta med vinden".' },
            ]}
          />

          <ConvOption
            label="Inre tankar"
            value={conventions.innerThought}
            onChange={v => setConv("innerThought", v)}
            options={[
              { value: "italic", label: "Kursiv", example: "Varför sa han så? tänkte hon.", italic: true },
              { value: "none", label: "Ingen markering", example: "Varför sa han så, tänkte hon." },
            ]}
          />

          <ConvOption
            label="Ellipsis"
            value={conventions.ellipsis}
            onChange={v => setConv("ellipsis", v)}
            options={[
              { value: "three", label: "Tre punkter", example: "Hon tvekade..." },
              { value: "unicode", label: "Ellipsis-tecken", example: "Hon tvekade\u2026" },
            ]}
          />
        </section>

        <button onClick={onClose} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>
          Spara inställningar
        </button>
      </div>
    </div>
  );
}

// ─── DEVELOP PANEL ───
function DevelopPanel({ dnaProfile, chapterContent, chapterTitle, onResult }) {
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
        {tab === "develop" && <DevelopView dnaProfile={dnaProfile} chapterContent={chapterContent} chapterTitle={chapterTitle} onResult={onResult} />}
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

function DevelopView({ inputText, chapterContent, chapterTitle, dnaProfile, onResult }) {
  const [mode, setMode] = useState(null);
  const [userText, setUserText] = useState(inputText || "");
  const [rewriteFocus, setRewriteFocus] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Sync input text when selection changes
  useEffect(() => { if (inputText) setUserText(inputText); }, [inputText]);

  const modes = [
    { id: "expand", icon: "↔", label: "Bygga ut scen", desc: "Fördjupa en befintlig scen med sinnesintryck, dialog eller internmonolog" },
    { id: "rewrite", icon: "✎", label: "Skriva om", desc: "Omarbeta en passage – visa istället för att berätta" },
    { id: "newscene", icon: "+", label: "Ny scen / kapitel", desc: "Generera helt nytt textavsnitt som passar in i manuset" },
  ];

  const rewriteOptions = ["Visa istf berätta", "Mer dialog", "Mer sinnesintryck", "Höja tempot", "Sänka tempot", "Fördjupa känsla"];

  const handleGenerate = async () => {
    if (!userText.trim() && mode !== "newscene") return;
    setGenerating(true);
    setError(null);

    const dnaStr = dnaProfile ? `\nFörfattarens DNA-profil: Perspektiv: ${dnaProfile.perspective}, Tempus: ${dnaProfile.tense}, Tonalitet: ${dnaProfile.tonality}, Meningslängd: ${dnaProfile.avgSentenceLen}, Dialogstil: ${dnaProfile.dialogStyle}, Bildspråk: ${dnaProfile.dominantImagery}` : "";

    const contextSnippet = chapterContent ? chapterContent.slice(0, 6000) : "";

    let systemMsg = `Du är en kreativ skrivassistent för svenska manus. Du matchar alltid författarens stil, ton och röst.${dnaStr}\n\nKontext från ${chapterTitle || "kapitlet"}:\n${contextSnippet}\n\nSvara ALLTID med JSON i detta format:\n{\n  "developedText": "<den utvecklade texten>",\n  "reasoning": "<1-3 meningar som förklarar ditt resonemang och hur texten passar in i berättelsen>"\n}`;

    let userMsg = "";
    if (mode === "expand") {
      userMsg = `Bygg ut denna scen med mer detaljer, sinnesintryck, dialog eller internmonolog. Behåll författarens röst:\n\n${userText}`;
    } else if (mode === "rewrite") {
      const focus = rewriteFocus.length > 0 ? `\nFokus: ${rewriteFocus.join(", ")}` : "";
      userMsg = `Skriv om denna passage.${focus}\n\n${userText}`;
    } else if (mode === "newscene") {
      userMsg = `Skriv ett nytt textavsnitt baserat på denna beskrivning. Matcha författarens stil:\n\n${userText}`;
    }

    try {
      const response = await sendMessage({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemMsg,
        messages: [{ role: "user", content: userMsg }],
      });

      if (response) {
        const text = extractText(response);
        const parsed = parseJsonResponse(text);
        if (parsed?.developedText) {
          onResult({
            mode,
            modeLabel: modes.find(m => m.id === mode)?.label,
            originalText: userText,
            developedText: parsed.developedText,
            reasoning: parsed.reasoning || "AI har genererat en ny version baserat på din text och författarprofil.",
          });
        } else {
          // Fallback: treat the whole response as text
          onResult({
            mode,
            modeLabel: modes.find(m => m.id === mode)?.label,
            originalText: userText,
            developedText: text,
            reasoning: "Texten har genererats baserat på din förfrågan.",
          });
        }
      }
    } catch (err) {
      console.error("Develop failed:", err);
      setError(err.message || "Generering misslyckades. Kontrollera API-nyckeln.");
    } finally {
      setGenerating(false);
    }
  };

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
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}
            >
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
          <button onClick={() => { setMode(null); setError(null); }} style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: 11, color: muted, cursor: "pointer", marginBottom: 12, padding: 0 }}>← Tillbaka</button>
          <div style={{ padding: "14px 14px", background: bg, borderRadius: 9 }}>
            <div style={{ fontWeight: 600, color: ink, fontSize: 13, marginBottom: 8 }}>{modes.find(m => m.id === mode)?.label}</div>
            <div style={{ fontSize: 11, color: muted, lineHeight: 1.5, marginBottom: 12 }}>
              {mode === "expand" && "Markera det stycke du vill bygga ut. AI:n analyserar kontexten och föreslår utökat innehåll som matchar din röst."}
              {mode === "rewrite" && "Markera den passage som ska skrivas om. Välj fokus nedan:"}
              {mode === "newscene" && "Beskriv vad den nya scenen ska uppnå. AI:n föreslår text baserad på din DNA-profil och manuskriptets kontext."}
            </div>
            {mode === "rewrite" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {rewriteOptions.map(opt => {
                  const active = rewriteFocus.includes(opt);
                  return (
                    <span key={opt} onClick={() => setRewriteFocus(prev => active ? prev.filter(x => x !== opt) : [...prev, opt])} style={{
                      padding: "4px 10px", borderRadius: 12, fontSize: 10, cursor: "pointer", transition: "all 0.12s",
                      border: active ? `1.5px solid ${accent}` : `1px solid ${border}`,
                      background: active ? accentLight : surface, color: active ? accent : ink, fontWeight: active ? 600 : 400,
                    }}>{opt}</span>
                  );
                })}
              </div>
            )}
            <textarea
              value={userText}
              onChange={e => setUserText(e.target.value)}
              placeholder={mode === "newscene" ? "Beskriv scenen: vad ska hända, vilka karaktärer, vilken stämning..." : "Klistra in eller markera text i manuset..."}
              style={{
                width: "100%", minHeight: 80, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 11.5,
                resize: "vertical", background: surface, color: ink, outline: "none", boxSizing: "border-box",
              }}
            />
            {error && (
              <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "#fef2f2", color: "#b91c1c", fontSize: 10.5 }}>{error}</div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || (!userText.trim() && mode !== "newscene")}
              style={{
                marginTop: 8, width: "100%", padding: "10px 0", borderRadius: 7, border: "none",
                background: generating ? "#d4c8bb" : accent, color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: generating ? "default" : "pointer", fontFamily: uiFont,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  AI skriver...
                </>
              ) : "Generera förslag"}
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
    { name: "Litet förlag", usage: "5 manus/mån, granskning + 2 språk", cost: "~3 400 kr", trad: "~250 000+ kr" },
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

// ─── DEVELOP RESULT MODAL ───
function DevelopResultModal({ result, onInsert, onRegenerate, onClose }) {
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(result.developedText);
  const textareaRef = useRef(null);
  const wordCount = editedText.trim().split(/\s+/).filter(w => w).length;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 400) + "px";
    }
  }, [editing]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px 14px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>
                {result.modeLabel || "Utvecklad text"}
              </h3>
              <span style={{ fontFamily: uiFont, fontSize: 11, color: muted }}>{wordCount} ord genererade</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: muted, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* AI Reasoning */}
        <div style={{ padding: "12px 28px", background: "#fdf8f0", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
            <div>
              <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>AI:ns resonemang</div>
              <p style={{ fontFamily: uiFont, fontSize: 12, color: "#5a4e42", lineHeight: 1.6, margin: 0 }}>{result.reasoning}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {/* Original text (if applicable) */}
          {result.originalText && result.mode !== "newscene" && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: uiFont, fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Original</div>
              <div style={{
                padding: "12px 14px", borderRadius: 8, background: bg, border: `1px solid ${border}`,
                fontFamily: font, fontSize: 14, lineHeight: 1.8, color: muted, fontStyle: "italic",
                maxHeight: 120, overflowY: "auto",
              }}>
                {result.originalText.slice(0, 500)}{result.originalText.length > 500 ? "..." : ""}
              </div>
            </div>
          )}

          {/* Developed text */}
          <div>
            <div style={{ fontFamily: uiFont, fontSize: 9.5, fontWeight: 600, color: "#27864a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {editing ? "Redigera texten" : "Genererad text"}
            </div>
            {editing ? (
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => {
                  setEditedText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 400) + "px";
                }}
                style={{
                  width: "100%", minHeight: 150, padding: 14, borderRadius: 8, border: `2px solid ${accent}`,
                  fontFamily: font, fontSize: 15, lineHeight: 1.85, color: "#3d2e23",
                  resize: "none", background: "#fff", outline: "none", boxSizing: "border-box",
                }}
              />
            ) : (
              <div style={{
                padding: "14px 16px", borderRadius: 8, background: "#f0faf3", border: "1px solid #27864a30",
                fontFamily: font, fontSize: 15, lineHeight: 1.85, color: ink,
              }}>
                {editedText}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ padding: "14px 28px 20px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {editing ? (
                <button onClick={() => setEditing(false)} style={{
                  fontFamily: uiFont, fontSize: 12, padding: "9px 18px", borderRadius: 7,
                  border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500,
                }}>✓ Klar med redigering</button>
              ) : (
                <button onClick={() => setEditing(true)} style={{
                  fontFamily: uiFont, fontSize: 12, padding: "9px 18px", borderRadius: 7,
                  border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 5,
                }}>✎ Redigera</button>
              )}
              <button onClick={onRegenerate} style={{
                fontFamily: uiFont, fontSize: 12, padding: "9px 18px", borderRadius: 7,
                border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}>↻ Generera om</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{
                fontFamily: uiFont, fontSize: 12, padding: "9px 18px", borderRadius: 7,
                border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer",
              }}>Avbryt</button>
              <button onClick={() => onInsert(editedText)} style={{
                fontFamily: uiFont, fontSize: 12, padding: "9px 22px", borderRadius: 7,
                border: "none", background: "#27864a", color: "#fff", cursor: "pointer", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
              }}>↓ Infoga i manus</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT MODAL ───
function ExportModal({ chapters, paragraphsByChapter, accepted, rejected, fileName, onClose }) {
  const [exportFont, setExportFont] = useState("Times New Roman");
  const [exportSize, setExportSize] = useState(12);
  const [exportSpacing, setExportSpacing] = useState(1.5);
  const [exportMargins, setExportMargins] = useState("normal");
  const [exportTitleStyle, setExportTitleStyle] = useState("both");
  const [exportPageNumbers, setExportPageNumbers] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fonts = ["Times New Roman", "Garamond", "Georgia", "Palatino", "Libre Baskerville"];
  const sizes = [11, 12, 13];
  const spacings = [{ v: 1.0, l: "Enkelt" }, { v: 1.15, l: "1.15" }, { v: 1.5, l: "1.5" }, { v: 2.0, l: "Dubbelt" }];
  const marginOptions = [{ v: "narrow", l: "Smal (1.9cm)" }, { v: "normal", l: "Normal (2.5cm)" }, { v: "wide", l: "Bred (3.2cm)" }];
  const titleStyles = [{ v: "uppercase", l: "VERSALER" }, { v: "bold", l: "Fetstil" }, { v: "both", l: "VERSALER + FET" }];

  const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0);
  const acceptedCount = [...accepted].filter(id => chapters.some(ch => {
    const paras = paragraphsByChapter[ch.id] || [];
    return paras.some(p => p.suggestions?.some(s => s.id === id));
  })).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportToDocx({
        title: fileName,
        chapters,
        paragraphsByChapter,
        accepted,
        rejected,
        options: {
          font: exportFont,
          fontSize: exportSize,
          lineSpacing: exportSpacing,
          margins: exportMargins,
          chapterTitleStyle: exportTitleStyle,
          pageNumbers: exportPageNumbers,
        },
      });
      downloadBlob(blob, `${fileName} – Tryckfärdig.docx`);
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export misslyckades: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const OptionGroup = ({ label, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );

  const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: uiFont, fontSize: 11.5,
      border: active ? `2px solid ${accent}` : `1px solid ${border}`,
      background: active ? accentLight : surface, color: active ? accent : ink,
      fontWeight: active ? 600 : 400, transition: "all 0.12s",
    }}>{children}</button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)", padding: "28px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Exportera manus</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: muted, padding: 4 }}>✕</button>
        </div>
        <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 24px" }}>
          {fileName} · {chapters.length} kapitel · {totalWords.toLocaleString()} ord · {acceptedCount} godkända ändringar appliceras
        </p>

        <OptionGroup label="Typsnitt">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {fonts.map(f => (
              <Chip key={f} active={exportFont === f} onClick={() => setExportFont(f)}>
                <span style={{ fontFamily: f === "Libre Baskerville" ? "Georgia" : f }}>{f}</span>
              </Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Teckenstorlek">
          <div style={{ display: "flex", gap: 6 }}>
            {sizes.map(s => (
              <Chip key={s} active={exportSize === s} onClick={() => setExportSize(s)}>{s} pt</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Radavstånd">
          <div style={{ display: "flex", gap: 6 }}>
            {spacings.map(s => (
              <Chip key={s.v} active={exportSpacing === s.v} onClick={() => setExportSpacing(s.v)}>{s.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Marginaler">
          <div style={{ display: "flex", gap: 6 }}>
            {marginOptions.map(m => (
              <Chip key={m.v} active={exportMargins === m.v} onClick={() => setExportMargins(m.v)}>{m.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Kapitelrubriker">
          <div style={{ display: "flex", gap: 6 }}>
            {titleStyles.map(t => (
              <Chip key={t.v} active={exportTitleStyle === t.v} onClick={() => setExportTitleStyle(t.v)}>{t.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Sidnumrering">
          <div style={{ display: "flex", gap: 6 }}>
            <Chip active={exportPageNumbers} onClick={() => setExportPageNumbers(true)}>Ja</Chip>
            <Chip active={!exportPageNumbers} onClick={() => setExportPageNumbers(false)}>Nej</Chip>
          </div>
        </OptionGroup>

        {/* Preview strip */}
        <div style={{ padding: "16px 20px", background: bg, borderRadius: 10, marginBottom: 20, border: `1px solid ${border}` }}>
          <div style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Förhandsvisning</div>
          <div style={{
            fontFamily: exportFont === "Libre Baskerville" ? "Georgia" : exportFont,
            fontSize: exportSize, lineHeight: exportSpacing, color: ink,
          }}>
            <div style={{
              textAlign: "center", marginBottom: 12,
              fontWeight: exportTitleStyle === "bold" || exportTitleStyle === "both" ? 700 : 400,
              fontSize: exportSize + 4,
              textTransform: exportTitleStyle === "uppercase" || exportTitleStyle === "both" ? "uppercase" : "none",
            }}>
              Kapitel 1
            </div>
            <div style={{ textIndent: "1.27cm" }}>
              Sommaren närmade sig, det var slutet av 80-talet. Det är svårt att föreställa sig att livet kunde erbjuda något bättre.
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 9, border: "none",
            background: exporting ? "#d4c8bb" : accent, color: "#fff", fontSize: 14,
            fontWeight: 600, cursor: exporting ? "default" : "pointer", fontFamily: uiFont,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {exporting ? "Exporterar..." : "Ladda ner .docx"}
        </button>
      </div>
    </div>
  );
}

// ─── RESTORE PROMPT ───
function RestorePrompt({ timestamp, onRestore, onDiscard }) {
  const timeAgo = ((Date.now() - timestamp) / 60000).toFixed(0);
  const timeStr = timeAgo < 60 ? `${timeAgo} min sedan` : timeAgo < 1440 ? `${Math.round(timeAgo / 60)} timmar sedan` : `${Math.round(timeAgo / 1440)} dagar sedan`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.5)", backdropFilter: "blur(6px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, padding: "32px 36px", maxWidth: 440, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>📄</div>
        <h3 style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: ink, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Återuppta arbete?</h3>
        <p style={{ fontFamily: uiFont, fontSize: 12.5, color: muted, margin: "0 0 24px", lineHeight: 1.5 }}>
          Du har osparat arbete från {timeStr}.<br />Vill du fortsätta där du slutade?
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDiscard} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${border}`, background: surface, color: muted, fontSize: 13, cursor: "pointer", fontFamily: uiFont, fontWeight: 500 }}>Börja om</button>
          <button onClick={onRestore} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: uiFont, fontWeight: 600 }}>Återuppta</button>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH PAGE ───
function AuthPage({ onLogin, onRegister, error: externalError }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || "Inloggning misslyckades");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte");
      return;
    }
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken");
      return;
    }
    setLoading(true);
    try {
      await onRegister(email, password, name);
    } catch (err) {
      setError(err.message || "Registrering misslyckades");
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || externalError;

  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`,
    background: bg, fontFamily: uiFont, fontSize: 13, color: ink, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };
  const labelStyle = { fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, background: ink, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 18, fontWeight: 700 }}>M</div>
        <span style={{ fontSize: 24, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
      </div>
      <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 32px", textAlign: "center" }}>AI-stödd manusgranskning for författare, redaktörer och förlag</p>

      <div style={{ width: "100%", maxWidth: 420, background: surface, borderRadius: 16, padding: "32px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: `2px solid ${border}` }}>
          {[{ id: "login", label: "Logga in" }, { id: "register", label: "Skapa konto" }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); }} style={{
              flex: 1, padding: "10px 0", border: "none", background: "none", fontFamily: uiFont,
              fontSize: 13, fontWeight: 600, cursor: "pointer", color: tab === t.id ? accent : muted,
              borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
              marginBottom: -2, transition: "all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {displayError && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fdf0ef", borderRadius: 8, borderLeft: `3px solid #c0392b`, fontFamily: uiFont, fontSize: 12, color: "#c0392b" }}>
            {displayError}
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="din@email.se" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Lösenord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Ditt lösenord" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px 0", borderRadius: 9, border: "none",
              background: loading ? "#d4c8bb" : accent, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: loading ? "default" : "pointer", fontFamily: uiFont, transition: "background 0.2s",
            }}>{loading ? "Loggar in..." : "Logga in"}</button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Namn</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ditt namn" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="din@email.se" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Lösenord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Minst 6 tecken" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Bekräfta lösenord</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Upprepa lösenord" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px 0", borderRadius: 9, border: "none",
              background: loading ? "#d4c8bb" : accent, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: loading ? "default" : "pointer", fontFamily: uiFont, transition: "background 0.2s",
            }}>{loading ? "Skapar konto..." : "Skapa konto"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD VIEW ───
function DashboardView({ user, onOpenProject, onNewProject, onLogout, onProfile }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.getProjects();
        setProjects(data.projects || data || []);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id) => {
    if (deleting) return;
    setDeleting(id);
    try {
      await apiClient.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
      setMenuOpen(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: ink, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 15, fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{user?.name || user?.email}</span>
          <button onClick={onProfile} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>Profil</button>
          <button onClick={onLogout} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Logga ut</button>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Dina manus</h1>
        <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 32px" }}>Välj ett projekt att arbeta med eller skapa ett nytt.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>Laddar projekt...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260, 1fr))", gap: 16 }}>
            {/* New project card */}
            <button onClick={onNewProject} style={{
              padding: "32px 20px", borderRadius: 14, border: `2px dashed ${border}`, background: "transparent",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, minHeight: 180, transition: "all 0.2s",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: accent }}>+</div>
              <span style={{ fontFamily: uiFont, fontSize: 13, fontWeight: 600, color: accent }}>Nytt manus</span>
            </button>

            {/* Project cards */}
            {projects.map(project => {
              const totalWords = project.wordCount || project.chapters?.reduce((s, c) => s + (c.wordCount || 0), 0) || 0;
              const chapterCount = project.chapterCount || project.chapters?.length || 0;
              const progress = project.progress || 0;
              return (
                <div key={project.id} style={{
                  background: surface, borderRadius: 14, padding: "20px 20px 16px", border: `1px solid ${border}`,
                  display: "flex", flexDirection: "column", gap: 10, position: "relative", minHeight: 180,
                }}>
                  {/* Three-dot menu */}
                  <div style={{ position: "absolute", top: 12, right: 12 }}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id); }} style={{
                      background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontSize: 16, color: muted, lineHeight: 1,
                    }}>...</button>
                    {menuOpen === project.id && (
                      <div style={{ position: "absolute", right: 0, top: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 120, overflow: "hidden" }}>
                        <button onClick={() => handleDelete(project.id)} disabled={deleting === project.id} style={{
                          width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left",
                          fontFamily: uiFont, fontSize: 12, color: "#c0392b", cursor: "pointer",
                        }}>{deleting === project.id ? "Raderar..." : "Radera"}</button>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: ink, margin: "0 0 4px", letterSpacing: "-0.01em", paddingRight: 24 }}>{project.title || "Namnlöst manus"}</h3>
                    {project.genre && <span style={{ fontFamily: uiFont, fontSize: 10, color: muted, background: bg, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{project.genre}</span>}
                  </div>

                  <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, display: "flex", gap: 12 }}>
                    <span>{chapterCount} kapitel</span>
                    <span>{totalWords.toLocaleString()} ord</span>
                  </div>

                  {/* Progress bar */}
                  {progress > 0 && (
                    <div style={{ height: 4, background: border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: accent, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>{formatDate(project.updatedAt || project.updated_at)}</span>
                    <button onClick={() => onOpenProject(project)} style={{
                      fontFamily: uiFont, fontSize: 11, padding: "6px 16px", borderRadius: 7, border: "none",
                      background: accent, color: "#fff", cursor: "pointer", fontWeight: 600,
                    }}>Öppna</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROFILE VIEW ───
function ProfileView({ user, onBack }) {
  const [usage, setUsage] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [usageData, projectData] = await Promise.all([
          apiClient.getUsage().catch(() => null),
          apiClient.getProjects().catch(() => ({ projects: [] })),
        ]);
        if (usageData) setUsage(usageData);
        setProjects(projectData.projects || projectData || []);
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoadingUsage(false);
      }
    })();
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      if (user.plan && user.plan !== "trial") {
        const res = await apiClient.openPortal();
        if (res.url) window.location.href = res.url;
      } else {
        const res = await apiClient.createCheckout();
        if (res.url) window.location.href = res.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    } finally {
      setUpgrading(false);
    }
  };

  const planLabels = { trial: "PROVA", basic: "GRUND", publisher: "FÖRLAG" };
  const planColors = { trial: muted, basic: accent, publisher: "#27864a" };
  const currentPlan = user?.plan || "trial";

  const sectionStyle = { background: surface, borderRadius: 14, padding: "24px 28px", border: `1px solid ${border}`, marginBottom: 20 };
  const sectionTitle = { fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" };
  const statRow = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${border}`, fontFamily: uiFont, fontSize: 12.5 };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", background: surface }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontFamily: uiFont, fontSize: 12, color: muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>&larr;</span> Tillbaka till dashboard
        </button>
      </header>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: ink, margin: "0 0 32px", letterSpacing: "-0.02em" }}>Min profil</h1>

        {/* Account info */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Kontoinformation</h2>
          <div style={statRow}>
            <span style={{ color: muted }}>Namn</span>
            <span style={{ color: ink, fontWeight: 500 }}>{user?.name || "—"}</span>
          </div>
          <div style={statRow}>
            <span style={{ color: muted }}>E-post</span>
            <span style={{ color: ink, fontWeight: 500 }}>{user?.email || "—"}</span>
          </div>
          <div style={{ ...statRow, borderBottom: "none" }}>
            <span style={{ color: muted }}>Plan</span>
            <span style={{
              fontFamily: uiFont, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
              background: `${planColors[currentPlan]}18`, color: planColors[currentPlan],
            }}>{planLabels[currentPlan] || currentPlan}</span>
          </div>
        </div>

        {/* Usage */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Månadens användning</h2>
          {loadingUsage ? (
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted, padding: 16, textAlign: "center" }}>Laddar...</div>
          ) : usage ? (
            <>
              <div style={statRow}>
                <span style={{ color: muted }}>Granskningar</span>
                <span style={{ color: ink, fontWeight: 500 }}>{usage.reviews ?? usage.reviewCount ?? 0}</span>
              </div>
              <div style={statRow}>
                <span style={{ color: muted }}>DNA-profiler</span>
                <span style={{ color: ink, fontWeight: 500 }}>{usage.dnaProfiles ?? usage.dna ?? 0}</span>
              </div>
              <div style={statRow}>
                <span style={{ color: muted }}>Utveckling</span>
                <span style={{ color: ink, fontWeight: 500 }}>{usage.development ?? usage.develop ?? 0}</span>
              </div>
              <div style={statRow}>
                <span style={{ color: muted }}>Översättningar</span>
                <span style={{ color: ink, fontWeight: 500 }}>{usage.translations ?? usage.translate ?? 0}</span>
              </div>
              <div style={{ ...statRow, borderBottom: "none", fontWeight: 600 }}>
                <span style={{ color: ink }}>Total kostnad</span>
                <span style={{ color: accent }}>{usage.totalCost != null ? `${usage.totalCost} kr` : "—"}</span>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted, padding: 8 }}>Ingen data tillgänglig</div>
          )}
        </div>

        {/* Projects */}
        <div style={sectionStyle}>
          <h2 style={sectionTitle}>Projekt</h2>
          {projects.length === 0 ? (
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted, padding: 8 }}>Inga projekt ännu</div>
          ) : (
            projects.map((p, i) => (
              <div key={p.id} style={{ ...statRow, borderBottom: i < projects.length - 1 ? `1px solid ${border}` : "none" }}>
                <span style={{ color: ink }}>{p.title || "Namnlöst"}</span>
                <span style={{ color: muted, fontSize: 11 }}>{p.chapterCount || p.chapters?.length || 0} kap</span>
              </div>
            ))
          )}
        </div>

        {/* Publishing placeholder */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Publicering</h2>
            <span style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${accent}18`, color: accent }}>Kommer snart</span>
          </div>
          <div style={{ display: "flex", gap: 20, fontFamily: uiFont, fontSize: 12, color: muted }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>📖</div>
              <span>E-bok</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>🎧</div>
              <span>Ljudbok</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>🖨</div>
              <span>Tryck</span>
            </div>
          </div>
        </div>

        {/* Upgrade button */}
        <button onClick={handleUpgrade} disabled={upgrading} style={{
          width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
          background: upgrading ? "#d4c8bb" : accent, color: "#fff", fontSize: 14, fontWeight: 600,
          cursor: upgrading ? "default" : "pointer", fontFamily: uiFont, transition: "background 0.2s",
        }}>{upgrading ? "Laddar..." : "Uppgradera plan"}</button>
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const { user, loading: authLoading, login, register, logout, isAuthenticated } = useAuth();

  // Flow: "auth" → "dashboard" → "upload" → "settings" → "processing" → "editor" / "profile"
  const [view, setView] = useState("loading"); // start with loading to check for saved data
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
  const [conventions, setConventions] = useState({
    dialogMark: "dash",     // "dash" (tankstreck –) | "quotes" (citattecken "")
    titleStyle: "italic",   // "italic" (*kursiv*) | "quotes" (citattecken "")
    innerThought: "italic", // "italic" | "none" (ingen markering)
    ellipsis: "three",      // "three" (tre punkter ...) | "unicode" (…)
  });
  const [rightPanel, setRightPanel] = useState("suggestions");
  const [processingStatus, setProcessingStatus] = useState("");
  const [dnaProfile, setDnaProfile] = useState(null);
  const [selectionToolbar, setSelectionToolbar] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [developResult, setDevelopResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved"
  const mainRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveIndicatorRef = useRef(null);
  const autoSaveEnabled = useRef(false); // prevent save before restore decision

  // ─── RESTORE ON MOUNT ───
  useEffect(() => {
    if (authLoading) return; // wait for auth to settle
    if (!isAuthenticated) {
      setView("auth");
      return;
    }
    (async () => {
      try {
        const saved = await loadProject();
        if (saved?.chapters?.length > 0) {
          // Auto-restore: go straight to editor with saved data
          setChapters(saved.chapters);
          setParagraphsByChapter(saved.paragraphsByChapter || {});
          setAccepted(saved.accepted instanceof Set ? saved.accepted : new Set(saved.accepted || []));
          setRejected(saved.rejected instanceof Set ? saved.rejected : new Set(saved.rejected || []));
          setDnaProfile(saved.dnaProfile || null);
          setGenres(saved.genres || []);
          setModules(saved.modules || []);
          setTransLangs(saved.transLangs || ["en"]);
          setActiveChapter(saved.activeChapter || saved.chapters?.[0]?.id);
          setUploadedFile({ name: saved.fileName || "Manus" });
          setView("editor");
          autoSaveEnabled.current = true;
        } else {
          setView("dashboard");
        }
      } catch (err) {
        console.error("Restore failed:", err);
        setView("dashboard");
      }
    })();
  }, [authLoading, isAuthenticated]);

  // ─── AUTO-SAVE ───
  useEffect(() => {
    if (view !== "editor" || chapters.length === 0) return;
    // Small delay on first render to let restore finish
    if (!autoSaveEnabled.current) {
      autoSaveEnabled.current = true;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await saveProject({
        chapters,
        paragraphsByChapter,
        accepted,
        rejected,
        dnaProfile,
        genres,
        modules,
        transLangs,
        activeChapter,
        fileName: uploadedFile?.name || "Manus",
        view,
      });
      setSaveStatus("saved");
      if (saveIndicatorRef.current) clearTimeout(saveIndicatorRef.current);
      saveIndicatorRef.current = setTimeout(() => setSaveStatus(null), 2500);
    }, 800);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [chapters, paragraphsByChapter, accepted, rejected, dnaProfile, genres, modules, transLangs, activeChapter, view]);

  // ─── START FRESH (clear saved data) ───
  const handleStartFresh = async () => {
    await clearProject();
    setChapters([]);
    setParagraphsByChapter({});
    setAccepted(new Set());
    setRejected(new Set());
    setDnaProfile(null);
    setGenres([]);
    setModules([]);
    setUploadedFile(null);
    setActiveChapter(null);
    setView("dashboard");
  };

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
      conventions,
    });

    const updatedChapters = [...chaps];
    const updatedParas = { ...parasMap };

    let skipped = 0;
    for (let i = 0; i < updatedChapters.length; i++) {
      // Skip chapters that already have suggestions
      const existingParas = updatedParas[updatedChapters[i].id] || [];
      const hasSuggestions = existingParas.some(p => p.suggestions?.length > 0);
      if (hasSuggestions) {
        updatedChapters[i] = { ...updatedChapters[i], status: "done" };
        setChapters([...updatedChapters]);
        setProcessingStatus(`${updatedChapters[i].title} redan analyserad – hoppar över...`);
        skipped++;
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      updatedChapters[i] = { ...updatedChapters[i], status: "active" };
      setChapters([...updatedChapters]);
      setProcessingStatus(`Analyserar ${updatedChapters[i].title} (${i + 1 - skipped}/${updatedChapters.length - skipped})...`);

      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            const wait = Math.pow(2, attempt) * 2000; // 4s, 8s
            setProcessingStatus(`Rate limit – väntar ${wait / 1000}s innan retry... (${updatedChapters[i].title})`);
            await new Promise(r => setTimeout(r, wait));
            setProcessingStatus(`Analyserar ${updatedChapters[i].title} (${i + 1}/${updatedChapters.length}) – retry ${attempt}...`);
          }

          const request = buildReviewRequest(systemPrompt, updatedChapters[i].content);
          const response = await sendMessage(request);

          if (response) {
            const text = extractText(response);
            const parsed = parseJsonResponse(text);
            if (parsed?.suggestions?.length) {
              const chapterParas = updatedParas[updatedChapters[i].id] || [];
              const enrichedParas = attachSuggestionsToParagraphs(chapterParas, parsed.suggestions, updatedChapters[i].id);
              updatedParas[updatedChapters[i].id] = enrichedParas;
              setParagraphsByChapter({ ...updatedParas });
            }
          }
          success = true;
        } catch (err) {
          console.error(`Review failed for chapter ${i + 1} (attempt ${attempt + 1}):`, err);
          if (attempt === 2) {
            setProcessingStatus(`⚠ ${updatedChapters[i].title} kunde inte analyseras – fortsätter...`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      updatedChapters[i] = { ...updatedChapters[i], status: "done" };
      setChapters([...updatedChapters]);

      // Longer pause between chapters to avoid rate limiting (API allows ~5 req/min)
      if (i < updatedChapters.length - 1) {
        const pauseMs = 8000; // 8 seconds between chapters
        setProcessingStatus(`Paus innan nästa kapitel... (${i + 2 - skipped}/${updatedChapters.length - skipped})`);
        await new Promise(r => setTimeout(r, pauseMs));
      }
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

  // Re-analyze a single chapter
  const [reanalyzingChapter, setReanalyzingChapter] = useState(null);
  const handleReanalyzeChapter = async (chapterId) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter || reanalyzingChapter) return;

    setReanalyzingChapter(chapterId);

    // Clear existing suggestions for this chapter
    const freshParas = splitIntoParagraphs(chapter.content);
    setParagraphsByChapter(prev => ({ ...prev, [chapterId]: freshParas }));

    // Mark as active
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: "active" } : c));

    const systemPrompt = buildPrompt({
      project: { title: uploadedFile?.name?.replace(/\.[^.]+$/, '') },
      genres,
      modules: { develop: modules.includes("develop"), translate: modules.includes("translate") },
      translationLanguages: transLangs,
    });

    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
        const request = buildReviewRequest(systemPrompt, chapter.content);
        const response = await sendMessage(request);
        if (response) {
          const text = extractText(response);
          const parsed = parseJsonResponse(text);
          if (parsed?.suggestions?.length) {
            const enrichedParas = attachSuggestionsToParagraphs(freshParas, parsed.suggestions, chapterId);
            setParagraphsByChapter(prev => ({ ...prev, [chapterId]: enrichedParas }));
          }
        }
        success = true;
      } catch (err) {
        console.error(`Re-analyze failed for chapter (attempt ${attempt + 1}):`, err);
      }
    }

    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: "done" } : c));
    setReanalyzingChapter(null);
  };

  // Split chapter at a paragraph boundary
  // ─── ANALYZE ALL UNREVIEWED CHAPTERS ───
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const handleAnalyzeUnreviewed = async () => {
    if (batchAnalyzing) return;
    setBatchAnalyzing(true);

    const systemPrompt = buildPrompt({
      project: { title: uploadedFile?.name?.replace(/\.[^.]+$/, '') },
      genres,
      modules: { develop: modules.includes("develop"), translate: modules.includes("translate") },
      translationLanguages: transLangs,
    });

    // Find chapters without suggestions
    const unreviewed = chapters.filter(ch => {
      const paras = paragraphsByChapter[ch.id] || [];
      return !paras.some(p => p.suggestions?.length > 0);
    });

    if (unreviewed.length === 0) {
      setBatchAnalyzing(false);
      return;
    }

    for (let i = 0; i < unreviewed.length; i++) {
      const ch = unreviewed[i];
      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: "active" } : c));
      setProcessingStatus(`Analyserar ${ch.title} (${i + 1}/${unreviewed.length})...`);

      // Ensure paragraphs exist
      let paras = paragraphsByChapter[ch.id];
      if (!paras || paras.length === 0) {
        paras = splitIntoParagraphs(ch.content);
        setParagraphsByChapter(prev => ({ ...prev, [ch.id]: paras }));
      }

      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            const wait = Math.pow(2, attempt) * 3000;
            setProcessingStatus(`Retry ${attempt} för ${ch.title} – väntar ${wait / 1000}s...`);
            await new Promise(r => setTimeout(r, wait));
          }

          const request = buildReviewRequest(systemPrompt, ch.content);
          const response = await sendMessage(request);

          if (response) {
            const text = extractText(response);
            const parsed = parseJsonResponse(text);
            if (parsed?.suggestions?.length) {
              const enrichedParas = attachSuggestionsToParagraphs(paras, parsed.suggestions, ch.id);
              setParagraphsByChapter(prev => ({ ...prev, [ch.id]: enrichedParas }));
            }
          }
          success = true;
        } catch (err) {
          console.error(`Batch review failed for ${ch.title} (attempt ${attempt + 1}):`, err);
          if (attempt === 2) {
            setProcessingStatus(`⚠ ${ch.title} kunde inte analyseras`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: "done" } : c));

      // 10 second pause between chapters to stay under rate limit
      if (i < unreviewed.length - 1) {
        setProcessingStatus(`Paus innan ${unreviewed[i + 1].title}... (${i + 2}/${unreviewed.length})`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    setProcessingStatus("");
    setBatchAnalyzing(false);
  };

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

  // ─── SCROLL TO SUGGESTION IN TEXT ───
  useEffect(() => {
    if (!activeSuggestion || !mainRef.current) return;
    const el = mainRef.current.querySelector(`[data-suggestion-id="${activeSuggestion}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash animation
      el.style.transition = "background 0.15s";
      const original = el.style.background;
      el.style.background = "#a0522d30";
      setTimeout(() => { el.style.background = original; }, 800);
    }
  }, [activeSuggestion]);

  // ─── TEXT SELECTION HANDLER ───
  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionToolbar(null);
      return;
    }
    const selectedText = sel.toString().trim();
    if (selectedText.length < 2) return;

    // Find which paragraph this selection is in
    const range = sel.getRangeAt(0);
    const paraEl = range.startContainer.parentElement?.closest("[data-para-id]");
    const paraId = paraEl?.dataset?.paraId || null;

    const rect = range.getBoundingClientRect();
    setSelectionToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top,
      text: selectedText,
      paraId,
    });
  }, []);

  // ─── EDIT PARAGRAPH ───
  const handleEditParagraph = (paraId, text) => {
    setEditModal({
      text,
      paraId,
      chapterTitle: currentChapter?.title || "Kapitel",
    });
    setSelectionToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  // ─── SAVE PARAGRAPH EDIT ───
  const handleSaveParagraph = (paraId, newText) => {
    if (!activeChapter) return;
    const paras = [...(paragraphsByChapter[activeChapter] || [])];
    const idx = paras.findIndex(p => p.id === paraId);
    if (idx === -1) return;

    paras[idx] = { ...paras[idx], text: newText };
    setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: paras }));

    // Also update the chapter content
    const newContent = paras.map(p => p.text).join("\n\n");
    setChapters(prev => prev.map(ch =>
      ch.id === activeChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
    ));
  };

  // ─── CREATE NEW CHAPTER FROM TEXT ───
  const handleCreateChapterFromText = (text, sourceParaId) => {
    if (!activeChapter || !text.trim()) return;

    const newId = Date.now();
    const chapterIndex = chapters.findIndex(c => c.id === activeChapter);

    // If coming from a paragraph, remove that text from the source paragraph
    if (sourceParaId) {
      const paras = [...(paragraphsByChapter[activeChapter] || [])];
      const paraIdx = paras.findIndex(p => p.id === sourceParaId);
      if (paraIdx !== -1) {
        const remaining = paras[paraIdx].text.replace(text, "").trim();
        if (remaining) {
          paras[paraIdx] = { ...paras[paraIdx], text: remaining };
        } else {
          paras.splice(paraIdx, 1);
        }
        setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: paras }));
        const newContent = paras.map(p => p.text).join("\n\n");
        setChapters(prev => prev.map(ch =>
          ch.id === activeChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
        ));
      }
    }

    const newChapter = {
      id: newId,
      number: chapterIndex + 2,
      title: `Nytt kapitel`,
      content: text,
      wordCount: countWords(text),
      status: "done",
    };

    const updatedChapters = [...chapters];
    updatedChapters.splice(chapterIndex + 1, 0, newChapter);
    updatedChapters.forEach((ch, i) => { ch.number = i + 1; });
    setChapters(updatedChapters);
    setParagraphsByChapter(prev => ({ ...prev, [newId]: splitIntoParagraphs(text) }));
    setActiveChapter(newId);
    setEditModal(null);
    setSelectionToolbar(null);
  };

  // Get current chapter paragraphs
  const currentParagraphs = paragraphsByChapter[activeChapter] || [];
  const allSuggestions = currentParagraphs.flatMap(p => p.suggestions || []);
  // Show all suggestions: pending first, then handled. Filter by priority.
  const filtered = allSuggestions
    .filter(s => filterPriority === "all" || s.priority === filterPriority)
    .sort((a, b) => {
      const aHandled = accepted.has(a.id) || rejected.has(a.id) ? 1 : 0;
      const bHandled = accepted.has(b.id) || rejected.has(b.id) ? 1 : 0;
      return aHandled - bHandled; // pending first
    });
  const pendingCount = allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length;

  // ─── RENDER ───

  // Auth loading spinner
  if (authLoading || view === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: bg, fontFamily: uiFont }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: muted }}>Laddar...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  // Not authenticated → show auth page
  if (!isAuthenticated) return (
    <AuthPage onLogin={login} onRegister={register} />
  );

  // Dashboard
  if (view === "dashboard" || (view === "loading" && isAuthenticated)) return (
    <DashboardView
      user={user}
      onOpenProject={(project) => {
        // TODO: load project data into editor state
        setView("upload");
      }}
      onNewProject={() => setView("upload")}
      onLogout={async () => { await logout(); setView("loading"); }}
      onProfile={() => setView("profile")}
    />
  );

  // Profile
  if (view === "profile") return (
    <ProfileView user={user} onBack={() => setView("dashboard")} />
  );

  if (view === "upload") return <OnboardingUpload onNext={handleUploadNext} />;
  if (view === "settings") return <OnboardingSettings fileName={uploadedFile?.name} onStart={handleStartProcessing} onBack={() => setView("upload")} />;
  if (view === "processing") return <ProcessingView chapters={chapters} statusText={processingStatus} />;
  if (view === "pricing") return <PricingPage onBack={() => setView("editor")} />;

  const currentChapter = chapters.find(c => c.id === activeChapter) || chapters[0];

  // Render inline formatting: **bold** and *italic*
  const renderFormatted = (str, keyPrefix = "f") => {
    // Split by **bold** first, then *italic*
    const parts = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let match;

    while ((match = boldRegex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        // Process italic in the non-bold part
        parts.push(...renderItalic(str.slice(lastIdx, match.index), `${keyPrefix}-${lastIdx}`));
      }
      parts.push(<strong key={`${keyPrefix}-b${match.index}`}>{match[1]}</strong>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      parts.push(...renderItalic(str.slice(lastIdx), `${keyPrefix}-${lastIdx}`));
    }
    return parts.length ? parts : [str];
  };

  const renderItalic = (str, keyPrefix = "i") => {
    const parts = [];
    const italicRegex = /\*(.+?)\*/g;
    let lastIdx = 0;
    let match;

    while ((match = italicRegex.exec(str)) !== null) {
      if (match.index > lastIdx) parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{str.slice(lastIdx, match.index)}</span>);
      parts.push(<em key={`${keyPrefix}-i${match.index}`}>{match[1]}</em>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{str.slice(lastIdx)}</span>);
    return parts.length ? parts : [<span key={keyPrefix}>{str}</span>];
  };

  const renderText = (para) => {
    const { text, suggestions } = para;
    if (!suggestions || !suggestions.length) return renderFormatted(text, `p${para.id}`);
    const parts = [];
    let last = 0;
    const sorted = [...suggestions].filter(s => s.original).sort((a, b) => text.indexOf(a.original) - text.indexOf(b.original));
    for (const s of sorted) {
      const idx = text.indexOf(s.original, last);
      if (idx === -1) continue;
      if (idx > last) parts.push(<span key={`t${last}`}>{...renderFormatted(text.slice(last, idx), `t${last}`)}</span>);
      const isAcc = accepted.has(s.id), isRej = rejected.has(s.id), isAct = activeSuggestion === s.id;
      const p = PRIORITY[s.priority];
      if (p) {
        if (isRej) {
          parts.push(<span key={`s${s.id}`} data-suggestion-id={s.id}>{...renderFormatted(s.original, `r${s.id}`)}</span>);
        } else {
          const displayText = isAcc && s.replacement ? s.replacement : s.original;
          parts.push(
            <span key={`s${s.id}`} data-suggestion-id={s.id} onClick={() => setActiveSuggestion(isAct ? null : s.id)} style={{
              background: isAcc ? "#dcfce7" : isAct ? `${p.color}30` : `${p.color}0c`,
              borderBottom: isAcc ? "none" : `2px solid ${p.color}`,
              padding: "1px 2px", borderRadius: 3, cursor: "pointer",
              transition: "all 0.3s", outline: isAct ? `2px solid ${p.color}50` : "none", outlineOffset: 1,
            }}>
              {...renderFormatted(displayText, `s${s.id}`)}
            </span>
          );
        }
      }
      last = idx + s.original.length;
    }
    if (last < text.length) parts.push(<span key="end">{...renderFormatted(text.slice(last), "end")}</span>);
    return parts.length ? parts : renderFormatted(text, `p${para.id}`);
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
          {/* Save indicator */}
          {saveStatus && (
            <span style={{ fontFamily: uiFont, fontSize: 10, color: saveStatus === "saving" ? muted : "#27864a", transition: "opacity 0.3s", opacity: saveStatus ? 1 : 0 }}>
              {saveStatus === "saving" ? "Sparar..." : "✓ Sparat"}
            </span>
          )}
          <button onClick={() => { if (window.confirm("Vill du börja om med ett nytt manus? Allt osparat arbete försvinner.")) handleStartFresh(); }} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer" }}>Nytt manus</button>
          {/* Analyze unreviewed button */}
          {(() => {
            const unreviewedCount = chapters.filter(ch => {
              const paras = paragraphsByChapter[ch.id] || [];
              return !paras.some(p => p.suggestions?.length > 0);
            }).length;
            return unreviewedCount > 0 ? (
              <button
                onClick={handleAnalyzeUnreviewed}
                disabled={batchAnalyzing}
                style={{
                  fontFamily: uiFont, fontSize: 11, padding: "5px 14px", borderRadius: 5, border: "none",
                  background: batchAnalyzing ? "#d4c8bb" : "#b8860b", color: "#fff", cursor: batchAnalyzing ? "default" : "pointer",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {batchAnalyzing ? `Analyserar...` : `Analysera (${unreviewedCount})`}
              </button>
            ) : null;
          })()}
          <button onClick={() => setShowExport(true)} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>Exportera</button>
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

      {/* BATCH ANALYSIS STATUS BAR */}
      {(batchAnalyzing || reanalyzingChapter) && processingStatus && (
        <div style={{
          padding: "6px 16px", background: "#fdf6e3", borderBottom: `1px solid #e8d9a8`,
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#b8860b",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          <span style={{ fontFamily: uiFont, fontSize: 11, color: "#7a6520" }}>{processingStatus}</span>
          {batchAnalyzing && (
            <button onClick={() => setBatchAnalyzing(false)} style={{
              marginLeft: "auto", fontFamily: uiFont, fontSize: 10, padding: "3px 10px",
              borderRadius: 4, border: `1px solid #e8d9a8`, background: "transparent",
              color: "#7a6520", cursor: "pointer",
            }}>Avbryt</button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT SIDEBAR */}
        <Sidebar chapters={chapters} activeChapter={activeChapter} setActiveChapter={setActiveChapter} onSplitChapter={handleSplitChapter} onReanalyze={handleReanalyzeChapter} paragraphsByChapter={paragraphsByChapter} />

        {/* MAIN TEXT */}
        <main ref={mainRef} onMouseUp={handleTextSelection} style={{ flex: 1, overflowY: "auto", padding: "36px 52px", maxWidth: 680, margin: "0 auto", position: "relative" }}>
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
            <div key={para.id} data-para-id={para.id} style={{ position: "relative", group: "para" }}>
              <p style={{ fontSize: 16.5, lineHeight: 1.85, marginBottom: 22, color: "#3d2e23", position: "relative" }}>
                {renderText(para)}
              </p>
            </div>
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
                {/* Suggestion cards – primary content */}
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 16px", fontFamily: uiFont, fontSize: 12, color: muted }}>
                    {allSuggestions.length === 0 ? "Inga förslag för detta kapitel än." : "Inga förslag matchar filtret."}
                  </div>
                ) : (
                  <>
                    {pendingCount === 0 && allSuggestions.length > 0 && (
                      <div style={{ textAlign: "center", padding: "12px 16px 8px", fontFamily: uiFont, fontSize: 12, color: "#27864a" }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
                        Alla förslag hanterade! Klicka för att ångra.
                      </div>
                    )}
                    {filtered.map(s => (
                      <SuggestionCard key={s.id} s={s} isActive={activeSuggestion === s.id}
                        status={accepted.has(s.id) ? "accepted" : rejected.has(s.id) ? "rejected" : "pending"}
                        onToggle={() => setActiveSuggestion(activeSuggestion === s.id ? null : s.id)}
                        onAccept={() => { setAccepted(prev => new Set([...prev, s.id])); setActiveSuggestion(null); }}
                        onReject={() => { setRejected(prev => new Set([...prev, s.id])); setActiveSuggestion(null); }}
                        onUndo={() => {
                          setAccepted(prev => { const n = new Set(prev); n.delete(s.id); return n; });
                          setRejected(prev => { const n = new Set(prev); n.delete(s.id); return n; });
                          setActiveSuggestion(null);
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Collapsible paragraph edit section */}
                {currentParagraphs.length > 0 && (
                  <ParagraphEditSection paragraphs={currentParagraphs} onEdit={handleEditParagraph} />
                )}
              </div>
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, fontFamily: uiFont, fontSize: 10, color: muted, display: "flex", justifyContent: "space-between" }}>
                <span>{pendingCount} kvar</span>
                <span>✓ {accepted.size} · ✗ {rejected.size}</span>
              </div>
            </>
          )}
          {rightPanel === "develop" && <DevelopPanel dnaProfile={dnaProfile} chapterContent={currentChapter?.content} chapterTitle={currentChapter?.title} onResult={setDevelopResult} />}
          {rightPanel === "translate" && <TranslatePanel langs={transLangs} />}
        </aside>
      </div>

      {/* SELECTION TOOLBAR */}
      <SelectionToolbar
        position={selectionToolbar}
        onEdit={() => {
          if (selectionToolbar) {
            // Open edit modal with the FULL paragraph text, not just the selection
            const paras = paragraphsByChapter[activeChapter] || [];
            const para = paras.find(p => p.id === selectionToolbar.paraId);
            if (para) {
              handleEditParagraph(selectionToolbar.paraId, para.text);
            }
          }
        }}
        onNewChapter={() => {
          if (selectionToolbar?.text) {
            handleCreateChapterFromText(selectionToolbar.text, selectionToolbar.paraId);
          }
        }}
        onClose={() => setSelectionToolbar(null)}
      />

      {/* EDIT MODAL */}
      {editModal && (
        <EditModal
          text={editModal.text}
          paragraphId={editModal.paraId}
          chapterTitle={editModal.chapterTitle}
          onSave={(newText) => handleSaveParagraph(editModal.paraId, newText)}
          onCreateChapter={(text) => handleCreateChapterFromText(text, editModal.paraId)}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* DEVELOP RESULT MODAL */}
      {developResult && (
        <DevelopResultModal
          result={developResult}
          onInsert={(text) => {
            // Insert developed text at end of current chapter
            if (activeChapter) {
              const chapter = chapters.find(c => c.id === activeChapter);
              if (chapter) {
                const newContent = chapter.content + "\n\n" + text;
                setChapters(prev => prev.map(ch =>
                  ch.id === activeChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
                ));
                setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: splitIntoParagraphs(newContent) }));
              }
            }
            setDevelopResult(null);
          }}
          onRegenerate={() => {
            // Close modal and let user regenerate from the panel
            setDevelopResult(null);
          }}
          onClose={() => setDevelopResult(null)}
        />
      )}

      {/* EXPORT MODAL */}
      {showExport && (
        <ExportModal
          chapters={chapters}
          paragraphsByChapter={paragraphsByChapter}
          accepted={accepted}
          rejected={rejected}
          fileName={uploadedFile?.name?.replace(/\.[^.]+$/, '') || "Manus"}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)}
          genres={genres} setGenres={setGenres}
          modules={modules} setModules={setModules}
          transLangs={transLangs} setTransLangs={setTransLangs}
          conventions={conventions} setConventions={setConventions}
        />
      )}

      {/* RestorePrompt removed – auto-restore on mount */}
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
