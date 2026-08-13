import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  updateCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock('./backend-supabase', () => ({
  backendSupabase: {
    from: (table: string) => {
      if (table !== 'momence_report_cards') throw new Error(`Unexpected table ${table}`);
      const builder = {
        _op: '' as 'select' | 'insert' | 'update' | 'delete',
        _patch: undefined as Record<string, unknown> | undefined,
        select() { return builder; },
        order() { return Promise.resolve({ data: supabaseState.rows, error: null }); },
        insert(row: Record<string, unknown>) {
          const created = { id: 'card-1', created_at: '2026-08-13T00:00:00.000Z', ...row };
          supabaseState.rows.unshift(created);
          builder._op = 'insert';
          builder._patch = created;
          return builder;
        },
        update(patch: Record<string, unknown>) {
          builder._op = 'update';
          builder._patch = patch;
          supabaseState.updateCalls.push(patch);
          return builder;
        },
        delete() {
          builder._op = 'delete';
          return builder;
        },
        eq(_column: string, value: string) {
          if (builder._op === 'update') {
            const row = supabaseState.rows.find((item) => item.id === value);
            if (row) Object.assign(row, builder._patch);
          }
          if (builder._op === 'delete') {
            supabaseState.rows = supabaseState.rows.filter((item) => item.id !== value);
            return Promise.resolve({ error: null });
          }
          return builder;
        },
        single() {
          const row = builder._op === 'insert'
            ? builder._patch
            : supabaseState.rows[0];
          return Promise.resolve({ data: row, error: null });
        },
      };
      return builder;
    },
  },
}));

const momenceApiState = vi.hoisted(() => ({
  createReportRun: vi.fn(),
  getReportRun: vi.fn(),
}));

vi.mock('./momence-api', () => ({
  createMomenceReportRun: momenceApiState.createReportRun,
  getMomenceReportRun: momenceApiState.getReportRun,
}));

import {
  createMomenceReportCard,
  deleteMomenceReportCard,
  listMomenceReportCards,
  runMomenceReportCard,
} from './momence-report-cards';

describe('Momence report cards', () => {
  beforeEach(() => {
    supabaseState.rows = [];
    supabaseState.updateCalls = [];
    momenceApiState.createReportRun.mockReset();
    momenceApiState.getReportRun.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and lists a saved report card', async () => {
    const created = await createMomenceReportCard('Monthly sales', { reportType: 'total-sales' });
    expect(created.title).toBe('Monthly sales');
    expect(created.parameters).toEqual({ reportType: 'total-sales' });

    const cards = await listMomenceReportCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(created.id);
  });

  it('runs a card and persists the completed result immediately when no polling is needed', async () => {
    momenceApiState.createReportRun.mockResolvedValue({ id: 99, status: 'completed', data: { total: 4200 } });
    const card = await createMomenceReportCard('Monthly sales', { reportType: 'total-sales' });

    const updated = await runMomenceReportCard(card);

    expect(momenceApiState.getReportRun).not.toHaveBeenCalled();
    expect(updated.lastStatus).toBe('completed');
    expect(updated.lastResult).toEqual({ total: 4200 });
    expect(updated.lastError).toBeUndefined();
  });

  it('polls until the report run settles before persisting', async () => {
    vi.useFakeTimers();
    momenceApiState.createReportRun.mockResolvedValue({ id: 99, status: 'pending', data: null });
    momenceApiState.getReportRun
      .mockResolvedValueOnce({ id: 99, status: 'pending', data: null })
      .mockResolvedValueOnce({ id: 99, status: 'completed', data: { total: 500 } });
    const card = await createMomenceReportCard('Weekly retention', { reportType: 'retention' });

    const runPromise = runMomenceReportCard(card);
    await vi.runAllTimersAsync();
    const updated = await runPromise;

    expect(momenceApiState.getReportRun).toHaveBeenCalledTimes(2);
    expect(updated.lastStatus).toBe('completed');
    expect(updated.lastResult).toEqual({ total: 500 });
  });

  it('records a failure without throwing when the report run errors', async () => {
    momenceApiState.createReportRun.mockRejectedValue(new Error('Momence report run failed (500)'));
    const card = await createMomenceReportCard('Broken card', { reportType: 'bogus' });

    const updated = await runMomenceReportCard(card);

    expect(updated.lastStatus).toBe('failed');
    expect(updated.lastError).toBe('Momence report run failed (500)');
    expect(updated.lastResult).toBeUndefined();
  });

  it('deletes a report card', async () => {
    const card = await createMomenceReportCard('To delete', { reportType: 'x' });
    await deleteMomenceReportCard(card.id);
    const cards = await listMomenceReportCards();
    expect(cards).toHaveLength(0);
  });
});
