import { headers } from 'next/headers';

// URL base absoluta del sitio (para armar enlaces compartibles).
export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? '';
  const proto = /^(localhost|127\.|192\.|10\.)/.test(host) ? 'http' : 'https';
  return host ? `${proto}://${host}` : '';
}
