import { createOptimizedPicture } from '../../scripts/aem.js';

const CARD_OPTIONS = [
  'one-col',
  'two-col',
  'three-col',
  'four-col',
  'five-col',
  'featured-resources',
];

function normalizeCardOptions(block) {
  const authoredClasses = [...block.classList];
  CARD_OPTIONS.forEach((option) => {
    if (authoredClasses.some((className) => className.includes(option))) {
      block.classList.add(option);
    }
  });
}

export default function decorate(block) {
  // Preserve each option when older DA models combine selections into one class.
  normalizeCardOptions(block);

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });

  // replace images with optimized versions
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));

  block.replaceChildren(ul);
}
