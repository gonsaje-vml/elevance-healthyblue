/**
 * Moves authored Hero metadata onto the image and removes metadata-only rows.
 *
 * @param {Element} block The Hero block element.
 */
export default function decorate(block) {
  const rows = [...block.children];
  const rowFor = (fieldName) => rows.find((row) => (
    row.firstElementChild?.textContent.trim().toLowerCase() === fieldName
  ));

  const imageRow = rowFor('image');
  const altRow = rowFor('alt');
  const image = imageRow?.querySelector('img');

  if (image && altRow) {
    image.alt = altRow.lastElementChild?.textContent.trim() || '';
  }

  imageRow?.firstElementChild?.remove();
  altRow?.remove();
}
