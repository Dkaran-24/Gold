# Typography review — 10 November 2026

Readability changes preserve backgrounds, brand accent colours, serif families, font sizes, line heights, spacing, imagery and the approved homepage hero. Body text remains regular weight. Existing keyboard focus indicators remain intact. No production data, API, authentication or business logic was changed; no fonts or packages were added.

## Modified source files

- `apps/web/src/app/globals.css`: shared text-colour and weight tokens, stronger serif headings, readable gold-toned labels and navigation hover states, placeholders, availability text, footer address contrast, and explicit preservation of the original hero typography.
- `apps/web/src/app/admin/admin.css`: shared secondary-text colour, medium sidebar navigation/buttons/badges, stronger metric numerals and readable status colours.
- `apps/web/src/app/(storefront)/homepage.css` and `about/about.module.css`: darker gold-toned text using the shared token.
- `apps/web/src/app/(storefront)/custom-jewellery/studio.css` and `try-on/[slug]/try-on.css`: stronger serif labels/headings and readable secondary text.
- `apps/web/src/components/admin/cms.tsx` and `collections.tsx`: legacy inline font and helper-text styles now reference shared tokens. No component behaviour or content changed.
- `apps/web/tests/viewport-responsiveness.mjs`: optional screenshot mode and an isolated studio catalogue fixture.
- `apps/web/tests/typography-screenshots.mjs`: repeatable production-browser captures and overflow/text-clipping checks.

## Verification

- `npm run typecheck`: passed (API and web).
- `npm run test -w @showroom/web`: 84 passed, 0 failed.
- `npm run build -w @showroom/web`: passed.
- Existing browser suite: 27 routes across nine widths (320–1440px), with no horizontal page overflow; storefront and admin mobile navigation checks passed.
- Typography capture suite: seven pages at 360, 390, 430, 768, 1024 and 1440px; 42 checks passed with no page overflow or clipped visible text. Intentionally screen-reader-only labels are excluded from clipping detection.
- Full-page mobile and desktop captures were visually reviewed for hierarchy and wrapping. See `responsive-checks.json` for the machine-readable results.

Measured solid colour contrast ratios: primary brown/ivory 14.55:1; secondary text/ivory 6.72:1; secondary text/soft background 6.16:1; fine text/ivory 5.86:1; dark gold text/ivory 6.26:1; footer address/burgundy 13.21:1. These exceed AA for normal text. This is not a claim of exhaustive WCAG certification: the explicitly preserved hero retains its original colours and weights, and image-backed/transient states require separate assessment.

## Screenshots

Each page has a `-390.jpg` mobile capture and a `-1440.jpg` desktop capture:

- `homepage`
- `products`
- `product-details`
- `appointment`
- `virtual-try-on`
- `product-try-on`
- `admin-dashboard`

Captures use the existing in-memory browser-test catalogue and owner session, with repository images. They are layout previews, not live showroom records. No camera access, uploads, form submission or live authentication was used.

To regenerate after a production build:

```sh
node apps/web/tests/viewport-responsiveness.mjs --screenshots
```
