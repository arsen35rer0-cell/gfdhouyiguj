import { startSection, addResult, log } from '../ui/results.js';
import { normalizeUsername, normalizeEmail } from '../lib/validator.js';

export function initExportSearch(getQuery) {
  const fileInput = document.getElementById('exportFile');
  const button = document.getElementById('exportScan');

  if (!fileInput || !button) return;

  button.addEventListener('click', async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      log('Сначала выбери файл result.json из экспорта Telegram.', 'error');
      return;
    }

    const rawQuery = typeof getQuery === 'function' ? getQuery() : '';

    if (!rawQuery || !rawQuery.trim()) {
      log('Введи @username или email в основное поле перед поиском в экспорте.', 'error');
      return;
    }

    await searchExport(file, rawQuery.trim());
  });
}

async function searchExport(file, rawQuery) {
  const section = startSection('Поиск в официальном Telegram-экспорте');

  const needles = [];

  const username = normalizeUsername(rawQuery);
  if (username) {
    needles.push(`@${username}`.toLowerCase());
    needles.push(username.toLowerCase());
  }

  const email = normalizeEmail(rawQuery);
  if (email) {
    needles.push(email.toLowerCase());
  }

  if (!needles.length) {
    addResult(section, {
      status: 'error',
      title: 'Нет валидного запроса',
      summary: 'Введи корректный @username или email.'
    });
    return;
  }

  if (file.size > 80 * 1024 * 1024) {
    addResult(section, {
      status: 'error',
      title: 'Файл слишком большой',
      summary: 'Файл больше 80 МБ. Попробуй меньший экспорт.'
    });
    return;
  }

  let text;

  try {
    text = await file.text();
  } catch (error) {
    addResult(section, {
      status: 'error',
      title: 'Ошибка чтения файла',
      summary: String(error?.message || error)
    });
    return;
  }

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    addResult(section, {
      status: 'error',
      title: 'Некорректный JSON',
      summary: 'Файл не является корректным JSON-экспортом.'
    });
    return;
  }

  for (const needle of needles) {
    const matches = [];
    walk(json, '$', matches, needle, 0);

    if (matches.length > 0) {
      addResult(section, {
        status: 'found',
        title: `Найдено для: ${needle}`,
        summary: `Совпадений: ${matches.length}. Показаны первые ${Math.min(
          matches.length,
          10
        )}.`,
        data: {
          total: matches.length,
          firstMatches: matches.slice(0, 10)
        }
      });
    } else {
      addResult(section, {
        status: 'not_found',
        title: `Не найдено для: ${needle}`,
        summary: 'В загруженном экспорте совпадений нет.'
      });
    }
  }
}

function walk(obj, path, results, needle, depth) {
  if (depth > 14 || results.length >= 100) return;
  if (obj == null) return;

  if (typeof obj === 'string') {
    const lower = obj.toLowerCase();
    const index = lower.indexOf(needle);

    if (index !== -1) {
      const start = Math.max(0, index - 80);
      const snippet = obj.slice(start, start + 220);

      results.push({
        path,
        snippet
      });
    }

    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      if (results.length >= 100) break;
      walk(obj[i], `${path}[${i}]`, results, needle, depth + 1);
    }
    return;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (results.length >= 100) break;
      walk(value, path ? `${path}.${key}` : key, results, needle, depth + 1);
    }
  }
}
