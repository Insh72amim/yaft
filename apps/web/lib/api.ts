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

export const isUnauthorized = (reason: unknown): boolean =>
  Boolean(
    reason &&
      typeof reason === 'object' &&
      ((reason as any).status === 401 ||
        (reason as any).statusCode === 401 ||
        ((reason as any).name === 'ApiError' && (reason as any).status === 401)),
  );

export const errorMessage = (reason: unknown, fallback = 'Something went wrong.') => reason instanceof Error ? reason.message : fallback;

import { formatMoney, formatQuantity, formatPercent, formatMonthYear } from '@yaft/shared';
import {
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
  resetAndRandomizeDemoData,
  getDemoState,
  getDemoPdfPreviewHtml,
  handleDemoApi,
  handleDemoDownload,
} from './demo-api';

export {
  formatMoney,
  formatQuantity,
  formatPercent,
  formatMonthYear,
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
  resetAndRandomizeDemoData,
  getDemoState,
  getDemoPdfPreviewHtml,
};

// Backward compatible alias
export const money = (minor: number | null | undefined, compact = false) =>
  formatMoney(minor, { compact });

export const quantity = (value: string | number | null | undefined, maxDecimals = 6) =>
  formatQuantity(value, maxDecimals);

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemoMode()) {
    return handleDemoApi<T>(path, init);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(message || 'Something went wrong.', response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

api.get = <T>(path: string, init?: RequestInit) => api<T>(path, { ...init, method: 'GET' });
api.post = <T>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
api.put = <T>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
api.patch = <T>(path: string, body?: unknown, init?: RequestInit) =>
  api<T>(path, {
    ...init,
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
api.delete = <T>(path: string, init?: RequestInit) => api<T>(path, { ...init, method: 'DELETE' });

export async function downloadFile(path: string, filename: string) {
  if (isDemoMode()) {
    return handleDemoDownload(path, filename);
  }
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(message || 'Download failed.', response.status);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadPostFile(path: string, bodyPayload: any, filename: string) {
  if (isDemoMode()) {
    return handleDemoDownload(path, filename, bodyPayload);
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(message || 'Download failed.', response.status);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
