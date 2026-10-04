import { Capacitor, CapacitorHttp } from '@capacitor/core';

export async function get(url, opts = {}) {
  const headers = {
    Accept: '*/*',
    ...(opts.headers || {})
  };

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers,
      readTimeout: opts.timeout || 20000
    });

    return {
      status: res.status,
      data: res.data,
      headers: res.headers || {}
    };
  }

  const res = await fetch(url, {
    method: 'GET',
    headers
  });

  const text = await res.text();
  let data = text;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(text);
    } catch {
      // leave as text
    }
  }

  const headersObj = {};
  res.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  return {
    status: res.status,
    data,
    headers: headersObj
  };
}

export function asJson(data) {
  if (data == null) return null;

  if (typeof data === 'object') {
    return data;
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return null;
}

export function asText(data) {
  if (data == null) return '';

  if (typeof data === 'string') {
    return data;
  }

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
