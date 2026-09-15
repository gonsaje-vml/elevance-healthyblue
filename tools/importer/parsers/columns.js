/* eslint-disable */
/* global WebImporter */
/**
 * Parser for variant: columns
 * Base block: columns
 * Source: https://provider.bluemedadvgrhs.com/grs-provider/ (section.availity-section)
 * Generated: 2026-09-10
 *
 * Library structure (columns): first row = block name, subsequent rows have one
 * cell per column. Source groups content into two <section class="content_column">
 * siblings → one content row with two columns.
 *  - Column 1: Availity access copy, checklist, and "Log in" CTA.
 *  - Column 2: "Don't have an account?" register box.
 */
export default function parse(element, { document }) {
  // Each visual column is a <section class="content_column">.
  let columnSections = Array.from(element.querySelectorAll(':scope .content_column'));

  // Fallback: if the expected class isn't present, use the direct content wrapper's children.
  if (columnSections.length === 0) {
    const wrapper = element.querySelector('.within_brdr') || element;
    columnSections = Array.from(wrapper.children).filter((c) => c.textContent.trim());
  }

  // Empty-block guard
  if (columnSections.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];

  // One row with one cell per column. Each cell holds that column's content nodes.
  const row = columnSections.map((section) => {
    const cellContent = Array.from(section.children);
    return cellContent.length ? cellContent : [section];
  });

  cells.push(row);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns', cells });
  element.replaceWith(block);
}
