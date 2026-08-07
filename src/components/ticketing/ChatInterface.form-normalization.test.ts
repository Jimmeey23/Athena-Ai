import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat detail form normalization', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/ticketing/ChatInterface.tsx'), 'utf8');

  it('keeps assistant message rendering outside the detail form container', () => {
    expect(source).toContain('{renderContent(previewContent)}');
    expect(source).toContain('{message.detailForm && !message.ticket && (');
    expect(source.indexOf('{renderContent(previewContent)}')).toBeLessThan(source.indexOf('{message.detailForm && !message.ticket && ('));
  });

  it('prefers app constants over AI-provided options for known detail fields', () => {
    expect(source).toContain('const standardOptions = contextualBase.options?.length ? contextualBase.options : null');
    expect(source).toContain('options: standardOptions || aiOptions || contextualBase.options');
  });

  it('uses the current category to keep subcategory options scoped', () => {
    expect(source).toContain('function detailFieldWithContext');
    expect(source).toContain("if (base.id === 'subCategory')");
    expect(source).toContain('CATEGORIES[category]');
    expect(source).toContain('normalizeDetailForm(data?.detailForm, responseContext)');
  });

  it('loads Momence session dropdown pages progressively without static class fallbacks', () => {
    expect(source).toContain('loadMomenceSessionsProgressively');
    expect(source).toContain('setOptions((current) => mergeMomenceSessionOptions(current, sessions))');
    expect(source).not.toContain('function localSessionOptionsForClassTypes');
    expect(source).not.toContain("description: 'Class option'");
    expect(source).toContain('loading={loading && dropdownOptions.length === 0}');
    expect(source).not.toContain('disabled={dropdownOptions.length === 0}');
  });
});
