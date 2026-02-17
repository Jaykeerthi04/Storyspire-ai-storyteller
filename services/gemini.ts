import { AudienceMode } from '@/types/database';
import { generateGeminiImageFromPrompt } from './gemini-image';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
// Temporary diagnostic log; remove after verification
// eslint-disable-next-line no-console
console.log('[env] EXPO_PUBLIC_GEMINI_API_KEY present:', !!GEMINI_API_KEY);

// List of models to try in order (most compatible first)
// Using v1 API for stability
const MODELS_TO_TRY = [
  'gemini-1.5-flash',      // Fast and widely available
  'gemini-1.5-pro',        // High quality
  'gemini-pro',            // Basic model
  'gemini-2.5-flash',      // Newer version if available
  'gemini-2.5-pro',        // Newer version if available
];

// Helper to build API URL
const buildApiUrl = (model: string, version: string = 'v1') => {
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
  const makeApiRequest = async (model: string, version: string = 'v1'): Promise<Response> => {
    const url = buildApiUrl(model, version);
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
                text: storyPrompt,
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

  // Try multiple models until one works
  let response: Response | null = null;
  let lastError: string = '';
  let triedModels: string[] = [];
  let success = false;
  
  try {
    // Try v1 models first, then v1beta if needed
    const apiVersions = ['v1', 'v1beta'] as const;
    
    outerLoop: for (const model of MODELS_TO_TRY) {
      for (const version of apiVersions) {
        try {
          const modelKey = `${model} (${version})`;
          triedModels.push(modelKey);
          
          response = await makeApiRequest(model, version);
          
          if (response.ok) {
            // Success! Break out of all loops
            success = true;
            break outerLoop;
          }
          
          // If not ok, try to parse error
          const status = response.status;
          let errorMessage = '';
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || `HTTP ${status}`;
          } catch {
            errorMessage = `HTTP ${status}`;
          }
          
          lastError = `${model} (${version}): ${errorMessage}`;

          // Diagnostic: log the full response body when available to help debugging
          try {
            const bodyText = await response.text();
            // eslint-disable-next-line no-console
            console.error(`[gemini] ${model} ${version} response body:`, bodyText);
          } catch (e) {
            // ignore
          }
          
          // If it's a 404 or "not found" error, try next model/version
          const isNotFoundError = status === 404 || 
            errorMessage.includes('not found') || 
            errorMessage.includes('not supported');
          
          if (isNotFoundError) {
            response = null; // Reset to try next model/version
            // If we've tried both versions, move to next model
            if (version === 'v1beta') {
              break; // Break from version loop, continue to next model
            }
            continue; // Try v1beta for same model
          } else {
            // Other errors - if we've tried both versions, move to next model
            response = null;
            if (version === 'v1beta') {
              break; // Break from version loop, continue to next model
            }
            continue; // Try v1beta version
          }
        } catch (requestError: any) {
          // Network errors or other issues
          const modelKey = `${model} (${version})`;
          lastError = `${modelKey}: ${requestError.message || 'Request failed'}`;
          response = null;
          
          if (version === 'v1beta') {
            break; // Break from version loop, continue to next model
          }
          continue; // Try v1beta for same model
        }
      }
    }
    
    // If we tried all models and none worked
    if (!success || !response || !response.ok) {
      const errorMsg = `Failed to generate story. Tried models: ${triedModels.join(', ')}. ` +
        `Last error: ${lastError || 'Unknown error'}. ` +
        `Please check your API key and ensure you have access to Gemini models.`;
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
        let retrySuccess = false;
        retryLoop: for (const model of MODELS_TO_TRY.slice(0, 2)) { // Try first 2 models
          for (const version of ['v1', 'v1beta'] as const) {
            try {
              const retryUrl = buildApiUrl(model, version);
              const retryResponse = await fetch(`${retryUrl}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: retryPrompt }] }],
                  generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096,
                  },
                }),
              });
              
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                if (retryData.candidates?.[0]?.content?.parts?.[0]?.text) {
                  const retryResult = extractTitleAndContent(retryData.candidates[0].content.parts[0].text);
                  const retryWordCount = retryResult.content.trim().split(/\s+/).length;
                  
                  if (retryResult.content && retryResult.content.trim().length >= 100 && retryWordCount >= minWordCount) {
                    title = retryResult.title;
                    content = retryResult.content;
                    retrySuccess = true;
                    break retryLoop; // Success, use retry result
                  }
                }
              }
            } catch {
              continue;
            }
          }
        }
        
        // If retry didn't succeed, we'll use original or throw error below
        if (!retrySuccess) {
          // Still validate original
        }
      } catch (retryError) {
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
  // Use only Gemini for image generation
  try {
    // Validate prompt
    const p = String(prompt || '').trim();
    try { console.info('[gemini.generateStoryImage] final prompt preview:', p.slice(0, 2000)); } catch {}
    if (!p || p.length < 10) {
      console.error('[gemini.generateStoryImage] invalid/empty prompt');
      throw new Error('Invalid image prompt');
    }

    // Use Gemini image generator only
    const imageData = await generateGeminiImageFromPrompt(p);
    if (imageData) {
      console.info('[gemini.generateStoryImage] Gemini image generated successfully');
      return imageData;
    }

    throw new Error('Gemini image generation returned no image');
  } catch (e: any) {
    try { console.error('[gemini.generateStoryImage] error:', e?.message || e, 'promptPreview:', String(prompt).slice(0, 400)); } catch {}
    // Re-throw so callers can decide how to handle UI; include safe message
    throw new Error(e?.message || 'Image generation failed');
  }
}
