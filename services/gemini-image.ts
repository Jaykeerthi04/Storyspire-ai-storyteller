const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// List of image generation models to try
const IMAGE_MODELS = [
  'gemini-2.0-flash-exp',  // Latest experimental model
  'gemini-2.5-flash-image', // Image generation model
  'gemini-1.5-flash',      // Fallback
];

async function tryGeminiImageModel(prompt: string, model: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  
  // Log the prompt being sent (trim to avoid extremely long logs)
  try { console.info('[gemini-image] sending prompt to', model, ':', String(prompt).slice(0, 200)); } catch {}
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.8,
    },
  };

  try { console.info('[gemini-image] request payload preview:', JSON.stringify(payload).slice(0, 500)); } catch {}

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Read raw response text for diagnostics, then try to parse
  const rawText = await res.text();
  try { 
    console.info('[gemini-image] response status:', res.status);
    console.info('[gemini-image] full response:', rawText);
  } catch {}

  if (!res.ok) {
    console.error('[gemini-image] endpoint error', res.status);
    console.error('[gemini-image] full error response:', rawText);
    
    // Check for rate limiting
    if (res.status === 429) {
      throw new Error(`Rate limit exceeded. Gemini free tier allows only 2 images per day. Please wait or upgrade your plan.`);
    }
    
    // Try to parse error message
    let errorMsg = `Gemini image API error ${res.status}`;
    try {
      const errorData = JSON.parse(rawText);
      errorMsg = errorData.error?.message || errorData.message || errorMsg;
    } catch {
      errorMsg = `${errorMsg}: ${rawText.slice(0, 500)}`;
    }
    
    throw new Error(errorMsg);
  }

  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.warn('[gemini-image] failed to parse JSON response, rawText length:', rawText.length);
    throw new Error('Failed to parse Gemini API response');
  }

  // Extract base64 image data from response
  // Response structure: data.candidates[0].content.parts[0].inlineData.data
  const b64 =
    data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data ||
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
    null;

  if (!b64 || typeof b64 !== 'string') {
    console.error('[gemini-image] no image data found in response');
    console.error('[gemini-image] full response data:', JSON.stringify(data, null, 2));
    console.error('[gemini-image] response structure:', {
      hasCandidates: !!data?.candidates,
      candidatesLength: data?.candidates?.length,
      firstCandidate: data?.candidates?.[0] ? {
        hasContent: !!data.candidates[0].content,
        hasParts: !!data.candidates[0].content?.parts,
        partsLength: data.candidates[0].content?.parts?.length,
        firstPart: data.candidates[0].content?.parts?.[0] ? Object.keys(data.candidates[0].content.parts[0]) : null
      } : null
    });
    throw new Error('Gemini image API returned no image data. The API might not support image generation for this model, or you may have hit rate limits (free tier: 2 images/day).');
  }

  const dataUrl = `data:image/png;base64,${b64}`;
  try { console.info('[gemini-image] received image bytes, length:', b64.length); } catch {}
  return dataUrl;
}

export async function generateGeminiImageFromPrompt(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
  }

  // Try each model until one works
  let lastError: Error | null = null;
  
  for (const model of IMAGE_MODELS) {
    try {
      return await tryGeminiImageModel(prompt, model);
    } catch (err: any) {
      const msg = String(err?.message || err || 'Unknown error');
      lastError = err;
      
      // If it's a 404 or model not found, try next model
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not available')) {
        console.warn(`[gemini-image] Model ${model} not available, trying next model...`);
        continue;
      }
      
      // If it's a permission error, don't try other models
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('access')) {
        throw new Error(`Gemini image API permission error. Ensure your API key/project has image generation enabled. Raw error: ${msg}`);
      }
      
      // For other errors, try next model
      console.warn(`[gemini-image] Model ${model} failed:`, msg);
      continue;
    }
  }

  // If all models failed, throw the last error
  if (lastError) {
    throw new Error(`All Gemini image models failed. Last error: ${lastError.message}`);
  }
  
  throw new Error('Failed to generate image: no models available');
}
