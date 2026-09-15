import { getMetadata } from '../../scripts/aem.js';
/**
 * Loads and decorates the footer.
 *
 * Content-first: all footer copy and links live in content/footer.plain.html.
 * This module fetches that fragment (metadata-independent dual fetch) and
 * renders it — it never hardcodes footer copy.
 *
 * Dual fetch:
 *   1. /content/footer.plain.html  — localhost / aem up
 *   2. /footer.plain.html          — DA/EDS production (served at site root)
 * Deriving the path from the footer metadata value is a trap: a page whose
 * footer meta is /content/footer makes both attempts resolve to the same path
 * and 404 on DA/EDS preview + publish.
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  let resp = await fetch(`${getMetadata('footer')}.plain.html`);
  if (!resp.ok) resp = await fetch('/content/footer.plain.html' || '/footer.plain.html');
  block.textContent = '';
  const footer = document.createElement('div');
  if (resp.ok) footer.innerHTML = await resp.text();

  // Tag the two top-level sections so the CSS can lay them out:
  // first = contact/links row, second = legal block.
  const sections = [...footer.children];
  const classes = ['footer-links', 'footer-legal'];
  sections.forEach((section, i) => {
    if (classes[i]) section.classList.add(classes[i]);
  });

  block.append(footer);
}
