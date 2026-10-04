import { Network } from '@capacitor/network';
import { save, load } from './lib/storage.js';
import {
  detectType,
  normalizeEmail,
  normalizeUsername,
  emailLocalToUsername
} from './lib/validator.js';
import * as ui from './ui/results.js';
import { checkTelegramPublic } from './modules/telegram.js';
import { checkProfiles } from './modules/username.js';
import { checkEmail } from './modules/email.js';
import { initExportSearch } from './modules/export-search.js';

const els = {
  consent: document.getElementById('consent'),
  identifier: document.getElementById('identifier'),
  hibpKey: document.getElementById('hibpKey'),
  scan: document.getElementById('scan'),
  clear: document.getElementById('clear'),
  download: document.getElementById('download'),
  network: document.getElementById('network')
};

async function initNetwork() {
  const update = async () => {
    try {
      const status = await Network.getStatus();
      els.network.textContent = status.connected
        ? `online: ${status.connectionType || 'unknown'}`
        : 'offline';

      els.network.classList.toggle('ok', Boolean(status.connected));
      els.network.classList.toggle('bad', !status.connected);
    } catch {
      els.network.textContent = 'browser mode';
    }
  };

  await update();

  try {
    await Network.addListener('networkStatusChange', update);
  } catch {
    // browser or unsupported environment
  }
}

async function init() {
  await initNetwork();

  els.consent.checked = await load('consent', false);
  els.hibpKey.value = await load('hibpKey', '');

  initExportSearch(() => els.identifier.value);

  els.download.addEventListener('click', () => ui.downloadReport());
  els.clear.addEventListener('click', () => {
    els.identifier.value = '';
    ui.clear();
  });

  els.scan.addEventListener('click', scan);
}

async function scan() {
  if (!els.consent.checked) {
    ui.clear();
    ui.log('Сначала подтверди, что проверяешь только свои данные.', 'error');
    return;
  }

  const raw = els.identifier.value.trim();

  if (!raw) {
    ui.clear();
    ui.log('Введи @username или email.', 'error');
    return;
  }

  ui.clear();
  els.scan.disabled = true;
  els.scan.textContent = 'Сканирую...';

  try {
    await save('consent', true);
    await save('hibpKey', els.hibpKey.value.trim());

    const type = detectType(raw);

    if (type === 'email') {
      const email = normalizeEmail(raw);
      ui.log(`Проверяю почту: ${email}`, 'info');

      await checkEmail(email, els.hibpKey.value.trim());

      const possibleUsername = emailLocalToUsername(email);
      if (possibleUsername) {
        ui.log(`Проверяю возможный ник из почты: @${possibleUsername}`, 'info');
        await checkTelegramPublic(possibleUsername);
        await checkProfiles(possibleUsername);
      }
    } else if (type === 'username') {
      const username = normalizeUsername(raw);
      ui.log(`Проверяю Telegram username: @${username}`, 'info');

      await checkTelegramPublic(username);
      await checkProfiles(username);
    } else if (type === 'invalid-email') {
      ui.log('Похоже на email, но формат неверный.', 'error');
    } else {
      ui.log('Не понимаю идентификатор. Поддерживаются email и Telegram @username.', 'error');
    }

    ui.log('Готово. Можно скачать JSON-отчёт.', 'ok');
  } catch (error) {
    ui.log(`Критическая ошибка: ${error?.message || error}`, 'error');
  } finally {
    els.scan.disabled = false;
    els.scan.textContent = 'Сканировать';
  }
}

init();
