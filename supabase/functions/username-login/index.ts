import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};
const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const body = await request.text();
    if (body.length > 4096) return json(413, { error: 'Request too large' });
    let input: { username?: unknown; password?: unknown };
    try { input = JSON.parse(body); } catch { return json(400, { error: 'Invalid request' }); }
    const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    if (!/^[a-z0-9_-]{3,24}$/.test(username) || !password || password.length > 128) return json(401, { error: 'Invalid credentials' });
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(username));
    const attemptKey = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const budget = await admin.rpc('consume_login_attempt', { attempt_key: attemptKey });
    if (budget.error) return json(503, { error: 'Login unavailable' });
    if (!budget.data) return json(429, { error: 'Try again later' });
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: `${username}@accounts.kingdomcome.invalid`, password });
    if (error) {
      if (error.status === 429) return json(429, { error: 'Try again later' });
      if (['invalid_credentials', 'user_banned', 'email_not_confirmed'].includes(error.code || '')) return json(401, { error: 'Invalid credentials' });
      return json(503, { error: 'Login unavailable' });
    }
    if (!data.session) return json(503, { error: 'Login unavailable' });
    return json(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch { return json(503, { error: 'Login unavailable' }); }
});
