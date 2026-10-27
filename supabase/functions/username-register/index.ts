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
    if (!/^[a-z0-9_-]{3,24}$/.test(username) || password.length < 6 || password.length > 128) return json(400, { error: 'Invalid registration' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`register:${username}`));
    const attemptKey = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const budget = await admin.rpc('consume_login_attempt', { attempt_key: attemptKey });
    if (budget.error) return json(503, { error: 'Registration unavailable' });
    if (!budget.data) return json(429, { error: 'Try again later' });
    const total = await admin.rpc('consume_login_attempt', { attempt_key: 'registration-total' });
    if (total.error) return json(503, { error: 'Registration unavailable' });
    if (!total.data) return json(429, { error: 'Try again later' });
    const { error } = await admin.auth.admin.createUser({
      email: `${username}@accounts.kingdomcome.invalid`,
      password,
      email_confirm: true,
      user_metadata: { username }
    });
    if (error) return error.code === 'email_exists' || error.code === 'user_already_exists' ? json(409, { error: 'Username taken' }) : json(503, { error: 'Registration unavailable' });
    return json(201, { created: true });
  } catch { return json(503, { error: 'Registration unavailable' }); }
});
