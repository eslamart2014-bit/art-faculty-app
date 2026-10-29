import { supabase } from './supabase';

/**
 * Returns the best available authentication token for staff requests.
 * Checks the durable signed staff session token first, then the Supabase active/refreshed session.
 */
export async function getStaffAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Check custom durable 7-day staff token in localStorage
  try {
    const customToken = localStorage.getItem('fania_staff_session_token');
    if (customToken && customToken.includes('.')) {
      const parts = customToken.split('.');
      if (parts.length === 2) {
        const payload = JSON.parse(
          decodeURIComponent(
            atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          )
        );
        if (payload?.exp && payload.exp > Math.floor(Date.now() / 1000) + 60) {
          return customToken;
        }
      }
    }
  } catch (e) {}

  // 2. Check Supabase session and proactively refresh if expiring
  try {
    let { data: { session } } = await supabase.auth.getSession();
    const nowSec = Math.floor(Date.now() / 1000);

    if (session && session.expires_at && session.expires_at < nowSec + 120) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed?.data?.session) {
          session = refreshed.data.session;
        }
      } catch (e) {}
    }

    if (session?.access_token) {
      return session.access_token;
    }
  } catch (e) {}

  // 3. Fallback: inspect localStorage for Supabase token
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const t = parsed?.access_token || parsed?.currentSession?.access_token;
          if (t) return t;
        }
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Proactively synchronizes staff session with the server and stores the durable 7-day token.
 */
export async function syncStaffSessionClient(forceToken?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const token = forceToken || (await getStaffAuthToken());
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        localStorage.setItem('fania_staff_session_token', data.token);
      }
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Universal authenticated fetch for faculty/admin routes.
 * Automatically injects the staff Bearer token and sets credentials: 'same-origin'.
 * Retries once with token refresh on 401.
 */
export async function staffFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getStaffAuthToken();
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials || 'same-origin',
  };

  let res = await fetch(url, mergedInit);

  // If 401 unauthorized, attempt auto-refresh and retry once
  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      const refreshRes = await supabase.auth.refreshSession();
      const newToken = refreshRes?.data?.session?.access_token;
      if (newToken) {
        await syncStaffSessionClient(newToken);
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...mergedInit, headers });
      }
    } catch (e) {}
  }

  return res;
}
