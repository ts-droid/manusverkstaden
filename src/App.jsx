import { useState, useRef } from "react";

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

const SAMPLE_CHAPTERS = [
  { id: 1, title: "Kap 1 – Pojken i fönstret", words: 3420, status: "done" },
  { id: 2, title: "Kap 2 – Skuggorna", words: 2890, status: "done" },
  { id: 3, title: "Kap 3 – Första dagen", words: 4100, status: "active" },
  { id: 4, title: "Kap 4 – Mörkret faller", words: 3650, status: "pending" },
  { id: 5, title: "Kap 5 – Vändpunkten", words: 5200, status: "pending" },
];

const SAMPLE_TEXT = [
  { id: "p1", text: "Morgonen grydde grå och tung över taken i Bredäng. Lägenheten på sjätte våningen var tyst, som den alltid var vid den här tiden – innan väckarklockan ringde, innan Leila vaknade, innan allt det andra.", suggestions: [] },
  { id: "p2", text: "Marcus stod vid fönstret och såg ner på parkeringen. En ensam kvinna gick med snabba steg mot tunnelbanan. Hon hade en röd jacka. Han kände inte igen henne, men det fanns något i hennes sätt att gå som påminde om hans mamma. Samma hastiga steg. Samma framåtlutade hållning, som om hon ständigt var på flykt från något.", suggestions: [
    { id: "s1", type: "style", priority: "green", level: 2, original: "Hon hade en röd jacka.", replacement: "Hennes röda jacka lyste som ett sår mot den grådaskiga asfalten.", reason: "Meningen konstaterar utan att skapa stämning. Genom att knyta jackan till omgivningen skapas kontrast och atmosfär." },
  ]},
  { id: "p3", text: "Han hade alltid hatat den där vanan han hade. Att stå vid fönstret och titta. Det kändes som att vara instängd. Instängd i sitt eget liv, instängd i den här lägenheten, instängd i allt som hade varit och allt som fortfarande var. Det kändes tungt. Allting kändes tungt.", suggestions: [
    { id: "s2", type: "repetition", priority: "yellow", level: 2, original: "instängd i sitt eget liv, instängd i den här lägenheten, instängd i allt", replacement: "instängd i sitt eget liv, i lägenheten, i allt", reason: "Trippelupprepningen av 'instängd' riskerar att kännas tung snarare än poetisk. Två räcker för mönstret." },
    { id: "s3", type: "repetition", priority: "red", level: 3, original: "Det kändes tungt. Allting kändes tungt.", replacement: "Tyngden hade lagt sig över allting.", reason: "'Kändes tungt' upprepas direkt. Kombinerat med 'instängd'-upprepningen skapas oavsiktlig monotoni." },
  ]},
  { id: "p4", text: "Leila rörde sig i sängen bakom honom. Ett svagt mummel, sedan tystnad igen. Han vände sig inte om. Det var bättre så – att hon sov, att hon inte såg honom stå här som ett spöke i gryningen.", suggestions: [
    { id: "s4", type: "style", priority: "green", level: 2, original: "som ett spöke i gryningen", replacement: "som en skugga i gryningsljuset", reason: "Smaksak: 'skugga' knyter an till kapitlets titel och skapar tematisk koherens." },
  ]},
  { id: "p5", text: "Klockan var kvart i sex. Om en timme skulle allt börja igen – rutinerna, maskerna, det ständiga spelet av att allt var som det skulle. Marcus drog ett djupt andetag och kände kaffedoften från köket. Hade han satt på kaffebryggaren? Han mindes inte. Dagarna flöt ihop.", suggestions: [
    { id: "s5", type: "structure", priority: "yellow", level: 1, original: "Hade han satt på kaffebryggaren? Han mindes inte.", replacement: null, reason: "Fin detalj som visar dissociation – överväg att återkoppla till kaffedoften senare i kapitlet för att stärka motivet." },
  ]},
];

const PRIORITY = {
  red: { label: "Måste åtgärdas", color: "#c0392b", bg: "#fdf0ef" },
  yellow: { label: "Bör övervägas", color: "#b8860b", bg: "#fdf8ef" },
  green: { label: "Smaksak", color: "#27864a", bg: "#f0faf3" },
};

const LEVEL_LABELS = { 1: "Utvecklingsred.", 2: "Stilistisk", 3: "Språkgranskning", 4: "Korrektur" };

const EMOTION_DATA = [
  { ch: "Kap 1", val: -2, label: "Melankoli, ensamhet" },
  { ch: "Kap 2", val: -4, label: "Ångest, mörker" },
  { ch: "Kap 3", val: -1, label: "Försiktig öppning" },
  { ch: "Kap 4", val: -3, label: "Bakslag, sorg" },
  { ch: "Kap 5", val: 1, label: "Vändpunkt, hopp" },
];

const DNA_PROFILE = {
  avgSentenceLen: 14.2,
  shortLongRatio: "60/40",
  dominantImagery: "Visuell (ljus/mörker), taktil",
  dialogStyle: "Kort, undvikande",
  favoriteWords: ["tystnad", "tungt", "instängd", "grå"],
  tonality: "Introvert, melankolisk, observerande",
  perspective: "Tredjeperson begränsad (Marcus)",
  tense: "Preteritum",
};

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

// ─── COMPONENTS ───

function Sidebar({ chapters, activeChapter, setActiveChapter, activeModules, setActiveModules }) {
  return (
    <aside style={{ width: 232, borderRight: `1px solid ${border}`, background: surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${border}` }}>
        <div style={{ fontFamily: uiFont, fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Kapitel</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {chapters.map(ch => (
          <button key={ch.id} onClick={() => setActiveChapter(ch.id)} style={{
            width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 7, border: "none",
            background: activeChapter === ch.id ? "#ede8e0" : "transparent", cursor: "pointer", fontFamily: font, marginBottom: 1,
          }}>
            <div style={{ fontSize: 12.5, fontWeight: activeChapter === ch.id ? 600 : 400, color: ink, lineHeight: 1.35 }}>{ch.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontFamily: uiFont, fontSize: 10, color: muted }}>
              <span>{ch.words.toLocaleString()} ord</span>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.status === "done" ? "#27864a" : ch.status === "active" ? "#b8860b" : "#d4c8bb" }} />
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}` }}>
        <div style={{ fontFamily: uiFont, fontSize: 10, color: muted, textAlign: "center" }}>
          {chapters.reduce((a, c) => a + c.words, 0).toLocaleString()} ord totalt
        </div>
      </div>
    </aside>
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

// ─── SETTINGS MODAL ───
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

        <button onClick={onClose} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>
          Spara inställningar
        </button>
      </div>
    </div>
  );
}

// ─── DEVELOP PANEL ───
function DevelopPanel() {
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
        {tab === "dna" && <DNAView />}
        {tab === "emotion" && <EmotionView />}
        {tab === "develop" && <DevelopView />}
        {tab === "brainstorm" && <BrainstormView />}
      </div>
    </div>
  );
}

function DNAView() {
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      <div style={{ padding: "10px 12px", background: bg, borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Författarens röstprofil</div>
        {Object.entries({
          "Perspektiv": DNA_PROFILE.perspective,
          "Tempus": DNA_PROFILE.tense,
          "Tonalitet": DNA_PROFILE.tonality,
          "Meningslängd (snitt)": `${DNA_PROFILE.avgSentenceLen} ord`,
          "Kort/lång fördelning": DNA_PROFILE.shortLongRatio,
          "Dialogstil": DNA_PROFILE.dialogStyle,
          "Bildspråk": DNA_PROFILE.dominantImagery,
        }).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${border}` }}>
            <span style={{ color: muted }}>{k}</span>
            <span style={{ fontWeight: 500, color: ink, textAlign: "right", maxWidth: "55%" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", background: bg, borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Favoritord</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {DNA_PROFILE.favoriteWords.map(w => (
            <span key={w} style={{ padding: "3px 10px", borderRadius: 12, background: accentLight, color: accent, fontSize: 11, fontWeight: 500 }}>{w}</span>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11, color: muted, lineHeight: 1.5, marginTop: 12, padding: "0 4px" }}>
        Profilen används som bas när ny text genereras – all AI-skapad text matchar din etablerade stil, meningsrytm och ordval.
      </p>
    </div>
  );
}

function EmotionView() {
  const maxVal = 5;
  return (
    <div style={{ fontFamily: uiFont, fontSize: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14, padding: "0 4px" }}>Emotionell bågkurva</div>
      <div style={{ padding: "16px 12px", background: bg, borderRadius: 10 }}>
        <svg viewBox="0 0 400 180" style={{ width: "100%", display: "block" }}>
          {/* Grid lines */}
          {[-4, -2, 0, 2, 4].map(v => {
            const y = 90 - (v / maxVal) * 80;
            return <line key={v} x1="40" y1={y} x2="380" y2={y} stroke={border} strokeWidth="0.5" strokeDasharray={v === 0 ? "0" : "3,3"} />;
          })}
          {/* Labels */}
          <text x="35" y="14" textAnchor="end" fill={muted} fontSize="8" fontFamily={uiFont}>+5 Ljus</text>
          <text x="35" y="93" textAnchor="end" fill={muted} fontSize="8" fontFamily={uiFont}>0</text>
          <text x="35" y="170" textAnchor="end" fill={muted} fontSize="8" fontFamily={uiFont}>-5 Mörk</text>
          
          {/* Line */}
          <polyline
            points={EMOTION_DATA.map((d, i) => `${60 + i * 75},${90 - (d.val / maxVal) * 80}`).join(" ")}
            fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          />
          {/* Gradient fill */}
          <defs>
            <linearGradient id="emotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`${60},${90} ${EMOTION_DATA.map((d, i) => `${60 + i * 75},${90 - (d.val / maxVal) * 80}`).join(" ")} ${60 + (EMOTION_DATA.length - 1) * 75},${90}`}
            fill="url(#emotGrad)"
          />
          {/* Dots */}
          {EMOTION_DATA.map((d, i) => {
            const cx = 60 + i * 75;
            const cy = 90 - (d.val / maxVal) * 80;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="4.5" fill={surface} stroke={accent} strokeWidth="2" />
                <text x={cx} y={cy + 16} textAnchor="middle" fill={ink} fontSize="7.5" fontFamily={uiFont} fontWeight="600">{d.ch}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: 12 }}>
        {EMOTION_DATA.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 4px", borderBottom: i < EMOTION_DATA.length - 1 ? `1px solid ${border}` : "none" }}>
            <span style={{ fontWeight: 500, color: ink }}>{d.ch}</span>
            <span style={{ color: d.val < 0 ? "#c0392b" : "#27864a", fontWeight: 600 }}>{d.val > 0 ? "+" : ""}{d.val}</span>
            <span style={{ color: muted, fontSize: 10.5, textAlign: "right", maxWidth: "45%" }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "10px 12px", background: "#fdf8ef", borderRadius: 8, borderLeft: `3px solid #b8860b` }}>
        <div style={{ fontWeight: 600, color: "#b8860b", fontSize: 10.5, marginBottom: 4 }}>🟡 Observation</div>
        <p style={{ margin: 0, color: "#5a4e42", fontSize: 11.5, lineHeight: 1.5 }}>
          Manuskriptet har en konsekvent mörk kurva (kap 1–4). Vändpunkten i kap 5 kommer sent – överväg att flytta ett ljusare ögonblick till kap 3 för att skapa emotionell kontrast och undvika att läsaren tröttnar.
        </p>
      </div>
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
              🪶 Generera förslag
            </button>
          </div>

          {/* Sample output */}
          <div style={{ marginTop: 14, padding: "14px 14px", background: surface, borderRadius: 9, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Förhandsvisning – AI-genererat</div>
            <p style={{ fontFamily: font, fontSize: 13.5, lineHeight: 1.75, color: ink, margin: "0 0 10px", fontStyle: "italic" }}>
              "Kaffedoften sköljde in som en påminnelse om att kroppen fortfarande fungerade, även när allt annat hade stagnerat. Marcus stod med händerna kring koppen utan att dricka. Porslinet var varmt mot handflatorna – en av få förnimmelser som fortfarande trängde igenom."
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: "none", background: "#27864a", color: "#fff", fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>Infoga i manus</button>
              <button style={{ flex: 1, padding: "7px 0", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: muted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: uiFont }}>Generera nytt</button>
            </div>
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
        💡 Brainstorma
      </button>

      {/* Sample brainstorm output */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Tre vägar framåt</div>
        {[
          { letter: "A", title: "Det tysta samtalet", desc: "Marcus och Leila har en nattlig konversation utan ord – blickar, gester, tystnad. Vändpunkten sker genom vad som inte sägs.", strength: "Stärker show-don't-tell", risk: "Kan bli otydligt" },
          { letter: "B", title: "Brevet som aldrig skickades", desc: "Marcus hittar ett gammalt brev han skrev men aldrig skickade – konfrontation med sitt yngre jag triggar förändring.", strength: "Starkt tematiskt eko", risk: "Riskerar sentimentalitet" },
          { letter: "C", title: "Spegelmötet", desc: "Ett oväntat möte med någon från förflutnan tvingar Marcus att se sig själv utifrån. Extern katalysator.", strength: "Dramaturgiskt tydligt", risk: "Kan kännas konstruerat" },
        ].map(a => (
          <div key={a.letter} style={{ padding: "12px 12px", marginBottom: 6, borderRadius: 9, border: `1px solid ${border}`, background: surface }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{a.letter}</span>
              <span style={{ fontWeight: 600, color: ink, fontSize: 12.5 }}>{a.title}</span>
            </div>
            <p style={{ margin: "0 0 6px", color: "#5a4e42", fontSize: 11.5, lineHeight: 1.5 }}>{a.desc}</p>
            <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
              <span style={{ color: "#27864a" }}>✦ {a.strength}</span>
              <span style={{ color: "#c0392b" }}>⚠ {a.risk}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TRANSLATE PANEL ───
function TranslatePanel({ langs }) {
  const [activeLang, setActiveLang] = useState(langs[0] || "en");
  const langData = LANGUAGES.find(l => l.id === activeLang);
  const isRTL = activeLang === "ar";
  
  const translations = {
    en: "The morning dawned grey and heavy over the rooftops of Bredäng. The apartment on the sixth floor was silent, as it always was at this hour – before the alarm went off, before Leila woke, before everything else.",
    de: "Der Morgen dämmerte grau und schwer über den Dächern von Bredäng. Die Wohnung im sechsten Stock war still, wie immer um diese Zeit – bevor der Wecker klingelte, bevor Leila aufwachte, bevor alles andere.",
    es: "La mañana amaneció gris y pesada sobre los tejados de Bredäng. El apartamento del sexto piso estaba en silencio, como siempre a esa hora — antes de que sonara el despertador, antes de que Leila despertara, antes de todo lo demás.",
    ar: "بزغ الصباح رماديًا وثقيلًا فوق أسطح بريدنغ. كانت الشقة في الطابق السادس صامتة، كما كانت دائمًا في هذا الوقت — قبل أن يرنّ المنبه، قبل أن تستيقظ ليلى، قبل كل شيء آخر.",
  };

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
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        <div style={{ padding: "10px 12px", background: bg, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Status</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Översatta", value: "1 kap", color: "#27864a" },
              { label: "Pågående", value: "Kap 1", color: "#b8860b" },
              { label: "Kvar", value: "4 kap", color: muted },
            ].map(s => (
              <div key={s.label} style={{ fontSize: 11 }}>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.value}</span>
                <span style={{ color: muted, marginLeft: 4 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Förhandsgranskning – Kapitel 1, stycke 1</div>
        
        <div style={{ padding: "14px 14px", background: surface, borderRadius: 9, border: `1px solid ${border}`, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: muted, marginBottom: 6 }}>🇸🇪 Original</div>
          <p style={{ fontFamily: font, fontSize: 13, lineHeight: 1.7, color: ink, margin: 0 }}>
            Morgonen grydde grå och tung över taken i Bredäng. Lägenheten på sjätte våningen var tyst, som den alltid var vid den här tiden.
          </p>
        </div>

        <div style={{ padding: "14px 14px", background: accentLight, borderRadius: 9, border: `1px solid ${accent}30`, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: accent, marginBottom: 6 }}>{langData?.flag} Översättning</div>
          <p style={{ fontFamily: font, fontSize: 13, lineHeight: 1.7, color: ink, margin: 0, direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left" }}>
            {translations[activeLang]}
          </p>
        </div>

        <div style={{ padding: "10px 12px", background: "#fdf8ef", borderRadius: 8, borderLeft: `3px solid #b8860b`, fontSize: 11.5, lineHeight: 1.5, color: "#5a4e42" }}>
          <div style={{ fontWeight: 600, color: "#b8860b", fontSize: 10, marginBottom: 4 }}>Översättningskommentar</div>
          {activeLang === "en" && "\"Grydde\" har ingen exakt engelsk motsvarighet – 'dawned' fångar innebörden men saknar den svenska formens ålderdomliga klang. Alternativ: 'broke' (mer poetiskt)."}
          {activeLang === "de" && "\"Grydde\" översatt till 'dämmerte' – bevarar den långsamma, tunga känslan. Bredäng behålls utan förklaring då tyska läsare har kulturell närhet till nordiska miljöer."}
          {activeLang === "es" && "\"Bredäng\" behålls oförändrat. Det nordiska landskapet och morgonmörkret har en annan kulturell laddning – 'pesada' (tung) förstärker känslan av tryck."}
          {activeLang === "ar" && "RTL-layout tillämpas. 'Bredäng' translittereras fonetiskt (بريدنغ). Morgonens tyngd uttrycks med 'ثقيلًا' som bär en stark fysisk konnotation på arabiska."}
        </div>

        <div style={{ marginTop: 14, padding: "10px 12px", background: bg, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Ordlista (pågående)</div>
          <div style={{ fontSize: 11 }}>
            {[
              ["Bredäng", activeLang === "ar" ? "بريدنغ" : "Bredäng", "Behålls i original"],
              ["Marcus", activeLang === "ar" ? "ماركوس" : "Marcus", "Egennamn oförändrat"],
              ["Leila", activeLang === "ar" ? "ليلى" : "Leila", activeLang === "ar" ? "Arabisk stavning" : "Oförändrat"],
            ].map(([orig, trans, note], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 8, padding: "4px 0", borderBottom: i < 2 ? `1px solid ${border}` : "none", color: ink }}>
                <span>{orig}</span>
                <span style={{ fontWeight: 500 }}>{trans}</span>
                <span style={{ color: muted, fontSize: 10 }}>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PRICING PAGE ───
function PricingPage({ onBack }) {
  const plans = [
    { name: "Prova", price: "0", unit: "", desc: "Testa med ett kapitel", features: ["1 kapitel (max 5 000 ord)", "Alla granskningsnivåer", "Grundläggande export"], cta: "Kom igång gratis", hl: false },
    { name: "Författare", price: "149", unit: "SEK / mån", desc: "För den som skriver sitt manus", features: ["2 manuskript / månad", "Upp till 120 000 ord / manus", "Alla 4 granskningsnivåer", "Alla genretillägg", "Export med ändringsmarkeringar"], cta: "Starta", hl: true },
    { name: "Professionell", price: "349", unit: "SEK / mån", desc: "Obegränsad granskning + AI-verktyg", features: ["Obegränsat antal manus", "Allt i Författare", "Skrivutvecklingsmodul 🪶", "Anpassad stilguide & ordlista", "Export .docx med Track Changes"], cta: "Välj", hl: false },
    { name: "Översättning", price: "499", unit: "SEK / mån", desc: "Allt + litterär översättning", features: ["Allt i Professionell", "Översättning EN/DE/ES/AR", "Kulturell anpassning", "Konsekvensgranskning", "Parallell visning orig/övers."], cta: "Välj", hl: false },
    { name: "Förlag", price: "Offert", unit: "", desc: "Team & företag", features: ["Flerplatslicens", "API-åtkomst", "Anpassade mallar", "SSO & fakturering"], cta: "Kontakta oss", hl: false },
  ];
  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: uiFont, fontSize: 12, color: muted, marginBottom: 28 }}>← Tillbaka</button>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: ink, margin: 0, letterSpacing: "-0.02em" }}>Priser & planer</h1>
          <p style={{ fontFamily: uiFont, fontSize: 14, color: muted, marginTop: 10, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Professionell manusgranskning till en bråkdel av en traditionell redaktör.
          </p>
          <div style={{ marginTop: 16, padding: "10px 18px", background: "#ede8e0", borderRadius: 8, display: "inline-block", fontFamily: uiFont, fontSize: 12, color: "#5a4e42" }}>
            Traditionell redaktör: <strong>16 000–40 000 SEK</strong> per manus (80 000 ord)
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
          {plans.map(p => (
            <div key={p.name} style={{
              background: p.hl ? ink : surface, color: p.hl ? "#f7f4ef" : ink, borderRadius: 14, padding: "24px 18px",
              border: p.hl ? `2px solid ${ink}` : `1px solid ${border}`, position: "relative",
              transform: p.hl ? "scale(1.02)" : "none",
              boxShadow: p.hl ? "0 10px 36px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              {p.hl && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: accent, color: "#fff", fontSize: 9, fontWeight: 600, padding: "3px 12px", borderRadius: 16, fontFamily: uiFont, textTransform: "uppercase", letterSpacing: "0.05em" }}>Populärast</div>}
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{p.name}</h3>
              <p style={{ fontFamily: uiFont, fontSize: 11, opacity: 0.6, margin: "4px 0 16px" }}>{p.desc}</p>
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em" }}>{p.price === "Offert" ? "" : ""}{p.price}</span>
                {p.unit && <span style={{ fontFamily: uiFont, fontSize: 11, opacity: 0.5, marginLeft: 4 }}>{p.unit}</span>}
                {p.price === "0" && <span style={{ fontFamily: uiFont, fontSize: 11, opacity: 0.5 }}> kr</span>}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", fontFamily: uiFont, fontSize: 11, lineHeight: 2 }}>
                {p.features.map((f, i) => <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ color: p.hl ? accent : "#27864a", flexShrink: 0 }}>✓</span>{f}</li>)}
              </ul>
              <button style={{
                width: "100%", padding: "10px 0", borderRadius: 7, fontFamily: uiFont, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: p.hl ? "none" : `1px solid ${border}`, background: p.hl ? accent : "transparent", color: p.hl ? "#fff" : ink,
              }}>{p.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══
export default function App() {
  const [view, setView] = useState("editor");
  const [activeChapter, setActiveChapter] = useState(3);
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  const [filterPriority, setFilterPriority] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [genres, setGenres] = useState(["realistic"]);
  const [modules, setModules] = useState([]);
  const [transLangs, setTransLangs] = useState(["en"]);
  const [rightPanel, setRightPanel] = useState("suggestions"); // suggestions | develop | translate

  const allSuggestions = SAMPLE_TEXT.flatMap(p => p.suggestions);
  const filtered = allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id) && (filterPriority === "all" || s.priority === filterPriority));

  if (view === "pricing") return <PricingPage onBack={() => setView("editor")} />;

  const renderText = (para) => {
    const { text, suggestions } = para;
    if (!suggestions.length) return <span>{text}</span>;
    const parts = [];
    let last = 0;
    const sorted = [...suggestions].filter(s => s.original).sort((a, b) => text.indexOf(a.original) - text.indexOf(b.original));
    for (const s of sorted) {
      const idx = text.indexOf(s.original, last);
      if (idx === -1) continue;
      if (idx > last) parts.push(<span key={`t${last}`}>{text.slice(last, idx)}</span>);
      const isAcc = accepted.has(s.id), isRej = rejected.has(s.id), isAct = activeSuggestion === s.id;
      const p = PRIORITY[s.priority];
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
      last = idx + s.original.length;
    }
    if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
    return parts.length ? parts : <span>{text}</span>;
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: font, background: bg, color: ink, overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,600;6..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <header style={{ height: 50, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, background: ink, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: bg, fontSize: 13, fontWeight: 700 }}>M</div>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>Manusverkstaden</span>
          </div>
          <div style={{ width: 1, height: 20, background: border }} />
          <span style={{ fontFamily: uiFont, fontSize: 12, color: muted }}>Mardrömsprinsen</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
            {genres.map(id => {
              const g = GENRES.find(x => x.id === id);
              return g ? <span key={id} style={{ fontSize: 14 }} title={g.label}>{g.icon}</span> : null;
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {modules.includes("develop") && (
            <button onClick={() => setRightPanel(rightPanel === "develop" ? "suggestions" : "develop")} style={{
              fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5,
              border: rightPanel === "develop" ? `1.5px solid ${accent}` : `1px solid ${border}`,
              background: rightPanel === "develop" ? accentLight : surface, color: rightPanel === "develop" ? accent : ink, cursor: "pointer", fontWeight: 500,
            }}>🪶 Utveckla</button>
          )}
          {modules.includes("translate") && (
            <button onClick={() => setRightPanel(rightPanel === "translate" ? "suggestions" : "translate")} style={{
              fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5,
              border: rightPanel === "translate" ? `1.5px solid ${accent}` : `1px solid ${border}`,
              background: rightPanel === "translate" ? accentLight : surface, color: rightPanel === "translate" ? accent : ink, cursor: "pointer", fontWeight: 500,
            }}>🌍 Översätt</button>
          )}
          <button onClick={() => setShowSettings(true)} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: `1px solid ${border}`, background: surface, color: ink, cursor: "pointer" }}>⚙ Inställningar</button>
          <button onClick={() => setView("pricing")} style={{ fontFamily: uiFont, fontSize: 11, padding: "5px 12px", borderRadius: 5, border: "none", background: accent, color: "#fff", cursor: "pointer", fontWeight: 600 }}>Priser</button>
        </div>
      </header>

      {/* ── ACTIVE MODULES BAR ── */}
      {(genres.length > 0 || modules.length > 0) && (
        <div style={{ padding: "6px 16px", background: surface, borderBottom: `1px solid ${border}`, display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontFamily: uiFont, fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Aktiva:</span>
          {genres.map(id => { const g = GENRES.find(x => x.id === id); return g ? <span key={id} style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: bg, color: "#5a4e42" }}>{g.icon} {g.label}</span> : null; })}
          {modules.includes("develop") && <span style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: accentLight, color: accent, fontWeight: 600 }}>🪶 Skrivutveckling</span>}
          {modules.includes("translate") && <span style={{ fontFamily: uiFont, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: accentLight, color: accent, fontWeight: 600 }}>🌍 Översättning: {transLangs.map(id => LANGUAGES.find(l => l.id === id)?.flag).join(" ")}</span>}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── LEFT SIDEBAR ── */}
        <Sidebar chapters={SAMPLE_CHAPTERS} activeChapter={activeChapter} setActiveChapter={setActiveChapter} />

        {/* ── MAIN TEXT ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "36px 52px", maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              {SAMPLE_CHAPTERS.find(c => c.id === activeChapter)?.title}
            </h2>
            <div style={{ display: "flex", gap: 10, marginTop: 8, fontFamily: uiFont, fontSize: 11, color: muted }}>
              <span>{SAMPLE_CHAPTERS.find(c => c.id === activeChapter)?.words.toLocaleString()} ord</span>
              <span>·</span>
              <span>{allSuggestions.filter(s => !accepted.has(s.id) && !rejected.has(s.id)).length} förslag kvar</span>
            </div>
          </div>
          {SAMPLE_TEXT.map(para => (
            <p key={para.id} style={{ fontSize: 16.5, lineHeight: 1.85, marginBottom: 22, color: "#3d2e23" }}>
              {renderText(para)}
            </p>
          ))}
        </main>

        {/* ── RIGHT PANEL ── */}
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
                    {allSuggestions.length === accepted.size + rejected.size ? <><div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>Alla förslag hanterade!</> : "Inga förslag matchar filtret."}
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
          {rightPanel === "develop" && <DevelopPanel />}
          {rightPanel === "translate" && <TranslatePanel langs={transLangs} />}
        </aside>
      </div>

      {/* ── SETTINGS MODAL ── */}
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
