import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from './auth';
import { useStore } from './store';
import { supabase, validUsername } from './supabase';
import type { ArchiveData } from './data';

export function LoginPage({ go, register = false }: { go: (path: string) => void; register?: boolean }) {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const nameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    setPassword(''); setConfirmation(''); setVisible(false); setError(''); setFields({});
    nameInput.current?.focus({ preventScroll: true });
  }, [register]);
  const fieldError = (name: string, value: string) => {
    if (name === 'username') return !value.trim() ? '请输入用户名。' : !validUsername(value) ? '请使用 3–24 位字母、数字、下划线或短横线。' : '';
    if (name === 'password') return !value ? '请输入密码。' : register && value.length < 6 ? '密码至少需要 6 位。' : '';
    return !value ? '请再次输入密码。' : value !== password ? '两次输入的密码不一致。' : '';
  };
  const blur = (name: string, value: string) => setFields(previous => ({ ...previous, [name]: fieldError(name, value) }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const errors = { username: fieldError('username', username), password: fieldError('password', password), confirmation: register ? fieldError('confirmation', confirmation) : '' };
    setFields(errors); setError('');
    if (Object.values(errors).some(Boolean)) return;
    submitting.current = true; setBusy(true);
    try {
      if (register) await auth.signUp(username, password);
      else await auth.signIn(username, password);
      setPassword(''); setConfirmation(''); go('/');
    } catch (err) { setError(err instanceof Error ? err.message : '操作未完成，请重试。'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <main className="account-page">
    <div className="account-shell">
    <div className="account-art" aria-hidden="true"><span className="account-art-brand">Kingdom Come</span><img src="/assets/archive-court.jpg" alt=""/><span className="account-art-mark">✦</span></div>
    <section className="account-panel">
      <button className="back-link" onClick={() => go('/')}>← 浏览档案</button>
      <div className="account-form-wrap"><span className="eyebrow">私人档案</span>
        <h1>{auth.user ? '我的账户' : register ? '创建账户' : '登录'}</h1>
        {auth.user ? <><p className="account-name">{auth.user.user_metadata.username || '我的账户'}</p><button className="primary-action" onClick={() => go('/')}>进入档案 ↗</button><button className="text-action account-secondary" onClick={() => go('/settings')}>账户设置 ↗</button></> :
          <form className="account-form" onSubmit={submit} noValidate>
            <div className="account-fields">
              <label htmlFor="account-username">用户名</label>
              <input ref={nameInput} id="account-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => { setUsername(e.target.value); setFields(previous => ({ ...previous, username: '' })); setError(''); }} onBlur={() => blur('username', username)} required maxLength={24} aria-invalid={!!fields.username} aria-describedby="username-hint" disabled={busy}/>
              <small id="username-hint" className={fields.username ? 'account-field-error' : 'account-field-hint'}>{fields.username || (register ? '3–24 位字母、数字、下划线或短横线' : '')}</small>
            </div>
            <div className="account-fields">
              <label htmlFor="account-password">密码</label>
              <span className="account-password"><input id="account-password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => { setPassword(e.target.value); setFields(previous => ({ ...previous, password: '', confirmation: '' })); setError(''); }} onBlur={() => blur('password', password)} required maxLength={128} aria-invalid={!!fields.password} aria-describedby="password-hint" disabled={busy}/><button type="button" aria-label={visible ? '隐藏密码' : '显示密码'} onClick={() => setVisible(!visible)}>{visible ? '隐藏' : '显示'}</button></span>
              <small id="password-hint" className={fields.password ? 'account-field-error' : 'account-field-hint'}>{fields.password || (register ? '至少 6 位' : '')}</small>
            </div>
            {register && <div className="account-fields">
              <label htmlFor="account-confirmation">确认密码</label>
              <input id="account-confirmation" name="confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={e => { setConfirmation(e.target.value); setFields(previous => ({ ...previous, confirmation: '' })); setError(''); }} onBlur={() => blur('confirmation', confirmation)} required maxLength={128} aria-invalid={!!fields.confirmation} aria-describedby="confirmation-hint" disabled={busy}/>
              <small id="confirmation-hint" className={fields.confirmation ? 'account-field-error' : 'account-field-hint'}>{fields.confirmation || ''}</small>
            </div>}
            {error && <p className="account-error" role="alert">{error}</p>}
            <button className="primary-action" type="submit" disabled={busy}>{busy ? register ? '正在创建...' : '正在登录...' : register ? '注册 ↗' : '登录 ↗'}</button>
            <div className="account-switch"><span>{register ? '已有账号？' : '还没有账号？'}</span><button type="button" disabled={busy} onClick={() => go(register ? '/login' : '/register')}>{register ? '登录' : '注册'} <span aria-hidden="true">↗</span></button></div>
          </form>}
      </div>
    </section>
    </div>
  </main>;
}

export function AccountSettings({pending}: {pending: boolean}) {
  const { user, configured, signOut } = useAuth();
  const [error, setError] = useState('');
  return <div className="account-settings"><div className="account-settings-row"><span>账户</span><strong>{user?.user_metadata.username || (configured ? '未登录' : '未连接')}</strong></div>{user && <button className="text-action" onClick={async () => {
    if (pending && !confirm('仍有未同步的资料。请先下载备份；退出将清除本机账户缓存。确认退出？')) return;
    try { await signOut(); } catch (err) { setError(err instanceof Error ? err.message : '退出未完成。'); }
  }}>退出登录 ↗</button>}{user&&<ArchiveVersions/>}{error && <p role="alert">{error}</p>}</div>;
}

function ArchiveVersions() {
  const { user } = useAuth();
  const { importData, saveStatus } = useStore();
  const [versions, setVersions] = useState<{ revision: number; saved_at: string }[]>([]);
  const [preview, setPreview] = useState<{ revision: number; data: ArchiveData } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    if (!supabase || !user) return;
    setBusy(true); setError('');
    const result = await supabase.from('archive_versions').select('revision,saved_at').eq('owner_id', user.id).order('revision', { ascending: false }).limit(20);
    if (result.error) setError('无法读取版本记录。');
    else setVersions(result.data);
    setBusy(false);
  };
  const view = async (revision: number) => {
    if (!supabase || !user) return;
    setBusy(true); setError('');
    const result = await supabase.from('archive_versions').select('data').eq('owner_id', user.id).eq('revision', revision).single();
    if (result.error) setError('无法读取这个版本。');
    else setPreview({ revision, data: result.data.data });
    setBusy(false);
  };
  return <details className="account-versions" onToggle={event => { if (event.currentTarget.open) void load(); }}><summary>版本记录</summary>
    {busy && <p role="status">正在读取...</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && !versions.length && <p className="muted small">暂无历史版本</p>}
    <div className="account-version-list">{versions.map(version => <button key={version.revision} disabled={busy} onClick={() => void view(version.revision)}><span>{new Date(version.saved_at).toLocaleString('zh-CN')}</span><span>查看 ↗</span></button>)}</div>
    {preview && <div className="account-version-preview"><strong>版本 {preview.revision}</strong><p>{preview.data.worlds.length} 条世界线 / {preview.data.trees.length} 个家族 / {preview.data.people.length} 位人物</p><button className="text-action" disabled={busy || saveStatus === 'conflict'} onClick={() => {
      if (confirm('恢复这个版本？当前云端版本会保留在历史记录中。')) { importData(preview.data); setPreview(null); }
    }}>恢复此版本 ↗</button><button className="text-action" onClick={() => setPreview(null)}>关闭</button></div>}
  </details>;
}
