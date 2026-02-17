import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { generateStory } from '@/services/gemini';
import { generateStoryOpenRouter } from '@/services/openrouter';
import { generateStoryImage } from '@/services/gemini';
import { getImagePromptFromStory } from '@/services/image-brief';
import { supabase } from '@/lib/supabase';
import { AudienceMode } from '@/types/database';
import { Sparkles, Baby, User } from 'lucide-react-native';

function extractKeyTerms(text: string): string {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const stop = new Set([
    'a','an','the','in','on','at','for','of','to','and','or','but','with','about','from','by','into','over','after','before','between','through','during','without','within','along','across','behind','beyond','under','above','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','can','will','just','is','was','are','were','be','been','being','have','has','had','do','does','did','i','you','he','she','it','we','they','me','him','her','them','my','your','his','its','our','their','this','that','these','those','story','tale','narrative'
  ]);
  const tokens = cleaned.split(' ');
  const words = tokens.filter(w => w.length > 3 && !stop.has(w));
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
  return top.join(' ');
}

function buildImagePrompt(topic: string, storyContent: string, audienceMode: AudienceMode): string {
  const brief = (storyContent || '').replace(/\s+/g, ' ').trim().slice(0, 450);
  const style = audienceMode === 'child'
    ? 'children book illustration, bright, colorful, friendly, simple shapes, soft lighting'
    : 'cinematic, detailed, high quality, realistic lighting, dramatic composition';
  return `Cover illustration for the story. Topic: "${topic}". Depict key elements from this story excerpt: ${brief}. Style: ${style}. No text.`;
}

function needsRefinement(content: string, topic: string): boolean {
  const contentLower = (content || '').toLowerCase();
  const topicLower = (topic || '').toLowerCase();
  const words = topicLower.split(/\s+/).filter(w => w.length > 3);
  const unique = Array.from(new Set(words));
  if (unique.length === 0) return false;
  const matched = unique.filter(w => contentLower.includes(w)).length;
  const minMatches = Math.min(3, unique.length);
  const hasExact = contentLower.includes(topicLower);
  return matched < minMatches && !hasExact;
}

export default function Home() {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(
    profile?.preferred_mode || 'adult'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageWarning, setImageWarning] = useState('');

  // Debug: Check API key on mount
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ Gemini API key not set or using placeholder');
    } else {
      console.log('✅ Gemini API key is set');
    }
  }, []);

  const handleGenerateStory = async () => {
    if (!prompt.trim()) {
      setError('Please enter a story idea');
      return;
    }

    if (!user) {
      setError('Please log in to generate stories');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const terms = extractKeyTerms(prompt);
      const enforcedPrompt = `Topic: "${prompt}". Key terms: ${terms || '(no specific terms)'}. Include the exact phrase "${prompt}" in the opening section. Keep the entire story strictly about "${prompt}".`;
      let story;
      try {
        story = await generateStory(enforcedPrompt, audienceMode);
      } catch (e: any) {
        console.error('Gemini API error:', e);
        // Fallback to OpenRouter if available
        if (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY) {
          try {
            story = await generateStoryOpenRouter(enforcedPrompt, audienceMode);
          } catch (openRouterError: any) {
            console.error('OpenRouter API error:', openRouterError);
            throw new Error(
              e?.message || openRouterError?.message || 
              'Failed to generate story. Please check your API keys and try again.'
            );
          }
        } else {
          throw new Error(
            e?.message || 
            'Failed to generate story. Please check your Gemini API key in the .env file.'
          );
        }
      }
      if (!story || !story.title || !story.content) {
        throw new Error('Invalid story response. Please try again.');
      }

      if (needsRefinement(story.content, prompt)) {
        const refinePrompt = `STRICT REWRITE.

Topic (verbatim): "${prompt}"
Requirements:
1) Keep the story strictly about "${prompt}" in every section.
2) Mention the exact phrase "${prompt}" in the opening.
3) Preserve or exceed the required length for ${audienceMode === 'child' ? 'child' : 'adult'} mode.
4) Return JSON with fields "title" and "content" only.

Rewrite the following story to fully align with the topic while preserving narrative quality:
Title: ${story.title}
Content:
${story.content}`;
        try {
          story = await generateStory(refinePrompt, audienceMode);
        } catch (e: any) {
          console.error('Refinement error:', e);
          if (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY) {
            try {
              story = await generateStoryOpenRouter(refinePrompt, audienceMode);
            } catch (openRouterError: any) {
              console.error('OpenRouter refinement error:', openRouterError);
              // Use the original story if refinement fails
              console.warn('Using original story without refinement');
            }
          } else {
            // Use the original story if refinement fails
            console.warn('Using original story without refinement');
          }
        }
      }
      let imageUrl: string | null = null;
      try {
        const derivedImagePrompt = await getImagePromptFromStory(prompt, story.content, audienceMode);
        if (!derivedImagePrompt) throw new Error('Failed to derive image prompt from story');
        imageUrl = await generateStoryImage(derivedImagePrompt);
      } catch (imgErr: any) {
        // Log full error for diagnostics, but do not fail story creation
        console.error('[image] Gemini generation error:', imgErr);
        setImageWarning('Image generation failed. You can try regenerating the image from the story screen.');
        imageUrl = null;
      }

      if (!story || !story.title || !story.content) {
        throw new Error('Story generation returned invalid data. Please try again.');
      }

      const { data, error: dbError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          title: story.title,
          prompt: prompt,
          content: story.content,
          audience_mode: audienceMode,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to save story: ${dbError.message}`);
      }

      if (!data) {
        throw new Error('Failed to save story. Please try again.');
      }

      router.push(`/story/${data.id}`);
      setPrompt('');
    } catch (err: any) {
      console.error('Story generation error:', err);
      const errorMessage = err?.message || err?.toString() || 'Failed to generate story';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setAudienceMode((prev) => (prev === 'child' ? 'adult' : 'child'));
  };

  return (
    <ScrollView style={[styles.container, isDark && { backgroundColor: '#0B1220' }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Sparkles size={48} color={isDark ? '#60A5FA' : '#007AFF'} />
        <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>Storyspire</Text>
        <Text style={[styles.subtitle, isDark && { color: '#9CA3AF' }]}>
          Welcome, {profile?.full_name || 'Storyteller'}!
        </Text>
      </View>

      <View style={[styles.modeSelector, isDark && { backgroundColor: '#0F172A' }]}>
        <View style={styles.modeOption}>
          <Baby
            size={24}
            color={audienceMode === 'child' ? (isDark ? '#60A5FA' : '#007AFF') : (isDark ? '#9CA3AF' : '#8E8E93')}
          />
          <Text
            style={[
              styles.modeText,
              isDark && { color: '#9CA3AF' },
              audienceMode === 'child' && [styles.modeTextActive, isDark && { color: '#60A5FA' }],
            ]}
          >
            Child Mode
          </Text>
        </View>

        <Switch
          value={audienceMode === 'adult'}
          onValueChange={toggleMode}
          trackColor={{ false: '#34C759', true: isDark ? '#60A5FA' : '#007AFF' }}
          thumbColor="#fff"
        />

        <View style={styles.modeOption}>
          <User
            size={24}
            color={audienceMode === 'adult' ? (isDark ? '#60A5FA' : '#007AFF') : (isDark ? '#9CA3AF' : '#8E8E93')}
          />
          <Text
            style={[
              styles.modeText,
              isDark && { color: '#9CA3AF' },
              audienceMode === 'adult' && [styles.modeTextActive, isDark && { color: '#60A5FA' }],
            ]}
          >
            Adult Mode
          </Text>
        </View>
      </View>

      <View style={[styles.promptSection, isDark && { backgroundColor: '#0F172A' }]}>
        <Text style={[styles.label, isDark && { color: '#F3F4F6' }]}>What story would you like to create?</Text>
        <TextInput
          style={[styles.input, isDark && { backgroundColor: '#1E293B', borderColor: '#334155', color: '#F3F4F6' }]}
          placeholder={
            audienceMode === 'child'
              ? 'e.g., A brave little dragon who learns to fly'
              : 'e.g., A detective in a magical city solving supernatural crimes'
          }
          placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {imageWarning ? <Text style={[styles.error, { backgroundColor: '#FFF4E5', color: '#8A5800' }]}>{imageWarning}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGenerateStory}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>Generating...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Sparkles size={20} color="#fff" />
              <Text style={styles.buttonText}>Generate Story</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.infoBox, isDark && { backgroundColor: '#1E3A5F' }]}>
        <Text style={[styles.infoTitle, isDark && { color: '#60A5FA' }]}>
          {audienceMode === 'child' ? 'Child Mode' : 'Adult Mode'}
        </Text>
        <Text style={[styles.infoText, isDark && { color: '#93C5FD' }]}>
          {audienceMode === 'child'
            ? 'Stories will be simple, fun, and suitable for ages 5-12'
            : 'Stories will be detailed, creative, and suitable for adult readers and writers'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  promptSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 16,
  },
  error: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
});

