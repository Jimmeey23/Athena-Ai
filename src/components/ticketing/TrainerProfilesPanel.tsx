import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Activity,
  Award,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Gauge,
  Layers3,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Tag,
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  User,
  Flame,
  Loader2,
  RefreshCw,
  Brain,
  CheckCircle2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrainerProfile,
  TrainerReviewRecord,
  buildTrainerProfilesFromReviews,
  fetchTrainerReviewRecords,
  loadLocalTrainerReviewRecords,
  trainerReviewRecordsFromTickets,
} from '@/lib/trainer-profiles';
import { Ticket } from '@/lib/ticketing-data';
import { trainerImageUrl, trainerInitials } from '@/lib/trainer-images';
import { buildTrainerFallbackSummary } from '@/lib/trainer-summary';
import { useTickets } from './useTickets';
import { invokeTicketingFunction } from '@/lib/ticketing-functions';

function parseFlexibleDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalizedIso = trimmed.replace(/^(\d{4})\s+(\d{2})\s+(\d{2})T/, '$1-$2-$3T');
  const normalized = new Date(normalizedIso);
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function formatDate(value?: string, fallback = 'No reviews yet') {
  const date = parseFlexibleDate(value);
  if (!date) return value?.trim() || fallback;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatReviewPeriod(value?: string) {
  const date = parseFlexibleDate(value);
  if (!date) return value?.trim() || 'Review period not captured';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

const scoreTone = (score: number) => {
  if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 80) return 'text-blue-700 bg-blue-50 border-blue-100';
  if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-rose-700 bg-rose-50 border-rose-100';
};

const scoreBand = (score: number) => {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Refinement';
  if (score >= 60) return 'Coaching';
  return 'Needs Help';
};

const scoreColor = (score: number) => {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-blue-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
};

const scoreTextColor = (score: number) => {
  if (score >= 90) return 'text-emerald-700';
  if (score >= 80) return 'text-blue-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-rose-700';
};

function criterionPercent(score: number, weightage: number) {
  return weightage ? Math.max(0, Math.min(100, Math.round((score / weightage) * 100))) : 0;
}

type CriterionRow = TrainerReviewRecord['scores'][number] & { percent: number };

function reviewKey(review: TrainerReviewRecord) {
  return review.sourceRef || review.id;
}

function reviewPeriodLabel(review: TrainerReviewRecord) {
  const periodDate = parseFlexibleDate(review.reviewPeriod);
  if (periodDate) return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(periodDate);
  if (review.reviewPeriod?.trim()) return review.reviewPeriod.trim();
  const createdDate = parseFlexibleDate(review.createdAt);
  return createdDate ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(createdDate) : 'Undated Reviews';
}

function groupReviewsByPeriod(reviews: TrainerReviewRecord[]) {
  return reviews.reduce<Array<{ period: string; reviews: TrainerReviewRecord[] }>>((groups, review) => {
    const period = reviewPeriodLabel(review);
    const existing = groups.find((group) => group.period === period);
    if (existing) existing.reviews.push(review);
    else groups.push({ period, reviews: [review] });
    return groups;
  }, []);
}

const TrainerImage: React.FC<{ name: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => {
  const src = trainerImageUrl(name);
  const [imgError, setImgError] = useState(false);
  const classes = size === 'lg' ? 'h-32 w-32 text-xl' : 'h-10 w-10 text-xs';
  return (
    <div className={`${classes} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-blue-50 font-bold text-blue-700 shadow-sm`}>
      {src && !imgError
        ? <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
        : trainerInitials(name)}
    </div>
  );
};

const TrainerAISummary: React.FC<{ profile: TrainerProfile }> = ({ profile }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const sorted = [...profile.reviews].sort((a, b) => b.scorePercent - a.scorePercent);
  const topStrengths = sorted.slice(0, 2).flatMap((r) =>
    [...r.scores].sort((a, b) => b.score / b.weightage - a.score / a.weightage).slice(0, 2).map((s) => s.category)
  );
  const attentionAreas = sorted.slice(-2).flatMap((r) =>
    [...r.scores].sort((a, b) => a.score / a.weightage - b.score / b.weightage).slice(0, 2).map((s) => s.category)
  );
  const recentFeedback = profile.reviews.slice(0, 3).map((r) => r.feedback).filter(Boolean) as string[];
  const classTypes = [...new Set(profile.reviews.map((r) => r.classType).filter(Boolean))] as string[];
  const studios = [...new Set(profile.reviews.map((r) => r.studio).filter(Boolean))] as string[];
  const scoreHistory = profile.reviews.slice(0, 5).map((r) => r.scorePercent);
  const trend: 'improving' | 'declining' | 'stable' = scoreHistory.length >= 2
    ? (scoreHistory[0] > scoreHistory[scoreHistory.length - 1] ? 'improving' : scoreHistory[0] < scoreHistory[scoreHistory.length - 1] ? 'declining' : 'stable')
    : 'stable';

  const generate = async () => {
    setStatus('loading');
    setErrorMsg('');
    const fallbackSummary = buildTrainerFallbackSummary({
      trainerName: profile.trainer,
      averageScore: profile.averageScorePercent,
      reviewCount: profile.reviews.length,
      topStrengths: [...new Set(topStrengths)].slice(0, 4),
      attentionAreas: [...new Set(attentionAreas)].slice(0, 4),
      recentFeedback,
      trend,
      classTypes,
      studios,
    });
    try {
      const { data, error } = await invokeTicketingFunction<{ summary: string }>('trainer-profile-summary', {
        body: {
          trainerName: profile.trainer,
          averageScore: profile.averageScorePercent,
          reviewCount: profile.reviews.length,
          topStrengths: [...new Set(topStrengths)].slice(0, 4),
          attentionAreas: [...new Set(attentionAreas)].slice(0, 4),
          recentFeedback,
          trend,
          classTypes,
          studios,
        },
      });
      if (error || !data?.summary) throw new Error(error?.message || 'No summary returned');
      setSummary(data.summary);
      setStatus('done');
    } catch (err) {
      console.warn('[TrainerProfilesPanel] AI summary unavailable, using local fallback:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed');
      setSummary(fallbackSummary);
      setStatus('done');
    }
  };

  if (status === 'idle') {
    return (
      <button
        onClick={generate}
        type="button"
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 px-4 py-3 text-left transition hover:border-indigo-300 hover:from-indigo-50 hover:to-violet-50"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-sm transition group-hover:bg-indigo-600 group-hover:text-white">
          <Brain className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-indigo-700">Generate AI Performance Summary</div>
          <div className="mt-0.5 text-[11px] text-indigo-500">Athena analyses this profile and writes a coaching narrative</div>
        </div>
        <Sparkles className="ml-auto h-4 w-4 shrink-0 text-indigo-400 transition group-hover:text-indigo-600" />
      </button>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-indigo-700">Generating performance summary…</div>
          <div className="mt-0.5 text-[11px] text-indigo-400">Athena is analysing {profile.reviews.length} assessment{profile.reviews.length === 1 ? '' : 's'}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
          <Brain className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-rose-700">Summary generation failed</div>
          <div className="mt-0.5 text-[11px] text-rose-500">{errorMsg}</div>
        </div>
        <button onClick={generate} type="button" className="shrink-0 rounded-lg border border-rose-200 bg-card px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 shadow-[0_8px_32px_rgba(99,102,241,0.10)]">
      <div className="flex items-center justify-between gap-2 border-b border-indigo-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">AI Performance Summary</span>
          <span className="rounded-full border border-indigo-100 bg-card px-2 py-0.5 text-[10px] font-semibold text-indigo-500">Powered by Athena</span>
        </div>
        <button onClick={generate} type="button" title="Regenerate" className="flex h-6 w-6 items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${trend === 'improving' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : trend === 'declining' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-border bg-muted text-muted-foreground'}`}>
            {trend === 'improving' ? <TrendingUp className="h-3 w-3" /> : trend === 'declining' ? <TrendingDown className="h-3 w-3" /> : null}
            {trend === 'improving' ? 'Improving trend' : trend === 'declining' ? 'Needs attention' : 'Stable trend'}
          </span>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{profile.averageScorePercent}% avg</span>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">{profile.reviews.length} review{profile.reviews.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
};

export const TrainerProfilesPanel: React.FC = () => {
  const { tickets } = useTickets();
  const [localReviews, setLocalReviews] = useState<TrainerReviewRecord[]>(() => loadLocalTrainerReviewRecords());
  const [remoteReviews, setRemoteReviews] = useState<TrainerReviewRecord[]>([]);
  const [remoteError, setRemoteError] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<string>('');
  const [activeReviewKey, setActiveReviewKey] = useState<string>('');
  const profiles = useMemo<TrainerProfile[]>(
    () => buildTrainerProfilesFromReviews([
      ...remoteReviews,
      ...trainerReviewRecordsFromTickets(tickets),
      ...localReviews,
    ]),
    [localReviews, remoteReviews, tickets]
  );

  useEffect(() => {
    const refresh = () => setLocalReviews(loadLocalTrainerReviewRecords());
    window.addEventListener('p57-trainer-profiles-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('p57-trainer-profiles-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const refreshRemoteReviews = React.useCallback(async () => {
    setRemoteLoading(true);
    setRemoteError('');
    try {
      setRemoteReviews(await fetchTrainerReviewRecords());
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : 'Unable to load trainer reviews');
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRemoteReviews();
  }, [refreshRemoteReviews]);

  useEffect(() => {
    if (!selectedTrainer && profiles[0]) setSelectedTrainer(profiles[0].trainer);
  }, [profiles, selectedTrainer]);

  useEffect(() => {
    setActiveReviewKey('');
  }, [selectedTrainer]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.trainer === selectedTrainer) || profiles[0],
    [profiles, selectedTrainer]
  );
  const reviewedProfiles = profiles.filter((profile) => profile.reviews.length > 0);
  const ticketBySourceRef = useMemo(
    () => new Map(tickets.filter((ticket) => ticket.sourceRef).map((ticket) => [ticket.sourceRef, ticket])),
    [tickets]
  );

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background via-background/60 to-transparent" />
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex-shrink-0 border-b border-border/80 bg-card/90 px-5 py-4 shadow-[0_10px_36px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <GraduationCap className="h-4 w-4" />
                Instructor Intelligence
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Trainer Profiles</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Assessment history, score trends, coaching focus, and criterion-level performance by instructor.</p>
              {remoteError && (
                <p className="mt-1 text-xs font-medium text-rose-600">Trainer review load failed: {remoteError}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshRemoteReviews()}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-blue-200 hover:text-blue-600"
                title="Refresh trainer reviews"
              >
                {remoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
              <div className="grid grid-cols-3 gap-2">
              <Metric label="Profiles" value={profiles.length} />
              <Metric label="Reviewed" value={reviewedProfiles.length} />
              <Metric
                label="Avg Score"
                value={reviewedProfiles.length ? `${Math.round(reviewedProfiles.reduce((sum, profile) => sum + profile.averageScorePercent, 0) / reviewedProfiles.length)}%` : '0%'}
              />
              </div>
            </div>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
              <GraduationCap className="mx-auto h-9 w-9 text-blue-500" />
              <div className="mt-3 text-sm font-semibold text-foreground">No trainer profiles yet</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Turn on Instructor evaluation in Athena, choose a Barre, PowerCycle, or Strength/Fit template, and create the first evaluation ticket.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
            <aside className="min-h-0 overflow-y-auto border-r border-border bg-card/72 p-4">
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <button
                    key={profile.trainer}
                    type="button"
                    onClick={() => setSelectedTrainer(profile.trainer)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedProfile?.trainer === profile.trainer
                        ? 'border-blue-200 bg-blue-50 shadow-[0_16px_42px_rgba(37,99,235,0.12)]'
                        : 'border-border bg-card hover:border-blue-100 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <TrainerImage name={profile.trainer} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{profile.trainer}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{profile.reviews.length} review{profile.reviews.length === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${scoreTone(profile.averageScorePercent)}`}>
                        {profile.averageScorePercent}%
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Latest: {formatDate(profile.latestReviewAt)}</div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto p-5">
              {selectedProfile && (
                <TrainerProfileDetail
                  profile={selectedProfile}
                  ticketBySourceRef={ticketBySourceRef}
                  activeReviewKey={activeReviewKey}
                  onSelectReview={setActiveReviewKey}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="min-w-24 rounded-2xl border border-border bg-card px-3 py-2.5 text-right shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
    <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
  </div>
);

const TrainerProfileDetail: React.FC<{
  profile: TrainerProfile;
  ticketBySourceRef: Map<string, Ticket>;
  activeReviewKey: string;
  onSelectReview: (key: string) => void;
}> = ({ profile, ticketBySourceRef, activeReviewKey, onSelectReview }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);
  const [mounted, setMounted] = useState(false);
  const latest = profile.reviews[0];
  const activeReview = profile.reviews.find((review) => reviewKey(review) === activeReviewKey) || latest;
  const groupedReviews = groupReviewsByPeriod(profile.reviews);
  const highScore = profile.reviews.length ? Math.max(...profile.reviews.map((review) => review.scorePercent)) : 0;
  const activeRows = activeReview?.scores.map((item) => ({
    ...item,
    percent: criterionPercent(item.score, item.weightage),
  })) || [];
  const chartRows = activeRows.map((item) => ({
    criterion: item.category.length > 18 ? `${item.category.slice(0, 18)}...` : item.category,
    fullCriterion: item.category,
    percent: item.percent,
    score: item.score,
    weightage: item.weightage,
  }));
  const trendRows = profile.reviews
    .slice(0, 10)
    .reverse()
    .map((review, index) => ({
      label: `${index + 1}`,
      score: review.scorePercent,
      date: formatReviewPeriod(review.reviewPeriod || review.createdAt),
    }));

  useEffect(() => {
    setPreviewTicket(null);
  }, [profile.trainer]);

  useEffect(() => {
    setMounted(false);
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, [profile.trainer, activeReviewKey]);

  useEffect(() => {
    if (!previewTicket) return;
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [previewTicket]);

  const selectHistoryItem = (key: string, ticket?: Ticket) => {
    onSelectReview(key);
    if (ticket) setPreviewTicket(ticket);
  };

  return (
    <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-5">
      <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-[0_28px_100px_rgba(15,23,42,0.10)]">
        <div className="border-b border-border bg-gradient-to-r from-white via-white to-blue-50/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-[24px] border border-blue-100 bg-blue-50/80 p-1.5 shadow-[0_18px_38px_rgba(37,99,235,0.10)]">
                <TrainerImage name={profile.trainer} size="lg" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">{profile.trainer}</h3>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                    {profile.reviews.length} assessment{profile.reviews.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Latest review: {formatDate(profile.latestReviewAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ProfilePill icon={<ClipboardList className="h-3.5 w-3.5" />} label={`${profile.reviews.length} assessment${profile.reviews.length === 1 ? '' : 's'}`} />
                  <ProfilePill icon={<Award className="h-3.5 w-3.5" />} label={`Best score ${highScore}%`} />
                  {activeReview?.studio && <ProfilePill icon={<MapPin className="h-3.5 w-3.5" />} label={activeReview.studio} />}
                  {activeReview?.classType && <ProfilePill icon={<Activity className="h-3.5 w-3.5" />} label={activeReview.classType} />}
                </div>
              </div>
            </div>
            <div className={`min-w-40 rounded-3xl border px-5 py-4 text-right shadow-[0_18px_42px_rgba(37,99,235,0.10)] ${scoreTone(profile.averageScorePercent)}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]">Profile average</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight">{profile.averageScorePercent}%</div>
              <div className="mt-1 text-[11px] font-bold">{scoreBand(profile.averageScorePercent)}</div>
            </div>
          </div>
        </div>

        <div className="border-b border-border px-5 py-3">
          <TrainerAISummary profile={profile} />
        </div>

        {activeReview && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                {activeReviewKey ? 'Selected Assessment Drilldown' : 'Latest Weighted Review'}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                {formatReviewPeriod(activeReview.reviewPeriod)}
              </div>
            </div>

            <DrilldownAnalytics review={activeReview} profile={profile} rows={activeRows} mounted={mounted} />

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border bg-muted/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Radar
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={chartRows}>
                      <PolarGrid stroke="#dbeafe" />
                      <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Radar dataKey="percent" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.32} />
                      <Tooltip formatter={(value, _name, props) => [`${value}%`, props.payload.fullCriterion]} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Criterion Breakdown
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 18, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis type="category" dataKey="criterion" width={118} tick={{ fontSize: 10, fill: '#475569' }} />
                      <Tooltip formatter={(value, _name, props) => [`${value}%`, `${props.payload.fullCriterion}: ${props.payload.score}/${props.payload.weightage}`]} />
                      <Bar dataKey="percent" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <EvaluatorFeedbackBrief value={activeReview.feedback} />
              <InsightBlock title="Focus Points" value={activeReview.focusPoints} icon={<Target className="h-4 w-4 text-blue-600" />} />
              <InsightBlock title="Goals" value={activeReview.goals} />
            </div>

            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-bold">Criterion</th>
                    <th className="px-3 py-2 text-right font-bold">Score</th>
                    <th className="px-3 py-2 text-right font-bold">% of Max</th>
                    <th className="px-3 py-2 font-bold">Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {activeRows.map((item) => {
                    const percent = item.percent;
                    return (
                      <tr key={item.category}>
                        <td className="px-3 py-2 font-medium text-foreground">{item.category}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{item.score.toFixed(1)} / {item.weightage}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${scoreColor(percent)}`} style={{ width: `${percent}%` }} />
                            </div>
                            <span className="w-9 text-right font-bold text-foreground">{percent}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${scoreTone(percent)}`}>{scoreBand(percent)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {trendRows.length > 1 && (
              <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Recent Assessment Trend</div>
                <div className="flex items-end gap-1">
                  {trendRows.map((row) => (
                    <div key={`${row.label}-${row.date}`} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full items-end rounded bg-muted">
                        <div className={`w-full rounded-t ${scoreColor(row.score)}`} style={{ height: `${row.score}%` }} />
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground">{row.score}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!latest && (
          <div className="m-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm text-blue-900">
            No evaluation has been saved for this instructor yet. Their profile is ready and will populate automatically when an Athena instructor evaluation is published.
          </div>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-[0_28px_100px_rgba(15,23,42,0.08)]">
        <div className="border-b border-border bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Historical Tickets</div>
              <div className="mt-1 text-sm font-semibold text-foreground">Assessment History</div>
            </div>
            <div className="text-xs text-muted-foreground">Historic and live tickets stay styled with the same drilldown structure.</div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {groupedReviews.map((group) => (
            <div key={group.period} className="px-4 py-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.period}</div>
                <div className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  {group.reviews.length} assessment{group.reviews.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="space-y-3">
                {group.reviews.map((review) => {
                  const ticket = review.sourceRef ? ticketBySourceRef.get(review.sourceRef) : undefined;
                  const key = reviewKey(review);
                  const selected = activeReview ? reviewKey(activeReview) === key : false;
                  return (
                    <div key={key} className={`overflow-hidden rounded-[22px] border transition ${selected ? 'border-blue-300 bg-blue-50/70 shadow-[0_14px_38px_rgba(37,99,235,0.12)]' : 'border-border bg-card hover:border-blue-200 hover:shadow-[0_12px_34px_rgba(15,23,42,0.06)]'}`}>
                      <button
                        type="button"
                        onClick={() => selectHistoryItem(key, ticket)}
                        className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/80 lg:grid-cols-[210px_minmax(0,1fr)_128px]"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                            {ticket?.id || review.template}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(review.createdAt)}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">Period: {formatReviewPeriod(review.reviewPeriod)}</div>
                          {review.studio && <div className="mt-1 text-[11px] text-muted-foreground">{review.studio}</div>}
                          {review.classType && <div className="mt-1 text-[11px] text-muted-foreground">{review.classType}</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{review.template} Evaluation</div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{review.feedback}</p>
                          {review.focusPoints && <p className="mt-2 text-[11px] font-medium text-blue-700">Focus: {review.focusPoints}</p>}
                        </div>
                        <div className="flex items-start justify-between gap-2 text-right lg:block">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${scoreTone(review.scorePercent)}`}>
                            {review.scorePercent}%
                          </span>
                          <div className={`mt-2 text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? 'text-blue-600' : 'text-muted-foreground'}`}>
                            {selected ? 'Viewing' : 'View Drilldown'}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedReviews.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No review history yet.
            </div>
          )}
        </div>
      </div>

      {previewTicket && (
        <TicketPreviewReport ticket={previewTicket} previewRef={previewRef} />
      )}
    </div>
  );
};

const ProfilePill: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm">
    <span className="shrink-0 text-blue-600">{icon}</span>
    <span className="truncate">{label}</span>
  </span>
);

const SECTION_ACCENT: Record<string, string> = {
  'evaluation snapshot':      'border-blue-200 bg-blue-50/60 text-blue-700',
  'weighted scorecard':       'border-violet-200 bg-violet-50/60 text-violet-700',
  'demonstrated strengths':   'border-emerald-200 bg-emerald-50/60 text-emerald-700',
  'coaching attention areas': 'border-amber-200 bg-amber-50/60 text-amber-700',
  'evaluator / training notes': 'border-indigo-200 bg-indigo-50/60 text-indigo-700',
  'coaching plan and follow-up': 'border-cyan-200 bg-cyan-50/60 text-cyan-700',
  'routing context':          'border-border bg-muted text-muted-foreground',
};

const SECTION_BULLET_COLOR: Record<string, string> = {
  'demonstrated strengths':   'bg-emerald-500',
  'coaching attention areas': 'bg-amber-500',
  'coaching plan and follow-up': 'bg-cyan-500',
};

const TicketPreviewReport: React.FC<{ ticket: Ticket; previewRef: React.RefObject<HTMLDivElement> }> = ({ ticket, previewRef }) => {
  const sections = parseTrainerReportSections(ticket.description);
  const narrativeSummary = sections[0]?.body[0] || ticket.description.split('\n').find((line) => line.trim()) || 'No evaluation data captured.';

  const sentimentColor = ticket.sentiment === 'Positive'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : ticket.sentiment === 'Concern'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-border bg-muted text-muted-foreground';

  return (
    <div ref={previewRef} className="mt-6 overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_32px_100px_rgba(15,23,42,0.12)]">
      {/* Header band */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.25),_transparent_55%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
              <FileText className="h-3.5 w-3.5" />
              Evaluation Report
            </div>
            <h4 className="mt-2 text-xl font-semibold leading-snug text-white">{ticket.title}</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur-sm">
                #{ticket.id}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sentimentColor}`}>
                {ticket.sentiment || ticket.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                {ticket.priority} priority
              </span>
            </div>
          </div>
          <div className="grid gap-2 text-right">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-right backdrop-blur-sm">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Created</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatDate(ticket.createdAt, '–')}</div>
            </div>
            {(ticket.trainer || ticket.memberName) && (
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-right backdrop-blur-sm">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Instructor</div>
                <div className="mt-1 text-sm font-semibold text-white">{ticket.trainer || ticket.memberName}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left: sections */}
        <div className="space-y-0 divide-y divide-border">
          {sections.map((section) => {
            const accentKey = section.title.toLowerCase();
            const accentClass = SECTION_ACCENT[accentKey] || 'border-border bg-muted/50 text-muted-foreground';
            const bulletColor = SECTION_BULLET_COLOR[accentKey] || 'bg-blue-500';
            return (
              <div key={section.title} className="px-5 py-4">
                <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${accentClass}`}>
                  {section.title}
                </div>
                {section.body.length > 0 && (
                  <div className="mb-2 space-y-1.5 text-sm leading-relaxed text-foreground">
                    {section.body.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}
                {section.bullets.length > 0 && (
                  <ul className="space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${bulletColor}`} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {sections.length === 0 && (
            <div className="px-5 py-4 text-sm leading-relaxed text-foreground">{narrativeSummary}</div>
          )}

          {/* Tags row */}
          {ticket.tags.length > 0 && (
            <div className="px-5 py-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Context Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">#{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: fact sidebar */}
        <div className="border-l border-border bg-muted/50 p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Ticket Details</div>
          <div className="space-y-2">
            <TicketPreviewFact icon={<Tag className="h-3.5 w-3.5" />} label="Classification" value={`${ticket.category} / ${ticket.subCategory}`} />
            <TicketPreviewFact icon={<MapPin className="h-3.5 w-3.5" />} label="Studio" value={ticket.studio} />
            <TicketPreviewFact icon={<User className="h-3.5 w-3.5" />} label="Owner" value={ticket.assignedTo} />
            <TicketPreviewFact icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Team" value={ticket.team} />
            {ticket.trainer && <TicketPreviewFact icon={<GraduationCap className="h-3.5 w-3.5" />} label="Instructor" value={ticket.trainer} />}
            {ticket.classType && <TicketPreviewFact icon={<Activity className="h-3.5 w-3.5" />} label="Session type" value={ticket.classType} />}
            {ticket.classDateTime && <TicketPreviewFact icon={<CalendarDays className="h-3.5 w-3.5" />} label="Session time" value={formatDate(ticket.classDateTime, '–')} />}
            {ticket.memberName && <TicketPreviewFact icon={<User className="h-3.5 w-3.5" />} label="Member" value={ticket.memberName} />}
            {ticket.sentiment && <TicketPreviewFact icon={<MessageSquare className="h-3.5 w-3.5" />} label="Sentiment" value={ticket.sentiment} />}
            <TicketPreviewFact icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(ticket.createdAt, '–')} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TicketPreviewFact: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex min-w-0 gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm">
    <span className="mt-0.5 shrink-0 text-blue-600">{icon}</span>
    <span className="min-w-0">
      <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="mt-0.5 block truncate font-semibold text-foreground" title={value}>{value}</span>
    </span>
  </div>
);

interface ParsedTrainerReportSection {
  title: string;
  body: string[];
  bullets: string[];
}

const TRAINER_REPORT_SECTION_TITLES = new Set([
  'evaluation snapshot',
  'weighted scorecard',
  'demonstrated strengths',
  'coaching attention areas',
  'evaluator / training notes',
  'evaluator/training notes',
  'coaching plan and follow-up',
  'coaching plan & follow-up',
  'coaching plan',
  'routing context',
  'instructor evaluation brief',
  'narrative',
  'performance summary',
  'key observations',
  'action items',
]);

function parseTrainerReportSections(text: string): ParsedTrainerReportSection[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sections: ParsedTrainerReportSection[] = [];
  let current: ParsedTrainerReportSection | null = null;

  const pushCurrent = () => {
    if (current && (current.body.length > 0 || current.bullets.length > 0)) sections.push(current);
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*•]\s*(.+)$/);
    if (bulletMatch) {
      if (!current) current = { title: 'Details', body: [], bullets: [] };
      current.bullets.push(bulletMatch[1].trim());
      continue;
    }

    const normalized = line.toLowerCase();
    if (TRAINER_REPORT_SECTION_TITLES.has(normalized)) {
      pushCurrent();
      current = { title: line, body: [], bullets: [] };
      continue;
    }

    if (!current) {
      current = { title: 'Overview', body: [], bullets: [] };
    }
    current.body.push(line);
  }

  pushCurrent();
  return sections;
}

const DrilldownAnalytics: React.FC<{ review: TrainerReviewRecord; profile: TrainerProfile; rows: CriterionRow[]; mounted: boolean }> = ({ review, profile, rows, mounted }) => {
  const sortedRows = [...rows].sort((a, b) => b.percent - a.percent);
  const strengths = sortedRows.filter((item) => item.percent >= 80).slice(0, 4);
  const attention = [...rows].sort((a, b) => a.percent - b.percent).slice(0, 4);
  const delta = review.scorePercent - profile.averageScorePercent;
  const weightedRisk = rows
    .filter((item) => item.percent < 70)
    .reduce((sum, item) => sum + item.weightage, 0);
  const scoreDensity = review.totalWeightage ? Math.round((review.totalScore / review.totalWeightage) * 100) : review.scorePercent;
  const weightedAverage = review.totalWeightage ? review.totalScore / review.totalWeightage : 0;
  const topCriterion = sortedRows[0];
  const lowCriterion = [...rows].sort((a, b) => a.percent - b.percent)[0];
  const trendDirection = delta > 0 ? 'Improving' : delta < 0 ? 'Under mean' : 'At mean';

  const keyMetrics = [
    {
      label: 'Selected Score',
      value: `${review.scorePercent}%`,
      helper: scoreBand(review.scorePercent),
      accent: scoreTextColor(review.scorePercent),
      icon: <Gauge className="h-4 w-4" />,
      fill: review.scorePercent,
    },
    {
      label: 'Vs Profile Avg',
      value: `${delta > 0 ? '+' : ''}${delta}%`,
      helper: `${profile.averageScorePercent}% profile mean`,
      accent: delta >= 0 ? 'text-emerald-700' : 'text-rose-700',
      icon: <ArrowUpRight className="h-4 w-4" />,
      fill: Math.abs(delta) * 4,
    },
    {
      label: 'Weighted Yield',
      value: `${scoreDensity}%`,
      helper: `${review.totalScore.toFixed(1)} / ${review.totalWeightage}`,
      accent: 'text-blue-700',
      icon: <Layers3 className="h-4 w-4" />,
      fill: scoreDensity,
    },
    {
      label: 'Risk Weight',
      value: `${weightedRisk}`,
      helper: 'points below 70%',
      accent: weightedRisk ? 'text-amber-700' : 'text-emerald-700',
      icon: <Flame className="h-4 w-4" />,
      fill: weightedRisk,
    },
    {
      label: 'Top Criterion',
      value: topCriterion ? `${topCriterion.percent}%` : '0%',
      helper: topCriterion ? topCriterion.category : 'No criteria captured',
      accent: 'text-foreground',
      icon: <Sparkles className="h-4 w-4" />,
      fill: topCriterion?.percent || 0,
    },
    {
      label: 'Lowest Criterion',
      value: lowCriterion ? `${lowCriterion.percent}%` : '0%',
      helper: lowCriterion ? lowCriterion.category : 'No criteria captured',
      accent: 'text-foreground',
      icon: <Target className="h-4 w-4" />,
      fill: lowCriterion?.percent || 0,
    },
  ];

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-3">
        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {keyMetrics.map((metric, index) => (
            <DrillMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
              accent={metric.accent}
              icon={metric.icon}
              delay={index}
              fill={metric.fill}
              mounted={mounted}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailBanner
            icon={<BarChart3 className="h-4 w-4" />}
            title="Performance Lens"
            value={trendDirection}
            text={`Weighted yield ${weightedAverage.toFixed(1)} and review delta ${delta > 0 ? '+' : ''}${delta}% from profile mean.`}
          />
          <DetailBanner
            icon={<ClipboardList className="h-4 w-4" />}
            title="Assessment Count"
            value={`${profile.reviews.length} reviews`}
            text={`Latest review on ${formatDate(profile.latestReviewAt, 'Not captured')}.`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <TechnicalList
          title="Strongest Signals"
          icon={<Sparkles className="h-4 w-4 text-blue-600" />}
          items={strengths.map((item) => `${item.category}: ${item.percent}% (${item.score.toFixed(1)}/${item.weightage})`)}
          fallback="No criterion reached the strength threshold."
        />
        <TechnicalList
          title="Coaching Attention"
          icon={<Target className="h-4 w-4 text-blue-600" />}
          items={attention.map((item) => `${item.category}: ${item.percent}% (${item.score.toFixed(1)}/${item.weightage})`)}
          fallback="No attention areas captured."
        />
      </div>
    </div>
  );
};

const DrillMetric: React.FC<{ label: string; value: string; helper: string; accent: string; icon: React.ReactNode; delay: number; fill: number; mounted: boolean }> = ({ label, value, helper, accent, icon, delay, fill, mounted }) => (
  <div
    className={`group relative h-full overflow-hidden rounded-2xl border border-border bg-card px-3.5 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.05)] transition-all duration-700 ease-out ${
      mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    }`}
    style={{ transitionDelay: `${delay * 70}ms` }}
  >
    <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
      <div className="h-full rounded-r-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 transition-all duration-700 ease-out" style={{ width: mounted ? `${Math.max(8, Math.min(100, fill))}%` : '0%' }} />
    </div>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="text-blue-600">{icon}</span>
          {label}
        </div>
        <div className={`mt-2 text-2xl font-semibold leading-none ${accent}`}>{value}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-500" />
    </div>
    <div className="mt-2 text-[11px] font-semibold text-muted-foreground">{helper}</div>
  </div>
);

const TechnicalList: React.FC<{ title: string; icon?: React.ReactNode; items: string[]; fallback: string }> = ({ title, icon, items, fallback }) => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-[0_18px_36px_rgba(15,23,42,0.05)]">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
      {icon}
      {title}
    </div>
    <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
      {(items.length ? items : [fallback]).map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const DetailBanner: React.FC<{ icon: React.ReactNode; title: string; value: string; text: string }> = ({ icon, title, value, text }) => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-[0_18px_36px_rgba(15,23,42,0.05)]">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      <span className="text-blue-600">{icon}</span>
      {title}
    </div>
    <div className="mt-2 flex items-center gap-2">
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text}</p>
  </div>
);

function richFeedbackItems(value?: string): Array<{ label?: string; text: string }> {
  const raw = value?.trim();
  if (!raw) return [{ text: 'No detail captured.' }];
  return raw
    .split(/\n+|(?<=\.)\s+(?=[A-Z])/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{3,42}):\s*(.+)$/);
      return match ? { label: match[1].trim(), text: match[2].trim() } : { text: line };
    });
}

const RichFeedbackList: React.FC<{ value?: string }> = ({ value }) => (
  <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
    {richFeedbackItems(value).map((item, index) => (
      <li key={`${item.label || item.text}-${index}`} className="flex gap-2">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        <span>
          {item.label && <span className="font-semibold text-foreground">{item.label}: </span>}
          {item.text}
        </span>
      </li>
    ))}
  </ul>
);

const EvaluatorFeedbackBrief: React.FC<{ value?: string }> = ({ value }) => {
  const items = richFeedbackItems(value);
  const summary = items[0]?.text || 'No detail captured.';
  const detailItems = items.length > 1 ? items.slice(1) : items;
  const splitIndex = Math.ceil(detailItems.length / 2);
  const columns = [detailItems.slice(0, splitIndex), detailItems.slice(splitIndex)].filter((column) => column.length > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Evaluator Feedback</div>
          <div className="mt-1 text-sm font-semibold text-foreground">Qualitative coaching readout</div>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          {items.length} note{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-xl border border-border bg-muted p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Narrative Summary</div>
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <ul key={columnIndex} className="space-y-2">
              {column.map((item, index) => (
                <li key={`${item.label || item.text}-${columnIndex}-${index}`} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>
                      {item.label && <span className="font-semibold text-foreground">{item.label}: </span>}
                      {item.text}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
};

const InsightBlock: React.FC<{ title: string; value?: string; icon?: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="rounded-xl border border-border bg-muted p-3">
    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground">
      {icon}
      {title}
    </div>
    {title.toLowerCase().includes('feedback') || title.toLowerCase().includes('evaluation')
      ? <RichFeedbackList value={value} />
      : <p className="text-xs leading-relaxed text-muted-foreground">{value || 'No detail captured.'}</p>}
  </div>
);
