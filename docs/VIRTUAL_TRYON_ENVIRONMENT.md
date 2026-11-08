# Virtual try-on environment

**IMPLEMENTED.** Configure the API process in the repository root environment. Restart the API after changing provider credentials, model or storage. The browser only receives feature availability and the approved public overlay.

| Variable | Purpose and default |
| --- | --- |
| `GEMINI_API_KEY` | Server-side key for a project authorized to use the selected image model. Leave empty for local development without AI calls. |
| `GEMINI_MODEL` | Defaults to `gemini-3.1-flash-image`. The adapter also supports `gemini-3-pro-image`. An unsupported model disables the adapter. |
| `CLOUDINARY_CLOUD_NAME` | Identifies the allowed catalogue account. The provider also requires this value to validate the source photograph. Existing Cloudinary upload credentials remain necessary to upload genuine product assets. |
| `TRYON_PHOTO_ENABLED`, `TRYON_AR_ENABLED` | Initial mode defaults. Both default to false. Database settings take precedence after the owner saves them. |
| `TRYON_MAX_UPLOAD_MB` | Initial byte limit in MiB. Default 10, owner range 1–20. |
| `TRYON_RESULT_RETENTION_HOURS` | Initial job lifetime. Default 24 hours, owner range 1–72. |
| `TRYON_PRIVATE_DIR` | Dedicated private directory for sanitized input and output files. The local default is .local/tryon-private under the project. Use an access-controlled persistent volume outside served, backed-up or synced content for real portraits. |
| Daily attempt limit | Owner setting in PostgreSQL. Default 30, range 1–10,000. An attempt count is distinct from a monetary spending limit. |

The sample configuration is in the root [.env.example](../.env.example). Keep any actual key in the ignored server environment or your secret manager. Set the existing WEB_ORIGIN to the exact browser origin. HTTPS or localhost is required for camera permission. The API and worker must share access to their private files.

## Local startup

From the existing workspace, with the intended **local development** database selected and PostgreSQL running:

```powershell
cd C:\Users\ASUS\Desktop\shreeRam
npm run db:generate
npm run db:validate
npm run db:deploy
npm run dev
```

Use the existing owner account at /admin/login, then open /admin/try-on. For a new empty developer database, provision the owner once using the existing README instructions. Open the public product detail page for an enabled piece. The frontend dev/build lifecycle copies the matching MediaPipe WASM runtime from the installed package.

Real photo generation requires approved project access, an eligible SKU with a genuine managed photograph and consent for processing. Verify the applicable provider data-use terms and billing controls before enabling real submissions. Physical camera checks need a supported device and a calibrated transparent product image.
