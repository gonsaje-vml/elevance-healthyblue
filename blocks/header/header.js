import {
  decorateIcons,
  fetchPlaceholders,
  getMetadata,
} from '../../scripts/aem.js';
import {
  decorateSearchAutocomplete,
  getSearchPhraseSource,
} from '../../scripts/search-autocomplete.js';
import { loadFragment } from '../fragment/fragment.js';

async function loadFirstFragment([path, ...remainingPaths]) {
  if (!path) return null;
  const fragment = await loadFragment(path);
  return fragment || loadFirstFragment(remainingPaths);
}

/**
 * Loads the nav fragment. An authored metadata path wins, followed by the
 * standard root nav path and the local imported-content path.
 * @returns {Element} the loaded nav fragment
 */
async function loadNavFragment() {
  const configuredPath = getMetadata('nav').trim();
  const configuredNavPath = configuredPath
    ? new URL(configuredPath, window.location).pathname
    : '';
  const paths = [...new Set([configuredNavPath, '/nav', '/content/nav'].filter(Boolean))];
  return await loadFirstFragment(paths) || document.createElement('main');
}

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');
const NAV_CLOSE_DELAY = 300;
const IS_SEARCH_DEMO_HOST = window.location.hostname === 'localhost'
  || window.location.hostname.startsWith('sandbox--');
const DEFAULT_SEARCH_PATH = IS_SEARCH_DEMO_HOST
  ? '/tools/search-demo.html'
  : '/north-carolina-provider/search';

function decorateNavSearch(navTools) {
  const authoredSearch = navTools.querySelector('a[href*="search"]');
  const authoredIcon = authoredSearch?.querySelector('.icon-search')
    || navTools.querySelector('.icon-search');
  if (!authoredSearch && !authoredIcon) return;

  const action = authoredSearch
    ? new URL(authoredSearch.href, window.location).pathname
    : DEFAULT_SEARCH_PATH;
  const source = authoredSearch || authoredIcon;
  const sourceContainer = source.closest('p') || source;

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = action;
  form.method = 'get';
  form.setAttribute('role', 'search');

  const toggle = document.createElement('button');
  toggle.className = 'nav-search-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open search');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'nav-search-panel');
  const icon = document.createElement('span');
  icon.className = 'icon icon-search';
  toggle.append(icon);

  const panel = document.createElement('div');
  panel.id = 'nav-search-panel';
  panel.className = 'nav-search-panel';
  panel.hidden = true;

  const label = document.createElement('label');
  label.className = 'nav-search-label';
  label.htmlFor = 'nav-search-input';
  label.textContent = 'Search provider documents';

  const input = document.createElement('input');
  input.id = 'nav-search-input';
  input.className = 'nav-search-input';
  input.type = 'search';
  input.name = 'q';
  input.placeholder = 'What are you searching for?';
  input.minLength = 3;
  input.required = true;
  input.value = new URLSearchParams(window.location.search).get('q') || '';

  const autocomplete = document.createElement('div');
  autocomplete.className = 'search-autocomplete';
  autocomplete.append(input);
  decorateSearchAutocomplete(input, { source: getSearchPhraseSource() });

  const submit = document.createElement('button');
  submit.className = 'nav-search-submit';
  submit.type = 'submit';
  submit.textContent = 'Search';
  panel.append(label, autocomplete, submit);
  form.append(toggle, panel);

  const closeSearch = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open search');
  };

  const openSearch = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close search');
    input.focus();
  };

  toggle.addEventListener('click', () => {
    if (panel.hidden) openSearch();
    else closeSearch();
  });

  form.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      closeSearch();
      toggle.focus();
    }
  });

  form.addEventListener('focusout', (e) => {
    if (!form.contains(e.relatedTarget)) closeSearch();
  });

  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('search-autocomplete-select', () => {
    input.setCustomValidity('');
    form.requestSubmit();
  });
  form.addEventListener('submit', (e) => {
    const query = input.value.trim();
    if (query.length < 3) {
      e.preventDefault();
      input.setCustomValidity('Enter at least three characters.');
      input.reportValidity();
    }
  });

  sourceContainer.replaceWith(form);
  decorateIcons(form);
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.classList.contains('nav-drop');
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection(e) {
  const navSections = e.currentTarget.closest('.nav-sections');
  // eslint-disable-next-line no-use-before-define
  toggleAllNavSections(navSections);
  e.currentTarget.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  if (!navSections) return;
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

function getDirectTextContent(menuItem) {
  const menuLink = menuItem.querySelector(':scope > a');
  if (menuLink) {
    return menuLink.textContent.trim();
  }
  return Array.from(menuItem.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join(' ');
}

function normalizeBrandLayout(navBrand) {
  const logoParagraph = navBrand.querySelector('picture')?.closest('p');
  const lineBreak = logoParagraph?.querySelector('br');
  if (!lineBreak) return;

  const audienceLabel = document.createElement('p');
  let sibling = lineBreak.nextSibling;
  while (sibling) {
    const { nextSibling } = sibling;
    audienceLabel.append(sibling);
    sibling = nextSibling;
  }
  lineBreak.remove();

  if (audienceLabel.textContent.trim()) logoParagraph.after(audienceLabel);
}

async function buildBreadcrumbsFromNavTree(nav, currentUrl) {
  const crumbs = [];

  const homeUrl = document.querySelector('.nav-brand a[href]')?.href
    || new URL('/', window.location).href;

  let menuItem = Array.from(nav.querySelectorAll('a')).find((a) => a.href === currentUrl);
  if (menuItem) {
    do {
      const link = menuItem.querySelector(':scope > a');
      crumbs.unshift({ title: getDirectTextContent(menuItem), url: link ? link.href : null });
      menuItem = menuItem.closest('ul')?.closest('li');
    } while (menuItem);
  } else if (currentUrl !== homeUrl) {
    crumbs.unshift({ title: getMetadata('og:title'), url: currentUrl });
  }

  const placeholders = await fetchPlaceholders();
  const homePlaceholder = placeholders.breadcrumbsHomeLabel || 'Home';

  crumbs.unshift({ title: homePlaceholder, url: homeUrl });

  // last link is current page and should not be linked
  if (crumbs.length > 1) {
    crumbs[crumbs.length - 1].url = null;
  }
  crumbs[crumbs.length - 1]['aria-current'] = 'page';
  return crumbs;
}

async function buildBreadcrumbs() {
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'breadcrumbs';

  const crumbs = await buildBreadcrumbsFromNavTree(document.querySelector('.nav-sections'), document.location.href);

  const ol = document.createElement('ol');
  ol.append(...crumbs.map((item) => {
    const li = document.createElement('li');
    if (item['aria-current']) li.setAttribute('aria-current', item['aria-current']);
    if (item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.title;
      li.append(a);
    } else {
      li.textContent = item.title;
    }
    return li;
  }));

  breadcrumbs.append(ol);
  return breadcrumbs;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await loadNavFragment();

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const navSections = nav.querySelector('.nav-sections');
  const navTools = nav.querySelector('.nav-tools');
  if (!navBrand || !navSections) {
    // eslint-disable-next-line no-console
    console.error('The nav document must contain brand and navigation sections.');
    return;
  }

  normalizeBrandLayout(navBrand);

  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    const buttonContainer = brandLink.closest('.button-container');
    if (buttonContainer) buttonContainer.className = '';
  }

  let closeNavTimer;
  const cancelScheduledClose = () => window.clearTimeout(closeNavTimer);
  const openNavSection = (navSection) => {
    cancelScheduledClose();
    toggleAllNavSections(navSections);
    navSection.setAttribute('aria-expanded', 'true');
  };
  const scheduleNavClose = (navSection) => {
    cancelScheduledClose();
    closeNavTimer = window.setTimeout(() => {
      if (!navSection.matches(':hover') && !navSection.contains(document.activeElement)) {
        toggleAllNavSections(navSections);
      }
    }, NAV_CLOSE_DELAY);
  };

  navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
    if (navSection.querySelector(':scope > ul')) {
      navSection.classList.add('nav-drop');
      navSection.querySelectorAll('li').forEach((nestedItem) => {
        if (nestedItem.querySelector(':scope > ul')) nestedItem.classList.add('nav-subdrop');
      });
      navSection.addEventListener('mouseenter', () => {
        if (isDesktop.matches) {
          openNavSection(navSection);
        }
      });
      navSection.addEventListener('mouseleave', () => {
        if (isDesktop.matches) {
          scheduleNavClose(navSection);
        }
      });
    }
  });

  if (navTools) {
    decorateNavSearch(navTools);
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav-menu" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));

  const topLayer = document.createElement('div');
  topLayer.className = 'nav-top';
  const topLayerInner = document.createElement('div');
  topLayerInner.className = 'nav-layer-inner';
  topLayerInner.append(navBrand, hamburger);
  topLayer.append(topLayerInner);

  const secondLayer = document.createElement('div');
  secondLayer.className = 'nav-second';
  secondLayer.id = 'nav-menu';
  const secondLayerInner = document.createElement('div');
  secondLayerInner.className = 'nav-layer-inner';
  secondLayerInner.append(navSections);
  if (navTools) secondLayerInner.append(navTools);
  secondLayer.append(secondLayerInner);

  nav.append(topLayer, secondLayer);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    navWrapper.append(await buildBreadcrumbs());
  }
}
