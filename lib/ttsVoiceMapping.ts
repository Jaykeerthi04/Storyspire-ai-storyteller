import * as Speech from 'expo-speech';

/**
 * Friendly voice names for TTS Settings UI
 * Maps user-friendly names to system voice identifiers
 */
export interface FriendlyVoice {
  name: string;
  description: string;
  gender: 'female' | 'male';
  preferredKeywords: string[]; // Keywords to match in voice names/identifiers
  preferredLanguages: string[]; // Preferred language tags (en-us, en-gb, etc.)
}

export const FRIENDLY_VOICES: FriendlyVoice[] = [
  {
    name: 'Samantha',
    description: 'Warm, calm female',
    gender: 'female',
    preferredKeywords: ['samantha', 'susan', 'victoria', 'karen', 'sarah', 'emily', 'catherine'],
    preferredLanguages: ['en-us', 'en-gb', 'en'],
  },
  {
    name: 'Luna',
    description: 'Soft, storytelling female',
    gender: 'female',
    preferredKeywords: ['luna', 'linda', 'lisa', 'fiona', 'moira', 'tessa', 'hazel'],
    preferredLanguages: ['en-gb', 'en-us', 'en'],
  },
  {
    name: 'Josh',
    description: 'Clear, friendly male',
    gender: 'male',
    preferredKeywords: ['josh', 'alex', 'daniel', 'david', 'tom', 'mark'],
    preferredLanguages: ['en-us', 'en'],
  },
  {
    name: 'Aaron',
    description: 'Deep, confident male',
    gender: 'male',
    preferredKeywords: ['aaron', 'fred', 'bruce', 'thomas', 'nick', 'ralph'],
    preferredLanguages: ['en-us', 'en'],
  },
  {
    name: 'Mira',
    description: 'Bright, energetic female',
    gender: 'female',
    preferredKeywords: ['mira', 'kate', 'nancy', 'helen', 'zira'],
    preferredLanguages: ['en-us', 'en-gb', 'en'],
  },
  {
    name: 'Leo',
    description: 'Neutral narrator male',
    gender: 'male',
    preferredKeywords: ['leo', 'john', 'michael', 'james', 'robert', 'richard'],
    preferredLanguages: ['en-us', 'en-gb', 'en'],
  },
];

/**
 * Maps a friendly voice name to a system voice identifier
 * Returns undefined if no match is found
 */
export function mapFriendlyVoiceToSystemId(
  friendlyName: string,
  availableVoices: Speech.Voice[]
): string | undefined {
  console.log('[Voice Mapping] Mapping friendly name:', friendlyName, 'from', availableVoices?.length || 0, 'available voices');
  
  if (!friendlyName || friendlyName.trim() === '') {
    console.log('[Voice Mapping] Empty friendly name, returning undefined');
    return undefined;
  }

  if (!availableVoices || availableVoices.length === 0) {
    console.warn('[Voice Mapping] No available voices provided!');
    return undefined;
  }

  const voiceDef = FRIENDLY_VOICES.find(v => v.name.toLowerCase() === friendlyName.toLowerCase());
  if (!voiceDef) {
    console.warn('[Voice Mapping] No voice definition found for:', friendlyName);
    return undefined;
  }
  
  console.log('[Voice Mapping] Found voice definition for', friendlyName, '- searching for match...');

  // Helper to guess gender from voice name/identifier
  const guessGender = (voice: Speech.Voice): 'female' | 'male' | 'unknown' => {
    const nameLower = voice.name?.toLowerCase() || '';
    const idLower = voice.identifier?.toLowerCase() || '';
    const combined = nameLower + ' ' + idLower;

    const femaleKeywords = ['female', 'woman', 'samantha', 'susan', 'victoria', 'karen', 'sarah', 
                           'emily', 'catherine', 'linda', 'lisa', 'fiona', 'moira', 'tessa', 'hazel',
                           'kate', 'nancy', 'helen', 'zira'];
    const maleKeywords = ['male', 'man', 'alex', 'daniel', 'david', 'tom', 'mark', 'josh', 'aaron',
                         'fred', 'bruce', 'thomas', 'nick', 'ralph', 'john', 'michael', 'james',
                         'robert', 'richard'];

    if (femaleKeywords.some(k => combined.includes(k))) return 'female';
    if (maleKeywords.some(k => combined.includes(k))) return 'male';
    return 'unknown';
  };

  // Helper to extract language tag from voice identifier
  const extractLangTag = (voice: Speech.Voice): string => {
    const id = voice.identifier?.toLowerCase() || '';
    // Match patterns like en-us, en-gb, en-in, etc.
    const match = id.match(/([a-z]{2})-([a-z]{2})/);
    if (match) return match[0];
    // Match 2-letter language codes
    const langMatch = id.match(/^([a-z]{2})-/);
    if (langMatch) return langMatch[1];
    return 'en'; // Default to English
  };

  // Try to find best matching voice
  const voicesWithMetadata = availableVoices.map(voice => ({
    voice,
    gender: guessGender(voice),
    langTag: extractLangTag(voice),
    nameLower: voice.name?.toLowerCase() || '',
    idLower: voice.identifier?.toLowerCase() || '',
  }));

  // Priority 1: Exact keyword match + gender match + preferred language
  for (const keyword of voiceDef.preferredKeywords) {
    for (const lang of voiceDef.preferredLanguages) {
      const match = voicesWithMetadata.find(
        v => (v.nameLower.includes(keyword) || v.idLower.includes(keyword)) &&
             v.gender === voiceDef.gender &&
             (v.langTag === lang || v.langTag.startsWith(lang.split('-')[0]))
      );
      if (match) {
        console.log('[Voice Mapping] Found match for', friendlyName, ':', match.voice.identifier, '(', match.voice.name, ')');
        return match.voice.identifier;
      }
    }
  }

  // Priority 2: Gender match + preferred language (no keyword)
  for (const lang of voiceDef.preferredLanguages) {
    const match = voicesWithMetadata.find(
      v => v.gender === voiceDef.gender &&
           (v.langTag === lang || v.langTag.startsWith(lang.split('-')[0]))
    );
    if (match) {
      console.log('[Voice Mapping] Found gender+lang match for', friendlyName, ':', match.voice.identifier);
      return match.voice.identifier;
    }
  }

  // Priority 3: Gender match only
  const genderMatch = voicesWithMetadata.find(v => v.gender === voiceDef.gender);
  if (genderMatch) {
    console.log('[Voice Mapping] Found gender match for', friendlyName, ':', genderMatch.voice.identifier);
    return genderMatch.voice.identifier;
  }

  // Priority 4: Preferred language only
  for (const lang of voiceDef.preferredLanguages) {
    const match = voicesWithMetadata.find(
      v => v.langTag === lang || v.langTag.startsWith(lang.split('-')[0])
    );
    if (match) return match.voice.identifier;
  }

  // Fallback: return first available voice or undefined
  const fallbackVoice = availableVoices[0]?.identifier;
  console.log('[Voice Mapping] No match found for', friendlyName, '- using fallback:', fallbackVoice || 'none');
  return fallbackVoice;
}

/**
 * Maps a system voice identifier back to a friendly name
 */
export function mapSystemIdToFriendlyName(
  systemId: string | undefined,
  availableVoices: Speech.Voice[]
): string | undefined {
  if (!systemId) return undefined;

  const voice = availableVoices.find(v => v.identifier === systemId);
  if (!voice) return undefined;

  // Try to match based on voice name/identifier
  const nameLower = voice.name?.toLowerCase() || '';
  const idLower = voice.identifier?.toLowerCase() || '';
  const combined = nameLower + ' ' + idLower;

  // Try to match against voice profiles
  const profiles = getVoiceProfiles();
  
  // Check if this system voice ID matches any profile's preferred IDs
  for (const profile of profiles) {
    for (const preferredId of profile.systemVoiceIds) {
      if (voice.identifier === preferredId || 
          voice.identifier.toLowerCase().includes(preferredId.toLowerCase()) ||
          preferredId.toLowerCase().includes(voice.identifier.toLowerCase())) {
        return profile.id;
      }
    }
  }
  
  // If no exact match, try to guess based on gender
  const guessGender = (v: Speech.Voice): 'female' | 'male' | 'unknown' => {
    const n = v.name?.toLowerCase() || '';
    const i = v.identifier?.toLowerCase() || '';
    const c = n + ' ' + i;
    const femaleKeywords = ['female', 'woman', 'samantha', 'susan', 'victoria', 'karen', 'sarah', 'sfg', 'gba'];
    const maleKeywords = ['male', 'man', 'alex', 'daniel', 'david', 'tom', 'mark', 'dfc', 'gbb'];
    if (femaleKeywords.some(k => c.includes(k))) return 'female';
    if (maleKeywords.some(k => c.includes(k))) return 'male';
    return 'unknown';
  };

  const gender = guessGender(voice);
  if (gender === 'female') {
    // Return first female voice profile
    return profiles.find(v => v.gender === 'female')?.id;
  } else if (gender === 'male') {
    // Return first male voice profile
    return profiles.find(v => v.gender === 'male')?.id;
  }

  return undefined;
}

