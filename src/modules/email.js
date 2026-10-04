import md5 from 'js-md5';
import { get, asJson } from '../lib/http.js';
import { startSection, addResult } from '../ui/results.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkEmail(email, hibpKey = '') {
  const section = startSection(`Email: ${email}`);

  await checkDomainDns(email, section);
  await sleep(500);

  await checkGravatar(email, section);
  await sleep(500);

  await checkGitHubEmail(email, section);
  await sleep(500);

  await checkHaveIBeenPwned(email, section, hibpKey);
}

async function checkDomainDns(email, section) {
  const domain = email.split('@')[1];

  if (!domain) {
    addResult(section, {
      status: 'error',
      title: 'DNS/MX',
      summary: 'Не удалось выделить домен из email.'
    });
    return;
  }

  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;

  try {
    const response = await get(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    const data = asJson(response.data);

    if (response.status === 200 && data?.Status === 0) {
      const mxRecords = (data?.Answer || []).map((answer) => answer?.data);

      addResult(section, {
        status: mxRecords.length ? 'found' : 'info',
        title: `DNS/MX для домена ${domain}`,
        summary: mxRecords.length
          ? 'Домен имеет почтовые MX-записи.'
          : 'MX-записи не найдены.',
        data: {
          domain,
          mxRecords
        }
      });
    } else if (response.status === 200 && data?.Status === 3) {
      addResult(section, {
        status: 'not_found',
        title: `DNS/MX для домена ${domain}`,
        summary: 'Домен не найден в DNS (NXDOMAIN).'
      });
    } else {
      addResult(section, {
        status: 'info',
        title: `DNS/MX для домена ${domain}`,
        summary: `HTTP ${response.status}, статус DNS: ${data?.Status ?? 'unknown'}.`
      });
    }
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: `DNS/MX ошибка для ${domain}`,
      summary: String(error?.message || error)
    });
  }
}

async function checkGravatar(email, section) {
  const hash = md5(email.trim().toLowerCase());
  const url = `https://www.gravatar.com/${hash}.json`;

  try {
    const response = await get(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    const data = asJson(response.data);
    const entry = data?.entry?.[0];

    if (response.status === 200 && entry) {
      addResult(section, {
        status: 'found',
        title: 'Gravatar найден',
        summary: [
          entry?.displayName ? `Имя: ${entry.displayName}` : null,
          entry?.name?.formatted ? `Полное имя: ${entry.name.formatted}` : null,
          entry?.currentLocation ? `Локация: ${entry.currentLocation}` : null,
          entry?.aboutMe ? `О себе: ${entry.aboutMe}` : null,
          entry?.profileUrl ? `Профиль: ${entry.profileUrl}` : null
        ]
          .filter(Boolean)
          .join('\n'),
        data: {
          gravatarHash: hash,
          displayName: entry?.displayName,
          formattedName: entry?.name?.formatted,
          currentLocation: entry?.currentLocation,
          aboutMe: entry?.aboutMe,
          profileUrl: entry?.profileUrl,
          thumbnailUrl: entry?.thumbnailUrl
        }
      });
    } else if (response.status === 404) {
      addResult(section, {
        status: 'not_found',
        title: 'Gravatar не найден',
        summary: 'Для этого email нет публичного Gravatar-профиля.'
      });
    } else {
      addResult(section, {
        status: 'info',
        title: 'Gravatar: неожиданный ответ',
        summary: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: 'Gravatar: ошибка запроса',
      summary: String(error?.message || error)
    });
  }
}

async function checkGitHubEmail(email, section) {
  const query = encodeURIComponent(`${email} in:email`);
  const url = `https://api.github.com/search/users?q=${query}`;

  try {
    const response = await get(url, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    const data = asJson(response.data);

    if (response.status === 200) {
      const totalCount = data?.total_count ?? 0;

      if (totalCount > 0) {
        const logins = (data?.items || []).slice(0, 5).map((item) => item?.login);

        addResult(section, {
          status: 'found',
          title: 'GitHub: найдены публичные совпадения по email',
          summary: `Найдено: ${totalCount}. Первые логины: ${logins.join(', ')}`,
          data: {
            total_count: totalCount,
            logins
          }
        });
      } else {
        addResult(section, {
          status: 'not_found',
          title: 'GitHub: публичных совпадений по email не найдено',
          summary: 'GitHub Search API вернул 0 результатов.'
        });
      }
    } else if (response.status === 403) {
      addResult(section, {
        status: 'error',
        title: 'GitHub: ограничение API',
        summary: 'HTTP 403. Возможно, исчерпан лимит GitHub Search API без авторизации.'
      });
    } else {
      addResult(section, {
        status: 'info',
        title: 'GitHub: неожиданный ответ',
        summary: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: 'GitHub: ошибка запроса',
      summary: String(error?.message || error)
    });
  }
}

async function checkHaveIBeenPwned(email, section, hibpKey) {
  if (!hibpKey) {
    addResult(section, {
      status: 'info',
      title: 'HaveIBeenPwned пропущен',
      summary:
        'Для проверки утечек нужен API-ключ HaveIBeenPwned. Без ключа этот источник отключён.'
    });
    return;
  }

  const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`;

  try {
    const response = await get(url, {
      headers: {
        Accept: 'application/json',
        'hibp-api-key': hibpKey
      }
    });

    const data = asJson(response.data);

    if (response.status === 200 && Array.isArray(data)) {
      addResult(section, {
        status: 'found',
        title: 'HaveIBeenPwned: найдены утечки',
        summary: `Количество утечек: ${data.length}. Названия: ${data
          .slice(0, 10)
          .map((breach) => breach?.Title)
          .filter(Boolean)
          .join(', ')}`,
        data
      });
    } else if (response.status === 404) {
      addResult(section, {
        status: 'not_found',
        title: 'HaveIBeenPwned: утечек не найдено',
        summary: 'Аккаунт не найден в известных утечках по данным HIBP.'
      });
    } else if (response.status === 429) {
      addResult(section, {
        status: 'error',
        title: 'HaveIBeenPwned: слишком много запросов',
        summary: 'HTTP 429. Подожди немного и попробуй снова.'
      });
    } else {
      addResult(section, {
        status: 'info',
        title: 'HaveIBeenPwned: неожиданный ответ',
        summary: `HTTP ${response.status}`
      });
    }
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: 'HaveIBeenPwned: ошибка запроса',
      summary: String(error?.message || error)
    });
  }
}
