import { AudienceMode } from '@/types/database';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

function baseStyle(audienceMode: AudienceMode) {
  return audienceMode === 'child'
    ? 'children book illustration, bright, colorful, friendly, simple shapes, soft lighting'
    : 'cinematic, detailed, high quality, realistic lighting, dramatic composition, artstation, 8k';
}

function buildSystemPrompt(audienceMode: AudienceMode) {
  return `You are a visual prompt engineer for text-to-image models.
Output a SINGLE LINE description of a vivid cover scene that best represents the story.
Include characters (with brief traits), setting, key action/moment, atmosphere, lighting, and composition cues.
Avoid any text, watermark, logos, or borders. Do not include quotes.
Style tokens: ${baseStyle(audienceMode)}.`;
}

function buildUserPrompt(topic: string, story: string) {
  const excerpt = (story || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  return `Topic: "${topic}". Story excerpt: ${excerpt}`;
}

// Lightweight sanitizer to ensure story text has no leading JSON markers
function sanitizeStoryText(story: string) {
  if (!story) return '';
  let s = story.trim();
  s = s.replace(/^\s*,\s*/g, '');
  s = s.replace(/^\s*"?content"?\s*:\s*"?/i, '');
  s = s.replace(/^\s*"?role"?\s*:\s*"?[a-zA-Z0-9_ -]+"?\s*,?/i, '');
  s = s.replace(/^\s*\{\s*"title"\s*:\s*"[^"]+"\s*,\s*"content"\s*:\s*"/i, '');
  s = s.replace(/"\s*\}\s*$/i, '');
  s = s.replace(/\}\s*$/i, '');
  return s.trim();
}

// Extract visual elements from story text using heuristics.
function extractVisualElements(story: string) {
  const text = (story || '').replace(/\s+/g, ' ').trim();
  const elements: { characters?: string[]; setting?: string; time?: string; weather?: string; mood?: string; keyAction?: string } = {};

  // Characters: look for capitalized name sequences (2-3 words)
  const nameMatches = Array.from(new Set((text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || [])));
  // Filter out common sentence-start words
  const stopNames = new Set(['The', 'A', 'In', 'On', 'At', 'And', 'But', 'However']);
  const filteredNames = nameMatches.filter(n => !stopNames.has(n.split(' ')[0]));
  if (filteredNames.length > 0) elements.characters = filteredNames.slice(0, 2);

  // Setting: look for patterns like 'in the [Place]' or known location words
  const settingMatch = text.match(/\b(?:in|at|near|inside|outside)\s+([A-Z][\w\s]{2,60}?)(?:[.,;]|\s|$)/i);
  if (settingMatch && settingMatch[1]) {
    elements.setting = settingMatch[1].trim();
  } else {
    // fallback: search for known location keywords
    const locKeywords = ['bank', 'forest', 'castle', 'village', 'city', 'street', 'station', 'school', 'house', 'tower', 'beach', 'mountain', 'ship'];
    const found = locKeywords.find(k => text.toLowerCase().includes(k));
    if (found) elements.setting = found;
  }

  // Time & weather
  const times = ['morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk', 'midnight', 'noon'];
  const weathers = ['rain', 'storm', 'snow', 'sunny', 'cloudy', 'fog', 'mist', 'windy'];
  elements.time = times.find(t => text.toLowerCase().includes(t));
  elements.weather = weathers.find(w => text.toLowerCase().includes(w));

  // Mood/genre keywords
  const moods = ['dark', 'thriller', 'mystery', 'fantasy', 'whimsical', 'joyful', 'romantic', 'scifi', 'sci-fi', 'children', 'playful', 'dramatic'];
  elements.mood = moods.find(m => text.toLowerCase().includes(m));

  // Key action: first sentence or a sentence containing a verb and a noun
  const sentences = text.split(/(?<=\.|!|\?)\s+/);
  let key = '';
  if (sentences.length > 0) key = sentences[0];
  // prefer sentence with an action verb if available
  for (const s of sentences.slice(0, 5)) {
    if (/\b(entered|pushed|ran|sprinted|stumbled|opened|closed|stole|murdered|found|discovered|fled|chased|saw|heard|whispered|shouted)\b/i.test(s)) {
      key = s;
      break;
    }
  }
  elements.keyAction = key.trim();

  return elements;
}

function buildLocalPrompt(topic: string, story: string, audienceMode: AudienceMode) {
  const cleaned = sanitizeStoryText(story || '');
  const e = extractVisualElements(cleaned);

  const parts: string[] = [];
  if (e.characters && e.characters.length > 0) parts.push(`${e.characters.join(' and ')}`);
  if (e.setting) parts.push(`in ${e.setting}`);
  if (e.time) parts.push(`during ${e.time}`);
  if (e.weather) parts.push(`${e.weather}`);
  if (e.mood) parts.push(`mood: ${e.mood}`);
  if (e.keyAction) parts.push(`moment: ${e.keyAction.replace(/^\"|\"$/g, '')}`);

  const subject = parts.length > 0 ? parts.join(', ') : `scene about ${topic}`;
  const style = baseStyle(audienceMode);
  const prompt = `Cover illustration: ${subject}. Style: ${style}. No text or logos.`;
  return prompt.replace(/\s+/g, ' ').trim();
}

async function openRouterBrief(topic: string, story: string, audienceMode: AudienceMode): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: 'system', content: buildSystemPrompt(audienceMode) },
          { role: 'user', content: buildUserPrompt(topic, story) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    return null;
  } catch {
    return null;
  }
}

const GEMINI_MODELS = ['gemini-1.5-pro', 'gemini-1.5-flash'];
async function geminiBrief(topic: string, story: string, audienceMode: AudienceMode): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  const system = buildSystemPrompt(audienceMode);
  const user = buildUserPrompt(topic, story);
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: system }] },
            { role: 'user', parts: [{ text: user }] },
          ],
          generationConfig: { temperature: 0.2, topK: 1, topP: 0.8, maxOutputTokens: 256 },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    } catch {}
  }
  return null;
}

export async function getImagePromptFromStory(topic: string, story: string, audienceMode: AudienceMode): Promise<string | null> {
  // Ensure we derive a prompt from the finalized story text first
  const sanitized = sanitizeStoryText(story || '');
  const localPrompt = buildLocalPrompt(topic, sanitized, audienceMode);

  // Log the sanitized story and the locally-derived prompt for verification
  try {
    console.info('[image-brief] sanitized story:', sanitized.slice(0, 2000));
    console.info('[image-brief] local prompt:', localPrompt);
  } catch (e) {
    // ignore logging errors
  }

  // Try LLM refinement (OpenRouter -> Gemini). If they return nothing, fall back to local prompt.
  const fromOpenRouter = await openRouterBrief(topic, sanitized, audienceMode);
  if (fromOpenRouter) {
    console.info('[image-brief] final prompt (OpenRouter):', fromOpenRouter);
    return fromOpenRouter;
  }

  const fromGemini = await geminiBrief(topic, sanitized, audienceMode);
  if (fromGemini) {
    console.info('[image-brief] final prompt (Gemini):', fromGemini);
    return fromGemini;
  }

  console.info('[image-brief] final prompt (local):', localPrompt);
  return localPrompt;
}
