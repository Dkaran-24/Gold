import test from 'node:test';
import assert from 'node:assert/strict';
import { safeResultUrl } from '../src/lib/try-on/client.ts';

const origin = 'https://shreeramjewellers.store';
const route = '/api/try-on/jobs/00000000-0000-4000-8000-000000000001/result';
const signed = route + '?until=1900000000000&signature=' + 'a'.repeat(64);

test('a signed preview can be displayed through its relative or absolute result route', () => {
  for (const url of [signed, origin + signed]) assert.equal(safeResultUrl(url, origin), origin + signed);
});

test('malformed, off-site, unsigned and non-result URLs fail safely', () => {
  for (const url of [
    undefined, {}, null, 'https://[', 'javascript:alert(1)', 'https://other.invalid' + signed,
    'https://user@shreeramjewellers.store' + signed, route, signed + '#fragment', signed + '&extra=1',
    signed.replace('/result?', '/retry?'), signed.replace('/result?', '/result/nested?'),
    signed.replace('signature=', 'bad='), signed.replace('until=1900000000000', 'until=invalid')
  ]) assert.equal(safeResultUrl(url, origin), null);
});
