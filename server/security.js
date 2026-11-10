/** The proxy must preserve Host. Forwarded headers are never an authority. */
export function configuredOrigin(raw, production = false) {
  if (!raw) return null;
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || (production && url.protocol !== 'https:')) {
    throw new Error('PUBLIC_ORIGIN must be an HTTPS origin in production (for example https://game.onrender.com).');
  }
  return url.origin;
}

export function allowedOrigin(origin, host, expected, production) {
  // Native clients have no browser Origin; session ownership and all input checks still apply.
  if (origin === undefined) return true;
  try {
    const url = new URL(origin);
    if (origin !== url.origin || !['http:', 'https:'].includes(url.protocol)) return false;
    return expected ? origin === expected : url.host === host && (!production || url.protocol === 'https:');
  } catch { return false; }
}

// Global rather than forwarded-IP based: café customers share NAT, and untrusted
// X-Forwarded-For must not defeat limits. Memory stays constant behind any proxy.
export function connectionBudget({ burst = 40, perSecond = 10, now = () => performance.now() } = {}) {
  let tokens = burst, at = now();
  return () => {
    const current = now(); tokens = Math.min(burst, tokens + (current - at) * perSecond / 1000); at = current;
    if (tokens < 1) return false;
    tokens--; return true;
  };
}
