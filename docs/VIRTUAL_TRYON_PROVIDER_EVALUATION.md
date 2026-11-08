# Gemini jewellery fidelity experiment

Historical evaluation plan: the subsequent implementation brief authorized development before real-image evaluation. The application is now implemented and mock-tested; this procedure remains outstanding real-provider acceptance. See [current delivery status](VIRTUAL_TRYON_MILESTONE_REPORT.md).

**Decision on 4 November 2026 — awaiting inputs.** Zero genuine SKUs, zero consented portraits and zero real generations were evaluated. Both candidates have an undetermined suitability rating. This is a readiness finding, not a failed model trial.

| Candidate | Published capability | Authenticated project access | Real cases | Fidelity, latency, provider errors and cost per result |
| --- | --- | --- | ---: | --- |
| `gemini-3.1-flash-image` | Image generation/editing | Unverified | 0 | Unmeasured |
| `gemini-3-pro-image` | Image generation/editing | Unverified | 0 | Unmeasured |

Google lists both model IDs. Start with Flash. Use Pro for matched cases only if Flash fidelity findings justify it and the additional spend is approved. The published standard Flash 1K output component is about USD 0.067 per image. Twenty such outputs would represent about USD 1.34 **for image output alone**. Inputs and any billed text/thinking add cost. Confirm rates and the project's billing/data terms before submitting samples. [Model catalogue](https://ai.google.dev/gemini-api/docs/models) · [Image generation guide](https://ai.google.dev/gemini-api/docs/image-generation) · [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Service terms](https://ai.google.dev/gemini-api/terms)

## Intake

Supply at least 10 different actual showroom SKUs across earrings and necklaces. A balanced starting set is five of each, including asymmetrical earrings, fine settings and detailed necklace pendants when available. Each SKU needs an owner-confirmed catalogue reference and a clear reference photograph. Supply at least two suitable portraits with differing lighting and orientation, visible ears and necklines, and documented consent for this particular evaluation with Google. Verify the references and consent with a human before dispatch.

Use an access-controlled local directory outside the repository for the real manifest, photographs, output files and scoring records. The following entries illustrate the manifest shape. The offline check requires the full set before accepting the manifest.

```json
{
  "products": [
    {"sku":"ACTUAL-SKU","kind":"earrings","image":"products/item.jpg","catalogueReference":"owner inventory reference","showroomApproved":true}
  ],
  "portraits": [
    {"alias":"P01","image":"portraits/P01.jpg","lighting":"diffuse daylight","orientation":"frontal","consentReference":"private consent record","consentToGoogleEvaluation":true}
  ]
}
```

Run from the repository root with an existing private manifest.

```powershell
node scripts/tryon-evaluation-preflight.mjs "D:\private-review\intake.json"
```

The tool validates declarations, distinct SKUs/aliases, category coverage, varied conditions and separately decoded files. It rejects duplicate normalized images and paths escaping the manifest folder. It prints a planned case per SKU/portrait combination without printing photo paths, consent records or image bytes. A valid manifest establishes mechanical readiness only. A human verifies that the images show the claimed SKUs and people, and that consent covers the intended provider.

## Run and review

1. Confirm the approved Gemini project, applicable paid-service data terms, current model availability, budget cap and deletion date. Configure the key privately in the operator's environment. Stop if any prerequisite is missing.
2. Orient, sanitize and re-encode the reference and portrait into private temporary files. Standardize size and aspect ratio across models. Use the same labelled order and prompt version for each case. A starting instruction is “Place the jewellery in the catalogue reference on the person in the portrait. Preserve the exact motif, silhouette, stone count and positions, setting, metal colour and asymmetry. Preserve the person's face, expression, lighting and background. Change only the jewellery and physically necessary occlusion.”
3. Generate one result per case. Retain all attempts, including refusals and unscorable images. Record model/version, dimensions, prompt revision, latency from dispatch to complete response, error class, usage units and applicable unit rates. Stop dispatch before exceeding the approved trial budget. Reconcile billed costs, including failed/duplicate attempts, and separate estimates from billed amounts.
4. Have a showroom reviewer compare close crops with the original catalogue photo and a second reviewer compare the full portrait with the original person. Review disputed ratings together. Score each criterion from 0 to 3. Zero means unusable, one a material discrepancy, two a minor discrepancy and three a faithful result. Mark occluded or unobservable details as unscorable.

| Per-case observation | What to inspect |
| --- | --- |
| Shape | Silhouette, chain structure, earring orientation, pendant outline and asymmetry |
| Stones and settings | Stone count, placement, cuts, prongs and missing or invented detail |
| Gold colour | Metal hue and finish under the portrait lighting |
| SKU consistency | Whether an owner could identify this exact piece from the output |
| Face identity | Facial features, skin texture, expression and other unintended edits |
| Placement | Earring attachment and occlusion, necklace drape, plausible relative scale |
| Output quality | Edge artifacts, blur, duplicated features, background edits and resolution |
| Latency | Seconds per attempt, median and p95 across completed attempts with sample counts |
| Errors and cost | Refusals, timeouts, invalid outputs and HTTP errors by count and denominator. Report total billed cost per attempt and per usable result. |

Private result ledger columns: case ID, SKU, portrait alias, conditions, model/version, prompt version, attempt, outcome, seven visual scores, latency, error class, units, estimated and billed cost, discrepancy notes, reviewer verdict and deletion timestamp.

**Decision rule.** Material redesign of an item makes that result unsuitable for accurate product representation, even when the portrait looks convincing. Material identity changes also fail the case. Report counts of failed and unscorable cases by SKU, jewellery type and condition, alongside latency and cost. Treat a model or product class with unexplained material failures as pending remediation. The owner reviews actual comparisons before any production choice.
