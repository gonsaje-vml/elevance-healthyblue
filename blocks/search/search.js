import {
  createOptimizedPicture,
  decorateIcons,
  fetchPlaceholders,
} from '../../scripts/aem.js';

const searchParams = new URLSearchParams(window.location.search);
const dataCache = new Map();
const MIN_QUERY_LENGTH = 3;
const SEARCH_DELAY = 200;
const isPreview = window.location.hostname.endsWith('.aem.page')
  || window.location.hostname.endsWith('.hlx.page')
  || ['localhost', '127.0.0.1'].includes(window.location.hostname);
const assetIndexSource = isPreview ? '/asset-index-preview.json' : '/asset-index.json';
const DEFAULT_SOURCES = ['/query-index.json', assetIndexSource];
let searchInstance = 0;

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findNextHeading(el) {
  let preceedingEl = el.parentElement.previousElement || el.parentElement.parentElement;
  let h = 'H2';
  while (preceedingEl) {
    const lastHeading = [...preceedingEl.querySelectorAll('h1, h2, h3, h4, h5, h6')].pop();
    if (lastHeading) {
      const level = parseInt(lastHeading.nodeName[1], 10);
      h = level < 6 ? `H${level + 1}` : 'H6';
      preceedingEl = false;
    } else {
      preceedingEl = preceedingEl.previousElement || preceedingEl.parentElement;
    }
  }
  return h;
}

function highlightTextElements(terms, elements) {
  elements.forEach((element) => {
    if (!element || !element.textContent) return;

    const matches = [];
    const { textContent } = element;
    terms.forEach((term) => {
      let start = 0;
      let offset = textContent.toLowerCase().indexOf(term.toLowerCase(), start);
      while (offset >= 0) {
        matches.push({ offset, term: textContent.substring(offset, offset + term.length) });
        start = offset + term.length;
        offset = textContent.toLowerCase().indexOf(term.toLowerCase(), start);
      }
    });

    if (!matches.length) return;

    matches.sort((a, b) => a.offset - b.offset);
    let currentIndex = 0;
    const fragment = matches.reduce((acc, { offset, term }) => {
      if (offset < currentIndex) return acc;
      const textBefore = textContent.substring(currentIndex, offset);
      if (textBefore) acc.appendChild(document.createTextNode(textBefore));
      const markedTerm = document.createElement('mark');
      markedTerm.textContent = term;
      acc.appendChild(markedTerm);
      currentIndex = offset + term.length;
      return acc;
    }, document.createDocumentFragment());
    const textAfter = textContent.substring(currentIndex);
    if (textAfter) fragment.appendChild(document.createTextNode(textAfter));
    element.innerHTML = '';
    element.appendChild(fragment);
  });
}

export async function fetchData(source) {
  if (!dataCache.has(source)) {
    const dataPromise = fetch(source)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Search index request failed with status ${response.status}.`);
        }

        const json = await response.json();
        const data = Array.isArray(json) ? json : json?.data;
        if (!Array.isArray(data)) {
          throw new Error('Search index did not contain a data array.');
        }
        return data;
      })
      .catch((error) => {
        dataCache.delete(source);
        throw error;
      });
    dataCache.set(source, dataPromise);
  }

  return dataCache.get(source);
}

async function fetchSearchData(sources) {
  const results = await Promise.allSettled(sources.map((source) => fetchData(source)));
  const available = results.filter(({ status }) => status === 'fulfilled');
  if (!available.length) {
    throw new Error('No search indexes could be loaded.');
  }

  const records = available.flatMap(({ value }) => value);
  const uniqueRecords = [...new Map(records
    .filter(({ path }) => path)
    .map((record) => [record.path, record])).values()];

  return {
    data: uniqueRecords,
    unavailableSources: results.length - available.length,
  };
}

function renderResult(result, searchTerms, titleTag) {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.href = result.path;

  if (result.image) {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-result-image';
    const pic = createOptimizedPicture(result.image, '', false, [{ width: '375' }]);
    wrapper.append(pic);
    link.append(wrapper);
  }

  if (result.type) {
    const type = document.createElement('span');
    type.className = 'search-result-type';
    type.textContent = result.type.toUpperCase();
    link.append(type);
  }

  if (result.title) {
    const title = document.createElement(titleTag);
    title.className = 'search-result-title';
    title.textContent = result.title;
    highlightTextElements(searchTerms, [title]);
    link.append(title);
  }

  if (result.description) {
    const description = document.createElement('p');
    description.textContent = result.description;
    highlightTextElements(searchTerms, [description]);
    link.append(description);
  }

  li.append(link);
  return li;
}

function clearSearchResults(block) {
  const searchResults = block.querySelector('.search-results');
  searchResults.innerHTML = '';
  searchResults.classList.remove('no-results');
}

function setSearchStatus(block, message) {
  const status = block.querySelector('.search-status');
  status.textContent = message;
}

function clearSearch(block) {
  clearSearchResults(block);
  setSearchStatus(block, '');
  if (window.history.replaceState) {
    const url = new URL(window.location.href);
    url.search = '';
    searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
  }
}

async function renderResults(
  block,
  config,
  filteredData,
  searchTerms,
  unavailableSources = 0,
) {
  clearSearchResults(block);
  const searchResults = block.querySelector('.search-results');
  const headingTag = searchResults.dataset.h;
  const availabilityMessage = unavailableSources
    ? ` ${unavailableSources} search source${unavailableSources === 1 ? ' is' : 's are'} unavailable.`
    : '';

  if (filteredData.length) {
    setSearchStatus(
      block,
      `${filteredData.length} result${filteredData.length === 1 ? '' : 's'} found.${availabilityMessage}`,
    );
    filteredData.forEach((result) => {
      const li = renderResult(result, searchTerms, headingTag);
      searchResults.append(li);
    });
  } else {
    const noResultsMessage = document.createElement('li');
    searchResults.classList.add('no-results');
    noResultsMessage.textContent = config.placeholders.searchNoResults || 'No results found.';
    searchResults.append(noResultsMessage);
    setSearchStatus(block, `${noResultsMessage.textContent}${availabilityMessage}`);
  }
}

function renderError(block, config) {
  clearSearchResults(block);
  const message = config.placeholders.searchError || 'Search is temporarily unavailable.';
  const error = document.createElement('li');
  error.textContent = message;
  const searchResults = block.querySelector('.search-results');
  searchResults.classList.add('no-results');
  searchResults.append(error);
  setSearchStatus(block, message);
}

function containsAll(value, searchTerms) {
  const normalizedValue = normalizeText(value);
  return searchTerms.every((term) => normalizedValue.includes(term));
}

function scoreResult(result, query, searchTerms) {
  const title = normalizeText(result.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 10;
  if (containsAll(title, searchTerms)) return 20;
  if (containsAll(result.header, searchTerms)) return 30;
  if (containsAll(result.description, searchTerms)) return 40;
  if (containsAll(result.content, searchTerms)) return 50;
  return 60;
}

function filterData(searchTerms, query, data) {
  return data
    .filter((result) => result?.path && !normalizeText(result.robots).includes('noindex'))
    .map((result) => {
      const title = result.title || result.header || result.path.split('/').pop();
      const type = result.type || (result.path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'page');
      return { ...result, title, type };
    })
    .filter((result) => {
      const searchableText = [
        result.title,
        result.header,
        result.description,
        result.content,
        result.topic,
        result.type,
        result.path,
      ].join(' ');
      return containsAll(searchableText, searchTerms);
    })
    .map((result) => ({
      result,
      score: scoreResult(result, query, searchTerms),
    }))
    .sort((a, b) => a.score - b.score || a.result.title.localeCompare(b.result.title))
    .map(({ result }) => result);
}

function updateQueryString(searchValue) {
  if (searchValue) searchParams.set('q', searchValue);
  else searchParams.delete('q');
  if (window.history.replaceState) {
    const url = new URL(window.location.href);
    url.search = searchParams.toString();
    window.history.replaceState({}, '', url.toString());
  }
}

async function handleSearch(e, block, config) {
  const input = e.target;
  const searchValue = input.value.trim();
  updateQueryString(searchValue);

  if (searchValue.length < MIN_QUERY_LENGTH) {
    clearSearchResults(block);
    setSearchStatus(
      block,
      searchValue ? `Enter at least ${MIN_QUERY_LENGTH} characters.` : '',
    );
    return;
  }

  const query = normalizeText(searchValue);
  const searchTerms = query.split(/\s+/).filter((term) => !!term);
  setSearchStatus(block, 'Searching...');

  try {
    const { data, unavailableSources } = await fetchSearchData(config.sources);
    if (input.value.trim() !== searchValue) return;
    const filteredData = filterData(searchTerms, query, data);
    await renderResults(block, config, filteredData, searchTerms, unavailableSources);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to load the search index.', error);
    renderError(block, config);
  }
}

function searchResultsContainer(block) {
  const results = document.createElement('ul');
  results.className = 'search-results';
  results.dataset.h = findNextHeading(block);
  return results;
}

function searchStatus() {
  const status = document.createElement('p');
  status.className = 'search-status';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  return status;
}

function searchInput(block, config) {
  const input = document.createElement('input');
  input.setAttribute('type', 'search');
  input.className = 'search-input';
  searchInstance += 1;
  input.id = `search-input-${searchInstance}`;

  const searchPlaceholder = config.placeholders.searchPlaceholder || 'Search...';
  input.placeholder = searchPlaceholder;

  let timer;
  input.addEventListener('input', (e) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => handleSearch(e, block, config), SEARCH_DELAY);
  });

  input.addEventListener('keyup', (e) => {
    if (e.code === 'Escape') {
      window.clearTimeout(timer);
      input.value = '';
      clearSearch(block);
    }
  });

  return input;
}

function searchIcon() {
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-search');
  return icon;
}

function searchBox(block, config) {
  const box = document.createElement('div');
  box.classList.add('search-box');
  const input = searchInput(block, config);
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.textContent = config.placeholders.searchLabel || 'Search';
  box.append(
    label,
    searchIcon(),
    input,
  );

  return box;
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholders();
  const authoredSources = [...block.querySelectorAll('a[href]')].map(({ href }) => href);
  // Keep authored sources for backward compatibility, then layer the project defaults
  // on top so the native page and generated asset indexes remain authoritative.
  const configuredSources = [...authoredSources, ...DEFAULT_SOURCES];
  const sources = [...new Set(configuredSources
    .map((source) => new URL(source, window.location).href))];
  block.innerHTML = '';
  block.append(
    searchBox(block, { sources, placeholders }),
    searchStatus(),
    searchResultsContainer(block),
  );

  if (searchParams.get('q')) {
    const input = block.querySelector('input');
    input.value = searchParams.get('q');
    input.dispatchEvent(new Event('input'));
  }

  decorateIcons(block);
}
