# Virtual Jewellery Try-On Studio — implementation report

Date: 8 November 2026

## Delivery status

The `/custom-jewellery` studio is implemented locally and connected to the actual catalogue. **It is not ready for a customer launch with jewellery fittings yet:** the read-only catalogue audit found one published product, zero enabled try-on assets and zero enabled assets with an overlay image. The configuration has AR and photo enabled, with one eligible category. The public studio endpoint correctly returns an empty selection.

No products, categories, collections or try-on settings were changed to bypass that limitation. No sample products were added. The first real product must receive an appropriate calibrated overlay through the existing admin workflow before visual accuracy, product switching and exported jewellery previews can be verified end to end.

## 1. Existing infrastructure discovered

- Browser renderer: `apps/web/src/lib/try-on/renderer.ts`, using MediaPipe Tasks Vision and Three.js sprites. Existing placement and smoothing functions live in `tracking.ts`; camera permission and track cleanup utilities live in `camera.ts`.
- Local models: `face_landmarker.task` (3,758,596 bytes) and `pose_landmarker_lite.task` (5,777,746 bytes). Both were present. No hand landmark model was found.
- Local runtime: four existing MediaPipe JS/WASM files under `public/try-on/wasm`. The existing preparation script supplies these assets during development and builds. No models or WASM files were removed or replaced.
- Existing product-specific studio and live camera component under `components/try-on`, served by `/try-on/[slug]`.
- Existing server photo service: consent-versioned requests, private input/output storage, guest ownership cookies, signed result access, retry/delete controls, retention handling and a background worker. Its Gemini provider accepts a portrait and catalogue reference. This service remains separate from the new local photo fitting and is not called by it.
- Product configuration already stores enabled status, jewellery kind, product-owned overlay image, scale, offsets and rotation. Existing admin controls manage these values.
- Existing Cloudinary integration manages catalogue images. Published catalogue selection excludes deleted/archived products and hidden categories. Existing owner authentication protects admin mutations.
- Existing wishlist stores product slugs in the browser. Existing product enquiry forms already carry the selected product reference.

The camera utilities and placement calculations have automated coverage. Their tests do not establish real-world fitting accuracy. No calibrated catalogue asset was available for a real visual comparison.

## 2. Implemented experience

- Replaced the Made for You page with the requested heading and description, ivory background, burgundy controls, gold accents and serif typography.
- Added a large left-hand mirror and a right-hand catalogue selector, stacked on narrow screens.
- Updated header and footer navigation to Virtual Try-On. Homepage promotional content and other storefront page bodies remain unchanged.
- Camera starts only after a click, requests video without audio, prefers the front camera, supports cancellation and stops on page hiding/unmount. Camera switching is shown after multiple video inputs are detected.
- Local JPG/PNG/WebP upload, photograph preview, change/removal, camera photograph capture, reset fitting, remove jewellery and supported full-screen controls.
- Product changes preserve the photograph or camera stream. Only the renderer is restarted; renderer initialization is serialized to avoid overlapping resources.
- Save preview composites the source image and jewellery overlay into a local PNG. Saving stays disabled until landmark placement succeeds. Export errors are shown explicitly.
- Paginated catalogue selection with actual thumbnail, name, category, published price policy, purity, SKU and availability.
- Reused wishlist, product detail links, product enquiry links and configured WhatsApp enquiry links. No order or payment workflow was added.
- Loading, empty, error and retry states; no static substitute when model loading or tracking fails.

## 3. Models and algorithms reused

The same `trackJewellery` renderer now accepts either a live video element or a local photo canvas. Video uses MediaPipe VIDEO mode and `detectForVideo`; photos use IMAGE mode and `detect`. Both reuse the exact existing calibration, placement, light measurement and overlay proportions.

Earrings use two face-edge anchors near landmarks 234 and 454, with chin validity checks. Necklaces combine chin landmark 152 with pose shoulders 11 and 12. Video retains adaptive detection intervals, pose throttling and exponential smoothing. Front-camera display mirrors both layers together. Photos are reduced to a maximum 1,600-pixel long edge before inference.

## 4. Supported categories and limitations

- **Necklaces:** implemented approximate 2D placement from face/chin and shoulders; requires a calibrated transparent image owned by that product.
- **Earrings:** implemented approximate paired 2D placement using face-edge anchors; requires a suitable single-earring overlay because the renderer duplicates the image at both anchors.
- **Rings and bracelets:** unavailable and labelled accordingly. They require hand/wrist landmarks, category-specific calibration/rendering and physical-device validation before activation.

Neither supported category has been visually validated with this catalogue in this session because no enabled overlay exists. Face-edge points are not exact earlobe landmarks. There is no hair/body occlusion, depth fitting, side-view accuracy, physical size guarantee or lighting relighting. Pose segmentation is disabled; there is no separate segmentation pipeline. Turned heads, occluded ears, existing jewellery and poor lighting may degrade results. Transparent PNG/WebP preparation remains an admin responsibility; file format alone does not guarantee transparency.

## 5. Files created and modified

Modified:

- `apps/web/src/app/(storefront)/custom-jewellery/page.tsx`
- `apps/web/src/components/site-header.tsx`
- `apps/web/src/components/site-footer.tsx`
- `apps/web/src/lib/try-on/renderer.ts`
- `apps/api/src/modules/tryon/routes.ts`

Created:

- `apps/web/src/app/(storefront)/custom-jewellery/studio.css`
- `apps/web/src/components/try-on/catalogue-studio.tsx`
- `apps/web/src/components/try-on/local-fitting.tsx`
- `apps/web/src/lib/try-on/photo.ts`
- `apps/web/tests/try-on-local-photo.test.mts`
- `apps/api/src/modules/tryon/studio.test.ts`
- This report and `docs/verification/virtual-studio/desktop-1440.jpg`, `mobile-360.jpg`.

Ignored `.local` files hold audit/preview helpers, a solid-colour upload test image, an invalid upload fixture and test/build logs. They are not catalogue assets or storefront sample content. Existing untracked workspace files were preserved.

## 6. APIs

Added `GET /api/try-on/studio-products?page=N` inside the existing try-on router. It respects the global AR switch, eligible category IDs, public catalogue visibility and enabled product-owned PNG/WebP overlays. It returns at most 24 public product/overlay pairs per page plus `hasMore`, without private asset metadata. Public price redaction reuses `publicDto`.

No new photo upload API was added. Existing configuration, provider, admin, catalogue image, wishlist and enquiry infrastructure remains in place. The new studio sends no portraits to the server photo API, Cloudinary or Gemini.

## 7. Privacy and security

- Camera permission follows an explicit user action; no microphone permission is requested.
- Streams stop on cancellation, leaving the page, page hiding and camera disconnection. Late permission resolutions release their tracks.
- Photos remain in browser memory and are released on replacement, removal or leaving the page. Temporary object URLs are revoked. No photo contents or landmarks are logged or saved to browser storage.
- Upload checks enforce MIME allowlisting, a 10 MB limit, real raster headers and dimensions before decoding. Images must be at least 256 pixels per side, at most 25 megapixels and at most 10,000 pixels per side. Decoded dimensions are checked again. SVG and other formats are rejected.
- Preview export occurs only when the customer clicks Save. The resulting download belongs to the customer and is not retained by the showroom.
- No secrets or Cloudinary credential changes. No database reset, migration, `db push`, catalogue mutation or admin redesign.

## 8. Verification

Automated:

- Frontend: **78 passed, 0 failed, 0 skipped**.
- API: **56 passed, 0 failed; 46 database integration tests skipped**. Initial API tests were blocked by local socket permissions; rerunning with local network access passed.
- TypeScript: API and frontend checks passed; the production build also runs frontend TypeScript validation.
- Existing try-on camera, placement, smoothing, recovery, signed-result, provider and worker tests are included in those passing suites.
- New tests cover file validation, spoofed image rejection, dimension/memory limits, public catalogue filtering, pagination, AR disablement, product overlay ownership and private price/metadata exclusion.
- Raster header parsing was also checked against actual generated PNG, JPEG and WebP buffers at 640 × 480.

Browser and read-only API:

- `/custom-jewellery`: HTTP 200; public studio endpoint: HTTP 200 with an empty real selection.
- Uploaded a non-personal solid-colour PNG and verified photo preview, removal and disabled Save without a selected fitting asset. Invalid text upload produced a format error.
- Camera remained off until Start; permission-pending state appeared and Stop cancelled it. The in-app browser did not complete camera permission, so actual device streaming, switching, capture and hardware cleanup were not browser-verified. Utility tests cover denial, missing/insecure API, video-only constraints and late-stream cleanup.
- Category selection and unavailable ring/bracelet options verified.
- Layout inspected at **1440, 1280, 768, 390 and 360px**. Document scroll widths were respectively 1425, 1265, 753, 375 and 345px, with no horizontal overflow. Desktop and compact-mobile screenshots retained.
- No browser warning/error logs observed during these checks.

Not verified end to end: real jewellery image loading/rendering, positioning accuracy, changing between real fitting products, completed camera access, capture/export with jewellery, selected-product wishlist/enquiry actions in the new studio, and hardware track cleanup after navigation. These remain pending rather than being counted as passes. No enquiry was submitted and no wishlist data was changed during verification.

Database integration tests were not enabled: their setup/teardown creates and deletes catalogue records. The production catalogue audit performed only reads and returned aggregate counts.

## 9. Production build

`npm run build` passed, including Prisma client generation, API compilation, Next.js webpack production compilation, TypeScript and page generation. Prisma client generation does not run database migrations or modify records. No production deployment was performed.

## 10. Required launch work

1. Prepare a transparent fitting image from an actual published necklace or earring product. Earrings need a single-earring asset; necklaces need an isolated necklace image with appropriate bounds.
2. Attach and calibrate it using the existing product try-on admin controls, within an eligible category. This was deliberately not performed because catalogue changes were prohibited.
3. Test that piece on consented portrait samples and actual desktop/mobile cameras: front/rear cameras, denial/unavailable states, movement, hair occlusion, photo replacement, product switching, PNG export, wishlist, enquiry and navigation cleanup.
4. Assess speed on lower-powered mobile devices. Models currently run on the browser's main thread; product changes reload the renderer/models while preserving the source session.
5. For accurate rings/bracelets or more realistic fit, add a hand-tracking/occlusion solution and validate it before exposing those categories.

The studio has a real local inference path, but **catalogue readiness and real-world fit validation remain release blockers**.
