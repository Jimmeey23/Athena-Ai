import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TRAINERS } from './ticketing-data';
import { trainerImageUrl } from './trainer-images';

describe('trainer images', () => {
  it('returns public image URLs that exist for mapped active trainers', () => {
    const mapped = TRAINERS
      .map((trainer) => ({ trainer, url: trainerImageUrl(trainer) }))
      .filter((item) => item.url);

    expect(mapped.length).toBeGreaterThan(20);
    expect(mapped.find((item) => item.trainer === 'Siddhartha Kusuma')?.url).toBe('/images/Siddhartha.jpg');

    for (const item of mapped) {
      expect(existsSync(join(process.cwd(), 'public', item.url!.replace(/^\//, ''))), item.trainer).toBe(true);
    }
  });
});
