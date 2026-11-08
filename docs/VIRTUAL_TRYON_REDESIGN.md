# Virtual fitting room — UI/UX redesign

**5 November 2026. Implemented in the existing application; no deployment.**

## Before and after

The original customer screen placed a small selected product beside two simple mode buttons and a plain upload form. The redesigned studio uses the existing warm ivory palette, restrained champagne accents, editorial serif headings, a larger selected-piece display and a three-step introduction headed “Your Jewellery, Your Look.” Experience cards lead to distinct portrait and live-camera workspaces. Borders, shadows, spacing, focus treatments and reduced-motion handling are consistent across the new surfaces.

Photo fitting now has a consent-aware drag-and-drop area, an accessible device-upload button, original preview, change/remove controls, a single clear generation action, animated pending status, actual returned-result comparison and the existing retry/download/share/delete actions. Unavailable generation is stated explicitly. The live camera has a framed viewport, visible status and floating open/close/switch controls. Permission, preparation, tracking and failure messages still come from the existing camera lifecycle.

The new horizontal jewellery rail uses actual public catalogue records intersected with the existing eligible-product response. It includes category filters, name/SKU search, selected styling and approved public price display. Product changes retain the chosen experience when supported. Missing imagery uses the existing deliberate photograph-unavailable state; no product imagery or AI result was fabricated.

The owner studio adds actual mode/provider status, eligible-piece count and retention cards; recorded usage totals; distinct experience/privacy and jewellery/placement sections; an overlay preview; and clearer empty states. Eligibility summaries refresh after successful saves. Customer portraits remain absent from the owner UI. No chart or usage figure is invented.

## Files

Created:

- `apps/web/src/components/try-on/jewellery-rail.tsx`
- This report and screenshots under `docs/verification/tryon-redesign/`.

Modified:

- `apps/web/src/components/try-on/studio.tsx`
- `apps/web/src/components/try-on/photo-try-on.tsx`
- `apps/web/src/components/try-on/live-camera.tsx`
- `apps/web/src/app/(storefront)/try-on/[slug]/page.tsx`
- `apps/web/src/app/(storefront)/try-on/[slug]/try-on.css`
- `apps/web/src/components/admin/try-on.tsx`
- `apps/web/src/app/admin/admin.css`
- README, implementation status and verification documentation.

No backend source, API contract, authentication, Prisma model, migration, dependency or provider configuration was changed for the redesign.

## Functional and accessibility checks

Existing consent, image validation, idempotency, job creation/polling, retry limits, signed result access, download/share and deletion handlers remain connected. MediaPipe/Three.js tracking code is unchanged. Camera frames remain on-device; route/mode changes unmount the existing camera and release its tracks. The existing enquiry/WhatsApp actions retain the chosen product name and SKU, and WhatsApp remains conditional on configured contact data.

Native labelled inputs/buttons remain keyboard-accessible. Experience cards expose pressed state and identify their controlled workspace. The product rail has a labelled scroll region, selected-current state and keyboard focus. Drag/drop has an equivalent native file chooser and still requires consent; status/error announcements remain live. Focus rings, responsive wrapping, reduced-motion rules and deliberate missing-image fallbacks are included.

Browser-verified with the isolated QA database:

- Missing provider disables consent/upload/generation and displays an explanatory state.
- Search returns a deliberate no-match state; clearing search and filtering the necklace category restores the correct real API record.
- Clicking the necklace card navigates to its own SKU and preserves live mode; the owner editor reports its NECKLACE overlay configuration.
- Owner eligibility save changes the actual eligible count from two to one; restoring eligibility and pausing both modes changes it to zero. Mode settings persist after reload.
- Owner configuration/calibration fields and asset selector load from their existing endpoints. Logout returns to login.
- No captured browser console errors in the tested customer and owner flows.

## Responsive verification

Photo workspace, live workspace and the owner editor were checked at every requested width. A shared global input-width rule initially expanded the hidden file input on desktop; its scoped sizing was corrected and all widths rechecked.

| Viewport width | Document width | Page overflow (all three surfaces) |
| --- | --- | --- |
| 1440 | 1425 | None |
| 1366 | 1351 | None |
| 1024 | 1009 | None |
| 768 | 753 | None |
| 390 | 375 | None |
| 360 | 345 | None |

The 15-pixel difference is the browser scrollbar. The product carousel scrolls within its own region intentionally. Desktop and mobile screenshots were captured and the customer/mobile camera and owner compositions were visually reviewed. Evidence: [customer desktop](verification/tryon-redesign/customer-desktop.png), [customer mobile](verification/tryon-redesign/customer-mobile.png), [camera mobile](verification/tryon-redesign/camera-mobile.png), [owner desktop](verification/tryon-redesign/owner-desktop.png), [owner mobile](verification/tryon-redesign/owner-mobile.png), [saved owner overview](verification/tryon-redesign/owner-overview.png).

## Automated verification

- `npm run typecheck`: passed.
- `npm test` with guarded isolated PostgreSQL: 77 API tests and 44 frontend tests passed; no skips in the enabled integration suite. Includes mocked provider/job/security and camera/placement regression coverage.
- `npm run build`: Prisma generation, backend TypeScript build and frontend Next.js webpack production build passed. Repeated after the responsive correction.
- Logs: ignored `.local/tryon-redesign-tests.log`.

## Remaining limits

Real Gemini generation, returned-image aesthetics, browser download/share and physical-camera tracking were not exercised end-to-end in this redesign session. Their underlying job/provider and camera paths retain existing automated coverage; that is not equivalent to real-provider/device acceptance. No real portrait or paid call was used. Drag/drop and change/remove are implemented with the existing file/size/consent restrictions, but a browser upload was not performed while provider configuration was absent.

The isolated catalogue contains explicitly labelled QA entries with unavailable photography. Review the final composition with genuine showroom references/cutouts before release. The jewellery rail currently reads public catalogue pages to enrich eligible records with images/categories/prices because the unchanged eligibility endpoint returns only identifiers/name/SKU/slug; large catalogues may benefit from a dedicated enriched endpoint in a later backend milestone. No camera snapshot or comparison slider was added; returned images use a side-by-side comparison where the original is still available, stacking on mobile.

The existing canonical-domain metadata warning and Milestone 6 account recovery remain outside this UI scope. Both try-on modes were disabled again in the isolated QA database after checking saves. Operational data and environment files were not modified. Next: genuine-asset visual acceptance, real-provider photo evaluation and physical-device camera/privacy testing before enabling customer use.
