import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  buildTrainerEvaluationText,
  mapFilloutTrainingEvaluation,
} from '../../../src/lib/trainer-evaluation-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_FORMS = [
  { formId: 'dSw2VkfdGqus', classType: 'barre' },
  { formId: 'ceKTqZnemVus', classType: 'barre' },
  { formId: 'jJFTEMzHkMus', classType: 'powerCycle' },
] as const;

const MAX_LIMIT = 150;

type ImportForm = {
  formId: string;
  classType?: string;
};

type ImportRequest = {
  listForms?: boolean;
  forms?: ImportForm[];
  formId?: string;
  classType?: string;
  afterDate?: string;
  beforeDate?: string;
  limit?: number;
  maxPages?: number;
  dryRun?: boolean;
  refreshExisting?: boolean;
};

type FilloutSubmissionList = {
  responses?: unknown[];
  submissions?: unknown[];
  totalResponses?: number;
  pageCount?: number;
};

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clean(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function performanceBand(scorePercent: number): string {
  if (scorePercent < 65) return 'High coaching priority';
  if (scorePercent < 80) return 'Development watch';
  return 'On-track performance';
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const supabaseError = error as SupabaseLikeError;
    const parts = [
      supabaseError.message,
      supabaseError.code ? `code=${supabaseError.code}` : '',
      supabaseError.details ? `details=${supabaseError.details}` : '',
      supabaseError.hint ? `hint=${supabaseError.hint}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown import failure';
    }
  }
  return 'Unknown import failure';
}

function classLabel(classType: string | undefined, fallback: string): string {
  if (!classType) return fallback || 'Evaluation';
  if (classType === 'powerCycle') return 'PowerCycle';
  if (classType === 'strength') return 'Strength';
  return classType.charAt(0).toUpperCase() + classType.slice(1);
}

function parseForms(body: ImportRequest): ImportForm[] {
  if (Array.isArray(body.forms) && body.forms.length) {
    return body.forms
      .map((form) => ({
        formId: clean(form.formId),
        classType: clean(form.classType) || undefined,
      }))
      .filter((form) => form.formId);
  }

  if (body.formId) {
    return [{ formId: clean(body.formId), classType: clean(body.classType) || undefined }];
  }

  return [...DEFAULT_FORMS];
}

async function fetchFilloutPage(
  formId: string,
  apiKey: string,
  params: {
    limit: number;
    offset: number;
    afterDate?: string;
    beforeDate?: string;
  },
): Promise<{ submissions: unknown[]; totalResponses: number | null; pageCount: number | null }> {
  const url = new URL(`https://api.fillout.com/v1/api/forms/${formId}/submissions`);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('offset', String(params.offset));
  url.searchParams.set('sort', 'asc');
  if (params.afterDate) url.searchParams.set('afterDate', params.afterDate);
  if (params.beforeDate) url.searchParams.set('beforeDate', params.beforeDate);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fillout API ${res.status}: ${text}`);
  }

  const data = await res.json() as FilloutSubmissionList | unknown[];
  const submissions = Array.isArray(data) ? data : (data.responses ?? data.submissions ?? []);
  return {
    submissions,
    totalResponses: Array.isArray(data) ? null : data.totalResponses ?? null,
    pageCount: Array.isArray(data) ? null : data.pageCount ?? null,
  };
}

async function fetchFilloutForms(apiKey: string): Promise<unknown> {
  const res = await fetch('https://api.fillout.com/v1/api/forms', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep the original response body for diagnostics.
  }

  if (!res.ok) throw new Error(`Fillout API ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

function buildTrainerReviewRow(mapping: ReturnType<typeof mapFilloutTrainingEvaluation>, form: ImportForm) {
  const input = mapping.input;
  const scorePercent = mapping.record.scorePercent;
  const label = classLabel(form.classType, input.template);

  return {
    id: mapping.record.id,
    source: mapping.record.source,
    source_ref: mapping.sourceRef,
    trainer: mapping.record.trainer,
    template: mapping.record.template,
    studio: mapping.record.studio ?? null,
    class_type: form.classType || mapping.record.classType || null,
    review_period: mapping.record.reviewPeriod ?? null,
    scores: mapping.record.scores,
    feedback: mapping.record.feedback,
    focus_points: mapping.record.focusPoints ?? null,
    goals: mapping.record.goals ?? null,
    raw_text: mapping.record.rawText ?? buildTrainerEvaluationText(input),
    total_weightage: mapping.record.totalWeightage,
    total_score: mapping.record.totalScore,
    score_percent: scorePercent,
    metadata: {
      source_ref: mapping.sourceRef,
      source: 'fillout_historic_import',
      fillout: {
        formId: form.formId,
        submissionId: mapping.submissionId,
        classType: form.classType,
        receivedAt: mapping.receivedAt,
        answers: mapping.answers,
      },
      importSummary: `Historic instructor evaluation imported from Fillout for ${input.trainer || 'Unknown'} (${label}). Weighted score: ${scorePercent}% - ${performanceBand(scorePercent)}.`,
    },
    created_at: mapping.record.createdAt || mapping.receivedAt,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('TICKETING_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('TICKETING_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const filloutApiKey = Deno.env.get('FILLOUT_API_KEY');

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Missing Supabase config' }, 500);
  if (!filloutApiKey) return json({ error: 'FILLOUT_API_KEY secret not set' }, 500);

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const forms = parseForms(body);
  const limit = Math.min(Math.max(Number(body.limit) || MAX_LIMIT, 1), MAX_LIMIT);
  const maxPages = Math.max(Number(body.maxPages) || 1000, 1);
  const dryRun = body.dryRun === true;
  const refreshExisting = body.refreshExisting === true;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (body.listForms === true) {
    try {
      return json({ forms: await fetchFilloutForms(filloutApiKey) });
    } catch (error) {
      return json({ error: formatError(error) }, 500);
    }
  }

  const summary = {
    dryRun,
    forms: [] as Array<Record<string, unknown>>,
    created: 0,
    updated: 0,
    skippedDuplicates: 0,
    failed: 0,
  };

  for (const form of forms) {
    const formSummary = {
      formId: form.formId,
      classType: form.classType ?? null,
      fetched: 0,
      created: 0,
      updated: 0,
      skippedDuplicates: 0,
      failed: 0,
      errors: [] as Array<{ sourceRef?: string; error: string }>,
    };

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * limit;
      let pageData: Awaited<ReturnType<typeof fetchFilloutPage>>;
      try {
        pageData = await fetchFilloutPage(form.formId, filloutApiKey, {
          limit,
          offset,
          afterDate: body.afterDate,
          beforeDate: body.beforeDate,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Fillout page fetch failed';
        formSummary.failed += 1;
        summary.failed += 1;
        formSummary.errors.push({ error: message });
        break;
      }

      if (!pageData.submissions.length) break;
      formSummary.fetched += pageData.submissions.length;

      for (const submission of pageData.submissions) {
        try {
          const mapping = mapFilloutTrainingEvaluation({ submission, formId: form.formId });
          const row = buildTrainerReviewRow(mapping, form);

          const existing = await supabase
            .from('trainer_reviews')
            .select('id')
            .eq('source_ref', mapping.sourceRef)
            .maybeSingle();

          if (existing.error) throw existing.error;

          if (existing.data && !refreshExisting) {
            formSummary.skippedDuplicates += 1;
            summary.skippedDuplicates += 1;
            continue;
          }

          if (!dryRun) {
            if (existing.data) {
              const { error } = await supabase
                .from('trainer_reviews')
                .update(row)
                .eq('id', existing.data.id);
              if (error) throw error;
              formSummary.updated += 1;
              summary.updated += 1;
            } else {
              const { error } = await supabase.from('trainer_reviews').insert(row);
              if (error) throw error;
              formSummary.created += 1;
              summary.created += 1;
            }
          }
        } catch (error) {
          const message = formatError(error);
          formSummary.failed += 1;
          summary.failed += 1;
          formSummary.errors.push({
            sourceRef: error && typeof error === 'object' && 'sourceRef' in error
              ? String((error as { sourceRef?: unknown }).sourceRef)
              : undefined,
            error: message,
          });
        }
      }

      if (pageData.submissions.length < limit) break;
      if (pageData.pageCount !== null && page + 1 >= pageData.pageCount) break;
    }

    summary.forms.push(formSummary);
  }

  return json(summary);
});
