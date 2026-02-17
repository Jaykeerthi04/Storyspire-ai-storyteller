import * as Speech from 'expo-speech';

// Lightweight mapping utilities to convert raw voice identifiers (often
// platform/system codes on Android like `en-gb-x-gba-local`) into friendly
// display names for users, and to choose a sensible default per language.

type Gender = 'female' | 'male' | 'unknown';

const languageLabels: Record<string, string> = {
  en: 'English',
  'en-gb': 'English (UK)',
  'en-us': 'English (US)',
  hi: 'Hindi',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
};

// Keywords used to guess the voice gender from name/identifier
const femaleKeywords = ['female', 'woman', 'f', 'samantha', 'karen', 'sarah', 'siri', 'zira'];
const maleKeywords = ['male', 'man', 'm', 'alex', 'daniel', 'david', 'tom', 'john'];

// Try to extract a language tag from the voice identifier or name.
function extractLangTag(voice: Speech.Voice): string | undefined {
  const candidates = [voice.identifier, voice.name];
  for (const s of candidates) {
    if (!s) continue;
    // common form: en-GB, en-gb-x-gba-local, hi-IN
    const match = s.match(/([a-z]{2}(?:-[a-z]{2,3})?)/i);
    if (match) return match[1].toLowerCase();
  }
  return undefined;
}

function guessGender(voice: Speech.Voice): Gender {
  const text = `${voice.name || ''} ${voice.identifier || ''}`.toLowerCase();
  if (femaleKeywords.some(k => text.includes(k))) return 'female';
  if (maleKeywords.some(k => text.includes(k))) return 'male';
  return 'unknown';
}

// Convert a single voice into a friendly label, avoiding exposing raw ids.
export function mapVoiceToFriendlyName(voice: Speech.Voice): string {
  // Prefer an already human-readable name if it clearly differs from the id
  if (voice.name && voice.name.trim() && voice.identifier && !voice.name.includes(voice.identifier)) {
    return voice.name;
  }

  const langTag = extractLangTag(voice) || 'unknown';
  const langLabel = languageLabels[langTag] || languageLabels[langTag.split('-')[0]] || 'Unknown Language';
  const gender = guessGender(voice);

  // Build friendly label: "English (UK) – Female" or "Hindi – Female"
  const genderLabel = gender === 'unknown' ? '' : ` – ${gender.charAt(0).toUpperCase()}${gender.slice(1)}`;
  return `${langLabel}${genderLabel}`;
}

// Map all voices into an array with friendly names for UI use.
export function mapVoices(voices: Speech.Voice[]) {
  return voices.map(v => ({
    voice: v,
    displayName: mapVoiceToFriendlyName(v),
    languageTag: extractLangTag(v) || '',
    gender: guessGender(v),
  }));
}

// Simple language detection from story text. This keeps things lightweight and
// works offline: detect Devanagari characters for Hindi, otherwise default to English.
export function detectLanguageFromText(text: string): string {
  if (!text) return 'en';
  // Devanagari block (Hindi, Marathi, Nepali etc.)
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  // Quick heuristic: presence of common Hindi words
  if (/\b(है|और|में|की|हूँ|हैं)\b/.test(text)) return 'hi';
  // Default to English for now
  return 'en';
}

// Choose a default voice identifier for a target language from available voices.
// Prefers female voices for narration, falls back to any voice matching the language tag,
// otherwise returns undefined to use the system default.
export function chooseDefaultVoice(voices: Speech.Voice[], targetLang: string): string | undefined {
  const mapped = mapVoices(voices);

  // Match exact language tag first (e.g., en-gb)
  const exact = mapped.find(m => m.languageTag === targetLang && m.gender === 'female');
  if (exact) return exact.voice.identifier;

  // Match primary language (e.g., en)
  const primary = mapped.find(m => m.languageTag.startsWith(targetLang) && m.gender === 'female');
  if (primary) return primary.voice.identifier;

  // If no female match, take any voice with the lang
  const anyLang = mapped.find(m => m.languageTag.startsWith(targetLang));
  if (anyLang) return anyLang.voice.identifier;

  // Nothing matched; return undefined (use system default)
  return undefined;
}

export {};
