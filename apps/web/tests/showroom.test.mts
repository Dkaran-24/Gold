import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { showroomDetails, verifiedMapHref, showroomContactLinks } from '../src/lib/showroom-details.ts';
import { safeImageUrl } from '../src/lib/catalogue.ts';

test('showroom content publishes only owner-confirmed address, without assumed hours or map',()=>{
 assert.equal(showroomDetails.address,'Shop No. 7, Vitthal Rakhumai Co-op. Housing Society Ltd., Katrak Road, near Shree Ram Mandir, Wadala (West), Mumbai, Maharashtra 400031.');
 assert.equal(showroomDetails.businessHours,null);
 assert.equal(showroomDetails.mapUrl,null);
 assert.deepEqual(showroomContactLinks(showroomDetails), []);
});
test('approved editorial contact channels render usable links and omit unverified or unsafe destinations', () => {
  const fixture = { phone: '+12025550123', email: 'test@example.invalid', socialProfiles: [
    { label: 'Test profile', url: 'https://example.invalid/test' },
    { label: 'Unsafe', url: 'javascript:alert(1)' },
    { label: '', url: 'https://example.invalid/' },
  ] };
  assert.deepEqual(showroomContactLinks(fixture), [
    { label: fixture.phone, href: 'tel:' + fixture.phone },
    { label: fixture.email, href: 'mailto:' + fixture.email },
    { label: 'Test profile', href: 'https://example.invalid/test' },
  ]);
  assert.deepEqual(showroomContactLinks({ phone: 'not a number', email: 'test@example.invalid?bcc=unapproved', socialProfiles: [] }), []);
});
test('map support rejects empty, unsafe and credential-bearing links',()=>{
 for(const input of [null,'','invalid','javascript:alert(1)','http://maps.google.com','https://user:secret@maps.google.com'])assert.equal(verifiedMapHref(input),null);
 assert.equal(verifiedMapHref('https://maps.google.com/?q=test'),'https://maps.google.com/?q=test');
});

test('actual showroom photograph is preserved locally and validated safely', () => {
  const root = fileURLToPath(new URL('../public/images', import.meta.url));
  const primary = join(root, 'showroom', 'shree-ram-jewellers-storefront.jpg');
  const backup = join(root, 'shree-ram-showroom.png.png');

  assert.ok(existsSync(primary), 'Primary showroom image exists in apps/web/public/images/showroom/');
  assert.ok(existsSync(backup), 'Original showroom image backup is preserved in apps/web/public/images/');

  const primaryStat = statSync(primary);
  assert.ok(primaryStat.size > 100000, 'Primary image is a high-resolution file > 100KB');

  const backupStat = statSync(backup);
  assert.ok(backupStat.size > 1000000, 'Backup original PNG is preserved with full fidelity');

  // Verify safeImageUrl handles the public showroom path correctly
  const path = '/images/showroom/shree-ram-jewellers-storefront.jpg';
  assert.equal(safeImageUrl(path), path);
  assert.equal(safeImageUrl('//evil.com/fake.jpg'), null);
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg'), 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
});

test('made-for-you and our-story homepage images exist locally and validate safely', () => {
  const root = fileURLToPath(new URL('../public/images/homepage', import.meta.url));
  const madeForYou = join(root, 'made-for-you-jewellery-design.jpg');
  const ourStory = join(root, 'our-story-gold-bangles.jpg');

  assert.ok(existsSync(madeForYou), 'Made for you design image exists in public/images/homepage/');
  assert.ok(existsSync(ourStory), 'Our story gold bangles image exists in public/images/homepage/');

  assert.ok(statSync(madeForYou).size > 50000, 'Made for you image is non-empty (>50KB)');
  assert.ok(statSync(ourStory).size > 50000, 'Our story image is non-empty (>50KB)');

  const mfyPath = '/images/homepage/made-for-you-jewellery-design.jpg';
  const storyPath = '/images/homepage/our-story-gold-bangles.jpg';
  assert.equal(safeImageUrl(mfyPath), mfyPath);
  assert.equal(safeImageUrl(storyPath), storyPath);
});
