# Header authoring

The shared DA document named `nav` supplies the header content. It contains
three content sections in this order:

1. Brand: linked logo followed by the audience/site label.
2. Navigation: one list; nested lists become dropdowns automatically.
3. Tools: utility content and links such as text sizing, login, members, and search.

The Search tool may be authored either as a link whose URL contains `search` or
as the standard Search icon. The header converts it into an inline search form.
An authored link supplies the results-page path; a bare icon defaults to
`/north-carolina-provider/search`. Submitting the form navigates to the results
page with the query in the `q` URL parameter. On localhost and the `sandbox`
preview branch, the bare-icon default uses `/tools/search-demo.html` so the
temporary page/PDF index can be tested before the DA search page is published.

The header loads the path in the page's `Nav` metadata first, then `/nav`, then
`/content/nav`. This permits standard DA authoring while retaining compatibility
with a locally cloned `content` directory.

Brand colors, typography, and spacing are maintained in `header.css`. Authors
manage the shared header content and navigation links in the `nav` document.
