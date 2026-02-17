import * as Speech from 'expo-speech';

/**
 * Fixed voice profiles with predefined system voice IDs and rate multipliers
 * These create distinct tones through speed variation (not pitch)
 */
export interface VoiceProfile {
  id: string; // Friendly name (e.g., "Samantha")
  name: string; // Display name
  description: string; // User-facing description
  gender: 'male' | 'female';
  systemVoiceIds: string[]; // Preferred system voice IDs in order of preference
  rateMultiplier: number; // Multiplier for base speed (creates tone variation)
}

/**
 * Fixed voice profiles - these are the only voices users can select
 * Each profile has specific system voice IDs that should be used
 */
export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'Samantha',
    name: 'Samantha',
    description: 'Warm, calm female',
    gender: 'female',
    systemVoiceIds: [
      'com.apple.ttsbundle.Samantha-compact', // iOS
      'com.apple.voice.compact.en-US.Samantha', // iOS alternative
      'en-us-x-sfg-local', // Android (Samantha-like)
      'en-us-x-sfg-network', // Android network
    ],
    rateMultiplier: 0.9, // Medium-slow for warm tone
  },
  {
    id: 'Luna',
    name: 'Luna',
    description: 'Soft, storytelling female',
    gender: 'female',
    systemVoiceIds: [
      'com.apple.ttsbundle.Victoria-compact', // iOS
      'com.apple.voice.compact.en-GB.Victoria', // iOS UK
      'en-gb-x-gba-local', // Android (female UK)
      'en-us-x-sfg-local', // Android fallback
    ],
    rateMultiplier: 0.85, // Slower for soft, dreamy tone
  },
  {
    id: 'Mira',
    name: 'Mira',
    description: 'Bright, energetic female',
    gender: 'female',
    systemVoiceIds: [
      'com.apple.ttsbundle.Karen-compact', // iOS
      'com.apple.voice.compact.en-AU.Karen', // iOS Australian
      'en-us-x-sfg-network', // Android
      'en-us-x-sfg-local', // Android fallback
    ],
    rateMultiplier: 1.1, // Faster for bright, energetic tone
  },
  {
    id: 'Josh',
    name: 'Josh',
    description: 'Clear, friendly male',
    gender: 'male',
    systemVoiceIds: [
      'com.apple.ttsbundle.Alex-compact', // iOS
      'com.apple.voice.compact.en-US.Alex', // iOS alternative
      'en-us-x-dfc-local', // Android (male US)
      'en-us-x-dfc-network', // Android network
    ],
    rateMultiplier: 1.0, // Medium speed
  },
  {
    id: 'Aaron',
    name: 'Aaron',
    description: 'Deep, confident male',
    gender: 'male',
    systemVoiceIds: [
      'com.apple.ttsbundle.Daniel-compact', // iOS (deeper male)
      'com.apple.voice.compact.en-GB.Daniel', // iOS UK
      'en-gb-x-gbb-local', // Android (male UK - deeper)
      'en-us-x-dfc-local', // Android fallback
    ],
    rateMultiplier: 0.9, // Slower for deep, confident tone
  },
  {
    id: 'Leo',
    name: 'Leo',
    description: 'Neutral narrator male',
    gender: 'male',
    systemVoiceIds: [
      'com.apple.ttsbundle.Tom-compact', // iOS
      'com.apple.voice.compact.en-US.Tom', // iOS alternative
      'en-us-x-dfc-network', // Android
      'en-us-x-dfc-local', // Android fallback
    ],
    rateMultiplier: 1.05, // Slightly faster for energetic narrator
  },
];

/**
 * Maps a friendly voice name to a system voice ID from available voices
 * Uses the predefined voice profiles and finds the best match
 */
export function mapFriendlyVoiceToSystemId(
  friendlyName: string,
  availableVoices: Speech.Voice[]
): string | undefined {
  console.log('[Voice Mapping] Mapping friendly name:', friendlyName);
  console.log('[Voice Mapping] Available voices count:', availableVoices?.length || 0);
  
  if (!friendlyName || friendlyName.trim() === '') {
    console.log('[Voice Mapping] Empty friendly name, returning undefined');
    return undefined;
  }

  if (!availableVoices || availableVoices.length === 0) {
    console.warn('[Voice Mapping] No available voices provided!');
    return undefined;
  }

  // Find the voice profile
  const profile = VOICE_PROFILES.find(p => p.id.toLowerCase() === friendlyName.toLowerCase());
  if (!profile) {
    console.warn('[Voice Mapping] No profile found for:', friendlyName);
    return undefined;
  }

  console.log('[Voice Mapping] Found profile:', profile.id, '- gender:', profile.gender);
  console.log('[Voice Mapping] Preferred system voice IDs:', profile.systemVoiceIds);

  // Log all available voices for debugging
  console.log('[Voice Mapping] All available voices:', 
    availableVoices.map(v => ({ 
      identifier: v.identifier, 
      name: v.name,
      language: v.language 
    }))
  );

  // Helper to guess gender from voice name/identifier
  const guessGender = (voice: Speech.Voice): 'male' | 'female' | 'unknown' => {
    const nameLower = voice.name?.toLowerCase() || '';
    const idLower = voice.identifier?.toLowerCase() || '';
    const combined = nameLower + ' ' + idLower;

    const femaleKeywords = ['female', 'woman', 'samantha', 'susan', 'victoria', 'karen', 'sarah', 
                           'emily', 'catherine', 'linda', 'lisa', 'fiona', 'moira', 'tessa', 'hazel',
                           'kate', 'nancy', 'helen', 'zira', 'sfg', 'gba'];
    const maleKeywords = ['male', 'man', 'alex', 'daniel', 'david', 'tom', 'mark', 'josh', 'aaron',
                         'fred', 'bruce', 'thomas', 'nick', 'ralph', 'john', 'michael', 'james',
                         'robert', 'richard', 'dfc', 'gbb'];

    if (femaleKeywords.some(k => combined.includes(k))) return 'female';
    if (maleKeywords.some(k => combined.includes(k))) return 'male';
    return 'unknown';
  };

  // Priority 1: Try to find exact matches from preferred system voice IDs
  for (const preferredId of profile.systemVoiceIds) {
    const exactMatch = availableVoices.find(v => v.identifier === preferredId);
    if (exactMatch) {
      console.log('[Voice Mapping] Found exact match:', preferredId, '(', exactMatch.name, ')');
      return exactMatch.identifier;
    }
  }

  // Priority 2: Find voices matching preferred IDs (partial match)
  for (const preferredId of profile.systemVoiceIds) {
    const partialMatch = availableVoices.find(v => 
      v.identifier.toLowerCase().includes(preferredId.toLowerCase()) ||
      preferredId.toLowerCase().includes(v.identifier.toLowerCase())
    );
    if (partialMatch) {
      const voiceGender = guessGender(partialMatch);
      if (voiceGender === profile.gender || voiceGender === 'unknown') {
        console.log('[Voice Mapping] Found partial match:', partialMatch.identifier, '(', partialMatch.name, ')');
        return partialMatch.identifier;
      }
    }
  }

  // Priority 3: Find any voice with matching gender (from preferred IDs keywords)
  const genderMatches: Speech.Voice[] = [];
  for (const voice of availableVoices) {
    const voiceGender = guessGender(voice);
    if (voiceGender === profile.gender) {
      genderMatches.push(voice);
    }
  }

  if (genderMatches.length > 0) {
    // Prefer voices that match preferred ID patterns
    for (const preferredId of profile.systemVoiceIds) {
      const keyword = preferredId.split('.').pop()?.toLowerCase() || '';
      const match = genderMatches.find(v => 
        v.identifier.toLowerCase().includes(keyword) ||
        v.name?.toLowerCase().includes(keyword)
      );
      if (match) {
        console.log('[Voice Mapping] Found gender match with keyword:', match.identifier, '(', match.name, ')');
        return match.identifier;
      }
    }
    
    // Use first gender-matched voice
    console.log('[Voice Mapping] Using first gender-matched voice:', genderMatches[0].identifier, '(', genderMatches[0].name, ')');
    return genderMatches[0].identifier;
  }

  // Priority 4: Fallback - log warning and return first available voice
  console.warn('[Voice Mapping] No gender-matched voice found for', friendlyName, '- using first available voice');
  console.warn('[Voice Mapping] This may result in wrong gender voice!');
  return availableVoices[0]?.identifier;
}

/**
 * Gets the rate multiplier for a voice profile
 */
export function getVoiceRateMultiplier(friendlyName: string): number {
  const profile = VOICE_PROFILES.find(p => p.id.toLowerCase() === friendlyName.toLowerCase());
  return profile?.rateMultiplier ?? 1.0;
}

/**
 * Gets all voice profiles (for UI display)
 */
export function getVoiceProfiles(): VoiceProfile[] {
  return VOICE_PROFILES;
}

