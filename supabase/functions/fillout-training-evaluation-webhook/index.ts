import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  buildTrainerEvaluationText,
  mapFilloutTrainingEvaluation,
} from '../../../src/lib/trainer-evaluation-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fillout-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRIORITY_SLA_HOURS = {
  Critical: 2,
  High: 8,
  Medium: 24,
  Low: 72,
} as const;

const TRAINER_PROFILE_OWNER = 'Trainer Profile';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function clean(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function computeSlaDueAt(priority: keyof typeof PRIORITY_SLA_HOURS): string {
  return new Date(Date.now() + PRIORITY_SLA_HOURS[priority] * 60 * 60 * 1000).toISOString();
}

function performanceBand(scorePercent: number): string {
  if (scorePercent < 65) return 'High coaching priority';
  if (scorePercent < 80) return 'Development watch';
  return 'On-track performance';
}

function webhookAuthorized(request: Request): boolean {
  const secret = Deno.env.get('FILLOUT_WEBHOOK_SECRET');
  if (!secret) return true;
  const directSecret = request.headers.get('x-fillout-webhook-secret') || '';
  const authorization = request.headers.get('authorization') || '';
  return directSecret === secret || authorization === `Bearer ${secret}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!webhookAuthorized(request)) return json({ error: 'Unauthorized webhook request' }, 401);

  const supabaseUrl = Deno.env.get('TICKETING_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('TICKETING_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing Supabase service role configuration' }, 500);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  try {
    const mapping = mapFilloutTrainingEvaluation(payload);
    const input = mapping.input;
    const scorePercent = mapping.record.scorePercent;
    const priority = 'Low';
    const description = buildTrainerEvaluationText(input);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const recordTimestamp = mapping.record.createdAt || mapping.receivedAt;
    const row = {
      source_ref: mapping.sourceRef,
      title: `Instructor evaluation · ${input.trainer} · ${input.template}`,
      description,
      category: 'Trainer Feedback',
      sub_category: 'Knowledge and Competence',
      priority,
      status: 'Closed',
      studio: clean(input.studio, 'Unspecified Studio'),
      trainer: input.trainer,
      class_type: input.classType || null,
      class_date_time: null,
      member_name: null,
      member_contact: null,
      reported_by: 'Fillout webhook',
      assigned_to: TRAINER_PROFILE_OWNER,
      team: 'Training',
      tags: ['trainer-profile', 'instructor-evaluation', 'profile-only', 'fillout-webhook', input.template.toLowerCase()],
      sentiment: scorePercent >= 80 ? 'Positive' : scorePercent >= 65 ? 'Neutral' : 'Concern',
      conversation_summary: [
        `Instructor evaluation submitted for ${input.trainer} (${input.template}).`,
        `Weighted score: ${scorePercent}% · ${performanceBand(scorePercent)}.`,
        input.focusPoints ? `Primary focus: ${input.focusPoints}` : '',
        input.goals ? `Target goal: ${input.goals}` : '',
        'Recorded under Trainer Profiles only. No operational owner or SLA follow-up required.',
      ].filter(Boolean).join('\n'),
      metadata: {
        source_ref: mapping.sourceRef,
        source: 'fillout_training_evaluation_webhook',
        profileOnly: true,
        fillout: {
          submissionId: mapping.submissionId,
          formId: mapping.formId,
          receivedAt: mapping.receivedAt,
          answers: mapping.answers,
        },
        trainerReview: mapping.record,
        routing: {
          department: 'Training',
          assigned_to: TRAINER_PROFILE_OWNER,
          status: 'Closed',
          priority,
          profile_only: true,
          routing_source: 'fillout_training_evaluation_webhook',
        },
      },
      sla_due_at: recordTimestamp,
    };

    const existing = await supabase
      .from('tickets')
      .select('*')
      .eq('source_ref', mapping.sourceRef)
      .maybeSingle();

    if (existing.data) {
      const { data: updatedDuplicate, error: updateError } = await supabase
        .from('tickets')
        .update({
          title: row.title,
          description: row.description,
          category: row.category,
          sub_category: row.sub_category,
          priority: row.priority,
          status: row.status,
          studio: row.studio,
          trainer: row.trainer,
          class_type: row.class_type,
          assigned_to: row.assigned_to,
          team: row.team,
          tags: row.tags,
          sentiment: row.sentiment,
          conversation_summary: row.conversation_summary,
          metadata: row.metadata,
          sla_due_at: row.sla_due_at,
        })
        .eq('id', existing.data.id)
        .select('*')
        .single();

      if (updateError) return json({ error: updateError.message }, 500);
      return json({
        created: false,
        duplicate: true,
        refreshed: true,
        sourceRef: mapping.sourceRef,
        ticket: updatedDuplicate,
        trainerReview: mapping.record,
      });
    }

    if (existing.error && existing.error.code !== 'PGRST116') {
      return json({ error: existing.error.message }, 500);
    }

    const { data, error } = await supabase
      .from('tickets')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const duplicate = await supabase.from('tickets').select('*').eq('source_ref', mapping.sourceRef).maybeSingle();
        return json({
          created: false,
          duplicate: true,
          sourceRef: mapping.sourceRef,
          ticket: duplicate.data,
          trainerReview: mapping.record,
        });
      }
      return json({ error: error.message }, 500);
    }

    const ticketId = clean(data?.id);
    if (ticketId) {
      const { error: eventError } = await supabase.from('ticket_events').insert({
        ticket_id: ticketId,
        event_type: 'trainer_evaluation_recorded',
        actor: 'Fillout webhook',
        to_value: 'Trainer Profile',
        metadata: {
          source: 'fillout_training_evaluation_webhook',
          sourceRef: mapping.sourceRef,
          submissionId: mapping.submissionId,
          trainerReview: mapping.record,
        },
      });
      if (eventError) console.warn('Ticket event logging failed:', eventError.message);
    }

    return json({
      created: true,
      duplicate: false,
      sourceRef: mapping.sourceRef,
      ticket: data,
      trainerReview: mapping.record,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Fillout webhook mapping failed' }, 400);
  }
});
