const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPECTED_TOKEN_SHA256 = '9d1303872353553b94e28d18ac79dcfc5e11413d2f4ca9255681a220959abff5';

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameHash(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

async function database(path: string, init: RequestInit = {}) {
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

Deno.serve(async request => {
  if (request.method !== 'POST') return response(405, {ok: false, error: 'method_not_allowed'});

  const token = (request.headers.get('authorization') || '').match(/^Bearer (.{20,200})$/)?.[1] || '';
  if (!token || !sameHash(await sha256(token), EXPECTED_TOKEN_SHA256)) {
    return response(401, {ok: false, error: 'unauthorized'});
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response(400, {ok: false, error: 'invalid_json'}); }
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'pull') {
    const query = 'website_inquiries?select=id,created_at,inquiry_type,message,contact,source_page,notification_attempts' +
      '&status=neq.spam&notification_status=in.(pending,failed,not_configured)&notification_attempts=lt.10' +
      '&order=created_at.asc&limit=20';
    const result = await database(query);
    if (!result.ok) return response(503, {ok: false, error: 'database_unavailable'});
    return response(200, {ok: true, inquiries: await result.json()});
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return response(400, {ok: false, error: 'invalid_id'});
  }
  const attempts = Math.min(10, Math.max(1, Number(body.attempts) || 1));

  if (action === 'sent') {
    const result = await database(`website_inquiries?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        notification_status: 'sent',
        notification_attempts: attempts,
        notification_last_error: null,
        updated_at: new Date().toISOString()
      })
    });
    return result.ok ? response(200, {ok: true}) : response(503, {ok: false, error: 'database_unavailable'});
  }

  if (action === 'failed') {
    const error = typeof body.error === 'string' ? body.error.slice(0, 1000) : 'mail_delivery_failed';
    const result = await database(`website_inquiries?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        notification_status: 'failed',
        notification_attempts: attempts,
        notification_last_error: error,
        updated_at: new Date().toISOString()
      })
    });
    return result.ok ? response(200, {ok: true}) : response(503, {ok: false, error: 'database_unavailable'});
  }

  return response(400, {ok: false, error: 'invalid_action'});
});

