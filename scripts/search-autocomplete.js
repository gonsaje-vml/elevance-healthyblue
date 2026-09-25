const phraseCache = new Map();
const warnedSources = new Set();
const DEFAULT_MINIMUM_LENGTH = 3;
const DEFAULT_LIMIT = 8;
let autocompleteInstance = 0;

export function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPreviewSearchHost(hostname = window.location.hostname) {
  return hostname.endsWith('.aem.page')
    || hostname.endsWith('.hlx.page')
    || ['localhost', '127.0.0.1'].includes(hostname);
}

export function getSearchPhraseSource(hostname = window.location.hostname) {
  return isPreviewSearchHost(hostname)
    ? '/search-key-phrases-preview.json'
    : '/search-key-phrases.json';
}

async function fetchSearchPhrases(source) {
  if (!phraseCache.has(source)) {
    const request = fetch(source)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Search phrase request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        const records = Array.isArray(payload) ? payload : payload?.data;
        if (!Array.isArray(records)) {
          throw new Error('Search phrase data did not contain an array.');
        }
        return records
          .map((record) => (typeof record === 'string' ? { phrase: record } : record))
          .filter((record) => record?.phrase)
          .map((record) => ({
            ...record,
            normalized: record.normalized || normalizeSearchText(record.phrase),
          }));
      });
    phraseCache.set(source, request);
  }
  return phraseCache.get(source);
}

function phraseScore(phrase, query, terms) {
  if (phrase.normalized === query) return 0;
  if (phrase.normalized.startsWith(query)) return 10;
  if (phrase.normalized.split(' ').some((word) => word.startsWith(query))) return 20;
  if (terms.every((term) => phrase.normalized.includes(term))) return 30;
  return null;
}

export function filterSearchPhrases(records, value, limit = DEFAULT_LIMIT) {
  const query = normalizeSearchText(value);
  const terms = query.split(' ').filter(Boolean);
  if (!terms.length) return [];

  return records
    .map((record) => {
      const normalized = record.normalized || normalizeSearchText(record.phrase);
      return {
        record: { ...record, normalized },
        score: phraseScore({ ...record, normalized }, query, terms),
      };
    })
    .filter(({ score }) => score !== null)
    .sort((left, right) => left.score - right.score
      || (right.record.sourceCount || 0) - (left.record.sourceCount || 0)
      || left.record.phrase.localeCompare(right.record.phrase))
    .slice(0, limit)
    .map(({ record }) => record);
}

function hasMinimumQuery(value, minimumLength) {
  return normalizeSearchText(value).replace(/\s/g, '').length >= minimumLength;
}

export function decorateSearchAutocomplete(input, options = {}) {
  const source = options.source || getSearchPhraseSource();
  const minimumLength = options.minimumLength || DEFAULT_MINIMUM_LENGTH;
  const limit = options.limit || DEFAULT_LIMIT;
  const container = input.closest('.search-autocomplete');
  if (!container) throw new Error('Autocomplete input must be inside .search-autocomplete.');

  autocompleteInstance += 1;
  const list = document.createElement('ul');
  list.id = `search-autocomplete-${autocompleteInstance}`;
  list.className = 'search-autocomplete-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Search suggestions');
  list.hidden = true;
  container.append(list);

  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let activeIndex = -1;
  let suggestions = [];
  let requestSequence = 0;

  const close = () => {
    activeIndex = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const setActive = (index) => {
    if (!suggestions.length) return;
    activeIndex = (index + suggestions.length) % suggestions.length;
    [...list.children].forEach((option, optionIndex) => {
      const selected = optionIndex === activeIndex;
      option.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const select = (index) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    input.value = suggestion.phrase;
    close();
    input.focus();
    input.dispatchEvent(new CustomEvent('search-autocomplete-select', {
      bubbles: true,
      detail: suggestion,
    }));
  };

  const render = (matches) => {
    list.innerHTML = '';
    suggestions = matches;
    activeIndex = -1;
    if (!matches.length) {
      close();
      return;
    }

    matches.forEach((match, index) => {
      const option = document.createElement('li');
      option.id = `${list.id}-option-${index}`;
      option.className = 'search-autocomplete-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = match.phrase;
      option.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        select(index);
      });
      option.addEventListener('mouseenter', () => setActive(index));
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const update = async () => {
    requestSequence += 1;
    const sequence = requestSequence;
    const { value } = input;
    if (!hasMinimumQuery(value, minimumLength)) {
      close();
      return;
    }

    try {
      const phrases = await fetchSearchPhrases(source);
      if (sequence !== requestSequence
        || input.value !== value
        || document.activeElement !== input) return;
      render(filterSearchPhrases(phrases, value, limit));
    } catch (error) {
      close();
      // Autocomplete is optional; normal search remains available if this file fails.
      if (!warnedSources.has(source)) {
        warnedSources.add(source);
        // eslint-disable-next-line no-console
        console.warn('Unable to load search suggestions.', error);
      }
    }
  };

  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowDown' && !list.hidden) {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.code === 'ArrowUp' && !list.hidden) {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.code === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      select(activeIndex);
    } else if (event.code === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      input.dataset.autocompleteEscape = 'true';
      close();
    } else if (event.code === 'Tab') {
      close();
    }
  });

  return { close, update };
}
