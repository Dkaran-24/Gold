# Virtual jewellery try-on implementation

The new owner decision authorizes implementation ahead of real-world evaluation. The previous [evaluation](VIRTUAL_TRYON_PROVIDER_EVALUATION.md) remains the fidelity review procedure. No visual rating from that experiment is available.

## Owner setup

Open **Virtual try-on** in the existing owner navigation. Select the catalogue categories and the individual pieces eligible for previews. Set the photo and camera switches independently. Product publication, visible category and archive/deletion rules still apply. An archived or withdrawn piece should disappear from customer choices.

For photo previews use a clear primary image of the exact piece. For live previews choose an approved transparent PNG/WebP from that product's gallery and choose Earrings or Necklace. Use a single earring cutout for the two earring sprites. Adjust relative size, offsets and rotation, then inspect it on a physical device. Owner analytics expose counts. The provider configuration indicator reports local settings and does not establish the project's entitlement, quota or generation quality.

## Customer experience

The eligible product detail is the starting point. Photo and camera use separate processing paths. The product enquiry action keeps the selected SKU in context. The displayed preview disclaimer covers colour, dimensions, fit and weight.

The camera renderer loads models locally, draws transparent Three.js sprites over the video and estimates ear anchors from face landmarks. Necklaces additionally use the shoulder landmarks from the lite pose model. Video and overlays share the same display transform for a mirrored front camera. Inference cadence adapts to processing time. Geometry represents a visual estimate. Hair, occlusion, side profiles, cropped shoulders, poor lighting, asymmetric pieces and device limitations require physical testing. A 3D GLB renderer and ring/bangle tracking are **NOT IMPLEMENTED**.

## Provider integration

The replaceable server interface accepts sanitized portrait bytes, a managed catalogue reference and the jewellery kind. The Gemini implementation allowlists documented image-output models, checks model metadata at runtime, restricts reference downloads to the configured Cloudinary catalogue path, bounds network reads and accepts only a decoded final image. The generation deadline is 90 seconds. The prompt revision `srj-photo-v1` identifies the portrait and product separately. It requests the same person, expression, skin texture, silhouette, stones, settings and metal colour while preserving the background and unrelated clothing. The result still requires human review. [Google image generation](https://ai.google.dev/gemini-api/docs/image-generation) · [Models API](https://ai.google.dev/api/models)

See the [architecture](VIRTUAL_TRYON_ARCHITECTURE.md), [endpoint contract](VIRTUAL_TRYON_API.md), [private media handling](VIRTUAL_TRYON_SECURITY.md), [local configuration](VIRTUAL_TRYON_ENVIRONMENT.md), [test procedures](VIRTUAL_TRYON_TESTING.md) and [delivery report](VIRTUAL_TRYON_MILESTONE_REPORT.md).
