import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { buildCharacterOptions } from '@/lib/characterVoices';

export interface TTSPreferences {
  voice?: string; // System voice identifier
  rate?: number;  // Speech rate (speed) - 0.5 to 2.5
  // pitch removed - not used in UI
}

export interface TTSProgress {
  currentChunk: number;
  totalChunks: number;
  progress: number; // 0 to 1
}

// Persistent state - ONLY reset when new story is loaded or restart is pressed
let isPlaying = false;
let isPaused = false;
let currentText = '';
let chunks: string[] = [];
let currentChunkIndex = 0;
let sessionId = 0;
let playbackResolve: (() => void) | null = null;
let playbackPromise: Promise<void> | null = null;
let currentPreferences: TTSPreferences = { rate: 1.0 }; // Default speed 1.0x, no pitch
let progressCallback: ((progress: TTSProgress) => void) | null = null;
let chunkStartTime: number | null = null;
let chunkStartPrefs: TTSPreferences | null = null;
let overrideFirstChunk: string | null = null;
let isInitiatingPlayback = false; // Concurrency protection

const MAX_CHUNK_LEN = 600;

function buildChunks(text: string): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > MAX_CHUNK_LEN) {
      if (buf) out.push(buf.trim());
      if (s.length > MAX_CHUNK_LEN) {
        for (let i = 0; i < s.length; i += MAX_CHUNK_LEN) {
          out.push(s.slice(i, i + MAX_CHUNK_LEN));
        }
        buf = '';
      } else {
        buf = s;
      }
    } else {
      buf = (buf ? buf + ' ' : '') + s;
    }
  }
  if (buf) out.push(buf.trim());
  return out;
}

function updateProgress() {
  if (progressCallback && chunks.length > 0) {
    progressCallback({
      currentChunk: currentChunkIndex + 1,
      totalChunks: chunks.length,
      progress: chunks.length > 0 ? (currentChunkIndex + 1) / chunks.length : 0,
    });
  }
}

function ensurePlaybackPromise(): Promise<void> {
  if (!playbackPromise) {
    playbackPromise = new Promise<void>((resolve) => {
      playbackResolve = () => {
        playbackResolve = null;
        playbackPromise = null;
        resolve();
      };
    });
  }
  return playbackPromise;
}

function speakChunkChain(startIndex: number, sid: number) {
  if (sid !== sessionId) return;
  if (startIndex >= chunks.length) {
    isPlaying = false;
    isPaused = false;
    currentChunkIndex = 0;
    updateProgress();
    playbackResolve?.();
    return;
  }

  currentChunkIndex = startIndex;
  isPlaying = true;
  isPaused = false;
  updateProgress();

  const prefs = { ...currentPreferences };
  
  // Log TTS settings for debugging
  console.log('[TTS] Speaking with preferences:', {
    voice: prefs.voice || 'default',
    rate: prefs.rate ?? 1.0,
    chunkIndex: startIndex,
    totalChunks: chunks.length,
  });
  
  const options: Speech.SpeechOptions = {
    language: 'en-US',
    rate: prefs.rate ?? 1.0, // Use rate directly (speed from UI)
    onDone: () => {
      if (sid !== sessionId) return;
      if (isPaused) return;
      // clear chunk start markers
      chunkStartTime = null;
      chunkStartPrefs = null;

      if (startIndex + 1 < chunks.length) {
        speakChunkChain(startIndex + 1, sid);
      } else {
        isPlaying = false;
        isPaused = false;
        currentChunkIndex = 0;
        updateProgress();
        playbackResolve?.();
      }
    },
    onStopped: () => {
      if (sid !== sessionId) return;
      isPlaying = false;
      // clear chunk start markers
      chunkStartTime = null;
      chunkStartPrefs = null;

      if (!isPaused) {
        updateProgress();
        playbackResolve?.();
      }
    },
    onError: () => {
      if (sid !== sessionId) return;
      isPlaying = false;
      // clear chunk start markers
      chunkStartTime = null;
      chunkStartPrefs = null;

      updateProgress();
      playbackResolve?.();
    },
  };

  // Set voice if provided - this is the system voice identifier
  if (prefs.voice) {
    options.voice = prefs.voice;
    console.log('[TTS] Using voice ID:', prefs.voice);
  } else {
    console.log('[TTS] Using default voice (no voice ID specified)');
  }
  
  // Determine text for this utterance; allow an override (remaining part of a chunk)
  let textToSpeak = chunks[startIndex] || '';
  if (overrideFirstChunk && startIndex === currentChunkIndex) {
    textToSpeak = overrideFirstChunk;
    // clear override after using it
    overrideFirstChunk = null;
  }
  
  // Safety check: ensure we have text to speak
  if (!textToSpeak || textToSpeak.trim().length === 0) {
    console.warn('[TTS] No text to speak for chunk', startIndex, '- skipping');
    return;
  }

  // Mark when this chunk started and which prefs were used (for estimating resume offset)
  chunkStartTime = Date.now();
  chunkStartPrefs = { ...prefs };

  // Final log before speaking - verify voice and rate are set correctly
  console.log('[TTS] Speech.speak() FINAL CALL:', {
    voice: options.voice || 'default (system)',
    rate: options.rate,
    language: options.language,
    textPreview: textToSpeak.substring(0, 50) + (textToSpeak.length > 50 ? '...' : ''),
    textLength: textToSpeak.length,
  });

  Speech.speak(textToSpeak, options);
}

export async function speakText(text: string, preferences?: TTSPreferences): Promise<void> {
  // Concurrency protection - prevent multiple simultaneous play initiations
  if (isInitiatingPlayback) {
    console.log('[TTS speakText] Already initiating playback - ignoring duplicate call');
    return;
  }
  
  isInitiatingPlayback = true;
  
  try {
    // If same text and paused, resume instead of restarting
    if (isPaused && currentText === text) {
      console.log('[TTS speakText] Detected pause with same text - calling resumeSpeech()');
      return await resumeSpeech();
    }
    
    // Check if this is the same text we already have chunks for
    const isSameText = currentText === text && chunks.length > 0;
    
    if (isSameText) {
      console.log('[TTS speakText] Same text, reusing existing chunks - NOT regenerating');
      // Same text, just update preferences and restart from beginning
      if (preferences) {
        currentPreferences = { ...preferences };
        console.log('[TTS speakText] Updated currentPreferences:', currentPreferences);
      }
      
      // Reset to beginning for same text playback
      currentChunkIndex = 0;
      isPaused = false;
      sessionId++;
      
      try {
        if (isPlaying) await Speech.stop();
      } catch {}
      
      const sid = sessionId;
      const p = ensurePlaybackPromise();
      speakChunkChain(0, sid);
      return p;
    }
    
    // NEW text - generate chunks ONCE and store them
    console.log('[TTS speakText] NEW text detected - generating chunks ONCE');
    currentText = text;
    chunks = buildChunks(text);
    currentChunkIndex = 0;
    isPaused = false;
    sessionId++;
    
    // Replace preferences completely (don't merge with old values)
    if (preferences) {
      currentPreferences = { ...preferences };
      console.log('[TTS speakText] Updated currentPreferences:', currentPreferences);
    }
    
    try {
      if (isPlaying) await Speech.stop();
    } catch {}
    
    const sid = sessionId;
    const p = ensurePlaybackPromise();
    speakChunkChain(0, sid);
    return p;
  } finally {
    isInitiatingPlayback = false;
  }
}

export function pauseSpeech(): void {
  // Don't reset currentChunkIndex - preserve position for resume
  isPaused = true;
  isPlaying = false;
  if (Platform.OS !== 'android') {
    try {
      Speech.pause();
    } catch {
      Speech.stop();
    }
  } else {
    Speech.stop();
  }
  updateProgress();
  console.log('[TTS pauseSpeech] Paused at chunk index:', currentChunkIndex, 'of', chunks.length);
}

export async function resumeSpeech(): Promise<void> {
  // Concurrency protection - prevent multiple simultaneous resume calls
  if (isInitiatingPlayback) {
    console.log('[TTS resumeSpeech] Already initiating playback - ignoring duplicate call');
    return;
  }
  
  if (!currentText || chunks.length === 0) {
    console.warn('[TTS resumeSpeech] No current text or chunks - cannot resume');
    return;
  }
  
  isInitiatingPlayback = true;
  
  try {
    const resumeChunkIndex = currentChunkIndex; // Save the chunk index before any operations
    console.log('[TTS resumeSpeech] Resuming from chunk index:', resumeChunkIndex, 'of', chunks.length);
    console.log('[TTS resumeSpeech] isPaused:', isPaused, 'isPlaying:', isPlaying);
    
    // Stop any existing speech first
    try {
      await Speech.stop();
    } catch {}
    
    // Don't increment sessionId - we want to continue the same session
    isPaused = false;
    isPlaying = true;
    
    if (Platform.OS !== 'android') {
      try {
        await Speech.resume();
        updateProgress();
        return ensurePlaybackPromise();
      } catch {
        // Resume failed, fall through to manual resume
        console.log('[TTS resumeSpeech] Speech.resume() failed, using manual resume');
      }
    }
    
    // Manual resume: continue from saved currentChunkIndex
    // Use the current sessionId (don't increment) and the saved chunk index
    const sid = sessionId;
    console.log('[TTS resumeSpeech] Calling speakChunkChain with saved index:', resumeChunkIndex, 'sessionId:', sid);
    speakChunkChain(resumeChunkIndex, sid);
    return ensurePlaybackPromise();
  } finally {
    isInitiatingPlayback = false;
  }
}

export async function restartSpeech(text: string, preferences?: TTSPreferences): Promise<void> {
  // Concurrency protection
  if (isInitiatingPlayback) {
    console.log('[TTS restartSpeech] Already initiating playback - ignoring duplicate call');
    return;
  }
  
  isInitiatingPlayback = true;
  
  try {
    console.log('[TTS restartSpeech] Restarting from beginning - regenerating chunks');
    
    // ALWAYS regenerate chunks on restart
    currentText = text;
    chunks = buildChunks(text);
    currentChunkIndex = 0;
    isPaused = false;
    sessionId++;
    
    // Replace preferences completely (don't merge with old values)
    if (preferences) {
      currentPreferences = { ...preferences };
      console.log('[TTS restartSpeech] Updated currentPreferences:', currentPreferences);
    }
    
    try {
      await Speech.stop();
    } catch {}
    
    const sid = sessionId;
    const p = ensurePlaybackPromise();
    speakChunkChain(0, sid);
    return p;
  } finally {
    isInitiatingPlayback = false;
  }
}

export async function seekToChunk(chunkIndex: number): Promise<void> {
  if (!currentText || chunks.length === 0) return;
  if (chunkIndex < 0 || chunkIndex >= chunks.length) return;
  
  const wasPlaying = isPlaying;
  const wasPaused = isPaused;
  
  try {
    await Speech.stop();
  } catch {}
  
  currentChunkIndex = chunkIndex;
  isPaused = false;
  sessionId++;
  updateProgress();
  
  if (wasPlaying || wasPaused) {
    const sid = sessionId;
    const p = ensurePlaybackPromise();
    speakChunkChain(chunkIndex, sid);
    return p;
  }
}

export async function setPreferences(preferences: TTSPreferences): Promise<void> {
  // Replace preferences completely (don't merge with old values)
  currentPreferences = { ...preferences };
  console.log('[TTS setPreferences] Updated currentPreferences:', currentPreferences);

  // If nothing is playing/paused, no need to restart.
  if (!isPlaying && !isPaused) return;

  // Attempt to compute the remaining portion of the current chunk so we can resume
  // roughly where the user left off instead of restarting the whole story.
  try {
    if (chunkStartTime && chunkStartPrefs && chunks[currentChunkIndex]) {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - chunkStartTime);
      const elapsedSec = elapsedMs / 1000;

      const chunkText = chunks[currentChunkIndex] || '';
      const words = chunkText.split(/\s+/).filter(Boolean);
      const totalWords = words.length || 1;

      // Estimate words per second. We assume ~180 wpm => 3 wps at rate=1.0
      const baseWps = 3;
      const usedRate = chunkStartPrefs.rate ?? 1.0;
      const wordsPerSec = baseWps * usedRate;

      const wordsSpoken = Math.floor(elapsedSec * wordsPerSec);

      if (wordsSpoken >= totalWords) {
        // If we think we've finished this chunk, advance to next chunk
        currentChunkIndex = Math.min(currentChunkIndex + 1, chunks.length - 1);
      } else if (wordsSpoken > 0) {
        const remainingWords = words.slice(wordsSpoken);
        const remainingText = remainingWords.join(' ').trim();
        if (remainingText.length > 0) {
          overrideFirstChunk = remainingText;
        }
      }
    }
  } catch (e) {
    // Fall back to restarting at the current chunk index
    overrideFirstChunk = null;
  }

  // Restart playback at the computed chunk (or overridden substring) so new prefs apply immediately.
  sessionId++;
  const sid = sessionId;
  try {
    await Speech.stop();
  } catch {}
  const p = ensurePlaybackPromise();
  speakChunkChain(currentChunkIndex, sid);
  return p;
}

export function isSpeechActive(): boolean {
  return isPlaying;
}

export function getCurrentProgress(): TTSProgress {
  return {
    currentChunk: currentChunkIndex + 1,
    totalChunks: chunks.length,
    progress: chunks.length > 0 ? (currentChunkIndex + 1) / chunks.length : 0,
  };
}

export function setProgressCallback(callback: ((progress: TTSProgress) => void) | null): void {
  progressCallback = callback;
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices;
  } catch {
    return [];
  }
}

/**
 * Speak a story using a named character voice.
 *
 * - `character` must be one of the friendly character names defined by
 *   `lib/characterVoices` (e.g. "Samantha", "Josh"). The UI shows those
 *   names — raw system identifiers are never exposed.
 * - The helper will pick the best available system voice identifier for the
 *   character on the current device and apply small, pleasant pitch/rate
 *   adjustments tuned for storytelling.
 * - Falls back to system default if no matching voice is available.
 */
export async function speakStory(text: string, character?: string): Promise<void> {
  const voices = await getAvailableVoices();
  const options = buildCharacterOptions(voices);

  let sel = undefined as undefined | { voice?: string; pitch?: number; rate?: number };
  if (character) {
    const found = options.find(o => o.character === character);
    if (found) {
      sel = { voice: found.voiceIdentifier, pitch: found.pitch, rate: found.rate };
    }
  }

  // If no explicit character provided or not found, fallback to first character option
  if (!sel && options.length > 0) {
    const first = options[0];
    sel = { voice: first.voiceIdentifier, pitch: first.pitch, rate: first.rate };
  }

  const prefs = {} as any;
  if (sel) {
    if (sel.voice) prefs.voice = sel.voice;
    if (sel.rate) prefs.rate = sel.rate;
    if (sel.pitch) prefs.pitch = sel.pitch;
  }

  await speakText(text, prefs);
}

export function getCurrentPreferences(): TTSPreferences {
  return { ...currentPreferences };
}

/**
 * Check if speech is currently paused
 */
export function isSpeechPaused(): boolean {
  return isPaused;
}

/**
 * Check if speech is currently playing
 */
export function isSpeechPlaying(): boolean {
  return isPlaying;
}

/**
 * Get the current chunk index (for debugging/resume tracking)
 */
export function getCurrentChunkIndex(): number {
  return currentChunkIndex;
}
