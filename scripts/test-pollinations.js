// Quick test: verify Pollinations image generation works
// Run with: node scripts/test-pollinations.js

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ArrayToBase64(bytes) {
  const len = bytes.length;
  const chunks = [];
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
      BASE64_CHARS[triplet & 0x3f]
    );
  }
  const pad = len % 3;
  if (pad === 1) chunks[chunks.length - 1] = chunks[chunks.length - 1].slice(0, 2) + '==';
  else if (pad === 2) chunks[chunks.length - 1] = chunks[chunks.length - 1].slice(0, 3) + '=';
  return chunks.join('');
}

async function testPollinations() {
  const prompt = 'A magical forest with glowing fireflies at night, digital art';
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

  console.log('🎨 Testing Pollinations.ai image generation...');
  console.log('📝 Prompt:', prompt);
  console.log('🔗 URL:', url);
  console.log('⏳ Fetching (this may take 10-30 seconds)...\n');

  const start = Date.now();

  try {
    const res = await fetch(url);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`📡 Response status: ${res.status} ${res.statusText}`);
    console.log(`⏱️  Time: ${elapsed}s`);
    console.log(`📋 Content-Type: ${res.headers.get('content-type')}`);

    if (!res.ok) {
      console.error('❌ FAILED: Non-OK response');
      process.exit(1);
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log(`📦 Response size: ${bytes.length} bytes (${(bytes.length / 1024).toFixed(1)} KB)`);

    if (bytes.length === 0) {
      console.error('❌ FAILED: Empty response body');
      process.exit(1);
    }

    const base64 = uint8ArrayToBase64(bytes);
    const dataUri = `data:image/png;base64,${base64}`;

    console.log(`🔑 Base64 length: ${base64.length} characters`);
    console.log(`📏 Data URI length: ${dataUri.length} characters`);
    console.log(`🖼️  Data URI prefix: ${dataUri.slice(0, 40)}...`);

    // Verify it looks like valid image data
    if (base64.length > 1000) {
      console.log('\n✅ SUCCESS! Pollinations image generation is working!');
      console.log('   The image was generated, fetched, and converted to base64 successfully.');
    } else {
      console.warn('\n⚠️  WARNING: Image data seems very small, might not be a valid image.');
    }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n❌ FAILED after ${elapsed}s:`, err.message);
    process.exit(1);
  }
}

testPollinations();
