const prefix = '';

export function getToken (): string | null {
  return localStorage.getItem('ad_token');
}

export function setToken (t: string): void {
  localStorage.setItem('ad_token', t);
}

export function clearToken (): void {
  localStorage.removeItem('ad_token');
}

export async function login (username: string, password: string): Promise<{ token: string }> {
  const r = await fetch(`${prefix}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Login failed');
  }
  return r.json() as Promise<{ token: string }>;
}

export async function apiAdmin<T> (path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const r = await fetch(`${prefix}/api/admin${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers as Record<string, string>)
    }
  });
  if (r.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export async function apiWorkshop<T> (path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${prefix}/api/workshop${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>)
    }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}
