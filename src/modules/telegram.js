import { get, asText } from '../lib/http.js';
import { startSection, addResult } from '../ui/results.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeEntities(value) {
  if (!value) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function stripTags(value) {
  if (!value) return '';
  const noTags = value.replace(/<[^>]*>/g, ' ');
  return decodeEntities(noTags).replace(/\s+/g, ' ').trim();
}

function getMeta(html, property) {
  if (!html) return null;

  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeEntities(match[1]);
    }
  }

  return null;
}

function extractClassText(html, className) {
  if (!html) return null;

  const match = html.match(
    new RegExp(`<[^>]+class="[^"]*${className}[^"]*"[^>]*>(.*?)</(?:div|span|h1|h2)>`, 'is')
  );

  return match?.[1] ? stripTags(match[1]) : null;
}

export async function checkTelegramPublic(username) {
  const section = startSection(`Telegram public: @${username}`);

  if (!username) {
    addResult(section, {
      status: 'error',
      title: 'Некорректный username',
      summary: 'Username должен соответствовать правилам Telegram.'
    });
    return;
  }

  const pageUrls = [
    `https://t.me/${username}`,
    `https://telegram.me/${username}`
  ];

  let confirmed = false;

  for (const url of pageUrls) {
    try {
      const response = await get(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml'
        }
      });

      const html = asText(response.data);

      if (response.status === 200) {
        const hasTelegramPreview =
          html.includes('tgme_page_title') ||
          html.includes('tgme_channel_info') ||
          html.includes('og:title');

        if (hasTelegramPreview) {
          const title =
            getMeta(html, 'og:title') ||
            extractClassText(html, 'tgme_page_title') ||
            extractClassText(html, 'tgme_channel_info_header_title');

          const description =
            getMeta(html, 'og:description') ||
            extractClassText(html, 'tgme_page_description');

          const extra = extractClassText(html, 'tgme_page_extra');

          addResult(section, {
            status: 'found',
            title: `Публичная страница найдена: ${url}`,
            summary: [
              title ? `Название: ${title}` : null,
              extra ? `Дополнительно: ${extra}` : null,
              description ? `Описание: ${description}` : null
            ]
              .filter(Boolean)
              .join('\n'),
            data: {
              url,
              title,
              extra,
              description
            }
          });

          confirmed = true;
          break;
        } else {
          addResult(section, {
            status: 'info',
            title: `Ответ от ${url}`,
            summary: `HTTP ${response.status}, но Telegram-предпросмотр не найден.`
          });
        }
      } else if (response.status === 404) {
        addResult(section, {
          status: 'not_found',
          title: `404 для ${url}`,
          summary: 'Публичная страница по этому адресу не найдена.'
        });
      } else {
        addResult(section, {
          status: 'info',
          title: `Ответ от ${url}`,
          summary: `HTTP ${response.status}.`
        });
      }
    } catch (error) {
      addResult(section, {
        status: 'error',
        title: `Ошибка запроса ${url}`,
        summary: String(error?.message || error)
      });
    }

    await sleep(700);
  }

  if (!confirmed) {
    addResult(section, {
      status: 'not_found',
      title: 'Публичный профиль не подтверждён',
      summary:
        'Это не обязательно значит, что аккаунта нет. Публичная страница может быть скрыта, ограничена или недоступна для автоматической проверки.'
    });
  }

  try {
    const publicChannelUrl = `https://t.me/s/${username}`;
    const response = await get(publicChannelUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    const html = asText(response.data);

    if (response.status === 200 && html.includes('tgme_channel_info')) {
      addResult(section, {
        status: 'found',
        title: 'Возможен публичный канал/предпросмотр постов',
        summary: `Проверь вручную: ${publicChannelUrl}`,
        data: {
          url: publicChannelUrl
        }
      });
    } else {
      addResult(section, {
        status: 'info',
        title: 'Публичный предпросмотр постов не найден',
        summary: `URL: ${publicChannelUrl}`
      });
    }
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: 'Ошибка проверки публичных постов',
      summary: String(error?.message || error)
    });
  }

  addResult(section, {
    status: 'info',
    title: 'Приватные чаты и упоминания',
    summary:
      'Без твоего авторизованного доступа приватные чаты не проверяются. Это сделано специально: так безопаснее и законнее. Для поиска своих упоминаний загрузи официальный Telegram-экспорт ниже.'
  });
}
