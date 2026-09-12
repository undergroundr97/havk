const INTERNAL_ORIGIN = 'https://havk.local';

export function safeInternalReturnUrl(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  return sanitizeInternalUrl(value) ?? fallback;
}

export function isPrivateApplicationUrl(value: string | null | undefined): boolean {
  const internalUrl = sanitizeInternalUrl(value);
  if (!internalUrl) return false;

  const pathname = new URL(internalUrl, INTERNAL_ORIGIN).pathname;
  return ['/dashboard', '/conta', '/perfil', '/canal', '/relatorios'].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

function sanitizeInternalUrl(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
