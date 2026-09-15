/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: cards
 * Base block: cards
 * Source: https://provider.bluemedadvgrhs.com/grs-provider/ (section.information_links)
 * Generated: 2026-09-10
 *
 * The source cards have NO images — the icons are rendered via CSS classes
 * (.availity-icon, .checkmark-icon, etc.), so this maps to the "cards (no images)"
 * layout: 1 column, one row per card. Each card is a linked label.
 *  - Row 1: block name (handled by createBlock)
 *  - Each subsequent row: single cell containing the card's text/CTA.
 */
export default function parse(element, { document }) {
  // Each card is an anchor wrapping a label div.
  const cardLinks = Array.from(element.querySelectorAll(':scope > a[href], a[href]'));

  const cells = [];

  cardLinks.forEach((a) => {
    const label = (a.textContent || '').trim();
    if (!label) return;

    // Rebuild as a clean anchor so markdown renders a proper linked title.
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = label;

    // 1-column layout (no images): single cell per card row.
    cells.push([link]);
  });

  // Empty-block guard
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards', cells });
  element.replaceWith(block);
}
