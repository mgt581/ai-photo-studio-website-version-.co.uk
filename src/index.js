const ALLOWED_ORIGINS = new Set([
  'https://aiphotostudio.co.uk',
  'https://www.aiphotostudio.co.uk',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://aiphotostudio.co.uk',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function toByteArray(bytes) {
  return Array.from(bytes);
}

function toModelDimension(value) {
  const parsed = Number.parseInt(String(value || '1024'), 10) || 1024;
  return Math.max(256, Math.min(1536, Math.round(parsed / 8) * 8));
}

function isPng(bytes) {
  return bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
}

function readPngDimensions(bytes) {
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  };
}

async function readValidatedPng(blob, fieldName, expectedDimensions = null) {
  if (!blob.type || blob.type !== 'image/png') {
    return { error: `${fieldName}-must-be-png` };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dimensions = readPngDimensions(bytes);
  if (!dimensions) {
    return { error: `${fieldName}-invalid-png` };
  }

  if (dimensions.width < 256 || dimensions.height < 256) {
    return { error: `${fieldName}-too-small` };
  }

  if (dimensions.width > 1536 || dimensions.height > 1536) {
    return { error: `${fieldName}-too-large` };
  }

  if (dimensions.width % 8 !== 0 || dimensions.height % 8 !== 0) {
    return { error: `${fieldName}-dimensions-must-be-multiple-of-8` };
  }

  if (
    expectedDimensions &&
    (dimensions.width !== expectedDimensions.width || dimensions.height !== expectedDimensions.height)
  ) {
    return { error: `${fieldName}-dimensions-mismatch`, dimensions };
  }

  return { bytes, dimensions };
}

async function handleRemoveObject(request, env) {
  const requestId = crypto.randomUUID();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'method-not-allowed' }, 405);
  }

  if (!env.AI) {
    return jsonResponse(request, { error: 'workers-ai-binding-missing', requestId }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse(request, { error: 'multipart-form-required', requestId }, 400);
  }

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    return jsonResponse(request, { error: 'invalid-form-data', requestId }, 400);
  }

  const image = form.get('image');
  const mask = form.get('mask');
  const prompt = String(form.get('prompt') || '').trim() ||
    'remove the selected person or object, realistic clean natural background, seamless photo reconstruction';
  const width = toModelDimension(form.get('width'));
  const height = toModelDimension(form.get('height'));

  if (!(image instanceof Blob) || !(mask instanceof Blob)) {
    return jsonResponse(request, { error: 'image-and-mask-required', requestId }, 400);
  }

  const maxBytes = 8 * 1024 * 1024;
  if (image.size > maxBytes || mask.size > maxBytes) {
    return jsonResponse(request, { error: 'image-too-large', requestId }, 413);
  }

  const imageData = await readValidatedPng(image, 'image');
  if (imageData.error) {
    return jsonResponse(request, { error: imageData.error, requestId }, 400);
  }

  const maskData = await readValidatedPng(mask, 'mask', imageData.dimensions);
  if (maskData.error) {
    return jsonResponse(request, {
      error: maskData.error,
      requestId,
      imageDimensions: imageData.dimensions,
      maskDimensions: maskData.dimensions || null
    }, 400);
  }

  if (imageData.dimensions.width !== width || imageData.dimensions.height !== height) {
    return jsonResponse(request, {
      error: 'submitted-dimensions-do-not-match-image',
      requestId,
      imageDimensions: imageData.dimensions,
      submittedDimensions: { width, height }
    }, 400);
  }

  try {
    const result = await env.AI.run('@cf/runwayml/stable-diffusion-v1-5-inpainting', {
      prompt,
      negative_prompt: 'blur, smear, ghosting, duplicated people, distorted body, artifacts, text, watermark, low quality',
      width,
      height,
      image: toByteArray(imageData.bytes),
      mask: toByteArray(maskData.bytes),
      num_steps: 20,
      strength: 1,
      guidance: 7.5
    });

    return new Response(result, {
      headers: {
        ...corsHeaders(request),
        'Content-Type': 'image/png',
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('remove-object provider failed', {
      requestId,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    return jsonResponse(request, { error: 'remove-object-provider-failed', requestId }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/remove-object') {
      return handleRemoveObject(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
