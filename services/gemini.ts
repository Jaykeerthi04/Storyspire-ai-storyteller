import { AudienceMode } from '@/types/database';
import { generateGeminiImageFromPrompt } from './gemini-image';
import { generatePollinationsImageFromPrompt } from './pollinations-image';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
// Temporary diagnostic log; remove after verification
// eslint-disable-next-line no-console
console.log('[env] EXPO_PUBLIC_GEMINI_API_KEY present:', !!GEMINI_API_KEY);

// Text generation model configuration
const TEXT_MODEL = 'gemini-3-flash-preview';
const API_VERSION = 'v1beta';

// Helper to build API URL
const buildApiUrl = (model: string = TEXT_MODEL, version: string = API_VERSION) => {
  return `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
};

export interface GeneratedStory {
  title: string;
  content: string;
}

// Helper function to clean and format text for readability
function cleanAndFormatText(text: string): string {
  if (!text) return '';
  
  // Remove markdown code blocks (```json, ```text, etc.)
  text = text.replace(/```[\w]*\n?/g, '');
  text = text.replace(/```/g, '');
  
  // Remove JSON markers that might appear
  text = text.replace(/^json\s*/i, '');
  text = text.replace(/^\{\s*"title"/i, '');
  
  // Clean up escaped quotes in JSON strings
  text = text.replace(/\\"/g, '"');
  text = text.replace(/\\n/g, '\n');
  text = text.replace(/\\'/g, "'");
  
  // Remove markdown formatting but preserve content
  text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
  text = text.replace(/\*(.*?)\*/g, '$1'); // Italic
  text = text.replace(/#{1,6}\s*/g, ''); // Headers
  text = text.replace(/`([^`]+)`/g, '$1'); // Inline code
  
  // Normalize whitespace: preserve paragraph breaks (double newlines)
  // Replace multiple spaces with single space (except between paragraphs)
  text = text.replace(/[ \t]+/g, ' ');
  
  // Normalize line breaks: preserve double newlines (paragraphs)
  // Replace triple+ newlines with double
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Clean up leading/trailing whitespace from each line
  const lines = text.split('\n');
  const cleanedLines = lines.map(line => line.trim());
  text = cleanedLines.join('\n');
  
  // Remove excessive blank lines but keep paragraph breaks
  text = text.replace(/\n\n\n+/g, '\n\n');
  
  // Trim the entire result
  text = text.trim();
  
  return text;
}

// Helper function to extract title and content from text
function extractTitleAndContent(text: string): { title: string; content: string } {
  // Try to find JSON structure first
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: cleanAndFormatText(parsed.title || 'Untitled Story'),
        content: cleanAndFormatText(parsed.content || text),
      };
    } catch {
      // If JSON parsing fails, try to extract from text
    }
  }
  
  // Try to find title pattern: "Title": "..." or title: ...
  const titlePatterns = [
    /"title"\s*:\s*"([^"]+)"/i,
    /'title'\s*:\s*'([^']+)'/i,
    /title\s*:\s*"([^"]+)"/i,
    /title\s*:\s*'([^']+)'/i,
    /title\s*:\s*([^\n,}]+)/i,
  ];
  
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const title = cleanAndFormatText(match[1].trim());
      // Remove the title line from content
      const contentStart = text.indexOf(match[0]);
      const content = text.substring(contentStart + match[0].length);
      
      return {
        title,
        content: cleanAndFormatText(content),
      };
    }
  }
  
  // Fallback: parse as plain text
  const lines = text.trim().split('\n');
  let title = 'Your Story';
  let contentStart = 0;
  
  // Find the first non-empty line as potential title
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line && !line.match(/^[\{\}\[\]\s]*$/)) {
      // Remove markdown headers and JSON markers
      title = cleanAndFormatText(line.replace(/^#+\s*/, '').replace(/^["']|["']$/g, ''));
      contentStart = i + 1;
      break;
    }
  }
  
  // Get content from after title
  const contentLines = lines.slice(contentStart);
  let content = contentLines.join('\n').trim();
  
  // Remove content markers if present
  content = content.replace(/^"content"\s*:\s*"/i, '');
  content = content.replace(/^"content"\s*:\s*/i, '');
  content = content.replace(/^\{\s*"title"\s*:\s*"[^"]+"\s*,\s*"content"\s*:\s*"/i, '');
  
  // Clean up trailing JSON markers
  content = content.replace(/"\s*\}$/, '');
  content = content.replace(/\}\s*$/, '');
  
  content = cleanAndFormatText(content || text);
  
  // If content is too short, use the original text
  if (content.length < 50 && text.length > 50) {
    content = cleanAndFormatText(text);
  }
  
  return {
    title: title || 'Your Story',
    content: content || cleanAndFormatText(text),
  };
}

// Sanitize extracted content to remove leftover JSON keys, role markers,
// surrounding quotes, or stray commas that sometimes appear at the start of
// model outputs. This runs after `extractTitleAndContent` to ensure the
// returned `content` is a clean plain string suitable for UI rendering.
function sanitizeContent(content: string): string {
  if (!content) return '';
  let out = content.trim();

  // Remove leading commas
  out = out.replace(/^\s*,\s*/g, '');

  // Remove common leading JSON fragments like {"title":"...","content":"
  out = out.replace(/^\s*,?\s*\{\s*"title"\s*:\s*"[^"]*"\s*,\s*"content"\s*:\s*"/i, '');

  // Remove leading "content": " variants (with or without surrounding quotes)
  out = out.replace(/^\s*,?\s*"?content"?\s*:\s*"?/i, '');

  // Remove leading role markers like "role":"assistant",
  out = out.replace(/^\s*,?\s*"?role"?\s*:\s*"?[a-zA-Z0-9_ -]+"?\s*,?/i, '');

  // If it starts with a leading quote left over, strip it
  out = out.replace(/^\s*"/, '');

  // Remove trailing JSON end markers or stray closing braces/quotes
  out = out.replace(/"\s*\}\s*$/i, '');
  out = out.replace(/\}\s*$/i, '');
  out = out.replace(/"\s*$/i, '');

  // Final trim and format cleanup
  out = cleanAndFormatText(out);

  return out;
}

export async function generateStory(
  prompt: string,
  audienceMode: AudienceMode
): Promise<GeneratedStory> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Please set your Gemini API key in the .env file');
  }

  const modeInstruction =
    audienceMode === 'child'
      ? `Write a complete, engaging story suitable for children (ages 5-12) that is at least 800 words long. The story must:
- Be directly relevant to and centered around the given topic/story idea
- Use simple vocabulary and short sentences that children can understand
- Include a clear beginning, middle, and end with a satisfying conclusion
- Be educational, fun, and entertaining
- Have well-developed characters and a meaningful plot
- Be creative and imaginative while staying true to the core topic

IMPORTANT: The story MUST be at least 800 words. Focus entirely on the given topic and create a complete narrative around it.`
      : `Write a detailed, creative, and complete story suitable for adults that is at least 1200 words long. The story must:
- Be directly relevant to and centered around the given topic/story idea
- Use rich vocabulary, complex narrative structure, and engaging storytelling techniques
- Include a well-developed plot with rising action, climax, and resolution
- Feature complex characters with depth and motivations
- Explore themes related to the topic in meaningful ways
- Be suitable for creative writers seeking inspiration

IMPORTANT: The story MUST be at least 1200 words. The story must be directly relevant to the given topic and provide a complete, satisfying narrative.`;

  const storyPrompt = `${modeInstruction}

Story Topic/Idea: ${prompt}

CRITICAL REQUIREMENTS:
1. The story MUST be directly related to and focused on the topic: "${prompt}"
2. ${audienceMode === 'child' ? 'Minimum 800 words' : 'Minimum 1200 words'} for the story content
3. Create a complete, self-contained story with beginning, middle, and end
4. Stay focused on the core topic throughout the entire story
5. Develop the topic into a full narrative with meaningful events and character development

Provide your response in the following JSON format:
{
  "title": "An engaging, creative title that relates to the story topic",
  "content": "The complete story text (${audienceMode === 'child' ? 'minimum 800 words' : 'minimum 1200 words'}, directly related to the topic)"
}`;

  // Helper function to make API request
  const makeApiRequest = async (promptText: string): Promise<Response> => {
    const url = buildApiUrl(TEXT_MODEL, API_VERSION);
    return await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });
  };

  try {
    const response = await makeApiRequest(storyPrompt);

    if (!response.ok) {
      const status = response.status;
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `HTTP ${status}`;
      } catch {
        errorMessage = `HTTP ${status}`;
      }

      // Diagnostic: log the full response body when available
      try {
        const bodyText = await response.text();
        // eslint-disable-next-line no-console
        console.error(`[gemini] ${TEXT_MODEL} ${API_VERSION} response body:`, bodyText);
      } catch {
        // ignore
      }

      const errorMsg = `Failed to generate story with ${TEXT_MODEL} (${API_VERSION}): ${errorMessage}. Please check your API key and ensure you have access to Gemini models.`;
      // eslint-disable-next-line no-console
      console.error('[gemini] Story generation failed:', errorMsg);
      throw new Error(errorMsg);
    }

    // Parse successful response
    const data = await response.json();
    
    // Validate response structure
    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error('Invalid response from API: no candidates found');
    }
    
    if (!data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response from API: missing content or parts');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    if (!generatedText || typeof generatedText !== 'string' || generatedText.trim().length === 0) {
      throw new Error(
        'No story content was generated by the API. The response was empty. ' +
        `Please try again with a different prompt or ensure your API key has sufficient quota. ` +
        `Original prompt: "${prompt}"`
      );
    }
    
    // Check if generated text seems like an error message rather than a story
    const lowerText = generatedText.toLowerCase();
    if (lowerText.includes('error') && lowerText.includes('cannot')) {
      throw new Error(
        `API returned an error message instead of a story. This may be due to content policy restrictions. ` +
        `Please try a different prompt. Original prompt: "${prompt}"`
      );
    }

    // Extract and format title and content
    let { title, content } = extractTitleAndContent(generatedText);
    
    // Validate story content
    const minWordCount = audienceMode === 'child' ? 400 : 600; // Reduced from 800/1200 for validation
    const wordCount = content.trim().split(/\s+/).length;
    
    // If story is too short or seems empty, try once more with a more specific prompt
    if (!content || content.trim().length < 100 || wordCount < minWordCount) {
      // Retry with enhanced prompt focusing on length and completeness
      const retryPrompt = `${modeInstruction}

Story Topic/Idea: ${prompt}

URGENT REQUIREMENTS - Previous attempt was too short:
1. You MUST write a COMPLETE story of at least ${audienceMode === 'child' ? '800' : '1200'} words
2. The story MUST be directly related to and focused on: "${prompt}"
3. Include detailed descriptions, character development, dialogue, and plot progression
4. Do NOT summarize - write the FULL story with all details and scenes
5. Make the story engaging from beginning to end with a proper conclusion

Provide your response in JSON format:
{
  "title": "A creative title related to ${prompt}",
  "content": "The COMPLETE story text (${audienceMode === 'child' ? '800+' : '1200+'} words minimum)"
}`;

      // Try one more time with retry prompt
      try {
        const retryResponse = await makeApiRequest(retryPrompt);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.candidates?.[0]?.content?.parts?.[0]?.text) {
            const retryResult = extractTitleAndContent(retryData.candidates[0].content.parts[0].text);
            const retryWordCount = retryResult.content.trim().split(/\s+/).length;
            
            if (retryResult.content && retryResult.content.trim().length >= 100 && retryWordCount >= minWordCount) {
              title = retryResult.title;
              content = retryResult.content;
            }
          }
        }
      } catch {
        // If retry fails completely, we'll validate original below
      }
      
      // Final validation
      const finalWordCount = content.trim().split(/\s+/).length;
      if (!content || content.trim().length < 100 || finalWordCount < minWordCount) {
        throw new Error(
          `Generated story is too short (${finalWordCount} words, minimum ${minWordCount}). ` +
          `Please try again with a more specific and detailed prompt. ` +
          `Consider adding more details about characters, setting, or plot elements.`
        );
      }
    }
    
    // Check if content seems relevant (contains at least one word from the prompt)
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = content.toLowerCase();
    const hasRelevantTerms = promptWords.some(word => contentLower.includes(word.toLowerCase()));
    
    // If story seems completely unrelated, return with warning
    // (Sometimes AI might use synonyms or related concepts)
    
    // Ensure content is sanitized of any JSON markers before returning.
    const finalContent = sanitizeContent(content || cleanAndFormatText(generatedText));
    const finalTitle = cleanAndFormatText(title || 'Your Story');

    return {
      title: finalTitle,
      content: finalContent,
    };
  } catch (error: any) {
    // Preserve original error message or provide a default
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error.message || 'Failed to generate story');
  }
}


export async function generateStoryImage(prompt: string): Promise<string> {
  // Validate prompt
  const p = String(prompt || '').trim();
  if (__DEV__) {
    console.info('[generateStoryImage] prompt preview:', p.slice(0, 2000));
  }
  if (!p || p.length < 10) {
    console.error('[generateStoryImage] invalid/empty prompt');
    throw new Error('Invalid image prompt');
  }

  const errors: string[] = [];

  // --- 1. Pollinations (free, no API key required) ---
  try {
    if (__DEV__) console.info('[generateStoryImage] trying Pollinations…');
    const pollinationsResult = await generatePollinationsImageFromPrompt(p);
    if (pollinationsResult) {
      if (__DEV__) console.info('[generateStoryImage] Pollinations succeeded');
      return pollinationsResult;
    }
    errors.push('Pollinations returned no image');
  } catch (e: any) {
    const msg = e?.message || 'Unknown error';
    errors.push(`Pollinations: ${msg}`);
    if (__DEV__) console.warn('[generateStoryImage] Pollinations failed:', msg);
  }

  // --- 2. Gemini (requires API key + quota) ---
  try {
    if (__DEV__) console.info('[generateStoryImage] trying Gemini…');
    const geminiResult = await generateGeminiImageFromPrompt(p);
    if (geminiResult) {
      if (__DEV__) console.info('[generateStoryImage] Gemini succeeded');
      return geminiResult;
    }
    errors.push('Gemini returned no image');
  } catch (e: any) {
    const msg = e?.message || 'Unknown error';
    errors.push(`Gemini: ${msg}`);
    if (__DEV__) console.warn('[generateStoryImage] Gemini failed:', msg);
  }

  // --- 3. Stability AI (placeholder for future integration) ---
  // Currently no Stability AI service is wired up, but the slot is reserved
  // so callers see the correct error message if all providers fail.
  errors.push('Stability AI: not configured');

  // All providers failed
  const combined = errors.join(' | ');
  if (__DEV__) {
    console.error('[generateStoryImage] all providers failed:', combined);
  }
  throw new Error(
    `Image generation failed — tried Pollinations, Gemini, and Stability AI. Details: ${combined}`,
  );
}

