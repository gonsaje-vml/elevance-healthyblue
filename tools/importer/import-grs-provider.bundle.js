/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-grs-provider.js
  var import_grs_provider_exports = {};
  __export(import_grs_provider_exports, {
    default: () => import_grs_provider_default
  });

  // tools/importer/parsers/cards.js
  function parse(element, { document: document2 }) {
    const cardLinks = Array.from(element.querySelectorAll(":scope > a[href], a[href]"));
    const cells = [];
    cardLinks.forEach((a) => {
      const label = (a.textContent || "").trim();
      if (!label) return;
      const link = document2.createElement("a");
      link.href = a.getAttribute("href");
      link.textContent = label;
      cells.push([link]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns.js
  function parse2(element, { document: document2 }) {
    let columnSections = Array.from(element.querySelectorAll(":scope .content_column"));
    if (columnSections.length === 0) {
      const wrapper = element.querySelector(".within_brdr") || element;
      columnSections = Array.from(wrapper.children).filter((c) => c.textContent.trim());
    }
    if (columnSections.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [];
    const row = columnSections.map((section) => {
      const cellContent = Array.from(section.children);
      return cellContent.length ? cellContent : [section];
    });
    cells.push(row);
    const block = WebImporter.Blocks.createBlock(document2, { name: "columns", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/hero.js
  function parse3(element, { document: document2 }) {
    const bgImage = element.querySelector(':scope > img, img[class*="bg"], img[class*="background"]');
    const heading = element.querySelector('h1, h2, .welcome, [class*="title"]');
    const paragraphs = Array.from(
      element.querySelectorAll(".welcome_copy > p, .welcome_content p")
    );
    const ctaSources = Array.from(element.querySelectorAll("a[href]"));
    const ctaAnchors = ctaSources.map((a) => {
      const link = document2.createElement("a");
      link.href = a.getAttribute("href");
      const label = (a.textContent || "").trim();
      if (label) link.textContent = label;
      return link;
    });
    if (!heading && paragraphs.length === 0 && ctaAnchors.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [];
    if (bgImage) cells.push([bgImage]);
    const contentCell = [];
    if (heading) contentCell.push(heading);
    contentCell.push(...paragraphs);
    contentCell.push(...ctaAnchors);
    cells.push([contentCell]);
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/bluemedadvgrhs-cleanup.js
  var H = { before: "beforeTransform", after: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === H.before) {
      WebImporter.DOMUtils.remove(element, [
        ".modal",
        ".modal_background"
      ]);
    }
    if (hookName === H.after) {
      WebImporter.DOMUtils.remove(element, [
        "a.skip",
        "header#header",
        "nav#navigation",
        "footer#footer",
        "iframe",
        "link",
        "noscript"
      ]);
    }
  }

  // tools/importer/transformers/bluemedadvgrhs-sections.js
  var SECTION_MARKER_ATTR = "data-excat-section-id";
  function querySection(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function transform2(hookName, element, payload) {
    const sections = payload.template && payload.template.sections || [];
    if (hookName === "beforeTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (i === 0 && !section.style) continue;
        const sectionEl = querySection(element, section.selector);
        if (!sectionEl) continue;
        const hr = document.createElement("hr");
        if (section.style) hr.setAttribute(SECTION_MARKER_ATTR, section.id);
        sectionEl.before(hr);
      }
    }
    if (hookName === "afterTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (!section.style) continue;
        const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
        const anchor = marker || querySection(element, section.selector);
        if (!anchor) continue;
        const metadataBlock = WebImporter.Blocks.createBlock(document, {
          name: "Section Metadata",
          cells: { style: section.style }
        });
        anchor.after(metadataBlock);
        if (marker) {
          marker.removeAttribute(SECTION_MARKER_ATTR);
          if (i === 0) marker.remove();
        }
      }
    }
  }

  // tools/importer/import-grs-provider.js
  var parsers = {
    cards: parse,
    columns: parse2,
    hero: parse3
  };
  var PAGE_TEMPLATE = {
    name: "grs-provider",
    description: "Blue Medicare Advantage provider portal landing page: welcome hero, quick-action cards, Availity access columns, and default-content sections for provider news, tools & resources, and a join-network CTA.",
    urls: [
      "https://provider.bluemedadvgrhs.com/grs-provider/"
    ],
    blocks: [
      {
        name: "hero",
        instances: [
          "body > main > div.container.home_page > section.wide_image",
          ".wide_image"
        ]
      },
      {
        name: "cards",
        instances: [
          "#main > div.content_container > section.information_links",
          ".information_links"
        ]
      },
      {
        name: "columns",
        instances: [
          "#main > div.content_container > section.availity-section",
          ".availity-section"
        ]
      }
    ],
    sections: [
      {
        id: "rc2",
        name: "Welcome hero",
        selector: [".wide_image", "body > main > div.container.home_page > section.wide_image"],
        style: null,
        blocks: ["hero"],
        defaultContent: []
      },
      {
        id: "rc3",
        name: "Quick-action links",
        selector: [".information_links", "#main > div.content_container > section.information_links"],
        style: null,
        blocks: ["cards"],
        defaultContent: []
      },
      {
        id: "rc4",
        name: "Availity access",
        selector: [".availity-section", "#main > div.content_container > section.center.content_column_2.with_coloredHmePage.availity-section.no-top-space_bfr.no-top-space"],
        style: null,
        blocks: ["columns"],
        defaultContent: []
      },
      {
        id: "rc5",
        name: "Provider News",
        selector: [".gray-div", "#main > div.content_container > section.center.content_column_2.gray-div"],
        style: null,
        blocks: [],
        defaultContent: ["#main > div.content_container > section.center.content_column_2.gray-div"]
      },
      {
        id: "rc6",
        name: "Provider tools & resources",
        selector: [".tools_resources", "#main > div.content_container > section.center.tools_resources"],
        style: null,
        blocks: [],
        defaultContent: ["#main > div.content_container > section.center.tools_resources"]
      },
      {
        id: "rc7",
        name: "Join network CTA",
        selector: [".call_to_action", "#main > div.content_container > section.call_to_action"],
        style: null,
        blocks: [],
        defaultContent: ["#main > div.content_container > section.call_to_action"]
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), {
      template: PAGE_TEMPLATE
    });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document2, template) {
    const pageBlocks = [];
    const seen = /* @__PURE__ */ new Set();
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((selector) => {
        const elements = document2.querySelectorAll(selector);
        elements.forEach((element) => {
          if (seen.has(element)) return;
          seen.add(element);
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_grs_provider_default = {
    transform: (payload) => {
      const {
        document: document2,
        url,
        html,
        params
      } = payload;
      const main = document2.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document2, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document: document2, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document2.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document2);
      WebImporter.rules.transformBackgroundImages(main, document2);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
      return [{
        element: main,
        path,
        report: {
          title: document2.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_grs_provider_exports);
})();
