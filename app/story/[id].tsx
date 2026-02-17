import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Story } from '@/types/database';
import {
  speakText,
  pauseSpeech,
  resumeSpeech,
  restartSpeech,
  getAvailableVoices,
  setPreferences,
  isSpeechPaused,
  getCurrentChunkIndex,
  TTSPreferences,
} from '@/services/tts';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getImagePromptFromStory } from '@/services/image-brief';
import { generateGeminiImageFromPrompt } from '@/services/gemini-image';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Heart,
  Trash2,
  Image as ImageIcon,
  Settings,
  X,
  ChevronDown,
} from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { mapFriendlyVoiceToSystemId, getVoiceRateMultiplier, getVoiceProfiles } from '@/lib/ttsVoiceProfiles';
import { mapSystemIdToFriendlyName } from '@/lib/ttsVoiceMapping';

// Simple Slider Component with markers - optimized for smooth interaction
function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 0.01,
  markers,
  isDark,
  style,
}: {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  markers?: number[];
  isDark?: boolean;
  style?: any;
}) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  const handlePress = (event: any) => {
    const locationX = event.nativeEvent.locationX;
    if (sliderWidth > 0) {
      const newPercentage = Math.max(0, Math.min(100, (locationX / sliderWidth) * 100));
      const newValue = minimumValue + (newPercentage / 100) * (maximumValue - minimumValue);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
      onValueChange(clampedValue);
    }
  };

  const getMarkerPosition = (markerValue: number) => {
    return ((markerValue - minimumValue) / (maximumValue - minimumValue)) * 100;
  };

  return (
    <View style={[{ marginVertical: 8 }, style]}>
      <TouchableOpacity
        activeOpacity={1}
        style={{
          height: 40,
          justifyContent: 'center',
          position: 'relative',
        }}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        onPress={handlePress}
      >
        <View
          style={{
            height: 4,
            backgroundColor: isDark ? '#1F2937' : '#E5E5EA',
            borderRadius: 2,
            position: 'relative',
          }}
        >
          {/* Markers */}
          {markers && markers.map((marker, index) => {
            const markerPos = getMarkerPosition(marker);
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: `${markerPos}%`,
                  top: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isDark ? '#4B5563' : '#8E8E93',
                  marginLeft: -4,
                }}
              />
            );
          })}
          
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${percentage}%`,
              height: 4,
              backgroundColor: '#007AFF',
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${percentage}%`,
              top: -8,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#007AFF',
              marginLeft: -10,
              borderWidth: 2,
              borderColor: '#fff',
            }}
          />
        </View>
      </TouchableOpacity>
      
      {/* Marker labels - properly centered on markers */}
      {markers && (
        <View
          style={{
            width: '100%',
            height: 20,
            position: 'relative',
            marginTop: 4,
          }}
        >
          {markers.map((marker, index) => {
            const markerPos = getMarkerPosition(marker);
            return (
              <Text
                key={index}
                style={{
                  position: 'absolute',
                  left: `${markerPos}%`,
                  fontSize: 10,
                  color: isDark ? '#9CA3AF' : '#8E8E93',
                  textAlign: 'center',
                  width: 28,
                  marginLeft: -14, // Half of width to center on marker
                }}
              >
                {marker}x
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}


export default function StoryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showTTSSettings, setShowTTSSettings] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  
  // TTS Preferences - using friendly voice names and speed
  const [ttsVoiceFriendly, setTtsVoiceFriendly] = useState<string | undefined>(undefined);
  const [ttsSpeed, setTtsSpeed] = useState<number>(profile?.tts_rate ?? 1.0); // Reuse tts_rate for speed

  useEffect(() => {
    loadStory();
    loadVoices();
  }, [id]);


  useEffect(() => {
    // Load TTS preferences from profile and convert system voice ID to friendly name
    if (profile && availableVoices.length > 0) {
      const friendlyName = mapSystemIdToFriendlyName(profile.tts_voice, availableVoices);
      setTtsVoiceFriendly(friendlyName);
      setTtsSpeed(profile.tts_rate ?? 1.0); // Use tts_rate for speed (default 1.0)
      
      console.log('[TTS] Loaded preferences from profile:', {
        profileVoiceId: profile.tts_voice,
        mappedFriendlyName: friendlyName,
        speed: profile.tts_rate ?? 1.0,
        availableVoicesCount: availableVoices?.length || 0,
      });
    }
  }, [profile, availableVoices]);

  const loadStory = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Story not found');

      setStory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    try {
      const voices = await getAvailableVoices();
      setAvailableVoices(voices);
      
      // One-time log of all available voices for debugging
      console.log('[TTS] Available system voices:', voices.map(v => ({
        identifier: v.identifier,
        name: v.name,
        language: v.language,
      })));
      
      // Log voice profile mappings
      console.log('[TTS] Voice profiles:', getVoiceProfiles().map(p => ({
        id: p.id,
        gender: p.gender,
        preferredIds: p.systemVoiceIds,
        rateMultiplier: p.rateMultiplier,
      })));
    } catch (err) {
      console.error('Failed to load voices:', err);
    }
  };

  const saveTTSPreferences = async () => {
    if (!profile) return;
    try {
      // Convert friendly voice name to system voice ID
      const systemVoiceId = ttsVoiceFriendly 
        ? mapFriendlyVoiceToSystemId(ttsVoiceFriendly, availableVoices)
        : undefined;

      console.log('[TTS] Saving preferences:', {
        friendlyVoice: ttsVoiceFriendly,
        mappedVoiceId: systemVoiceId,
        speed: ttsSpeed,
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          tts_voice: systemVoiceId,
          tts_rate: ttsSpeed, // Store speed as rate (backwards compatible)
        })
        .eq('id', profile.id);

      if (!error) {
        await refreshProfile();
        console.log('[TTS] Preferences saved successfully');
      } else {
        console.error('[TTS] Failed to save preferences:', error);
      }
    } catch (err) {
      console.error('[TTS] Failed to save TTS preferences:', err);
    }
  };

  const handlePlay = async () => {
    if (!story) return;

    // Check if speech is paused (use service state as source of truth)
    const servicePaused = isSpeechPaused();
    const currentChunk = getCurrentChunkIndex();
    
    // If paused, resume from where we left off - ALWAYS call resumeSpeech directly
    if (isPaused || servicePaused) {
      console.log('[UI handlePlay] Resuming from pause - UI paused:', isPaused, 'Service paused:', servicePaused, 'Current chunk:', currentChunk);
      setIsPlaying(true);
      setIsPaused(false);
      await resumeSpeech(); // This will resume from currentChunkIndex
      setIsPlaying(false); // Set to false when playback completes
      return;
    }
    
    // NOT paused - this is a new play, so start from beginning
    console.log('[UI handlePlay] Starting new playback from beginning (not paused)');

    // Convert friendly voice name to system voice ID
    const systemVoiceId = ttsVoiceFriendly && availableVoices.length > 0
      ? mapFriendlyVoiceToSystemId(ttsVoiceFriendly, availableVoices)
      : undefined;

    // Get rate multiplier for tone variation
    const rateMultiplier = ttsVoiceFriendly ? getVoiceRateMultiplier(ttsVoiceFriendly) : 1.0;
    const finalRate = ttsSpeed * rateMultiplier;

    // Log TTS settings before playback
    console.log('[TTS Play] Settings:', {
      friendlyVoice: ttsVoiceFriendly || 'Default',
      mappedVoiceId: systemVoiceId || 'default (system will choose)',
      baseSpeed: ttsSpeed,
      rateMultiplier: rateMultiplier,
      finalRate: finalRate,
      availableVoicesCount: availableVoices?.length || 0,
      firstFewVoices: availableVoices?.slice(0, 3).map(v => ({ name: v.name, id: v.identifier })) || [],
    });

    const preferences: TTSPreferences = {
      voice: systemVoiceId,
      rate: finalRate, // Speed * rate multiplier for tone variation
    };

    setIsPlaying(true);
    setIsPaused(false);
    await speakText(story.content, preferences);
    setIsPlaying(false);
  };

  const handlePause = () => {
    pauseSpeech();
    setIsPlaying(false);
    setIsPaused(true);
  };

  const handleRestart = async () => {
    if (!story) return;
    
    // Convert friendly voice name to system voice ID
    const systemVoiceId = ttsVoiceFriendly && availableVoices.length > 0
      ? mapFriendlyVoiceToSystemId(ttsVoiceFriendly, availableVoices)
      : undefined;

    // Get rate multiplier for tone variation
    const rateMultiplier = ttsVoiceFriendly ? getVoiceRateMultiplier(ttsVoiceFriendly) : 1.0;
    const finalRate = ttsSpeed * rateMultiplier;

    // Log TTS settings before restart
    console.log('[TTS Restart] Settings:', {
      friendlyVoice: ttsVoiceFriendly || 'Default',
      mappedVoiceId: systemVoiceId || 'default',
      baseSpeed: ttsSpeed,
      rateMultiplier: rateMultiplier,
      finalRate: finalRate,
    });

    const preferences: TTSPreferences = {
      voice: systemVoiceId,
      rate: finalRate, // Speed * rate multiplier for tone variation
    };

    setIsPlaying(true);
    await restartSpeech(story.content, preferences);
    setIsPlaying(false);
  };


  const handleSpeedChange = async (newSpeed: number) => {
    setTtsSpeed(newSpeed);
    
    // If speech is currently playing, update preferences immediately
    if (isPlaying || isPaused) {
      const systemVoiceId = ttsVoiceFriendly && availableVoices.length > 0
        ? mapFriendlyVoiceToSystemId(ttsVoiceFriendly, availableVoices)
        : undefined;
      
      const preferences: TTSPreferences = {
        voice: systemVoiceId,
        rate: newSpeed,
      };
      
      console.log('[TTS] Speed changed during playback, updating:', preferences);
      await setPreferences(preferences);
    }
    
    saveTTSPreferences();
  };

  const handleVoiceSelect = async (friendlyName: string) => {
    setTtsVoiceFriendly(friendlyName);
    setShowVoicePicker(false);
    
    // If speech is currently playing, update preferences immediately
    if (isPlaying || isPaused) {
      const systemVoiceId = friendlyName && availableVoices.length > 0
        ? mapFriendlyVoiceToSystemId(friendlyName, availableVoices)
        : undefined;
      
      // Get rate multiplier for tone variation
      const rateMultiplier = friendlyName ? getVoiceRateMultiplier(friendlyName) : 1.0;
      const finalRate = ttsSpeed * rateMultiplier;
      
      const preferences: TTSPreferences = {
        voice: systemVoiceId,
        rate: finalRate, // Speed * rate multiplier
      };
      
      console.log('[TTS] Voice changed during playback, updating:', preferences);
      await setPreferences(preferences);
    }
    
    saveTTSPreferences();
  };

  const toggleFavorite = async () => {
    if (!story) return;

    const { error } = await supabase
      .from('stories')
      .update({ is_favorite: !story.is_favorite })
      .eq('id', story.id);

    if (!error) {
      setStory({ ...story, is_favorite: !story.is_favorite });
    }
  };

  const deleteStory = async () => {
    if (!story) return;

    const { error } = await supabase.from('stories').delete().eq('id', story.id);

    if (!error) {
      router.back();
    }
  };

  const handleRegenerateImage = async () => {
    if (!story) return;
    try {
      setRegenLoading(true);
      setImageError('');

      const style = story.audience_mode === 'child'
        ? 'children book illustration, bright, colorful, friendly, simple shapes, soft lighting'
        : 'cinematic, detailed, high quality, realistic lighting, dramatic composition';

      const fallbackPrompt = `Cover illustration for "${story.title}". Topic: ${story.prompt}. Depict a key moment that matches the story. Style: ${style}. No text.`;
      const derived = await getImagePromptFromStory(story.prompt, story.content, story.audience_mode);
      const imagePrompt = derived || fallbackPrompt;

      // Use only Gemini for image generation
      const imageUrl = await generateGeminiImageFromPrompt(imagePrompt);

      if (!imageUrl) throw new Error('Could not generate an image');

      const { error: dbError } = await supabase
        .from('stories')
        .update({ image_url: imageUrl })
        .eq('id', story.id);

      if (dbError) throw dbError;

      setStory({ ...story, image_url: imageUrl });
    } catch (e: any) {
      setImageError(e?.message || 'Failed to regenerate image');
    } finally {
      setRegenLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Story not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

    const selectedVoiceDisplay = ttsVoiceFriendly 
      ? `${ttsVoiceFriendly} – ${getVoiceProfiles().find(v => v.id === ttsVoiceFriendly)?.description || ''}`
      : 'Default';

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.header, isDark && { backgroundColor: '#0F172A', borderBottomColor: '#1F2937' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color={isDark ? '#60A5FA' : '#007AFF'} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleFavorite} style={styles.headerButton}>
            <Heart
              size={24}
              color={story.is_favorite ? '#FF3B30' : (isDark ? '#9CA3AF' : '#8E8E93')}
              fill={story.is_favorite ? '#FF3B30' : 'none'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteStory} style={styles.headerButton}>
            <Trash2 size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {story.image_url && (
          <Image source={{ uri: story.image_url }} style={styles.image} />
        )}

        {imageError ? (
          <Text style={styles.imageErrorText}>{imageError}</Text>
        ) : null}

        <View style={styles.imageActions}>
          <TouchableOpacity
            style={[styles.regenButton, regenLoading && styles.regenButtonDisabled]}
            onPress={handleRegenerateImage}
            disabled={regenLoading}
          >
            {regenLoading ? (
              <View style={styles.regenButtonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.regenButtonText}>Regenerating...</Text>
              </View>
            ) : (
              <View style={styles.regenButtonContent}>
                <ImageIcon size={20} color="#fff" />
                <Text style={styles.regenButtonText}>Regenerate Image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.storyHeader}>
          <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>{story.title}</Text>
          <View style={[styles.badge, isDark && { backgroundColor: '#1E3A5F' }]}>
            <Text style={[styles.badgeText, isDark && { color: '#60A5FA' }]}>
              {story.audience_mode === 'child' ? 'Child Mode' : 'Adult Mode'}
            </Text>
          </View>
        </View>

        <View style={styles.storyContent}>
          {story.content
            .split(/\n\s*\n+/)
            .filter(p => p.trim())
            .map((paragraph, index) => (
              <Text key={index} style={[styles.storyText, isDark && { color: '#E5E7EB' }]}>
                {paragraph.replace(/\n+/g, ' ').trim()}
              </Text>
            ))}
        </View>
      </ScrollView>


      <View style={[styles.controls, isDark && { backgroundColor: '#0F172A', borderTopColor: '#1F2937' }]}>
        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={isPlaying ? handlePause : handlePlay}
        >
          {isPlaying ? (
            <Pause size={24} color="#fff" />
          ) : (
            <Play size={24} color="#fff" />
          )}
          <Text style={styles.controlButtonText}>
            {isPlaying ? 'Pause' : (isPaused ? 'Resume' : 'Play')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.stopButton]}
          onPress={handleRestart}
        >
          <RotateCcw size={24} color="#fff" />
          <Text style={styles.controlButtonText}>Restart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.settingsButton]}
          onPress={() => setShowTTSSettings(true)}
        >
          <Settings size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* TTS Settings Modal */}
      <Modal
        visible={showTTSSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTTSSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#0F172A' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && { color: '#F3F4F6' }]}>TTS Settings</Text>
              <TouchableOpacity onPress={() => setShowTTSSettings(false)}>
                <X size={24} color={isDark ? '#9CA3AF' : '#8E8E93'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Voice Picker */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingLabel, isDark && { color: '#F3F4F6' }]}>Voice</Text>
                <TouchableOpacity
                  style={[styles.voicePicker, isDark && { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                  onPress={() => setShowVoicePicker(true)}
                >
                  <Text style={[styles.voicePickerText, isDark && { color: '#E5E7EB' }]}>
                    {selectedVoiceDisplay}
                  </Text>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#8E8E93'} />
                </TouchableOpacity>
              </View>

              {/* Speed Slider */}
              <View style={styles.settingSection}>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, isDark && { color: '#F3F4F6' }]}>Speed</Text>
                  <Text style={[styles.settingValue, isDark && { color: '#9CA3AF' }]}>
                    {ttsSpeed.toFixed(1)}x
                  </Text>
                </View>
                <Slider
                  value={ttsSpeed}
                  onValueChange={handleSpeedChange}
                  minimumValue={0.5}
                  maximumValue={2.5}
                  step={0.1}
                  markers={[0.5, 1.0, 1.5, 2.0, 2.5]}
                  isDark={isDark}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Voice Picker Modal */}
      <Modal
        visible={showVoicePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVoicePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && { backgroundColor: '#0F172A' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && { color: '#F3F4F6' }]}>Select Voice</Text>
              <TouchableOpacity onPress={() => setShowVoicePicker(false)}>
                <X size={24} color={isDark ? '#9CA3AF' : '#8E8E93'} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getVoiceProfiles()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = ttsVoiceFriendly === item.id;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.voiceItem,
                      isSelected && styles.voiceItemSelected,
                      isDark && { backgroundColor: '#1E293B' },
                      isSelected && isDark && { backgroundColor: '#3B82F6' }
                    ]}
                    onPress={() => handleVoiceSelect(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.voiceItemText,
                          isDark && { color: '#E5E7EB' },
                          isSelected && styles.voiceItemTextSelected,
                          isSelected && isDark && { color: '#fff' }
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.voiceItemDescription,
                          isDark && { color: '#9CA3AF' },
                          isSelected && isDark && { color: '#E0E7FF' }
                        ]}
                      >
                        {item.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[
                    styles.voiceItem,
                    !ttsVoiceFriendly && styles.voiceItemSelected,
                    isDark && { backgroundColor: '#1E293B' },
                    !ttsVoiceFriendly && isDark && { backgroundColor: '#3B82F6' }
                  ]}
                  onPress={() => handleVoiceSelect('')}
                >
                  <Text
                    style={[
                      styles.voiceItemText,
                      isDark && { color: '#E5E7EB' },
                      !ttsVoiceFriendly && styles.voiceItemTextSelected,
                      !ttsVoiceFriendly && isDark && { color: '#fff' }
                    ]}
                  >
                    Default
                  </Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  imageActions: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  regenButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  regenButtonDisabled: {
    opacity: 0.7,
  },
  regenButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageErrorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 12,
  },
  storyHeader: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  storyContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  storyText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3C3C43',
    marginBottom: 16,
    textAlign: 'left',
  },
  controls: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  playButton: {
    backgroundColor: '#007AFF',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  settingsButton: {
    backgroundColor: '#6366F1',
    flex: 0,
    minWidth: 50,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  modalBody: {
    padding: 20,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  settingValue: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  voicePicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  voicePickerText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  voiceItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  voiceItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  voiceItemText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  voiceItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  voiceItemDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});
