# Preparing a catalogue batch

Give one person responsibility for the batch and a second person responsibility for checking the physical items, displayed prices and photo permissions. Keep the working files, genuine inventory, evidence and photographs in an owner-controlled folder outside the website repository.

## Set up the working folder

Copy the header-only [products](products.csv), [images](images.csv) and [memberships](memberships.csv) files and the empty [reference list](references.json) into the working folder. Add a `photos` subfolder for the original images. Keep filenames and relative paths consistent across the batch.

Fill the two lists in `references.json` with the exact category and collection slugs approved by the showroom. Use strings in the supplied JSON arrays. These lists give the offline checker a vocabulary against which to check the batch. Record who approved the lists and when in your own private intake notes. Do not put credentials, customer names or private cost records into any of these files.

## Prepare the three CSV files

Keep the files as UTF-8 CSV. Preserve the headers and enter SKUs as **text** so a spreadsheet does not remove leading zeroes or convert identifiers to dates. Quote any field containing a comma, line break or double quote. Inside a quoted field, write two double quotes for a literal quote.

| File | What to enter |
|---|---|
| products.csv | One row per physical item. Enter its SKU, unique lowercase hyphenated slug, name, approved category slug and factual description. Metal is `GOLD`, `SILVER`, `PLATINUM` or `MIXED`. Enter the verified purity exactly as approved. Set `purityVerified` to `true` only after checking the underlying evidence. |
| images.csv | One row per photograph. Link it to the exact SKU. Enter its one-based display position, local filename relative to `photos/`, useful alt text and the owner's rights approval. Position 1 is the primary photograph. Use consecutive positions for each SKU. |
| memberships.csv | One row per SKU and approved collection slug. Repeat the SKU on separate rows if it belongs to several collections. Keep only the header if there are no memberships. |

- **Weight.** Use grams and a decimal point, with up to three decimal places. Gross weight must be positive. Net weight must be nonnegative and must fit within gross weight. Keep units and thousands separators out of the cells.
- **Pricing.** For enquiry-only pieces use `enquiryOnly=true`, leave `publicPrice` blank, and leave `priceApproved` blank or set it to `false`. For a published price use `enquiryOnly=false`, enter the owner-approved amount in INR with up to two decimal places and set `priceApproved=true`. Zero is a price and needs the same approval as any other amount.
- **Merchandising.** Set `featured` explicitly to `true` or `false`. For a new-arrival window supply both `arrivalDate` and `newUntil` as ISO timestamps with a timezone offset or Z. The end must be later than the start. Leave both blank for an item without a new-arrival window.
- **Stock.** Choose the actual status: `AVAILABLE`, `RESERVED`, `SOLD` or `ARCHIVED`. Archive rows cannot request new images or collection membership. Refer an archive conflict to the owner rather than changing inventory status to make the check pass.
- **Photographs.** Each non-archived item needs a usable, rights-approved photograph for this intake. Use up to ten ordered JPEG, PNG or WebP files per product, subject to the upload defaults of 5 MiB per image and 25 million input pixels. Avoid URLs, absolute paths, animated files and links outside the batch. The checker reads and validates images locally. It cannot establish image ownership, jewellery identity or fidelity from the pixels.

## Run the preflight

From the project root, with the existing project dependencies installed, run:

```powershell
node --import tsx scripts/catalogue-preflight.ts 'C:\path\to\private-intake'
node --import tsx scripts/catalogue-preflight.ts 'C:\path\to\private-intake' --json
```

The report goes to standard output. For an archived copy, redirect the JSON output to a **new report filename outside the input files**. A finding includes the input filename, row, field, issue and suggested correction. Use the row to find the entry in the original file, including when a quoted description spans more than one line. The checker never edits the CSVs or photographs. Exit code 0 indicates a valid batch, 1 means validation findings, and 2 means incorrect invocation. Checking the untouched templates returns 1 because a handoff needs at least one product. Duplicate SKU detection ignores case, but image and membership rows must match the product SKU exactly.

## Owner handoff

Resolve findings in a working copy and rerun. Before signing off, compare each SKU with the item and the underlying weight, purity, price and photograph records. Retain the reviewed files and report together. A clean report establishes consistency within that batch. Checking for existing SKUs or slugs, resolving live IDs, uploading images, creating drafts and publishing would require a separately approved workflow. This command performs none of those operations.
