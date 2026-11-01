// Сборщик сайта-портфолио. Две языковые версии: английская (по умолчанию, в корне) и русская (/ru/).
// Работает без внешних библиотек: нужен только Node.js 18 или новее.
// Запуск:  node build.mjs   →   готовый сайт появляется в папке _site
//
// Контент лежит в папке content/ (его правит админ-панель), оформление — в static/assets/,
// тексты интерфейса по умолчанию — в ui-defaults.mjs (их можно переопределить в админке).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_DEFAULTS } from './ui-defaults.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '_site');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');

const BASE = normBase(process.env.BASE_PATH || '/');
const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
const ORIGIN = SITE_URL ? safeOrigin(SITE_URL) : '';
const REPO = process.env.GITHUB_REPOSITORY || 'OWNER/REPO';
const BRANCH = process.env.GITHUB_REF_NAME || 'main';
const TODAY = new Date();
const VERSION = Date.now().toString(36);

const LANGS = ['en', 'ru'];
const DEFAULT_LANG = 'en';

function normBase(b) {
  b = String(b).trim();
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b.replace(/\/{2,}/g, '/');
}
function safeOrigin(u) {
  try { return new URL(u).origin; } catch { return ''; }
}

// ───────────────────────── Ссылки ─────────────────────────

const langPrefix = (lang) => (lang === DEFAULT_LANG ? '' : `${lang}/`);
// Страница сайта на нужном языке
const link = (p = '', lang = DEFAULT_LANG) => BASE + langPrefix(lang) + String(p).replace(/^\/+/, '');
// Файл без языка: картинки, шрифты, стили
const asset = (p = '') => BASE + String(p).replace(/^\/+/, '');
const absolute = (p, lang) => (ORIGIN ? ORIGIN + link(p, lang) : '');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function media(src) {
  if (!src) return '';
  src = String(src).trim();
  if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return src;
  if (src.startsWith('/')) return asset(src);
  return src;
}

function safeHref(u, lang = DEFAULT_LANG) {
  u = String(u || '').trim();
  if (!u) return '#';
  if (/^(javascript|vbscript|data):/i.test(u)) return '#';
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(u)) return 'mailto:' + u;
  if (/^www\./i.test(u)) return 'https://' + u;
  if (/^\/(uploads|assets)\//.test(u)) return asset(u);
  if (u.startsWith('/')) return link(u, lang);
  return u;
}

const isExternal = (u) => /^https?:\/\//i.test(String(u || ''));
const extAttrs = (u) => (isExternal(u) ? ' target="_blank" rel="noopener"' : '');

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); }
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
};
function slugify(s) {
  return String(s || '').toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/g, '');
}

function pluralRu(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

// ───────────────────────── Даты и время ─────────────────────────

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function parseDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
function fmtDate(d, lang) {
  if (!d) return '';
  const day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
  return lang === 'en' ? `${day} ${MONTHS_EN[m]} ${y}` : `${day} ${MONTHS_GEN[m]} ${y}`;
}
function fmtMonth(d, lang) {
  if (!d) return '';
  return lang === 'en' ? `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${MONTHS_NOM[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const quarterOf = (d) => ({ y: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 });
const qIndex = ({ y, q }) => y * 4 + (q - 1);
const qFromIndex = (i) => ({ y: Math.floor(i / 4), q: (i % 4) + 1 });
const qLabel = ({ y, q }, lang) => (lang === 'en' ? `Q${q} ${y}` : `${ROMAN[q - 1]} квартал ${y}`);
const qShort = ({ y, q }, lang) => (lang === 'en' ? `Q${q} ${y}` : `${ROMAN[q - 1]} кв. ${y}`);
const qEndMonth = ({ q }, lang) => (lang === 'en' ? MONTHS_EN[q * 3 - 1] : MONTHS_GEN[q * 3 - 1]);

function parseTime(t) {
  if (t === null || t === undefined || t === '') return null;
  const parts = String(t).trim().replace(/[.,]/g, ':').split(':').map((x) => x.trim());
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return n[0] * 60;
  if (n.length === 2) return n[0] * 60 + n[1];
  if (n.length === 3) return n[0] * 3600 + n[1] * 60 + n[2];
  return null;
}
function fmtTime(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ───────────────────────── Markdown (упрощённый) ─────────────────────────

function emphasis(s) {
  return s
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*?[^_\s])?)_(?=[^\p{L}\p{N}_]|$)/gu, '$1<em>$2</em>')
    .replace(/~~([^~]+?)~~/g, '<del>$1</del>');
}

function inline(src, lang = DEFAULT_LANG) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = String(src ?? '');
  s = s.replace(/`([^`]+)`/g, (m, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (m, alt, u) => keep(`<img src="${esc(media(u))}" alt="${esc(alt)}" loading="lazy">`));
  s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (m, text, u) => keep(`<a href="${esc(safeHref(u, lang))}"${extAttrs(u)}>${emphasis(esc(text))}</a>`));
  s = s.replace(/(^|[\s(«])(https?:\/\/[^\s<>)»]*[^\s<>).,;:!?»"'])/g,
    (m, pre, u) => pre + keep(`<a href="${esc(u)}"${extAttrs(u)}>${esc(u)}</a>`));
  s = emphasis(esc(s));
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[+i]);
}

const RE_LIST = /^\s*([-*+]|\d+[.)])\s+/;
const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_QUOTE = /^\s*>/;

function md(src, lang = DEFAULT_LANG) {
  if (!src) return '';
  const lines = String(src).replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    const m = line.match(RE_HEAD);
    if (m) {
      const lvl = Math.min(6, m[1].length + 1);
      out.push(`<h${lvl}>${inline(m[2], lang)}</h${lvl}>`);
      i++; continue;
    }
    if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }
    if (RE_QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${md(buf.join('\n'), lang)}</blockquote>`);
      continue;
    }
    if (RE_LIST.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (RE_LIST.test(l)) { items.push(l.replace(RE_LIST, '')); i++; continue; }
        if (items.length && /^\s{2,}\S/.test(l)) { items[items.length - 1] += '\n' + l.trim(); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t, lang).replace(/\n/g, '<br>')}</li>`).join('')}</${tag}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !RE_HEAD.test(lines[i])
      && !RE_QUOTE.test(lines[i]) && !RE_LIST.test(lines[i]) && !RE_HR.test(lines[i])) {
      buf.push(lines[i].replace(/(\\|\s{2,})$/, ''));
      i++;
    }
    out.push(`<p>${inline(buf.join('\n'), lang).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}

function plain(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function excerpt(text, n = 220) {
  const t = plain(text);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).replace(/[,.;:—–-]+$/, '') + '…';
}

// ───────────────────────── Чтение контента ─────────────────────────

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fs.existsSync(file)) console.warn(`⚠ Не удалось прочитать ${path.relative(ROOT, file)}: ${e.message}`);
    return fallback;
  }
}

function readCollection(name) {
  const dir = path.join(CONTENT, name);
  if (!fs.existsSync(dir)) return [];
  const used = new Set();
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort()
    .map((f) => {
      const data = readJSON(path.join(dir, f), null);
      if (!data || typeof data !== 'object') return null;
      const fileSlug = f.replace(/\.json$/i, '');
      const base = slugify(fileSlug) || slugify(data.title) || 'zapis';
      let slug = base, n = 2;
      while (used.has(slug)) slug = `${base}-${n++}`;
      used.add(slug);
      const date = parseDate(data.date) || parseDate(fileSlug.slice(0, 10));
      return { ...data, _file: f, _slug: slug, _date: date };
    })
    .filter((e) => e && !e.draft)
    .sort((a, b) => ((b._date ? b._date.getTime() : 0) - (a._date ? a._date.getTime() : 0)) || b._file.localeCompare(a._file));
}

const site = readJSON(path.join(CONTENT, 'settings', 'site.json'));
const about = readJSON(path.join(CONTENT, 'settings', 'about.json'));
const sportSettings = readJSON(path.join(CONTENT, 'settings', 'sport.json'));
const uiFile = readJSON(path.join(CONTENT, 'settings', 'ui.json'));

const articles = readCollection('articles');
const chronicle = readCollection('chronicle');
const achievements = readCollection('achievements');
const runs = readCollection('runs');

const START_YEAR = Number(site.start_year) || TODAY.getUTCFullYear();

// ───────────────────────── Перевод ─────────────────────────

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

// Тексты интерфейса: сначала из админки (ui.json), потом значения по умолчанию
function t(key, lang, vars = {}) {
  const [g, k] = key.split('.');
  const pick = (src) => (src && src[g] && src[g][k]) || null;
  const o = pick(uiFile) || {}, d = pick(UI_DEFAULTS) || {};
  let s = filled(o[lang]) ? o[lang] : filled(d[lang]) ? d[lang] : filled(o.ru) ? o.ru : (d.ru || key);
  s = String(s);
  for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(v);
  return s;
}

// Поля настроек: у текста «story» английская версия хранится в «story_en»
function tr(obj, key, lang) {
  if (!obj) return '';
  if (lang === 'en' && filled(obj[key + '_en'])) return obj[key + '_en'];
  return obj[key] ?? '';
}

// Записи (статьи, хронология, достижения, забеги): английская версия — в блоке «en»
const enOf = (e) => (e && e.en && typeof e.en === 'object' ? e.en : {});
function L(e, field, lang) {
  if (lang === 'en' && filled(enOf(e)[field])) return enOf(e)[field];
  return e[field] ?? '';
}
// Переведён ли основной текст записи
function translated(e, bodyField = 'body') {
  const en = enOf(e);
  if (filled(en[bodyField])) return true;
  return !filled(e[bodyField]) && filled(en.title);
}

// Значения из списков (темы, типы записей, разделы, способ записи забега)
const VALUE_KEYS = {
  'Экономика': 'labels.art_econ', 'Психология и философия': 'labels.art_psy',
  'Учебные исследования': 'labels.art_study', 'Прочее': 'labels.art_other',
  'Задумка': 'labels.type_intent', 'План': 'labels.type_plan', 'Событие': 'labels.type_event',
  'Идея': 'labels.type_idea', 'Итог квартала': 'labels.type_q', 'Итог года': 'labels.type_y',
  'Проекты': 'labels.ach_projects', 'Учёба': 'labels.ach_study', 'Олимпиады и конкурсы': 'labels.ach_olymp',
  'Сертификаты': 'labels.ach_certs', 'Спорт': 'labels.ach_sport',
  'Спортивные часы': 'labels.src_watch', '5 вёрст': 'labels.src_5v',
  'Официальный забег': 'labels.src_official', 'Другое': 'labels.src_other',
};
const tv = (value, lang) => (VALUE_KEYS[value] ? t(VALUE_KEYS[value], lang) : String(value || ''));

function googleTranslate(pagePath) {
  const src = absolute(pagePath, 'ru');
  return src ? `https://translate.google.com/translate?sl=ru&tl=en&u=${encodeURIComponent(src)}` : '';
}

function onlyRuNotice(pagePath) {
  const g = googleTranslate(pagePath);
  return `<div class="notice" lang="en">
    <p>${esc(t('common.only_ru', 'en'))}</p>
    ${g ? `<a href="${esc(g)}" target="_blank" rel="noopener">${esc(t('common.google_tr', 'en'))}</a>` : ''}
  </div>`;
}

// ───────────────────────── Каркас страницы ─────────────────────────

const NAV = ['about', 'sport', 'articles', 'chronicle', 'achievements'];
const sitemap = [];

const SPEAKER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path class="on" d="M15.5 9a4.5 4.5 0 0 1 0 6"></path><path class="on" d="M18 6.5a8 8 0 0 1 0 11"></path><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"></path></svg>';
const FX = ['wheel', 'sound', 'press'];
const GLOBE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"></path></svg>';

function layout(lang, { title, description, active, body, path: pagePath = '' }) {
  const name = tr(site, 'name', lang) || 'Portfolio';
  const fullTitle = title ? `${title} — ${name}` : name;
  const desc = description || tr(site, 'description', lang) || '';
  const year = TODAY.getUTCFullYear();
  const years = year > START_YEAR ? `${START_YEAR}–${year}` : `${START_YEAR}`;
  const footerNote = tr(site, 'footer_note', lang);
  const nav = NAV.map((id) =>
    `<a href="${link(`${id}/`, lang)}"${active === id ? ' aria-current="page"' : ''}>${esc(t(`menu.${id}`, lang))}</a>`).join('\n        ');
  const alternates = ORIGIN ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(absolute(pagePath, l))}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${esc(absolute(pagePath, DEFAULT_LANG))}">` : '';
  const fx = FX.filter((k) => !(site.effects && site.effects[k] === false));
  const soundBtn = fx.includes('sound')
    ? `<button type="button" class="sound" aria-pressed="true" aria-label="${esc(t('common.sound', lang))}" title="${esc(t('common.sound', lang))}" hidden>${SPEAKER}</button>`
    : '';
  const switcher = LANGS.map((l) => `<a href="${link(pagePath, l)}" lang="${l}" hreflang="${l}"${l === lang ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`)
    .join('');
  return `<!doctype html>
<html lang="${lang}" data-fx="${fx.join(' ')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ru_RU'}">${ORIGIN ? `
<meta property="og:url" content="${esc(absolute(pagePath, lang))}">
<link rel="canonical" href="${esc(absolute(pagePath, lang))}">
${alternates}` : ''}
<link rel="icon" href="${asset('favicon.svg')}" type="image/svg+xml">
<link rel="preload" href="${asset('assets/fonts/eb-garamond.woff')}" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${asset('assets/site.css')}?v=${VERSION}">
<script>document.documentElement.className += ' js';</script>
</head>
<body>
<a class="skip" href="#main">${esc(t('common.skip', lang))}</a>
<div class="topbar" aria-hidden="true"></div>
<header class="site-header">
  <div class="site-header__inner">
    <div class="tools">
      ${soundBtn}
      <nav class="lang" aria-label="${esc(t('common.lang', lang))}">${GLOBE}<span class="seg">${switcher}</span></nav>
    </div>
    <a class="brand" href="${link('', lang)}"${active === 'home' ? ' aria-current="page"' : ''}>
      <span class="monogram" aria-hidden="true">${esc(tr(site, 'initials', lang))}</span>
      <span class="brand__name">${esc(name)}</span>
    </a>
    <nav class="nav" aria-label="${lang === 'en' ? 'Main menu' : 'Главное меню'}">
        ${nav}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="site-footer__inner">
    <span class="site-footer__name">${esc(name)}</span>
    <span class="site-footer__meta">© ${years}${footerNote ? ` · ${esc(footerNote)}` : ''} · <a href="${link('about/', lang)}">${esc(t('common.contact', lang))}</a></span>
  </div>
</footer>
<script src="${asset('assets/site.js')}?v=${VERSION}" defer></script>
</body>
</html>
`;
}

function hero({ kicker, title, lede, home = false }) {
  return `<section class="hero${home ? ' hero--home' : ''}">
  ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
  <h1>${esc(title)}</h1>
  ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  ${home ? '' : '<div class="ornament" aria-hidden="true"><span></span></div>'}
</section>`;
}

function writePage(lang, rel, html) {
  const file = path.join(OUT, langPrefix(lang), rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  sitemap.push({ rel: rel ? rel.replace(/\\/g, '/') + '/' : '', lang });
}

// ───────────────────────── Главная ─────────────────────────

function pageHome(lang) {
  const items = [['I', 'sport'], ['II', 'articles'], ['III', 'chronicle'], ['IV', 'achievements']];
  const body = `${hero({ kicker: tr(site, 'kicker', lang), title: tr(site, 'name', lang), lede: tr(site, 'tagline', lang), home: true })}
<div class="btn-row">
  <a class="btn btn--solid" href="${link('about/', lang)}">${esc(t('home.btn_about', lang))}</a>
  <a class="btn" href="${link('chronicle/', lang)}">${esc(t('home.btn_chronicle', lang))}</a>
</div>
<div class="ornament ornament--home" aria-hidden="true"><span></span></div>
<section class="wrap home-sections" aria-labelledby="sections-title">
  <h2 class="section-title" id="sections-title">${esc(t('home.sections', lang))}</h2>
  <div class="sections">
    ${items.map(([n, id]) => {
    const text = tr(site.sections, id, lang);
    return `<a class="section-link" href="${link(`${id}/`, lang)}">
      <span class="roman" aria-hidden="true">${n}</span>
      <span><span class="section-link__title">${esc(t(`menu.${id}`, lang))}</span>${text ? `<span class="section-link__text">${esc(text)}</span>` : ''}</span>
    </a>`;
  }).join('\n    ')}
  </div>
</section>`;
  writePage(lang, '', layout(lang, { active: 'home', body, path: '' }));
}

// ───────────────────────── Обо мне ─────────────────────────

const ICONS = {
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"></rect><polygon points="10 9 15 12 10 15 10 9"></polygon>',
  telegram: '<path d="M21 4 3 11l6 2.5L11 20l3-4 4.5 3.5z"></path><path d="M9 13.5 21 4"></path>',
  tiktok: '<path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="16" cy="16" r="3"></circle>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path>',
};
function iconFor(name, url) {
  const s = `${name} ${url}`.toLowerCase();
  const key = s.includes('youtu') ? 'youtube' : s.includes('telegram') || s.includes('t.me') ? 'telegram'
    : s.includes('tiktok') ? 'tiktok' : s.includes('@') || s.includes('почт') || s.includes('mail') ? 'mail' : 'link';
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;
}

function pageAbout(lang) {
  const pz = about.point_zero || {};
  const rows = (pz.rows || []).map((r) => `<div class="row">
          <span><span class="row__label">${esc(tr(r, 'label', lang))}</span>${tr(r, 'note', lang) ? `<span class="row__note">${esc(tr(r, 'note', lang))}</span>` : ''}</span>
          <span class="row__value">${esc(tr(r, 'value', lang))}</span>
        </div>`).join('\n        ');
  const goals = (about.goals || []).map((g) => (typeof g === 'string' ? g : tr(g, 'text', lang) || g.goal || '')).filter(Boolean)
    .map((g, i) => `<div class="goal"><span class="roman" aria-hidden="true">${ROMAN[i] || i + 1}</span><span class="goal__text">${inline(g, lang)}</span></div>`).join('\n        ');
  const skills = (about.skills || []).filter((s) => s && s.name);
  const facts = (about.facts || []).filter((f) => f && (f.label || f.value));
  const socials = (about.socials || []).filter((s) => s && s.url);
  const name = tr(site, 'name', lang);
  const intro = tr(pz, 'intro', lang);
  const verification = tr(pz, 'verification', lang);
  const story = tr(about, 'story', lang);
  const why = tr(about, 'why', lang);
  const method = tr(about, 'chronicle_method', lang);
  const subtitle = tr(about, 'subtitle', lang);

  const body = `${hero({ kicker: t('about.kicker', lang), title: tr(about, 'title', lang) || t('menu.about', lang) })}
<div class="wrap">
  <div class="two-col">
    <div class="two-col__main">
      ${story ? `<section class="stack">
        <h2 class="h2">${esc(t('about.story', lang))}</h2>
        <div class="prose">${md(story, lang)}</div>
      </section>` : ''}
      ${why ? `<section class="stack">
        <h2 class="h2">${esc(t('about.why', lang))}</h2>
        <div class="prose">${md(why, lang)}</div>
      </section>` : ''}
      ${rows || intro ? `<section id="point-zero" class="panel-soft">
        <div class="stack-sm">
          ${tr(pz, 'date', lang) ? `<span class="label label--accent">${esc(tr(pz, 'date', lang))}</span>` : ''}
          <h2 class="h2 h2--lg">${esc(t('about.baseline', lang))}</h2>
          ${intro ? `<p class="lede lede--left">${esc(intro)}</p>` : ''}
        </div>
        ${rows ? `<div class="rows">
        ${rows}
        </div>` : ''}
        ${verification ? `<div class="note-box">
          <span class="label">${esc(t('about.verification', lang))}</span>
          <p>${esc(verification)}</p>
        </div>` : ''}
      </section>` : ''}
      ${skills.length ? `<section class="stack">
        <h2 class="h2">${esc(t('about.skills', lang))}</h2>
        <div class="skills">
          ${skills.map((s) => `<div class="skill">
            <span class="skill__name">${esc(tr(s, 'name', lang))}</span>
            ${tr(s, 'description', lang) ? `<span class="skill__text">${inline(tr(s, 'description', lang), lang)}</span>` : ''}
            ${s.proof_url ? `<a class="skill__proof" href="${esc(safeHref(s.proof_url, lang))}"${extAttrs(s.proof_url)}>${esc(t('about.skill_proof', lang))}</a>` : ''}
          </div>`).join('\n          ')}
        </div>
      </section>` : ''}
      ${goals ? `<section class="stack">
        <h2 class="h2">${esc(t('about.goals', lang))}</h2>
        <div class="goals">
        ${goals}
        </div>
      </section>` : ''}
      ${method ? `<section class="stack">
        <h2 class="h2">${esc(t('about.method', lang))}</h2>
        <p class="prose-p">${esc(method)}</p>
        <a class="more" href="${link('chronicle/', lang)}">${esc(t('about.open_chronicle', lang))}</a>
      </section>` : ''}
    </div>
    <aside class="two-col__side" aria-label="${esc(t('about.profile', lang))}">
      ${about.portrait ? `<img class="portrait" src="${esc(media(about.portrait))}" alt="${esc(name)}" loading="lazy">` : ''}
      <div class="side-head">
        <div class="side-name">${esc(name)}</div>
        ${subtitle ? `<div class="side-sub">${esc(subtitle)}</div>` : ''}
      </div>
      ${facts.length ? `<div class="facts">
        ${facts.map((f) => `<div><span class="fact__label">${esc(tr(f, 'label', lang))}</span><span class="fact__value">${esc(tr(f, 'value', lang))}</span></div>`).join('\n        ')}
      </div>` : ''}
      ${socials.length ? `<div class="socials">
        <span class="fact__label">${esc(t('about.find_me', lang))}</span>
        ${socials.map((s) => `<a href="${esc(safeHref(s.url, lang))}"${extAttrs(safeHref(s.url, lang))}>${iconFor(s.name || '', s.url)}<span class="socials__name">${esc(s.name || hostOf(s.url))}</span>${s.handle ? `<span class="socials__handle">${esc(s.handle)}</span>` : ''}</a>`).join('\n        ')}
      </div>` : ''}
    </aside>
  </div>
</div>`;
  writePage(lang, 'about', layout(lang, { title: t('menu.about', lang), active: 'about', body, path: 'about/' }));
}

// ───────────────────────── Спорт ─────────────────────────

const DISTANCES = [
  { key: '5', km: 5, label: 'sport.d5', goal: 'five_k' },
  { key: '10', km: 10, label: 'sport.d10', goal: 'ten_k' },
  { key: '21.1', km: 21.0975, label: 'sport.dhalf', goal: 'half' },
  { key: '42.2', km: 42.195, label: 'sport.dfull', goal: 'marathon' },
];
const SOURCE_TEXT = { 'Спортивные часы': 'sport.rec_watch', '5 вёрст': 'sport.rec_5v', 'Официальный забег': 'sport.rec_official' };

function runInfo(r) {
  const d = DISTANCES.find((x) => x.key === String(r.distance));
  let km = d ? d.km : parseFloat(String(r.distance_km ?? '').replace(',', '.'));
  if (!Number.isFinite(km) || km <= 0) km = null;
  return { ...r, _km: km, _sec: parseTime(r.time), _dist: d ? d.key : null };
}
function distLabel(r, lang) {
  const sep = lang === 'en' ? '.' : ',';
  if (r._dist === '21.1') return `21${sep}1 ${t('sport.km', lang)}`;
  if (r._dist === '42.2') return `42${sep}2 ${t('sport.km', lang)}`;
  if (r._km) return `${String(Math.round(r._km * 100) / 100).replace('.', sep)} ${t('sport.km', lang)}`;
  return '—';
}

function chart5k(points, goalSec, lang) {
  const W = 960, H = 300, L0 = 80, R = 930, T = 40, B = 250;
  const nowQ = qIndex(quarterOf(TODAY));
  const startQ = Math.min(points[0].qi, nowQ);
  const endQ = Math.max(startQ + 12, points[points.length - 1].qi);
  const secs = points.map((p) => p.sec).concat(goalSec ? [goalSec] : []);
  let lo = Math.floor(Math.min(...secs) / 60) - 2;
  let hi = Math.ceil(Math.max(...secs) / 60) + 2;
  if (lo % 2) lo -= 1;
  if (hi % 2) hi += 1;
  while (hi - lo < 8) { lo -= 1; hi += 1; if (lo % 2) lo -= 1; if (hi % 2) hi += 1; }
  const span = hi - lo;
  const step = span <= 8 ? 2 : span <= 16 ? 4 : span <= 40 ? 10 : 20;
  lo = Math.max(0, Math.floor(lo / step) * step);
  hi = Math.ceil(hi / step) * step;
  const x = (qi) => L0 + ((qi - startQ) / (endQ - startQ)) * (R - L0);
  const y = (sec) => T + ((sec / 60 - lo) / (hi - lo)) * (B - T);
  const font = 'font-family="Source Sans 3, Arial, sans-serif" font-size="14"';
  const parts = [];
  for (let m = lo; m <= hi; m += step) {
    const yy = y(m * 60).toFixed(1);
    parts.push(`<line x1="${L0}" y1="${yy}" x2="${R}" y2="${yy}" stroke="${m === hi ? '#9AA1AB' : '#EEF0F3'}" stroke-width="1"></line>`);
    parts.push(`<text x="${L0 - 14}" y="${(+yy + 5).toFixed(1)}" text-anchor="end" ${font} fill="#5A6270">${m}:00</text>`);
  }
  for (let qi = startQ; qi <= endQ; qi++) {
    const xx = x(qi).toFixed(1);
    const major = (qi - startQ) % 4 === 0 || qi === endQ;
    parts.push(`<line x1="${xx}" y1="${B}" x2="${xx}" y2="${B + (major ? 6 : 4)}" stroke="${major ? '#9AA1AB' : '#C4CAD3'}"></line>`);
    if ((qi - startQ) % 4 === 0) {
      const anchor = qi === startQ ? 'start' : qi === endQ ? 'end' : 'middle';
      parts.push(`<text x="${xx}" y="${B + 30}" text-anchor="${anchor}" ${font} fill="#5A6270">${qShort(qFromIndex(qi), lang)}</text>`);
    }
  }
  if (goalSec) {
    const gy = y(goalSec).toFixed(1);
    parts.push(`<line x1="${L0}" y1="${gy}" x2="${R}" y2="${gy}" stroke="#1F3A5F" stroke-width="1.5" stroke-dasharray="6 6"></line>`);
    parts.push(`<text x="${R}" y="${(+gy - 8).toFixed(1)}" text-anchor="end" ${font} fill="#1F3A5F">${esc(t('sport.goal', lang))}: ${fmtTime(goalSec)}</text>`);
  }
  if (points.length > 1) {
    parts.push(`<polyline points="${points.map((p) => `${x(p.qi).toFixed(1)},${y(p.sec).toFixed(1)}`).join(' ')}" fill="none" stroke="#1F3A5F" stroke-width="2"></polyline>`);
  }
  points.forEach((p) => parts.push(`<circle cx="${x(p.qi).toFixed(1)}" cy="${y(p.sec).toFixed(1)}" r="6" fill="#1F3A5F"></circle>`));
  const first = points[0];
  const firstLabel = L(first.run, 'label', lang);
  const firstText = `${firstLabel ? firstLabel + ' · ' : ''}${fmtTime(first.sec)}`;
  const fy = y(first.sec);
  const firstY = fy + 26 < B - 4 ? fy + 26 : fy - 12;
  parts.push(`<text x="${(x(first.qi) + 12).toFixed(1)}" y="${firstY.toFixed(1)}" ${font} fill="#1B1F24">${esc(firstText)}</text>`);
  if (points.length > 1) {
    const last = points[points.length - 1];
    const lx = x(last.qi);
    parts.push(`<text x="${(lx > R - 120 ? lx - 14 : lx + 14).toFixed(1)}" y="${(y(last.sec) - 12).toFixed(1)}" text-anchor="${lx > R - 120 ? 'end' : 'start'}" ${font} fill="#1B1F24">${fmtTime(last.sec)}</text>`);
  }
  const aria = `${t('sport.chart_title', lang)}: ` + points.map((p) => `${qLabel(qFromIndex(p.qi), lang)} — ${fmtTime(p.sec)}`).join('; ')
    + (goalSec ? `. ${t('sport.goal', lang)}: ${fmtTime(goalSec)}` : '') + '.';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${parts.join('')}</svg>`;
}

function pageSport(lang) {
  const intro = tr(site.intros, 'sport', lang);
  const goals = sportSettings.goals || {};
  const all = runs.map(runInfo);
  const valid = all.filter((r) => r._sec && r._km);

  const records = DISTANCES.map((d) => {
    const list = valid.filter((r) => r._dist === d.key);
    const best = list.reduce((b, r) => (!b || r._sec < b._sec ? r : b), null);
    return { d, best, count: list.length };
  });
  const prSlugs = new Set(records.filter((x) => x.best && x.count > 1).map((x) => x.best._slug));

  const recordCards = records.map(({ d, best }) => {
    const goal = goals[d.goal];
    const goalLine = goal ? `<span class="record__meta">${esc(t('sport.goal', lang))}: ${esc(goal)}</span>` : '';
    if (best) {
      const label = L(best, 'label', lang);
      return `<div class="record">
          <span class="label">${esc(t(d.label, lang))}</span>
          <span class="record__value">${fmtTime(best._sec)}</span>
          <span class="record__meta">${esc(label ? `${label} · ${fmtMonth(best._date, lang)}` : fmtMonth(best._date, lang))}</span>
          ${SOURCE_TEXT[best.source] ? `<span class="record__meta">${esc(t(SOURCE_TEXT[best.source], lang))}</span>` : ''}
          ${goalLine}
        </div>`;
    }
    return `<div class="record">
          <span class="label">${esc(t(d.label, lang))}</span>
          <span class="record__value record__value--empty">—</span>
          <span class="record__meta">${esc(t('sport.not_run', lang))}</span>
          ${goalLine}
        </div>`;
  }).join('\n        ');

  const byQ = new Map();
  valid.filter((r) => r._dist === '5' && r._date).forEach((r) => {
    const qi = qIndex(quarterOf(r._date));
    const cur = byQ.get(qi);
    if (!cur || r._sec < cur.sec) byQ.set(qi, { qi, sec: r._sec, run: r });
  });
  const points = [...byQ.values()].sort((a, b) => a.qi - b.qi);
  const tableRows = points.map((p, i) => {
    let change;
    if (i === 0) change = L(p.run, 'label', lang) || t('sport.first', lang);
    else {
      const diff = p.sec - points[i - 1].sec;
      change = diff < 0 ? `−${fmtTime(-diff)} (${t('sport.faster', lang)})` : diff > 0 ? `+${fmtTime(diff)} (${t('sport.slower', lang)})` : t('sport.same', lang);
    }
    return `<tr><td>${qLabel(qFromIndex(p.qi), lang)}</td><td class="strong">${fmtTime(p.sec)}</td><td class="muted">${esc(change)}</td></tr>`;
  }).join('');

  const history = all.map((r) => {
    const title = L(r, 'title', lang) || t('sport.history', lang);
    const note = L(r, 'note', lang);
    const label = L(r, 'label', lang);
    const shot = r.screenshot ? `<a class="shot" href="${esc(media(r.screenshot))}"><img src="${esc(media(r.screenshot))}" alt="${esc(t('sport.screenshot_alt', lang))}: ${esc(title)}" loading="lazy"></a>` : '';
    const protocol = r.protocol_url ? `<a href="${esc(safeHref(r.protocol_url, lang))}"${extAttrs(r.protocol_url)}>${esc(t('sport.protocol', lang))}</a>` : '';
    return `<article class="card" id="run-${esc(r._slug)}">
          <div class="card__meta">
            ${label ? `<span class="tag">${esc(label)}</span>` : ''}
            ${prSlugs.has(r._slug) ? `<span class="tag tag--muted">${esc(t('sport.pr', lang))}</span>` : ''}
            <span>${esc(fmtDate(r._date, lang))}</span>
          </div>
          <h3 class="card__title">${esc(title)}</h3>
          <div class="stats">
            <div><span class="stat__label">${esc(t('sport.distance', lang))}</span><span class="stat__value">${esc(distLabel(r, lang))}</span></div>
            <div><span class="stat__label">${esc(t('sport.time', lang))}</span><span class="stat__value">${r._sec ? fmtTime(r._sec) : esc(r.time || '—')}</span></div>
            <div><span class="stat__label">${esc(t('sport.pace', lang))}</span><span class="stat__value">${r._sec && r._km ? `${fmtTime(r._sec / r._km)} /${esc(t('sport.km', lang))}` : '—'}</span></div>
            <div><span class="stat__label">${esc(t('sport.recorded_with', lang))}</span><span class="stat__value">${esc(tv(r.source, lang) || '—')}</span></div>
          </div>
          ${note ? `<p class="card__text">${inline(note, lang)}</p>` : ''}
          ${shot || protocol ? `<div class="proof">
            <span class="label">${esc(t('common.proof', lang))}</span>
            ${shot}
            ${protocol}
          </div>` : ''}
        </article>`;
  }).join('\n        ');

  const qs = chronicle.find((e) => e.type === 'Итог квартала');
  const nowQ = quarterOf(TODAY);
  const season = qs
    ? `<a class="season-link" href="${link(`chronicle/${qs._slug}/`, lang)}">
        <span class="stack-xs"><span class="label label--accent">${esc(t('sport.season', lang))} · ${esc(L(qs, 'period', lang) || fmtMonth(qs._date, lang))}</span><span class="season-link__title">${esc(L(qs, 'title', lang))}</span></span>
        <span class="more">${esc(t('common.read', lang))}</span>
      </a>`
    : `<a class="season-link" href="${link('chronicle/', lang)}#quarter">
        <span class="stack-xs"><span class="label label--accent">${esc(t('sport.season', lang))} · ${qLabel(nowQ, lang)}</span><span class="season-link__title">${esc(t('sport.season_soon', lang, { month: qEndMonth(nowQ, lang), year: nowQ.y }))}</span></span>
        <span class="more">${esc(t('menu.chronicle', lang))} →</span>
      </a>`;

  const body = `${hero({ kicker: `${t('common.section', lang)} I`, title: t('menu.sport', lang), lede: intro })}
<div class="wrap page-body page-body--wide">
  <section class="stack">
    <div class="stack-sm">
      <span class="label label--accent">${esc(t('sport.running', lang))}</span>
      <h2 class="h2">${esc(t('sport.records', lang))}</h2>
    </div>
    <div class="records">
        ${recordCards}
    </div>
  </section>

  <section class="stack">
    <div class="stack-sm">
      <h2 class="h2">${esc(t('sport.chart_title', lang))}</h2>
      <p class="muted">${esc(t('sport.chart_note', lang))}</p>
    </div>
    ${points.length ? `<figure class="chart-box">
      <div class="scroll-x chart">${chart5k(points, parseTime(goals.five_k), lang)}</div>
      <div class="scroll-x">
        <table class="data">
          <thead><tr><th scope="col">${esc(t('sport.th_quarter', lang))}</th><th scope="col">${esc(t('sport.th_best', lang))}</th><th scope="col">${esc(t('sport.th_change', lang))}</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </figure>` : `<p class="empty">${esc(t('sport.chart_empty', lang))}</p>`}
  </section>

  <section class="stack">
    <div class="stack-sm">
      <h2 class="h2">${esc(t('sport.history', lang))}</h2>
      <p class="muted">${esc(t('sport.history_note', lang))}</p>
    </div>
    ${all.length ? `<div class="stack">
        ${history}
    </div>` : `<p class="empty">${esc(t('sport.no_runs', lang))}</p>`}
  </section>

  ${season}
</div>`;
  writePage(lang, 'sport', layout(lang, { title: t('menu.sport', lang), description: intro, active: 'sport', body, path: 'sport/' }));
}

// ───────────────────────── Статьи ─────────────────────────

const ARTICLE_CATS = ['Экономика', 'Психология и философия', 'Учебные исследования', 'Прочее'];

function pageArticles(lang) {
  const intro = tr(site.intros, 'articles', lang);
  const chips = [['*', t('articles.all', lang)], ...ARTICLE_CATS.map((c) => [c, tv(c, lang)])]
    .map(([v, l]) => `<button type="button" class="chip" data-filter="${esc(v)}" aria-pressed="${v === '*' ? 'true' : 'false'}">${esc(l)}</button>`).join('\n    ');
  const list = articles.map((a) => {
    const ru = lang === 'en' && !translated(a);
    const href = link(`articles/${a._slug}/`, lang);
    return `<article class="pub" data-cat="${esc(a.category || 'Прочее')}">
      <span class="tags"><span class="tag">${esc(tv(a.category || 'Прочее', lang))}</span>${ru ? `<span class="tag tag--muted">${esc(t('common.in_ru', 'en'))}</span>` : ''}</span>
      <h2 class="pub__title"${ru ? ' lang="ru"' : ''}><a href="${href}">${esc(L(a, 'title', lang) || t('articles.untitled', lang))}</a></h2>
      <div class="pub__meta">
        <span class="pub__date">${esc(t('common.published', lang))}: ${esc(fmtDate(a._date, lang))}</span>
        <a class="btn btn--small" href="${href}">${esc(t('common.read_article', lang))}</a>
      </div>
    </article>`;
  }).join('\n    ');
  const howIWrite = tr(site, 'how_i_write', lang);

  const body = `${hero({ kicker: `${t('common.section', lang)} II`, title: t('menu.articles', lang), lede: intro })}
<div class="wrap page-body" data-filter-root>
  ${articles.length ? `<div class="filters" data-filter-bar hidden role="group" aria-label="${esc(t('articles.topics', lang))}">
    ${chips}
  </div>` : ''}
  <section aria-label="${esc(t('menu.articles', lang))}">
    <div class="list-head"><span class="label">${esc(t('articles.list_head', lang))}</span></div>
    ${list || `<p class="empty">${esc(t('articles.none', lang))}</p>`}
    <p class="empty" data-filter-empty hidden>${esc(t('articles.none_topic', lang))}</p>
  </section>
  ${howIWrite ? `<section class="info-box">
    <h2>${esc(t('articles.how', lang))}</h2>
    <p>${esc(howIWrite)}</p>
  </section>` : ''}
</div>`;
  writePage(lang, 'articles', layout(lang, { title: t('menu.articles', lang), description: intro, active: 'articles', body, path: 'articles/' }));

  articles.forEach((a) => {
    const pagePath = `articles/${a._slug}/`;
    const ru = lang === 'en' && !translated(a);
    const textLang = ru ? 'ru' : lang;
    const title = L(a, 'title', lang) || t('articles.untitled', lang);
    const also = (a.also_on || []).filter((x) => x && x.url);
    const sources = (a.sources || []).map((s) => (typeof s === 'string' ? s : s && s.source)).filter(Boolean);
    const body = `<article class="article">
  <nav class="crumbs" aria-label="${lang === 'en' ? 'Breadcrumbs' : 'Навигация'}"><a href="${link('articles/', lang)}">${esc(t('menu.articles', lang))}</a> <span aria-hidden="true">›</span> ${esc(title)}</nav>
  ${ru ? onlyRuNotice(pagePath) : ''}
  <header class="article__head"${ru ? ' lang="ru"' : ''}>
    <span class="tag">${esc(tv(a.category || 'Прочее', lang))}</span>
    <h1 class="article__title">${esc(title)}</h1>
    <span class="pub__date" lang="${lang}">${esc(t('common.published', lang))}: ${esc(fmtDate(a._date, lang))}</span>
  </header>
  ${also.length ? `<section class="also">
    <h2>${esc(t('articles.also', lang))}</h2>
    ${also.map((x) => `<div>${esc(x.site || hostOf(x.url))} — <a href="${esc(safeHref(x.url, lang))}"${extAttrs(x.url)}>${esc(x.url.replace(/^https?:\/\//, ''))}</a></div>`).join('\n    ')}
  </section>` : ''}
  <div class="prose article__body" lang="${textLang}">${md(L(a, 'body', lang), lang)}</div>
  ${sources.length ? `<section class="sources">
    <h2 class="label">${esc(t('articles.sources', lang))}</h2>
    <ol>${sources.map((s) => `<li>${inline(s, lang)}</li>`).join('')}</ol>
  </section>` : ''}
  <a class="more" href="${link('articles/', lang)}">${esc(t('articles.back', lang))}</a>
</article>`;
    writePage(lang, `articles/${a._slug}`, layout(lang, { title, description: excerpt(L(a, 'body', lang), 160), active: 'articles', body, path: pagePath }));
  });
}

// ───────────────────────── Хронология ─────────────────────────

const ENTRY_TYPES = ['Задумка', 'План', 'Событие', 'Идея'];
const SUMMARY_TYPES = ['Итог квартала', 'Итог года'];

function entryCard(e, lang) {
  const ru = lang === 'en' && !translated(e);
  const href = link(`chronicle/${e._slug}/`, lang);
  const body = L(e, 'body', lang);
  return `<article class="card${e.is_start ? '' : ' card--plain'}">
          <div class="card__meta"><span class="tag${e.is_start ? '' : ' tag--muted'}">${esc(tv(e.type || 'Событие', lang))}</span>${ru ? `<span class="tag tag--muted">${esc(t('common.in_ru', 'en'))}</span>` : ''}<span>${esc(t('common.recorded', lang))}: ${esc(fmtDate(e._date, lang))}</span></div>
          <h3 class="card__title"${ru ? ' lang="ru"' : ''}><a href="${href}">${esc(L(e, 'title', lang) || t('articles.untitled', lang))}</a></h3>
          ${body ? `<p class="card__text"${ru ? ' lang="ru"' : ''}>${esc(excerpt(body))}</p>` : ''}
          <a class="more" href="${href}">${esc(t('common.read_entry', lang))}</a>
        </article>`;
}

function summaryCard(e, lang) {
  const period = L(e, 'period', lang);
  const date = `${t('common.recorded', lang)}: ${fmtDate(e._date, lang)}`;
  return `<a class="summary-link" href="${link(`chronicle/${e._slug}/`, lang)}">
          <span class="stack-xs"><span class="summary-link__title">${esc(L(e, 'title', lang) || period)}</span><span class="muted">${esc(period ? `${period} · ${date}` : date)}</span></span>
          <span class="more">${esc(t('common.read', lang))}</span>
        </a>`;
}

function pageChronicle(lang) {
  const intro = tr(site.intros, 'chronicle', lang);
  const regular = chronicle.filter((e) => !SUMMARY_TYPES.includes(e.type));
  const quarters = chronicle.filter((e) => e.type === 'Итог квартала');
  const years = chronicle.filter((e) => e.type === 'Итог года');
  const start = chronicle.find((e) => e.is_start);
  const nowQ = quarterOf(TODAY);
  const startRu = start && lang === 'en' && !translated(start);

  const tabs = [['all', 'chronicle.tab_all'], ['quarter', 'chronicle.tab_quarter'], ['year', 'chronicle.tab_year'], ['start', 'chronicle.tab_start']];
  const body = `${hero({ kicker: `${t('common.section', lang)} III`, title: t('menu.chronicle', lang), lede: intro })}
<div class="wrap page-body" data-tabs data-default="all">
  <nav class="filters" aria-label="${esc(t('chronicle.tabs_label', lang))}">
    ${tabs.map(([id, key]) => `<a class="chip" href="#${id}" data-tab="${id}">${esc(t(key, lang))}</a>`).join('\n    ')}
  </nav>

  <section id="all" class="stack" data-panel="all">
    <h2 class="h2 panel-heading">${esc(t('chronicle.tab_all', lang))}</h2>
    <div class="list-head">
      <span class="types"><span class="muted">${esc(t('chronicle.types', lang))}</span> ${ENTRY_TYPES.map((x) => `<span class="tag tag--muted">${esc(tv(x, lang))}</span>`).join(' ')}</span>
      <span class="label">${esc(t('common.newest', lang))}</span>
    </div>
    ${regular.length ? regular.map((e) => entryCard(e, lang)).join('\n        ') : `<p class="empty">${esc(t('chronicle.none', lang))}</p>`}
  </section>

  <section id="quarter" class="stack" data-panel="quarter">
    <h2 class="h2 panel-heading">${esc(t('chronicle.tab_quarter', lang))}</h2>
    <p class="muted">${esc(t('chronicle.quarter_note', lang))}</p>
    ${quarters.map((e) => summaryCard(e, lang)).join('\n        ')}
    ${quarters.length ? '' : `<p class="empty">${esc(t('chronicle.quarter_soon', lang, { month: qEndMonth(nowQ, lang), year: nowQ.y }))}</p>`}
  </section>

  <section id="year" class="stack" data-panel="year">
    <h2 class="h2 panel-heading">${esc(t('chronicle.tab_year', lang))}</h2>
    <p class="muted">${esc(t('chronicle.year_note', lang))}</p>
    ${years.map((e) => summaryCard(e, lang)).join('\n        ')}
    ${years.length ? '' : `<p class="empty">${esc(tr(site, 'year_summary_note', lang))}</p>`}
  </section>

  <section id="start" class="stack" data-panel="start">
    <h2 class="h2 panel-heading">${esc(t('chronicle.tab_start', lang))}</h2>
    ${start ? `<article class="start-entry">
      ${startRu ? onlyRuNotice(`chronicle/${start._slug}/`) : ''}
      <span class="label label--accent">${esc(tv(start.type || 'Событие', lang))} · ${esc(t('common.recorded', lang))}: ${esc(fmtDate(start._date, lang))}</span>
      <h3 class="start-entry__title"${startRu ? ' lang="ru"' : ''}>${esc(L(start, 'title', lang) || t('chronicle.tab_start', lang))}</h3>
      <div class="prose" lang="${startRu ? 'ru' : lang}">${md(L(start, 'body', lang), lang)}</div>
      <a class="note-link" href="${link('about/', lang)}#point-zero">${esc(t('chronicle.start_link', lang))}</a>
    </article>` : `<p class="empty">${esc(t('chronicle.start_none', lang))}</p>`}
  </section>
</div>`;
  writePage(lang, 'chronicle', layout(lang, { title: t('menu.chronicle', lang), description: intro, active: 'chronicle', body, path: 'chronicle/' }));

  chronicle.forEach((e) => {
    const pagePath = `chronicle/${e._slug}/`;
    const ru = lang === 'en' && !translated(e);
    const title = L(e, 'title', lang) || t('articles.untitled', lang);
    const period = L(e, 'period', lang);
    const body = `<article class="article">
  <nav class="crumbs" aria-label="${lang === 'en' ? 'Breadcrumbs' : 'Навигация'}"><a href="${link('chronicle/', lang)}">${esc(t('menu.chronicle', lang))}</a> <span aria-hidden="true">›</span> ${esc(title)}</nav>
  ${ru ? onlyRuNotice(pagePath) : ''}
  <header class="article__head"${ru ? ' lang="ru"' : ''}>
    <span class="tag">${esc(tv(e.type || 'Событие', lang))}</span>
    <h1 class="article__title">${esc(title)}</h1>
    <span class="pub__date" lang="${lang}">${period ? `${esc(period)} · ` : ''}${esc(t('common.recorded', lang))}: ${esc(fmtDate(e._date, lang))}</span>
  </header>
  <div class="prose article__body" lang="${ru ? 'ru' : lang}">${md(L(e, 'body', lang), lang)}</div>
  ${e.is_start ? `<a class="note-link" href="${link('about/', lang)}#point-zero">${esc(t('chronicle.start_link', lang))}</a>` : ''}
  <a class="more" href="${link('chronicle/', lang)}">${esc(t('chronicle.back', lang))}</a>
</article>`;
    writePage(lang, `chronicle/${e._slug}`, layout(lang, { title, description: excerpt(L(e, 'body', lang), 160), active: 'chronicle', body, path: pagePath }));
  });
}

// ───────────────────────── Достижения ─────────────────────────

const ACH_CATS = [
  ['projects', 'Проекты'],
  ['study', 'Учёба'],
  ['olympiads', 'Олимпиады и конкурсы'],
  ['certificates', 'Сертификаты'],
  ['sport', 'Спорт'],
];

function achievementCard(a, lang) {
  const p = a.proof || {};
  const title = L(a, 'title', lang) || t('articles.untitled', lang);
  const desc = L(a, 'description', lang);
  const ru = lang === 'en' && filled(a.description) && !filled(enOf(a).description);
  const proofLabel = (lang === 'en' && filled(enOf(a).proof_label)) ? enOf(a).proof_label : p.label;
  const parts = [];
  if (p.url) parts.push(`<a href="${esc(safeHref(p.url, lang))}"${extAttrs(p.url)}>${esc(proofLabel || hostOf(p.url))} →</a>`);
  if (p.file) parts.push(`<a href="${esc(media(p.file))}"${extAttrs(p.file)}>${esc(t('common.open_doc', lang))}</a>`);
  if (p.image) parts.push(`<a class="shot shot--wide" href="${esc(media(p.image))}"><img src="${esc(media(p.image))}" alt="${esc(t('common.proof', lang))}: ${esc(title)}" loading="lazy"></a>`);
  return `<article class="card" id="a-${esc(a._slug)}">
          <div class="card__meta">${esc(t('common.published', lang))}: ${esc(fmtDate(a._date, lang))}${ru ? ` <span class="tag tag--muted">${esc(t('common.in_ru', 'en'))}</span>` : ''}</div>
          <h3 class="card__title">${esc(title)}</h3>
          ${desc ? `<div class="prose prose--card"${ru ? ' lang="ru"' : ''}>${md(desc, lang)}</div>` : ''}
          ${parts.length ? `<div class="proof">
            <span class="label">${esc(t('common.proof', lang))}</span>
            ${parts.join('\n            ')}
          </div>` : ''}
        </article>`;
}

function pageAchievements(lang) {
  const intro = tr(site.intros, 'achievements', lang);
  const groups = ACH_CATS.map(([id, value]) => ({ id, label: tv(value, lang), items: achievements.filter((a) => (a.category || 'Проекты') === value) }));
  const first = groups.find((g) => g.items.length) || groups[0];
  const count = (n) => (lang === 'en' ? `${n} ${n === 1 ? 'achievement' : 'achievements'}` : `${n} ${pluralRu(n, 'достижение', 'достижения', 'достижений')}`);
  const how = tr(site, 'how_achievements', lang);
  const body = `${hero({ kicker: `${t('common.section', lang)} IV`, title: t('menu.achievements', lang), lede: intro })}
<div class="wrap page-body">
  <div class="stack-lg" data-tabs data-default="${first.id}">
    <nav class="tiles" aria-label="${esc(t('achievements.tabs_label', lang))}">
      ${groups.map((g) => `<a class="tile" href="#${g.id}" data-tab="${g.id}">
        <span class="tile__name">${esc(g.label)}</span>
        <span class="tile__count">${esc(g.items.length ? count(g.items.length) : t('common.empty_short', lang))}</span>
      </a>`).join('\n      ')}
    </nav>
    ${groups.map((g) => `<section id="${g.id}" class="stack" data-panel="${g.id}">
      <div class="list-head"><h2 class="h2">${esc(g.label)}</h2><span class="label">${esc(t('common.newest', lang))}</span></div>
      ${g.items.length ? g.items.map((a) => achievementCard(a, lang)).join('\n      ') : `<p class="empty">${esc(t('common.empty', lang))}</p>`}
    </section>`).join('\n    ')}
  </div>
  ${how ? `<section class="info-box info-box--soft">
    <h2>${esc(t('achievements.how', lang))}</h2>
    <p>${esc(how)}</p>
  </section>` : ''}
</div>`;
  writePage(lang, 'achievements', layout(lang, { title: t('menu.achievements', lang), description: intro, active: 'achievements', body, path: 'achievements/' }));
}

// ───────────────────────── 404, карта сайта, значок ─────────────────────────

function page404() {
  const body = `${hero({ kicker: t('errors.kicker', 'en'), title: t('errors.title', 'en'), lede: t('errors.text', 'en') })}
<p class="lede lede--center" lang="ru">${esc(t('errors.title', 'ru'))}. ${esc(t('errors.text', 'ru'))}</p>
<div class="btn-row btn-row--404">
  <a class="btn btn--solid" href="${link('', 'en')}">${esc(t('errors.btn', 'en'))}</a>
  <a class="btn" href="${link('', 'ru')}" lang="ru">${esc(t('errors.btn', 'ru'))}</a>
</div>`;
  fs.writeFileSync(path.join(OUT, '404.html'), layout('en', { title: t('errors.title', 'en'), body }));
}

function writeMeta() {
  const initials = tr(site, 'initials', 'en') || site.initials || '';
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#ffffff" stroke="#1F3A5F" stroke-width="3"/><text x="32" y="40.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="23" fill="#1F3A5F">${esc(initials)}</text></svg>\n`;
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);
  const robots = ['User-agent: *', `Disallow: ${asset('admin/')}`];
  if (ORIGIN) {
    const urls = sitemap.map((p) => `  <url><loc>${esc(ORIGIN + link(p.rel, p.lang))}</loc></url>`).join('\n');
    fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    robots.push(`Sitemap: ${ORIGIN + asset('sitemap.xml')}`);
  }
  fs.writeFileSync(path.join(OUT, 'robots.txt'), robots.join('\n') + '\n');
}

function copyStatic(from, to) {
  if (!fs.existsSync(from)) return;
  for (const name of fs.readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = path.join(from, name), dst = path.join(to, name);
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyStatic(src, dst);
    } else if (path.relative(STATIC, src) === path.join('admin', 'config.yml')) {
      const yml = fs.readFileSync(src, 'utf8')
        .replace(/__REPO__/g, REPO)
        .replace(/__BRANCH__/g, BRANCH)
        .replace(/__SITE_URL__/g, SITE_URL || 'https://example.com');
      fs.writeFileSync(dst, yml);
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

// ───────────────────────── Сборка ─────────────────────────

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
copyStatic(STATIC, OUT);
for (const lang of LANGS) {
  pageHome(lang);
  pageAbout(lang);
  pageSport(lang);
  pageArticles(lang);
  pageChronicle(lang);
  pageAchievements(lang);
}
page404();
writeMeta();

const untranslated = [...articles, ...chronicle].filter((e) => !translated(e)).map((e) => e._file);
console.log(`✓ Сайт собран в ${path.relative(process.cwd(), OUT) || '_site'}: ${sitemap.length} страниц (EN + RU)`);
console.log(`  статей: ${articles.length}, записей хронологии: ${chronicle.length}, достижений: ${achievements.length}, забегов: ${runs.length}`);
console.log(`  без перевода на английский: ${untranslated.length ? untranslated.join(', ') : 'нет'}`);
console.log(`  базовый путь: ${BASE}${SITE_URL ? `, адрес: ${SITE_URL}` : ''}`);
