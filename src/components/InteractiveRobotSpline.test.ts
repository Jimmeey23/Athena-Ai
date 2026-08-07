import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('InteractiveRobotSpline WebGL guard', () => {
  it('waits for a non-zero container before mounting Spline', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/InteractiveRobotSpline.tsx'), 'utf8');

    expect(source).toContain('const [canMountSpline, setCanMountSpline] = useState(false)');
    expect(source).toContain('new ResizeObserver(updateReadiness)');
    expect(source).toContain('rect.width >= 24 && rect.height >= 24');
    expect(source).toContain('rect.width <= 0 || rect.height <= 0');
    expect(source).toContain('{canMountSpline ? (');
  });
});
