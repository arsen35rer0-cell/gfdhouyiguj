export function normalizeUsername(raw) {
  if (!raw) return null;

  let value = raw.trim();

  value = value.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
  value = value.replace(/^@/, '');
  value = value.split(/[/?#]/)[0];

  if (!/^[a-zA-Z0-9_]{5,32}$/.test(value)) {
    return null;
  }

  return value;
}

export function normalizeEmail(raw) {
  if (!raw) return null;

  let value = raw.trim().toLowerCase();
  value = value.replace(/^mailto:/i, '');

  const match = value.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  if (!match) return null;

  return value;
}

export function detectType(raw) {
  if (!raw) return null;

  const value = raw.trim();

  if (value.includes('@') && normalizeEmail(value)) {
    return 'email';
  }

  if (normalizeUsername(value)) {
    return 'username';
  }

  if (value.includes('@')) {
    return 'invalid-email';
  }

  return null;
}

export function emailLocalToUsername(email) {
  if (!email) return null;

  const local = email.split('@')[0] || '';
  const cleaned = local.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);

  if (/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}
