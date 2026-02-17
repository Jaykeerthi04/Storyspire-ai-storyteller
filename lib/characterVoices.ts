import * as Speech from 'expo-speech';
import { mapVoices } from './voiceMapping';

// Character-based narrator mapping.
// Exposes a small set of friendly character names (no raw ids) and chooses
// the best available system voice identifier for each character from the
// platform-provided voices. Also provides small pitch/rate presets by gender.

export type CharacterOption = {
  character: string; // friendly name shown in UI
  voiceIdentifier?: string; // system identifier to pass to Speech.speak()
  gender: 'female' | 'male' | 'unknown';
  pitch: number;
  rate: number;
  subtitle?: string; // short description shown in UI
};

// Define the characters and their preferred language/gender hints. The mapping
// will try to match available system voices to these hints.
const CHARACTER_DEFINITIONS: Array<{
  character: string;
  preferredLangs: string[]; // language tag preference (in order)
  gender: 'female' | 'male' | 'unknown';
  subtitle?: string;
  // Optional per-character tuning to ensure distinct tones per narrator.
  pitch?: number;
  rate?: number;
}> = [
  // Higher pitch + slightly slower rate for a warm, calm female narrator
  { character: 'Samantha', preferredLangs: ['en-us', 'en-gb', 'en'], gender: 'female', subtitle: 'Warm & calm', pitch: 1.08, rate: 0.92 },
  // Slightly lower pitch + faster rate for energetic male narrator
  { character: 'Josh', preferredLangs: ['en-us', 'en'], gender: 'male', subtitle: 'Energetic & clear', pitch: 0.98, rate: 1.06 },
  // Dreamy and soft: higher pitch, slower rate
  { character: 'Luna', preferredLangs: ['en-gb', 'en-us', 'en'], gender: 'female', subtitle: 'Dreamy & soft', pitch: 1.12, rate: 0.9 },
  // Deep & steady: lower pitch, steady rate
  { character: 'Aaron', preferredLangs: ['en-us', 'en'], gender: 'male', subtitle: 'Deep & steady', pitch: 0.92, rate: 1.0 },
  // Friendly & expressive: moderate pitch & rate
  { character: 'Jira', preferredLangs: ['hi', 'en'], gender: 'female', subtitle: 'Friendly & expressive', pitch: 1.03, rate: 0.98 },
];

// Small pitch/rate adjustments per gender to give character variety.
function presetsForGender(gender: 'female' | 'male' | 'unknown') {
  if (gender === 'female') return { pitch: 1.05, rate: 0.95 };
  if (gender === 'male') return { pitch: 0.95, rate: 1.0 };
  return { pitch: 1.0, rate: 1.0 };
}

// Build character options from the list of available system voices.
// For each character we try to find a voice matching preferred languages and gender.
export function buildCharacterOptions(availableVoices: Speech.Voice[]): CharacterOption[] {
  const mapped = mapVoices(availableVoices);

  const out: CharacterOption[] = [];

  for (const def of CHARACTER_DEFINITIONS) {
    const { character, preferredLangs, gender } = def;

    // Try to find an exact language+gender match
    let match = mapped.find(m =>
      preferredLangs.some(pl => m.languageTag === pl) && m.gender === gender
    );

    // If not found, try primary language (startsWith)
    if (!match) {
      match = mapped.find(m => preferredLangs.some(pl => m.languageTag.startsWith(pl)) && m.gender === gender);
    }

    // If still not found, accept any voice with the preferred language(s)
    if (!match) {
      match = mapped.find(m => preferredLangs.some(pl => m.languageTag.startsWith(pl)));
    }

    // Final fallback: any voice with same gender
    if (!match) {
      match = mapped.find(m => m.gender === gender);
    }

    // Use explicit per-character tuning when provided, otherwise fall back
    // to gender-based presets to maintain compatibility.
    const preset = {
      pitch: (def as any).pitch ?? presetsForGender(gender).pitch,
      rate: (def as any).rate ?? presetsForGender(gender).rate,
    };

    out.push({
      character,
      voiceIdentifier: match ? match.voice.identifier : undefined,
      gender,
      pitch: preset.pitch,
      rate: preset.rate,
      subtitle: (def as any).subtitle,
    });
  }

  return out;
}

// Helper to find the CharacterOption for a character name
export function findCharacterOption(options: CharacterOption[], character: string) {
  return options.find(o => o.character === character);
}

export {};
