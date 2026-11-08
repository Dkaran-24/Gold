/** Public showroom content confirmed by the owner on 5 November 2026.
 * Keep unconfirmed fields null. Change these only after explicit owner confirmation.
 * This is editorial content, not database, authentication or environment configuration.
 */
interface ContactChannels {
  phone: string | null;
  email: string | null;
  socialProfiles: ReadonlyArray<{ label: string; url: string }>;
}
export const showroomDetails: ContactChannels & {address:string; businessHours:string|null; mapUrl:string|null} = {
  address: 'Shop No. 7, Vitthal Rakhumai Co-op. Housing Society Ltd., Katrak Road, near Shree Ram Mandir, Wadala (West), Mumbai, Maharashtra 400031.',
  businessHours: null,
  mapUrl: null,
  phone: null,
  email: null,
  socialProfiles: [],
};

export function verifiedMapHref(value:string|null):string|null {
  if(!value) return null;
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}

export function showroomContactLinks(details: ContactChannels) {
  const links: Array<{ label: string; href: string }> = [];
  if (details.phone && /^\+[1-9]\d{7,14}$/.test(details.phone)) {
    links.push({ label: details.phone, href: 'tel:' + details.phone });
  }
  if (details.email && /^[A-Z0-9._+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(details.email)) {
    links.push({ label: details.email, href: 'mailto:' + details.email });
  }
  for (const profile of details.socialProfiles) {
    const href = verifiedMapHref(profile.url);
    if (href && profile.label.trim()) links.push({ label: profile.label.trim(), href });
  }
  return links;
}
