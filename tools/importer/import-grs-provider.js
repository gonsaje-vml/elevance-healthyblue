/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import cardsParser from './parsers/cards.js';
import columnsParser from './parsers/columns.js';
import heroParser from './parsers/hero.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/bluemedadvgrhs-cleanup.js';
import sectionsTransformer from './transformers/bluemedadvgrhs-sections.js';

// PARSER REGISTRY
const parsers = {
  cards: cardsParser,
  columns: columnsParser,
  hero: heroParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'grs-provider',
  description: 'Blue Medicare Advantage provider portal landing page: welcome hero, quick-action cards, Availity access columns, and default-content sections for provider news, tools & resources, and a join-network CTA.',
  urls: [
    'https://provider.bluemedadvgrhs.com/grs-provider/',
  ],
  blocks: [
    {
      name: 'hero',
      instances: [
        'body > main > div.container.home_page > section.wide_image',
        '.wide_image',
      ],
    },
    {
      name: 'cards',
      instances: [
        '#main > div.content_container > section.information_links',
        '.information_links',
      ],
    },
    {
      name: 'columns',
      instances: [
        '#main > div.content_container > section.availity-section',
        '.availity-section',
      ],
    },
  ],
  sections: [
    {
      id: 'rc2',
      name: 'Welcome hero',
      selector: ['.wide_image', 'body > main > div.container.home_page > section.wide_image'],
      style: null,
      blocks: ['hero'],
      defaultContent: [],
    },
    {
      id: 'rc3',
      name: 'Quick-action links',
      selector: ['.information_links', '#main > div.content_container > section.information_links'],
      style: null,
      blocks: ['cards'],
      defaultContent: [],
    },
    {
      id: 'rc4',
      name: 'Availity access',
      selector: ['.availity-section', '#main > div.content_container > section.center.content_column_2.with_coloredHmePage.availity-section.no-top-space_bfr.no-top-space'],
      style: null,
      blocks: ['columns'],
      defaultContent: [],
    },
    {
      id: 'rc5',
      name: 'Provider News',
      selector: ['.gray-div', '#main > div.content_container > section.center.content_column_2.gray-div'],
      style: null,
      blocks: [],
      defaultContent: ['#main > div.content_container > section.center.content_column_2.gray-div'],
    },
    {
      id: 'rc6',
      name: 'Provider tools & resources',
      selector: ['.tools_resources', '#main > div.content_container > section.center.tools_resources'],
      style: null,
      blocks: [],
      defaultContent: ['#main > div.content_container > section.center.tools_resources'],
    },
    {
      id: 'rc7',
      name: 'Join network CTA',
      selector: ['.call_to_action', '#main > div.content_container > section.call_to_action'],
      style: null,
      blocks: [],
      defaultContent: ['#main > div.content_container > section.call_to_action'],
    },
  ],
};

// TRANSFORMER REGISTRY - cleanup first, then sections (only when 2+ sections)
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
  };

  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  const seen = new Set();

  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (seen.has(element)) return; // avoid double-matching across fallback selectors
        seen.add(element);
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

// EXPORT DEFAULT CONFIGURATION
export default {
  transform: (payload) => {
    const {
      document, url, html, params,
    } = payload;

    const main = document.body;

    // 1. beforeTransform (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block; skip elements already replaced by a prior parser
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path (map root URL to /index)
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
