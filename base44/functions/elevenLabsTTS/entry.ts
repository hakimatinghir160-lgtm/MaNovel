import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Default cinematic voices (ElevenLabs premade IDs)
// Male dialogue  → Arnold: deep, resonant, cinematic, clear (multilingual)
// Female dialogue → Rachel: soft, expressive, warm, cinematic (multilingual)
// Narration      → Daniel: distinct, measured narration voice (multilingual)
const DEFAULT_VOICES = {
  male: "VR6AewLTigWG4xSOukaG",       // Arnold — deep, resonant male dialogue
  female: "21m00Tcm4TlvDq8ikWAM",     // Rachel — soft, expressive female dialogue
  narrator: "onwK4e9ZLuTAKqWW03F9",   // Daniel — distinct narration voice
  male_old: "TxGEqnHWrfWFTfGW9XjX",   // Josh — older male
  female_old: "EXAVITQu4vr4xnSDxMaL", // Bella — older female
};

// Emotion → voice settings mapping
const EMOTION_SETTINGS = {
  romance:    { stability: 0.45, similarity_boost: 0.85, style: 0.55, speed: 0.92 },
  sadness:    { stability: 0.65, similarity_boost: 0.80, style: 0.40, speed: 0.82 },
  anger:      { stability: 0.20, similarity_boost: 0.90, style: 0.85, speed: 1.20 },
  fear:       { stability: 0.30, similarity_boost: 0.85, style: 0.70, speed: 1.10 },
  crying:     { stability: 0.55, similarity_boost: 0.80, style: 0.60, speed: 0.78 },
  excitement: { stability: 0.25, similarity_boost: 0.88, style: 0.90, speed: 1.25 },
  cold:       { stability: 0.85, similarity_boost: 0.75, style: 0.15, speed: 0.90 },
  whispering: { stability: 0.75, similarity_boost: 0.70, style: 0.20, speed: 0.80 },
  madness:    { stability: 0.10, similarity_boost: 0.95, style: 1.00, speed: 1.30 },
  calm:       { stability: 0.80, similarity_boost: 0.75, style: 0.10, speed: 0.88 },
  sarcasm:    { stability: 0.40, similarity_boost: 0.82, style: 0.65, speed: 1.05 },
  tension:    { stability: 0.35, similarity_boost: 0.88, style: 0.75, speed: 1.15 },
  neutral:    { stability: 0.55, similarity_boost: 0.78, style: 0.35, speed: 1.00 },
};

// Detect emotion from Arabic/English text
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (/صرخ|صرخت|غضب|غاضب|أنا أكرهك|اخرج|ألقي|يلعن/.test(t)) return "anger";
  if (/بكى|بكت|دموع|حزن|حزين|أبكي|تبكي|يبكي/.test(t)) return "crying";
  if (/أحبك|أحبك|قلبي|عيني|حبيبي|حبيبتي|عشقت|أعشقك/.test(t)) return "romance";
  if (/خاف|خافت|ارتعش|ارتجف|رعب|يرتجف/.test(t)) return "fear";
  if (/مجنون|مجنونة|لن أتوقف|ضحك بجنون|ضحكت/.test(t)) return "madness";
  if (/همس|بهدوء|سرّ|في أذنه|قال بصوت خافت/.test(t)) return "whispering";
  if (/حزين|بحزن|بألم|بدموع|بأسى/.test(t)) return "sadness";
  if (/بسرود|بردود|ببرود|لامبالاة|ببرودة|بدون مشاعر/.test(t)) return "cold";
  if (/بسخرية|ساخراً|ساخرة|قال ساخراً/.test(t)) return "sarcasm";
  if (/توتر|يتوتر|قلق|قلقة|متوتر/.test(t)) return "tension";
  if (/هدوء|بهدوء|بحكمة|بتأمل/.test(t)) return "calm";
  if (/فرح|فرحان|متحمس|متحمسة|رائع|رائعة|يا إلهي/.test(t)) return "excitement";
  return "neutral";
}

// Detect gender from Arabic dialogue cues
function detectGender(text) {
  if (/قالت|صرخت|بكت|همست|ضحكت|أجابت|ردت|نظرت|ابتسمت|قررت|شعرت/.test(text)) return "female";
  if (/قال|صرخ|بكى|همس|ضحك|أجاب|ردّ|نظر|ابتسم|قرر|شعر/.test(text)) return "male";
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      text,
      gender = "male",
      emotion: forcedEmotion,
      voice_id: customVoiceId,
      stability: customStability,
      similarity_boost: customSimilarity,
      style: customStyle,
      speed: customSpeed = 1.0,
      with_timestamps = false,
    } = body;

    if (!text) return Response.json({ error: 'text required' }, { status: 400 });

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return Response.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });

    // Determine voice ID: explicit custom > active cloned profile (dialogue only) > built-in defaults.
    // Narration (gender === "narrator") always uses the distinct built-in narrator
    // voice and is never overridden by a cloned profile — keeping narration clearly
    // separate from character dialogue voices.
    let voiceId = customVoiceId;
    if (!voiceId && (gender === "male" || gender === "female")) {
      try {
        const profiles = await base44.entities.VoiceProfile.filter({ is_active: true });
        const profile = profiles && profiles[0];
        if (profile) {
          voiceId = gender === "female" ? profile.female_voice_id : profile.male_voice_id;
        }
      } catch {
        // profile lookup failed — fall through to built-in defaults
      }
    }
    if (!voiceId) voiceId = DEFAULT_VOICES[gender] || DEFAULT_VOICES.narrator;

    // Determine emotion
    const emotion = forcedEmotion || detectEmotion(text);
    const emotionSettings = EMOTION_SETTINGS[emotion] || EMOTION_SETTINGS.neutral;

    // Merge custom overrides
    const stability = customStability ?? emotionSettings.stability;
    const similarity_boost = customSimilarity ?? emotionSettings.similarity_boost;
    const style = customStyle ?? emotionSettings.style;
    const speed = customSpeed * emotionSettings.speed;

    // Add emotion-based text prefix for better acting
    const emotionPrefix = {
      anger: "[angry tone] ",
      crying: "[emotional, tearful] ",
      romance: "[soft, warm] ",
      fear: "[scared, trembling] ",
      madness: "[erratic, unhinged] ",
      whispering: "[whispering] ",
      sadness: "[sad, slow] ",
      cold: "[cold, emotionless] ",
      sarcasm: "[sarcastic] ",
      tension: "[tense, urgent] ",
      calm: "[calm, measured] ",
      excitement: "[excited, energetic] ",
    }[emotion] || "";

    const useTimestamps = !!with_timestamps;
    // When requesting timestamps, skip the emotion prefix so the character
    // alignment matches the original text exactly (enables word-level karaoke).
    const processedText = useTimestamps ? text.slice(0, 800) : (emotionPrefix + text).slice(0, 800);

    const endpoint = useTimestamps
      ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`
      : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": useTimestamps ? "application/json" : "audio/mpeg",
      },
      body: JSON.stringify({
        text: processedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability,
          similarity_boost,
          style,
          use_speaker_boost: true,
          speed,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: err }, { status: response.status });
    }

    if (useTimestamps) {
      const data = await response.json();
      return Response.json({
        audio_base64: data.audio_base64,
        alignment: data.alignment || null,
        voice_id: voiceId,
        emotion,
        detected_gender: detectGender(text) || gender,
      });
    }

    const audioBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return Response.json({
      audio_base64: base64,
      voice_id: voiceId,
      emotion,
      detected_gender: detectGender(text) || gender,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});