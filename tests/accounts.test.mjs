import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
function moduleAt(file, imports = {}, source) {
  const output = ts.transpileModule(source ?? readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function('require', 'exports', output)(id => id in imports ? imports[id] : require(id), exports);
  return exports;
}
const data = moduleAt('../src/data.ts');
const persistence = moduleAt('../src/persistence.ts', { './data': data, './supabase': { supabase: null } });
const content = data.initialData;

test('待上传修改遇到其他设备的新版本时保留本机内容并阻止覆盖', () => {
  const local = { data: content, revision: 2, dirty: true, savedAt: null };
  assert.throws(() => persistence.reconcile(local, { data: {}, revision: 3 }, value => value), /ARCHIVE_CONFLICT/);
  assert.equal(local.data, content);
  assert.equal(persistence.reconcile(local, { data: {}, revision: 2 }, value => value), local);
});
test('干净缓存读取云端，不把初始示例上传覆盖云端', () => {
  const local = { data: content, revision: 0, dirty: false, savedAt: null };
  const remote = { data: { ...content, activeWorldId: 'another-world' }, revision: 4, updated_at: '2026-10-25' };
  const result = persistence.reconcile(local, remote, value => value);
  assert.equal(result.data.activeWorldId, 'another-world');
  assert.equal(result.dirty, false);
  assert.equal(result.revision, 4);
  assert.equal(persistence.saveStatusText('pending'), '本机已保存，等待同步...');
});

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  insert into auth.users values ('00000000-0000-0000-0000-000000000001','a@example.test'), ('00000000-0000-0000-0000-000000000002','b@example.test');
`);
await db.exec(readFileSync(new URL('../supabase/migrations/202610250001_accounts.sql', import.meta.url), 'utf8'));
after(() => db.close());
const ownerA = '00000000-0000-0000-0000-000000000001';
const ownerB = '00000000-0000-0000-0000-000000000002';
async function as(role, owner, operation) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner || '']);
  try { return await operation(); } finally { await db.exec('reset role'); }
}
const save = (version, value = content) => db.query('select * from public.save_archive($1, $2::jsonb)', [version, JSON.stringify(value)]);

test('匿名用户不能读取私人档案或调用保存接口', async () => {
  await as('anon', null, async () => {
    await assert.rejects(db.query('select * from public.archives'), { code: '42501' });
    await assert.rejects(save(0), { code: '42501' });
  });
});
test('真实 PostgreSQL 权限按账户隔离，禁止越权直写', async () => {
  await as('authenticated', ownerA, async () => { const result = await save(0); assert.equal(result.rows[0].revision, 1); });
  await as('authenticated', ownerB, async () => {
    assert.equal((await db.query('select * from public.archives')).rows.length, 0);
    await assert.rejects(db.query('update public.archives set revision=99'), { code: '42501' });
    await save(0);
    const rows = (await db.query('select owner_id from public.archives')).rows;
    assert.deepEqual(rows.map(row => row.owner_id), [ownerB]);
  });
  await as('authenticated', ownerA, async () => {
    const rows = (await db.query('select owner_id,revision from public.archives')).rows;
    assert.deepEqual(rows.map(row => [row.owner_id, row.revision]), [[ownerA, 1]]);
  });
});
test('版本比较在数据库中执行，失败不会覆盖资料', async () => {
  await as('authenticated', ownerA, async () => {
    await save(1, { ...content, featuredTreeId: 'tree-ravenne' });
    await assert.rejects(save(1, content), { code: '40001' });
    const row = (await db.query('select data,revision from public.archives')).rows[0];
    assert.equal(row.revision, 2);
    assert.equal(row.data.featuredTreeId, 'tree-ravenne');
    assert.equal((await db.query('select * from public.archive_versions')).rows.length, 1);
  });
  await as('authenticated', ownerB, async () => assert.equal((await db.query('select * from public.archive_versions')).rows.length, 0));
});
test('历史快照保留最近 20 个，坏数据不会写入', async () => {
  await as('authenticated', ownerA, async () => {
    await assert.rejects(save(2, {}), /INVALID_ARCHIVE/);
    for (let revision = 2; revision < 24; revision++) await save(revision);
    const rows = (await db.query('select revision from public.archive_versions order by revision')).rows;
    assert.equal(rows.length, 20);
    assert.equal(rows[0].revision, 4);
  });
});
test('登录次数限制由服务端执行，普通账户不可调用或读取', async () => {
  await as('authenticated', ownerA, async () => {
    await assert.rejects(db.query("select public.consume_login_attempt('test')"), { code: '42501' });
    await assert.rejects(db.query('select * from public.login_attempts'), { code: '42501' });
  });
  await as('service_role', null, async () => {
    for (let index = 0; index < 10; index++) assert.equal((await db.query("select public.consume_login_attempt('test') as ok")).rows[0].ok, true);
    assert.equal((await db.query("select public.consume_login_attempt('test') as ok")).rows[0].ok, false);
  });
});

let handler;
let mode = 'success';
let registered;
const admin = {
  rpc: async () => ({ data: mode !== 'limited', error: null }),
  auth: { admin: { createUser: async input => { registered = input; return { data: { user: { id: ownerA } }, error: mode === 'duplicate' ? { code: 'email_exists' } : null }; } } }
};
const client = { auth: { signInWithPassword: async ({ email, password }) => {
  assert.equal(password, 'test-password');
  assert.match(email, /@accounts\.kingdomcome\.invalid$/);
  if (mode === 'unavailable') return { error: { code: 'unexpected_failure', status: 500 }, data: {} };
  if (mode === 'auth-limited') return { error: { status: 429 }, data: {} };
  return mode === 'wrong' || email === 'unknown@accounts.kingdomcome.invalid' ? { error: { code: 'invalid_credentials', status: 400 }, data: {} } : { error: null, data: { session: { access_token: 'test-access', refresh_token: 'test-refresh' }, user: { id: ownerA } } };
} } };
function edgeHandler(name) {
  const edge = ts.transpileModule(readFileSync(new URL('../supabase/functions/'+name+'/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let serve;
  new Function('require', 'exports', 'Deno', edge)(() => ({ createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : client }), {}, { serve: value => serve = value, env: { get: key => key } });
  return serve;
}
handler = edgeHandler('username-login');
const registerHandler = edgeHandler('username-register');
const loginRequest = value => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(value) });
test('登录函数验证密码，只返回会话令牌', async () => {
  mode = 'success';
  const response = await handler(loginRequest({ username: ' Preview_User ', password: 'test-password' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { access_token: 'test-access', refresh_token: 'test-refresh' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('不存在的用户名与错误密码返回相同错误，超限拒绝登录', async () => {
  mode = 'unknown'; const unknown = await handler(loginRequest({ username: 'unknown', password: 'test-password' }));
  mode = 'wrong'; const wrong = await handler(loginRequest({ username: 'preview_user', password: 'test-password' }));
  assert.equal(unknown.status, 401); assert.equal(wrong.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
  mode = 'limited'; assert.equal((await handler(loginRequest({ username: 'preview_user', password: 'test-password' }))).status, 429);
  assert.equal((await handler(new Request('https://test.invalid', { method: 'GET' }))).status, 405);
});

test('身份服务故障和服务商限流不会被误报为密码错误', async () => {
  const input = { username: 'preview_user', password: 'test-password' };
  mode = 'unavailable'; assert.equal((await handler(loginRequest(input))).status, 503);
  mode = 'auth-limited'; assert.equal((await handler(loginRequest(input))).status, 429);
});

test('注册接口只需用户名与密码，不要求发送确认密码', async () => {
  mode = 'success'; registered = undefined;
  const response = await registerHandler(loginRequest({ username: ' Preview_User ', password: 'test-password' }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { created: true });
  assert.deepEqual(registered, { email: 'preview_user@accounts.kingdomcome.invalid', password: 'test-password', email_confirm: true, user_metadata: { username: 'preview_user' } });
});
test('服务端独立拒绝短密码、过长密码与无效用户名', async () => {
  mode = 'success'; registered = undefined;
  for (const input of [
    { username: 'preview_user', password: 'abc12' },
    { username: 'preview_user', password: 'x'.repeat(129) },
    { username: 'a@b', password: 'test-password' }
  ]) assert.equal((await registerHandler(loginRequest(input))).status, 400);
  assert.equal(registered, undefined);
});
test('注册用户名重复和请求超限时明确拒绝', async () => {
  const input = { username: 'preview_user', password: 'test-password' };
  mode = 'duplicate'; assert.equal((await registerHandler(loginRequest(input))).status, 409);
  mode = 'limited'; assert.equal((await registerHandler(loginRequest(input))).status, 429);
});

test('6 位密码通过网站注册校验', async () => {
  mode = 'success'; registered = undefined;
  const response = await registerHandler(loginRequest({ username: 'preview_user', password: 'abc123' }));
  assert.equal(response.status, 201);
  assert.equal(registered.password, 'abc123');
});

function authProvider(service) {
  const effects = [];
  const states = [];
  const mockReact = {
    createContext: () => ({ Provider: 'auth-provider' }),
    useState: initial => { const index = states.push(initial) - 1; return [initial, next => { states[index] = next; }]; },
    useEffect: effect => effects.push(effect)
  };
  const { AuthProvider } = moduleAt('../src/auth.tsx', {
    react: mockReact,
    './supabase': { supabase: service, normalizeUsername: value => value.trim().toLowerCase() }
  });
  return { auth: AuthProvider({ children: null }).props.value, effects, states };
}

test('未配置服务时保持本地模式，登录注册不伪造成功', async () => {
  const { auth } = authProvider(null);
  assert.equal(auth.configured, false);
  assert.equal(auth.loading, false);
  assert.equal(auth.user, null);
  await assert.rejects(auth.signIn('preview', 'abc123'), /登录服务尚未配置/);
  await assert.rejects(auth.signUp('preview', 'abc123'), /注册服务尚未配置/);
});

test('会话初始化只订阅一次，初始会话、切换账户和退出均由同一订阅更新', () => {
  let notify, subscriptions = 0, unsubscribed = 0;
  const { effects, states } = authProvider({ auth: { onAuthStateChange: callback => {
    subscriptions++; notify = callback;
    return { data: { subscription: { unsubscribe: () => unsubscribed++ } } };
  } } });
  const cleanup = effects[0]();
  notify('INITIAL_SESSION', { user: { id: ownerA } });
  assert.equal(states[0].id, ownerA); assert.equal(states[1], false);
  notify('SIGNED_IN', { user: { id: ownerB } }); assert.equal(states[0].id, ownerB);
  notify('SIGNED_OUT', null); assert.equal(states[0], null);
  cleanup(); assert.equal(subscriptions, 1); assert.equal(unsubscribed, 1);
});

test('客户端注册后自动登录，只提交必要字段并保存服务端会话', async () => {
  const calls = [];
  let session;
  const { auth } = authProvider({
    functions: { invoke: async (name, options) => {
      calls.push([name, options]);
      return { error: null, data: name === 'username-register' ? { created: true } : { access_token: 'access', refresh_token: 'refresh', ignored: true } };
    } },
    auth: { setSession: async value => { session = value; return { error: null }; } }
  });
  await auth.signUp(' Preview_User ', 'abc123');
  assert.deepEqual(calls.map(([name]) => name), ['username-register', 'username-login']);
  for (const [, options] of calls) {
    assert.deepEqual(options.body, { username: 'preview_user', password: 'abc123' });
    assert.equal(options.timeout, 15000);
  }
  assert.deepEqual(session, { access_token: 'access', refresh_token: 'refresh' });
});

test('重复注册、错误密码、请求失败及自动登录失败显示对应结果', async () => {
  const { auth } = authProvider({
    functions: { invoke: async name => name === 'username-register' && mode === 'created' ? { data: { created: true }, error: null } : { data: null, error: { context: new Response(null, { status: mode === 'duplicate' ? 409 : mode === 'wrong' ? 401 : 503 }) } } }
  });
  mode = 'duplicate'; await assert.rejects(auth.signUp('preview', 'abc123'), /用户名已被使用/);
  mode = 'wrong'; await assert.rejects(auth.signIn('preview', 'abc123'), /用户名或密码不正确/);
  mode = 'unavailable'; await assert.rejects(auth.signIn('preview', 'abc123'), /网络连接/);
  mode = 'created'; await assert.rejects(auth.signUp('preview', 'abc123'), /账户已创建，请返回登录/);
});

function loginForm({ register = false, username = 'preview', password = 'abc123', confirmation = 'abc123', auth }) {
  const states = [username, password, confirmation];
  let index = 0;
  const { LoginPage } = moduleAt('../src/Account.tsx', {
    react: {
      useState: initial => { const key = index++; states[key] ??= initial; return [states[key], next => { states[key] = typeof next === 'function' ? next(states[key]) : next; }]; },
      useRef: current => ({ current }), useEffect: () => {}
    },
    './auth': { useAuth: () => ({ user: null, ...auth }) },
    './store': {},
    './supabase': { supabase: null, validUsername: value => /^[a-z0-9_-]{3,24}$/.test(value.trim().toLowerCase()) }
  });
  const navigation = [];
  const element = LoginPage({ register, go: path => navigation.push(path) });
  const walk = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(walk) : [value, ...walk(value.props?.children)];
  const form = walk(element).find(value => value.type === 'form');
  return { submit: () => form.props.onSubmit({ preventDefault() {} }), navigation };
}

test('注册表单阻止五位密码和确认不一致；登录不套用新密码下限', async () => {
  let calls = 0;
  const auth = { signUp: async () => { calls++; }, signIn: async () => { calls++; } };
  await loginForm({ register: true, password: 'abc12', confirmation: 'abc12', auth }).submit();
  await loginForm({ register: true, confirmation: 'different', auth }).submit();
  await loginForm({ register: true, username: 'a@b', auth }).submit();
  assert.equal(calls, 0);
  const registration = loginForm({ register: true, auth });
  await registration.submit(); assert.deepEqual(registration.navigation, ['/']);
  await loginForm({ password: 'abc12', auth }).submit();
  assert.equal(calls, 2);
});

test('同一表单快速重复提交只发送一次请求，失败后可重试', async () => {
  let calls = 0, reject;
  const form = loginForm({ auth: { signIn: () => { calls++; return new Promise((_resolve, fail) => { reject = fail; }); } } });
  const first = form.submit();
  await form.submit(); assert.equal(calls, 1);
  reject(new Error('网络连接失败')); await first;
  const retry = form.submit(); assert.equal(calls, 2);
  reject(new Error('网络连接失败')); await retry;
});
