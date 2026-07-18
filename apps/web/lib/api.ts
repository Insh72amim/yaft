// Keep browser requests on the same origin as the web app. Next.js proxies these
// requests to NestJS, so sessions work whether YAFT is opened via localhost,
// a LAN address, or a private HTTPS hostname.
export const API_URL = '/api';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isUnauthorized = (reason: unknown): reason is ApiError => reason instanceof ApiError && reason.status === 401;

export const errorMessage = (reason: unknown, fallback = 'Something went wrong.') => reason instanceof Error ? reason.message : fallback;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: {
    ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers,
  }});
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(message || 'Something went wrong.', response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const money = (minor: number, compact = false) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard',
}).format(minor / 100);
