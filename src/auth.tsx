import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { normalizeUsername, supabase } from './supabase';

type Auth = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    if (!supabase) throw new Error('登录服务尚未配置。');
    const { data, error } = await supabase.functions.invoke('username-login', {
      body: { username: normalizeUsername(username), password }, timeout: 15000
    });
    if (error || !data?.access_token || !data?.refresh_token) {
      const status = error && 'context' in error ? (error.context as Response)?.status : 0;
      throw new Error(status === 429 ? '尝试次数过多，请稍后再试。' : status === 401 ? '用户名或密码不正确。' : '登录未成功，请检查用户名、密码或网络连接。');
    }
    const result = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (result.error) throw new Error('无法保存登录状态，请重试。');
  };
  const signUp = async (username: string, password: string) => {
    if (!supabase) throw new Error('注册服务尚未配置。');
    const { data, error } = await supabase.functions.invoke('username-register', {
      body: { username: normalizeUsername(username), password }, timeout: 15000
    });
    if (error || !data?.created) {
      const status = error && 'context' in error ? (error.context as Response)?.status : 0;
      throw new Error(status === 409 ? '这个用户名已被使用，请换一个。' : status === 429 ? '注册尝试过于频繁，请稍后再试。' : '注册未完成，请稍后重试。');
    }
    try { await signIn(username, password); }
    catch { throw new Error('账户已创建，请返回登录。'); }
  };
  const signOut = async () => {
    if (!supabase) return;
    const id = user?.id;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('退出未完成，请重试。');
    if (id) localStorage.removeItem(`kingdom-come-account:${id}`);
  };
  return <Context.Provider value={{ user, loading, configured: !!supabase, signIn, signUp, signOut }}>{children}</Context.Provider>;
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error('缺少账户上下文');
  return auth;
}
