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
  GitCompareArrows,
  Moon,
  Printer,
  Sun,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const scoreTextColorDark = (score: number) => {
  if (score >= 90) return 'text-emerald-300';
  if (score >= 80) return 'text-cyan-300';
  if (score >= 70) return 'text-amber-300';
  return 'text-rose-300';
};

const criterionBand = (percent: number) => (percent >= 70 ? 'Exceptional' : 'Needs Help');

type KpiTone = 'blue' | 'green' | 'cyan' | 'rose';

const KPI_TONE_VARS: Record<KpiTone, string> = {
  blue: 'var(--report-blue)',
  green: 'var(--report-emerald)',
  cyan: 'var(--report-cyan-accent)',
  rose: 'var(--report-rose)',
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
  const reviewCount = profiles.reduce((sum, profile) => sum + profile.reviews.length, 0);
  const averageReviewScore = reviewCount
    ? Math.round(
      profiles.reduce(
        (sum, profile) => sum + profile.reviews.reduce((profileSum, review) => profileSum + review.scorePercent, 0),
        0
      ) / reviewCount
    )
    : 0;
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
              <Metric label="Reviews" value={reviewCount} />
              <Metric
                label="Avg Score"
                value={reviewCount ? `${averageReviewScore}%` : '0%'}
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
  const [reportTheme, setReportTheme] = useState<'light' | 'dark'>('light');
  const [rubricFilter, setRubricFilter] = useState<'all' | 'exceptional' | 'needs-help'>('all');
  const [rubricSearch, setRubricSearch] = useState('');
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
      key: reviewKey(review),
      label: `${index + 1}`,
      score: review.scorePercent,
      date: formatReviewPeriod(review.reviewPeriod || review.createdAt),
    }));
  const sortedRows = [...activeRows].sort((a, b) => b.percent - a.percent);
  const topCriterion = sortedRows[0];
  const lowCriterion = [...activeRows].sort((a, b) => a.percent - b.percent)[0];
  const riskWeight = activeRows.filter((item) => item.percent < 70).reduce((sum, item) => sum + item.weightage, 0);
  const selectedDelta = activeReview ? activeReview.scorePercent - profile.averageScorePercent : 0;
  const executiveStatus = profile.averageScorePercent >= 80
    ? 'Performance Lead'
    : profile.averageScorePercent >= 70
      ? 'Refinement Benchmark'
      : 'Coaching Priority';
  const marqueeItems = [
    { chip: 'ACTIVE PROFILE', tone: 'success', text: `${profile.trainer} · ${profile.reviews.length} assessments` },
    { chip: 'PROFILE MEAN', tone: 'ai', text: `${profile.averageScorePercent}% · ${scoreBand(profile.averageScorePercent)}` },
    { chip: 'SELECTED AUDIT', tone: 'success', text: activeReview ? `${activeReview.scorePercent}% · ${formatReviewPeriod(activeReview.reviewPeriod)}` : 'No selected audit' },
    { chip: 'COACHING RISK', tone: riskWeight ? 'warn' : 'success', text: `${riskWeight} weighted points below 70%` },
    { chip: 'TOP SIGNAL', tone: 'success', text: topCriterion ? `${topCriterion.category} · ${topCriterion.percent}%` : 'No criteria captured' },
    { chip: 'ATTENTION', tone: lowCriterion && lowCriterion.percent < 70 ? 'warn' : 'amber', text: lowCriterion ? `${lowCriterion.category} · ${lowCriterion.percent}%` : 'No attention area' },
  ];

  useEffect(() => {
    setPreviewTicket(null);
  }, [profile.trainer]);

  useEffect(() => {
    setMounted(false);
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, [profile.trainer, activeReviewKey]);

  useEffect(() => {
    setRubricFilter('all');
    setRubricSearch('');
  }, [profile.trainer, activeReviewKey]);

  const filteredRubricRows = activeRows.filter((item) => {
    if (rubricFilter === 'exceptional' && criterionBand(item.percent) !== 'Exceptional') return false;
    if (rubricFilter === 'needs-help' && criterionBand(item.percent) !== 'Needs Help') return false;
    if (rubricSearch.trim() && !item.category.toLowerCase().includes(rubricSearch.trim().toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (!previewTicket) return;
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [previewTicket]);

  const selectHistoryItem = (key: string, ticket?: Ticket) => {
    onSelectReview(key);
    if (ticket) setPreviewTicket(ticket);
  };

  return (
    <div className={`trainer-report-os ${reportTheme} mx-auto max-w-[1560px] px-4 py-5 sm:px-5`}>
      <TrainerReportStyle />
      <div className="report-top-nav">
        <div className="report-brand-group">
          <div className="report-brand-logo">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="report-brand-title">
              Athena Performance OS
              <span className="report-brand-badge">{activeReview?.template || 'Trainer'} v2.4</span>
            </div>
            <div className="report-brand-subtitle">Executive Instructor Talent Matrix & Coaching Intelligence Engine</div>
          </div>
        </div>
        <div className="report-top-controls">
          <button type="button" className="report-btn report-btn-secondary" onClick={() => latest && onSelectReview(reviewKey(latest))} disabled={!latest}>
            <GitCompareArrows className="h-4 w-4" />
            Latest Audit
          </button>
          <button type="button" className="report-btn report-btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            className="report-icon-btn"
            onClick={() => setReportTheme((theme) => theme === 'light' ? 'dark' : 'light')}
            title="Toggle report light/dark mode"
            aria-label="Toggle report light/dark mode"
          >
            {reportTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="report-marquee">
        <div className="report-marquee-tag">
          <Activity className="h-3 w-3" />
          Live Intelligence
        </div>
        <div className="report-marquee-window">
          <div className="report-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <div key={`${item.chip}-${index}`} className="report-marquee-item">
                <span className={`report-marquee-chip report-chip-${item.tone}`}>{item.chip}</span>
                <b>{item.text}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="report-shell overflow-hidden rounded-[28px] border border-slate-800/80 bg-slate-950 text-slate-100 shadow-[0_28px_100px_rgba(2,6,23,0.45)]">
        <div className="report-profile-hero relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.22),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_48%,_#111827)] p-5">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-[24px] border border-cyan-300/20 bg-white/8 p-1.5 shadow-[0_0_32px_rgba(6,182,212,0.16)]">
                <TrainerImage name={profile.trainer} size="lg" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold tracking-tight text-white">{profile.trainer}</h3>
                  <span className="report-badge-count rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
                    {profile.reviews.length} assessment{profile.reviews.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Executive performance report · latest review {formatDate(profile.latestReviewAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ProfilePill icon={<ClipboardList className="h-3.5 w-3.5" />} label={`${profile.reviews.length} assessment${profile.reviews.length === 1 ? '' : 's'}`} />
                  <ProfilePill icon={<Award className="h-3.5 w-3.5" />} label={`Best score ${highScore}%`} />
                  {activeReview?.studio && <ProfilePill icon={<MapPin className="h-3.5 w-3.5" />} label={activeReview.studio} />}
                  {activeReview?.classType && <ProfilePill icon={<Activity className="h-3.5 w-3.5" />} label={activeReview.classType} />}
                </div>
              </div>
            </div>
            <div className="report-average-box min-w-40 rounded-3xl border border-white/10 bg-white/10 px-5 py-4 text-right shadow-[0_18px_42px_rgba(6,182,212,0.12)] backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Profile average</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight text-white">{profile.averageScorePercent}%</div>
              <div className={`mt-1 text-[11px] font-bold ${scoreTextColorDark(profile.averageScorePercent)}`}>{executiveStatus}</div>
            </div>
          </div>
        </div>

        <div className="report-ai-banner border-b border-white/10 bg-slate-900/70 px-5 py-3">
          <TrainerAISummary profile={profile} />
        </div>

        {activeReview && (
          <div className="space-y-5 bg-[radial-gradient(circle_at_90%_8%,_rgba(139,92,246,0.13),_transparent_30%),linear-gradient(180deg,_#020617,_#0f172a)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="report-text-strong flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-cyan-300" />
                {activeReviewKey ? 'Selected Assessment Drilldown' : 'Latest Weighted Review'}
              </div>
              <div className="report-active-audit-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                <span className="report-pulse-dot" />
                Audit: <b>{formatReviewPeriod(activeReview.reviewPeriod)}</b> ({activeReview.scorePercent}%)
              </div>
            </div>

            <DrilldownAnalytics review={activeReview} profile={profile} rows={activeRows} mounted={mounted} />

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="report-card p-4">
                <div className="report-card-eyebrow mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-cyan-300" />
                  Capability Radar
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={chartRows.map((row) => ({ ...row, benchmark: profile.averageScorePercent }))}>
                      <PolarGrid stroke="var(--report-radar-grid)" />
                      <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: 'var(--report-dim)' }} />
                      <Radar dataKey="benchmark" stroke="var(--report-dim)" strokeDasharray="4 4" fill="var(--report-dim)" fillOpacity={0.04} isAnimationActive={false} />
                      <Radar dataKey="percent" stroke="var(--report-cyan-accent)" fill="var(--report-cyan)" fillOpacity={0.32} />
                      <Tooltip formatter={(value, _name, props) => [`${value}%`, props.payload.fullCriterion]} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="report-chart-legend mt-2 flex justify-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="report-legend-dot" style={{ background: 'var(--report-cyan-accent)' }} /> Active Audit Polygon</span>
                  <span className="flex items-center gap-1.5"><span className="report-legend-dot" style={{ background: 'var(--report-dim)' }} /> Profile Benchmark ({profile.averageScorePercent}%)</span>
                </div>
              </div>

              <div className="report-card p-4">
                <div className="report-card-eyebrow mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-300" />
                  Criterion Breakdown
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 18, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--report-radar-grid)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--report-dim)' }} />
                      <YAxis type="category" dataKey="criterion" width={118} tick={{ fontSize: 10, fill: 'var(--report-muted)' }} />
                      <Tooltip formatter={(value, _name, props) => [`${value}%`, `${props.payload.fullCriterion}: ${props.payload.score}/${props.payload.weightage}`]} />
                      <Bar dataKey="percent" radius={[0, 6, 6, 0]}>
                        {chartRows.map((row) => (
                          <Cell key={row.fullCriterion} fill={row.percent >= 70 ? 'var(--report-cyan-accent)' : 'var(--report-rose)'} />
                        ))}
                      </Bar>
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

            <div>
              <div className="report-table-controls mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="report-filter-chips flex items-center gap-1.5">
                  <button type="button" className={`report-filter-chip ${rubricFilter === 'all' ? 'active' : ''}`} onClick={() => setRubricFilter('all')}>
                    All Criteria ({activeRows.length})
                  </button>
                  <button type="button" className={`report-filter-chip ${rubricFilter === 'exceptional' ? 'active' : ''}`} onClick={() => setRubricFilter('exceptional')}>
                    Exceptional
                  </button>
                  <button type="button" className={`report-filter-chip ${rubricFilter === 'needs-help' ? 'active' : ''}`} onClick={() => setRubricFilter('needs-help')}>
                    Coaching Focus
                  </button>
                </div>
                <div className="report-search-box flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    className="report-search-input"
                    placeholder="Search criterion name..."
                    value={rubricSearch}
                    onChange={(event) => setRubricSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="report-card overflow-hidden p-0">
                <table className="w-full text-left text-xs">
                  <thead className="report-table-head text-[10px] uppercase tracking-[0.16em]">
                    <tr>
                      <th className="px-3 py-2 font-bold">Criterion</th>
                      <th className="px-3 py-2 text-right font-bold">Score</th>
                      <th className="px-3 py-2 text-right font-bold">% of Max</th>
                      <th className="px-3 py-2 font-bold">Band</th>
                    </tr>
                  </thead>
                  <tbody className="report-table-body">
                    {filteredRubricRows.map((item) => {
                      const percent = item.percent;
                      const band = criterionBand(percent);
                      return (
                        <tr key={item.category} className="report-table-row">
                          <td className="report-text-strong px-3 py-2 font-medium">{item.category}</td>
                          <td className="report-text-strong px-3 py-2 text-right font-semibold">{item.score.toFixed(1)} / {item.weightage}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="report-inline-track h-1.5 w-24 overflow-hidden rounded-full">
                                <div className={`h-full rounded-full ${scoreColor(percent)}`} style={{ width: `${percent}%` }} />
                              </div>
                              <span className="report-text-strong w-9 text-right font-bold">{percent}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`report-band-pill ${band === 'Exceptional' ? 'report-band-exceptional' : 'report-band-needs-help'}`}>{band}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRubricRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="report-text-muted px-3 py-6 text-center">No criteria match this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {trendRows.length > 1 && (
              <div className="report-card p-4">
                <div className="report-card-eyebrow mb-3 flex items-center justify-between gap-2">
                  <span>Historical Assessment Progression (click any bar to load audit)</span>
                </div>
                <div className="report-trend-wrap flex items-end gap-1.5">
                  {trendRows.map((row) => {
                    const isActive = activeReview ? reviewKey(activeReview) === row.key : false;
                    return (
                      <button
                        type="button"
                        key={`${row.key}-${row.label}`}
                        onClick={() => onSelectReview(row.key)}
                        className={`report-trend-col flex flex-1 flex-col items-center gap-1 ${isActive ? 'active' : ''}`}
                      >
                        <div className="report-text-strong text-[10px] font-bold">{row.score}%</div>
                        <div className="report-trend-track flex h-20 w-full items-end rounded">
                          <div className={`report-trend-bar w-full rounded-t ${row.score >= 70 ? 'tone-cyan' : 'tone-rose'}`} style={{ height: `${row.score}%` }} />
                        </div>
                        <div className="report-text-dim text-[9.5px]">{row.date}</div>
                      </button>
                    );
                  })}
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

      <div className="report-archive-shell mt-5 overflow-hidden rounded-[28px]">
        <div className="report-archive-head px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="report-card-eyebrow">Historical Tickets & Audit Archive</div>
              <div className="report-text-strong mt-1 text-sm font-semibold">Assessment History</div>
            </div>
            <div className="report-text-dim text-xs">Clicking any ticket instantly switches the entire report view.</div>
          </div>
        </div>
        <div className="report-archive-divide">
          {groupedReviews.map((group) => (
            <div key={group.period} className="px-4 py-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="report-text-dim text-xs font-bold uppercase tracking-[0.16em]">{group.period}</div>
                <div className="report-count-pill rounded-full px-2 py-1 text-[10px] font-semibold">
                  {group.reviews.length} assessment{group.reviews.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="space-y-2.5">
                {group.reviews.map((review) => {
                  const ticket = review.sourceRef ? ticketBySourceRef.get(review.sourceRef) : undefined;
                  const key = reviewKey(review);
                  const selected = activeReview ? reviewKey(activeReview) === key : false;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectHistoryItem(key, ticket)}
                      className={`report-hist-card grid w-full gap-3 px-4 py-4 text-left lg:grid-cols-[210px_minmax(0,1fr)_140px] ${selected ? 'active' : ''}`}
                    >
                      <div>
                        <div className="report-text-strong flex items-center gap-1.5 text-xs font-semibold">
                          <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                          {ticket?.id || review.template}
                        </div>
                        <div className="report-text-dim mt-1 text-[11px]">{formatDate(review.createdAt)}</div>
                        <div className="report-text-dim mt-1 text-[11px]">Period: {formatReviewPeriod(review.reviewPeriod)}</div>
                        {review.studio && <div className="report-text-dim mt-1 text-[11px]">{review.studio}</div>}
                        {review.classType && <div className="report-text-dim mt-1 text-[11px]">{review.classType}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="report-text-dim mb-1 text-[11px] font-bold uppercase tracking-[0.14em]">{review.template} Evaluation</div>
                        <p className="report-text-muted line-clamp-2 text-xs leading-relaxed">{review.feedback}</p>
                        {review.focusPoints && <p className="mt-2 text-[11px] font-medium text-blue-500">Focus: {review.focusPoints}</p>}
                      </div>
                      <div className="flex items-start justify-between gap-2 text-right lg:flex-col lg:items-end">
                        <span className="report-hist-score text-2xl font-semibold">{review.scorePercent}%</span>
                        <span className={`report-hist-badge ${selected ? 'active-viewing' : 'load-audit'}`}>
                          {selected && <span className="report-pulse-dot report-pulse-dot-emerald" />}
                          {selected ? 'Active in Report' : 'Load Audit →'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedReviews.length === 0 && (
            <div className="report-text-muted px-4 py-10 text-center text-sm">
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
  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300 shadow-sm backdrop-blur">
    <span className="shrink-0 text-cyan-300">{icon}</span>
    <span className="truncate">{label}</span>
  </span>
);

const TrainerReportStyle: React.FC = () => (
  <style>{`
    .trainer-report-os {
      --report-bg-base: #f8fafc;
      --report-surface: rgba(255, 255, 255, 0.92);
      --report-surface-elevated: #ffffff;
      --report-glass: rgba(241, 245, 249, 0.72);
      --report-hover: #ffffff;
      --report-border: rgba(226, 232, 240, 0.9);
      --report-border-light: rgba(203, 213, 225, 0.9);
      --report-border-highlight: rgba(14, 165, 233, 0.45);
      --report-text: #0f172a;
      --report-muted: #475569;
      --report-dim: #94a3b8;
      --report-cyan: #0284c7;
      --report-cyan-accent: #0ea5e9;
      --report-blue: #2563eb;
      --report-emerald: #059669;
      --report-rose: #e11d48;
      --report-amber: #d97706;
      --report-purple: #7c3aed;
      --report-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
      --report-shadow-elevated: 0 18px 42px -12px rgba(15, 23, 42, 0.18);
      color: var(--report-text);
      background:
        radial-gradient(circle at 10% 8%, rgba(14, 165, 233, 0.08) 0%, transparent 35%),
        radial-gradient(circle at 90% 15%, rgba(124, 58, 237, 0.06) 0%, transparent 40%),
        linear-gradient(180deg, var(--report-bg-base), #eef2f7);
      border-radius: 28px;
    }

    .trainer-report-os.dark {
      --report-bg-base: #090d16;
      --report-surface: rgba(15, 23, 42, 0.65);
      --report-surface-elevated: rgba(30, 41, 59, 0.72);
      --report-glass: rgba(15, 23, 42, 0.52);
      --report-hover: rgba(26, 36, 58, 0.85);
      --report-border: rgba(255, 255, 255, 0.07);
      --report-border-light: rgba(255, 255, 255, 0.12);
      --report-border-highlight: rgba(56, 189, 248, 0.4);
      --report-text: #f8fafc;
      --report-muted: #94a3b8;
      --report-dim: #64748b;
      --report-cyan: #06b6d4;
      --report-cyan-accent: #38bdf8;
      --report-blue: #3b82f6;
      --report-emerald: #10b981;
      --report-rose: #f43f5e;
      --report-amber: #f59e0b;
      --report-purple: #8b5cf6;
      --report-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
      --report-shadow-elevated: 0 20px 54px -14px rgba(0, 0, 0, 0.7);
      background:
        radial-gradient(circle at 10% 8%, rgba(6, 182, 212, 0.08) 0%, transparent 35%),
        radial-gradient(circle at 90% 15%, rgba(139, 92, 246, 0.08) 0%, transparent 40%),
        linear-gradient(180deg, var(--report-bg-base), #020617);
    }

    .report-top-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--report-border);
    }

    .report-brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .report-brand-logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(6, 182, 212, 0.35);
      flex-shrink: 0;
    }

    .report-brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--report-text);
      flex-wrap: wrap;
    }

    .report-brand-subtitle {
      margin-top: 2px;
      font-size: 11px;
      color: var(--report-dim);
    }

    .report-brand-badge,
    .report-badge-count {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.12) !important;
      color: var(--report-cyan) !important;
      border: 1px solid rgba(6, 182, 212, 0.25) !important;
    }

    .report-top-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .report-btn,
    .report-icon-btn {
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }

    .report-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      border: 1px solid transparent;
    }

    .report-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .report-btn-secondary,
    .report-icon-btn {
      background: var(--report-surface-elevated);
      border: 1px solid var(--report-border);
      color: var(--report-text);
      box-shadow: var(--report-shadow);
    }

    .report-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--report-muted);
    }

    .report-btn:hover:not(:disabled),
    .report-icon-btn:hover {
      transform: translateY(-1px);
      border-color: var(--report-border-highlight);
      color: var(--report-text);
    }

    .report-marquee {
      background: var(--report-surface);
      border: 1px solid var(--report-border);
      border-radius: 10px;
      margin-bottom: 22px;
      padding: 9px 0;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      box-shadow: var(--report-shadow);
      backdrop-filter: blur(18px);
    }

    .report-marquee-tag {
      position: absolute;
      left: 12px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: var(--report-cyan);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 5px;
      backdrop-filter: blur(8px);
    }

    .report-marquee-window {
      display: flex;
      width: 100%;
      overflow: hidden;
      padding-left: 126px;
      mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
      -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
    }

    .report-marquee-track {
      display: flex;
      align-items: center;
      gap: 32px;
      white-space: nowrap;
      animation: reportMarqueeScroll 35s linear infinite;
      will-change: transform;
    }

    .report-marquee-track:hover {
      animation-play-state: paused;
    }

    .report-marquee-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--report-muted);
    }

    .report-marquee-item b {
      color: var(--report-text);
      font-weight: 600;
    }

    .report-marquee-chip {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.03em;
    }

    .report-chip-success {
      background: rgba(16, 185, 129, 0.12);
      color: var(--report-emerald);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .report-chip-warn {
      background: rgba(244, 63, 94, 0.12);
      color: var(--report-rose);
      border: 1px solid rgba(244, 63, 94, 0.25);
    }

    .report-chip-ai {
      background: rgba(139, 92, 246, 0.12);
      color: var(--report-purple);
      border: 1px solid rgba(139, 92, 246, 0.25);
    }

    .report-chip-amber {
      background: rgba(245, 158, 11, 0.12);
      color: var(--report-amber);
      border: 1px solid rgba(245, 158, 11, 0.25);
    }

    @keyframes reportMarqueeScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .report-shell {
      background: var(--report-surface) !important;
      color: var(--report-text) !important;
      border-color: var(--report-border) !important;
      box-shadow: var(--report-shadow-elevated) !important;
      backdrop-filter: blur(20px);
    }

    .report-profile-hero {
      background: var(--report-surface) !important;
      border-color: var(--report-border) !important;
      color: var(--report-text) !important;
    }

    .trainer-report-os.dark .report-profile-hero {
      background:
        radial-gradient(circle at top left, rgba(6, 182, 212, 0.22), transparent 32%),
        linear-gradient(135deg, #020617, #0f172a 48%, #111827) !important;
    }

    .report-profile-hero h3,
    .report-profile-hero .text-white,
    .report-shell .text-white,
    .report-shell .text-slate-100 {
      color: var(--report-text) !important;
    }

    .report-profile-hero .text-slate-400,
    .report-shell .text-slate-400 {
      color: var(--report-muted) !important;
    }

    .report-average-box {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%) !important;
      border-color: rgba(245, 158, 11, 0.28) !important;
      min-width: 185px;
    }

    .report-average-box .text-4xl {
      color: var(--report-amber) !important;
      font-weight: 800;
    }

    .report-ai-banner {
      position: relative;
      background: linear-gradient(90deg, rgba(139, 92, 246, 0.10), rgba(59, 130, 246, 0.08), rgba(6, 182, 212, 0.08)) !important;
      border-color: rgba(139, 92, 246, 0.28) !important;
      overflow: hidden;
    }

    .report-ai-banner::before {
      content: "";
      position: absolute;
      width: 250px;
      height: 100%;
      top: 0;
      left: -200px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent);
      transform: skewX(-25deg);
      animation: reportAiShimmer 6s infinite;
      pointer-events: none;
    }

    @keyframes reportAiShimmer {
      0% { left: -220px; }
      30%, 100% { left: 130%; }
    }

    .report-shell .bg-\\[radial-gradient\\(circle_at_90\\%_8\\%\\2c _rgba\\(139\\2c 92\\2c 246\\2c 0\\.13\\)\\2c _transparent_30\\%\\)\\2c linear-gradient\\(180deg\\2c _\\#020617\\2c _\\#0f172a\\)\\] {
      background:
        radial-gradient(circle at 90% 8%, rgba(139, 92, 246, 0.08), transparent 30%),
        linear-gradient(180deg, var(--report-bg-base), var(--report-glass)) !important;
    }

    .trainer-report-os .rounded-2xl,
    .trainer-report-os .rounded-3xl {
      border-radius: 14px;
    }

    .trainer-report-os .shadow-\\[0_18px_36px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.22\\)\\],
    .trainer-report-os .shadow-\\[0_18px_44px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.24\\)\\],
    .trainer-report-os .shadow-\\[0_18px_46px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.24\\)\\] {
      box-shadow: var(--report-shadow) !important;
    }

    /* ==================== THEMED CARD PRIMITIVES ==================== */

    .trainer-report-os {
      --report-radar-grid: rgba(148, 163, 184, 0.28);
    }

    .trainer-report-os.dark {
      --report-radar-grid: rgba(148, 163, 184, 0.2);
    }

    .report-text-strong { color: var(--report-text) !important; }
    .report-text-muted { color: var(--report-muted) !important; }
    .report-text-dim { color: var(--report-dim) !important; }

    .report-card {
      background: var(--report-surface-elevated);
      border: 1px solid var(--report-border);
      border-radius: 14px;
      box-shadow: var(--report-shadow);
      color: var(--report-text);
      backdrop-filter: blur(16px);
    }

    .report-card-eyebrow {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--report-dim);
    }

    .report-bullet-dot {
      margin-top: 6px;
      height: 6px;
      width: 6px;
      flex-shrink: 0;
      border-radius: 999px;
      background: var(--report-cyan-accent);
    }

    .report-bullet-dot.dot-emerald {
      background: var(--report-emerald);
    }

    .report-active-audit-pill {
      color: var(--report-cyan);
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.25);
    }

    .report-pulse-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--report-cyan);
      animation: reportPulse 1.5s infinite;
    }

    .report-pulse-dot-emerald {
      background: var(--report-emerald);
    }

    @keyframes reportPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .report-chart-legend { color: var(--report-muted); }
    .report-legend-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }

    /* ---- KPI Bento Grid ---- */

    .report-kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
    }

    @media (max-width: 1200px) {
      .report-kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 640px) {
      .report-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .report-kpi-card {
      position: relative;
      overflow: hidden;
      padding: 14px;
      border-radius: 14px;
      background: var(--report-surface-elevated);
      border: 1px solid var(--report-border);
      box-shadow: var(--report-shadow);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 116px;
      transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
      opacity: 0;
      transform: translateY(8px);
    }

    .report-kpi-card.is-mounted {
      opacity: 1;
      transform: translateY(0);
    }

    .report-kpi-card:hover {
      transform: translateY(-2px);
      border-color: var(--report-border-highlight);
    }

    .report-kpi-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
    }

    .report-kpi-label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--report-dim);
    }

    .report-kpi-arrow {
      color: var(--report-dim);
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .report-kpi-card:hover .report-kpi-arrow {
      color: var(--report-cyan);
      transform: translate(2px, -2px);
    }

    .report-kpi-value {
      margin-top: 4px;
      font-size: 26px;
      font-weight: 800;
      font-family: var(--font-mono, inherit);
      line-height: 1;
    }

    .report-kpi-helper {
      margin-top: 4px;
      font-size: 11px;
      color: var(--report-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .report-kpi-fill-track {
      margin-top: 10px;
      height: 3px;
      width: 100%;
      border-radius: 999px;
      background: var(--report-border);
      overflow: hidden;
    }

    .report-kpi-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .report-kpi-card.tone-blue .report-kpi-value { color: var(--report-blue); }
    .report-kpi-card.tone-blue .report-kpi-fill { background: var(--report-blue); }
    .report-kpi-card.tone-green .report-kpi-value { color: var(--report-emerald); }
    .report-kpi-card.tone-green .report-kpi-fill { background: var(--report-emerald); }
    .report-kpi-card.tone-cyan .report-kpi-value { color: var(--report-cyan-accent); }
    .report-kpi-card.tone-cyan .report-kpi-fill { background: var(--report-cyan-accent); }
    .report-kpi-card.tone-rose .report-kpi-value { color: var(--report-rose); }
    .report-kpi-card.tone-rose .report-kpi-fill { background: var(--report-rose); }

    /* ---- Dual Intelligence Row ---- */

    .report-intel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    @media (max-width: 900px) {
      .report-intel-grid { grid-template-columns: 1fr; }
    }

    .report-intel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid var(--report-border);
    }

    .report-attention-eyebrow { color: var(--report-rose) !important; }

    .report-lens-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid;
      white-space: nowrap;
    }

    .report-lens-badge.positive {
      color: var(--report-emerald);
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.25);
    }

    .report-lens-badge.negative {
      color: var(--report-rose);
      background: rgba(244, 63, 94, 0.12);
      border-color: rgba(244, 63, 94, 0.25);
    }

    .report-lens-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }

    @media (max-width: 480px) {
      .report-lens-grid { grid-template-columns: 1fr; }
    }

    .report-lens-tile {
      background: var(--report-glass);
      border: 1px solid var(--report-border);
      border-radius: 10px;
      padding: 10px 12px;
    }

    .report-lens-title {
      font-size: 15px;
      font-weight: 800;
      margin: 3px 0 2px;
    }

    .report-lens-desc {
      font-size: 11px;
      line-height: 1.4;
    }

    .report-signals-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .report-signals-title {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .report-signals-title[data-tone="success"] { color: var(--report-emerald); }
    .report-signals-title[data-tone="warn"] { color: var(--report-rose); }

    .report-signal-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      padding: 7px 10px;
      border-radius: 8px;
      background: var(--report-glass);
      border: 1px solid var(--report-border);
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .report-signal-row:hover {
      background: var(--report-hover);
      transform: translateX(2px);
    }

    .report-signal-left {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .report-signal-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .report-signal-dot.dot-success { background: var(--report-emerald); box-shadow: 0 0 6px var(--report-emerald); }
    .report-signal-dot.dot-warn { background: var(--report-rose); box-shadow: 0 0 6px var(--report-rose); }

    .report-signal-value {
      font-family: var(--font-mono, inherit);
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .report-signal-value.tone-success { color: var(--report-emerald); }
    .report-signal-value.tone-warn { color: var(--report-rose); }

    .report-directive-note {
      margin-top: 10px;
      padding: 8px 12px;
      background: rgba(139, 92, 246, 0.08);
      border: 1px dashed rgba(139, 92, 246, 0.3);
      border-radius: 8px;
      font-size: 11.5px;
      color: var(--report-muted);
    }

    .report-directive-note b { color: var(--report-purple); }

    /* ---- Narrative / feedback ---- */

    .report-note-pill {
      border-radius: 999px;
      border: 1px solid rgba(6, 182, 212, 0.25);
      background: rgba(6, 182, 212, 0.1);
      color: var(--report-cyan);
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
    }

    .report-narrative-box {
      border-radius: 10px;
      border: 1px solid var(--report-border);
      background: var(--report-glass);
      padding: 12px;
    }

    .report-note-card {
      border-radius: 10px;
      border: 1px solid var(--report-border);
      background: var(--report-glass);
      box-shadow: var(--report-shadow);
    }

    /* ---- Rubric table controls ---- */

    .report-filter-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    .report-filter-chip {
      font-size: 11.5px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--report-border);
      background: var(--report-surface-elevated);
      color: var(--report-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .report-filter-chip.active {
      background: var(--report-cyan);
      color: #ffffff;
      border-color: var(--report-cyan);
      box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
    }

    .report-search-box {
      background: var(--report-surface-elevated);
      border: 1px solid var(--report-border);
      border-radius: 6px;
      padding: 5px 12px;
      width: 240px;
      color: var(--report-dim);
    }

    .report-search-input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--report-text);
      font-size: 12.5px;
      width: 100%;
    }

    .report-table-head {
      background: var(--report-glass);
      color: var(--report-dim);
    }

    .report-table-body {
      background: transparent;
    }

    .report-table-row td {
      border-bottom: 1px solid var(--report-border);
    }

    .report-table-row:hover td {
      background: var(--report-hover);
    }

    .report-inline-track { background: var(--report-border); }

    .report-band-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 999px;
    }

    .report-band-exceptional {
      background: rgba(16, 185, 129, 0.12);
      color: var(--report-emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .report-band-needs-help {
      background: rgba(244, 63, 94, 0.12);
      color: var(--report-rose);
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    /* ---- Trend bars ---- */

    .report-trend-col {
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: transform 0.2s ease;
      font: inherit;
    }

    .report-trend-col:hover { transform: translateY(-3px); }

    .report-trend-track {
      background: var(--report-border);
      border-radius: 4px;
      overflow: hidden;
    }

    .report-trend-bar {
      transition: height 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease;
      border-radius: 4px 4px 1px 1px;
    }

    .report-trend-bar.tone-cyan { background: linear-gradient(180deg, var(--report-cyan-accent), var(--report-cyan)); }
    .report-trend-bar.tone-rose { background: linear-gradient(180deg, #fb7185, var(--report-rose)); }

    .report-trend-col:hover .report-trend-bar { filter: brightness(1.15); }

    .report-trend-col.active .report-trend-bar {
      box-shadow: 0 0 14px var(--report-cyan-accent);
      outline: 1.5px solid var(--report-text);
    }

    /* ---- Historic ticket archive ---- */

    .report-archive-shell {
      background: var(--report-surface);
      border: 1px solid var(--report-border);
      box-shadow: var(--report-shadow-elevated);
      backdrop-filter: blur(18px);
    }

    .report-archive-head {
      border-bottom: 1px solid var(--report-border);
      background: var(--report-glass);
    }

    .report-archive-divide > * + * {
      border-top: 1px solid var(--report-border);
    }

    .report-count-pill {
      background: var(--report-glass);
      border: 1px solid var(--report-border);
      color: var(--report-muted);
    }

    .report-hist-card {
      position: relative;
      display: grid;
      overflow: hidden;
      border: 1px solid var(--report-border);
      border-radius: 12px;
      background: var(--report-surface-elevated);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--report-text);
      width: 100%;
    }

    .report-hist-card::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3.5px;
      background: transparent;
      transition: background 0.25s ease;
    }

    .report-hist-card:hover {
      background: var(--report-hover);
      border-color: var(--report-border-highlight);
      transform: translateX(4px);
      box-shadow: var(--report-shadow-elevated);
    }

    .report-hist-card.active {
      border-color: var(--report-cyan);
      background: linear-gradient(90deg, rgba(6, 182, 212, 0.08) 0%, var(--report-surface-elevated) 100%);
      box-shadow: 0 6px 24px rgba(6, 182, 212, 0.15);
    }

    .report-hist-card.active::before {
      background: var(--report-cyan);
    }

    .report-hist-score { color: var(--report-blue); font-family: var(--font-mono, inherit); }

    .report-hist-badge {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 9px;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .report-hist-badge.load-audit {
      background: rgba(6, 182, 212, 0.1);
      color: var(--report-cyan);
      border: 1px solid rgba(6, 182, 212, 0.25);
    }

    .report-hist-card:hover .report-hist-badge.load-audit {
      background: var(--report-cyan);
      color: #ffffff;
    }

    .report-hist-badge.active-viewing {
      background: rgba(16, 185, 129, 0.15);
      color: var(--report-emerald);
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    @media (max-width: 900px) {
      .report-top-nav {
        align-items: flex-start;
        flex-direction: column;
      }

      .report-marquee-window {
        padding-left: 118px;
      }
    }

    @media print {
      .report-top-controls,
      .report-marquee,
      .report-btn,
      .report-icon-btn {
        display: none !important;
      }

      .trainer-report-os {
        background: white !important;
        padding: 0 !important;
      }

      .report-shell {
        box-shadow: none !important;
      }
    }
  `}</style>
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
    : ticket.sentiment === 'Negative' || ticket.sentiment === 'Angry'
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

  const keyMetrics: Array<{ label: string; value: string; helper: string; tone: KpiTone; icon: React.ReactNode; fill: number }> = [
    {
      label: 'Selected Score',
      value: `${review.scorePercent}%`,
      helper: scoreBand(review.scorePercent),
      tone: 'blue',
      icon: <Gauge className="h-4 w-4" />,
      fill: review.scorePercent,
    },
    {
      label: 'Vs Profile Avg',
      value: `${delta > 0 ? '+' : ''}${delta}%`,
      helper: `${profile.averageScorePercent}% profile mean`,
      tone: delta >= 0 ? 'green' : 'rose',
      icon: <ArrowUpRight className="h-4 w-4" />,
      fill: Math.min(100, Math.abs(delta) * 4),
    },
    {
      label: 'Weighted Yield',
      value: `${scoreDensity}%`,
      helper: `${review.totalScore.toFixed(1)} / ${review.totalWeightage}`,
      tone: 'cyan',
      icon: <Layers3 className="h-4 w-4" />,
      fill: scoreDensity,
    },
    {
      label: 'Risk Weight',
      value: `${weightedRisk}`,
      helper: 'points below 70%',
      tone: weightedRisk ? 'rose' : 'green',
      icon: <Flame className="h-4 w-4" />,
      fill: Math.min(100, weightedRisk),
    },
    {
      label: 'Top Criterion',
      value: topCriterion ? `${topCriterion.percent}%` : '0%',
      helper: topCriterion ? topCriterion.category : 'No criteria captured',
      tone: 'green',
      icon: <Sparkles className="h-4 w-4" />,
      fill: topCriterion?.percent || 0,
    },
    {
      label: 'Lowest Criterion',
      value: lowCriterion ? `${lowCriterion.percent}%` : '0%',
      helper: lowCriterion ? lowCriterion.category : 'No criteria captured',
      tone: 'rose',
      icon: <Target className="h-4 w-4" />,
      fill: lowCriterion?.percent || 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="report-kpi-grid">
        {keyMetrics.map((metric, index) => (
          <DrillMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
            tone={metric.tone}
            icon={metric.icon}
            delay={index}
            fill={metric.fill}
            mounted={mounted}
          />
        ))}
      </div>

      <div className="report-intel-grid">
        <div className="report-card p-4">
          <div className="report-intel-head">
            <div className="report-card-eyebrow flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-300" />
              Executive Lens & Momentum
            </div>
            <span className={`report-lens-badge ${delta >= 0 ? 'positive' : 'negative'}`}>
              {delta >= 0 ? 'Trajectory Upward' : 'Needs Attention'}
            </span>
          </div>
          <div className="report-lens-grid">
            <div className="report-lens-tile">
              <div className="report-card-eyebrow">Performance Lens</div>
              <div className="report-text-strong report-lens-title">{trendDirection}</div>
              <div className="report-text-muted report-lens-desc">
                Weighted yield {weightedAverage.toFixed(1)} and review delta <b>{delta > 0 ? '+' : ''}{delta}%</b> from profile mean.
              </div>
            </div>
            <div className="report-lens-tile">
              <div className="report-card-eyebrow">Assessment Count</div>
              <div className="report-text-strong report-lens-title">{profile.reviews.length} review{profile.reviews.length === 1 ? '' : 's'}</div>
              <div className="report-text-muted report-lens-desc">
                Latest recorded on <b>{formatDate(profile.latestReviewAt, 'Not captured')}</b>.
              </div>
            </div>
          </div>
          <TechnicalList
            title="Strongest Signals"
            tone="success"
            items={strengths.map((item) => ({ label: item.category, value: `${item.percent}% (${item.score.toFixed(1)}/${item.weightage})` }))}
            fallback="No criterion reached the strength threshold."
          />
        </div>

        <div className="report-card p-4">
          <div className="report-intel-head">
            <div className="report-card-eyebrow report-attention-eyebrow flex items-center gap-2">
              <Target className="h-4 w-4" />
              Coaching Attention & Action Vectors
            </div>
            <span className="report-lens-badge negative">Priority Pillars</span>
          </div>
          <TechnicalList
            title=""
            tone="warn"
            items={attention.map((item) => ({ label: item.category, value: `${item.percent}% (${item.score.toFixed(1)}/${item.weightage})` }))}
            fallback="No attention areas captured."
          />
          {lowCriterion && (
            <div className="report-directive-note">
              Athena Focus Directive: <b>{lowCriterion.category}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DrillMetric: React.FC<{ label: string; value: string; helper: string; tone: KpiTone; icon: React.ReactNode; delay: number; fill: number; mounted: boolean }> = ({ label, value, helper, tone, icon, delay, fill, mounted }) => (
  <div
    className={`report-kpi-card tone-${tone} ${mounted ? 'is-mounted' : ''}`}
    style={{ transitionDelay: `${delay * 70}ms` }}
  >
    <div className="report-kpi-top">
      <div className="report-kpi-label">
        <span>{icon}</span>
        {label}
      </div>
      <ArrowUpRight className="report-kpi-arrow h-3.5 w-3.5" />
    </div>
    <div className="report-kpi-value">{value}</div>
    <div className="report-kpi-helper">{helper}</div>
    <div className="report-kpi-fill-track">
      <div className="report-kpi-fill" style={{ width: mounted ? `${Math.max(6, Math.min(100, fill))}%` : '0%' }} />
    </div>
  </div>
);

const TechnicalList: React.FC<{ title: string; tone: 'success' | 'warn'; items: Array<{ label: string; value: string }>; fallback: string }> = ({ title, tone, items, fallback }) => (
  <div className="report-signals-list">
    {title && <div className="report-signals-title" data-tone={tone}>{title}</div>}
    {items.length ? items.map((item) => (
      <div key={item.label} className="report-signal-row">
        <span className="report-signal-left">
          <span className={`report-signal-dot dot-${tone}`} />
          <span className="report-text-strong">{item.label}</span>
        </span>
        <span className={`report-signal-value tone-${tone}`}>{item.value}</span>
      </div>
    )) : (
      <div className="report-signal-row">
        <span className="report-text-muted text-[11px]">{fallback}</span>
      </div>
    )}
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
  <ul className="space-y-2 text-xs leading-relaxed">
    {richFeedbackItems(value).map((item, index) => (
      <li key={`${item.label || item.text}-${index}`} className="flex gap-2">
        <span className="report-bullet-dot" />
        <span className="report-text-muted">
          {item.label && <span className="report-text-strong font-semibold">{item.label}: </span>}
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
    <div className="report-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="report-card-eyebrow">Evaluator Feedback & Qualitative Coaching Readout</div>
          <div className="report-text-strong mt-1 text-sm font-semibold">Observational assessment & narrative</div>
        </div>
        <span className="report-note-pill">
          {items.length} note{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="report-narrative-box">
          <div className="report-card-eyebrow mb-2">Narrative Coaching Readout</div>
          <p className="report-text-strong text-sm leading-relaxed">{summary}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <ul key={columnIndex} className="space-y-2">
              {column.map((item, index) => (
                <li key={`${item.label || item.text}-${columnIndex}-${index}`} className="report-note-card p-3">
                  <div className="report-text-muted flex gap-2 text-xs leading-relaxed">
                    <span className="report-bullet-dot dot-emerald" />
                    <span>
                      {item.label && <span className="report-text-strong font-semibold">{item.label}: </span>}
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
  <div className="report-card p-3">
    <div className="report-text-strong mb-1 flex items-center gap-2 text-xs font-semibold">
      {icon}
      {title}
    </div>
    {title.toLowerCase().includes('feedback') || title.toLowerCase().includes('evaluation')
      ? <RichFeedbackList value={value} />
      : <p className="report-text-muted text-xs leading-relaxed">{value || 'No detail captured.'}</p>}
  </div>
);
