export interface Row {
  id: string; key?: string; name?: string; sku?: string; slug?: string; categoryId?: string;
  publication?: string; availability?: string; status?: string; priority?: string; type?: string;
  description?: string | null; visible?: boolean; archivedAt?: string | null; createdAt?: string; updatedAt?: string;
  internalName?: string; heading?: string; subtitle?: string | null; ctaLabel?: string | null; ctaPath?: string | null;
  enabled?: boolean; active?: boolean; position?: number; sortOrder?: number;
  reference?: string; phone?: string; email?: string; message?: string; subject?: string; purpose?: string;
  productName?: string; productSku?: string; productId?: string | null; preferredContact?: string; callbackAt?: string | null;
  requestedAt?: string; alternativeAt?: string | null; scheduledAt?: string | null; proposedAt?: string | null; endsAt?: string | null; occupiedUntil?: string | null;
  visitors?: number; publicReason?: string | null; collectionId?: string | null;
  url?: string; alt?: string; isPrimary?: boolean; body?: string; previous?: string; next?: string; reason?: string; action?: string;
  imageUrl?: string; imagePublicId?: string | null;
  desktopImageUrl?: string | null; desktopImagePublicId?: string | null;
  mobileImageUrl?: string | null; mobileImagePublicId?: string | null;
  products?: Row[]; inspirationImages?: { image: { id: string; url: string; alt: string } }[];
  [key: string]: unknown;
}
export const stocks = ['AVAILABLE','RESERVED','SOLD','ARCHIVED'];
export const publications = ['DRAFT','PUBLISHED'];
export const priorities = ['LOW','NORMAL','HIGH','URGENT'];
export const enquiryTransitions: Record<string,string[]> = {
  NEW: ['CONTACTED','IN_PROGRESS','CLOSED','SPAM'], CONTACTED: ['IN_PROGRESS','WAITING_FOR_CUSTOMER','CONVERTED','CLOSED','SPAM'],
  IN_PROGRESS: ['CONTACTED','WAITING_FOR_CUSTOMER','CONVERTED','CLOSED','SPAM'], WAITING_FOR_CUSTOMER: ['IN_PROGRESS','CONTACTED','CONVERTED','CLOSED','SPAM'],
  CONVERTED: ['IN_PROGRESS'], CLOSED: ['IN_PROGRESS'], SPAM: ['NEW'], INTERESTED: ['IN_PROGRESS','CONVERTED','CLOSED'], FOLLOW_UP: ['IN_PROGRESS','WAITING_FOR_CUSTOMER','CLOSED'], NOT_INTERESTED: ['IN_PROGRESS'],
};
export const enquiryStatuses = Object.keys(enquiryTransitions);
export const appointmentStatuses = ['REQUESTED','PENDING','APPROVED','RESCHEDULE_PROPOSED','REJECTED','CANCELLED','COMPLETED','NO_SHOW','RESCHEDULED'];
export function appointmentActions(row: Row, now = Date.now()) {
  const allowed: Record<string,string[]> = { APPROVE: ['REQUESTED','PENDING'], REJECT: ['REQUESTED','PENDING','RESCHEDULE_PROPOSED'], PROPOSE: ['REQUESTED','PENDING','APPROVED','RESCHEDULE_PROPOSED'], CONFIRM: ['RESCHEDULE_PROPOSED'], CANCEL: ['REQUESTED','PENDING','APPROVED','RESCHEDULE_PROPOSED'], COMPLETE: ['APPROVED'], NO_SHOW: ['APPROVED'] };
  return Object.keys(allowed).filter(a => allowed[a]?.includes(row.status || '') && (!['COMPLETE','NO_SHOW'].includes(a) || !!row.scheduledAt && new Date(row.scheduledAt).getTime() <= now));
}
export const label = (s?: string | null) => s ? s.replaceAll('_',' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—';
export function dateLabel(s?: string | null, zone?: string) { return s ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',...(zone ? {timeZone:zone} : {})}).format(new Date(s)) : '—'; }
export function localDateInput(value: unknown) { if (!value) return ''; const d = new Date(String(value)); if (!Number.isFinite(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
export function dateInZone(value: string, zone: string) { return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function moved<T>(rows: T[], index: number, delta: number) { const copy = [...rows]; if (index+delta < 0 || index+delta >= rows.length) return copy; [copy[index],copy[index+delta]]=[copy[index+delta]!,copy[index]!]; return copy; }
export function validateUpload(file: Pick<File,'type'|'size'>, maximum: number) { if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP image.'; if (!file.size || file.size > maximum) return `Images must be nonempty and at most ${maximum/1048576} MiB each.`; return null; }

