const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED_ORIGINS = new Set([
  'https://www.aspec-tech.co.kr',
  'https://aspec-tech.co.kr',
  'https://sangjin-fa.com',
  'https://www.sangjin-fa.com'
]);

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.aspec-tech.co.kr',
    'Access-Control-Allow-Headers': 'content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function hashIp(ip: string) {
  const salt = Deno.env.get('INQUIRY_IP_SALT') || SERVICE_ROLE_KEY;
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

async function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(origin, 405, { ok: false, error: 'method_not_allowed' });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json(origin, 403, { ok: false, error: 'origin_not_allowed' });

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.startsWith('application/json')) return json(origin, 415, { ok: false, error: 'json_required' });

  const raw = await req.text();
  if (raw.length > 14000) return json(origin, 413, { ok: false, error: 'request_too_large' });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json(origin, 400, { ok: false, error: 'invalid_json' }); }

  if (clean(body.website, 100)) return json(origin, 200, { ok: true });

  const requestId = clean(body.request_id, 36);
  const inquiryType = clean(body.inquiry_type, 100) || '간단 문의';
  const message = clean(body.message, 10000);
  const contact = clean(body.contact, 200) || null;
  const sourcePage = clean(body.source_page, 500) || null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json(origin, 400, { ok: false, error: 'invalid_request_id' });
  }
  if (message.length < 10) return json(origin, 400, { ok: false, error: 'message_too_short' });

  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  const ipHash = await hashIp(ip);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rateResponse = await db(`website_inquiries?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&limit=6`);
  if (!rateResponse.ok) return json(origin, 503, { ok: false, error: 'storage_unavailable' });
  if ((await rateResponse.json()).length >= 5) return json(origin, 429, { ok: false, error: 'rate_limited' });

  const duplicate = await db(`website_inquiries?select=id&request_id=eq.${requestId}&limit=1`);
  if (duplicate.ok) {
    const existing = await duplicate.json();
    if (existing.length) return json(origin, 200, { ok: true, id: existing[0].id, duplicate: true });
  }

  const insertResponse = await db('website_inquiries?select=id,created_at,inquiry_type,message,contact', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      request_id: requestId,
      inquiry_type: inquiryType,
      message,
      contact,
      source_page: sourcePage,
      ip_hash: ipHash,
      notification_status: 'pending'
    })
  });

  if (!insertResponse.ok) {
    console.error('website inquiry insert failed', insertResponse.status, await insertResponse.text());
    return json(origin, 503, { ok: false, error: 'storage_unavailable' });
  }

  const [row] = await insertResponse.json();
  return json(origin, 201, { ok: true, id: row.id });
});

