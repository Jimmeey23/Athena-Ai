import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appSidebarClassName } from './app-layout-sidebar';

describe('AppLayout sidebar layout', () => {
  it('allows vertical scrolling while preserving the collapsed and expanded widths', () => {
    expect(appSidebarClassName(false)).toContain('overflow-y-auto');
    expect(appSidebarClassName(false)).toContain('overflow-x-hidden');
    expect(appSidebarClassName(false)).toContain('w-[64px]');

    expect(appSidebarClassName(true)).toContain('overflow-y-auto');
    expect(appSidebarClassName(true)).toContain('w-52');
  });

  it('wraps lazy operational tabs in a recovery boundary so failed chunks do not crash the app', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/AppLayout.tsx'), 'utf8');

    expect(source).toContain('class LazyTabErrorBoundary');
    expect(source).toContain('<LazyTabErrorBoundary');
    expect(source).toContain('Submitted tickets could not load');
    expect(source).toContain('Reports could not load');
  });
});
