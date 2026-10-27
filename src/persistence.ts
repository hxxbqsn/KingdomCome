import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { initialData, type ArchiveData } from './data';
import { supabase } from './supabase';

export const LEGACY_KEYS = ['kingdom-come-v3', 'kingdom-come-v2', 'lineage-archive-v1'];
type Cache = { data: ArchiveData; revision: number; dirty: boolean; savedAt: string | null };
type Status = 'local' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflict' | 'storage-error' | 'unavailable';
type Prepare = (value: unknown) => ArchiveData;

export function readLegacy(prepare: Prepare) {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) return prepare(JSON.parse(raw));
  }
  return null;
}

export const saveStatusText = (status: Status) => ({
  local: '本机已保存', pending: '本机已保存，等待同步...', syncing: '正在同步...',
  synced: '已同步', error: '本机已保存，同步失败', conflict: '检测到其他设备的修改',
  'storage-error': '本机保存失败，请下载备份', unavailable: '暂时无法读取云端资料'
})[status];

export function reconcile(local: Cache, remote: { data: unknown; revision: number; updated_at: string } | null, prepare: Prepare): Cache {
  if (local.dirty) {
    if (local.revision !== (remote?.revision || 0)) throw new Error('ARCHIVE_CONFLICT');
    return local;
  }
  return remote ? { data: prepare(remote.data), revision: remote.revision, dirty: false, savedAt: remote.updated_at } : local;
}

export function useArchivePersistence(accountId: string | null, prepare: Prepare) {
  const guest = !!supabase && !accountId;
  const key = accountId ? `kingdom-come-account:${accountId}` : LEGACY_KEYS[0];
  const initial = useRef<Cache | null>(null);
  const initialError = useRef('');
  const hasAccountCache = useRef(false);
  if (!initial.current) {
    try {
      const raw = !guest && localStorage.getItem(key);
      if (accountId && raw) {
        const parsed = JSON.parse(raw);
        initial.current = { data: prepare(parsed.data), revision: parsed.revision || 0, dirty: !!parsed.dirty, savedAt: parsed.savedAt || null };
        hasAccountCache.current = true;
      } else initial.current = { data: (!guest && !accountId && readLegacy(prepare)) || initialData, revision: 0, dirty: false, savedAt: null };
    } catch { initialError.current = '无法读取本机资料，原始数据已保留。'; initial.current = { data: initialData, revision: 0, dirty: false, savedAt: null }; }
  }
  const cache = useRef(initial.current);
  const [data, setData] = useState(initial.current.data);
  const [status, setStatus] = useState<Status>(initialError.current ? 'storage-error' : accountId ? 'pending' : 'local');
  const [ready, setReady] = useState(!accountId);
  const [failure, setFailure] = useState(initialError.current);
  const [changed, setChanged] = useState(0);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const blocked = useRef(!!initialError.current);
  const locallySaved = useRef(true);
  const usable = useRef(!accountId || hasAccountCache.current);

  const persist = useCallback((value: Cache) => {
    if (guest) return true;
    try { localStorage.setItem(key, JSON.stringify(accountId ? value : value.data)); locallySaved.current=true; return true; }
    catch { locallySaved.current=false; setStatus('storage-error'); return false; }
  }, [guest, key, accountId]);

  useEffect(() => {
    if (blocked.current || data === cache.current.data) return;
    cache.current = { ...cache.current, data, dirty: !!accountId, savedAt: new Date().toISOString() };
    const saved = persist(cache.current);
    if (saved) setStatus(accountId ? 'pending' : 'local');
    setChanged(value => value + 1);
  }, [data, accountId, persist]);

  const sync = useCallback(async () => {
    if (!accountId || !supabase || inFlight.current || blocked.current) return;
    if (!navigator.onLine) {
      setStatus(usable.current ? 'pending' : 'unavailable');
      if (!usable.current) setFailure('尚无本机账户资料，请联网后重试。');
      setReady(usable.current); return;
    }
    inFlight.current = true;
    setStatus('syncing');
    try {
      const remote = await supabase.from('archives').select('data,revision,updated_at').eq('owner_id', accountId).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
      if (remote.error) throw remote.error;
      if (!mounted.current) return;
      const next = reconcile(cache.current, remote.data, prepare);
      usable.current = true;
      if (!next.dirty) {
        cache.current = next;
        setData(next.data);
        if (persist(next)) setStatus(remote.data ? 'synced' : 'local');
      } else {
        const sent = next.data;
        const result = await supabase.rpc('save_archive', { expected_revision: next.revision, contents: sent }).abortSignal(AbortSignal.timeout(15000));
        if (result.error) throw result.error;
        if (!mounted.current) return;
        const row = result.data[0];
        const dirty = cache.current.data !== sent;
        cache.current = { ...cache.current, revision: row.revision, dirty, savedAt: row.updated_at };
        if (persist(cache.current)) setStatus(dirty ? 'pending' : 'synced');
        if (dirty) setChanged(value => value + 1);
      }
      setFailure('');
    } catch (err) {
      if (!mounted.current) return;
      const conflict = err instanceof Error && err.message === 'ARCHIVE_CONFLICT' || (err as { code?: string })?.code === '40001';
      if (conflict) blocked.current = true;
      setStatus(conflict ? 'conflict' : !usable.current ? 'unavailable' : locallySaved.current ? 'error' : 'storage-error');
      setFailure(conflict ? '其他设备已有新版本。请先下载本机备份，再读取云端版本。' : '暂时无法读取或同步云端资料。');
    } finally { inFlight.current = false; if (mounted.current) setReady(usable.current); }
  }, [accountId, prepare, persist]);

  useEffect(() => {
    mounted.current = true;
    void sync();
    const online = () => void sync();
    const visible = () => { if (document.visibilityState === 'visible') void sync(); };
    addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; removeEventListener('online', online); document.removeEventListener('visibilitychange', visible); };
  }, [sync]);
  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(() => void sync(), 600);
    return () => clearTimeout(timer);
  }, [changed, sync]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (accountId && cache.current.dirty) event.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [accountId]);

  const update: Dispatch<SetStateAction<ArchiveData>> = useCallback(action => {
    if (blocked.current) { setFailure(initialError.current || '请先处理版本冲突。'); return; }
    if (guest) { dispatchEvent(new Event('kingdom-login-required')); return; }
    setData(action);
  }, [guest]);
  const reloadCloud = () => {
    if (!confirm('请先下载本机备份。继续读取云端版本，并替换本机当前版本？')) return;
    blocked.current = false;
    cache.current = { ...cache.current, dirty: false };
    void sync();
  };
  return { data, setData: update, status, statusText: guest ? '示例浏览' : saveStatusText(status), ready, failure, retry: sync, reloadCloud, hasPending: cache.current.dirty };
}
