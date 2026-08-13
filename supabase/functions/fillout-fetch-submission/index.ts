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

const PRIORITY_SLA_HOURS = { Critical: 2, High: 8, Medium: 24, Low: 72 } as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clean(value: unknown, fallback = ''): string {
  return String(value ?? '').trim() || fallback;
}

function performanceBand(scorePercent: number): string {
  if (scorePercent < 65) return 'High coaching priority';
  if (scorePercent < 80) return 'Development watch';
  return 'On-track performance';
}

async function fetchFilloutSubmission(
  formId: string,
  submissionId: string | null,
  apiKey: string,
): Promise<unknown> {
  const url = new URL(`https://api.fillout.com/v1/api/forms/${formId}/submissions`);
  url.searchParams.set('limit', '20');
  url.searchParams.set('sort', 'desc');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fillout API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const list: unknown[] = Array.isArray(data) ? data : (data.responses ?? data.submissions ?? []);

  if (!list.length) throw new Error('No submissions found for this form');

  if (submissionId) {
    const match = list.find(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        (
          (s as Record<string, unknown>).submissionId === submissionId ||
          (s as Record<string, unknown>).submission_id === submissionId ||
          (s as Record<string, unknown>).id === submissionId
        ),
    );
    if (match) return match;
  }

  // Fall back to most recent
  return list[0];
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('TICKETING_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const serviceRoleKey =
    Deno.env.get('TICKETING_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const filloutApiKey = Deno.env.get('FILLOUT_API_KEY');

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Missing Supabase config' }, 500);
  if (!filloutApiKey) return json({ error: 'FILLOUT_API_KEY secret not set' }, 500);

  let body: { formId?: string; submissionId?: string; classType?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { formId, submissionId, classType } = body;
  if (!formId) return json({ error: 'formId is required' }, 400);

  let rawSubmission: unknown;
  try {
    rawSubmission = await fetchFilloutSubmission(formId, submissionId ?? null, filloutApiKey);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Fillout fetch failed' }, 502);
  }

  let mapping;
  try {
    mapping = mapFilloutTrainingEvaluation({ submission: rawSubmission, formId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Mapping failed' }, 400);
  }

  const input = mapping.input;
  const scorePercent = mapping.record.scorePercent;
  const description = buildTrainerEvaluationText(input);

  const classLabel = classType
    ? classType.charAt(0).toUpperCase() + classType.slice(1)
    : input.template || 'Evaluation';

  const row = {
    source_ref: mapping.sourceRef,
    title: `Instructor evaluation · ${input.trainer || 'Unknown'} · ${classLabel}`,
    description,
    category: 'Trainer Feedback',
    sub_category: 'Knowledge and Competence',
    priority: 'Low' as const,
    status: 'Closed',
    studio: clean(input.studio, 'Unspecified Studio'),
    trainer: input.trainer || null,
    class_type: classType || input.classType || null,
    class_date_time: null,
    member_name: null,
    member_contact: null,
    reported_by: 'Fillout form (in-app)',
    assigned_to: 'Trainer Profile',
    team: 'Training',
    tags: [
      'trainer-profile',
      'instructor-evaluation',
      'fillout-in-app',
      classLabel.toLowerCase().replace(/\s+/g, '-'),
    ],
    sentiment:
      scorePercent >= 80 ? 'Positive' : scorePercent >= 65 ? 'Neutral' : 'Negative',
    conversation_summary: [
      `Instructor evaluation submitted via in-app form for ${input.trainer || 'Unknown'} (${classLabel}).`,
      `Weighted score: ${scorePercent}% · ${performanceBand(scorePercent)}.`,
      input.focusPoints ? `Primary focus: ${input.focusPoints}` : '',
      input.goals ? `Target goal: ${input.goals}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      source_ref: mapping.sourceRef,
      source: 'fillout_in_app',
      profileOnly: true,
      fillout: {
        formId,
        submissionId: mapping.submissionId,
        classType,
        receivedAt: mapping.receivedAt,
        answers: mapping.answers,
      },
      trainerReview: mapping.record,
    },
    sla_due_at: new Date(
      Date.now() + PRIORITY_SLA_HOURS['Low'] * 60 * 60 * 1000,
    ).toISOString(),
  };

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const existing = await supabase
    .from('tickets')
    .select('id')
    .eq('source_ref', mapping.sourceRef)
    .maybeSingle();

  if (existing.data) {
    return json({
      created: false,
      duplicate: true,
      sourceRef: mapping.sourceRef,
      ticketId: existing.data.id,
    });
  }

  const { data, error } = await supabase.from('tickets').insert(row).select('*').single();
  if (error) return json({ error: error.message }, 500);

  if (data?.id) {
    await supabase.from('ticket_events').insert({
      ticket_id: data.id,
      event_type: 'trainer_evaluation_recorded',
      actor: 'Fillout in-app',
      to_value: 'Trainer Profile',
      metadata: {
        source: 'fillout_in_app',
        formId,
        submissionId: mapping.submissionId,
        classType,
      },
    });
  }

  return json({ created: true, sourceRef: mapping.sourceRef, ticketId: data?.id, ticket: data });
});
