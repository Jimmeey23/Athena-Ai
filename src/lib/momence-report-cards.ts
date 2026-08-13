import { backendSupabase } from './backend-supabase';
import { createMomenceReportRun, getMomenceReportRun, MomenceReportRun } from './momence-api';

export interface MomenceReportCard {
  id: string;
  title: string;
  parameters: Record<string, unknown>;
  lastRunAt?: string;
  lastStatus?: string;
  lastResult?: unknown;
  lastError?: string;
  createdAt: string;
}

interface DbReportCardRow {
  id: string;
  title: string;
  parameters: Record<string, unknown>;
  last_run_at?: string | null;
  last_status?: string | null;
  last_result?: unknown;
  last_error?: string | null;
  created_at: string;
}

function fromRow(row: DbReportCardRow): MomenceReportCard {
  return {
    id: row.id,
    title: row.title,
    parameters: row.parameters || {},
    lastRunAt: row.last_run_at || undefined,
    lastStatus: row.last_status || undefined,
    lastResult: row.last_result ?? undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at,
  };
}

export async function listMomenceReportCards(): Promise<MomenceReportCard[]> {
  const { data, error } = await backendSupabase
    .from('momence_report_cards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as DbReportCardRow[]).map(fromRow);
}

export async function createMomenceReportCard(title: string, parameters: Record<string, unknown>): Promise<MomenceReportCard> {
  const { data, error } = await backendSupabase
    .from('momence_report_cards')
    .insert({ title: title.trim(), parameters })
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data as DbReportCardRow);
}

export async function deleteMomenceReportCard(id: string): Promise<void> {
  const { error } = await backendSupabase.from('momence_report_cards').delete().eq('id', id);
  if (error) throw error;
}

function isReportRunSettled(run: MomenceReportRun): boolean {
  const status = (run.status || '').toLowerCase();
  if (status) return status !== 'pending' && status !== 'running' && status !== 'processing';
  return run.data != null;
}

const POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 1500;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function runMomenceReportCard(card: MomenceReportCard): Promise<MomenceReportCard> {
  let run: MomenceReportRun;
  let lastError: string | undefined;
  try {
    run = await createMomenceReportRun(card.parameters);
    for (let attempt = 0; attempt < POLL_ATTEMPTS && run.id != null && !isReportRunSettled(run); attempt += 1) {
      await delay(POLL_DELAY_MS);
      run = await getMomenceReportRun(run.id);
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Momence report run failed';
    const { data, error: dbError } = await backendSupabase
      .from('momence_report_cards')
      .update({ last_run_at: new Date().toISOString(), last_status: 'failed', last_error: lastError, last_result: null })
      .eq('id', card.id)
      .select('*')
      .single();
    if (dbError) throw dbError;
    return fromRow(data as DbReportCardRow);
  }

  const status = run.status || (isReportRunSettled(run) ? 'completed' : 'pending');
  const { data, error } = await backendSupabase
    .from('momence_report_cards')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_result: run.data ?? null,
      last_error: null,
    })
    .eq('id', card.id)
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data as DbReportCardRow);
}
