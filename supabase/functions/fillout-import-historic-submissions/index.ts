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
] as const;

const TRAINER_PROFILE_OWNER = 'Trainer Profile';
const MAX_LIMIT = 150;

type ImportForm = {
  formId: string;
  classType?: string;
};

type ImportRequest = {
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

function buildTicketRow(mapping: ReturnType<typeof mapFilloutTrainingEvaluation>, form: ImportForm) {
  const input = mapping.input;
  const scorePercent = mapping.record.scorePercent;
  const label = classLabel(form.classType, input.template);
  const recordTimestamp = mapping.record.createdAt || mapping.receivedAt;

  return {
    source_ref: mapping.sourceRef,
    title: `Instructor evaluation · ${input.trainer || 'Unknown'} · ${label}`,
    description: buildTrainerEvaluationText(input),
    category: 'Trainer Feedback',
    sub_category: 'Knowledge and Competence',
    priority: 'Low' as const,
    status: 'Closed',
    studio: clean(input.studio, 'Unspecified Studio'),
    trainer: input.trainer || null,
    class_type: form.classType || input.classType || null,
    class_date_time: null,
    member_name: null,
    member_contact: null,
    reported_by: 'Fillout historic import',
    assigned_to: TRAINER_PROFILE_OWNER,
    team: 'Training',
    tags: [
      'trainer-profile',
      'instructor-evaluation',
      'profile-only',
      'fillout-historic-import',
      label.toLowerCase().replace(/\s+/g, '-'),
    ],
    sentiment: scorePercent >= 80 ? 'Positive' : scorePercent >= 65 ? 'Neutral' : 'Concern',
    conversation_summary: [
      `Historic instructor evaluation imported from Fillout for ${input.trainer || 'Unknown'} (${label}).`,
      `Weighted score: ${scorePercent}% · ${performanceBand(scorePercent)}.`,
      input.focusPoints ? `Primary focus: ${input.focusPoints}` : '',
      input.goals ? `Target goal: ${input.goals}` : '',
      'Recorded under Trainer Profiles only. No operational owner or SLA follow-up required.',
    ].filter(Boolean).join('\n'),
    metadata: {
      source_ref: mapping.sourceRef,
      source: 'fillout_historic_import',
      profileOnly: true,
      fillout: {
        formId: form.formId,
        submissionId: mapping.submissionId,
        classType: form.classType,
        receivedAt: mapping.receivedAt,
        answers: mapping.answers,
      },
      trainerReview: mapping.record,
      routing: {
        department: 'Training',
        assigned_to: TRAINER_PROFILE_OWNER,
        status: 'Closed',
        priority: 'Low',
        profile_only: true,
        routing_source: 'fillout_historic_import',
      },
    },
    sla_due_at: recordTimestamp,
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
          const row = buildTicketRow(mapping, form);

          const existing = await supabase
            .from('tickets')
            .select('id')
            .eq('source_ref', mapping.sourceRef)
            .maybeSingle();

          if (existing.data && !refreshExisting) {
            formSummary.skippedDuplicates += 1;
            summary.skippedDuplicates += 1;
            continue;
          }

          if (!dryRun) {
            if (existing.data) {
              const { error } = await supabase
                .from('tickets')
                .update(row)
                .eq('id', existing.data.id);
              if (error) throw error;
              formSummary.updated += 1;
              summary.updated += 1;
            } else {
              const { data, error } = await supabase.from('tickets').insert(row).select('id').single();
              if (error) throw error;
              if (data?.id) {
                await supabase.from('ticket_events').insert({
                  ticket_id: data.id,
                  event_type: 'trainer_evaluation_recorded',
                  actor: 'Fillout historic import',
                  to_value: TRAINER_PROFILE_OWNER,
                  metadata: {
                    source: 'fillout_historic_import',
                    sourceRef: mapping.sourceRef,
                    formId: form.formId,
                    submissionId: mapping.submissionId,
                    trainerReview: mapping.record,
                  },
                });
              }
              formSummary.created += 1;
              summary.created += 1;
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown import failure';
          formSummary.failed += 1;
          summary.failed += 1;
          formSummary.errors.push({ error: message });
        }
      }

      if (pageData.submissions.length < limit) break;
      if (pageData.pageCount !== null && page + 1 >= pageData.pageCount) break;
    }

    summary.forms.push(formSummary);
  }

  return json(summary);
});
