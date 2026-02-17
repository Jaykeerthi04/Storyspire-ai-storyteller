export type AudienceMode = 'child' | 'adult';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  preferred_mode: AudienceMode;
  tts_voice?: string;
  tts_rate?: number;
  tts_pitch?: number;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  content: string;
  audience_mode: AudienceMode;
  image_url?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}
