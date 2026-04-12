// Always use relative path - nginx proxies /api/ to backend
const API_BASE = '/api';

/** Parse a JSON error detail from a non-ok response, falling back to a generic message. */
async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || `API error: ${res.status}`;
  } catch {
    return `API error: ${res.status}`;
  }
}

/** Parse a successful JSON response, returning undefined for empty bodies (e.g. 204). */
async function parseBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('access_token');
  }

  private headers(withAuth = true): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = this.getToken();
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers() });
    if (res.status === 401) { this.handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return parseBody<T>(res);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const isPublic = path.includes('/login') || path.includes('/signup');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(!isPublic),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { this.handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return parseBody<T>(res);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) { this.handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return parseBody<T>(res);
  }

  async delete<T = void>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (res.status === 401) { this.handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return parseBody<T>(res);
  }

  private handleUnauthorized() {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }
}

export const api = new ApiClient();
