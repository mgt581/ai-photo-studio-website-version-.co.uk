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

async function blobToByteArray(blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function toModelDimension(value) {
  const parsed = Number.parseInt(String(value || '1024'), 10) || 1024;
  return Math.max(256, Math.min(2048, Math.round(parsed / 8) * 8));
}

async function handleRemoveObject(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'method-not-allowed' }, 405);
  }

  if (!env.AI) {
    return jsonResponse(request, { error: 'workers-ai-binding-missing' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse(request, { error: 'multipart-form-required' }, 400);
  }

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    return jsonResponse(request, { error: 'invalid-form-data' }, 400);
  }

  const image = form.get('image');
  const mask = form.get('mask');
  const prompt = String(form.get('prompt') || '').trim() ||
    'remove the selected person or object, realistic clean natural background, seamless photo reconstruction';
  const width = toModelDimension(form.get('width'));
  const height = toModelDimension(form.get('height'));

  if (!(image instanceof Blob) || !(mask instanceof Blob)) {
    return jsonResponse(request, { error: 'image-and-mask-required' }, 400);
  }

  const maxBytes = 8 * 1024 * 1024;
  if (image.size > maxBytes || mask.size > maxBytes) {
    return jsonResponse(request, { error: 'image-too-large' }, 413);
  }

  try {
    const result = await env.AI.run('@cf/runwayml/stable-diffusion-v1-5-inpainting', {
      prompt,
      negative_prompt: 'blur, smear, ghosting, duplicated people, distorted body, artifacts, text, watermark, low quality',
      width,
      height,
      image: await blobToByteArray(image),
      mask: await blobToByteArray(mask),
      num_steps: 20,
      strength: 1,
      guidance: 7.5
    });

    return new Response(result, {
      headers: {
        ...corsHeaders(request),
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('remove-object failed', error);
    return jsonResponse(request, { error: 'remove-object-failed' }, 502);
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
