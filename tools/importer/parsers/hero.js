/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: hero
 * Base block: hero
 * Source: https://provider.bluemedadvgrhs.com/grs-provider/ (section.wide_image)
 * Generated: 2026-09-10
 *
 * Library structure (hero): 1 column, 3 rows.
 *  - Row 1: block name (handled by createBlock)
 *  - Row 2: Background Image (optional)
 *  - Row 3: Title (Heading) + Subheading text + Call-to-Action (optional)
 */
export default function parse(element, { document }) {
  // Background image (direct child <img> of the section)
  const bgImage = element.querySelector(':scope > img, img[class*="bg"], img[class*="background"]');

  // Content
  const heading = element.querySelector('h1, h2, .welcome, [class*="title"]');
  const paragraphs = Array.from(
    element.querySelectorAll('.welcome_copy > p, .welcome_content p'),
  );

  // Call-to-action links: source wraps a <button> inside <a class="button">.
  // Rebuild as clean anchors so markdown renders a proper link, not a nested button.
  const ctaSources = Array.from(element.querySelectorAll('a[href]'));
  const ctaAnchors = ctaSources.map((a) => {
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    const label = (a.textContent || '').trim();
    if (label) link.textContent = label;
    return link;
  });

  // Empty-block guard
  if (!heading && paragraphs.length === 0 && ctaAnchors.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];

  // Row 2: background image (optional)
  if (bgImage) cells.push([bgImage]);

  // Row 3: single cell holding heading, paragraphs, and CTAs
  const contentCell = [];
  if (heading) contentCell.push(heading);
  contentCell.push(...paragraphs);
  contentCell.push(...ctaAnchors);
  cells.push([contentCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero', cells });
  element.replaceWith(block);
}
