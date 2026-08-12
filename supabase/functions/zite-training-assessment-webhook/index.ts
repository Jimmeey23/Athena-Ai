import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  buildTrainerReviewRecord,
  type TrainerEvaluationInput,
  type TrainerEvaluationScore,
  type TrainerReviewTemplate,
} from '../../../src/lib/trainer-evaluation-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zite-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ZiteAssessmentPayload = {
  id?: string;
  trainerName?: string;
  evaluatorName?: string;
  location?: string;
  sessionName?: string;
  classDate?: string;
  scores?: Record<string, number>;
  sections?: Record<string, { notes?: string; attachments?: unknown[] }>;
  strengths?: string;
  areasForImprovement?: string;
  coachingActionPlan?: string;
  ziteRecordId?: string;
};

const SCORE_ROWS: Array<{ key: string; category: string; weightage: number }> = [
  { key: 'preClass', category: 'Pre Class Setup & Vibe', weightage: 5 },
  { key: 'clientConnection', category: 'Client Connection', weightage: 20 },
  { key: 'uspIntegration', category: 'USP Integration + Scientific Rhetoric', weightage: 10 },
  { key: 'mapping', category: 'Mapping + Learning Styles', weightage: 10 },
  { key: 'musicalArc', category: 'Musical Arc & Playlist Programming', weightage: 15 },
  { key: 'coachingDelivery', category: 'Coaching Delivery / Voice', weightage: 15 },
  { key: 'motivation', category: 'Motivation + Inspiration', weightage: 15 },
  { key: 'timeManagement', category: 'Time Management', weightage: 5 },
  { key: 'postClass', category: 'Post Class Messaging & Vibe', weightage: 5 },
];

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

function score(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function templateFromSession(sessionName?: string): TrainerReviewTemplate {
  const text = clean(sessionName).toLowerCase();
  if (/power\s?cycle|cycle|ride|bike/.test(text)) return 'PowerCycle';
  if (/strength|fit|lab/.test(text)) return 'StrengthFit';
  return 'Barre';
}

function authorized(request: Request): boolean {
  const secret = Deno.env.get('ZITE_WEBHOOK_SECRET');
  if (!secret) return true;
  const directSecret = request.headers.get('x-zite-webhook-secret') || '';
  const authorization = request.headers.get('authorization') || '';
  return directSecret === secret || authorization === `Bearer ${secret}`;
}

function assessmentToTrainerInput(payload: ZiteAssessmentPayload): TrainerEvaluationInput {
  const scores: TrainerEvaluationScore[] = SCORE_ROWS.map((row) => ({
    category: row.category,
    weightage: row.weightage,
    score: score(payload.scores?.[row.key]),
  }));

  const sectionNotes = payload.sections
    ? Object.entries(payload.sections)
      .map(([key, section]) => `${key}: ${clean(section?.notes)}`)
      .filter((line) => !line.endsWith(':'))
      .join('\n')
    : '';

  return {
    trainer: clean(payload.trainerName, 'Unspecified Instructor'),
    template: templateFromSession(payload.sessionName),
    studio: clean(payload.location) || undefined,
    classType: clean(payload.sessionName) || undefined,
    reviewPeriod: clean(payload.classDate) || undefined,
    scores,
    feedback: [
      payload.areasForImprovement ? `Areas for improvement: ${payload.areasForImprovement}` : '',
      payload.coachingActionPlan ? `Coaching action plan: ${payload.coachingActionPlan}` : '',
      sectionNotes,
    ].filter(Boolean).join('\n\n') || 'Zite training assessment submitted without evaluator notes.',
    focusPoints: clean(payload.areasForImprovement) || undefined,
    goals: clean(payload.coachingActionPlan) || undefined,
    rawText: JSON.stringify(payload),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!authorized(request)) return json({ error: 'Unauthorized Zite webhook request' }, 401);

  const supabaseUrl = Deno.env.get('TICKETING_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('TICKETING_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Missing Supabase service role configuration' }, 500);

  let payload: ZiteAssessmentPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const ziteId = clean(payload.ziteRecordId, clean(payload.id)) || `${clean(payload.trainerName)}:${clean(payload.classDate)}:${Date.now()}`;
  const sourceRef = `zite:training-assessment:${ziteId}`;
  const input = assessmentToTrainerInput(payload);
  const record = buildTrainerReviewRecord(input, {
    id: `zite-trainer-review-${ziteId}`,
    createdAt: payload.classDate ? new Date(payload.classDate).toISOString() : new Date().toISOString(),
    source: 'zite',
    sourceRef,
  });

  const row = {
    id: record.id,
    source: 'zite',
    source_ref: sourceRef,
    trainer: record.trainer,
    template: record.template,
    studio: clean(input.studio, 'Unspecified Studio'),
    class_type: input.classType || null,
    review_period: input.reviewPeriod || null,
    scores: record.scores,
    feedback: record.feedback || null,
    focus_points: record.focusPoints || null,
    goals: record.goals || null,
    raw_text: record.rawText || null,
    total_weightage: record.totalWeightage,
    total_score: record.totalScore,
    score_percent: record.scorePercent,
    metadata: {
      source_ref: sourceRef,
      source: 'zite_training_assessment',
      zite: {
        recordId: ziteId,
        evaluatorName: payload.evaluatorName,
        sections: payload.sections,
      },
      trainerReview: record,
    },
    created_at: record.createdAt,
  };

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('trainer_reviews')
    .upsert(row, { onConflict: 'source_ref' })
    .select('*')
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ recorded: true, sourceRef, trainerReview: record, row: data });
});
