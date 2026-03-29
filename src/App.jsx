import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { parseManuscript, splitIntoParagraphs, countWords } from "./lib/manuscript-parser";
import { ANALYSIS_LEVELS } from "./lib/prompt-builder";
import { saveProject, loadProject, clearProject } from "./lib/storage";
import { exportToDocx, downloadBlob } from "./lib/export";
import { useAuth } from "./contexts/AuthContext";
import { apiClient, AuthError } from "./lib/api-client";

// ─── DATA ───
import { GENRES } from "./data/genres";
import { LANGUAGES } from "./data/languages";

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
function OnboardingSettings({ fileName, chapterCount, totalWords, onStart, onBack }) {
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
                  <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{g.description}</div>
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
                      <div style={{ fontSize: 9, color: muted }}>{l.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <button
          onClick={() => onStart({ genres, modules, transLangs, analysisLevel: "standard" })}
          style={{ width: "100%", padding: "13px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}
        >
          Spara och öppna manus
        </button>
      </div>
    </div>
  );
}

// ─── PROCESSING VIEW ───
function ProcessingView({ chapters, statusText, onAbort }) {
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
          <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.85; } }
@keyframes flash-highlight { 0% { background: #a0522d60; } 50% { background: #a0522d40; } 100% { background: #a0522d25; } }`}</style>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Bearbetar ditt manus</h2>
        <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 28px" }}>{statusText}</p>

        {/* Progress bar */}
        <div style={{ width: "100%", height: 6, background: border, borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: accent, borderRadius: 3, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ fontFamily: uiFont, fontSize: 11, color: muted }}>{progress}%</div>

        {onAbort && (
          <button onClick={onAbort} style={{
            marginTop: 16, fontFamily: uiFont, fontSize: 12, padding: "8px 24px",
            borderRadius: 8, border: `1px solid ${border}`, background: surface,
            color: muted, cursor: "pointer",
          }}>Avbryt – börja arbeta med analyserade kapitel</button>
        )}

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
                <span style={{ color: ch.status === "pending" ? muted : ink, flex: 1 }}>{`Kapitel ${i + 1}`}</span>
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

function Sidebar({ chapters, activeChapter, setActiveChapter, onSplitChapter, onReanalyze, onDeepAnalyze, paragraphsByChapter }) {
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
        {chapters.map((ch, idx) => (
          <div key={ch.id} style={{ position: "relative" }}>
            <button onClick={() => setActiveChapter(ch.id)} style={{
              width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 7, border: "none",
              background: activeChapter === ch.id ? "#ede8e0" : "transparent", cursor: "pointer", fontFamily: font, marginBottom: 1,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: activeChapter === ch.id ? 600 : 400, color: ink, lineHeight: 1.35 }}>{`Kapitel ${idx + 1}`}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontFamily: uiFont, fontSize: 10, color: muted }}>
                <span>{ch.wordCount.toLocaleString()} ord</span>
                {ch.status === "error" && (
                  <span title={ch.errorMessage || 'Okänt fel'} style={{ fontSize: 9, color: "#c0392b", cursor: "help" }}>analys misslyckades</span>
                )}
                {!chapterHasSuggestions(ch.id) && ch.status !== "active" && ch.status !== "error" && (
                  <span style={{ fontSize: 9, color: "#b8860b" }}>ej analyserad</span>
                )}
                <span style={{
                  width: ch.status === "active" ? 14 : 10,
                  height: ch.status === "active" ? 14 : 10,
                  borderRadius: "50%", marginLeft: "auto", flexShrink: 0,
                  background: ch.status === "active" ? "#b8860b" : ch.status === "reviewed" ? "#d4a017" : chapterHasSuggestions(ch.id) ? "#27864a" : "#c0392b",
                  animation: ch.status === "active" ? "pulse 1.5s ease-in-out infinite" : "none",
                  boxShadow: ch.status === "active" ? "0 0 8px rgba(184,134,11,0.6)" : "none",
                  transition: "all 0.3s ease",
                }} />
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

// ─── SEARCH BAR ───
function SearchBar({ chapters, activeChapter, setActiveChapter, onReplace, onReplaceAll, onClose, onSearchChange }) {
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchAll, setSearchAll] = useState(true); // default: search entire manuscript
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Find all matches — in active chapter or entire manuscript
  const allMatches = useMemo(() => {
    if (query.length < 2) return [];
    const searchStr = caseSensitive ? query : query.toLowerCase();
    const result = [];
    const searchChapters = searchAll ? chapters : chapters.filter(c => c.id === activeChapter);
    for (const ch of searchChapters) {
      if (!ch.content) continue;
      const searchIn = caseSensitive ? ch.content : ch.content.toLowerCase();
      let idx = 0;
      while (idx < searchIn.length) {
        const found = searchIn.indexOf(searchStr, idx);
        if (found === -1) break;
        result.push({ index: found, length: query.length, chapterId: ch.id, chapterTitle: ch.title });
        idx = found + 1;
      }
    }
    return result;
  }, [query, caseSensitive, searchAll, chapters, activeChapter]);

  // Matches in current chapter (for text highlighting)
  const currentChapterMatches = allMatches.filter(m => m.chapterId === activeChapter);

  // Report search state to parent for text highlighting (only current chapter matches)
  useEffect(() => {
    if (onSearchChange) {
      const activeGlobal = allMatches[activeMatchIdx];
      const localIdx = activeGlobal ? currentChapterMatches.findIndex(m => m.index === activeGlobal.index && m.chapterId === activeGlobal.chapterId) : -1;
      onSearchChange(query.length >= 2 ? { query, matches: currentChapterMatches, activeMatchIdx: localIdx, caseSensitive } : null);
    }
  }, [query, currentChapterMatches.length, activeMatchIdx, caseSensitive, activeChapter]);

  // Navigate to match — switch chapter if needed, then scroll
  useEffect(() => {
    if (allMatches.length === 0 || !query) return;
    const match = allMatches[activeMatchIdx];
    if (!match) return;
    // Switch chapter if needed
    if (match.chapterId !== activeChapter && setActiveChapter) {
      setActiveChapter(match.chapterId);
      // Wait for chapter to render before scrolling
      setTimeout(() => {
        const els = document.querySelectorAll("[data-search-match]");
        if (els[0]) els[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    } else {
      // Same chapter — scroll to match
      setTimeout(() => {
        const localIdx = currentChapterMatches.findIndex(m => m.index === match.index);
        const els = document.querySelectorAll("[data-search-match]");
        const target = els[localIdx >= 0 ? localIdx : 0];
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activeMatchIdx, allMatches.length, query]);

  const handleNext = () => setActiveMatchIdx(prev => (prev + 1) % Math.max(allMatches.length, 1));
  const handlePrev = () => setActiveMatchIdx(prev => (prev - 1 + allMatches.length) % Math.max(allMatches.length, 1));

  const handleReplace = () => {
    if (allMatches.length > 0 && onReplace) {
      const m = allMatches[activeMatchIdx];
      if (m) {
        // Switch to chapter first if needed
        if (m.chapterId !== activeChapter && setActiveChapter) setActiveChapter(m.chapterId);
        const ch = chapters.find(c => c.id === m.chapterId);
        if (ch) {
          const orig = ch.content.slice(m.index, m.index + m.length);
          onReplace(orig, replaceText, m.chapterId);
        }
      }
    }
  };

  const handleReplaceAll = () => {
    if (allMatches.length > 0 && onReplaceAll && query) {
      onReplaceAll(query, replaceText, caseSensitive, searchAll);
    }
  };

  // Current match chapter info
  const currentMatch = allMatches[activeMatchIdx];

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6, padding: "8px 16px",
      background: surface, borderBottom: `1px solid ${border}`, fontFamily: uiFont,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveMatchIdx(0); }}
          onKeyDown={e => { if (e.key === "Enter") handleNext(); if (e.key === "Escape") onClose(); }}
          placeholder={searchAll ? "Sök i hela manuset..." : "Sök i kapitlet..."}
          style={{
            flex: 1, padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`,
            fontFamily: uiFont, fontSize: 12, background: bg, color: ink, outline: "none",
          }}
        />
        <span style={{ fontSize: 10, color: muted, minWidth: 50, textAlign: "center" }}>
          {query.length >= 2 ? `${allMatches.length > 0 ? activeMatchIdx + 1 : 0} / ${allMatches.length}` : ""}
        </span>
        <button onClick={handlePrev} disabled={allMatches.length === 0} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: surface, cursor: "pointer", fontSize: 11, color: muted }}>←</button>
        <button onClick={handleNext} disabled={allMatches.length === 0} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: surface, cursor: "pointer", fontSize: 11, color: muted }}>→</button>
        <button onClick={() => setCaseSensitive(!caseSensitive)} title="Skiftlägeskänslig sökning" style={{
          padding: "3px 8px", borderRadius: 4, border: `1px solid ${caseSensitive ? accent : border}`,
          background: caseSensitive ? accentLight : surface, cursor: "pointer", fontSize: 10, fontWeight: 600,
          color: caseSensitive ? accent : muted,
        }}>Aa</button>
        <button onClick={() => { setSearchAll(!searchAll); setActiveMatchIdx(0); }} title={searchAll ? "Söker i hela manuset" : "Söker i aktivt kapitel"} style={{
          padding: "3px 8px", borderRadius: 4, border: `1px solid ${searchAll ? accent : border}`,
          background: searchAll ? accentLight : surface, cursor: "pointer", fontSize: 10, fontWeight: 600,
          color: searchAll ? accent : muted,
        }}>{searchAll ? "Alla" : "Kap"}</button>
        <button onClick={() => setShowReplace(!showReplace)} style={{
          padding: "3px 8px", borderRadius: 4, border: `1px solid ${showReplace ? accent : border}`,
          background: showReplace ? accentLight : surface, cursor: "pointer", fontSize: 10, color: showReplace ? accent : muted,
        }}>Ersätt</button>
        <button onClick={onClose} style={{ padding: "3px 6px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: muted }}>×</button>
      </div>
      {searchAll && currentMatch && allMatches.length > 0 && (
        <div style={{ fontSize: 10, color: accent, fontWeight: 500, paddingLeft: 2 }}>
          📍 {currentMatch.chapterTitle || "Kapitel"}
        </div>
      )}
      {showReplace && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleReplace(); }}
            placeholder="Ersätt med..."
            style={{
              flex: 1, padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`,
              fontFamily: uiFont, fontSize: 12, background: bg, color: ink, outline: "none",
            }}
          />
          <button onClick={handleReplace} disabled={allMatches.length === 0} style={{
            padding: "4px 12px", borderRadius: 5, border: "none", background: accent, color: "#fff",
            cursor: allMatches.length > 0 ? "pointer" : "default", fontSize: 11, fontWeight: 500,
            opacity: allMatches.length > 0 ? 1 : 0.5,
          }}>Ersätt</button>
          <button onClick={handleReplaceAll} disabled={allMatches.length === 0} style={{
            padding: "4px 12px", borderRadius: 5, border: `1px solid ${accent}`, background: surface,
            color: accent, cursor: allMatches.length > 0 ? "pointer" : "default", fontSize: 11, fontWeight: 500,
            opacity: allMatches.length > 0 ? 1 : 0.5,
          }}>Alla ({allMatches.length})</button>
        </div>
      )}
    </div>
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
function ParagraphEditSection({ paragraphs, onEdit, getEffectiveText }) {
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
              onClick={() => onEdit(para.id, getEffectiveText ? getEffectiveText(para) : para.text)}
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
function SelectionToolbar({ position, onEdit, onNewChapter, onDevelop, onClose }) {
  if (!position) return null;
  const btnStyle = {
    background: "transparent", border: "none", color: "#f7f4ef", fontFamily: uiFont, fontSize: 11,
    padding: "6px 12px", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
    fontWeight: 500, whiteSpace: "nowrap",
  };
  const hoverOn = e => e.currentTarget.style.background = "rgba(255,255,255,0.12)";
  const hoverOff = e => e.currentTarget.style.background = "transparent";
  const divider = <div style={{ width: 1, background: "rgba(255,255,255,0.18)", margin: "4px 0" }} />;
  return (
    <div style={{
      position: "fixed", left: position.x, top: position.y, transform: "translate(-50%, -110%)",
      background: ink, borderRadius: 8, padding: "5px 4px", display: "flex", gap: 3, zIndex: 50,
      boxShadow: "0 6px 24px rgba(0,0,0,0.22)", animation: "fadeIn 0.12s ease-out",
    }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -100%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -110%) scale(1); } }`}</style>
      <button onClick={onEdit} style={btnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <span style={{ fontSize: 13 }}>✎</span> Redigera
      </button>
      {divider}
      <button onClick={onDevelop} style={btnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <span style={{ fontSize: 13 }}>↔</span> Utveckla
      </button>
      {divider}
      <button onClick={onNewChapter} style={btnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <span style={{ fontSize: 13 }}>✂</span> Dela kapitel
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

function SuggestionCard({ s, isActive, onToggle, onAccept, onReject, status, onUndo, hasInlineHighlight, onNavigateTerm, termOccurrenceCount, currentTermIdx }) {
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
          {s.type === "develop" ? "↔ Utveckling" : s.type === "style" ? "✦ Stil" : s.type === "repetition" ? "↻ Upprepning" : "▧ Struktur"}
        </span>
      </div>
      {s.original && (
        <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginBottom: 4, padding: "5px 7px", background: bg, borderRadius: 5, borderLeft: `2.5px solid ${p.color}40`, opacity: 0.8, fontStyle: "italic", maxHeight: isActive ? "none" : 60, overflow: "hidden" }}>
          {!isActive && s.original.length > 150 ? s.original.slice(0, 150) + "…" : s.original}
        </div>
      )}
      {s.replacement && (
        <div style={{ fontFamily: uiFont, fontSize: 11.5, color: ink, fontWeight: 500, marginBottom: 4, padding: "5px 7px", background: "#f0faf3", borderRadius: 5, borderLeft: "2.5px solid #27864a40", maxHeight: isActive ? "none" : 80, overflow: "hidden" }}>
          {!isActive && s.replacement.length > 200 ? s.replacement.slice(0, 200) + "…" : s.replacement}
        </div>
      )}
      {isActive && !isHandled && (
        <div style={{ marginTop: 8 }}>
          {/* Show "Visa i text" navigation when suggestion has no inline highlight */}
          {!hasInlineHighlight && onNavigateTerm && termOccurrenceCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "5px 8px", background: "#fdf6e3", borderRadius: 5, border: "1px solid #e8dcc8" }}>
              <button onClick={e => { e.stopPropagation(); onNavigateTerm(0); }} style={{
                padding: "3px 10px", borderRadius: 4, border: "none", background: accent, color: "#fff",
                fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: uiFont, whiteSpace: "nowrap",
              }}>📍 Visa i text</button>
              {termOccurrenceCount > 1 && currentTermIdx !== null && (
                <>
                  <button onClick={e => { e.stopPropagation(); onNavigateTerm(Math.max(0, (currentTermIdx || 0) - 1)); }} style={{
                    padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: surface,
                    fontSize: 10, cursor: "pointer", fontFamily: uiFont, color: ink,
                  }}>←</button>
                  <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>
                    {(currentTermIdx || 0) + 1}/{termOccurrenceCount}
                  </span>
                  <button onClick={e => { e.stopPropagation(); onNavigateTerm(Math.min(termOccurrenceCount - 1, (currentTermIdx || 0) + 1)); }} style={{
                    padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: surface,
                    fontSize: 10, cursor: "pointer", fontFamily: uiFont, color: ink,
                  }}>→</button>
                </>
              )}
            </div>
          )}
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
            <div style={{ fontFamily: font, fontSize: 12, color: muted, marginTop: 3 }}>{o.exampleJsx || o.example}</div>
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
                  <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{g.description}</div>
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
                      <div style={{ fontSize: 9, color: muted }}>{l.subtitle}</div>
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
              { value: "italic", label: "Kursiv", example: "Hon läste Borta med vinden.", exampleJsx: <>Hon läste <em>Borta med vinden</em>.</> },
              { value: "quotes", label: "Citattecken", example: 'Hon läste "Borta med vinden".' },
            ]}
          />

          <ConvOption
            label="Inre tankar"
            value={conventions.innerThought}
            onChange={v => setConv("innerThought", v)}
            options={[
              { value: "italic", label: "Kursiv", example: "Varför sa han så? tänkte hon.", exampleJsx: <><em>Varför sa han så?</em> tänkte hon.</> },
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
function DevelopPanel({ inputText, dnaProfile, emotionMap, chapterContent, chapterTitle, onResult, apiClient, chapterId }) {
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
        {tab === "emotion" && <EmotionView emotionMap={emotionMap} />}
        {tab === "develop" && <DevelopView inputText={inputText} dnaProfile={dnaProfile} emotionMap={emotionMap} chapterContent={chapterContent} chapterTitle={chapterTitle} onResult={onResult} apiClient={apiClient} chapterId={chapterId} />}
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

function EmotionView({ emotionMap }) {
  if (!emotionMap) {
    return (
      <div style={{ fontFamily: uiFont, fontSize: 12, padding: "20px 4px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>📊</div>
        <p style={{ color: muted, fontSize: 12 }}>Emotionell karta genereras vid bearbetning av kapitlet.</p>
      </div>
    );
  }

  const e = emotionMap;
  const emotionColors = { glädje: "#f59e0b", sorg: "#3b82f6", rädsla: "#8b5cf6", ilska: "#ef4444", kärlek: "#ec4899", hopp: "#10b981", ångest: "#6366f1", lugn: "#14b8a6" };

  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      {/* Dominant emotion */}
      {e.dominantEmotion && (
        <div style={{ padding: "12px 14px", background: bg, borderRadius: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Dominant känsla</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ink }}>{e.dominantEmotion}</div>
        </div>
      )}

      {/* Emotion distribution */}
      {e.emotions && (
        <div style={{ padding: "12px 14px", background: bg, borderRadius: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Känslofördelning</div>
          {Object.entries(e.emotions).sort((a, b) => b[1] - a[1]).map(([emotion, intensity]) => (
            <div key={emotion} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: ink, fontWeight: 500 }}>{emotion}</span>
                <span style={{ color: muted }}>{Math.round(intensity * 100)}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: border }}>
                <div style={{ height: 4, borderRadius: 2, background: emotionColors[emotion.toLowerCase()] || accent, width: `${intensity * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emotional arc */}
      {e.arc && (
        <div style={{ padding: "12px 14px", background: bg, borderRadius: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Emotionell båge</div>
          <p style={{ fontSize: 11.5, color: ink, lineHeight: 1.5, margin: 0 }}>{e.arc}</p>
        </div>
      )}

      {/* Character states */}
      {e.characterStates && e.characterStates.length > 0 && (
        <div style={{ padding: "12px 14px", background: bg, borderRadius: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Karaktärernas känslotillstånd</div>
          {e.characterStates.map((cs, i) => (
            <div key={i} style={{ marginBottom: 8, padding: "6px 8px", background: surface, borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: ink, fontSize: 11.5 }}>{cs.character}</div>
              <div style={{ color: muted, fontSize: 10.5, marginTop: 2 }}>{cs.state}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tension level */}
      {e.tension !== undefined && (
        <div style={{ padding: "12px 14px", background: bg, borderRadius: 9 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Spänningsnivå</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: border }}>
              <div style={{ height: 6, borderRadius: 3, background: e.tension > 0.7 ? "#ef4444" : e.tension > 0.4 ? "#f59e0b" : "#10b981", width: `${e.tension * 100}%`, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: ink }}>{Math.round(e.tension * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DevelopView({ inputText, chapterContent, chapterTitle, dnaProfile, emotionMap, onResult, apiClient: apiClientProp, chapterId }) {
  const [mode, setMode] = useState(null);
  const [userText, setUserText] = useState(inputText || "");
  const [userInstruction, setUserInstruction] = useState("");
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

    const contextSnippet = chapterContent ? chapterContent.slice(0, 6000) : "";

    try {
      const { result } = await apiClientProp.developText(mode, userText, {
        context: contextSnippet,
        chapterId,
        dnaProfile,
        emotionMap,
        chapterTitle,
        userInstruction: userInstruction.trim() || undefined,
        rewriteFocus: mode === "rewrite" && rewriteFocus.length > 0 ? rewriteFocus : undefined,
      });

      const developedText = result?.developedText || result?.text || "";
      const reasoning = result?.reasoning || "Texten har genererats baserat på din förfrågan.";

      onResult({
        mode,
        modeLabel: modes.find(m => m.id === mode)?.label,
        originalText: userText,
        developedText,
        reasoning,
      });
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
            {/* User instruction */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 4 }}>Din instruktion <span style={{ fontWeight: 400, color: muted }}>(valfritt)</span></div>
              <textarea
                value={userInstruction}
                onChange={e => setUserInstruction(e.target.value)}
                placeholder="T.ex: Vi behöver mer innehåll för morgonen, fördjupa Claras tvivel, lägg till en dialog med Tim..."
                style={{
                  width: "100%", minHeight: 45, padding: 8, borderRadius: 6, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 11,
                  resize: "vertical", background: surface, color: ink, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 4 }}>Text att bearbeta</div>
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

// ─── DEVELOP MODAL ───
function DevelopModal({ initialText, chapterContent, chapterTitle, dnaProfile, emotionMap, onResult, onClose, apiClient: apiClientProp, chapterId }) {
  const [mode, setMode] = useState("expand");
  const [userText, setUserText] = useState(initialText || "");
  const [userInstruction, setUserInstruction] = useState("");
  const [brainstormText, setBrainstormText] = useState("");
  const [rewriteFocus, setRewriteFocus] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const modes = [
    { id: "expand", label: "Bygga ut scen", desc: "Fördjupa med sinnesintryck, dialog eller internmonolog" },
    { id: "rewrite", label: "Skriva om", desc: "Omarbeta en passage med nytt fokus" },
    { id: "newscene", label: "Ny scen / kapitel", desc: "Generera helt nytt textavsnitt" },
    { id: "brainstorm", label: "Brainstorming", desc: "Tre alternativa vägar framåt" },
  ];

  const rewriteOptions = ["Visa istf berätta", "Mer dialog", "Mer sinnesintryck", "Höja tempot", "Sänka tempot", "Fördjupa känsla"];

  const handleGenerate = async () => {
    if (mode === "brainstorm" && !brainstormText.trim()) return;
    if (mode !== "brainstorm" && !userText.trim() && mode !== "newscene") return;
    setGenerating(true);
    setError(null);

    const inputText = mode === "brainstorm" ? brainstormText : userText;
    const contextSnippet = chapterContent ? chapterContent.slice(0, 6000) : "";

    try {
      const { result } = await apiClientProp.developText(mode, inputText, {
        context: contextSnippet,
        chapterId,
        dnaProfile,
        emotionMap,
        chapterTitle,
        userInstruction: userInstruction.trim() || undefined,
        rewriteFocus: mode === "rewrite" && rewriteFocus.length > 0 ? rewriteFocus : undefined,
      });

      const developedText = result?.developedText || result?.text || "";
      const reasoning = result?.reasoning || "Texten har genererats baserat på din förfrågan.";
      const alternatives = result?.alternatives;

      if (mode === "brainstorm") {
        onResult({ mode: "brainstorm", modeLabel: "Brainstorming", originalText: brainstormText, developedText, reasoning, alternatives });
      } else {
        onResult({ mode, modeLabel: modes.find(m => m.id === mode)?.label, originalText: userText, developedText, reasoning });
      }
    } catch (err) {
      console.error("Develop failed:", err);
      setError(err.message || "Generering misslyckades.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink }}>Utveckla text</div>
              <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginTop: 2 }}>{chapterTitle || "Kapitel"}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: muted, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>✕</button>
          </div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, marginTop: 14, borderBottom: `1px solid ${border}` }}>
            {modes.map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setError(null); }} style={{
                fontFamily: uiFont, fontSize: 11, fontWeight: mode === m.id ? 600 : 400, padding: "8px 14px",
                border: "none", cursor: "pointer", background: "transparent",
                color: mode === m.id ? accent : muted, borderBottom: mode === m.id ? `2px solid ${accent}` : "2px solid transparent",
                marginBottom: -1, transition: "all 0.15s",
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", overflow: "auto", flex: 1 }}>
          <p style={{ fontFamily: uiFont, fontSize: 11, color: muted, lineHeight: 1.5, margin: "0 0 14px" }}>
            {modes.find(m => m.id === mode)?.desc}
          </p>

          {mode === "brainstorm" ? (
            <>
              <div style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 4 }}>Din fråga</div>
              <textarea
                value={brainstormText}
                onChange={e => setBrainstormText(e.target.value)}
                placeholder="T.ex: Hur kan jag göra Marcus vändpunkt mer trovärdig? Behöver kapitel 3 en underplot?"
                style={{ width: "100%", minHeight: 100, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 12, resize: "vertical", background: bg, color: ink, outline: "none", boxSizing: "border-box" }}
              />
            </>
          ) : (
            <>
              {mode === "rewrite" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 6 }}>Fokus</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {rewriteOptions.map(opt => {
                      const active = rewriteFocus.includes(opt);
                      return (
                        <span key={opt} onClick={() => setRewriteFocus(prev => active ? prev.filter(x => x !== opt) : [...prev, opt])} style={{
                          padding: "5px 12px", borderRadius: 12, fontSize: 11, cursor: "pointer", transition: "all 0.12s",
                          border: active ? `1.5px solid ${accent}` : `1px solid ${border}`,
                          background: active ? accentLight : surface, color: active ? accent : ink, fontWeight: active ? 600 : 400,
                        }}>{opt}</span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 4 }}>Din instruktion <span style={{ fontWeight: 400, color: muted }}>(valfritt)</span></div>
                <textarea
                  value={userInstruction}
                  onChange={e => setUserInstruction(e.target.value)}
                  placeholder="T.ex: Fördjupa Claras tvivel, lägg till dialog med Tim..."
                  style={{ width: "100%", minHeight: 50, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 12, resize: "vertical", background: bg, color: ink, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: ink, marginBottom: 4 }}>Text att bearbeta</div>
                <textarea
                  value={userText}
                  onChange={e => setUserText(e.target.value)}
                  placeholder={mode === "newscene" ? "Beskriv scenen: vad ska hända, vilka karaktärer, vilken stämning..." : "Markerad text från manuset visas här..."}
                  style={{ width: "100%", minHeight: 120, padding: 10, borderRadius: 7, border: `1px solid ${border}`, fontFamily: font, fontSize: 13, resize: "vertical", background: bg, color: ink, outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                />
              </div>
            </>
          )}
          {error && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 7, background: "#fef2f2", color: "#b91c1c", fontSize: 11, fontFamily: uiFont }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontFamily: uiFont, fontSize: 12, padding: "8px 18px", borderRadius: 8, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}>Avbryt</button>
          <button
            onClick={handleGenerate}
            disabled={generating || (mode === "brainstorm" ? !brainstormText.trim() : (!userText.trim() && mode !== "newscene"))}
            style={{
              fontFamily: uiFont, fontSize: 12, padding: "8px 22px", borderRadius: 8, border: "none",
              background: generating ? "#d4c8bb" : accent, color: "#fff", fontWeight: 600,
              cursor: generating ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {generating ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                AI skriver...
              </>
            ) : mode === "brainstorm" ? "Brainstorma" : "Generera förslag"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FINAL CHECK MODAL ───
function FinalCheckModal({ issues, summary, onClose, onExport }) {
  const severityColors = { critical: "#c0392b", warning: "#b8860b", minor: "#6b7280" };
  const severityLabels = { critical: "Kritiskt", warning: "Varning", minor: "Mindre" };
  const categoryLabels = {
    namnkonsekvens: "Namnkonsekvens", tempusbrott: "Tempusbrott", stilbrott: "Stilbrott",
    upprepning: "Upprepning", logik: "Logiskt hål", korrektur: "Korrekturfel", formatering: "Formatering",
  };

  const criticalCount = (issues || []).filter(i => i.severity === "critical").length;
  const warningCount = (issues || []).filter(i => i.severity === "warning").length;
  const minorCount = (issues || []).filter(i => i.severity === "minor").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: surface, borderRadius: 16, width: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink }}>Slutkontroll</div>
              <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginTop: 2 }}>AI-driven konsekvenskontroll inför export</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: muted, cursor: "pointer", padding: "2px 6px" }}>✕</button>
          </div>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            {criticalCount > 0 && <span style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: severityColors.critical, background: "#fef2f2", padding: "3px 10px", borderRadius: 6 }}>{criticalCount} kritiska</span>}
            {warningCount > 0 && <span style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: severityColors.warning, background: "#fefce8", padding: "3px 10px", borderRadius: 6 }}>{warningCount} varningar</span>}
            {minorCount > 0 && <span style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: severityColors.minor, background: "#f3f4f6", padding: "3px 10px", borderRadius: 6 }}>{minorCount} mindre</span>}
            {(issues || []).length === 0 && <span style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: "#27864a", background: "#f0faf3", padding: "3px 10px", borderRadius: 6 }}>Inga problem hittade!</span>}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "0 24px 14px", overflow: "auto", flex: 1 }}>
          {/* Summary */}
          {summary && (
            <div style={{ padding: "12px 14px", background: bg, borderRadius: 8, marginBottom: 14, fontFamily: uiFont, fontSize: 12, color: ink, lineHeight: 1.5, borderLeft: `3px solid ${accent}` }}>
              {summary}
            </div>
          )}

          {/* Issues list */}
          {(issues || []).map((issue, i) => (
            <div key={i} style={{ padding: "12px 14px", background: bg, borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${severityColors[issue.severity] || "#ddd"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 600, color: severityColors[issue.severity], background: `${severityColors[issue.severity]}15`, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{severityLabels[issue.severity] || issue.severity}</span>
                  <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 500, color: muted }}>{categoryLabels[issue.category] || issue.category}</span>
                </div>
                {issue.chapter && <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>{issue.chapter}</span>}
              </div>
              {issue.quote && (
                <div style={{ fontFamily: font, fontSize: 12, color: ink, fontStyle: "italic", margin: "4px 0 6px", padding: "4px 8px", background: surface, borderRadius: 4 }}>
                  &ldquo;{issue.quote}&rdquo;
                </div>
              )}
              <div style={{ fontFamily: uiFont, fontSize: 11.5, color: ink, lineHeight: 1.4 }}>{issue.description}</div>
              {issue.suggestion && (
                <div style={{ fontFamily: uiFont, fontSize: 11, color: accent, marginTop: 4, fontWeight: 500 }}>→ {issue.suggestion}</div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontFamily: uiFont, fontSize: 12, padding: "8px 18px", borderRadius: 8, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}>Fortsätt redigera</button>
          <button onClick={onExport} style={{ fontFamily: uiFont, fontSize: 12, padding: "8px 22px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontWeight: 600, cursor: "pointer" }}>Exportera ändå</button>
        </div>
      </div>
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
  const [exportTitleAlign, setExportTitleAlign] = useState("center");
  const [exportPageNumbers, setExportPageNumbers] = useState(true);
  const [exportPageNumPos, setExportPageNumPos] = useState("center");
  const [exportIndent, setExportIndent] = useState(1.27);
  const [exportChapterStart, setExportChapterStart] = useState("third");
  const [exportHeader, setExportHeader] = useState("title");
  const [exportParaSpacing, setExportParaSpacing] = useState(false); // false = no extra space between paragraphs (book standard)
  const [activePreset, setActivePreset] = useState("fiction");
  const [exporting, setExporting] = useState(false);
  const [exportScope, setExportScope] = useState("all"); // "all" or chapter id


  // ─── PRESETS (Swedish publishing standards) ───
  const presets = {
    fiction: {
      label: "Skönlitteratur",
      desc: "Svensk bokstandard — indrag, inga blankrader, kapitel 1/3 ner",
      font: "Times New Roman", fontSize: 12, lineSpacing: 1.5, margins: "normal",
      titleStyle: "both", titleAlign: "center", indent: 1.27, chapterStart: "third",
      pageNumbers: true, pageNumPos: "center", header: "title", paraSpacing: false,
    },
    manuscript: {
      label: "Manusskript",
      desc: "Redaktörsformat — dubbelt radavstånd, bred marginal, för granskning",
      font: "Garamond", fontSize: 12, lineSpacing: 2.0, margins: "wide",
      titleStyle: "uppercase", titleAlign: "center", indent: 2.0, chapterStart: "third",
      pageNumbers: true, pageNumPos: "right", header: "both", paraSpacing: false,
    },
    modern: {
      label: "Modern",
      desc: "Modernt bokformat — blockstycken utan indrag, extra radmellanrum",
      font: "Georgia", fontSize: 11, lineSpacing: 1.15, margins: "normal",
      titleStyle: "bold", titleAlign: "left", indent: 0, chapterStart: "direct",
      pageNumbers: true, pageNumPos: "right", header: "none", paraSpacing: true,
    },
    custom: {
      label: "Anpassad",
      desc: "Välj alla inställningar manuellt",
    },
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    const p = presets[key];
    if (!p || key === "custom") return;
    setExportFont(p.font);
    setExportSize(p.fontSize);
    setExportSpacing(p.lineSpacing);
    setExportMargins(p.margins);
    setExportTitleStyle(p.titleStyle);
    setExportTitleAlign(p.titleAlign);
    setExportIndent(p.indent);
    setExportChapterStart(p.chapterStart);
    setExportPageNumbers(p.pageNumbers);
    setExportPageNumPos(p.pageNumPos);
    setExportHeader(p.header);
    setExportParaSpacing(p.paraSpacing);
  };

  const fonts = ["Times New Roman", "Garamond", "Georgia", "Palatino", "Libre Baskerville"];
  const sizes = [10, 11, 12, 13, 14];
  const spacings = [{ v: 1.0, l: "Enkelt" }, { v: 1.15, l: "1.15" }, { v: 1.5, l: "1.5" }, { v: 2.0, l: "Dubbelt" }];
  const marginOptions = [{ v: "narrow", l: "Smal (1.9cm)" }, { v: "normal", l: "Normal (2.5cm)" }, { v: "wide", l: "Bred (3.2cm)" }];
  const titleStyles = [{ v: "uppercase", l: "VERSALER" }, { v: "bold", l: "Fetstil" }, { v: "both", l: "VERSALER + FET" }];
  const titleAligns = [{ v: "left", l: "Vänster" }, { v: "center", l: "Centrerat" }, { v: "right", l: "Höger" }];
  const indentOptions = [{ v: 0, l: "Inget" }, { v: 0.5, l: "0.5 cm" }, { v: 1.27, l: "1.27 cm" }, { v: 2.0, l: "2 cm" }];
  const chapterStartOptions = [{ v: "direct", l: "Direkt" }, { v: "third", l: "1/3 ner" }, { v: "half", l: "Halva sidan" }];
  const pageNumPositions = [{ v: "left", l: "Nere vänster" }, { v: "center", l: "Nere centrerat" }, { v: "right", l: "Nere höger" }];
  const headerOptions = [{ v: "none", l: "Inget" }, { v: "title", l: "Manustitel" }, { v: "author", l: "Författarnamn" }, { v: "both", l: "Titel + författare" }];

  const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0);
  const acceptedCount = [...accepted].filter(id => chapters.some(ch => {
    const paras = paragraphsByChapter[ch.id] || [];
    return paras.some(p => p.suggestions?.some(s => s.id === id));
  })).length;

  const exportChapters = exportScope === "all" ? chapters : chapters.filter(ch => ch.id === exportScope);
  const exportFileName = exportScope === "all" ? fileName : `${fileName} – ${exportChapters[0]?.title || "Kapitel"}`;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportToDocx({
        title: exportFileName,
        chapters: exportChapters,
        paragraphsByChapter,
        accepted,
        rejected,
        options: {
          font: exportFont,
          fontSize: exportSize,
          lineSpacing: exportSpacing,
          margins: exportMargins,
          chapterTitleStyle: exportTitleStyle,
          chapterTitleAlign: exportTitleAlign,
          pageNumbers: exportPageNumbers,
          pageNumberPosition: exportPageNumPos,
          firstLineIndent: exportIndent,
          chapterStartPosition: exportChapterStart,
          headerStyle: exportHeader,
          authorName: "", // TODO: get from user profile
          paragraphSpacing: exportParaSpacing,
        },
      });
      downloadBlob(blob, `${exportFileName} – Tryckfärdig.docx`);
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
        <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 20px" }}>
          {exportScope === "all"
            ? `${fileName} · ${chapters.length} kapitel · ${totalWords.toLocaleString()} ord · ${acceptedCount} godkända ändringar appliceras`
            : `${exportChapters[0]?.title || "Kapitel"} · ${exportChapters[0]?.wordCount?.toLocaleString() || 0} ord`
          }
        </p>

        <OptionGroup label="Vad vill du exportera?">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip active={exportScope === "all"} onClick={() => setExportScope("all")}>Hela boken</Chip>
            {chapters.map((ch, idx) => (
              <Chip key={ch.id} active={exportScope === ch.id} onClick={() => setExportScope(ch.id)}>
                {`Kapitel ${idx + 1}`}
              </Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Formatmall">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(presets).map(([key, p]) => (
              <button key={key} onClick={() => applyPreset(key)} style={{
                flex: "1 1 120px", padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontFamily: uiFont, textAlign: "left",
                border: activePreset === key ? `2px solid ${accent}` : `1px solid ${border}`,
                background: activePreset === key ? accentLight : surface, transition: "all 0.12s",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: activePreset === key ? accent : ink }}>{p.label}</div>
                <div style={{ fontSize: 9.5, color: muted, marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </OptionGroup>

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

        <OptionGroup label="Styckeindrag">
          <div style={{ display: "flex", gap: 6 }}>
            {indentOptions.map(o => (
              <Chip key={o.v} active={exportIndent === o.v} onClick={() => setExportIndent(o.v)}>{o.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Styckemellanrum">
          <div style={{ display: "flex", gap: 6 }}>
            <Chip active={!exportParaSpacing} onClick={() => { setExportParaSpacing(false); setActivePreset("custom"); }}>Nej (bokstandard)</Chip>
            <Chip active={exportParaSpacing} onClick={() => { setExportParaSpacing(true); setActivePreset("custom"); }}>Ja (extra radmellanrum)</Chip>
          </div>
        </OptionGroup>

        <OptionGroup label="Kapitelrubriker – stil">
          <div style={{ display: "flex", gap: 6 }}>
            {titleStyles.map(t => (
              <Chip key={t.v} active={exportTitleStyle === t.v} onClick={() => setExportTitleStyle(t.v)}>{t.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Kapitelrubriker – placering">
          <div style={{ display: "flex", gap: 6 }}>
            {titleAligns.map(a => (
              <Chip key={a.v} active={exportTitleAlign === a.v} onClick={() => setExportTitleAlign(a.v)}>{a.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Kapitel börjar">
          <div style={{ display: "flex", gap: 6 }}>
            {chapterStartOptions.map(o => (
              <Chip key={o.v} active={exportChapterStart === o.v} onClick={() => setExportChapterStart(o.v)}>{o.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Sidhuvud">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {headerOptions.map(h => (
              <Chip key={h.v} active={exportHeader === h.v} onClick={() => setExportHeader(h.v)}>{h.l}</Chip>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label="Sidnumrering">
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <Chip active={exportPageNumbers} onClick={() => setExportPageNumbers(true)}>Ja</Chip>
            <Chip active={!exportPageNumbers} onClick={() => setExportPageNumbers(false)}>Nej</Chip>
          </div>
          {exportPageNumbers && (
            <div style={{ display: "flex", gap: 6 }}>
              {pageNumPositions.map(p => (
                <Chip key={p.v} active={exportPageNumPos === p.v} onClick={() => setExportPageNumPos(p.v)}>{p.l}</Chip>
              ))}
            </div>
          )}
        </OptionGroup>

        {/* Preview strip */}
        <div style={{ padding: "16px 20px", background: bg, borderRadius: 10, marginBottom: 20, border: `1px solid ${border}` }}>
          <div style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Förhandsvisning</div>
          <div style={{
            fontFamily: exportFont === "Libre Baskerville" ? "Georgia" : exportFont,
            fontSize: exportSize, lineHeight: exportSpacing, color: ink,
          }}>
            {exportChapterStart === "third" && <div style={{ height: 40 }} />}
            {exportChapterStart === "half" && <div style={{ height: 70 }} />}
            <div style={{
              textAlign: exportTitleAlign, marginBottom: 12,
              fontWeight: exportTitleStyle === "bold" || exportTitleStyle === "both" ? 700 : 400,
              fontSize: exportSize + 4,
              textTransform: exportTitleStyle === "uppercase" || exportTitleStyle === "both" ? "uppercase" : "none",
            }}>
              Kapitel 1
            </div>
            <div style={{ textIndent: exportIndent > 0 ? `${exportIndent}cm` : 0 }}>
              Sommaren närmade sig, det var slutet av 80-talet. Det är svårt att föreställa sig att livet kunde erbjuda något bättre.
            </div>
            <div style={{ textIndent: exportIndent > 0 ? `${exportIndent}cm` : 0, marginTop: exportParaSpacing ? "0.8em" : 0 }}>
              Hon stod vid fönstret och såg ut över den stilla sjön. Dimman låg tät över vattnet.
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

// ─── LANDING PAGE ───
function LandingPage({ onLogin, onRegister }) {
  const [authModal, setAuthModal] = useState(null); // null | "login" | "register"
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const openAuth = (mode) => { setAuthModal(mode); setTab(mode); setError(null); setEmail(""); setPassword(""); setName(""); setConfirmPassword(""); };
  const closeAuth = () => { setAuthModal(null); setError(null); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try { await onLogin(email, password); } catch (err) { setError(err.message || "Inloggning misslyckades"); } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Lösenorden matchar inte"); return; }
    if (password.length < 6) { setError("Lösenordet måste vara minst 6 tecken"); return; }
    setLoading(true);
    try { await onRegister(email, password, name); } catch (err) { setError(err.message || "Registrering misslyckades"); } finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`,
    background: bg, fontFamily: uiFont, fontSize: 13, color: ink, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };
  const labelStyle = { fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };

  const sectionStyle = { maxWidth: 960, margin: "0 auto", padding: "0 24px" };
  const accentLight = "#f5ebe0";

  const features = [
    { icon: "\u{1F4DD}", title: "Grundgranskning", desc: "Stavfel, grammatik och interpunktion \u2014 vi hittar det mesta redan i f\u00f6rsta genomg\u00e5ngen." },
    { icon: "\u2728", title: "Standardgranskning", desc: "Upprepningar, stilbrott och tempo \u2014 din text lyfts till n\u00e4sta niv\u00e5." },
    { icon: "\u{1F50D}", title: "Djupgranskning", desc: "Dramaturgi, karakt\u00e4rsutveckling och tematik \u2014 som att ha en utvecklingsredakt\u00f6r." },
  ];

  const steps = [
    { num: "1", text: "Ladda upp ditt manus (.docx/.pdf/.txt)" },
    { num: "2", text: "V\u00e4lj analysniv\u00e5" },
    { num: "3", text: "Granska och redigera med AI-st\u00f6d" },
  ];

  const extras = [
    { icon: "\u{1F9EC}", title: "Skrivutveckling", desc: "DNA-profil och scenutbyggnad som st\u00e4rker ditt ber\u00e4ttande." },
    { icon: "\u{1F310}", title: "\u00d6vers\u00e4ttning", desc: "Professionell AI-\u00f6vers\u00e4ttning med parallellvy och ordlista." },
    { icon: "\u{1F4C4}", title: "Export till .docx", desc: "Exportera ditt manus med alla \u00e4ndringar applicerade, redo f\u00f6r tryck." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font, color: ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes landingFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 720px) {
          .lp-features-grid, .lp-steps-grid, .lp-extras-grid { grid-template-columns: 1fr !important; }
          .lp-hero-heading { font-size: 36px !important; }
          .lp-nav-inner { padding: 0 16px !important; }
          .lp-hero { padding: 100px 16px 64px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(247,244,239,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${border}` }}>
        <div className="lp-nav-inner" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: ink, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 16, fontWeight: 700, fontFamily: font }}>M</div>
            <span style={{ fontSize: 18, fontWeight: 700, color: ink, letterSpacing: "-0.02em", fontFamily: font }}>Manusverkstaden</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => openAuth("login")} style={{ padding: "8px 18px", borderRadius: 7, border: `1px solid ${border}`, background: "transparent", color: ink, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: uiFont, transition: "all 0.2s" }}>Logga in</button>
            <button onClick={() => openAuth("register")} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont, transition: "all 0.2s" }}>Skapa konto</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero" style={{ padding: "140px 24px 80px", textAlign: "center", animation: "landingFadeIn 0.7s ease-out" }}>
        <div style={sectionStyle}>
          <h1 className="lp-hero-heading" style={{ fontFamily: font, fontSize: 52, fontWeight: 700, color: ink, letterSpacing: "-0.03em", lineHeight: 1.12, margin: "0 0 20px", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
            Din personliga redakt&ouml;r &mdash; driven av AI
          </h1>
          <p style={{ fontFamily: uiFont, fontSize: 17, color: muted, lineHeight: 1.6, margin: "0 auto 36px", maxWidth: 560 }}>
            Manusverkstaden granskar ditt bokmanuskript med samma precision som en professionell redakt&ouml;r. Fr&aring;n stavfel till dramaturgi.
          </p>
          <button onClick={() => openAuth("register")} style={{ padding: "14px 36px", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: uiFont, transition: "all 0.2s", boxShadow: "0 4px 16px rgba(160,82,45,0.25)" }}>
            Kom ig&aring;ng gratis
          </button>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "64px 24px 72px" }}>
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: font, fontSize: 32, fontWeight: 700, color: ink, textAlign: "center", letterSpacing: "-0.02em", margin: "0 0 12px" }}>Tre niv&aring;er av granskning</h2>
          <p style={{ fontFamily: uiFont, fontSize: 14, color: muted, textAlign: "center", margin: "0 0 44px" }}>V&auml;lj den niv&aring; som passar ditt manus b&auml;st.</p>
          <div className="lp-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: surface, borderRadius: 14, padding: "32px 28px", border: `1px solid ${border}`, transition: "box-shadow 0.2s" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>{f.icon}</div>
                <h3 style={{ fontFamily: font, fontSize: 19, fontWeight: 600, color: ink, margin: "0 0 8px", letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ fontFamily: uiFont, fontSize: 13.5, color: muted, lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "64px 24px 72px", background: surface }}>
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: font, fontSize: 32, fontWeight: 700, color: ink, textAlign: "center", letterSpacing: "-0.02em", margin: "0 0 44px" }}>S&aring; fungerar det</h2>
          <div className="lp-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "24px 16px" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: ink, color: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, fontFamily: font, margin: "0 auto 16px" }}>{s.num}</div>
                <p style={{ fontFamily: uiFont, fontSize: 14, color: ink, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{s.text}</p>
                {i < steps.length - 1 && <div style={{ display: "none" }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXTRA FEATURES ── */}
      <section style={{ padding: "64px 24px 72px" }}>
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: font, fontSize: 32, fontWeight: 700, color: ink, textAlign: "center", letterSpacing: "-0.02em", margin: "0 0 12px" }}>Mer &auml;n bara granskning</h2>
          <p style={{ fontFamily: uiFont, fontSize: 14, color: muted, textAlign: "center", margin: "0 0 44px" }}>Verktyg som hj&auml;lper dig genom hela skrivprocessen.</p>
          <div className="lp-extras-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {extras.map((f, i) => (
              <div key={i} style={{ background: surface, borderRadius: 14, padding: "28px 24px", border: `1px solid ${border}` }}>
                <div style={{ fontSize: 24, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontFamily: font, fontSize: 17, fontWeight: 600, color: ink, margin: "0 0 6px" }}>{f.title}</h3>
                <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "72px 24px 80px", background: ink, textAlign: "center" }}>
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: font, fontSize: 32, fontWeight: 700, color: bg, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Redo att f&ouml;rb&auml;ttra ditt manus?</h2>
          <p style={{ fontFamily: uiFont, fontSize: 15, color: "rgba(247,244,239,0.65)", margin: "0 0 32px" }}>Prova Manusverkstaden gratis &mdash; inga kortuppgifter kr&auml;vs.</p>
          <button onClick={() => openAuth("register")} style={{ padding: "14px 36px", borderRadius: 9, border: `2px solid ${accent}`, background: accent, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: uiFont, transition: "all 0.2s" }}>
            Skapa konto gratis
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "32px 24px", background: ink, borderTop: "1px solid rgba(247,244,239,0.1)" }}>
        <div style={{ ...sectionStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: uiFont, fontSize: 12, color: "rgba(247,244,239,0.45)" }}>&copy; 2026 Manusverkstaden</span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Villkor", "Integritet", "Kontakt"].map(link => (
              <a key={link} href="#" onClick={e => e.preventDefault()} style={{ fontFamily: uiFont, fontSize: 12, color: "rgba(247,244,239,0.45)", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = "rgba(247,244,239,0.8)"}
                onMouseLeave={e => e.target.style.color = "rgba(247,244,239,0.45)"}
              >{link}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ── */}
      {authModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={closeAuth} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.5)", backdropFilter: "blur(6px)" }} />
          <div style={{ position: "relative", background: surface, borderRadius: 16, padding: "32px 36px", maxWidth: 420, width: "calc(100% - 48px)", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "landingFadeIn 0.3s ease-out" }}>
            {/* Close button */}
            <button onClick={closeAuth} style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%", border: "none", background: bg, color: muted, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>&times;</button>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, background: ink, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 14, fontWeight: 700 }}>M</div>
              <span style={{ fontSize: 17, fontWeight: 700, color: ink, letterSpacing: "-0.02em", fontFamily: font }}>Manusverkstaden</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${border}` }}>
              {[{ id: "login", label: "Logga in" }, { id: "register", label: "Skapa konto" }].map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setError(null); }} style={{
                  flex: 1, padding: "10px 0", border: "none", background: "none", fontFamily: uiFont,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", color: tab === t.id ? accent : muted,
                  borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
                  marginBottom: -2, transition: "all 0.2s",
                }}>{t.label}</button>
              ))}
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fdf0ef", borderRadius: 8, borderLeft: `3px solid #c0392b`, fontFamily: uiFont, fontSize: 12, color: "#c0392b" }}>
                {error}
              </div>
            )}

            {tab === "login" ? (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>E-post</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="din@email.se" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>L&ouml;senord</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Ditt l\u00f6senord" style={inputStyle} />
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
                  <label style={labelStyle}>L&ouml;senord</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Minst 6 tecken" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Bekr&auml;fta l&ouml;senord</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Upprepa l\u00f6senord" style={inputStyle} />
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
      )}
    </div>
  );
}

// ─── DASHBOARD VIEW ───
function DashboardView({ user, onOpenProject, onNewProject, onLogout, onProfile, onAdmin }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // project to confirm delete
  const [usageData, setUsageData] = useState(null);

  const SWEDISH_MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const planLabels = { trial: "PROVA", PROVA: "PROVA", basic: "GRUND", GRUND: "GRUND", publisher: "FÖRLAG", FORLAG: "FÖRLAG" };
  const planColors = { trial: muted, PROVA: muted, basic: accent, GRUND: accent, publisher: "#27864a", FORLAG: "#27864a" };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
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
  }, [user]);

  useEffect(() => {
    if (!user) return;
    apiClient.getUsage().then(setUsageData).catch(() => setUsageData(null));
  }, [user]);

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
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);

    // If within 24 hours, show relative time
    if (diffHours < 1) return `${Math.max(1, Math.round(diffMs / 60000))} min sedan`;
    if (diffHours < 24) return `${Math.round(diffHours)} tim sedan`;

    // Otherwise show date + time
    const dateStr = date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
    const timeStr = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    // If same year, skip year
    if (date.getFullYear() === now.getFullYear()) return `${dateStr}, ${timeStr}`;
    return `${dateStr} ${date.getFullYear()}, ${timeStr}`;
  };

  // Compute aggregate stats
  const totalChapters = projects.reduce((s, p) => s + (p.chapterCount || p.chapters?.length || 0), 0);
  const totalWords = projects.reduce((s, p) => s + (p.wordCount || p.chapters?.reduce((a, c) => a + (c.wordCount || 0), 0) || 0), 0);

  // Find latest project (most recently updated)
  const latestProject = projects.length > 0
    ? [...projects].sort((a, b) => new Date(b.updatedAt || b.updated_at || 0) - new Date(a.updatedAt || a.updated_at || 0))[0]
    : null;

  // Usage bar helpers
  const now = new Date();
  const usageMonth = `${SWEDISH_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const usagePercent = usageData && usageData.limit > 0 ? Math.min(100, Math.round((usageData.used / usageData.limit) * 100)) : null;

  const currentPlan = user?.plan || "PROVA";

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
          {user?.role === "SUPER_ADMIN" && (
            <button onClick={onAdmin} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${accent}`, background: accentLight, color: accent, cursor: "pointer", fontWeight: 600 }}>Admin</button>
          )}
          <button onClick={onProfile} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>Profil</button>
          <button onClick={onLogout} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Logga ut</button>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Account overview card */}
        <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: "22px 24px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            {/* Left: welcome + plan badge */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>
                  {`Välkommen, ${user?.name || user?.email || ""}`}
                </h1>
                <span style={{
                  fontFamily: uiFont, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "3px 10px", borderRadius: 6,
                  background: (planColors[currentPlan] || muted) + "18",
                  color: planColors[currentPlan] || muted,
                }}>{planLabels[currentPlan] || "PROVA"}</span>
              </div>
              <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>
                {`${projects.length} projekt \u00b7 ${totalChapters} kapitel \u00b7 ${totalWords.toLocaleString()} ord totalt`}
              </div>
            </div>

            {/* Right: usage bar */}
            <div style={{ minWidth: 220, maxWidth: 300, flex: "0 0 auto" }}>
              <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginBottom: 6 }}>
                {`F\u00f6rbrukning ${usageMonth}`}
              </div>
              {usagePercent !== null ? (
                <>
                  <div style={{ height: 6, background: border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, transition: "width 0.4s",
                      width: `${usagePercent}%`,
                      background: usagePercent > 90 ? "#c0392b" : usagePercent > 70 ? "#b8860b" : accent,
                    }} />
                  </div>
                  <div style={{ fontFamily: uiFont, fontSize: 10, color: muted, marginTop: 4, textAlign: "right" }}>
                    {`${usagePercent}% anv\u00e4nt`}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{"\u2014"}</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick action: continue latest */}
        {latestProject && !loading && (
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={() => onOpenProject(latestProject)}
              style={{
                fontFamily: uiFont, fontSize: 12, color: accent, background: "none", border: "none",
                cursor: "pointer", padding: "4px 0", fontWeight: 500, letterSpacing: "-0.01em",
              }}
            >
              {`Forts\u00e4tt med ${latestProject.title || "Namnl\u00f6st manus"} \u2192`}
            </button>
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Dina manus</h2>
        <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 24px" }}>V&auml;lj ett projekt att arbeta med eller skapa ett nytt.</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>Laddar projekt...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
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
              const projWords = project.wordCount || project.chapters?.reduce((s, c) => s + (c.wordCount || 0), 0) || 0;
              const chapterCount = project.chapterCount || project.chapters?.length || 0;
              const progress = project.progress || 0;

              // Calculate review progress: chapters with REVIEWED status / total chapters
              const chaptersReviewed = project.chapters
                ? project.chapters.filter(c => c.status === 'REVIEWED').length
                : 0;
              const reviewPercent = chapterCount > 0 ? Math.round((chaptersReviewed / chapterCount) * 100) : 0;

              // Genre badges
              const genres = project.genres || (project.genre ? [project.genre] : []);

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
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(project); setMenuOpen(null); }} style={{
                          width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left",
                          fontFamily: uiFont, fontSize: 12, color: "#c0392b", cursor: "pointer",
                        }}>Radera</button>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: ink, margin: "0 0 4px", letterSpacing: "-0.01em", paddingRight: 24 }}>{project.title || "Namnlöst manus"}</h3>
                    {genres.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {genres.map((g, i) => (
                          <span key={i} style={{ fontFamily: uiFont, fontSize: 10, color: muted, background: bg, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{g}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, display: "flex", gap: 12 }}>
                    <span>{chapterCount} kapitel</span>
                    <span>{projWords.toLocaleString()} ord</span>
                  </div>

                  {/* Review progress bar */}
                  {chapterCount > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>Granskat</span>
                        <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>{reviewPercent}%</span>
                      </div>
                      <div style={{ height: 4, background: border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(reviewPercent, 100)}%`, background: reviewPercent === 100 ? "#27864a" : accent, borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}

                  {/* Legacy progress bar (if no chapters but progress set) */}
                  {progress > 0 && chapterCount === 0 && (
                    <div style={{ height: 4, background: border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: accent, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>{formatDate(project.updatedAt || project.updated_at)}</span>
                    <button onClick={() => onOpenProject(project)} style={{
                      fontFamily: uiFont, fontSize: 11, padding: "6px 16px", borderRadius: 7, border: "none",
                      background: accent, color: "#fff", cursor: "pointer", fontWeight: 600,
                    }}>{chapterCount > 0 ? "Fortsätt granska" : "Öppna"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: surface, borderRadius: 16, padding: "32px 28px", maxWidth: 420, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink, margin: "0 0 12px" }}>Radera manus?</h3>
            <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, lineHeight: 1.5, margin: "0 0 24px" }}>
              Är du säker? Detta raderar även ändringar i manuset. Exportera först om du vill dokumentera ändringarna.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { onOpenProject(confirmDelete); setConfirmDelete(null); }} style={{
                flex: 1, padding: "10px 16px", borderRadius: 8, border: `1px solid ${border}`,
                background: surface, fontFamily: uiFont, fontSize: 13, fontWeight: 500, color: ink, cursor: "pointer",
              }}>Exportera först</button>
              <button onClick={async () => { const id = confirmDelete.id; setConfirmDelete(null); await handleDelete(id); }} disabled={deleting} style={{
                flex: 1, padding: "10px 16px", borderRadius: 8, border: "none",
                background: "#c0392b", fontFamily: uiFont, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
              }}>{deleting ? "Raderar..." : "Radera"}</button>
            </div>
            <button onClick={() => setConfirmDelete(null)} style={{
              width: "100%", marginTop: 10, padding: "8px", border: "none", background: "none",
              fontFamily: uiFont, fontSize: 12, color: muted, cursor: "pointer",
            }}>Avbryt</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROFILE VIEW ───
function ProfileView({ user, onBack, onAdmin, onLogout }) {
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

  const planLabels = { trial: "PROVA", PROVA: "PROVA", basic: "GRUND", GRUND: "GRUND", publisher: "FÖRLAG", FORLAG: "FÖRLAG" };
  const planColors = { trial: muted, PROVA: muted, basic: accent, GRUND: accent, publisher: "#27864a", FORLAG: "#27864a" };
  const currentPlan = user?.plan || "PROVA";
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isDev = user?.isDevAccount;

  const sectionStyle = { background: surface, borderRadius: 14, padding: "24px 28px", border: `1px solid ${border}`, marginBottom: 20 };
  const sectionTitle = { fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" };
  const statRow = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${border}`, fontFamily: uiFont, fontSize: 12.5 };

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: surface }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} title="Tillbaka till dashboard">
          <div style={{ width: 30, height: 30, background: ink, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 15, fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{user?.name || user?.email}</span>
          {user?.role === "SUPER_ADMIN" && (
            <button onClick={onAdmin} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${accent}`, background: accentLight, color: accent, cursor: "pointer", fontWeight: 600 }}>Admin</button>
          )}
          {onLogout && <button onClick={onLogout} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Logga ut</button>}
        </div>
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
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {isDev && (
                <span style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#27864a18", color: "#27864a" }}>DEV</span>
              )}
              {isAdmin && (
                <span style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#7c3aed18", color: "#7c3aed" }}>ADMIN</span>
              )}
              <span style={{
                fontFamily: uiFont, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                background: isDev ? "#27864a18" : `${planColors[currentPlan] || muted}18`,
                color: isDev ? "#27864a" : (planColors[currentPlan] || muted),
              }}>{isDev ? "OBEGRÄNSAD" : (planLabels[currentPlan] || currentPlan)}</span>
            </div>
          </div>
        </div>

        {/* Admin Panel button for SUPER_ADMIN */}
        {isAdmin && onAdmin && (
          <button
            onClick={onAdmin}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 10, border: `1px solid ${accent}`,
              background: accentLight, color: accent, fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: uiFont, transition: "background 0.2s",
              marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            Admin Panel
          </button>
        )}

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

        {/* Upgrade button - hidden for dev accounts */}
        {!isDev && (
          <button onClick={handleUpgrade} disabled={upgrading} style={{
            width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
            background: upgrading ? "#d4c8bb" : accent, color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: upgrading ? "default" : "pointer", fontFamily: uiFont, transition: "background 0.2s",
          }}>{upgrading ? "Laddar..." : "Uppgradera plan"}</button>
        )}
      </div>
    </div>
  );
}

// ─── SUPER ADMIN VIEW ───
function SuperAdminView({ user, onBack, onDashboard }) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [usage, setUsage] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [editedPrompts, setEditedPrompts] = useState({});
  const [saving, setSaving] = useState(null);
  const [promptCategory, setPromptCategory] = useState("all");
  const [updatingUser, setUpdatingUser] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUserData, setEditingUserData] = useState({});
  const [retryKey, setRetryKey] = useState(0);

  const tabs = [
    { id: "overview", label: "Översikt" },
    { id: "users", label: "Användare" },
    { id: "usage", label: "Förbrukning" },
    { id: "prompts", label: "Prompter" },
  ];

  // Fetch data when tab changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (tab === "overview") {
          const data = await apiClient.getAdminOverview();
          if (!cancelled) setOverview(data);
        } else if (tab === "users") {
          const data = await apiClient.getAdminUsers(userSearch);
          if (!cancelled) setUsers(data.users || data || []);
        } else if (tab === "usage") {
          const data = await apiClient.getAdminUsage();
          if (!cancelled) setUsage(data);
        } else if (tab === "prompts") {
          const data = await apiClient.getAdminPrompts();
          if (!cancelled) {
            const list = data.prompts || data || [];
            setPrompts(list);
            setEditedPrompts({});
          }
        }
      } catch (err) {
        console.error("Admin fetch failed:", err);
        if (!cancelled) setError(err.message || "Kunde inte ladda data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, retryKey]);

  // Refetch users on search change (debounced)
  useEffect(() => {
    if (tab !== "users") return;
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.getAdminUsers(userSearch);
        setUsers(data.users || data || []);
      } catch (err) {
        console.error("User search failed:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, tab]);

  const handleStartEdit = (u) => {
    setEditingUserId(u.id);
    setEditingUserData({ plan: u.plan || "PROVA", role: u.role || "USER", isDevAccount: !!u.isDevAccount || !!u.isDev, disabled: !!u.disabled });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUserData({});
  };

  const handleSaveUser = async (id) => {
    setUpdatingUser(id);
    try {
      await apiClient.updateAdminUser(id, editingUserData);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...editingUserData, isDev: editingUserData.isDevAccount } : u));
      setEditingUserId(null);
      setEditingUserData({});
    } catch (err) {
      console.error("Update user failed:", err);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleSavePrompt = async (key) => {
    if (!editedPrompts[key] && editedPrompts[key] !== "") return;
    setSaving(key);
    try {
      await apiClient.updateAdminPrompt(key, editedPrompts[key]);
      setPrompts(prev => prev.map(p => p.key === key ? { ...p, content: editedPrompts[key], version: (p.version || 0) + 1 } : p));
      setEditedPrompts(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (err) {
      console.error("Save prompt failed:", err);
    } finally {
      setSaving(null);
    }
  };

  const statCard = (label, value, sub) => (
    <div style={{ background: surface, borderRadius: 12, padding: "20px 22px", border: `1px solid ${border}`, flex: "1 1 160px", minWidth: 150 }}>
      <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontFamily: font, fontSize: 28, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const spinner = (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
      <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>Laddar...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const errorBox = (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontFamily: uiFont, fontSize: 14, color: ink, marginBottom: 8 }}>Kunde inte ladda data</div>
      <div style={{ fontFamily: uiFont, fontSize: 12, color: muted, marginBottom: 20 }}>{error}</div>
      <button
        onClick={() => setRetryKey(k => k + 1)}
        style={{ fontFamily: uiFont, fontSize: 12, padding: "8px 20px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: accent, cursor: "pointer", fontWeight: 600 }}
      >Försök igen</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={onDashboard} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} title="Tillbaka till dashboard">
            <div style={{ width: 30, height: 30, background: ink, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 15, fontWeight: 700 }}>M</div>
            <span style={{ fontSize: 17, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
          </div>
          <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: accent, background: accentLight, padding: "2px 8px", borderRadius: 5, marginLeft: 6 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{user?.name || user?.email}</span>
          <button onClick={onBack} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>
            &larr; Tillbaka till profil
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: ink, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Administration</h1>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `1px solid ${border}`, paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              fontFamily: uiFont, fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              padding: "8px 18px", border: "none", cursor: "pointer",
              background: "transparent", color: tab === t.id ? accent : muted,
              borderBottom: tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ─── Tab: Översikt ─── */}
        {tab === "overview" && (loading ? spinner : error ? errorBox : overview && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
              {statCard("Totala användare", overview.totalUsers)}
              {statCard("Aktiva projekt", overview.totalProjects ?? overview.activeProjects)}
              {statCard("Kapitel", overview.totalChapters)}
              {statCard("Aktiva (7d)", overview.activeUsersLast7Days ?? overview.activeUsers7d)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
              {statCard("API-kostnad (månad)", overview.apiCostUsdThisMonth != null ? `$${Number(overview.apiCostUsdThisMonth).toFixed(4)}` : "—")}
              {statCard("API-kostnad idag", overview.apiCostUsdToday != null ? `$${Number(overview.apiCostUsdToday).toFixed(4)}` : "—")}
              {statCard(
                "Intäkt (månad)",
                overview.revenueThisMonth != null ? `${Number(overview.revenueThisMonth).toLocaleString("sv-SE")} kr` : "—",
                overview.revenueSource === "stripe" ? "via Stripe" : overview.revenueSource === "unavailable" ? "Stripe ej kopplat" : undefined
              )}
              {statCard(
                "MRR",
                overview.mrr != null ? `${Number(overview.mrr).toLocaleString("sv-SE")} kr` : "—",
                overview.activeSubscriptions != null ? `${overview.activeSubscriptions} aktiva` : undefined
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
              {statCard("Marginal", overview.revenueThisMonth != null && overview.apiCostUsdThisMonth != null
                ? (() => {
                    const apiCostSek = Number(overview.apiCostUsdThisMonth) * 10.5; // approx USD→SEK
                    const margin = Number(overview.revenueThisMonth) - apiCostSek;
                    return `${margin >= 0 ? "+" : ""}${margin.toFixed(0)} kr`;
                  })()
                : "—",
                overview.revenueThisMonth != null && overview.apiCostUsdThisMonth != null
                  ? `API ≈ ${(Number(overview.apiCostUsdThisMonth) * 10.5).toFixed(0)} kr`
                  : undefined
              )}
            </div>
            {overview.usersByPlan && (
              <div style={{ background: surface, borderRadius: 12, padding: "20px 22px", border: `1px solid ${border}` }}>
                <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Användare per plan</div>
                <div style={{ display: "flex", gap: 24 }}>
                  {Object.entries(overview.usersByPlan).map(([plan, count]) => (
                    <div key={plan} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: ink }}>{count}</div>
                      <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, marginTop: 2 }}>{plan}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ─── Tab: Användare ─── */}
        {tab === "users" && (
          <div>
            <input
              type="text"
              placeholder="Sök på e-post eller namn..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{
                width: "100%", maxWidth: 400, padding: "9px 14px", borderRadius: 8,
                border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 13,
                background: surface, color: ink, marginBottom: 20, outline: "none",
                boxSizing: "border-box",
              }}
            />
            {loading ? spinner : error ? errorBox : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: uiFont, fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${border}` }}>
                      {["Namn", "Email", "Plan", "Roll", "Dev-konto", "Inaktiverad", "Skapad", "Senast aktiv", "Åtgärder"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? surface : bg }}>
                        <td style={{ padding: "10px 12px", color: ink }}>{u.name || "—"}</td>
                        <td style={{ padding: "10px 12px", color: ink }}>{u.email}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {editingUserId === u.id ? (
                            <select
                              value={editingUserData.plan || "PROVA"}
                              onChange={e => setEditingUserData(prev => ({ ...prev, plan: e.target.value }))}
                              style={{ fontFamily: uiFont, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}
                            >
                              <option value="PROVA">PROVA</option>
                              <option value="GRUND">GRUND</option>
                              <option value="FORLAG">FÖRLAG</option>
                            </select>
                          ) : (
                            <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: `${accent}12`, color: accent }}>{u.plan || "PROVA"}</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {editingUserId === u.id ? (
                            <select
                              value={editingUserData.role || "USER"}
                              onChange={e => setEditingUserData(prev => ({ ...prev, role: e.target.value }))}
                              style={{ fontFamily: uiFont, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}
                            >
                              <option value="USER">USER</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                          ) : (
                            <span style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: u.role === "SUPER_ADMIN" ? "#7c3aed" : muted }}>{u.role || "USER"}</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {editingUserId === u.id ? (
                            <input
                              type="checkbox"
                              checked={!!editingUserData.isDevAccount}
                              onChange={e => setEditingUserData(prev => ({ ...prev, isDevAccount: e.target.checked }))}
                              style={{ cursor: "pointer", accentColor: accent }}
                            />
                          ) : (
                            <span style={{ fontFamily: uiFont, fontSize: 10, color: (u.isDevAccount || u.isDev) ? "#27864a" : muted }}>{(u.isDevAccount || u.isDev) ? "Ja" : "Nej"}</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {editingUserId === u.id ? (
                            <input
                              type="checkbox"
                              checked={!!editingUserData.disabled}
                              onChange={e => setEditingUserData(prev => ({ ...prev, disabled: e.target.checked }))}
                              style={{ cursor: "pointer", accentColor: "#c0392b" }}
                            />
                          ) : (
                            <span style={{ fontFamily: uiFont, fontSize: 10, color: u.disabled ? "#c0392b" : muted }}>{u.disabled ? "Ja" : "Nej"}</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", color: muted, whiteSpace: "nowrap" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("sv-SE") : "—"}</td>
                        <td style={{ padding: "10px 12px", color: muted, whiteSpace: "nowrap" }}>{u.lastActive ? new Date(u.lastActive).toLocaleDateString("sv-SE") : "—"}</td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          {editingUserId === u.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => handleSaveUser(u.id)}
                                disabled={updatingUser === u.id}
                                style={{ fontFamily: uiFont, fontSize: 10, padding: "4px 10px", borderRadius: 5, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}
                              >{updatingUser === u.id ? "Sparar..." : "Spara"}</button>
                              <button
                                onClick={handleCancelEdit}
                                style={{ fontFamily: uiFont, fontSize: 10, padding: "4px 10px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer" }}
                              >Avbryt</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(u)}
                              style={{ fontFamily: uiFont, fontSize: 10, padding: "4px 10px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: accent, cursor: "pointer", fontWeight: 500 }}
                            >Redigera</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: muted }}>Inga användare hittades.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Förbrukning ─── */}
        {tab === "usage" && (loading ? spinner : error ? errorBox : usage && (
          <div>
            {/* Total cost and tokens summary */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
              {statCard("API-kostnad (30d)", usage.totals?.apiCostUsd != null ? `$${Number(usage.totals.apiCostUsd).toFixed(4)}` : "—")}
              {statCard("Input tokens", usage.totals?.inputTokens != null ? Number(usage.totals.inputTokens).toLocaleString() : "—")}
              {statCard("Output tokens", usage.totals?.outputTokens != null ? Number(usage.totals.outputTokens).toLocaleString() : "—")}
              {statCard("Anrop", usage.totals?.count != null ? usage.totals.count : "—")}
            </div>

            {/* Bar chart – daily API costs */}
            {usage.dailyCosts && usage.dailyCosts.length > 0 && (
              <div style={{ background: surface, borderRadius: 12, padding: "20px 22px", border: `1px solid ${border}`, marginBottom: 24 }}>
                <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, fontWeight: 500, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.04em" }}>Daglig API-kostnad USD (senaste 30 dagar)</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
                  {(() => {
                    const maxCost = Math.max(...usage.dailyCosts.map(d => d.apiCostUsd || d.cost || 0), 0.001);
                    return usage.dailyCosts.map((d, i) => {
                      const costVal = d.apiCostUsd || d.cost || 0;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div
                            title={`${d.date}: $${Number(costVal).toFixed(4)} (${Number(d.inputTokens || 0).toLocaleString()} in / ${Number(d.outputTokens || 0).toLocaleString()} out)`}
                            style={{
                              width: "100%", maxWidth: 24, minWidth: 4,
                              height: `${Math.max((costVal / maxCost) * 120, 2)}px`,
                              background: accent, borderRadius: "3px 3px 0 0",
                              transition: "height 0.3s",
                            }}
                          />
                          {i % 5 === 0 && (
                            <div style={{ fontFamily: uiFont, fontSize: 8, color: muted, marginTop: 4, whiteSpace: "nowrap", transform: "rotate(-45deg)", transformOrigin: "top left" }}>
                              {d.date?.slice(5) || ""}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Breakdown by type */}
            {usage.byType && usage.byType.length > 0 && (
              <div style={{ background: surface, borderRadius: 12, padding: "20px 22px", border: `1px solid ${border}`, marginBottom: 24 }}>
                <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Kostnad per typ</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: uiFont, fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${border}` }}>
                      {["Typ", "API-kostnad", "Input tokens", "Output tokens", "Anrop"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.byType.map((t, i) => (
                      <tr key={t.type || i} style={{ borderBottom: `1px solid ${border}` }}>
                        <td style={{ padding: "8px 12px", color: ink, fontWeight: 500 }}>{(t.type || "").replace(/_/g, " ")}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>${Number(t.apiCostUsd || 0).toFixed(4)}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{Number(t.inputTokens || 0).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{Number(t.outputTokens || 0).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{t.count ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Breakdown by model */}
            {usage.byModel && usage.byModel.length > 0 && (
              <div style={{ background: surface, borderRadius: 12, padding: "20px 22px", border: `1px solid ${border}` }}>
                <div style={{ fontFamily: uiFont, fontSize: 11, color: muted, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Kostnad per modell</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: uiFont, fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${border}` }}>
                      {["Modell", "API-kostnad", "Input tokens", "Output tokens", "Anrop"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.byModel.map((m, i) => (
                      <tr key={m.model || i} style={{ borderBottom: `1px solid ${border}` }}>
                        <td style={{ padding: "8px 12px", color: ink, fontWeight: 500, fontFamily: "monospace", fontSize: 11 }}>{m.model || "—"}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>${Number(m.apiCostUsd || 0).toFixed(4)}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{Number(m.inputTokens || 0).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{Number(m.outputTokens || 0).toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", color: ink }}>{m.count ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* ─── Tab: Prompter ─── */}
        {tab === "prompts" && (loading ? spinner : error ? errorBox : (
          <div>
            {/* Prompt category tabs */}
            {(() => {
              const categories = [
                { id: "all", label: "Alla" },
                { id: "grund", label: "Grundprompt" },
                { id: "genre", label: "Genretillägg" },
                { id: "modul", label: "Moduler" },
                { id: "ai", label: "Backend AI" },
                { id: "nivå", label: "Analysnivåer" },
                { id: "format", label: "Responsformat" },
              ];
              const categoryLabels = { grund: "Grundprompt", genre: "Genretillägg", modul: "Modul", ai: "Backend AI", "nivå": "Analysnivå", format: "Responsformat" };
              const friendlyName = (key) => {
                const [cat, name] = key.split(":");
                const nameMap = {
                  base_prompt: "Huvudprompt", realistic: "Realistisk fiktion", crime: "Deckare / Thriller",
                  fantasy: "Fantasy / Sci-fi", romance: "Romantik / Feelgood", horror: "Skräck / Gothic",
                  historical: "Historisk roman", ya: "Barn & Ungdom", memoir: "Memoar / Sakprosa",
                  poetry: "Lyrik / Poesi", develop: "Skrivutveckling", translate: "Översättning",
                  review: "Granskning", dna_profile: "DNA-profil", develop_brainstorm: "Brainstorm",
                  develop_expand: "Scenutbyggnad", develop_rewrite: "Omskrivning", develop_newscene: "Ny scen",
                  quick: "Snabbanalys", deep: "Djupanalys", review_response: "Granskningssvar",
                  brainstorm: "Brainstorming", translation: "Översättning",
                };
                return nameMap[name] || name;
              };
              const filtered = promptCategory === "all"
                ? prompts
                : prompts.filter(p => p.key?.startsWith(promptCategory + ":"));
              const counts = {};
              prompts.forEach(p => { const cat = p.key?.split(":")[0] || "other"; counts[cat] = (counts[cat] || 0) + 1; });

              return (
                <>
                  <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                    {categories.map(c => {
                      const count = c.id === "all" ? prompts.length : (counts[c.id] || 0);
                      if (c.id !== "all" && count === 0) return null;
                      return (
                        <button key={c.id} onClick={() => setPromptCategory(c.id)} style={{
                          fontFamily: uiFont, fontSize: 11, fontWeight: promptCategory === c.id ? 600 : 400,
                          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                          border: promptCategory === c.id ? `1px solid ${accent}` : `1px solid ${border}`,
                          background: promptCategory === c.id ? `${accent}14` : surface,
                          color: promptCategory === c.id ? accent : muted,
                          transition: "all 0.15s",
                        }}>{c.label} ({count})</button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {filtered.map(p => {
                      const [cat] = (p.key || "").split(":");
                      return (
                        <div key={p.key} style={{ background: surface, borderRadius: 12, padding: "18px 22px", border: `1px solid ${border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: uiFont, fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: `${accent}12`, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>{categoryLabels[cat] || cat}</span>
                              <span style={{ fontFamily: uiFont, fontSize: 13, fontWeight: 600, color: ink }}>{friendlyName(p.key)}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 10, color: muted }}>{p.key}</span>
                              <span style={{ fontFamily: uiFont, fontSize: 10, color: muted }}>v{p.version || 1}</span>
                            </div>
                            <button
                              onClick={() => handleSavePrompt(p.key)}
                              disabled={saving === p.key || editedPrompts[p.key] === undefined}
                              style={{
                                fontFamily: uiFont, fontSize: 11, padding: "5px 14px", borderRadius: 6,
                                border: "none", cursor: editedPrompts[p.key] !== undefined ? "pointer" : "default",
                                background: editedPrompts[p.key] !== undefined ? accent : border,
                                color: editedPrompts[p.key] !== undefined ? "#fff" : muted,
                                fontWeight: 600, transition: "all 0.15s",
                              }}
                            >{saving === p.key ? "Sparar..." : "Spara"}</button>
                          </div>
                          <textarea
                            value={editedPrompts[p.key] !== undefined ? editedPrompts[p.key] : (p.content || "")}
                            onChange={e => setEditedPrompts(prev => ({ ...prev, [p.key]: e.target.value }))}
                            style={{
                              width: "100%", minHeight: p.content?.length > 500 ? 240 : 120, padding: "12px 14px", borderRadius: 8,
                              border: `1px solid ${border}`, fontFamily: "monospace", fontSize: 12,
                              background: bg, color: ink, resize: "vertical", outline: "none",
                              boxSizing: "border-box", lineHeight: 1.6,
                            }}
                          />
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: muted, fontFamily: uiFont, fontSize: 13 }}>
                        {prompts.length === 0 ? "Inga prompter konfigurerade. Kör: node server/src/utils/seed-prompts.js" : "Inga prompter i denna kategori."}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
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
  const [highlightTermState, setHighlightTermState] = useState(null); // { suggestionId, occurrenceIdx, terms, occurrences }
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  const [reviewHistory, setReviewHistory] = useState([]); // [{ date, chapterId, suggestionCount, accepted, rejected }]
  const [activeReviewRound, setActiveReviewRound] = useState(1);
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
  const [emotionMaps, setEmotionMaps] = useState({}); // { chapterId: emotionMapData }
  const [selectionToolbar, setSelectionToolbar] = useState(null);
  const [developModal, setDevelopModal] = useState(null); // null or { initialText }
  const [insertedParaIds, setInsertedParaIds] = useState(new Set()); // paragraph IDs just inserted by develop
  const [finalCheckResult, setFinalCheckResult] = useState(null); // null or { issues, summary }
  const [finalCheckRunning, setFinalCheckRunning] = useState(false);
  const [showFinalCheckPrompt, setShowFinalCheckPrompt] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchState, setSearchState] = useState(null); // { query, matches, activeMatchIdx, caseSensitive }

  // Keyboard shortcuts: Ctrl/Cmd+F → search, Escape → close
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && view === "editor") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h" && view === "editor") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);
  const [developResult, setDevelopResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved"
  const [sessionExpired, setSessionExpired] = useState(false);
  const [analysisLevel, setAnalysisLevel] = useState("standard");
  const [serverProjectId, setServerProjectId] = useState(null);
  const mainRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveIndicatorRef = useRef(null);
  const autoSaveEnabled = useRef(false); // prevent save before restore decision
  const abortProcessingRef = useRef(false);

  // ─── RESTORE ON MOUNT ───
  useEffect(() => {
    if (authLoading) return; // wait for auth to settle
    if (!isAuthenticated) {
      setView("auth");
      return;
    }
    // Immediately show dashboard while loading project data (prevents editor flash)
    setView("dashboard");
    (async () => {
      try {
        // Check IndexedDB for last-open project reference
        const saved = await loadProject();
        if (saved?.serverProjectId) {
          // Restore last project from DB
          try {
            const result = await apiClient.getProject(saved.serverProjectId);
            const data = result?.project || result;
            if (data) {
              setServerProjectId(data.id);
              setUploadedFile({ name: data.title });
              setGenres(data.genres || []);
              setModules(data.modules || []);
              setTransLangs(data.transLanguages || ["en"]);
              setDnaProfile(data.dnaProfile || null);
              if (saved.conventions) setConventions(saved.conventions);

              const parasMap = {};
              const restoredAccepted = new Set();
              const restoredRejected = new Set();
              for (const ch of data.chapters || []) {
                const paras = splitIntoParagraphs(ch.content);
                if (ch.suggestions?.length) {
                  parasMap[ch.id] = attachSuggestionsToParagraphs(paras, ch.suggestions, ch.id);
                  ch.suggestions.forEach(s => {
                    if (s.status === "ACCEPTED") restoredAccepted.add(s.id);
                    else if (s.status === "REJECTED") restoredRejected.add(s.id);
                  });
                } else {
                  parasMap[ch.id] = paras;
                }
              }

              const loadedChapters = (data.chapters || []).map(ch => ({
                id: ch.id, number: ch.number, title: ch.title,
                content: ch.content, wordCount: ch.wordCount,
                status: ch.suggestions?.length > 0 ? "done" : "pending",
              }));
              setChapters(loadedChapters);
              setParagraphsByChapter(parasMap);
              setAccepted(restoredAccepted);
              setRejected(restoredRejected);
              setActiveChapter(saved.activeChapterId || loadedChapters[0]?.id);
              autoSaveEnabled.current = true;
            }
          } catch (err) {
            console.error("Failed to restore project from DB:", err);
          }
        }
        setView("dashboard");
      } catch (err) {
        console.error("Restore failed:", err);
        setView("dashboard");
      }
    })();
  }, [authLoading, isAuthenticated]);

  // ─── GLOBAL AUTH ERROR HANDLER ───
  useEffect(() => {
    const origRequest = apiClient.request.bind(apiClient);
    apiClient.request = async (...args) => {
      try {
        return await origRequest(...args);
      } catch (err) {
        if (err instanceof AuthError) {
          setSessionExpired(true);
        }
        throw err;
      }
    };
    return () => { apiClient.request = origRequest; };
  }, []);

  // ─── AUTO-SAVE (lightweight metadata only – real data is in DB) ───
  useEffect(() => {
    if (view !== "editor" || !serverProjectId) return;
    if (!autoSaveEnabled.current) {
      autoSaveEnabled.current = true;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await saveProject({
        serverProjectId,
        activeChapterId: activeChapter,
        conventions,
        view,
      });
      setSaveStatus("saved");
      if (saveIndicatorRef.current) clearTimeout(saveIndicatorRef.current);
      saveIndicatorRef.current = setTimeout(() => setSaveStatus(null), 2500);
    }, 800);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [serverProjectId, activeChapter, conventions, view]);

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
    setActiveReviewRound(1);
    setReviewHistory([]);
    setServerProjectId(null);
    setProcessingStatus("");
    setView("dashboard");
  };

  // Upload step 1 → Settings
  const handleUploadNext = (file, parsedChapters) => {
    setUploadedFile(file);
    setChapters(parsedChapters.map(ch => ({ ...ch, status: "pending" })));
    setView("settings");
  };

  // Settings → Save project to DB → Editor (no forced analysis)
  const handleSettingsDone = async (settings) => {
    setGenres(settings.genres || []);
    setModules(settings.modules || []);
    setTransLangs(settings.transLangs || []);
    if (settings.analysisLevel) setAnalysisLevel(settings.analysisLevel);

    const chaps = chapters;
    setActiveChapter(chaps[0]?.id);

    // Build paragraphs
    const parasMap = {};
    chaps.forEach(ch => { parasMap[ch.id] = splitIntoParagraphs(ch.content); });
    setParagraphsByChapter(parasMap);

    // Create project in DB
    if (isAuthenticated) {
      try {
        const projectData = await apiClient.createProject({
          title: uploadedFile?.name?.replace(/\.[^.]+$/, '') || "Manus",
          genres: settings.genres || [],
          modules: settings.modules || [],
          transLanguages: settings.transLangs || [],
          chapters: chaps.map((ch, idx) => ({
            number: idx + 1, title: ch.title,
            content: ch.content, wordCount: ch.wordCount,
          })),
        });
        if (projectData?.id) {
          const projId = projectData.id;
          setServerProjectId(projId);
          const serverChapters = projectData.project?.chapters || [];
          const updatedChapters = [...chaps];
          const updatedParas = { ...parasMap };
          for (let j = 0; j < serverChapters.length && j < updatedChapters.length; j++) {
            const oldId = updatedChapters[j].id;
            updatedChapters[j] = { ...updatedChapters[j], id: serverChapters[j].id };
            if (updatedParas[oldId]) {
              updatedParas[serverChapters[j].id] = updatedParas[oldId];
              delete updatedParas[oldId];
            }
          }
          setChapters(updatedChapters);
          setParagraphsByChapter(updatedParas);
          setActiveChapter(updatedChapters[0]?.id);
          await saveProject({ serverProjectId: projId, activeChapterId: updatedChapters[0]?.id, conventions, view: "editor" });
        }
      } catch (err) {
        console.error("Failed to create project:", err);
        alert("Kunde inte skapa projekt: " + err.message);
        return;
      }
    }
    setView("editor");
  };

  // ─── LOAD PROJECT FROM SERVER ───
  const handleOpenProject = async (project) => {
    // Show loading state immediately
    setChapters([]);
    setView("editor"); // Guard will show spinner until chapters load
    try {
      const result = await apiClient.getProject(project.id);
      const data = result?.project || result;
      if (!data) {
        console.error("No project data returned for id:", project.id);
        setView("dashboard");
        return;
      }

      setServerProjectId(data.id);
      setUploadedFile({ name: data.title });
      setGenres(data.genres || []);
      setModules(data.modules || []);
      setTransLangs(data.transLanguages || ["en"]);
      setDnaProfile(data.dnaProfile || null);

      // Build paragraphs with suggestions and restore accepted/rejected from DB
      const parasMap = {};
      const restoredAccepted = new Set();
      const restoredRejected = new Set();
      for (const ch of data.chapters || []) {
        const paras = splitIntoParagraphs(ch.content);
        if (ch.suggestions?.length) {
          const enriched = attachSuggestionsToParagraphs(paras, ch.suggestions, ch.id);
          parasMap[ch.id] = enriched;
          ch.suggestions.forEach(s => {
            if (s.status === "ACCEPTED") restoredAccepted.add(s.id);
            else if (s.status === "REJECTED") restoredRejected.add(s.id);
          });
        } else {
          parasMap[ch.id] = paras;
        }
      }

      const loadedChapters = (data.chapters || []).map(ch => ({
        id: ch.id, number: ch.number, title: ch.title,
        content: ch.content, wordCount: ch.wordCount,
        status: ch.suggestions?.length > 0 ? "done" : "pending",
      }));

      if (loadedChapters.length === 0) {
        console.error("Project has no chapters:", data.id);
        setView("dashboard");
        alert("Projektet har inga kapitel.");
        return;
      }

      setChapters(loadedChapters);
      setParagraphsByChapter(parasMap);
      setActiveChapter(loadedChapters[0]?.id);
      setAccepted(restoredAccepted);
      setRejected(restoredRejected);

      // Save session reference to IndexedDB for quick restore
      await saveProject({ serverProjectId: data.id, activeChapterId: loadedChapters[0]?.id, conventions, view: "editor" });
    } catch (err) {
      console.error("Failed to load project:", err);
      setView("dashboard");
      alert("Kunde inte öppna projektet: " + err.message);
    }
  };

  const handleStartProcessing = (settings) => {
    setGenres(settings.genres);
    setModules(settings.modules);
    setTransLangs(settings.transLangs);
    if (settings.analysisLevel) setAnalysisLevel(settings.analysisLevel);
    setView("processing");

    // Build paragraphs from chapters
    const parasMap = {};
    chapters.forEach(ch => {
      parasMap[ch.id] = splitIntoParagraphs(ch.content);
    });
    setParagraphsByChapter(parasMap);

    runProcessing(chapters, parasMap, settings, settings.analysisLevel || "standard");
  };

  const runProcessing = async (chaps, parasMap, settings, level = "standard") => {
    const updatedChapters = [...chaps];
    const updatedParas = { ...parasMap };

    // Step 1: Create project in DB FIRST (so all data is persisted)
    let projId = serverProjectId;
    if (!projId && isAuthenticated) {
      setProcessingStatus("Skapar projekt...");
      try {
        const projectData = await apiClient.createProject({
          title: uploadedFile?.name?.replace(/\.[^.]+$/, '') || "Manus",
          genres: settings.genres || genres,
          modules: settings.modules || modules,
          transLanguages: settings.transLangs || transLangs,
          chapters: updatedChapters.map((ch, idx) => ({
            number: idx + 1,
            title: ch.title,
            content: ch.content,
            wordCount: ch.wordCount,
          })),
        });
        if (projectData?.id) {
          projId = projectData.id;
          setServerProjectId(projId);
          // Update chapter IDs from server (DB-generated IDs)
          const serverChapters = projectData.project?.chapters || [];
          for (let j = 0; j < serverChapters.length && j < updatedChapters.length; j++) {
            const oldId = updatedChapters[j].id;
            updatedChapters[j] = { ...updatedChapters[j], id: serverChapters[j].id };
            // Migrate paragraphs to new ID
            if (updatedParas[oldId]) {
              updatedParas[serverChapters[j].id] = updatedParas[oldId];
              delete updatedParas[oldId];
            }
          }
          setChapters([...updatedChapters]);
          setParagraphsByChapter({ ...updatedParas });
        }
      } catch (err) {
        console.error("Failed to create project:", err);
        setProcessingStatus("Kunde inte skapa projekt. Kontrollera anslutningen.");
        return;
      }
    }

    // Save metadata to IndexedDB for quick restore
    await saveProject({ serverProjectId: projId, activeChapterId: updatedChapters[0]?.id, conventions, view: "editor" });

    // Step 2: Generate DNA profile FIRST (analyzes entire manuscript)
    let dnaGenerated = false;
    if (projId) {
      setProcessingStatus("Bygger språklig DNA-profil (analyserar hela manuset)...");
      try {
        const dnaResult = await apiClient.generateDNAProfile(projId);
        if (dnaResult?.dnaProfile) {
          setDnaProfile(dnaResult.dnaProfile);
          dnaGenerated = true;
        }
      } catch (err) {
        console.error("DNA profile failed:", err);
      }
    }

    // Fallback DNA if API didn't work
    if (!dnaGenerated) {
      const allText = chaps.map(c => c.content).join(" ");
      const words = allText.split(/\s+/);
      const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgLen = sentences.length > 0 ? Math.round((words.length / sentences.length) * 10) / 10 : 0;
      setDnaProfile({
        avgSentenceLen: avgLen, shortLongRatio: "—", dominantImagery: "—",
        dialogStyle: "—", favoriteWords: findFrequentWords(allText),
        tonality: "—", perspective: "—", tense: "—",
      });
    }

    if (abortProcessingRef.current) {
      abortProcessingRef.current = false;
      setProcessingStatus("");
      setView("editor");
      return;
    }

    // Step 3: Review each chapter via backend API (with DNA available)
    let skipped = 0;
    let sentToEditor = false;
    const failedChapterIndices = [];
    for (let i = 0; i < updatedChapters.length; i++) {
      if (abortProcessingRef.current) {
        abortProcessingRef.current = false;
        break;
      }
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
      setProcessingStatus(`Granskar ${updatedChapters[i].title} (${i + 1 - skipped}/${updatedChapters.length - skipped})...`);

      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            const wait = Math.pow(2, attempt) * 5000;
            setProcessingStatus(`Bearbetar ${updatedChapters[i].title}... (försök ${attempt + 1})`);
            await new Promise(r => setTimeout(r, wait));
          }

          // Use backend API – suggestions are saved to DB automatically
          const result = await apiClient.reviewChapter(updatedChapters[i].id, projId, level || 'standard');
          const suggestions = result?.suggestions || [];

          if (suggestions.length > 0) {
            const chapterParas = updatedParas[updatedChapters[i].id] || splitIntoParagraphs(updatedChapters[i].content);
            const enrichedParas = attachSuggestionsToParagraphs(chapterParas, suggestions, updatedChapters[i].id);
            updatedParas[updatedChapters[i].id] = enrichedParas;
            setParagraphsByChapter({ ...updatedParas });
          }
          success = true;
        } catch (err) {
          const status = err?.response?.status || err?.status || '';
          const msg = err?.response?.data?.error || err?.message || 'Okänt fel';
          console.error(`[Review] ${updatedChapters[i].title} försök ${attempt + 1}/3: ${status} ${msg}`, err);
          if (attempt === 2) {
            failedChapterIndices.push(i);
          }
        }
      }

      // Only mark as done if review succeeded
      if (success) {
        updatedChapters[i] = { ...updatedChapters[i], status: "done" };
      } else {
        updatedChapters[i] = { ...updatedChapters[i], status: "pending" };
      }
      setChapters([...updatedChapters]);

      // Switch to editor after first analyzed chapter
      if (success && (i === 0 || (i === skipped && !sentToEditor))) {
        setView("editor");
        setActiveChapter(updatedChapters[i].id);
        sentToEditor = true;
      }

      // Pause between chapters for rate limiting
      if (i < updatedChapters.length - 1) {
        const pauseMs = 3000;
        setProcessingStatus(`Förbereder nästa kapitel... (${i + 2 - skipped}/${updatedChapters.length - skipped})`);
        await new Promise(r => setTimeout(r, pauseMs));
      }
    }

    // Step 4: Auto-retry failed chapters
    if (failedChapterIndices.length > 0 && !abortProcessingRef.current) {
      setProcessingStatus(`Omanalyserar ${failedChapterIndices.length} missade kapitel...`);
      await new Promise(r => setTimeout(r, 5000));

      for (let fi = 0; fi < failedChapterIndices.length; fi++) {
        if (abortProcessingRef.current) {
          abortProcessingRef.current = false;
          break;
        }
        const idx = failedChapterIndices[fi];
        updatedChapters[idx] = { ...updatedChapters[idx], status: "active" };
        setChapters([...updatedChapters]);
        setProcessingStatus(`Omanalyserar ${updatedChapters[idx].title} (${fi + 1}/${failedChapterIndices.length})...`);

        let retrySuccess = false;
        let lastError = null;
        for (let attempt = 0; attempt < 3 && !retrySuccess; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 5000));
            }
            const result = await apiClient.reviewChapter(updatedChapters[idx].id, projId, level || 'standard');
            const suggestions = result?.suggestions || [];
            if (suggestions.length > 0) {
              const chapterParas = updatedParas[updatedChapters[idx].id] || splitIntoParagraphs(updatedChapters[idx].content);
              const enrichedParas = attachSuggestionsToParagraphs(chapterParas, suggestions, updatedChapters[idx].id);
              updatedParas[updatedChapters[idx].id] = enrichedParas;
              setParagraphsByChapter({ ...updatedParas });
            }
            retrySuccess = true;
          } catch (err) {
            lastError = err;
            const status = err?.response?.status || err?.status || '';
            const msg = err?.response?.data?.error || err?.message || 'Okänt fel';
            console.error(`[Retry] ${updatedChapters[idx].title} försök ${attempt + 1}/3 misslyckades: ${status} ${msg}`, err);
          }
        }

        if (!retrySuccess) {
          const errorMsg = lastError?.response?.data?.error || lastError?.message || 'Okänt fel';
          console.error(`[Review] ${updatedChapters[idx].title} misslyckades slutgiltigt efter 6 försök (3+3): ${errorMsg}`);
        }
        updatedChapters[idx] = { ...updatedChapters[idx], status: retrySuccess ? "done" : "error", errorMessage: retrySuccess ? undefined : (lastError?.response?.data?.error || lastError?.message || 'Granskning misslyckades') };
        setChapters([...updatedChapters]);

        if (fi < failedChapterIndices.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    setActiveChapter(updatedChapters[0]?.id);
    setProcessingStatus("Klart!");
    await new Promise(r => setTimeout(r, 600));
    setView("editor");
  };

  // Re-analyze a single chapter
  const [reanalyzingChapter, setReanalyzingChapter] = useState(null);
  const handleReanalyzeChapter = async (chapterId, level = null) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter || reanalyzingChapter) return;

    const analysisLevel = level || analysisLevelRef.current || "basic";
    setReanalyzingChapter(chapterId);
    setProcessingStatus(`Analyserar ${chapter.title}...`);

    const freshParas = splitIntoParagraphs(chapter.content);

    // Mark as active
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: "active" } : c));

    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        if (attempt > 0) {
          setProcessingStatus(`Bearbetar ${chapter.title}... (försök ${attempt + 1})`);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 5000));
        }
        // Use multi-pass backend API
        const result = await apiClient.reviewChapterMulti(chapterId, serverProjectId, analysisLevel);
        const suggestions = result?.suggestions || [];

        // Update DNA profile if returned
        if (result?.dnaProfile) setDnaProfile(result.dnaProfile);

        // Restore accepted/rejected state from DB status
        const restoredAccepted = new Set(accepted);
        const restoredRejected = new Set(rejected);
        for (const s of suggestions) {
          if (s.status === "ACCEPTED") restoredAccepted.add(s.id);
          if (s.status === "REJECTED") restoredRejected.add(s.id);
        }
        setAccepted(restoredAccepted);
        setRejected(restoredRejected);

        if (suggestions.length > 0) {
          const enrichedParas = attachSuggestionsToParagraphs(freshParas, suggestions, chapterId);
          setParagraphsByChapter(prev => ({ ...prev, [chapterId]: enrichedParas }));
        } else {
          setParagraphsByChapter(prev => ({ ...prev, [chapterId]: freshParas }));
        }

        success = true;
      } catch (err) {
        lastError = err.message;
        console.error(`Re-analyze failed (attempt ${attempt + 1}):`, err);
      }
    }

    if (!success && lastError) {
      const shortError = lastError.length > 80 ? lastError.slice(0, 80) + '...' : lastError;
      setProcessingStatus(`❌ ${chapter.title}: Analysen misslyckades – ${shortError}`);
      await new Promise(r => setTimeout(r, 5000));
    }

    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status: success ? "done" : "error" } : c));
    setProcessingStatus("");
    setReanalyzingChapter(null);
  };

  // Ref to track current analysis level (avoids stale closures)
  const analysisLevelRef = useRef(analysisLevel);
  useEffect(() => { analysisLevelRef.current = analysisLevel; }, [analysisLevel]);

  // Split chapter at a paragraph boundary
  // ─── ANALYZE ALL UNREVIEWED CHAPTERS ───
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const handleAnalyzeUnreviewed = async () => {
    if (batchAnalyzing) return;
    setBatchAnalyzing(true);

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
      if (abortProcessingRef.current) {
        abortProcessingRef.current = false;
        break;
      }
      const ch = unreviewed[i];
      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: "active" } : c));
      setProcessingStatus(`Analyserar ${ch.title} (${i + 1}/${unreviewed.length})...`);

      let paras = paragraphsByChapter[ch.id];
      if (!paras || paras.length === 0) {
        paras = splitIntoParagraphs(ch.content);
        setParagraphsByChapter(prev => ({ ...prev, [ch.id]: paras }));
      }

      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            setProcessingStatus(`Bearbetar ${ch.title}... (försök ${attempt + 1})`);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 5000));
          }

          // Use multi-pass backend API
          const result = await apiClient.reviewChapterMulti(ch.id, serverProjectId, analysisLevelRef.current || "basic");
          const suggestions = result?.suggestions || [];
          if (result?.dnaProfile && !dnaProfile) setDnaProfile(result.dnaProfile);

          if (suggestions.length > 0) {
            const enrichedParas = attachSuggestionsToParagraphs(paras, suggestions, ch.id);
            setParagraphsByChapter(prev => ({ ...prev, [ch.id]: enrichedParas }));
          }
          success = true;
        } catch (err) {
          console.error(`Batch review failed for ${ch.title} (attempt ${attempt + 1}):`, err);
          if (attempt === 2) {
            setProcessingStatus(`${ch.title} hoppades över – analyseras vid nästa genomgång`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: "done" } : c));

      // 3 second pause between chapters
      if (i < unreviewed.length - 1) {
        setProcessingStatus(`Paus innan ${unreviewed[i + 1].title}... (${i + 2}/${unreviewed.length})`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setProcessingStatus("");
    setBatchAnalyzing(false);
  };

  // ─── RE-REVIEW: New analysis pass on updated text ───
  const [reReviewing, setReReviewing] = useState(false);
  const [showReReviewModal, setShowReReviewModal] = useState(false);
  const [reReviewLevel, setReReviewLevel] = useState(analysisLevel || "standard");
  const [reReviewSelectedChapters, setReReviewSelectedChapters] = useState(new Set()); // empty = all
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const handleReReview = async (level) => {
    if (reReviewing || batchAnalyzing) return;
    setShowReReviewModal(false);
    setReReviewing(true);
    const useLevel = level || reReviewLevel;

    // Archive current review round (only if there are existing suggestions)
    const currentRoundSuggestions = [];
    for (const ch of chapters) {
      const paras = paragraphsByChapter[ch.id] || [];
      for (const p of paras) {
        for (const s of (p.suggestions || [])) {
          currentRoundSuggestions.push({
            ...s,
            chapterId: ch.id,
            chapterTitle: ch.title,
            status: accepted.has(s.id) ? "accepted" : rejected.has(s.id) ? "rejected" : "pending",
          });
        }
      }
    }

    const isFirstReview = currentRoundSuggestions.length === 0 && reviewHistory.length === 0;

    if (!isFirstReview) {
      setReviewHistory(prev => [...prev, {
        round: activeReviewRound,
        date: new Date().toISOString(),
        suggestions: currentRoundSuggestions,
        totalCount: currentRoundSuggestions.length,
        acceptedCount: currentRoundSuggestions.filter(s => s.status === "accepted").length,
        rejectedCount: currentRoundSuggestions.filter(s => s.status === "rejected").length,
      }]);

      setActiveReviewRound(prev => prev + 1);
    }

    // Clear old suggestions but keep accepted changes applied to content
    const clearedParas = {};
    for (const ch of chapters) {
      const paras = paragraphsByChapter[ch.id] || [];
      clearedParas[ch.id] = paras.map(p => ({ ...p, suggestions: [] }));
    }
    setParagraphsByChapter(clearedParas);
    setAccepted(new Set());
    setRejected(new Set());
    setActiveSuggestion(null);

    // Re-run analysis on selected chapters (or all if none selected)
    const chaptersToReview = reReviewSelectedChapters.size > 0
      ? chapters.filter(c => reReviewSelectedChapters.has(c.id))
      : chapters;
    setReReviewSelectedChapters(new Set());

    // Mark chapters to review as pending
    setChapters(prev => prev.map(c =>
      chaptersToReview.some(cr => cr.id === c.id) ? { ...c, status: "pending" } : c
    ));

    for (let i = 0; i < chaptersToReview.length; i++) {
      if (abortProcessingRef.current) {
        abortProcessingRef.current = false;
        break;
      }
      const ch = chaptersToReview[i];
      const chIdx = chapters.indexOf(ch);
      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: "active" } : c));
      const displayRound = isFirstReview ? 1 : activeReviewRound + 1;
      setProcessingStatus(`Granskning ${displayRound}: Kapitel ${chIdx + 1} (${i + 1}/${chaptersToReview.length})...`);


      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            setProcessingStatus(`Bearbetar Kapitel ${chIdx + 1}... (försök ${attempt + 1})`);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 5000));
          }

          // Use backend API – suggestions saved to DB automatically
          const result = await apiClient.reviewChapter(ch.id, serverProjectId, useLevel || 'standard');
          const suggestions = result?.suggestions || [];

          if (suggestions.length > 0) {
            const paras = clearedParas[ch.id] || splitIntoParagraphs(ch.content);
            const enriched = attachSuggestionsToParagraphs(paras, suggestions, ch.id);
            clearedParas[ch.id] = enriched;
            setParagraphsByChapter({ ...clearedParas });
          }
          success = true;
        } catch (err) {
          console.error(`Re-review failed for Kapitel ${chIdx + 1}:`, err);
          if (attempt === 2) {
            setProcessingStatus(`Kapitel ${chIdx + 1} hoppades över – analyseras vid nästa genomgång`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      // Mark as reviewed (not "done" yet — wait until all chapters are complete)
      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, status: success ? "reviewed" : "pending" } : c));

      if (i < chaptersToReview.length - 1) {

        setProcessingStatus(`Förbereder nästa kapitel...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // All chapters processed — now mark reviewed chapters as done
    setChapters(prev => prev.map(c => c.status === "reviewed" ? { ...c, status: "done" } : c));
    setProcessingStatus("");
    setReReviewing(false);
  };

  const handleAbortProcessing = () => {
    abortProcessingRef.current = true;
    setBatchAnalyzing(false);
    setReReviewing(false);
    setProcessingStatus("");
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
    const normS = s => s.replace(/\s+/g, ' ').trim();

    const flashElement = (el, color = "#a0522d30", duration = 1500) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background 0.3s, outline 0.3s";
      el.style.background = color;
      el.style.outline = "2px solid #a0522d40";
      el.style.outlineOffset = "4px";
      el.style.borderRadius = "4px";
      setTimeout(() => { el.style.background = "transparent"; el.style.outline = "none"; }, duration);
    };

    // 1. Try inline highlight first (exact match already rendered)
    let el = mainRef.current.querySelector(`[data-suggestion-id="${activeSuggestion}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background 0.15s";
      const orig = el.style.background;
      el.style.background = "#a0522d30";
      setTimeout(() => { el.style.background = orig; }, 800);
      return;
    }

    // 2. Try paragraph that owns this suggestion
    const paraEl = mainRef.current.querySelector(`[data-para-suggestion-ids*="${activeSuggestion}"]`);
    if (paraEl) { flashElement(paraEl); return; }

    // 3. Search for original text across all visible paragraphs
    const paras = paragraphsByChapter[activeChapter] || [];
    const sugg = paras.flatMap(p => p.suggestions || []).find(s => s.id === activeSuggestion);
    if (sugg?.original) {
      const normOrig = normS(sugg.original);
      // Find the paragraph element containing this text
      const allParaEls = mainRef.current.querySelectorAll("[data-para-id]");
      for (const pEl of allParaEls) {
        if (normS(pEl.textContent).includes(normOrig) || normOrig.includes(normS(pEl.textContent).slice(0, 50))) {
          flashElement(pEl, "#a0522d18");
          return;
        }
      }
      // 4. Last resort: search with shorter prefix (first 40 chars)
      const shortOrig = normOrig.slice(0, 40);
      for (const pEl of allParaEls) {
        if (normS(pEl.textContent).includes(shortOrig)) {
          flashElement(pEl, "#a0522d12");
          return;
        }
      }
    }
  }, [activeSuggestion, activeChapter, paragraphsByChapter]);

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

  // ─── BAKE IN: apply text replacement to chapter content + save to DB ───
  // Uses setChapters(prev => ...) to always read CURRENT state (no stale closures)
  // Helper: fuzzy replace (handles whitespace differences between AI original and actual text)
  const fuzzyReplaceInText = (text, original, replacement) => {
    const normS = s => s.replace(/\s+/g, ' ').trim();
    // Exact match
    if (text.includes(original)) return text.replace(original, replacement);
    // Normalized match: find position in normalized string, map back to original
    const normText = normS(text);
    const normOrig = normS(original);
    const normIdx = normText.indexOf(normOrig);
    if (normIdx === -1) return null;
    // Map normalized index back to original text position
    let origStart = -1, origEnd = -1, ni = 0, ti = 0;
    // Skip leading whitespace in original text
    while (ti < text.length && /\s/.test(text[ti]) && ni === 0) ti++;
    while (ti <= text.length && ni <= normIdx + normOrig.length) {
      if (ni === normIdx && origStart === -1) origStart = ti;
      if (ni === normIdx + normOrig.length) { origEnd = ti; break; }
      if (ti >= text.length) break;
      if (/\s/.test(text[ti])) {
        while (ti < text.length && /\s/.test(text[ti])) ti++;
        ni++;
      } else {
        ti++; ni++;
      }
    }
    if (origEnd === -1) origEnd = text.length;
    if (origStart === -1) return null;
    return text.slice(0, origStart) + replacement + text.slice(origEnd);
  };

  const applyReplacementToContent = (chapterId, originalText, replacementText) => {
    // Safety: if replacement text already exists in the chapter, skip (prevent duplication)
    let savedContent = null;

    setChapters(prev => {
      const ch = prev.find(c => c.id === chapterId);
      if (!ch) return prev;
      // If replacement already exists in text, skip (prevent double-application)
      const normCheck = s => s.replace(/\s+/g, ' ').trim();
      if (replacementText && normCheck(ch.content).includes(normCheck(replacementText)) && normCheck(originalText) !== normCheck(replacementText)) {
        return prev;
      }
      const newContent = fuzzyReplaceInText(ch.content, originalText, replacementText);
      if (!newContent || newContent === ch.content) {
        console.warn("[Bake-in] Could not find original text in chapter:", originalText.slice(0, 80));
        return prev;
      }
      savedContent = newContent;
      return prev.map(c => c.id === chapterId ? { ...c, content: newContent, wordCount: countWords(newContent) } : c);
    });

    // After chapter content updated, also refresh paragraphs to keep para.text in sync
    setTimeout(() => {
      if (savedContent) {
        // Rebuild paragraphs from new content, preserving suggestions
        const newParas = splitIntoParagraphs(savedContent);
        const oldParas = paragraphsByChapter[chapterId] || [];
        const enriched = newParas.map(np => {
          // Match by text similarity — find closest old paragraph
          const exact = oldParas.find(op => op.text === np.text);
          if (exact?.suggestions?.length) return { ...np, suggestions: exact.suggestions };
          // Fuzzy: check if old paragraph text is a substring or vice versa
          const fuzzy = oldParas.find(op => np.text.includes(op.text?.substring(0, 40)) || op.text?.includes(np.text.substring(0, 40)));
          if (fuzzy?.suggestions?.length) return { ...np, suggestions: fuzzy.suggestions };
          return np;
        });
        setParagraphsByChapter(prev => ({ ...prev, [chapterId]: enriched }));

        if (serverProjectId) {
          apiClient.updateChapter(chapterId, { content: savedContent })
            .catch(e => {
              console.error("[Bake-in] DB save failed:", e);
              setSaveStatus("error");
            });
        }
      } else {
        console.warn("[Bake-in] No content saved — replacement not applied");
      }
    }, 0);
  };

  // Batch version: apply multiple replacements in ONE state update
  const applyBatchReplacements = (chapterId, replacements) => {
    let savedContent = null;

    setChapters(prev => {
      const ch = prev.find(c => c.id === chapterId);
      if (!ch) return prev;
      let content = ch.content;
      let applied = 0;
      for (const { original, replacement } of replacements) {
        if (!original || !replacement) continue;
        const result = fuzzyReplaceInText(content, original, replacement);
        if (result && result !== content) {
          content = result;
          applied++;
        } else {
          console.warn("[Batch bake-in] Could not find:", original.slice(0, 60));
        }
      }
      if (content === ch.content) return prev;
      savedContent = content;
      return prev.map(c => c.id === chapterId ? { ...c, content, wordCount: countWords(content) } : c);
    });

    setTimeout(() => {
      if (savedContent && serverProjectId) {
        apiClient.updateChapter(chapterId, { content: savedContent })
          .catch(e => {
            console.error("[Batch bake-in] DB save failed:", e);
            setSaveStatus("error");
          });
      }
    }, 0);
  };

  // ─── GET EFFECTIVE TEXT (with accepted replacements applied) ───
  const getEffectiveText = (para) => {
    if (!para?.suggestions?.length) return para?.text || "";
    let text = para.text;
    // Apply accepted replacements — use same findInText as renderText for consistency
    const acceptedSuggestions = (para.suggestions || []).filter(s => accepted.has(s.id) && s.original && s.replacement);
    if (acceptedSuggestions.length === 0) return text;
    // Sort by position (reverse) to apply from end to start
    const withPos = acceptedSuggestions.map(s => {
      const match = findInText(text, s.original);
      return { s, match };
    }).filter(x => x.match).sort((a, b) => b.match.idx - a.match.idx);
    for (const { s, match } of withPos) {
      text = text.slice(0, match.idx) + s.replacement + text.slice(match.idx + match.len);
    }
    return text;
  };


  // ─── EDIT PARAGRAPH ───
  const handleEditParagraph = (paraId, text, involvedParaIds = null) => {
    setEditModal({
      text,
      paraId,
      involvedParaIds, // track all paragraphs involved in multi-para selection
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

    // Split edited text on double newlines (user may have added paragraph breaks)
    const newParts = newText.split(/\n\s*\n/).map(t => t.trim()).filter(t => t.length > 0);

    if (newParts.length <= 1) {
      // Simple case: single paragraph — update text, clear baked-in accepted suggestions
      const cleanedSuggestions = (paras[idx].suggestions || []).filter(s => !accepted.has(s.id));
      paras[idx] = { ...paras[idx], text: newParts[0] || newText.trim(), suggestions: cleanedSuggestions };
    } else {
      // User created multiple paragraphs in the editor — split into N paragraphs
      const newParas = newParts.map((text, i) => ({
        id: i === 0 ? paras[idx].id : `p${Date.now()}_${i}`,
        text,
        suggestions: i === 0 ? (paras[idx].suggestions || []).filter(s => !accepted.has(s.id)) : [],
      }));
      paras.splice(idx, 1, ...newParas);
    }

    setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: paras }));

    // Rebuild and save chapter content
    const newContent = paras.map(p => p.text).join("\n\n");
    setChapters(prev => prev.map(ch =>
      ch.id === activeChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
    ));

    // Persist to DB
    apiClient.updateChapter(activeChapter, { content: newContent }).catch(err =>
      console.error("Failed to save chapter to DB:", err)
    );
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
  const [showHandled, setShowHandled] = useState(false);
  // Default: only show pending suggestions. Toggle to see handled ones too.
  const filtered = allSuggestions
    .map((s, idx) => ({ ...s, _textOrder: idx }))
    .filter(s => {
      const isHandled = accepted.has(s.id) || rejected.has(s.id);
      if (!showHandled && isHandled) return false;
      return filterPriority === "all" || s.priority === filterPriority;
    })
    .sort((a, b) => {
      const aHandled = accepted.has(a.id) || rejected.has(a.id) ? 1 : 0;
      const bHandled = accepted.has(b.id) || rejected.has(b.id) ? 1 : 0;
      if (aHandled !== bHandled) return aHandled - bHandled; // pending first
      return a._textOrder - b._textOrder; // preserve text order within group

    });
  const pendingCount = allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length;
  const handledCount = allSuggestions.length - pendingCount;

  // Global: count ALL suggestions across ALL chapters
  const globalAllSuggestions = Object.values(paragraphsByChapter).flatMap(paras => paras.flatMap(p => p.suggestions || []));
  const globalPendingCount = globalAllSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length;
  const allChaptersReviewed = chapters.length > 0 && chapters.every(ch => {
    const paras = paragraphsByChapter[ch.id] || [];
    return paras.some(p => p.suggestions?.length > 0);
  });
  const manuscriptFullyHandled = allChaptersReviewed && globalPendingCount === 0 && globalAllSuggestions.length > 0;

  // Show completion modal when all suggestions are handled
  const prevPendingRef = useRef(globalPendingCount);
  useEffect(() => {
    if (prevPendingRef.current > 0 && globalPendingCount === 0 && manuscriptFullyHandled && !reReviewing && !batchAnalyzing) {
      setShowCompletionModal(true);
    }
    prevPendingRef.current = globalPendingCount;
  }, [globalPendingCount, manuscriptFullyHandled, reReviewing, batchAnalyzing]);

  // ─── RENDER ───

  // Auth loading spinner (only while auth is settling)
  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: bg, fontFamily: uiFont }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 13, color: muted }}>Laddar...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  // Not authenticated → show landing page
  if (!isAuthenticated) return (
    <LandingPage onLogin={login} onRegister={register} />
  );

  // Dashboard (also handles "loading" state after auth is settled)
  if (view === "dashboard" || view === "loading") return (
    <DashboardView
      key={view}
      user={user}
      onOpenProject={handleOpenProject}
      onNewProject={() => setView("upload")}
      onLogout={async () => { await logout(); setView("loading"); }}
      onProfile={() => setView("profile")}
      onAdmin={() => setView("admin")}
    />
  );

  // Admin
  if (view === "admin" && user?.role === "SUPER_ADMIN") return (
    <SuperAdminView user={user} onBack={() => setView("profile")} onDashboard={() => setView("dashboard")} />
  );

  // Profile
  if (view === "profile") return (
    <ProfileView user={user} onBack={() => setView("dashboard")} onAdmin={() => setView("admin")} onLogout={async () => { await logout(); setView("loading"); }} />
  );

  if (view === "upload") return <OnboardingUpload onNext={handleUploadNext} />;
  if (view === "settings") return <OnboardingSettings fileName={uploadedFile?.name} chapterCount={chapters.length} totalWords={chapters.reduce((s, c) => s + c.wordCount, 0)} onStart={handleSettingsDone} onBack={() => setView("upload")} />;
  if (view === "processing") return <ProcessingView chapters={chapters} statusText={processingStatus} onAbort={handleAbortProcessing} />;
  if (view === "pricing") return <PricingPage onBack={() => setView("editor")} />;

  // Guard: if editor view but no chapters loaded, show loading or fallback to dashboard
  if (view === "editor" && chapters.length === 0) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: bg, flexDirection: "column", gap: 16 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${border}`, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>Laddar manus...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <button onClick={() => setView("dashboard")} style={{
        fontFamily: uiFont, fontSize: 11, padding: "6px 16px", borderRadius: 7,
        border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", marginTop: 8,
      }}>← Tillbaka till dashboard</button>
    </div>
  );

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

  // Find s.original in text, falling back to normalized/fuzzy matching.
  // Returns { idx, len } where idx is position in text and len is the actual matched length in text.

  const extractSearchTerms = (original) => {
    if (!original) return [];
    const terms = [];
    terms.push(original.trim());
    const sentences = original.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length >= 8);
    for (const s of sentences) terms.push(s);
    if (original.includes('...')) {
      const parts = original.split(/\.{2,}/).map(s => s.trim()).filter(s => s.length >= 3);
      for (const p of parts) terms.push(p);
    }
    const words = original.replace(/[.!?,;:–—]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length >= 15) terms.push(phrase);
    }
    return [...new Set(terms)];
  };

  const findAllTermOccurrences = (chapterContent, terms) => {
    if (!chapterContent || !terms.length) return [];
    const results = [];
    for (const term of terms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let m;
      while ((m = regex.exec(chapterContent)) !== null) {
        results.push({ term, index: m.index, length: m[0].length, text: m[0] });
      }
    }
    results.sort((a, b) => a.index - b.index);
    const deduped = [];
    for (const r of results) {
      const last = deduped[deduped.length - 1];
      if (last && r.index < last.index + last.length) continue;
      deduped.push(r);
    }
    return deduped;
  };

  const navigateToTermOccurrence = (suggestionId, terms, occIdx) => {
    const chapter = chapters.find(c => c.id === activeChapter);
    if (!chapter) return;
    let occs = findAllTermOccurrences(chapter.content, terms);
    if (occs.length === 0 && terms.length > 0) {
      const match = findInText(chapter.content, terms[0]);
      if (match) occs = [{ term: terms[0], index: match.idx, length: match.len, text: chapter.content.slice(match.idx, match.idx + match.len) }];
    }
    if (occs.length === 0 && terms.length > 0) {
      const paras = currentParagraphs;
      const chContent = chapter.content || "";
      let searchFrom = 0;
      for (const para of paras) {
        const pText = para.text || '';
        const paraStart = chContent.indexOf(pText, searchFrom);
        const globalOffset = paraStart >= 0 ? paraStart : searchFrom;
        const match = findInText(pText, terms[0]);
        if (match) { occs = [{ term: terms[0], index: globalOffset + match.idx, length: match.len, text: pText.slice(match.idx, match.idx + match.len) }]; break; }
        searchFrom = globalOffset + pText.length;
      }
    }
    if (occs.length === 0) return;
    const idx = Math.min(occIdx, occs.length - 1);
    setHighlightTermState({ suggestionId, occurrenceIdx: idx, terms, occurrences: occs });
    setTimeout(() => {
      const el = mainRef.current?.querySelector(`[data-term-highlight="${suggestionId}-${idx}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      else {
        const searchText = occs[idx]?.text || terms[0];
        const walker = document.createTreeWalker(mainRef.current, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.textContent.includes(searchText.substring(0, 30))) { node.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" }); break; }
        }
      }
    }, 80);
  };

  const findInText = (text, original, fromIndex = 0) => {
    // Exact match
    const exact = text.indexOf(original, fromIndex);
    if (exact !== -1) return { idx: exact, len: original.length };
    // Normalized match: collapse whitespace in both and map back
    const norm = (s) => s.replace(/\s+/g, ' ');
    const origNorm = norm(original);
    const textNorm = norm(text);
    const mapNormToReal = (normTarget) => {
      let realIdx = 0, normPos = 0;
      while (normPos < normTarget && realIdx < text.length) {
        if (/\s/.test(text[realIdx]) && realIdx > 0 && /\s/.test(text[realIdx - 1])) { realIdx++; continue; }
        realIdx++; normPos++;
      }
      return realIdx;
    };
    const mapNormRange = (normStart, normLen) => {
      const realIdx = mapNormToReal(normStart);
      let realEnd = realIdx, normEnd = normStart;
      while (normEnd < normStart + normLen && realEnd < text.length) {
        if (/\s/.test(text[realEnd]) && realEnd > realIdx && /\s/.test(text[realEnd - 1])) { realEnd++; continue; }
        realEnd++; normEnd++;
      }
      return { idx: realIdx, len: realEnd - realIdx };
    };
    const normFrom = fromIndex > 0 ? norm(text.slice(0, fromIndex)).length : 0;
    const normIdx = textNorm.indexOf(origNorm, normFrom);
    if (normIdx !== -1) return mapNormRange(normIdx, origNorm.length);
    // Prefix match: only for actual text excerpts (not patterns like "obehag... obehagliga")
    const looksLikeExcerpt = !original.includes('...') && original.length > 60;
    if (looksLikeExcerpt) {
      const prefix = norm(original.substring(0, 50)).trim();
      if (prefix.length > 15) {
        const prefIdx = textNorm.indexOf(prefix, normFrom);
        if (prefIdx !== -1) {
          const realIdx = mapNormToReal(prefIdx);
          return { idx: realIdx, len: Math.min(prefix.length + 10, text.length - realIdx) };
        }
      }
    }
    // Case-insensitive fallback
    const textLower = textNorm.toLowerCase();
    const origLower = origNorm.toLowerCase();
    const ciIdx = textLower.indexOf(origLower, normFrom);
    if (ciIdx !== -1) return mapNormRange(ciIdx, origLower.length);
    // Punctuation-stripped fallback: ignore quotes, dashes, ellipsis differences
    const stripPunct = (s) => s.replace(/[""''«»\-–—….,;:!?()[\]{}]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const textStripped = stripPunct(text);
    const origStripped = stripPunct(original);
    if (origStripped.length > 10) {
      const stripIdx = textStripped.indexOf(origStripped);
      if (stripIdx !== -1) {
        let realIdx = 0, strippedPos = 0;
        while (strippedPos < stripIdx && realIdx < text.length) {
          const ch = text[realIdx];
          if (/[""''«»\-–—….,;:!?()[\]{}]/.test(ch)) { realIdx++; continue; }
          if (/\s/.test(ch) && realIdx > 0 && /\s/.test(text[realIdx - 1])) { realIdx++; continue; }
          realIdx++; strippedPos++;
        }
        let realEnd = realIdx, strippedEnd = stripIdx;
        while (strippedEnd < stripIdx + origStripped.length && realEnd < text.length) {
          const ch = text[realEnd];
          if (/[""''«»\-–—….,;:!?()[\]{}]/.test(ch)) { realEnd++; continue; }
          if (/\s/.test(ch) && realEnd > realIdx && /\s/.test(text[realEnd - 1])) { realEnd++; continue; }
          realEnd++; strippedEnd++;
        }
        return { idx: realIdx, len: realEnd - realIdx };
      }
      // Stripped prefix fallback
      const strippedPrefix = origStripped.substring(0, 40);
      if (strippedPrefix.length > 15) {
        const prefStripIdx = textStripped.indexOf(strippedPrefix);
        if (prefStripIdx !== -1) {
          let realIdx = 0, strippedPos = 0;
          while (strippedPos < prefStripIdx && realIdx < text.length) {
            const ch = text[realIdx];
            if (/[""''«»\-–—….,;:!?()[\]{}]/.test(ch)) { realIdx++; continue; }
            if (/\s/.test(ch) && realIdx > 0 && /\s/.test(text[realIdx - 1])) { realIdx++; continue; }
            realIdx++; strippedPos++;
          }
          return { idx: realIdx, len: Math.min(original.length + 20, text.length - realIdx) };
        }
      }
    }
    return null;
  };

  const renderText = (para, paraGlobalOffset = 0) => {

    const { text, suggestions } = para;

    // Helper: apply search highlights to a text fragment
    // Uses searchState.matches (which reference chapter.content offsets) mapped to paragraph text
    const applySearchHighlights = (fragment, keyPrefix, globalStart) => {
      if (!searchState || !fragment || !searchState.query || !searchState.matches?.length) return renderFormatted(fragment, keyPrefix);
      const { activeMatchIdx: sIdx, matches: chapterMatches } = searchState;
      const fragEnd = globalStart + fragment.length;
      // Find which chapter-level matches fall within this fragment
      const fragMatches = [];
      for (let mi = 0; mi < chapterMatches.length; mi++) {
        const m = chapterMatches[mi];
        // Check if match overlaps with this fragment (using tolerance for offset drift)
        const mEnd = m.index + m.length;
        // Try direct: match falls within fragment's global range
        if (m.index >= globalStart - 2 && mEnd <= fragEnd + 2) {
          const localIdx = Math.max(0, m.index - globalStart);
          const localEnd = Math.min(fragment.length, mEnd - globalStart);
          if (localIdx < fragment.length && localEnd > localIdx) {
            fragMatches.push({ localIdx, length: localEnd - localIdx, matchNum: mi });
          }
        }
      }
      if (fragMatches.length === 0) return renderFormatted(fragment, keyPrefix);
      const parts = [];
      let pos = 0;
      for (const fm of fragMatches) {
        if (fm.localIdx > pos) parts.push(<span key={`${keyPrefix}s${pos}`}>{renderFormatted(fragment.slice(pos, fm.localIdx), `${keyPrefix}s${pos}`)}</span>);
        const isActive = fm.matchNum === sIdx;
        parts.push(
          <mark key={`${keyPrefix}sm${fm.matchNum}`}
            data-search-match={fm.matchNum}
            style={{
              background: isActive ? "#e8a83880" : "#e8a83830",
              borderBottom: isActive ? "2px solid #c87000" : "1px solid #c8700060",
              padding: "1px 2px", borderRadius: 3,
              outline: isActive ? "2px solid #c8700050" : "none", outlineOffset: 1,
            }}>
            {renderFormatted(fragment.slice(fm.localIdx, fm.localIdx + fm.length), `${keyPrefix}sm${fm.matchNum}`)}
          </mark>
        );
        pos = fm.localIdx + fm.length;
      }
      if (pos < fragment.length) parts.push(<span key={`${keyPrefix}se`}>{renderFormatted(fragment.slice(pos), `${keyPrefix}se`)}</span>);
      return parts;
    };

    // Helper: apply term highlights to a text fragment
    const applyTermHighlights = (fragment, keyPrefix, globalStart) => {
      if (!highlightTermState || !fragment) return applySearchHighlights(fragment, keyPrefix, globalStart);
      const { suggestionId, occurrenceIdx, occurrences } = highlightTermState;
      // Find occurrences that fall within this fragment's global range
      const fragEnd = globalStart + fragment.length;
      const matching = occurrences.map((occ, i) => ({ ...occ, occIdx: i }))
        .filter(occ => occ.index >= globalStart && occ.index + occ.length <= fragEnd);
      if (matching.length === 0) return applySearchHighlights(fragment, keyPrefix, globalStart);

      const parts = [];
      let pos = 0;
      for (const occ of matching) {
        const localIdx = occ.index - globalStart;
        if (localIdx > pos) parts.push(<span key={`${keyPrefix}t${pos}`}>{...applySearchHighlights(fragment.slice(pos, localIdx), `${keyPrefix}t${pos}`, globalStart + pos)}</span>);
        const isCurrentOcc = occ.occIdx === occurrenceIdx;
        parts.push(
          <mark key={`${keyPrefix}h${occ.occIdx}`}
            data-term-highlight={`${suggestionId}-${occ.occIdx}`}
            style={{
              background: isCurrentOcc ? "#a0522d40" : "#a0522d15",
              borderBottom: `2px solid ${isCurrentOcc ? "#a0522d" : "#a0522d60"}`,
              padding: "1px 2px", borderRadius: 3,
              outline: isCurrentOcc ? "2px solid #a0522d50" : "none", outlineOffset: 1,
              animation: isCurrentOcc ? "flash-highlight 1.5s ease-out" : "none",
            }}>
            {...renderFormatted(occ.text, `${keyPrefix}h${occ.occIdx}`)}
          </mark>
        );
        pos = localIdx + occ.length;
      }
      if (pos < fragment.length) parts.push(<span key={`${keyPrefix}e`}>{...applySearchHighlights(fragment.slice(pos), `${keyPrefix}e`, globalStart + pos)}</span>);
      return parts;
    };

    // Filter out suggestions flagged as no-inline (unmatched, placed for panel visibility only)
    const inlineSuggestions = (suggestions || []).filter(s => !s._noInline);
    if (!inlineSuggestions.length) return applyTermHighlights(text, `p${para.id}`, paraGlobalOffset);
    const parts = [];
    let last = 0;
    // Pre-compute positions for sorting
    const withPos = suggestions.filter(s => s.original).map(s => {

      const match = findInText(text, s.original);
      return { s, match };
    }).filter(x => x.match).sort((a, b) => a.match.idx - b.match.idx);

    for (const { s, match } of withPos) {
      const { idx, len } = match;
      if (idx < last) continue; // Skip overlapping
      if (idx > last) parts.push(<span key={`t${last}`}>{...renderFormatted(text.slice(last, idx), `t${last}`)}</span>);

      const matchedText = text.slice(idx, idx + len);
      const isAcc = accepted.has(s.id), isRej = rejected.has(s.id), isAct = activeSuggestion === s.id;
      const p = PRIORITY[s.priority];
      if (p) {
        if (isRej) {
          parts.push(<span key={`s${s.id}`} data-suggestion-id={s.id}>{...renderFormatted(matchedText, `r${s.id}`)}</span>);
        } else {
          const displayText = isAcc && s.replacement ? s.replacement : matchedText;
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
      last = idx + len;
    }
    if (last < text.length) parts.push(<span key="end">{...applyTermHighlights(text.slice(last), "end", paraGlobalOffset + last)}</span>);
    return parts.length ? parts : applyTermHighlights(text, `p${para.id}`, paraGlobalOffset);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: font, background: bg, color: ink, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setView("dashboard")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} title="Tillbaka till dashboard">
            <div style={{ width: 30, height: 30, background: ink, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 15, fontWeight: 700 }}>M</div>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
          </div>
          <div style={{ width: 1, height: 20, background: border }} />
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>{uploadedFile?.name?.replace(/\.[^.]+$/, '') || "Manus"}</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
            {genres.map(id => { const g = GENRES.find(x => x.id === id); return g ? <span key={id} style={{ fontSize: 14 }} title={g.label}>{g.icon}</span> : null; })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Save indicator */}
          {saveStatus && (
            <span style={{ fontFamily: uiFont, fontSize: 10, color: saveStatus === "saving" ? muted : "#27864a", transition: "opacity 0.3s", opacity: saveStatus ? 1 : 0 }}>
              {saveStatus === "saving" ? "Sparar..." : "✓ Sparat"}
            </span>
          )}
          <button onClick={() => { if (window.confirm("Vill du börja om med ett nytt manus? Allt osparat arbete försvinner.")) handleStartFresh(); }} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: muted, cursor: "pointer", fontWeight: 500 }}>Nytt manus</button>
          {/* Review button */}
          <button
            onClick={() => reReviewing ? null : setShowReReviewModal(true)}
            disabled={reReviewing}
            style={{
              fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, cursor: reReviewing ? "default" : "pointer",
              border: `1px solid ${border}`, background: reReviewing ? "#e8ddd2" : surface, color: reReviewing ? muted : ink, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {reReviewing ? "Granskar..." : `↻ Granska`}
            {reviewHistory.length > 0 && (
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: accentLight, color: accent, fontWeight: 600 }}>
                #{activeReviewRound}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSearch(s => !s)}
            title={`Sök i text (${navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+F)`}
            style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 12px", borderRadius: 7, border: `1px solid ${showSearch ? accent : border}`, background: showSearch ? accentLight : surface, color: showSearch ? accent : ink, cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}
          >
            <span style={{ fontSize: 13 }}>⌕</span> Sök
          </button>
          <button onClick={() => setShowExport(true)} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>Exportera</button>
          <button onClick={() => setShowSettings(true)} style={{ fontFamily: uiFont, fontSize: 11, padding: "6px 14px", borderRadius: 7, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer", fontWeight: 500 }}>Inställningar</button>
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

      {/* ANALYSIS STATUS BAR */}
      {(batchAnalyzing || reanalyzingChapter || reReviewing) && processingStatus && (
        <div style={{
          padding: "12px 20px", background: "linear-gradient(135deg, #fdf6e3 0%, #f5ead0 100%)",
          borderBottom: `1px solid #e8d9a8`,
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", border: "3px solid #e8d9a8",
            borderTopColor: accent, animation: "spin 1s linear infinite",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: uiFont, fontSize: 12, color: ink, fontWeight: 600 }}>{processingStatus}</div>
            <div style={{ fontFamily: uiFont, fontSize: 10, color: muted, marginTop: 2 }}>
              Stäng inte webbläsaren — granskningen pågår i bakgrunden
            </div>
          </div>
          {(batchAnalyzing || reanalyzingChapter || reReviewing) && (
            <button onClick={handleAbortProcessing} style={{
              fontFamily: uiFont, fontSize: 11, padding: "6px 14px",
              borderRadius: 6, border: `1px solid #d4c0a0`, background: "rgba(255,255,255,0.7)",
              color: "#7a6520", cursor: "pointer", fontWeight: 500,
            }}>Avbryt</button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT SIDEBAR */}
        <Sidebar chapters={chapters} activeChapter={activeChapter} setActiveChapter={setActiveChapter} onSplitChapter={handleSplitChapter} onReanalyze={handleReanalyzeChapter} onDeepAnalyze={(id) => handleReanalyzeChapter(id, "deep")} paragraphsByChapter={paragraphsByChapter} />

        {/* SEARCH BAR */}
        {showSearch && (
          <SearchBar
            chapters={chapters}
            activeChapter={activeChapter}
            setActiveChapter={setActiveChapter}
            onReplace={(original, replacement, chapterId) => {
              const targetChapter = chapterId || activeChapter;
              if (targetChapter) {
                applyReplacementToContent(targetChapter, original, replacement);
              }
            }}
            onReplaceAll={(query, replacement, caseSensitive, searchAllChapters) => {
              const targetChapters = searchAllChapters ? chapters : chapters.filter(c => c.id === activeChapter);
              setChapters(prev => {
                let updated = prev;
                for (const tc of targetChapters) {
                  const ch = updated.find(c => c.id === tc.id);
                  if (!ch) continue;
                  const flags = caseSensitive ? 'g' : 'gi';
                  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                  const newContent = ch.content.replace(regex, replacement);
                  if (newContent === ch.content) continue;
                  if (serverProjectId) apiClient.updateChapter(tc.id, { content: newContent }).catch(e => console.error("Replace all save failed:", e));
                  updated = updated.map(c => c.id === tc.id ? { ...c, content: newContent, wordCount: countWords(newContent) } : c);
                }
                return updated;
              });
              // Refresh paragraphs for all affected chapters
              setTimeout(() => {
                const affectedIds = searchAllChapters ? chapters.map(c => c.id) : [activeChapter];
                for (const chId of affectedIds) {
                  setChapters(prev => {
                    const ch = prev.find(c => c.id === chId);
                    if (ch) {
                      const newParas = splitIntoParagraphs(ch.content);
                      const oldParas = paragraphsByChapter[chId] || [];
                      const enriched = newParas.map(np => {
                        const op = oldParas.find(o => o.text === np.text);
                        return op?.suggestions?.length ? { ...np, suggestions: op.suggestions } : np;
                      });
                      setParagraphsByChapter(prev2 => ({ ...prev2, [chId]: enriched }));
                    }
                    return prev;
                  });
                }
              }, 0);
            }}
            onClose={() => { setShowSearch(false); setSearchState(null); }}
            onSearchChange={setSearchState}
          />
        )}

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
          {(() => {
            // Build accurate offsets by finding each paragraph in chapter.content
            const chContent = currentChapter?.content || "";
            const paraOffsets = [];
            let searchFrom = 0;
            for (const p of currentParagraphs) {
              const idx = chContent.indexOf(p.text, searchFrom);
              paraOffsets.push(idx >= 0 ? idx : searchFrom);
              searchFrom = (idx >= 0 ? idx : searchFrom) + p.text.length;
            }
            return currentParagraphs.map((para, paraIdx) => {
            const paraGlobalOffset = paraOffsets[paraIdx] || 0;
            const isInserted = insertedParaIds.has(para.id);
            const hasAcceptedChanges = (para.suggestions || []).some(s => accepted.has(s.id));
            const hasPendingChanges = (para.suggestions || []).some(s => !accepted.has(s.id) && !rejected.has(s.id));
            return (
              <div key={para.id} data-para-id={para.id} data-inserted={isInserted || undefined} data-group="para" style={{ position: "relative" }}>
                {(isInserted || hasAcceptedChanges) && (
                  <div style={{
                    position: "absolute", left: -18, top: 0, bottom: 0, width: 3,
                    background: isInserted ? "#27864a" : "#27864a60", borderRadius: 2,
                  }} />
                )}
                {hasPendingChanges && !hasAcceptedChanges && !isInserted && (
                  <div style={{
                    position: "absolute", left: -18, top: 0, bottom: 0, width: 3,
                    background: `${accent}50`, borderRadius: 2,
                  }} />
                )}
                <p
                  data-para-suggestion-ids={(para.suggestions || []).map(s => s.id).join(',') || undefined}
                  style={{
                  fontSize: 16.5, lineHeight: 1.85, marginBottom: 22, position: "relative",
                  color: isInserted ? "#2d4a35" : "#3d2e23",
                  background: isInserted ? "#f0faf3" : "transparent",
                  padding: isInserted ? "6px 10px" : 0,
                  borderRadius: isInserted ? 6 : 0,
                  transition: "background 0.3s, color 0.3s",
                }}>
                  {renderText(para, paraGlobalOffset)}
                </p>
                {isInserted && (
                  <div style={{ display: "flex", gap: 6, marginTop: -14, marginBottom: 16, paddingLeft: 10 }}>
                    <button onClick={() => {
                      handleEditParagraph(para.id, getEffectiveText(para));
                      setInsertedParaIds(new Set());
                    }} style={{
                      fontFamily: uiFont, fontSize: 10, padding: "3px 10px", borderRadius: 5,
                      border: `1px solid #27864a40`, background: "#f0faf3", color: "#27864a",
                      cursor: "pointer", fontWeight: 500,
                    }}>✎ Redigera</button>
                    <button onClick={() => setInsertedParaIds(new Set())} style={{
                      fontFamily: uiFont, fontSize: 10, padding: "3px 10px", borderRadius: 5,
                      border: `1px solid ${border}`, background: surface, color: muted,
                      cursor: "pointer",
                    }}>✓ OK</button>
                  </div>
                )}
              </div>
            );
          }); })()}
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ width: 320, borderLeft: `1px solid ${border}`, background: surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          {rightPanel === "suggestions" && (
            <>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Förslag</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {["all", "red", "yellow", "green"].map(p => {
                    const count = p === "all"
                      ? allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length
                      : allSuggestions.filter(s => s.priority === p && !accepted.has(s.id) && !rejected.has(s.id)).length;
                    return (
                    <button key={p} onClick={() => setFilterPriority(p)} style={{
                      fontFamily: uiFont, fontSize: 10, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
                      border: filterPriority === p ? "none" : `1px solid ${border}`,
                      background: filterPriority === p ? (p === "all" ? ink : PRIORITY[p]?.color) : surface,
                      color: filterPriority === p ? "#fff" : muted, fontWeight: 500,
                    }}>{p === "all" ? "Alla" : PRIORITY[p].label}{count > 0 ? ` (${count})` : ""}</button>
                    );
                  })}
                </div>
                {/* Batch actions */}
                {(() => {
                  const pendingSuggestions = allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id));
                  const conventionSuggestions = pendingSuggestions.filter(s => s.level === 4 || s.type === "consistency");
                  const filteredPending = pendingSuggestions.filter(s => filterPriority === "all" || s.priority === filterPriority);

                  return (conventionSuggestions.length > 0 || filteredPending.length > 1) ? (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {conventionSuggestions.length > 0 && (
                        <button onClick={() => {
                          if (window.confirm(`Godkänn ${conventionSuggestions.length} konventionsförslag (nivå 4)?`)) {
                            setAccepted(prev => {
                              const n = new Set(prev);
                              conventionSuggestions.forEach(s => n.add(s.id));
                              return n;
                            });
                            conventionSuggestions.forEach(s => apiClient.updateSuggestion(s.id, "ACCEPTED").catch(() => {}));
                            if (activeChapter) {
                              const replacements = conventionSuggestions
                                .filter(s => s.original && s.replacement)
                                .map(s => ({ original: s.original, replacement: s.replacement }));
                              if (replacements.length > 0) applyBatchReplacements(activeChapter, replacements);
                            }
                          }
                        }} style={{
                          fontFamily: uiFont, fontSize: 9.5, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                          border: `1px solid #b8860b40`, background: "#fdf6e3", color: "#7a6520", fontWeight: 500,
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          ✓ Konventioner ({conventionSuggestions.length})
                        </button>
                      )}
                      {filteredPending.length > 1 && (
                        <button onClick={() => {
                          const label = filterPriority === "all" ? "alla" : PRIORITY[filterPriority]?.label?.toLowerCase();
                          if (window.confirm(`Godkänn ${filteredPending.length} ${label} förslag?`)) {
                            setAccepted(prev => {
                              const n = new Set(prev);
                              filteredPending.forEach(s => n.add(s.id));
                              return n;
                            });
                            filteredPending.forEach(s => apiClient.updateSuggestion(s.id, "ACCEPTED").catch(() => {}));
                            if (activeChapter) {
                              const replacements = filteredPending
                                .filter(s => s.original && s.replacement)
                                .map(s => ({ original: s.original, replacement: s.replacement }));
                              if (replacements.length > 0) applyBatchReplacements(activeChapter, replacements);
                            }
                          }
                        }} style={{
                          fontFamily: uiFont, fontSize: 9.5, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                          border: `1px solid #27864a40`, background: "#f0faf3", color: "#27864a", fontWeight: 500,
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          ✓ Godkänn {filterPriority === "all" ? "alla" : PRIORITY[filterPriority]?.label?.toLowerCase()} ({filteredPending.length})
                        </button>
                      )}
                    </div>
                  ) : null;
                })()}
                {handledCount > 0 && (
                  <button onClick={() => setShowHandled(!showHandled)} style={{
                    fontFamily: uiFont, fontSize: 9.5, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
                    border: `1px solid ${border}`, background: showHandled ? "#f0faf3" : surface,
                    color: showHandled ? "#27864a" : muted, fontWeight: 500, marginTop: 4,
                  }}>
                    {showHandled ? `Dölj hanterade (${handledCount})` : `Visa hanterade (${handledCount})`}
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                {/* Suggestion cards – primary content */}
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 16px", fontFamily: uiFont, fontSize: 12, color: muted }}>
                    {(reanalyzingChapter === activeChapter || currentChapter?.status === "active") ? (
                      <div>
                        <div style={{
                          width: 24, height: 24, border: `3px solid ${border}`, borderTopColor: accent,
                          borderRadius: "50%", animation: "spin 0.8s linear infinite",
                          margin: "0 auto 12px",
                        }} />
                        <div style={{ color: ink, fontWeight: 500 }}>Analyserar kapitlet...</div>
                        <div style={{ fontSize: 11, marginTop: 4, color: muted }}>Förslag visas här när analysen är klar</div>
                      </div>
                    ) : (
                      allSuggestions.length === 0 ? "Inga förslag för detta kapitel än." : "Inga förslag matchar filtret."
                    )}
                  </div>
                ) : (
                  <>
                    {pendingCount === 0 && allSuggestions.length > 0 && (
                      <div style={{ textAlign: "center", padding: "12px 16px 8px", fontFamily: uiFont, fontSize: 12, color: "#27864a" }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
                        Alla förslag i detta kapitel hanterade!
                      </div>
                    )}
                    {manuscriptFullyHandled && !showFinalCheckPrompt && !finalCheckResult && (
                      <div style={{ margin: "12px 14px", padding: "14px 16px", background: "#f0faf3", borderRadius: 10, border: "1px solid #27864a30" }}>
                        <div style={{ fontFamily: uiFont, fontSize: 12, fontWeight: 600, color: "#27864a", marginBottom: 6 }}>Hela manuset genomgånget!</div>
                        <div style={{ fontFamily: uiFont, fontSize: 11, color: ink, lineHeight: 1.4, marginBottom: 10 }}>
                          Alla {globalAllSuggestions.length} förslag har hanterats. Vill du köra en AI-driven slutkontroll innan export?
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={async () => {
                            setFinalCheckRunning(true);
                            try {
                              const result = await apiClient.finalCheck(serverProjectId);
                              setFinalCheckResult({ issues: result?.issues?.issues || result?.issues || [], summary: result?.issues?.summary || "" });
                            } catch (err) {
                              console.error("Final check failed:", err);
                              alert("Slutkontrollen misslyckades: " + err.message);
                            } finally {
                              setFinalCheckRunning(false);
                            }
                          }} disabled={finalCheckRunning} style={{
                            flex: 1, padding: "8px 0", borderRadius: 7, border: "none", fontFamily: uiFont, fontSize: 11.5, fontWeight: 600,
                            background: finalCheckRunning ? "#d4c8bb" : accent, color: "#fff", cursor: finalCheckRunning ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}>
                            {finalCheckRunning ? (<><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Kontrollerar...</>) : "Kör slutkontroll"}
                          </button>
                          <button onClick={() => setShowExport(true)} style={{
                            padding: "8px 14px", borderRadius: 7, border: `1px solid ${border}`, fontFamily: uiFont, fontSize: 11.5,
                            background: surface, color: ink, cursor: "pointer",
                          }}>Exportera direkt</button>
                        </div>
                      </div>
                    )}
                    {filtered.map(s => {
                      // Check if this suggestion actually renders with an inline highlight
                      const attachedPara = currentParagraphs.find(p => p.suggestions?.some(ps => ps.id === s.id));
                      const hasInline = !!(attachedPara && s.original && findInText(attachedPara.text, s.original) !== null);
                      const terms = !hasInline && s.original ? extractSearchTerms(s.original) : [];
                      const chapter = chapters.find(c => c.id === activeChapter);
                      const termOccs = terms.length > 0 && chapter ? findAllTermOccurrences(chapter.content, terms) : [];
                      return (
                      <SuggestionCard key={s.id} s={s} isActive={activeSuggestion === s.id}
                        status={accepted.has(s.id) ? "accepted" : rejected.has(s.id) ? "rejected" : "pending"}
                        hasInlineHighlight={hasInline}
                        termOccurrenceCount={termOccs.length}
                        currentTermIdx={highlightTermState?.suggestionId === s.id ? highlightTermState.occurrenceIdx : null}
                        onNavigateTerm={termOccs.length > 0 ? (idx) => navigateToTermOccurrence(s.id, terms, idx) : null}
                        onToggle={() => { setActiveSuggestion(activeSuggestion === s.id ? null : s.id); if (activeSuggestion !== s.id) setHighlightTermState(null); }}
                        onAccept={() => {
                          setAccepted(prev => new Set([...prev, s.id]));
                          setActiveSuggestion(null);
                          setHighlightTermState(null);
                          apiClient.updateSuggestion(s.id, "ACCEPTED").catch(e => console.error("Save accept failed:", e));
                          // Bake replacement into chapter content (uses prev=> for fresh state)
                          if (s.original && s.replacement && activeChapter) {
                            applyReplacementToContent(activeChapter, s.original, s.replacement);
                          }
                        }}
                        onReject={() => { setRejected(prev => new Set([...prev, s.id])); setActiveSuggestion(null); setHighlightTermState(null); apiClient.updateSuggestion(s.id, "REJECTED").catch(e => console.error("Save reject failed:", e)); }}
                        onUndo={() => {
                          // Restore original text for ALL accepted suggestions
                          if (accepted.has(s.id) && s.original && s.replacement && activeChapter) {
                            applyReplacementToContent(activeChapter, s.replacement, s.original);
                          }
                          setAccepted(prev => { const n = new Set(prev); n.delete(s.id); return n; });
                          setRejected(prev => { const n = new Set(prev); n.delete(s.id); return n; });
                          setActiveSuggestion(null);
                          if (!s.id.startsWith("dev_")) apiClient.updateSuggestion(s.id, "PENDING").catch(e => console.error("Save undo failed:", e));
                        }}
                      />
                    ); })}
                  </>
                )}

                {/* Collapsible paragraph edit section */}
                {currentParagraphs.length > 0 && (
                  <ParagraphEditSection paragraphs={currentParagraphs} onEdit={handleEditParagraph} getEffectiveText={getEffectiveText} />
                )}
              </div>
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, fontFamily: uiFont, fontSize: 10, color: muted, display: "flex", justifyContent: "space-between" }}>
                <span>{pendingCount} kvar</span>
                <span>✓ {accepted.size} · ✗ {rejected.size}</span>
              </div>
            </>
          )}
          {rightPanel === "translate" && <TranslatePanel langs={transLangs} />}
        </aside>
      </div>

      {/* SELECTION TOOLBAR */}
      <SelectionToolbar
        position={selectionToolbar}
        onEdit={() => {
          if (selectionToolbar) {
            // Use the actual selected text — may span multiple paragraphs
            const selectedText = selectionToolbar.text || "";
            const paras = paragraphsByChapter[activeChapter] || [];
            const para = paras.find(p => p.id === selectionToolbar.paraId);
            if (selectedText && selectedText.includes("\n")) {
              // Multi-paragraph selection: find all involved paragraph IDs
              const involvedIds = paras
                .filter(p => selectedText.includes(p.text.slice(0, 40)))
                .map(p => p.id);
              if (involvedIds.length === 0) involvedIds.push(selectionToolbar.paraId);
              handleEditParagraph(involvedIds[0], selectedText, involvedIds);
            } else if (para) {
              // Single paragraph: open modal with effective text (includes accepted replacements)
              handleEditParagraph(selectionToolbar.paraId, getEffectiveText(para));
            }
          }
        }}
        onDevelop={() => {
          if (selectionToolbar?.text) {
            setDevelopModal({ initialText: selectionToolbar.text, paraId: selectionToolbar.paraId });
            setSelectionToolbar(null);
            window.getSelection()?.removeAllRanges();
          }
        }}
        onNewChapter={() => {
          if (selectionToolbar?.text) {
            handleCreateChapterFromText(selectionToolbar.text, selectionToolbar.paraId);
          }
        }}
        onClose={() => setSelectionToolbar(null)}
      />

      {/* SESSION EXPIRED */}
      {sessionExpired && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.55)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: surface, borderRadius: 16, padding: "32px 28px", maxWidth: 380, textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: ink, marginBottom: 8 }}>Sessionen har gått ut</div>
            <div style={{ fontFamily: uiFont, fontSize: 12, color: muted, lineHeight: 1.5, marginBottom: 20 }}>
              Du har varit inaktiv för länge. Logga in igen för att fortsätta arbeta. Dina ändringar är sparade.
            </div>
            <button onClick={() => { setSessionExpired(false); logout(); setView("auth"); }} style={{
              width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
              background: accent, color: "#fff", fontFamily: uiFont, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Logga in igen</button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <EditModal
          text={editModal.text}
          paragraphId={editModal.paraId}
          chapterTitle={editModal.chapterTitle}
          onSave={(newText) => {
            // If multi-paragraph selection was edited, remove text from other involved paragraphs
            if (editModal.involvedParaIds && editModal.involvedParaIds.length > 1) {
              const paras = [...(paragraphsByChapter[activeChapter] || [])];
              // Remove all involved paragraphs except the first
              const otherIds = editModal.involvedParaIds.slice(1);
              const cleaned = paras.filter(p => !otherIds.includes(p.id));
              setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: cleaned }));
              // Now save the merged text into the first paragraph
              const firstIdx = cleaned.findIndex(p => p.id === editModal.paraId);
              if (firstIdx !== -1) {
                const newParts = newText.split(/\n\s*\n/).map(t => t.trim()).filter(t => t.length > 0);
                if (newParts.length <= 1) {
                  cleaned[firstIdx] = { ...cleaned[firstIdx], text: newParts[0] || newText.trim() };
                } else {
                  const newParas = newParts.map((text, i) => ({
                    id: i === 0 ? cleaned[firstIdx].id : `p${Date.now()}_${i}`,
                    text,
                    suggestions: i === 0 ? (cleaned[firstIdx].suggestions || []) : [],
                  }));
                  cleaned.splice(firstIdx, 1, ...newParas);
                }
                setParagraphsByChapter(prev => ({ ...prev, [activeChapter]: cleaned }));
                const newContent = cleaned.map(p => p.text).join("\n\n");
                setChapters(prev => prev.map(ch =>
                  ch.id === activeChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
                ));
                apiClient.updateChapter(activeChapter, { content: newContent }).catch(err =>
                  console.error("Failed to save chapter to DB:", err)
                );
              }
            } else {
              handleSaveParagraph(editModal.paraId, newText);
            }
          }}
          onCreateChapter={(text) => handleCreateChapterFromText(text, editModal.paraId)}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* FINAL CHECK MODAL */}
      {finalCheckResult && (
        <FinalCheckModal
          issues={finalCheckResult.issues}
          summary={finalCheckResult.summary}
          onClose={() => setFinalCheckResult(null)}
          onExport={() => { setFinalCheckResult(null); setShowExport(true); }}
        />
      )}

      {/* DEVELOP MODAL */}
      {developModal && (
        <DevelopModal
          initialText={developModal.initialText}
          chapterContent={currentChapter?.content}
          chapterTitle={currentChapter?.title}
          dnaProfile={dnaProfile}
          emotionMap={emotionMaps[activeChapter]}
          apiClient={apiClient}
          chapterId={activeChapter}
          onResult={(result) => {
            setDevelopResult({ ...result, insertAfterParaId: developModal.paraId || null });
            setDevelopModal(null);
          }}
          onClose={() => setDevelopModal(null)}
        />
      )}

      {/* DEVELOP RESULT MODAL */}
      {developResult && (
        <DevelopResultModal
          result={developResult}
          onInsert={(newText) => {
            const targetChapter = activeChapter || (chapters.length > 0 ? chapters[0].id : null);
            if (targetChapter && newText) {
              const chapter = chapters.find(c => c.id === targetChapter);
              if (chapter) {
                const originalText = developResult?.originalText || "";
                const paraId = developResult?.insertAfterParaId;
                const oldParas = paragraphsByChapter[targetChapter] || splitIntoParagraphs(chapter.content);
                let newContent;

                // REPLACE original text with new text (not append)
                const norm = s => s.replace(/\s+/g, ' ').trim();
                if (originalText && chapter.content.includes(originalText)) {
                  // Exact match — simple replace
                  newContent = chapter.content.replace(originalText, newText);
                } else if (originalText && norm(chapter.content).includes(norm(originalText))) {
                  // Fuzzy match (whitespace differences) — replace by paragraph
                  const paraIndex = oldParas.findIndex(p => norm(p.text).includes(norm(originalText)) || norm(originalText).includes(norm(p.text)));
                  if (paraIndex >= 0) {
                    const updatedParas = oldParas.map((p, i) =>
                      i === paraIndex ? { ...p, text: newText } : p
                    );
                    newContent = updatedParas.map(p => p.text).join("\n\n");
                  } else {
                    newContent = chapter.content + "\n\n" + newText;
                  }
                } else if (paraId) {
                  // Fallback: replace the specific paragraph
                  const paraIndex = oldParas.findIndex(p => p.id === paraId);
                  if (paraIndex >= 0) {
                    const updatedParas = oldParas.map((p, i) =>
                      i === paraIndex ? { ...p, text: newText } : p
                    );
                    newContent = updatedParas.map(p => p.text).join("\n\n");
                  } else {
                    newContent = chapter.content + "\n\n" + newText;
                  }
                } else {
                  newContent = chapter.content + "\n\n" + newText;
                }

                // Rebuild paragraphs, preserving existing suggestions
                const newParas = splitIntoParagraphs(newContent);
                const enrichedParas = newParas.map(np => {
                  // Try to find matching old paragraph to preserve its suggestions
                  const oldPara = oldParas.find(op => op.text === np.text);
                  if (oldPara?.suggestions?.length) {
                    return { ...np, suggestions: oldPara.suggestions };
                  }
                  return np;
                });

                // Add a "develop" suggestion to the paragraph containing the new text
                const tempDevId = `dev_${Date.now()}`;
                const targetParaIdx = enrichedParas.findIndex(p => p.text.includes(newText.substring(0, 50)));
                if (targetParaIdx >= 0) {
                  const devSuggestion = {
                    id: tempDevId,
                    type: "develop",
                    priority: "green",
                    level: 2,
                    original: originalText,
                    replacement: newText,
                    reason: developResult?.reasoning || "Text utvecklad med AI",
                    status: "ACCEPTED",
                  };
                  enrichedParas[targetParaIdx] = {
                    ...enrichedParas[targetParaIdx],
                    suggestions: [...(enrichedParas[targetParaIdx].suggestions || []), devSuggestion],
                  };
                  setAccepted(prev => new Set([...prev, tempDevId]));

                  // Save suggestion to DB (replace temp ID with real DB ID)
                  if (serverProjectId) {
                    apiClient.createSuggestion({
                      chapterId: targetChapter,
                      type: "develop",
                      priority: "green",
                      level: 2,
                      original: originalText,
                      replacement: newText,
                      reason: developResult?.reasoning || "Text utvecklad med AI",
                      status: "ACCEPTED",
                    }).then(result => {
                      if (result?.suggestion?.id) {
                        const realId = result.suggestion.id;
                        // Update local state with real DB ID
                        setParagraphsByChapter(prev => {
                          const paras = prev[targetChapter] || [];
                          return {
                            ...prev,
                            [targetChapter]: paras.map(p => ({
                              ...p,
                              suggestions: (p.suggestions || []).map(s =>
                                s.id === tempDevId ? { ...s, id: realId } : s
                              ),
                            })),
                          };
                        });
                        setAccepted(prev => {
                          const next = new Set(prev);
                          next.delete(tempDevId);
                          next.add(realId);
                          return next;
                        });
                      }
                    }).catch(e => console.error("Failed to save develop suggestion to DB:", e));
                  }
                }

                // Find inserted/changed paragraphs
                const oldTexts = new Set(oldParas.map(p => p.text));
                const insertedIds = new Set(enrichedParas.filter(p => !oldTexts.has(p.text)).map(p => p.id));

                setChapters(prev => prev.map(ch =>
                  ch.id === targetChapter ? { ...ch, content: newContent, wordCount: countWords(newContent) } : ch
                ));
                setParagraphsByChapter(prev => ({ ...prev, [targetChapter]: enrichedParas }));
                setInsertedParaIds(insertedIds);

                // Auto-scroll to changed text
                setTimeout(() => {
                  const el = document.querySelector('[data-inserted="true"]');
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);

                // Save to DB
                if (serverProjectId) {
                  apiClient.updateChapter(targetChapter, { content: newContent }).catch(e => console.error("Failed to save chapter after develop-insert:", e));
                }
              }
            }
            setDevelopResult(null);
          }}
          onRegenerate={() => {
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

      {/* RE-REVIEW MODAL */}
      {showReReviewModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowReReviewModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: surface, borderRadius: 16, width: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.18)", padding: "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Ny granskning</h3>
              <button onClick={() => setShowReReviewModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: muted, padding: 4 }}>✕</button>
            </div>
            <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 16px", lineHeight: 1.5 }}>
              Godkända ändringar behålls i texten. Redan hanterade förslag filtreras bort.
            </p>

            {/* Chapter selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: ink }}>Kapitel att granska</span>
                <button onClick={() => {
                  const allSelected = reReviewSelectedChapters.size === 0 || reReviewSelectedChapters.size === chapters.length;
                  if (allSelected) {
                    // Currently all selected → deselect all
                    setReReviewSelectedChapters(new Set(["__none__"])); // sentinel: nothing selected
                  } else {
                    // Not all selected → select all
                    setReReviewSelectedChapters(new Set());
                  }
                }} style={{ fontFamily: uiFont, fontSize: 10, color: accent, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                  {reReviewSelectedChapters.size === 0 || reReviewSelectedChapters.size === chapters.length ? "Avmarkera alla" : "Alla kapitel"}
                </button>
              </div>
              <div style={{ maxHeight: 150, overflowY: "auto", border: `1px solid ${border}`, borderRadius: 8, padding: "4px 0" }}>
                {chapters.map(ch => {
                  const isSelected = reReviewSelectedChapters.size === 0 || reReviewSelectedChapters.has(ch.id);
                  const hasSuggestions = (paragraphsByChapter[ch.id] || []).some(p => p.suggestions?.length > 0);
                  return (
                    <label key={ch.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", cursor: "pointer",
                      background: isSelected ? "#f7f4ef" : "transparent", transition: "background 0.1s",
                    }}>
                      <input type="checkbox" checked={isSelected}
                        onChange={() => {
                          setReReviewSelectedChapters(prev => {
                            const next = new Set(prev.size === 0 ? chapters.map(c => c.id) : prev);
                            if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                            // If all selected, reset to empty (= all)
                            if (next.size === chapters.length) return new Set();
                            return next;
                          });
                        }}
                        style={{ accentColor: accent }}
                      />
                      <span style={{ fontFamily: uiFont, fontSize: 11, color: ink, flex: 1 }}>{ch.title}</span>
                      <span style={{ fontFamily: uiFont, fontSize: 9, color: muted }}>{ch.wordCount.toLocaleString()} ord</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: hasSuggestions ? "#27864a" : "#c0392b", flexShrink: 0 }} />
                    </label>
                  );
                })}
              </div>
              <div style={{ fontFamily: uiFont, fontSize: 10, color: muted, marginTop: 4 }}>
                {reReviewSelectedChapters.size === 0
                  ? `Alla ${chapters.length} kapitel väljs`
                  : `${reReviewSelectedChapters.size} av ${chapters.length} kapitel valda`}
              </div>
            </div>

            {/* Analysis level */}
            <div style={{ fontFamily: uiFont, fontSize: 11, fontWeight: 600, color: ink, marginBottom: 8 }}>Analysnivå</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Object.values(ANALYSIS_LEVELS).map(lvl => {
                const active = reReviewLevel === lvl.id;
                const selectedChapters = reReviewSelectedChapters.size > 0 && !reReviewSelectedChapters.has("__none__") ? reReviewSelectedChapters.size : chapters.length;
                const estMinutes = Math.ceil(selectedChapters * lvl.estimatePerChapter / 60);
                return (
                  <button key={lvl.id} onClick={() => setReReviewLevel(lvl.id)} style={{
                    padding: "12px 16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                    border: active ? `2px solid ${accent}` : `1px solid ${border}`,
                    background: active ? accentLight : surface, display: "flex", gap: 12, alignItems: "center", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 20 }}>{lvl.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: uiFont, fontSize: 12.5, fontWeight: 600, color: ink }}>{lvl.label}</div>
                      <div style={{ fontFamily: uiFont, fontSize: 10.5, color: muted, marginTop: 1 }}>{lvl.description}</div>
                      <div style={{ fontFamily: uiFont, fontSize: 9, color: muted, marginTop: 2, fontStyle: "italic" }}>{lvl.passes}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: uiFont, fontSize: 10.5, color: ink, fontWeight: 500 }}>ca {estMinutes} min</div>
                      <div style={{ fontFamily: uiFont, fontSize: 9.5, color: muted }}>{lvl.costPerChapter}/kap</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handleReReview(reReviewLevel)}
              style={{ width: "100%", padding: "13px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}
            >
              Starta {ANALYSIS_LEVELS[reReviewLevel].label.toLowerCase()}
            </button>
          </div>
        </div>
      )}

      {/* COMPLETION MODAL - all suggestions handled */}
      {showCompletionModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowCompletionModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(26,20,16,0.45)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: surface, borderRadius: 16, width: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.18)", padding: "32px 36px", textAlign: "center" }}>
            <button onClick={() => setShowCompletionModal(false)} style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: muted }}>✕</button>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: ink, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              Alla förslag hanterade!
            </h3>
            <p style={{ fontFamily: uiFont, fontSize: 13, color: muted, margin: "0 0 6px", lineHeight: 1.5 }}>
              Du har gått igenom alla {globalAllSuggestions.length} förslag i manuskriptet.
            </p>
            <p style={{ fontFamily: uiFont, fontSize: 12, color: muted, margin: "0 0 24px", lineHeight: 1.5 }}>
              {globalAllSuggestions.filter(s => accepted.has(s.id)).length} godkända · {globalAllSuggestions.filter(s => rejected.has(s.id)).length} avvisade
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={async () => {
                // Save as new version (duplicate project)
                setShowCompletionModal(false);
                try {
                  const date = new Date().toLocaleDateString("sv-SE");
                  const versionName = `${chapters[0]?.title ? uploadedFile?.name?.replace(/\.[^.]+$/, '') || 'Manus' : 'Manus'} – version ${date}`;
                  const res = await apiClient.duplicateProject(serverProjectId, versionName);
                  if (res?.project?.id) {
                    alert(`Ny version sparad: "${versionName}"`);
                  }
                } catch (e) {
                  console.error("Save version failed:", e);
                  alert("Kunde inte spara version. Exportera istället.");
                }
              }} style={{
                padding: "13px 0", borderRadius: 9, border: `1px solid ${border}`, background: surface, color: ink,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                📋 Spara som ny version
              </button>
              <button onClick={() => { setShowCompletionModal(false); setShowExport(true); }} style={{
                padding: "13px 0", borderRadius: 9, border: `1px solid ${border}`, background: surface, color: ink,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                📄 Exportera
              </button>
              <button onClick={() => { setShowCompletionModal(false); setShowReReviewModal(true); }} style={{
                padding: "13px 0", borderRadius: 9, border: "none", background: accent, color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                ↻ Gör ny granskning
              </button>
            </div>
          </div>
        </div>
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
  const normalize = (str) => str.replace(/\s+/g, ' ').trim();
  const matched = new Set();
  const result = paragraphs.map((para, pIdx) => {
    const paraText = para.text;
    const paraNorm = normalize(paraText);
    const matchingSuggestions = suggestions.filter((s, sIdx) => {
      if (matched.has(sIdx)) return false;
      if (!s.original) return false;
      const orig = s.original;
      const origNorm = normalize(orig);
      // Exact match
      if (paraText.includes(orig)) { matched.add(sIdx); return true; }
      // Normalized whitespace match
      if (paraNorm.includes(origNorm)) { matched.add(sIdx); return true; }
      // Prefix match (first 60 chars) – only for excerpt-style originals, not patterns
      const looksLikeExcerpt = !orig.includes('...') && orig.length > 60;
      if (looksLikeExcerpt) {
        const prefix = origNorm.substring(0, 60).trim();
        if (prefix.length > 15 && paraNorm.includes(prefix)) { matched.add(sIdx); return true; }
        // Suffix match (last 40 chars)
        const suffix = origNorm.slice(-40).trim();
        if (suffix.length > 15 && paraNorm.includes(suffix)) { matched.add(sIdx); return true; }
      }
      // Case-insensitive match
      if (paraNorm.toLowerCase().includes(origNorm.toLowerCase())) { matched.add(sIdx); return true; }
      return false;
    }).map((s) => ({
      ...s,
      id: s.id || `${chapterId}_p${pIdx}_s${suggestions.indexOf(s)}`,
    }));
    return { ...para, suggestions: matchingSuggestions };
  });

  // Attach unmatched suggestions — try to find the right paragraph by searching all paragraphs
  const unmatched = suggestions.filter((s, i) => !matched.has(i));
  for (const s of unmatched) {
    const suggestion = { ...s, id: s.id || `${chapterId}_unmatched_${unmatched.indexOf(s)}` };
    let placed = false;
    if (s.original) {
      // Search each paragraph for the original text
      const norm = str => str.replace(/\s+/g, ' ').toLowerCase();
      const normOrig = norm(s.original);
      for (let pi = 0; pi < result.length; pi++) {
        if (norm(result[pi].text).includes(normOrig) || normOrig.includes(norm(result[pi].text).substring(0, 40))) {
          result[pi] = { ...result[pi], suggestions: [...(result[pi].suggestions || []), suggestion] };
          placed = true;
          break;
        }
      }
      // Try partial match — first 30 chars of original
      if (!placed && normOrig.length > 30) {
        const prefix = normOrig.substring(0, 30);
        for (let pi = 0; pi < result.length; pi++) {
          if (norm(result[pi].text).includes(prefix)) {
            result[pi] = { ...result[pi], suggestions: [...(result[pi].suggestions || []), suggestion] };
            placed = true;
            break;
          }
        }
      }
    }
    // Last resort: attach to last paragraph (not first/title) with noInlineHighlight flag
    if (!placed && result.length > 1) {
      suggestion._noInline = true;
      result[result.length - 1] = { ...result[result.length - 1], suggestions: [...(result[result.length - 1].suggestions || []), suggestion] };
    } else if (!placed && result.length > 0) {
      suggestion._noInline = true;
      result[0] = { ...result[0], suggestions: [...(result[0].suggestions || []), suggestion] };
    }
  }
  return result;
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
