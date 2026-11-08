# Shree Ram Jewellers — Business Profile & About Us Approval Worksheet

**Document Status:** Awaiting Owner Review & Signature  
**Effective Date:** Pending Owner Confirmation  
**Review Target:** Milestone 6 Business Settings & Storefront Editorial  
**Authoritative Review References:**  
- [Privacy Policy Draft](PRIVACY_POLICY_DRAFT.md) (Authoritative Customer Privacy Notice)
- [Terms Draft](TERMS_DRAFT.md) (Authoritative Storefront & Service Terms)
- [Showroom Details Definition](../../apps/web/src/lib/showroom-details.ts)
- [CRM Workflow Specification](../CRM_WORKFLOW.md)
- [Business Settings Implementation Plan](BUSINESS_SETTINGS_IMPLEMENTATION_PLAN.md)

---

> [!IMPORTANT]
> **Strict Operational Policy: Never Invent or Publish Unverified Information**  
> All showroom operational details, registration numbers, contact numbers, hours, and editorial narratives must be verified against official business records and signed off by the showroom owner before being displayed on the public website. Until verified and signed off, placeholder values must remain `null` or unrendered.

---

## 1. Showroom Hours vs. Appointment Availability Distinction

To prevent customer confusion and operational conflict, the showroom maintains two distinct schedules:

| Dimension | Showroom Opening Hours (Walk-in) | Appointment Availability (Dedicated Consultations) |
|---|---|---|
| **Purpose** | General public walk-in visits, browsing ready catalogue pieces, immediate enquiries, in-person purchasing, and counter assistance. | Reserved one-on-one consultations with jewellery specialists, bridal curation, custom design commissions, and virtual try-on guidance. |
| **Notice Required** | None; visitors are welcome anytime during published open hours. | Advance booking required via the website appointment form or direct showroom confirmation. |
| **Capacity & Pacing** | Governed by physical showroom floor space and counter staff. | Strictly limited by simultaneous slot capacity, visit duration (e.g., 30–60 min), and mandatory buffer intervals between sessions. |
| **Configuration Subsystem** | Managed under Storefront Business Profile (`showroomDetails` / future Business Settings API). | Managed under CRM Availability Settings (`/admin/appointments/availability` and `PUT /api/admin/availability`). |
| **Storefront Presentation** | Displayed on the Footer, Contact page (`/contact`), and Showroom Details widget. | Displayed as booking guidance on the Appointments page (`/appointments`). |

---

## 2. Business Profile Verification Worksheet

The following table documents each profile attribute, its current state in the codebase, the owner-verified value to be confirmed, and the required verification document.

| Field | Current Code State | Owner-Confirmed Value | Required Verification Document | Approved (Yes/No) |
|---|---|---|---|---|
| **Legal Trade Name** | `"Shree Ram Jewellers"` | ____________________ | Business Registration / Udyam Certificate | [ ] |
| **Legal Entity Type** | Unspecified | ____________________ | Sole Proprietorship / Partnership / Pvt Ltd Deed | [ ] |
| **GSTIN** | `null` (not published) | ____________________ | GST Registration Certificate | [ ] |
| **BIS Hallmark License** | `null` (not published) | ____________________ | Bureau of Indian Standards (BIS) Hallmarking Certificate | [ ] |
| **Showroom Address** | `"Shop No. 7, Vitthal Rakhumai Co-op. Housing Society Ltd., Katrak Road, near Shree Ram Mandir, Wadala (West), Mumbai, Maharashtra 400031."` | *(Confirmed 5 Nov 2026)* | Society Maintenance Bill / Municipal License | [x] Approved |
| **Google Maps Directions URL** | `null` | `https://maps.google.com/?q=...` | Verified Google Business Profile Link (HTTPS only) | [ ] |
| **Showroom Voice Telephone** | `null` | `+91 ________________` | Telecom Bill / Registered Business Line (E.164) | [ ] |
| **Showroom Contact Email** | `null` | `________________@shreeramjewellers.com` | Verified Domain Mailbox / Business Email | [ ] |
| **Showroom WhatsApp Business** | `null` (in `contactOptions`) | `+91 ________________` | WhatsApp Business Account Verification (E.164) | [ ] |
| **Instagram Profile** | `[]` (empty list) | `https://instagram.com/___________` | Verified Official Handle (HTTPS) | [ ] |
| **Facebook Page** | `[]` (empty list) | `https://facebook.com/___________` | Verified Official Page (HTTPS) | [ ] |

---

## 3. Showroom Opening Hours Schedule (Walk-in)

Enter the verified general opening and closing hours for walk-in showroom visitors.

*Showroom Timezone: `Asia/Kolkata` (IST)*

| Day of Week | Showroom Status | Opening Time (IST) | Closing Time (IST) | Lunch / Afternoon Break (if applicable) |
|---|---|---|---|---|
| **Monday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Tuesday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Wednesday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Thursday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Friday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Saturday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |
| **Sunday** | [ ] Open  [ ] Closed | ________ | ________ | ________ to ________ |

**Weekly Closing Day:** ______________________  
**Annual / Public Holiday Policy:** (e.g. Closed on Independence Day, Republic Day; Special extended hours during Dhanteras/Diwali)  
____________________________________________________________________________________________________

---

## 4. Appointment Availability Parameters (CRM Scheduling)

The CRM appointment engine enforces capacity and prevents overbooking based on these owner-approved rules:

| Setting | Recommended Default | Owner-Approved Value | Operational Purpose |
|---|---|---|---|
| **Showroom Timezone** | `Asia/Kolkata` | `Asia/Kolkata` | Timezone for parsing appointment timestamps |
| **Default Visit Duration** | `45 minutes` | _____ minutes | Slot reservation length per consultation |
| **Buffer Period Between Visits** | `15 minutes` | _____ minutes | Sanitisation, setup, and craftsman prep time |
| **Simultaneous Consultation Capacity** | `1 appointment` | _____ appointments | Maximum concurrent private appointment parties |
| **Minimum Advance Notice** | `24 hours` | _____ hours | Prevents same-day unexpected walk-in clashes |
| **Maximum Advance Booking** | `30 days` | _____ days | Limits booking horizon to foreseeable schedules |
| **Maximum Party Size (Visitors)** | `4 persons` | _____ persons | Ensures comfortable seating and security in showroom |

---

## 5. About Us Editorial & Narrative Approval

The current About Us page (`apps/web/src/app/(storefront)/about/page.tsx`) displays a refined, minimal placeholder narrative. The owner must review and approve the official brand story before replacing the placeholder.

### Proposed Editorial Drafts for Owner Sign-Off

#### Option A: Heritage & Family Trust (Focus on Wadala community roots)
> *"For generations, Shree Ram Jewellers has been a quiet constant in Wadala, Mumbai—crafting pure gold, hallmarked silver, and timeless bespoke jewellery for families marking life’s most cherished milestones. We believe jewellery is deeply personal: an heirloom to be passed down, a talisman worn every day, or a celebration of love. Every piece in our showroom is selected and crafted with uncompromising integrity, verified purity, and meticulous care."*

#### Option B: Artisanal Craftsmanship & Personal Design (Focus on custom artistry)
> *"At Shree Ram Jewellers, craftsmanship is a dialogue between tradition and individual expression. From traditional bridal ornaments to contemporary everyday classics, our Wadala showroom brings together master artisans and discerning patrons. We invite you to explore our curated collections, discuss custom designs with our master craftsmen, and discover pieces that become a true part of who you are."*

### Editorial Narrative Sign-Off
- Selected Editorial Direction: [ ] Option A  [ ] Option B  [ ] Custom Narrative (attached below)
- Brand Founding Year: ____________
- Principal Craftsman / Founder Name(s): ____________________________________
- Specializations: [ ] 22K Hallmarked Gold  [ ] Diamond Jewellery  [ ] Bridal Sets  [ ] Custom Remodelling  [ ] Silver Utensils & Ornaments
- Photography Credits & Rights: All showroom interior and workshop photographs provided for the About page are owned exclusively by Shree Ram Jewellers and approved for public web display: [ ] Confirmed

---

## 6. Review & Approval Sign-Off Block

By signing below, the showroom owner confirms that:
1. The business details, contact information, and hours recorded above are accurate and verified against official business documentation.
2. The distinction between general showroom opening hours and CRM appointment availability has been reviewed and approved.
3. The legal drafts ([Privacy Policy Draft](PRIVACY_POLICY_DRAFT.md) and [Terms Draft](TERMS_DRAFT.md)) remain the authoritative review documents for regulatory and operational policy.
4. No unverified information shall be published until this document is countersigned.

**Showroom Owner Name:** _____________________________________________  
**Signature:** ______________________________________________________  
**Date:** ___________________________________________________________  

