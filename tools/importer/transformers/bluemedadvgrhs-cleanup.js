/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: bluemedadvgrhs site-wide cleanup.
 * All selectors verified against migration-work/cleaned.html.
 */
const H = { before: 'beforeTransform', after: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === H.before) {
    // Overlays / modals that would interfere with block parsing.
    // Found in cleaned.html: <div class="modal"> ... </div> and <div class="modal_background">
    WebImporter.DOMUtils.remove(element, [
      '.modal',
      '.modal_background',
    ]);
  }

  if (hookName === H.after) {
    // Non-authorable site chrome. Selectors from cleaned.html:
    //   <a class="skip" ...> skip links
    //   <header id="header"> site header
    //   <nav id="navigation"> main + utility navigation
    //   <footer id="footer"> footer (deferred; removed from page import)
    //   <iframe id="destination_publishing_iframe_wellpoint_0"> Adobe ID sync iframe
    //   <link rel="stylesheet" ...> conditional-comment stylesheet link
    WebImporter.DOMUtils.remove(element, [
      'a.skip',
      'header#header',
      'nav#navigation',
      'footer#footer',
      'iframe',
      'link',
      'noscript',
    ]);
  }
}
