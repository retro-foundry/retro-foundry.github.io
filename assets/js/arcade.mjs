import { games, featured } from './catalog.mjs';

const byId = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const gameDetails = game => `#game/${game.id}`;
const gameIndex = new Map(games.map(game => [game.id, game]));
const featuredGames = featured.map(id => gameIndex.get(id));
const genres = ['All Games', ...new Set(games.map(game => game.genre))];
const storageKey = 'retro-foundry:arcade:v1';
const search = byId('game-search');
const announcement = byId('announcement');
const details = byId('game-details');
const filters = byId('filters');
const grid = byId('game-grid');
const savedGrid = byId('saved-grid');
const recentGrid = byId('recent-grid');
const rightsHolderSections = new Set(['#problem', '#shift', '#consoles', '#craft', '#proof', '#partner', '#contact']);

let storageAvailable = true;
let library = readLibrary();
let activeGenre = genres[0];
let featureIndex = 0;
let view;

function validGameIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => gameIndex.has(id)))] : [];
}

function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return { favourites: validGameIds(saved?.favourites), recent: validGameIds(saved?.recent) };
  } catch (error) {
    storageAvailable = false;
    console.warn('Could not read the Retro Foundry library:', error);
    return { favourites: [], recent: [] };
  }
}

function writeLibrary() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(library));
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
    console.warn('Could not save the Retro Foundry library:', error);
  }
  byId('storage-error').hidden = storageAvailable;
}

function requirementBadge(game) {
  if (!game.requirement) return '';
  return `<span class="requirement">${icon(game.requirement.icon)}${game.requirement.label}</span>`;
}

function releaseLink(release, style, label = 'Downloads on GitHub') {
  return `<a class="button button-${style}" href="${release.url}">${icon('download')}${label}</a>`;
}

function primaryGameLink(game) {
  if (!game.url) return releaseLink(game.release, 'primary', 'Demo release on GitHub');
  return `<a class="button button-primary" href="${game.url}" data-launch="${game.id}">${icon('play')}Play in browser</a>`;
}

function bookmarkButton(game, labeled = false) {
  const pressed = library.favourites.includes(game.id);
  const style = labeled ? 'button button-secondary' : 'icon-button';
  return `<button type="button" class="${style} bookmark" data-bookmark="${game.id}"
    aria-pressed="${pressed}" aria-label="Save ${game.title} to My Library" title="${pressed ? 'Remove from' : 'Save to'} My Library">
    ${icon('bookmark')}${labeled ? `<span>${pressed ? 'Saved to Library' : 'Save to Library'}</span>` : ''}
  </button>`;
}

function enhancementList(game, limit) {
  const items = game.enhancements.slice(0, limit).map(label => `<li>${label}</li>`).join('');
  return `<ul class="enhancements" role="list" aria-label="Enhancements">${items}</ul>`;
}

function gameCard(game, heading = 'h3') {
  return `<article class="game-card">
    <a class="card-link" href="${gameDetails(game)}">
      <div class="card-media">
        <img src="${game.image}" alt="" width="640" height="360" decoding="async">
        ${requirementBadge(game)}
      </div>
      <div class="card-copy">
        <${heading} class="card-name">${game.title}</${heading}>
        ${game.edition ? `<p class="card-edition">${game.edition}</p>` : ''}
        <p>${game.platform} <span aria-hidden="true">·</span> ${game.genre}</p>
        ${enhancementList(game, 3)}
      </div>
    </a>
    ${bookmarkButton(game)}
  </article>`;
}

function renderFeatured(index) {
  featureIndex = (index + featuredGames.length) % featuredGames.length;
  const game = featuredGames[featureIndex];
  byId('featured-art').src = game.image;
  byId('featured-title').textContent = game.title;
  const caption = byId('featured-caption');
  caption.textContent = game.edition ?? '';
  caption.hidden = !game.edition;
  byId('featured-enhancements').innerHTML = enhancementList(game, 3);
  byId('featured-summary').textContent = game.summary;
  const secondary = game.url && game.release
    ? releaseLink(game.release, 'secondary')
    : `<a class="button button-secondary" href="${gameDetails(game)}">${icon('info')}Details</a>`;
  byId('featured-actions').innerHTML = `${primaryGameLink(game)}${secondary}`;
  byId('featured-requirement').innerHTML = requirementBadge(game);
  for (const button of byId('feature-picks').children) {
    button.setAttribute('aria-pressed', Number(button.dataset.feature) === featureIndex);
  }
}

function searchTerms(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
}

function renderCatalog() {
  const terms = searchTerms(search.value);
  const results = games.filter(game => {
    const words = searchTerms(`${game.title} ${game.edition ?? ''} ${game.platform} ${game.genre} ${game.requirement?.label ?? ''} ${game.enhancements.join(' ')}`);
    const searchable = words.join(' ');
    const compact = words.join('');
    return (activeGenre === genres[0] || game.genre === activeGenre)
      && terms.every(term => searchable.includes(term) || compact.includes(term));
  });

  byId('game-count').textContent = `${results.length} ${results.length === 1 ? 'game' : 'games'}`;
  const cardHeading = view.name === 'games' ? 'h2' : 'h3';
  grid.innerHTML = results.map(game => gameCard(game, cardHeading)).join('');
  byId('no-results').hidden = results.length > 0;
  for (const button of filters.children) {
    button.setAttribute('aria-pressed', String(button.dataset.genre === activeGenre));
  }
}

function renderLibrary() {
  savedGrid.innerHTML = library.favourites.map(id => gameCard(gameIndex.get(id))).join('');
  recentGrid.innerHTML = library.recent.map(id => gameCard(gameIndex.get(id))).join('');
  byId('no-saved').hidden = library.favourites.length > 0;
  byId('no-recent').hidden = library.recent.length > 0;
  byId('storage-error').hidden = storageAvailable;
}

function releaseSection(release) {
  if (!release) return '';
  return `<section class="detail-info" aria-labelledby="download-title">
    <h2 id="download-title">Download ${release.version}</h2>
    <p>Available for ${release.platforms}. The GitHub release includes the archives, release notes and checksums.</p>
    <div class="detail-links">${releaseLink(release, 'secondary')}</div>
  </section>`;
}

function videoPanel(game) {
  if (!game.video) return '';
  const { id, title } = game.video;
  return `<figure class="game-video" aria-labelledby="game-video-title">
    <figcaption id="game-video-title">${title}</figcaption>
    <div class="video-player">
      <button type="button" class="video-preview" aria-label="Watch ${title}">
        <img src="${game.image}" alt="">
        <span class="video-play">${icon('play')}</span>
      </button>
    </div>
    <a class="text-link video-external" href="https://www.youtube.com/watch?v=${id}">Watch on YouTube</a>
  </figure>`;
}

function renderDetails(game) {
  const links = game.links?.map(link => `<a class="text-link" href="${link.url}">${link.label}</a>`).join('') ?? '';
  details.innerHTML = `
    <a class="back-link" href="#games">${icon('chevron-left')}All games</a>
    <div class="hero detail-hero${game.video ? ' detail-with-video' : ''}">
      <img class="hero-art" src="${game.image}" alt="">
      <div class="hero-content">
        <p class="eyebrow"><span class="brand-stripes" aria-hidden="true"></span>${game.platform} · ${game.genre}</p>
        <h1 id="detail-title" tabindex="-1">${game.title}</h1>
        ${game.edition ? `<p class="hero-caption">${game.edition}</p>` : ''}
        ${enhancementList(game)}
        <p class="hero-summary">${game.summary}</p>
        <div class="actions">${primaryGameLink(game)}${bookmarkButton(game, true)}</div>
        <div class="hero-requirement">${requirementBadge(game)}</div>
      </div>
      ${videoPanel(game)}
    </div>
    ${game.url ? releaseSection(game.release) : ''}
    <section class="detail-info" aria-labelledby="game-info-title">
      <h2 id="game-info-title">${game.url ? 'How to Play' : 'Demo Requirements'}</h2>
      ${game.requirement ? `<p>${game.requirement.description}</p>` : ''}
      ${game.url ? '<p>Play opens the game in this tab. Use your browser’s Back button to return to the arcade.</p>' : ''}
      ${links ? `<div class="detail-links">${links}</div>` : ''}
    </section>`;

  if (game.video) {
    const preview = details.querySelector('.video-preview');
    preview.addEventListener('click', () => {
      const player = document.createElement('iframe');
      player.src = `https://www.youtube-nocookie.com/embed/${game.video.id}?autoplay=1&rel=0`;
      player.title = game.video.title;
      player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      preview.replaceWith(player);
      player.focus({ preventScroll: true });
    });
  }
}

function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('game/')) {
    const game = gameIndex.get(hash.slice(5));
    if (game) return { name: 'game', game, heading: 'detail-title' };
  }
  if (hash === 'saved') return { name: 'saved', heading: 'library-title' };
  if (hash === 'games') return { name: 'games', heading: 'all-games-title' };
  return { name: 'discover', heading: 'featured-title' };
}

function renderRoute(moveFocus = false) {
  if (rightsHolderSections.has(location.hash)) {
    location.replace(`rights-holders.html${location.search}${location.hash}`);
    return;
  }

  view = route();
  const { name, game, heading } = view;
  byId('featured').hidden = name !== 'discover';
  byId('catalog').hidden = name !== 'discover' && name !== 'games';
  byId('catalog').setAttribute('aria-labelledby', name === 'games' ? 'all-games-title' : 'catalog-title');
  byId('all-games-title').hidden = name !== 'games';
  byId('catalog-title').hidden = name === 'games';
  byId('library').hidden = name !== 'saved';
  details.hidden = name !== 'game';

  for (const link of document.querySelectorAll('.main-nav a')) {
    if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  if (name === 'game') renderDetails(game);
  else details.replaceChildren();
  if (name === 'saved') renderLibrary();
  if (name === 'games' || name === 'discover') renderCatalog();

  document.title = game ? `${game.title} | Retro Foundry Arcade` : 'Retro Foundry Arcade';
  if (moveFocus) {
    if (document.activeElement !== search) byId(heading).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function refreshBookmarks() {
  for (const button of document.querySelectorAll('[data-bookmark]')) {
    const pressed = library.favourites.includes(button.dataset.bookmark);
    button.setAttribute('aria-pressed', String(pressed));
    button.title = `${pressed ? 'Remove from' : 'Save to'} My Library`;
    const label = button.querySelector('span');
    if (label) label.textContent = pressed ? 'Saved to Library' : 'Save to Library';
  }
}

function changeBookmark(button) {
  const id = button.dataset.bookmark;
  const removing = library.favourites.includes(id);
  library.favourites = removing ? library.favourites.filter(saved => saved !== id) : [...library.favourites, id];
  writeLibrary();
  if (view.name === 'saved') {
    const list = button.closest('.game-grid');
    renderLibrary();
    const nextFocus = list.querySelector(`[data-bookmark="${id}"]`)
      || list.querySelector('[data-bookmark]') || byId('library-title');
    nextFocus.focus();
  } else {
    refreshBookmarks();
  }
  announcement.textContent = `${gameIndex.get(id).title} ${removing ? 'removed from' : 'saved to'} My Library.`;
}

function recordLaunch(event) {
  const link = event.target.closest('[data-launch]');
  if (!link) return;
  const id = link.dataset.launch;
  library.recent = [id, ...library.recent.filter(played => played !== id)];
  writeLibrary();
}

function applySearch() {
  if (search.value.trim() && view.name !== 'games') location.hash = 'games';
  else renderCatalog();
}

filters.innerHTML = genres.map(genre => `<button type="button" class="filter" data-genre="${genre}">${genre}</button>`).join('');
byId('feature-picks').innerHTML = featuredGames.map((game, index) => `
  <button type="button" class="feature-pick" data-feature="${index}" aria-label="Feature ${game.title}" title="${game.title}">
    <img src="${game.image}" alt="" width="72" height="44">
  </button>`).join('');

byId('feature-prev').addEventListener('click', () => renderFeatured(featureIndex - 1));
byId('feature-next').addEventListener('click', () => renderFeatured(featureIndex + 1));
byId('feature-picks').addEventListener('click', event => {
  const button = event.target.closest('[data-feature]');
  if (button) renderFeatured(Number(button.dataset.feature));
});

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-genre]');
  if (!button) return;
  activeGenre = button.dataset.genre;
  renderCatalog();
});

search.addEventListener('input', applySearch);
search.form.addEventListener('submit', event => {
  event.preventDefault();
  location.hash = 'games';
});
byId('reset-search').addEventListener('click', () => {
  search.value = '';
  activeGenre = genres[0];
  renderCatalog();
  search.focus();
});

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  byId('main').focus();
});
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented) return;
  event.preventDefault();
  search.focus();
});
document.addEventListener('click', event => {
  const bookmark = event.target.closest('[data-bookmark]');
  if (bookmark) changeBookmark(bookmark);
  recordLaunch(event);
});
document.addEventListener('auxclick', event => {
  if (event.button === 1) recordLaunch(event);
});

window.addEventListener('hashchange', () => renderRoute(true));
window.addEventListener('pageshow', event => {
  if (event.persisted && storageAvailable) {
    library = readLibrary();
    if (view.name === 'saved') renderLibrary();
    else refreshBookmarks();
  }
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  library = readLibrary();
  if (view.name === 'saved') renderLibrary();
  else refreshBookmarks();
});

if (navigator.platform.startsWith('Mac')) search.form.querySelector('kbd').textContent = '⌘ K';
renderFeatured(0);
renderRoute();
