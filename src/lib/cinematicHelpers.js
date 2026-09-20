// Shared helpers for the cinematic reading mode.
// Emotion / gender / character detection + sentence splitting + word timing.

export function detectEmotion(text) {
  const t = text;
  if (/صرخ|صرخت|غضب|أكرهك|اخرج|يلعن/.test(t)) return "anger";
  if (/بكى|بكت|دموع|حزن|أبكي|تبكي/.test(t)) return "crying";
  if (/أحبك|حبيبي|حبيبتي|عشقت|أعشقك|قلبي/.test(t)) return "romance";
  if (/خاف|خافت|ارتعش|رعب/.test(t)) return "fear";
  if (/مجنون|مجنونة|ضحك بجنون/.test(t)) return "madness";
  if (/همس|سرّ|بصوت خافت/.test(t)) return "whispering";
  if (/حزين|بحزن|بألم|بأسى/.test(t)) return "sadness";
  if (/ببرودة|بلامبالاة|بدون مشاعر/.test(t)) return "cold";
  if (/بسخرية|ساخراً|ساخرة/.test(t)) return "sarcasm";
  if (/توتر|قلق|متوتر/.test(t)) return "tension";
  if (/بهدوء|بحكمة|بتأمل/.test(t)) return "calm";
  if (/فرح|متحمس|رائع/.test(t)) return "excitement";
  return "neutral";
}

export function detectGender(text) {
  if (/قالت|صرخت|بكت|همست|ضحكت|أجابت|ردت|نظرت|ابتسمت/.test(text)) return "female";
  if (/قال|صرخ|بكى|همس|ضحك|أجاب|ردّ|نظر|ابتسم/.test(text)) return "male";
  return null;
}

export function detectCharacter(text, characters) {
  if (!characters?.length) return null;
  for (const char of characters) {
    const keywords = char.keywords || [char.name];
    for (const kw of keywords) {
      if (kw && text.includes(kw)) return char;
    }
  }
  return null;
}

// Parse chapter content into visual lines (paragraphs) with emotion + gender cues.
export function parseLines(content) {
  if (!content) return [];
  return content.split("\n").filter(l => l.trim()).map((line, i) => {
    const trimmed = line.trim();
    const hasQuote = /["«»""'']/.test(trimmed);
    const hasSpeechVerb = /قال|قالت|صرخ|صرخت|همس|همست|أجاب|أجابت|ردّ|ردت|سأل|سألت|نادى|نادت|أردف|تمتم|اعترف|أكمل|أضافت|أردفت/.test(trimmed);
    const isDialogue = hasQuote || hasSpeechVerb || /^—/.test(trimmed) || /^-/.test(trimmed) || /:\s/.test(line);
    const autoGender = detectGender(line);
    const emotion = detectEmotion(line);
    return { id: i, text: line, isDialogue, gender: autoGender || "male", emotion };
  });
}

// Split a line into sentences by Arabic + Latin punctuation (. ، ! ؟ ؛ : ! ?)
// Each sentence keeps its trailing delimiter so the original text is preserved.
export function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const parts = text.split(/([.،!؟؛:!?])/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] || "";
    const delim = parts[i + 1] || "";
    const sentence = (body + delim).trim();
    if (sentence) sentences.push(sentence);
  }
  return sentences.length ? sentences : [text.trim()];
}

// Build word-level timings from ElevenLabs character alignment.
// Returns an array of { text, start, end } or null when alignment is missing.
export function buildWordTimings(alignment) {
  if (!alignment?.characters) return null;
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];
  const words = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " " || ch === "\u00A0" || ch === "\n" || ch === "\t") {
      if (cur) { words.push(cur); cur = null; }
    } else {
      if (!cur) {
        cur = { text: ch, start: starts[i] ?? 0, end: ends[i] ?? 0 };
      } else {
        cur.text += ch;
        cur.end = ends[i] ?? cur.end;
      }
    }
  }
  if (cur) words.push(cur);
  return words.length ? words : null;
}

export const EMOTION_CONFIG = {
  anger:      { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",     label: "غضب",      dot: "bg-red-400" },
  crying:     { color: "text-blue-300",   bg: "bg-blue-500/10 border-blue-500/30",   label: "بكاء",     dot: "bg-blue-300" },
  romance:    { color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/30",   label: "رومانسية", dot: "bg-pink-400" },
  fear:       { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30",label: "خوف",      dot: "bg-violet-400" },
  madness:    { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30",label: "جنون",     dot: "bg-orange-400" },
  whispering: { color: "text-purple-300", bg: "bg-purple-500/10 border-purple-500/30",label: "همس",      dot: "bg-purple-300" },
  sadness:    { color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/30",     label: "حزن",      dot: "bg-sky-400" },
  cold:       { color: "text-slate-300",  bg: "bg-slate-500/10 border-slate-500/30",  label: "برود",     dot: "bg-slate-300" },
  sarcasm:    { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30",label: "سخرية",    dot: "bg-yellow-400" },
  tension:    { color: "text-rose-400",   bg: "bg-rose-500/10 border-rose-500/30",   label: "توتر",      dot: "bg-rose-400" },
  calm:       { color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/30",   label: "هدوء",      dot: "bg-teal-400" },
  excitement: { color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30", label: "حماس",      dot: "bg-amber-400" },
  neutral:    { color: "text-white/70",   bg: "bg-white/5 border-white/10",          label: "سرد",       dot: "bg-white/40" },
};