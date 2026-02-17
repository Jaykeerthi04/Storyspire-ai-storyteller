const STABILITY_API_KEY = process.env.EXPO_PUBLIC_STABILITY_API_KEY;

async function callStability(prompt: string): Promise<string | null> {
  if (!STABILITY_API_KEY) return null;
  const body = {
    text_prompts: [
      { text: prompt, weight: 1 },
      { text: 'text, watermark, signature, logo, frame, border, caption', weight: -1 },
    ],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
    samples: 1,
    steps: 35,
  };
  try {
    const resp = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const b64 = data?.artifacts?.[0]?.base64;
    if (!b64 || typeof b64 !== 'string') return null;
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generateAIImageFromPrompt(prompt: string): Promise<string | null> {
  const primary = await callStability(prompt);
  if (primary) return primary;
  return null;
}
