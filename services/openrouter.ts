import { AudienceMode } from '@/types/database';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

export interface GeneratedStory {
  title: string;
  content: string;
}

function buildPrompt(userPrompt: string, audienceMode: AudienceMode): string {
  const modeInstruction =
    audienceMode === 'child'
      ? `Write a complete, engaging story suitable for children (ages 5-12) that is at least 600 words long. The story must:
- Be directly relevant to and centered around the given topic/story idea
- Explicitly incorporate the exact topic words and any provided details from the prompt
- Mention the exact topic phrase at least once in the first paragraph
- Use simple vocabulary and short sentences that children can understand
- Include a clear beginning, middle, and end with a satisfying conclusion`
      : `Write a detailed, creative, and complete story suitable for adults that is at least 900 words long. The story must:
- Be directly relevant to and centered around the given topic/story idea
- Explicitly incorporate the exact topic words and any provided details from the prompt
- Mention the exact topic phrase at least once in the opening section
- Use rich vocabulary and engaging storytelling techniques
- Include a well-developed plot with climax and resolution`;

  return `${modeInstruction}

Story Topic/Idea (verbatim): "${userPrompt}"

Output format (strict JSON, no markdown, no extra text):
{
  "title": "An engaging, creative title that relates to the story topic",
  "content": "The complete story text (directly related to the topic)"
}`;
}

function tryParseStory(text: string): GeneratedStory {
  const cleaned = text.replace(/^```[\w]*\n?|```/g, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj.title === 'string' && typeof obj.content === 'string') {
      return { title: obj.title.trim(), content: obj.content.trim() };
    }
  } catch {}
  const lines = cleaned.split('\n');
  const title = (lines[0] || 'Your Story').replace(/^#\s*/, '').slice(0, 120).trim() || 'Your Story';
  const content = lines.slice(1).join('\n').trim() || cleaned;
  return { title, content };
}

async function callOpenRouter(model: string, prompt: string) {
  if (!OPENROUTER_API_KEY) throw new Error('Missing EXPO_PUBLIC_OPENROUTER_API_KEY');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: 'You are a precise story writing assistant. Always return strict JSON with fields title and content only.'
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `OpenRouter request failed (${res.status})`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('No content from OpenRouter');
  return tryParseStory(content);
}

const MODELS_TO_TRY = [
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'mistralai/mistral-small-latest',
  'mistralai/mistral-7b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
];

export async function generateStoryOpenRouter(prompt: string, audienceMode: AudienceMode): Promise<GeneratedStory> {
  const storyPrompt = buildPrompt(prompt, audienceMode);
  let lastErr: any = null;
  for (const m of MODELS_TO_TRY) {
    try {
      return await callOpenRouter(m, storyPrompt);
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(lastErr?.message || 'All OpenRouter models failed');
}
