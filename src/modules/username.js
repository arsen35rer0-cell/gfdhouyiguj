import { get, asJson, asText } from '../lib/http.js';
import { startSection, addResult } from '../ui/results.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const services = [
  {
    name: 'GitHub',
    url: (username) => `https://api.github.com/users/${encodeURIComponent(username)}`,
    headers: {
      Accept: 'application/vnd.github+json'
    },
    test: ({ status }) => status === 200,
    parse: (data) => ({
      login: data?.login,
      name: data?.name,
      email: data?.email,
      bio: data?.bio,
      company: data?.company,
      location: data?.location,
      blog: data?.blog,
      twitter: data?.twitter_username,
      public_repos: data?.public_repos,
      html_url: data?.html_url
    }),
    summary: (data) => [data?.name, data?.login, data?.html_url].filter(Boolean).join(' / ')
  },
  {
    name: 'GitLab',
    url: (username) =>
      `https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`,
    headers: {
      Accept: 'application/json'
    },
    test: ({ status, data }) =>
      status === 200 && Array.isArray(data) && data.length > 0,
    parse: (data) => {
      const user = Array.isArray(data) ? data[0] : null;
      return {
        id: user?.id,
        username: user?.username,
        name: user?.name,
        web_url: user?.web_url,
        avatar_url: user?.avatar_url
      };
    },
    summary: (data) => [data?.name, data?.web_url].filter(Boolean).join(' / ')
  },
  {
    name: 'npm',
    url: (username) =>
      `https://registry.npmjs.org/-/v1/user/${encodeURIComponent(username)}`,
    headers: {
      Accept: 'application/json'
    },
    test: ({ status }) => status === 200,
    parse: (data) => data,
    summary: (data) => data?.name || 'npm profile'
  },
  {
    name: 'PyPI',
    url: (username) => `https://pypi.org/user/${encodeURIComponent(username)}/`,
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    },
    test: ({ status, text }) => status === 200 && !text.includes('Page Not Found'),
    parse: (_data, _text, username) => ({
      profile: `https://pypi.org/user/${username}/`
    }),
    summary: (data) => data?.profile || 'PyPI profile'
  },
  {
    name: 'Keybase',
    url: (username) =>
      `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(username)}`,
    headers: {
      Accept: 'application/json'
    },
    test: ({ status, data }) =>
      status === 200 &&
      data?.status?.name === 'OK' &&
      Array.isArray(data?.them) &&
      data.them.length > 0,
    parse: (data) => {
      const them = data?.them?.[0] || {};

      return {
        username: them?.basics?.username,
        full_name: them?.profile?.full_name,
        proofs: (them?.proofs || []).slice(0, 10).map((proof) => ({
          type: proof?.proof_type,
          name: proof?.nam,
          url: proof?.profile_url
        }))
      };
    },
    summary: (data) => data?.full_name || data?.username || 'Keybase profile'
  },
  {
    name: 'Reddit',
    url: (username) =>
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
    headers: {
      Accept: 'application/json'
    },
    test: ({ status, data }) => status === 200 && Boolean(data?.data?.name),
    parse: (data) => ({
      name: data?.data?.name,
      link_karma: data?.data?.link_karma,
      comment_karma: data?.data?.comment_karma,
      created_utc: data?.data?.created_utc
    }),
    summary: (data) => `Reddit user: ${data?.name || 'unknown'}`
  }
];

export async function checkProfiles(username) {
  const section = startSection(`Публичные профили: ${username}`);

  if (!username) {
    addResult(section, {
      status: 'error',
      title: 'Некорректный username',
      summary: 'Нужен валидный никнейм.'
    });
    return;
  }

  for (const service of services) {
    const url = service.url(username);

    try {
      const response = await get(url, {
        headers: service.headers || {}
      });

      const data = asJson(response.data);
      const text = typeof response.data === 'string' ? response.data : asText(response.data);

      const found = service.test({
        status: response.status,
        data,
        text
      });

      if (found) {
        const parsed = service.parse ? service.parse(data, text, username) : data;

        addResult(section, {
          status: 'found',
          title: `${service.name}: найден публичный профиль`,
          summary: service.summary ? service.summary(parsed, username) : url,
          data: parsed
        });
      } else {
        addResult(section, {
          status: 'not_found',
          title: `${service.name}: не найдено`,
          summary: `HTTP ${response.status}`
        });
      }
    } catch (error) {
      addResult(section, {
        status: 'error',
        title: `${service.name}: ошибка запроса`,
        summary: String(error?.message || error)
      });
    }

    await sleep(800);
  }
}
