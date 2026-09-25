import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterSearchPhrases,
  getSearchPhraseSource,
  normalizeSearchText,
} from '../scripts/search-autocomplete.js';

test('selects the phrase catalog for the current delivery environment', () => {
  assert.equal(
    getSearchPhraseSource('main--example--org.aem.page'),
    '/search-key-phrases-preview.json',
  );
  assert.equal(getSearchPhraseSource('localhost'), '/search-key-phrases-preview.json');
  assert.equal(
    getSearchPhraseSource('main--example--org.aem.live'),
    '/search-key-phrases.json',
  );
  assert.equal(getSearchPhraseSource('provider.example.com'), '/search-key-phrases.json');
});

test('normalizes and ranks autocomplete phrases', () => {
  const records = [
    { phrase: 'Healthy Blue Provider Services', sourceCount: 1 },
    { phrase: 'Provider Enrollment Data Guidance', sourceCount: 2 },
    { phrase: 'Provider Guide', sourceCount: 1 },
    { phrase: 'Other Provider Information', sourceCount: 4 },
    { phrase: 'Résumé Guidance', sourceCount: 1 },
  ];

  assert.equal(normalizeSearchText('  RÉSUMÉ   Guidance '), 'resume guidance');
  assert.deepEqual(
    filterSearchPhrases(records, 'provider', 3).map(({ phrase }) => phrase),
    [
      'Provider Enrollment Data Guidance',
      'Provider Guide',
      'Other Provider Information',
    ],
  );
  assert.deepEqual(
    filterSearchPhrases(records, 'provider data').map(({ phrase }) => phrase),
    ['Provider Enrollment Data Guidance'],
  );
  assert.deepEqual(
    filterSearchPhrases(records, 'resume').map(({ phrase }) => phrase),
    ['Résumé Guidance'],
  );
});
