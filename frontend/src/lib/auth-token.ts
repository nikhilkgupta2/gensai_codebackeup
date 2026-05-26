type JwtPayload = {
  exp?: number;
};

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

export function getTokenExpiry(token: string | null) {
  if (!token) {
    return null;
  }
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const decoded = JSON.parse(decodeBase64Url(payload)) as JwtPayload;
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, skewMs = 30_000) {
  const expiry = getTokenExpiry(token);
  if (!expiry) {
    return false;
  }
  return Date.now() + skewMs >= expiry;
}
