# Homepage final polish

5 November 2026 — focused frontend polish; existing visual identity and hero retained.

## Delivered

- Reduced the large availability panel to a quiet one-line notice with retry/contact links. Customers see no endpoint names, database details, stack traces or raw server errors. Individual unavailable sections still remain explicit; failure is never represented as an empty success.
- Refined category image proportions, product-card borders/spacing, collection captions and lighter new-arrival cards. All content continues to come from public API responses; existing approved-price and wishlist logic is unchanged.
- Differentiated the default brand-story section with an open two-column editorial composition and the custom-jewellery section with a framed ivory/champagne panel and suggested enquiry details. Published owner CMS content remains authoritative.
- Kept the existing hero headline, layout, two CTAs, image placeholder, small secondary monogram, navigation and footer identity.
- Published the exact owner-confirmed address on the homepage and contact page:

  Shop No. 7, Vitthal Rakhumai Co-op. Housing Society Ltd., Katrak Road, near Shree Ram Mandir, Wadala (West), Mumbai, Maharashtra 400031.

- Added reusable display support for verified business hours and an HTTPS map link. Both remain null/unpublished, as requested. No map coordinates, hours or phone number were inferred. WhatsApp still uses only the existing configured public contact option.

## Files changed

- `apps/web/src/app/(storefront)/page.tsx`
- `apps/web/src/app/(storefront)/homepage.css`
- `apps/web/src/app/(storefront)/contact/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/tests/homepage-render.mjs`

Created:

- `apps/web/src/lib/showroom-details.ts` — owner-confirmed public editorial content; unconfirmed fields stay null.
- `apps/web/src/components/showroom-details.tsx` — shared address/hours/map display.
- `apps/web/tests/showroom.test.mts`
- This report and `docs/verification/homepage-polish/` screenshots.

No API, database credentials, migration, authentication, payment or security configuration was changed. No dependencies were added. Nothing was deployed. The content module is deliberately separate from operational configuration and is not a replacement for the future owner website-settings API.

## Verification

- TypeScript: both applications passed.
- Frontend unit/regression tests: **46 passed**. Added verified-content and unsafe-map-link checks.
- Production builds: backend and Next.js frontend passed.
- Isolated production rendering: **five check groups passed** — unavailable responses, empty catalogue/order, product-card price/enquiry links plus confirmed contact fields, eleven navigation/action destinations, and published CMS authority. Test-only fixtures run on separate loopback ports and never enter the application database.
- Checked destinations: products, featured/new-arrival filters, collections, about, custom jewellery, appointments, contact, wishlist, request status and a test product-detail page. The product enquiry anchor and conditional WhatsApp URL were verified. No WhatsApp message or real enquiry/appointment was submitted.
- Actual browser checks: mobile menu, contact-page address and appointment-form navigation passed. No browser console errors were captured in these flows.
- Responsive review at **1440, 1024, 768, 390 and 360px**: no horizontal page overflow or broken image elements in the observed state. Full desktop/mobile layouts were visually reviewed. Keyboard/native controls and focus styles remain intact.

## Screenshots

The actual backend remained unavailable during capture. Screenshots show the honest current state, not test products or fabricated imagery.

- [Desktop full page](verification/homepage-polish/desktop.jpg)
- [Mobile full page](verification/homepage-polish/mobile.jpg)
- [Desktop hero and quiet notice](verification/homepage-polish/desktop-hero.jpg)
- [Mobile hero](verification/homepage-polish/mobile-hero.jpg)

## Unresolved dependencies

1. Database restoration is being handled separately. Live catalogue loading and successful enquiry/appointment delivery must be checked after restoration; isolated tests are not a claim of operational delivery.
2. Approved campaign photography and genuine populated catalogue images remain pending. Their styling is ready; real-image acceptance follows content availability.
3. Official business hours and Google Maps URL are unconfirmed and remain unpublished. Update the editorial content module only after owner confirmation; it will then render in both locations.
4. A real WhatsApp destination is shown only when the existing public API supplies it. No substitute number was introduced.
