/*
  # Add TTS preferences to profiles table

  Adds TTS (Text-to-Speech) preferences to user profiles:
  - tts_voice: Preferred voice identifier (platform-specific)
  - tts_rate: Speech rate (0.0 to 2.0, default 0.9)
  - tts_pitch: Speech pitch (0.5 to 2.0, default 1.0)
*/

-- Add TTS preference columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tts_voice text,
ADD COLUMN IF NOT EXISTS tts_rate real DEFAULT 0.9 CHECK (tts_rate >= 0.0 AND tts_rate <= 2.0),
ADD COLUMN IF NOT EXISTS tts_pitch real DEFAULT 1.0 CHECK (tts_pitch >= 0.5 AND tts_pitch <= 2.0);

-- Add comments for documentation
COMMENT ON COLUMN profiles.tts_voice IS 'Preferred TTS voice identifier (platform-specific)';
COMMENT ON COLUMN profiles.tts_rate IS 'TTS speech rate (0.0 to 2.0, default 0.9)';
COMMENT ON COLUMN profiles.tts_pitch IS 'TTS speech pitch (0.5 to 2.0, default 1.0)';

