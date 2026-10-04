const report = [];

function resultsEl() {
  return document.getElementById('results');
}

export function clear() {
  report.length = 0;
  const el = resultsEl();
  if (el) el.innerHTML = '';
}

export function log(message, type = 'info') {
  const el = resultsEl();
  if (!el) return;

  const item = document.createElement('div');
  item.className = `log ${type}`;
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

  el.prepend(item);

  report.push({
    type: 'log',
    level: type,
    message,
    at: new Date().toISOString()
  });
}

export function startSection(title) {
  const el = resultsEl();
  if (!el) return null;

  const id = `section-${Math.random().toString(36).slice(2)}`;

  const section = document.createElement('section');
  section.className = 'card';
  section.id = id;
  section.innerHTML = `<h2></h2><div class="items"></div>`;
  section.querySelector('h2').textContent = title;

  el.appendChild(section);

  report.push({
    type: 'section',
    title,
    at: new Date().toISOString()
  });

  return id;
}

export function addResult(sectionId, result) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const items = section.querySelector('.items');

  const item = document.createElement('div');
  item.className = `item ${result.status || 'info'}`;

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = result.title || 'Результат';

  const summary = document.createElement('div');
  summary.className = 'item-summary';
  summary.textContent = result.summary || '';

  item.appendChild(title);
  item.appendChild(summary);

  if (result.data !== undefined && result.data !== null) {
    const details = document.createElement('pre');
    details.className = 'item-details';
    details.textContent = JSON.stringify(result.data, null, 2);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini ghost';
    button.textContent = 'детали';

    button.addEventListener('click', () => {
      details.style.display = details.style.display === 'none' ? 'block' : 'none';
    });

    item.appendChild(button);
    item.appendChild(details);
  }

  items.appendChild(item);

  report.push({
    type: 'result',
    sectionId,
    ...result,
    at: new Date().toISOString()
  });
}

export function downloadReport() {
  const payload = {
    app: 'Self OSINT',
    exportedAt: new Date().toISOString(),
    report
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `self-osint-report-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
