# TTS Resume Logic Fix - Implementation Summary

## Problem
The TTS narration was restarting from the beginning after pause → play, instead of resuming from where it left off.

## Root Cause
1. Chunks were being regenerated on every `speakText()` call
2. `currentChunkIndex` was being reset unnecessarily
3. No protection against multiple concurrent playback initiations

## Solution Implemented

### 1. Persistent State Management
Added clear documentation that state is **ONLY reset when**:
- New story is loaded (different text)
- User presses explicit Restart button

State preserved across pause/resume:
- `chunks: string[]` - Generated once and reused
- `currentChunkIndex: number` - Preserved during pause
- `isPaused: boolean` - Tracks pause state

### 2. Concurrency Protection
Added `isInitiatingPlayback` flag to prevent multiple concurrent TTS chains when play/resume is tapped repeatedly.

### 3. Smart Chunk Generation
**speakText()** now:
- Checks if text is same as current → reuses existing chunks
- Checks if paused → calls `resumeSpeech()` directly
- Only generates new chunks for NEW text

**restartSpeech()** now:
- Always regenerates chunks (explicit restart)
- Resets `currentChunkIndex = 0`
- Has concurrency protection

### 4. Resume Logic
**pauseSpeech()** now:
- Sets `isPaused = true`
- Does NOT modify `currentChunkIndex` (preserves position)
- Calls `Speech.stop()`

**resumeSpeech()** now:
- Saves `currentChunkIndex` before any operations
- Does NOT increment `sessionId` (continues same session)
- Calls `speakChunkChain(resumeChunkIndex, sid)` with saved index
- Has concurrency protection

### 5. Index Management
**speakChunkChain()** properly manages index:
- Sets `currentChunkIndex = startIndex` at start of each chunk
- Increments only in `onDone` callback: `speakChunkChain(startIndex + 1, sid)`
- Resets to 0 only when playback completes or new story loads

## Flow Diagrams

### Pause → Resume (FIXED)
```
1. Play chunk 3    → currentChunkIndex = 3
2. Pause          → isPaused = true, currentChunkIndex = 3 (preserved!)
3. Resume         → speakChunkChain(3, sid) - continues from chunk 3 ✓
```

### Restart
```
1. Currently at chunk 3
2. Restart        → chunks regenerated, currentChunkIndex = 0
3. Play           → speakChunkChain(0, sid) - starts from beginning ✓
```

### New Story Load
```
1. Load new story → new text detected
2. speakText()    → chunks generated, currentChunkIndex = 0
3. Play           → speakChunkChain(0, sid) - starts from beginning ✓
```

### Multiple Play Taps (FIXED)
```
1. Tap Play       → isInitiatingPlayback = true
2. Tap Play again → isInitiatingPlayback = true → IGNORED ✓
3. First completes → isInitiatingPlayback = false
```

## Testing Checklist

✓ Pause → Resume continues from same position
✓ Restart starts from beginning
✓ New story starts from beginning
✓ Multiple rapid play taps don't cause issues
✓ Chunks generated only once per story
✓ currentChunkIndex only resets on restart/new story

## Files Modified
- `services/tts.ts` - Complete refactor of resume logic

## UI Impact
None - UI remains unchanged, only backend TTS logic improved.
