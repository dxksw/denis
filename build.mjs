// Сборщик сайта-портфолио.
// Работает без внешних библиотек: нужен только Node.js 18 или новее.
// Запуск:  node build.mjs   →   готовый сайт появляется в папке _site
//
// Контент лежит в папке content/ (его правит админ-панель), оформление — в static/assets/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function normBase(b) {
  b = String(b).trim();
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b.replace(/\/{2,}/g, '/');
}
function safeOrigin(u) {
  try { return new URL(u).origin; } catch { return ''; }
}

// ───────────────────────── Общие помощники ─────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const link = (p = '') => BASE + String(p).replace(/^\/+/, '');

function media(src) {
  if (!src) return '';
  src = String(src).trim();
  if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return src;
  if (src.startsWith('/')) return link(src);
  return src;
}

function safeHref(u) {
  u = String(u || '').trim();
  if (!u) return '#';
  if (/^(javascript|vbscript|data):/i.test(u)) return '#';
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(u)) return 'mailto:' + u;
  if (/^www\./i.test(u)) return 'https://' + u;
  if (u.startsWith('/')) return link(u);
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

function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

// ───────────────────────── Даты и время ─────────────────────────

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROMAN = ['I', 'II', 'III', 'IV'];

function parseDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
const fmtDate = (d) => (d ? `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '');
const fmtDateEn = (d) => (d ? `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '');
const fmtMonth = (d) => (d ? `${MONTHS_NOM[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '');
const isoDate = (d) => (d ? d.toISOString().slice(0, 10) : '');

const quarterOf = (d) => ({ y: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 });
const qIndex = ({ y, q }) => y * 4 + (q - 1);
const qFromIndex = (i) => ({ y: Math.floor(i / 4), q: (i % 4) + 1 });
const qLabel = ({ y, q }) => `${ROMAN[q - 1]} квартал ${y}`;
const qShort = ({ y, q }) => `${ROMAN[q - 1]} кв. ${y}`;
const qEndMonthGen = ({ q }) => MONTHS_GEN[q * 3 - 1];

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
const fmtPace = (secPerKm) => `${fmtTime(secPerKm)} /км`;

// ───────────────────────── Markdown (упрощённый) ─────────────────────────

function emphasis(s) {
  return s
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*?[^_\s])?)_(?=[^\p{L}\p{N}_]|$)/gu, '$1<em>$2</em>')
    .replace(/~~([^~]+?)~~/g, '<del>$1</del>');
}

function inline(src) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = String(src ?? '');
  s = s.replace(/`([^`]+)`/g, (m, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (m, alt, u) => keep(`<img src="${esc(media(u))}" alt="${esc(alt)}" loading="lazy">`));
  s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (m, text, u) => keep(`<a href="${esc(safeHref(u))}"${extAttrs(u)}>${emphasis(esc(text))}</a>`));
  s = s.replace(/(^|[\s(«])(https?:\/\/[^\s<>)»]*[^\s<>).,;:!?»"'])/g,
    (m, pre, u) => pre + keep(`<a href="${esc(u)}"${extAttrs(u)}>${esc(u)}</a>`));
  s = emphasis(esc(s));
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[+i]);
}

const RE_LIST = /^\s*([-*+]|\d+[.)])\s+/;
const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_QUOTE = /^\s*>/;

function md(src) {
  if (!src) return '';
  const lines = String(src).replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    let m = line.match(RE_HEAD);
    if (m) {
      const lvl = Math.min(6, m[1].length + 1);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }
    if (RE_QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${md(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (RE_LIST.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (RE_LIST.test(l) && /^\s*\d+[.)]\s+/.test(l) === ordered) { items.push(l.replace(RE_LIST, '')); i++; continue; }
        if (items.length && /^\s{2,}\S/.test(l) && !RE_LIST.test(l)) { items[items.length - 1] += '\n' + l.trim(); i++; continue; }
        if (items.length && RE_LIST.test(l)) { items.push(l.replace(RE_LIST, '')); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t).replace(/\n/g, '<br>')}</li>`).join('')}</${tag}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !RE_HEAD.test(lines[i])
      && !RE_QUOTE.test(lines[i]) && !RE_LIST.test(lines[i]) && !RE_HR.test(lines[i])) {
      buf.push(lines[i].replace(/(\\|\s{2,})$/, ''));
      i++;
    }
    out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
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

const articles = readCollection('articles');
const chronicle = readCollection('chronicle');
const achievements = readCollection('achievements');
const runs = readCollection('runs');

const NAME = site.name || 'Портфолио';
const START_YEAR = Number(site.start_year) || TODAY.getUTCFullYear();

// ───────────────────────── Каркас страницы ─────────────────────────

const NAV = [
  ['about', 'Обо мне', 'about/'],
  ['sport', 'Спорт', 'sport/'],
  ['articles', 'Статьи', 'articles/'],
  ['chronicle', 'Хронология', 'chronicle/'],
  ['achievements', 'Достижения', 'achievements/'],
];

const sitemap = [];

function layout({ title, description, active, body, path: pagePath = '' }) {
  const fullTitle = title ? `${title} — ${NAME}` : NAME;
  const desc = description || site.description || '';
  const year = TODAY.getUTCFullYear();
  const years = year > START_YEAR ? `${START_YEAR}–${year}` : `${START_YEAR}`;
  const canonical = ORIGIN ? ORIGIN + link(pagePath) : '';
  const nav = NAV.map(([id, label, href]) =>
    `<a href="${link(href)}"${active === id ? ' aria-current="page"' : ''}>${label}</a>`).join('\n        ');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">${canonical ? `
<meta property="og:url" content="${esc(canonical)}">
<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="icon" href="${link('favicon.svg')}" type="image/svg+xml">
<link rel="preload" href="${link('assets/fonts/eb-garamond.woff')}" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${link('assets/site.css')}?v=${VERSION}">
<script>document.documentElement.className += ' js';</script>
</head>
<body>
<a class="skip" href="#main">Перейти к содержанию</a>
<div class="topbar" aria-hidden="true"></div>
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="${link('')}"${active === 'home' ? ' aria-current="page"' : ''}>
      <span class="monogram" aria-hidden="true">${esc(site.initials || '')}</span>
      <span class="brand__name">${esc(NAME)}</span>
    </a>
    <nav class="nav" aria-label="Главное меню">
        ${nav}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="site-footer__inner">
    <span class="site-footer__name">${esc(NAME)}</span>
    <span class="site-footer__meta">© ${years}${site.footer_note ? ` · ${esc(site.footer_note)}` : ''} · <a href="${link('about/')}">Контакты</a></span>
  </div>
</footer>
<script src="${link('assets/site.js')}?v=${VERSION}" defer></script>
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

function writePage(rel, html) {
  const file = path.join(OUT, rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  sitemap.push(rel ? rel.replace(/\\/g, '/') + '/' : '');
}

// ───────────────────────── Главная ─────────────────────────

function pageHome() {
  const s = site.sections || {};
  const items = [
    ['I', 'Спорт', 'sport/', s.sport],
    ['II', 'Статьи', 'articles/', s.articles],
    ['III', 'Хронология', 'chronicle/', s.chronicle],
    ['IV', 'Достижения', 'achievements/', s.achievements],
  ];
  const body = `${hero({ kicker: site.kicker, title: NAME, lede: site.tagline, home: true })}
<div class="btn-row">
  <a class="btn btn--solid" href="${link('about/')}">Обо мне</a>
  <a class="btn" href="${link('chronicle/')}">Читать хронологию</a>
</div>
<div class="ornament ornament--home" aria-hidden="true"><span></span></div>
<section class="wrap home-sections" aria-labelledby="sections-title">
  <h2 class="section-title" id="sections-title">Разделы</h2>
  <div class="sections">
    ${items.map(([n, title, href, text]) => `<a class="section-link" href="${link(href)}">
      <span class="roman" aria-hidden="true">${n}</span>
      <span><span class="section-link__title">${title}</span>${text ? `<span class="section-link__text">${esc(text)}</span>` : ''}</span>
    </a>`).join('\n    ')}
  </div>
</section>`;
  writePage('', layout({ active: 'home', body, path: '' }));
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

function pageAbout() {
  const pz = about.point_zero || {};
  const rows = (pz.rows || []).map((r) => `<div class="row">
          <span><span class="row__label">${esc(r.label)}</span>${r.note ? `<span class="row__note">${esc(r.note)}</span>` : ''}</span>
          <span class="row__value">${esc(r.value)}</span>
        </div>`).join('\n        ');
  const goals = (about.goals || []).filter(Boolean).map((g, i) => `<div class="goal"><span class="roman" aria-hidden="true">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] || i + 1}</span><span class="goal__text">${inline(typeof g === 'string' ? g : g.goal)}</span></div>`).join('\n        ');
  const skills = (about.skills || []).filter((s) => s && s.name);
  const facts = (about.facts || []).filter((f) => f && (f.label || f.value));
  const socials = (about.socials || []).filter((s) => s && s.url);

  const body = `${hero({ kicker: 'Обо мне', title: about.title || 'Обо мне' })}
<div class="wrap">
  <div class="two-col">
    <div class="two-col__main">
      ${about.story ? `<section class="stack">
        <h2 class="h2">Моя история</h2>
        <div class="prose">${md(about.story)}</div>
      </section>` : ''}
      ${about.why ? `<section class="stack">
        <h2 class="h2">Почему экономика</h2>
        <div class="prose">${md(about.why)}</div>
      </section>` : ''}
      ${rows || pz.intro ? `<section id="point-zero" class="panel-soft">
        <div class="stack-sm">
          ${pz.date ? `<span class="label label--accent">${esc(pz.date)}</span>` : ''}
          <h2 class="h2 h2--lg">Точка ноль</h2>
          ${pz.intro ? `<p class="lede lede--left">${esc(pz.intro)}</p>` : ''}
        </div>
        ${rows ? `<div class="rows">
        ${rows}
        </div>` : ''}
        ${pz.verification ? `<div class="note-box">
          <span class="label">О подтверждении</span>
          <p>${esc(pz.verification)}</p>
        </div>` : ''}
      </section>` : ''}
      ${skills.length ? `<section class="stack">
        <h2 class="h2">Навыки</h2>
        <div class="skills">
          ${skills.map((s) => `<div class="skill">
            <span class="skill__name">${esc(s.name)}</span>
            ${s.description ? `<span class="skill__text">${inline(s.description)}</span>` : ''}
            ${s.proof_url ? `<a class="skill__proof" href="${esc(safeHref(s.proof_url))}"${extAttrs(s.proof_url)}>Подтверждение →</a>` : ''}
          </div>`).join('\n          ')}
        </div>
      </section>` : ''}
      ${goals ? `<section class="stack">
        <h2 class="h2">Куда я иду</h2>
        <div class="goals">
        ${goals}
        </div>
      </section>` : ''}
      ${about.chronicle_method ? `<section class="stack">
        <h2 class="h2">Как я веду хронологию</h2>
        <p class="prose-p">${esc(about.chronicle_method)}</p>
        <a class="more" href="${link('chronicle/')}">Открыть хронологию →</a>
      </section>` : ''}
    </div>
    <aside class="two-col__side" aria-label="Профиль">
      ${about.portrait ? `<img class="portrait" src="${esc(media(about.portrait))}" alt="${esc(NAME)}" loading="lazy">` : ''}
      <div class="side-head">
        <div class="side-name">${esc(NAME)}</div>
        ${about.subtitle ? `<div class="side-sub">${esc(about.subtitle)}</div>` : ''}
      </div>
      ${facts.length ? `<div class="facts">
        ${facts.map((f) => `<div><span class="fact__label">${esc(f.label)}</span><span class="fact__value">${esc(f.value)}</span></div>`).join('\n        ')}
      </div>` : ''}
      ${socials.length ? `<div class="socials">
        <span class="fact__label">Где меня найти</span>
        ${socials.map((s) => `<a href="${esc(safeHref(s.url))}"${extAttrs(safeHref(s.url))}>${iconFor(s.name || '', s.url)}<span class="socials__name">${esc(s.name || hostOf(s.url))}</span>${s.handle ? `<span class="socials__handle">${esc(s.handle)}</span>` : ''}</a>`).join('\n        ')}
      </div>` : ''}
    </aside>
  </div>
</div>`;
  writePage('about', layout({ title: 'Обо мне', active: 'about', body, path: 'about/' }));
}

// ───────────────────────── Спорт ─────────────────────────

const DISTANCES = [
  { key: '5', km: 5, label: '5 км', short: '5 км', goal: 'five_k' },
  { key: '10', km: 10, label: '10 км', short: '10 км', goal: 'ten_k' },
  { key: '21.1', km: 21.0975, label: 'Полумарафон', short: '21,1 км', goal: 'half' },
  { key: '42.2', km: 42.195, label: 'Марафон', short: '42,2 км', goal: 'marathon' },
];
const SOURCE_TEXT = {
  'Спортивные часы': 'По спортивным часам',
  '5 вёрст': 'Протокол «5 вёрст»',
  'Официальный забег': 'Официальный протокол',
};

function runInfo(r) {
  const d = DISTANCES.find((x) => x.key === String(r.distance));
  let km = d ? d.km : parseFloat(String(r.distance_km ?? '').replace(',', '.'));
  if (!Number.isFinite(km) || km <= 0) km = null;
  const sec = parseTime(r.time);
  const distLabel = d ? d.short : km ? `${String(Math.round(km * 100) / 100).replace('.', ',')} км` : '—';
  return { ...r, _km: km, _sec: sec, _dist: d ? d.key : null, _distLabel: distLabel };
}

function chart5k(points, goalSec) {
  const W = 960, H = 300, L = 80, R = 930, T = 40, B = 250;
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
  const x = (qi) => L + ((qi - startQ) / (endQ - startQ)) * (R - L);
  const y = (sec) => T + ((sec / 60 - lo) / (hi - lo)) * (B - T);
  const font = 'font-family="Source Sans 3, Arial, sans-serif" font-size="14"';
  const parts = [];
  for (let m = lo; m <= hi; m += step) {
    const yy = y(m * 60).toFixed(1);
    parts.push(`<line x1="${L}" y1="${yy}" x2="${R}" y2="${yy}" stroke="${m === hi ? '#9AA1AB' : '#EEF0F3'}" stroke-width="1"></line>`);
    parts.push(`<text x="${L - 14}" y="${(+yy + 5).toFixed(1)}" text-anchor="end" ${font} fill="#5A6270">${m}:00</text>`);
  }
  for (let qi = startQ; qi <= endQ; qi++) {
    const xx = x(qi).toFixed(1);
    const major = (qi - startQ) % 4 === 0 || qi === endQ;
    parts.push(`<line x1="${xx}" y1="${B}" x2="${xx}" y2="${B + (major ? 6 : 4)}" stroke="${major ? '#9AA1AB' : '#C4CAD3'}"></line>`);
    if ((qi - startQ) % 4 === 0) {
      const anchor = qi === startQ ? 'start' : qi === endQ ? 'end' : 'middle';
      parts.push(`<text x="${xx}" y="${B + 30}" text-anchor="${anchor}" ${font} fill="#5A6270">${qShort(qFromIndex(qi))}</text>`);
    }
  }
  if (goalSec) {
    const gy = y(goalSec).toFixed(1);
    parts.push(`<line x1="${L}" y1="${gy}" x2="${R}" y2="${gy}" stroke="#1F3A5F" stroke-width="1.5" stroke-dasharray="6 6"></line>`);
    parts.push(`<text x="${R}" y="${(+gy - 8).toFixed(1)}" text-anchor="end" ${font} fill="#1F3A5F">Цель: ${fmtTime(goalSec)}</text>`);
  }
  if (points.length > 1) {
    parts.push(`<polyline points="${points.map((p) => `${x(p.qi).toFixed(1)},${y(p.sec).toFixed(1)}`).join(' ')}" fill="none" stroke="#1F3A5F" stroke-width="2"></polyline>`);
  }
  points.forEach((p) => parts.push(`<circle cx="${x(p.qi).toFixed(1)}" cy="${y(p.sec).toFixed(1)}" r="6" fill="#1F3A5F"></circle>`));
  const first = points[0];
  const firstText = `${first.run.label ? first.run.label + ' · ' : ''}${fmtTime(first.sec)}`;
  const fy = y(first.sec);
  const firstY = fy + 26 < B - 4 ? fy + 26 : fy - 12;
  parts.push(`<text x="${(x(first.qi) + 12).toFixed(1)}" y="${firstY.toFixed(1)}" ${font} fill="#1B1F24">${esc(firstText)}</text>`);
  if (points.length > 1) {
    const last = points[points.length - 1];
    const lx = x(last.qi);
    parts.push(`<text x="${(lx > R - 120 ? lx - 14 : lx + 14).toFixed(1)}" y="${(y(last.sec) - 12).toFixed(1)}" text-anchor="${lx > R - 120 ? 'end' : 'start'}" ${font} fill="#1B1F24">${fmtTime(last.sec)}</text>`);
  }
  const aria = 'Лучшее время на 5 км по кварталам: ' + points.map((p) => `${qLabel(qFromIndex(p.qi))} — ${fmtTime(p.sec)}`).join('; ')
    + (goalSec ? `. Цель — ${fmtTime(goalSec)}` : '') + '. Чем выше точка, тем быстрее.';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${parts.join('')}</svg>`;
}

function latestQuarterSummary() {
  return chronicle.find((e) => e.type === 'Итог квартала');
}

function pageSport() {
  const intro = (site.intros || {}).sport;
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
    if (best) {
      return `<div class="record">
          <span class="label">${d.label}</span>
          <span class="record__value">${fmtTime(best._sec)}</span>
          <span class="record__meta">${esc(best.label ? `${best.label} · ${fmtMonth(best._date)}` : fmtMonth(best._date))}</span>
          ${SOURCE_TEXT[best.source] ? `<span class="record__meta">${esc(SOURCE_TEXT[best.source])}</span>` : ''}
          ${goal ? `<span class="record__meta">Цель: ${esc(goal)}</span>` : ''}
        </div>`;
    }
    return `<div class="record">
          <span class="label">${d.label}</span>
          <span class="record__value record__value--empty">—</span>
          <span class="record__meta">Ещё не пробегал</span>
          ${goal ? `<span class="record__meta">Цель: ${esc(goal)}</span>` : ''}
        </div>`;
  }).join('\n        ');

  // Лучшее время на 5 км в каждом квартале
  const byQ = new Map();
  valid.filter((r) => r._dist === '5' && r._date).forEach((r) => {
    const qi = qIndex(quarterOf(r._date));
    const cur = byQ.get(qi);
    if (!cur || r._sec < cur.sec) byQ.set(qi, { qi, sec: r._sec, run: r });
  });
  const points = [...byQ.values()].sort((a, b) => a.qi - b.qi);
  const tableRows = points.map((p, i) => {
    let change;
    if (i === 0) change = p.run.label || 'Первый замер';
    else {
      const diff = p.sec - points[i - 1].sec;
      change = diff < 0 ? `−${fmtTime(-diff)} (быстрее)` : diff > 0 ? `+${fmtTime(diff)} (медленнее)` : 'Без изменений';
    }
    return `<tr><td>${qLabel(qFromIndex(p.qi))}</td><td class="strong">${fmtTime(p.sec)}</td><td class="muted">${esc(change)}</td></tr>`;
  }).join('');

  const history = all.map((r) => {
    const shot = r.screenshot ? `<a class="shot" href="${esc(media(r.screenshot))}"><img src="${esc(media(r.screenshot))}" alt="Скриншот из приложения: ${esc(r.title || 'забег')}" loading="lazy"></a>` : '';
    const protocol = r.protocol_url ? `<a href="${esc(safeHref(r.protocol_url))}"${extAttrs(r.protocol_url)}>Протокол забега →</a>` : '';
    return `<article class="card" id="run-${esc(r._slug)}">
          <div class="card__meta">
            ${r.label ? `<span class="tag">${esc(r.label)}</span>` : ''}
            ${prSlugs.has(r._slug) ? '<span class="tag tag--muted">Личный рекорд</span>' : ''}
            <span>${esc(fmtDate(r._date))}</span>
          </div>
          <h3 class="card__title">${esc(r.title || 'Забег')}</h3>
          <div class="stats">
            <div><span class="stat__label">Дистанция</span><span class="stat__value">${esc(r._distLabel)}</span></div>
            <div><span class="stat__label">Время</span><span class="stat__value">${r._sec ? fmtTime(r._sec) : esc(r.time || '—')}</span></div>
            <div><span class="stat__label">Темп</span><span class="stat__value">${r._sec && r._km ? fmtPace(r._sec / r._km) : '—'}</span></div>
            <div><span class="stat__label">Записано</span><span class="stat__value">${esc(r.source || '—')}</span></div>
          </div>
          ${r.note ? `<p class="card__text">${inline(r.note)}</p>` : ''}
          ${shot || protocol ? `<div class="proof">
            <span class="label">Подтверждение</span>
            ${shot}
            ${protocol}
          </div>` : ''}
        </article>`;
  }).join('\n        ');

  const qs = latestQuarterSummary();
  const nowQ = quarterOf(TODAY);
  const season = qs
    ? `<a class="season-link" href="${link(`chronicle/${qs._slug}/`)}">
        <span class="stack-xs"><span class="label label--accent">Итог сезона · ${esc(qs.period || fmtMonth(qs._date))}</span><span class="season-link__title">${esc(qs.title)}</span></span>
        <span class="more">Читать →</span>
      </a>`
    : `<a class="season-link" href="${link('chronicle/')}#quarter">
        <span class="stack-xs"><span class="label label--accent">Итог сезона · ${qLabel(nowQ)}</span><span class="season-link__title">Появится в конце ${qEndMonthGen(nowQ)} ${nowQ.y} в хронологии</span></span>
        <span class="more">Хронология →</span>
      </a>`;

  const body = `${hero({ kicker: 'Раздел I', title: 'Спорт', lede: intro })}
<div class="wrap page-body page-body--wide">
  <section class="stack">
    <div class="stack-sm">
      <span class="label label--accent">Бег</span>
      <h2 class="h2">Личные рекорды</h2>
    </div>
    <div class="records">
        ${recordCards}
    </div>
  </section>

  <section class="stack">
    <div class="stack-sm">
      <h2 class="h2">Развитие бега: 5 км по кварталам</h2>
      <p class="muted">Лучшее время на 5 км за каждый квартал. Шкала перевёрнута: чем выше точка, тем быстрее.</p>
    </div>
    ${points.length ? `<figure class="chart-box">
      <div class="scroll-x chart">${chart5k(points, parseTime(goals.five_k))}</div>
      <div class="scroll-x">
        <table class="data">
          <thead><tr><th scope="col">Квартал</th><th scope="col">Лучшее время на 5 км</th><th scope="col">Изменение</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </figure>` : '<p class="empty">График появится после первого забега на 5 км.</p>'}
  </section>

  <section class="stack">
    <div class="stack-sm">
      <h2 class="h2">История забегов</h2>
      <p class="muted">Сначала новые. Под каждым забегом — скриншот из приложения как подтверждение.</p>
    </div>
    ${all.length ? `<div class="stack">
        ${history}
    </div>` : '<p class="empty">Забегов пока нет.</p>'}
  </section>

  ${season}
</div>`;
  writePage('sport', layout({ title: 'Спорт', description: intro, active: 'sport', body, path: 'sport/' }));
}

// ───────────────────────── Статьи ─────────────────────────

const ARTICLE_CATS = ['Экономика', 'Психология и философия', 'Учебные исследования', 'Прочее'];
const CAT_EN = {
  'Экономика': 'Economics',
  'Психология и философия': 'Psychology & Philosophy',
  'Учебные исследования': 'Academic research',
  'Прочее': 'Other',
};

function pageArticles() {
  const intro = (site.intros || {}).articles;
  const chips = [['*', 'Все'], ...ARTICLE_CATS.map((c) => [c, c])]
    .map(([v, l]) => `<button type="button" class="chip" data-filter="${esc(v)}" aria-pressed="${v === '*' ? 'true' : 'false'}">${esc(l)}</button>`).join('\n    ');
  const list = articles.map((a) => `<article class="pub" data-cat="${esc(a.category || 'Прочее')}">
      <span class="tag">${esc(a.category || 'Прочее')}</span>
      <h2 class="pub__title"><a href="${link(`articles/${a._slug}/`)}">${esc(a.title || 'Без названия')}</a></h2>
      <div class="pub__meta">
        <span class="pub__date">Опубликовано: ${esc(fmtDate(a._date))}</span>
        <a class="btn btn--small" href="${link(`articles/${a._slug}/`)}">Читать статью →</a>
      </div>
    </article>`).join('\n    ');

  const body = `${hero({ kicker: 'Раздел II', title: 'Статьи', lede: intro })}
<div class="wrap page-body" data-filter-root>
  ${articles.length ? `<div class="filters" data-filter-bar hidden role="group" aria-label="Темы статей">
    ${chips}
  </div>` : ''}
  <section aria-label="Публикации">
    <div class="list-head"><span class="label">Публикации · сначала новые</span></div>
    ${list || '<p class="empty">Статей пока нет.</p>'}
    <p class="empty" data-filter-empty hidden>В этой теме пока нет статей.</p>
  </section>
  ${site.how_i_write ? `<section class="info-box">
    <h2>Как я пишу</h2>
    <p>${esc(site.how_i_write)}</p>
  </section>` : ''}
</div>`;
  writePage('articles', layout({ title: 'Статьи', description: intro, active: 'articles', body, path: 'articles/' }));

  articles.forEach((a) => {
    const en = a.en && (a.en.title || a.en.body) ? a.en : null;
    const also = (a.also_on || []).filter((x) => x && x.url);
    const sources = (a.sources || []).map((s) => (typeof s === 'string' ? s : s && s.source)).filter(Boolean);
    const alsoBlock = (label) => (also.length ? `<section class="also">
        <h2>${label}</h2>
        ${also.map((x) => `<div>${esc(x.site || hostOf(x.url))} — <a href="${esc(safeHref(x.url))}"${extAttrs(x.url)}>${esc(x.url.replace(/^https?:\/\//, ''))}</a></div>`).join('\n        ')}
      </section>` : '');
    const sourcesBlock = (label) => (sources.length ? `<section class="sources">
        <h2 class="label">${label}</h2>
        <ol>${sources.map((s) => `<li>${inline(s)}</li>`).join('')}</ol>
      </section>` : '');
    const body = `<article class="article" data-lang-root>
  <div class="article__top">
    <nav class="crumbs" aria-label="Навигация"><a href="${link('articles/')}">Статьи</a> <span aria-hidden="true">›</span> ${esc(a.title || '')}</nav>
    ${en ? `<div class="lang-switch" data-lang-switch hidden role="group" aria-label="Язык статьи">
      <button type="button" data-lang-btn="ru" aria-pressed="true">RU · оригинал</button>
      <button type="button" data-lang-btn="en" aria-pressed="false">EN · translation</button>
    </div>` : ''}
  </div>
  <div class="article__lang" data-lang="ru" lang="ru">
    <header class="article__head">
      <span class="tag">${esc(a.category || 'Прочее')}</span>
      <h1 class="article__title">${esc(a.title || '')}</h1>
      <span class="pub__date">Опубликовано: ${esc(fmtDate(a._date))}</span>
    </header>
    ${alsoBlock('Эту статью также можно прочитать на сайтах:')}
    <div class="prose article__body">${md(a.body)}</div>
    ${sourcesBlock('Источники')}
  </div>
  ${en ? `<div class="article__lang" data-lang="en" lang="en">
    <p class="translation-note">Translated from Russian. If the two versions differ, the Russian original is correct.</p>
    <header class="article__head">
      <span class="tag">${esc(CAT_EN[a.category] || 'Other')}</span>
      <h1 class="article__title">${esc(en.title || a.title || '')}</h1>
      <span class="pub__date">Published: ${esc(fmtDateEn(a._date))}</span>
    </header>
    ${alsoBlock('This article is also available on:')}
    <div class="prose article__body">${md(en.body)}</div>
    ${sourcesBlock('Sources')}
  </div>` : ''}
  <a class="more" href="${link('articles/')}">← Все статьи</a>
</article>`;
    writePage(`articles/${a._slug}`, layout({ title: a.title, description: excerpt(a.body, 160), active: 'articles', body, path: `articles/${a._slug}/` }));
  });
}

// ───────────────────────── Хронология ─────────────────────────

const ENTRY_TYPES = ['Задумка', 'План', 'Событие', 'Идея'];
const SUMMARY_TYPES = ['Итог квартала', 'Итог года'];

function entryCard(e) {
  return `<article class="card${e.is_start ? '' : ' card--plain'}">
          <div class="card__meta"><span class="tag${e.is_start ? '' : ' tag--muted'}">${esc(e.type || 'Запись')}</span><span>Записано: ${esc(fmtDate(e._date))}</span></div>
          <h3 class="card__title"><a href="${link(`chronicle/${e._slug}/`)}">${esc(e.title || 'Без названия')}</a></h3>
          ${e.body ? `<p class="card__text">${esc(excerpt(e.body))}</p>` : ''}
          <a class="more" href="${link(`chronicle/${e._slug}/`)}">Читать запись →</a>
        </article>`;
}

function summaryCard(e) {
  return `<a class="summary-link" href="${link(`chronicle/${e._slug}/`)}">
          <span class="stack-xs"><span class="summary-link__title">${esc(e.title || e.period || 'Итог')}</span><span class="muted">${esc(e.period ? `${e.period} · записано ${fmtDate(e._date)}` : `Записано: ${fmtDate(e._date)}`)}</span></span>
          <span class="more">Читать →</span>
        </a>`;
}

function pageChronicle() {
  const intro = (site.intros || {}).chronicle;
  const regular = chronicle.filter((e) => !SUMMARY_TYPES.includes(e.type));
  const quarters = chronicle.filter((e) => e.type === 'Итог квартала');
  const years = chronicle.filter((e) => e.type === 'Итог года');
  const start = chronicle.find((e) => e.is_start);
  const nowQ = quarterOf(TODAY);

  const tabs = [['all', 'Общая хронология'], ['quarter', 'Итоги квартала'], ['year', 'Итоги года'], ['start', 'Начальная точка']];
  const body = `${hero({ kicker: 'Раздел III', title: 'Хронология', lede: intro })}
<div class="wrap page-body" data-tabs data-default="all">
  <nav class="filters" aria-label="Разделы хронологии">
    ${tabs.map(([id, label]) => `<a class="chip" href="#${id}" data-tab="${id}">${label}</a>`).join('\n    ')}
  </nav>

  <section id="all" class="stack" data-panel="all">
    <h2 class="h2 panel-heading">Общая хронология</h2>
    <div class="list-head">
      <span class="types"><span class="muted">Типы записей:</span> ${ENTRY_TYPES.map((t) => `<span class="tag tag--muted">${t}</span>`).join(' ')}</span>
      <span class="label">Сначала новые</span>
    </div>
    ${regular.length ? regular.map(entryCard).join('\n        ') : '<p class="empty">Записей пока нет.</p>'}
  </section>

  <section id="quarter" class="stack" data-panel="quarter">
    <h2 class="h2 panel-heading">Итоги квартала</h2>
    <p class="muted">В конце каждого квартала — итог: что изменилось за три месяца в учёбе, спорте, статьях и достижениях. Новые итоги появляются сверху.</p>
    ${quarters.map(summaryCard).join('\n        ')}
    ${quarters.length ? '' : `<p class="empty">Первый итог появится в конце ${qEndMonthGen(nowQ)} ${nowQ.y}.</p>`}
  </section>

  <section id="year" class="stack" data-panel="year">
    <h2 class="h2 panel-heading">Итоги года</h2>
    <p class="muted">В конце каждого года — большой итог: главное за год и сравнение с начальной точкой.</p>
    ${years.map(summaryCard).join('\n        ')}
    ${years.length ? '' : `<p class="empty">${esc(site.year_summary_note || 'Первый годовой итог появится в конце года.')}</p>`}
  </section>

  <section id="start" class="stack" data-panel="start">
    <h2 class="h2 panel-heading">Начальная точка</h2>
    ${start ? `<article class="start-entry">
      <span class="label label--accent">${esc(start.type || 'Событие')} · записано: ${esc(fmtDate(start._date))}</span>
      <h3 class="start-entry__title">${esc(start.title || 'Начальная точка')}</h3>
      <div class="prose">${md(start.body)}</div>
      <a class="note-link" href="${link('about/')}#point-zero">Мои показатели на старте — в блоке «Точка ноль» на странице «Обо мне» →</a>
    </article>` : '<p class="empty">Начальная точка ещё не записана.</p>'}
  </section>
</div>`;
  writePage('chronicle', layout({ title: 'Хронология', description: intro, active: 'chronicle', body, path: 'chronicle/' }));

  chronicle.forEach((e) => {
    const body = `<article class="article">
  <nav class="crumbs" aria-label="Навигация"><a href="${link('chronicle/')}">Хронология</a> <span aria-hidden="true">›</span> ${esc(e.title || '')}</nav>
  <header class="article__head">
    <span class="tag">${esc(e.type || 'Запись')}</span>
    <h1 class="article__title">${esc(e.title || '')}</h1>
    <span class="pub__date">${e.period ? `${esc(e.period)} · ` : ''}Записано: ${esc(fmtDate(e._date))}</span>
  </header>
  <div class="prose article__body">${md(e.body)}</div>
  ${e.is_start ? `<a class="note-link" href="${link('about/')}#point-zero">Мои показатели на старте — в блоке «Точка ноль» на странице «Обо мне» →</a>` : ''}
  <a class="more" href="${link('chronicle/')}">← Вся хронология</a>
</article>`;
    writePage(`chronicle/${e._slug}`, layout({ title: e.title, description: excerpt(e.body, 160), active: 'chronicle', body, path: `chronicle/${e._slug}/` }));
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

function achievementCard(a) {
  const p = a.proof || {};
  const parts = [];
  if (p.url) parts.push(`<a href="${esc(safeHref(p.url))}"${extAttrs(p.url)}>${esc(p.label || hostOf(p.url))} →</a>`);
  if (p.file) parts.push(`<a href="${esc(media(p.file))}"${extAttrs(p.file)}>Открыть документ →</a>`);
  if (p.image) parts.push(`<a class="shot shot--wide" href="${esc(media(p.image))}"><img src="${esc(media(p.image))}" alt="Подтверждение: ${esc(a.title || '')}" loading="lazy"></a>`);
  return `<article class="card" id="a-${esc(a._slug)}">
          <div class="card__meta">Опубликовано: ${esc(fmtDate(a._date))}</div>
          <h3 class="card__title">${esc(a.title || 'Без названия')}</h3>
          ${a.description ? `<div class="prose prose--card">${md(a.description)}</div>` : ''}
          ${parts.length ? `<div class="proof">
            <span class="label">Подтверждение</span>
            ${parts.join('\n            ')}
          </div>` : ''}
        </article>`;
}

function pageAchievements() {
  const intro = (site.intros || {}).achievements;
  const groups = ACH_CATS.map(([id, label]) => ({ id, label, items: achievements.filter((a) => (a.category || 'Проекты') === label) }));
  const first = groups.find((g) => g.items.length) || groups[0];
  const body = `${hero({ kicker: 'Раздел IV', title: 'Достижения', lede: intro })}
<div class="wrap page-body">
  <div class="stack-lg" data-tabs data-default="${first.id}">
    <nav class="tiles" aria-label="Разделы достижений">
      ${groups.map((g) => `<a class="tile" href="#${g.id}" data-tab="${g.id}">
        <span class="tile__name">${esc(g.label)}</span>
        <span class="tile__count">${g.items.length ? `${g.items.length} ${plural(g.items.length, 'достижение', 'достижения', 'достижений')}` : 'Пока пусто'}</span>
      </a>`).join('\n      ')}
    </nav>
    ${groups.map((g) => `<section id="${g.id}" class="stack" data-panel="${g.id}">
      <div class="list-head"><h2 class="h2">${esc(g.label)}</h2><span class="label">Сначала новые</span></div>
      ${g.items.length ? g.items.map(achievementCard).join('\n      ') : '<p class="empty">Здесь пока пусто.</p>'}
    </section>`).join('\n    ')}
  </div>
  ${site.how_achievements ? `<section class="info-box info-box--soft">
    <h2>Как сюда попадают достижения</h2>
    <p>${esc(site.how_achievements)}</p>
  </section>` : ''}
</div>`;
  writePage('achievements', layout({ title: 'Достижения', description: intro, active: 'achievements', body, path: 'achievements/' }));
}

// ───────────────────────── 404, карта сайта, значок ─────────────────────────

function page404() {
  const body = `${hero({ kicker: 'Ошибка 404', title: 'Страница не найдена', lede: 'Возможно, ссылка устарела. Начните с главной страницы.' })}
<div class="btn-row"><a class="btn btn--solid" href="${link('')}">На главную</a></div>`;
  fs.writeFileSync(path.join(OUT, '404.html'), layout({ title: 'Страница не найдена', body }));
}

function writeMeta() {
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#ffffff" stroke="#1F3A5F" stroke-width="3"/><text x="32" y="40.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="23" fill="#1F3A5F">${esc(site.initials || '')}</text></svg>\n`;
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);
  const robots = [`User-agent: *`, `Disallow: ${link('admin/')}`];
  if (ORIGIN) {
    const urls = sitemap.map((p) => `  <url><loc>${esc(ORIGIN + link(p))}</loc></url>`).join('\n');
    fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    robots.push(`Sitemap: ${ORIGIN + link('sitemap.xml')}`);
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
pageHome();
pageAbout();
pageSport();
pageArticles();
pageChronicle();
pageAchievements();
page404();
writeMeta();

console.log(`✓ Сайт собран в ${path.relative(process.cwd(), OUT) || '_site'}: ${sitemap.length} страниц`);
console.log(`  статей: ${articles.length}, записей хронологии: ${chronicle.length}, достижений: ${achievements.length}, забегов: ${runs.length}`);
console.log(`  базовый путь: ${BASE}${SITE_URL ? `, адрес: ${SITE_URL}` : ''}`);
