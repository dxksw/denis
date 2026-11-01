// Служебный скрипт: обновляет раздел «Тексты интерфейса» в админке по ui-defaults.mjs.
// Запуск: node tools/gen-ui.mjs           — обновить настройки админки
//         node tools/gen-ui.mjs --data    — ещё и переписать content/settings/ui.json значениями по умолчанию
// Сайту для работы этот скрипт не нужен.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_DEFAULTS, UI_GROUP_LABELS } from '../ui-defaults.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'static', 'admin', 'config.yml');
const DATA = path.join(ROOT, 'content', 'settings', 'ui.json');
const q = (s) => JSON.stringify(String(s));
const short = (s) => (s.length > 70 ? s.slice(0, 67) + '…' : s);

const lines = [];
const pad = ' '.repeat(10);
for (const [group, keys] of Object.entries(UI_DEFAULTS)) {
  lines.push(`${pad}- label: ${q(UI_GROUP_LABELS[group] || group)}`);
  lines.push(`${pad}  name: ${group}`);
  lines.push(`${pad}  widget: object`);
  lines.push(`${pad}  collapsed: true`);
  lines.push(`${pad}  fields:`);
  for (const [key, val] of Object.entries(keys)) {
    const long = val.ru.length > 60 || val.en.length > 60;
    const widget = long ? 'text' : 'string';
    lines.push(`${pad}    - label: ${q(short(val.ru))}`);
    lines.push(`${pad}      name: ${key}`);
    lines.push(`${pad}      widget: object`);
    if (/\{(month|year)\}/.test(val.ru)) lines.push(`${pad}      hint: ${q('Не удаляй {month} и {year} — туда подставятся месяц и год.')}`);
    lines.push(`${pad}      fields:`);
    lines.push(`${pad}        - { label: RU, name: ru, widget: ${widget}, required: false }`);
    lines.push(`${pad}        - { label: EN, name: en, widget: ${widget}, required: false }`);
  }
}

const yml = fs.readFileSync(CONFIG, 'utf8');
const start = yml.indexOf('# >>> UI');
const end = yml.indexOf('# <<< UI');
if (start < 0 || end < 0) throw new Error('В config.yml нет меток # >>> UI и # <<< UI');
const before = yml.slice(0, yml.indexOf('\n', start) + 1);
const after = yml.slice(yml.lastIndexOf('\n', end) + 1);
fs.writeFileSync(CONFIG, before + lines.join('\n') + '\n' + after);
console.log('✓ config.yml: тексты интерфейса обновлены');

if (process.argv.includes('--data') || !fs.existsSync(DATA)) {
  fs.writeFileSync(DATA, JSON.stringify(UI_DEFAULTS, null, 2) + '\n');
  console.log('✓ content/settings/ui.json записан');
}
