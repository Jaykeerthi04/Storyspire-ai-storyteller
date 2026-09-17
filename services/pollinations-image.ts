import * as FileSystem from 'expo-file-system/legacy';

// ---------------------------------------------------------------------------
// Fallback base64 encoder (used in web/environments without native file system)
// ---------------------------------------------------------------------------
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  const chunks: string[] = [];
  let i = 0;

  while (i < len) {
    const a = bytes[i++];
    const b = i < len ? bytes[i++] : 0;
    const c = i < len ? bytes[i++] : 0;

    const triplet = (a << 16) | (b << 8) | c;

    chunks.push(
      BASE64_CHARS[(triplet >> 18) & 0x3f] +
        BASE64_CHARS[(triplet >> 12) & 0x3f] +
        BASE64_CHARS[(triplet >> 6) & 0x3f] +
        BASE64_CHARS[triplet & 0x3f],
    );
  }

  // Handle padding
  const pad = len % 3;
  if (pad === 1) {
    chunks[chunks.length - 1] = chunks[chunks.length - 1].slice(0, 2) + '==';
  } else if (pad === 2) {
    chunks[chunks.length - 1] = chunks[chunks.length - 1].slice(0, 3) + '=';
  }

  return chunks.join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof btoa === 'function') {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

/**
 * Generate an image via Pollinations.ai (API key free from enter.pollinations.ai).
 *
 * @param prompt  Text description of the desired image.
 * @returns       A `data:image/png;base64,...` string, or `null` on failure.
 */
export async function generatePollinationsImageFromPrompt(
  prompt: string,
): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_POLLINATIONS_API_KEY;
  if (!apiKey || apiKey === 'your_pollinations_api_key') {
    if (__DEV__) {
      console.warn(
        '[pollinations-image] EXPO_PUBLIC_POLLINATIONS_API_KEY is not set. Skipping Pollinations.',
      );
    }
    return null;
  }

  let tempFilePath: string | null = null;
  try {
    // Pollinations uses a GET URL with the prompt embedded in the path.
    // Keep the prompt short to stay within URL-length limits (~2000 chars).
    const maxPromptLength = 500;
    let truncatedPrompt = prompt.trim();
    if (truncatedPrompt.length > maxPromptLength) {
      // Cut at word boundary
      truncatedPrompt = truncatedPrompt.slice(0, maxPromptLength);
      const lastSpace = truncatedPrompt.lastIndexOf(' ');
      if (lastSpace > maxPromptLength * 0.6) {
        truncatedPrompt = truncatedPrompt.slice(0, lastSpace);
      }
    }

    const seed = Math.floor(Math.random() * 1_000_000_000);

    const url =
      `https://gen.pollinations.ai/image/${encodeURIComponent(truncatedPrompt)}` +
      `?key=${encodeURIComponent(apiKey)}&width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

    if (__DEV__) {
      console.info(
        '[pollinations-image] requesting image, URL length:',
        url.length,
        'prompt preview:',
        truncatedPrompt.slice(0, 120),
      );
    }

    // When cacheDirectory is available (Native iOS/Android), use expo-file-system downloadAsync
    if (FileSystem.cacheDirectory && typeof FileSystem.downloadAsync === 'function') {
      const cacheDir = FileSystem.cacheDirectory.endsWith('/')
        ? FileSystem.cacheDirectory
        : `${FileSystem.cacheDirectory}/`;
      tempFilePath = `${cacheDir}pollinations_${Date.now()}_${seed}.png`;

      const downloadResult = await FileSystem.downloadAsync(url, tempFilePath);

      if (downloadResult.status < 200 || downloadResult.status >= 300) {
        if (__DEV__) {
          console.warn(
            '[pollinations-image] non-OK HTTP status code from downloadAsync:',
            downloadResult.status,
          );
        }
        await FileSystem.deleteAsync(tempFilePath, { idempotent: true }).catch(() => {});
        tempFilePath = null;
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(tempFilePath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Clean up the temporary file immediately after reading
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true }).catch(() => {});
      tempFilePath = null;

      if (!base64 || base64.length === 0) {
        if (__DEV__) {
          console.warn('[pollinations-image] received empty file after downloadAsync');
        }
        return null;
      }

      if (__DEV__) {
        console.info(
          '[pollinations-image] image downloaded successfully via FileSystem, base64 length:',
          base64.length,
        );
      }

      return `data:image/png;base64,${base64}`;
    }

    // Web fallback: fetch directly, inspect arrayBuffer, and convert to base64
    const res = await fetch(url);

    if (!res.ok) {
      if (__DEV__) {
        console.warn(
          '[pollinations-image] non-OK HTTP status code:',
          res.status,
          res.statusText,
        );
      }
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;

    if (__DEV__) {
      console.info(
        '[pollinations-image] response array buffer byte length:',
        byteLength,
      );
    }

    if (byteLength === 0 || byteLength < 100) {
      if (__DEV__) {
        console.warn(
          '[pollinations-image] empty or tiny response received, byte length:',
          byteLength,
        );
      }
      return null;
    }

    const base64 = arrayBufferToBase64(arrayBuffer);

    if (__DEV__) {
      console.info(
        '[pollinations-image] image converted successfully, size:',
        byteLength,
        'bytes, base64 length:',
        base64.length,
      );
    }

    return `data:image/png;base64,${base64}`;
  } catch (err: any) {
    if (tempFilePath) {
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true }).catch(() => {});
    }
    if (__DEV__) {
      console.error(
        '[pollinations-image] exception thrown during fetch or base64 conversion:',
        err?.message || err,
        '\nFull stack:\n',
        err?.stack,
      );
    }
    return null;
  }
}
