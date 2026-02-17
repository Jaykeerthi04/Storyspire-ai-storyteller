const BANANA_API_URL = process.env.EXPO_PUBLIC_BANANA_API_URL; // e.g. https://api.banana.dev/start/v4 or your proxy
const BANANA_API_KEY = process.env.EXPO_PUBLIC_BANANA_API_KEY;

export async function generateBananaImageFromPrompt(prompt: string): Promise<string | null> {
  if (!BANANA_API_URL || !BANANA_API_KEY) return null;
  try {
    const res = await fetch(BANANA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BANANA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.image_base64 || data?.image || data?.artifacts?.[0]?.base64 || null;
    if (!b64 || typeof b64 !== 'string') return null;
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}
