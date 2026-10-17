import { describe, expect, it } from 'vitest';
import { parseHash, routeHref } from '../../src/core/router.js';

describe('parseHash', () => {
  it.each([
    ['', { section: 'today', screen: '' }],
    ['#', { section: 'today', screen: '' }],
    ['#/', { section: 'today', screen: '' }],
    ['#/today', { section: 'today', screen: '' }],
    ['#/settings', { section: 'settings', screen: '' }],
    ['#/gym/log', { section: 'gym', screen: 'log' }],
    ['#/fridge/scan/', { section: 'fridge', screen: 'scan' }],
    ['#/istqb/lesson/3.1?x=1', { section: 'istqb', screen: 'lesson/3.1' }],
  ])('parses %j', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });

  it('builds hrefs', () => {
    expect(routeHref('gym')).toBe('#/gym');
    expect(routeHref('gym', 'log')).toBe('#/gym/log');
  });
});
