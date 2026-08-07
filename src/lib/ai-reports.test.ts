import { describe, expect, it } from 'vitest';
import { Ticket } from './ticketing-data';
import {
  ALL_REPORT_DEFINITIONS,
  DEFAULT_REPORT_FILTERS,
  TicketReportEvent,
  buildReport,
  buildReportExportPayload,
  csvForReport,
  fallbackNarrativeForReport,
  filterTicketsForReport,
  getResolvedAt,
  htmlForReport,
  isTrainerReportId,
  normalizeReportNarrativeResponse,
  paginateReportRows,
  reportPayloadForNarrative,
  reportRuntimeErrorMessage,
} from './ai-reports';

const baseTicket = (patch: Partial<Ticket>): Ticket => ({
  id: 'P57-BASE',
  title: 'Base ticket',
  description: 'Member reported a base concern.',
  category: 'General Feedback',
  subCategory: 'Other',
  priority: 'Medium',
  status: 'New',
  studio: 'Kwality House, Kemps Corner',
  assignedTo: 'Nunu Yeptomi',
  team: 'Customer Service',
  tags: ['ai-approved'],
  createdAt: '2026-05-10T10:00:00.000Z',
  slaDueAt: '2026-05-11T10:00:00.000Z',
  ...patch,
});

const event = (patch: Partial<TicketReportEvent>): TicketReportEvent => ({
  id: 'event-1',
  ticketId: 'P57-BASE',
  eventType: 'status_change',
  actor: 'Athena',
  fromValue: 'In Progress',
  toValue: 'Resolved',
  createdAt: '2026-05-11T12:00:00.000Z',
  metadata: {},
  ...patch,
});

describe('AI reports engine', () => {
  it('declares the expanded report catalog with stable trainer intelligence ids', () => {
    expect(ALL_REPORT_DEFINITIONS.length).toBeGreaterThan(20);
    expect(new Set(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).size).toBe(ALL_REPORT_DEFINITIONS.length);
    expect(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).toContain('executive_operations_summary');
    expect(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).toContain('data_quality_intake_completeness');
    expect(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).toContain('trainer_performance_consolidated');
    expect(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).toContain('trainer_member_feedback_consolidated');
    expect(ALL_REPORT_DEFINITIONS.map((definition) => definition.id)).toContain('trainer_coaching_priority_report');
    expect(isTrainerReportId('trainer_performance_consolidated')).toBe(true);
    expect(isTrainerReportId('executive_operations_summary')).toBe(false);
  });

  it('filters tickets by inclusive created date bounds and source type', () => {
    const tickets = [
      baseTicket({ id: 'P57-1', createdAt: '2026-05-01T00:00:00.000Z' }),
      baseTicket({ id: 'P57-2', createdAt: '2026-05-19T23:59:59.000Z', tags: ['historic'] }),
      baseTicket({ id: 'P57-3', createdAt: '2026-05-20T00:00:00.000Z' }),
    ];

    expect(
      filterTicketsForReport(tickets, {
        from: '2026-05-01',
        to: '2026-05-19',
        filters: DEFAULT_REPORT_FILTERS,
      }).map((ticket) => ticket.id)
    ).toEqual(['P57-1', 'P57-2']);

    expect(
      filterTicketsForReport(tickets, {
        from: '2026-05-01',
        to: '2026-05-19',
        filters: { ...DEFAULT_REPORT_FILTERS, sourceType: 'live' },
      }).map((ticket) => ticket.id)
    ).toEqual(['P57-1']);
  });

  it('does not crash reports when legacy tickets are missing tags', () => {
    const legacyTicket = baseTicket({
      id: 'P57-LEGACY-NO-TAGS',
      tags: undefined as unknown as string[],
      createdAt: '2026-05-12T10:00:00.000Z',
    });

    const filtered = filterTicketsForReport([legacyTicket], {
      from: '2026-05-01',
      to: '2026-05-31',
      filters: DEFAULT_REPORT_FILTERS,
    });
    const report = buildReport({
      reportId: 'executive_operations_summary',
      tickets: [legacyTicket],
      events: [],
      period: { from: '2026-05-01', to: '2026-05-31' },
      filters: DEFAULT_REPORT_FILTERS,
    });

    expect(filtered.map((ticket) => ticket.id)).toEqual(['P57-LEGACY-NO-TAGS']);
    expect(report.reportTickets).toBe(1);
  });

  it('uses ticket events before resolution metadata when calculating resolved time', () => {
    const ticket = baseTicket({
      id: 'P57-4',
      createdAt: '2026-05-10T10:00:00.000Z',
      status: 'Resolved',
      metadata: {
        latestResolution: {
          status: 'Resolved',
          reason: 'Member issue resolved.',
          actionTaken: 'Owner replied.',
          actionDate: '2026-05-14',
          actor: 'Owner',
          createdAt: '2026-05-14T10:00:00.000Z',
        },
      },
    });

    expect(getResolvedAt(ticket, [event({ ticketId: 'P57-4', createdAt: '2026-05-11T12:00:00.000Z' })])).toBe('2026-05-11T12:00:00.000Z');
    expect(getResolvedAt(ticket, [])).toBe('2026-05-14T10:00:00.000Z');
  });

  it('builds every report with metrics, sections, source rows, and data quality notes', () => {
    const tickets = [
      baseTicket({
        id: 'P57-5',
        title: 'Refund follow-up delay',
        category: 'Pricing and Memberships',
        subCategory: 'Refund and Cancellation Policy Issue',
        priority: 'High',
        status: 'Resolved',
        memberName: 'Asha Mehta',
        sentiment: 'Negative',
        tags: ['ai-approved', 'refund'],
        createdAt: '2026-05-06T10:00:00.000Z',
      }),
      baseTicket({
        id: 'P57-6',
        title: 'Hosted class prospect follow-up',
        category: 'Hosted Class & Partnerships',
        subCategory: 'Prospect Conversion Opportunity',
        priority: 'Medium',
        status: 'In Progress',
        studio: 'Supreme HQ, Bandra',
        assignedTo: 'Saachi Shetty',
        team: 'Marketing',
        tags: ['historic', 'hosted-class'],
        createdAt: '2026-05-07T10:00:00.000Z',
      }),
    ];

    for (const definition of ALL_REPORT_DEFINITIONS) {
      const report = buildReport({
        reportId: definition.id,
        tickets,
        events: [event({ ticketId: 'P57-5', createdAt: '2026-05-07T12:00:00.000Z' })],
        period: { from: '2026-05-01', to: '2026-05-19' },
        filters: DEFAULT_REPORT_FILTERS,
        generatedAt: '2026-05-19T09:30:00.000Z',
      });

      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.sections.length).toBeGreaterThan(0);
      expect(report.sourceRows.length).toBeGreaterThan(0);
      expect(report.dataQualityNotes.length).toBeGreaterThan(0);
    }
  });

  it('builds consolidated trainer performance reports from evaluations and member feedback tickets', () => {
    const report = buildReport({
      reportId: 'trainer_performance_consolidated',
      tickets: [
        baseTicket({
          id: 'P57-TRAINER-1',
          title: 'Instructor evaluation · Simran Dutt · Barre',
          description: 'Instructor evaluation submitted for Simran Dutt.',
          category: 'Trainer Feedback',
          subCategory: 'Knowledge and Competence',
          priority: 'Low',
          status: 'Closed',
          trainer: 'Simran Dutt',
          tags: ['trainer-profile', 'instructor-evaluation', 'profile-only', 'barre'],
          sentiment: 'Positive',
          createdAt: '2026-05-08T10:00:00.000Z',
          metadata: {
            profileOnly: true,
            trainerReview: {
              id: 'review-1',
              trainer: 'Simran Dutt',
              template: 'Barre',
              studio: 'Supreme HQ, Bandra',
              classType: 'Studio Barre 57',
              reviewPeriod: '2026-05-08',
              createdAt: '2026-05-08T10:00:00.000Z',
              totalWeightage: 100,
              totalScore: 84,
              scorePercent: 84,
              scores: [
                { category: 'Client feedback', weightage: 12.5, score: 11 },
                { category: 'Musicality', weightage: 8, score: 5 },
              ],
              feedback: 'Strong client connection with musicality coaching needed.',
              focusPoints: 'Beat matching',
              goals: 'Hold 85%+ in next review',
            },
          },
        }),
        baseTicket({
          id: 'P57-TRAINER-2',
          title: 'Member compliment for Simran',
          description: 'Member reported that Simran gave clear corrections.',
          category: 'Trainer Feedback',
          subCategory: 'Instructor Appreciation / Compliment',
          priority: 'Medium',
          status: 'Resolved',
          trainer: 'Simran Dutt',
          sentiment: 'Positive',
          tags: ['ai-approved', 'member-feedback'],
          createdAt: '2026-05-09T10:00:00.000Z',
        }),
      ],
      events: [],
      period: { from: '2026-05-01', to: '2026-05-19' },
      filters: DEFAULT_REPORT_FILTERS,
      generatedAt: '2026-05-19T09:30:00.000Z',
    });

    expect(report.reportTickets).toBe(2);
    expect(report.sourceRows.map((row) => row.ticketId)).toEqual(expect.arrayContaining(['P57-TRAINER-1', 'P57-TRAINER-2']));
    expect(report.metrics.map((metric) => metric.id)).toContain('trainer_review_count');
    expect(report.metrics.map((metric) => metric.id)).toContain('trainer_average_score');
    expect(report.metrics.map((metric) => metric.id)).toContain('trainer_member_feedback_count');
    expect(report.metrics.find((metric) => metric.id === 'trainer_average_score')?.value).toBe('84%');
    expect(report.sections.map((section) => section.id)).toContain('trainer_score_trend');
    expect(report.sections.map((section) => section.id)).toContain('trainer_member_feedback');
    expect(report.sections.map((section) => section.id)).toContain('trainer_coaching_priorities');
    expect(report.dataQualityNotes.join(' ')).toContain('trainer evaluation scorecards');
  });

  it('exports report payloads to JSON-safe objects and CSV text', () => {
    const report = buildReport({
      reportId: 'executive_operations_summary',
      tickets: [
        baseTicket({
          id: 'P57-7',
          title: 'AC concern',
          category: 'Studio Amenities and Facilities',
          subCategory: 'Air Quality Poor',
          priority: 'High',
          status: 'New',
          tags: ['ai-approved', 'facility'],
        }),
      ],
      events: [],
      period: { from: '2026-05-01', to: '2026-05-19' },
      filters: DEFAULT_REPORT_FILTERS,
      generatedAt: '2026-05-19T09:30:00.000Z',
    });

    const payload = buildReportExportPayload(report);
    const csv = csvForReport(report);
    const html = htmlForReport(report);

    expect(payload.brand.name).toBe('Physique 57 India');
    expect(payload.document.footer).toContain('P57 Reporting Engine');
    expect(payload.report.id).toBe('executive_operations_summary');
    expect(payload.sourceRows[0].ticketId).toBe('P57-7');
    expect(csv).toContain('Physique 57 India');
    expect(csv).toContain('Generated by P57 Reporting Engine');
    expect(csv).toContain('Section,Name,Value');
    expect(csv.indexOf('Source Ticket Register')).toBeLessThan(csv.indexOf('Metrics And Analysis'));
    expect(csv).toContain('P57-7');
    expect(csv).toContain('AC concern');
    expect(html).toContain('<title>Executive Operations Summary');
    expect(html).toContain('Physique 57 India');
    expect(html).toContain('Generated by P57 Reporting Engine');
    expect(html).toContain('@page { size: A4 landscape; margin: 12mm; }');
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('class="block source-register"');
    expect(html.indexOf('Source Ticket Register')).toBeLessThan(html.indexOf('Management Summary'));
    expect(html).toContain('<table');
  });

  it('paginates source rows with clamped pages and stable row ranges', () => {
    const rows = Array.from({ length: 27 }, (_, index) => ({
      ticketId: `P57-${index + 1}`,
      title: `Ticket ${index + 1}`,
      status: 'New',
      priority: 'Medium' as const,
      slaState: 'On Track',
      sourceType: 'Live' as const,
      category: 'General Feedback',
      subCategory: 'Other',
      studio: 'Kwality House, Kemps Corner',
      owner: 'Nunu Yeptomi',
      team: 'Customer Service',
      memberName: '',
      createdAt: '2026-05-10T10:00:00.000Z',
      ageHours: index,
    }));

    expect(paginateReportRows(rows, 2, 10)).toMatchObject({
      page: 2,
      pageSize: 10,
      totalRows: 27,
      totalPages: 3,
      startRow: 11,
      endRow: 20,
    });
    expect(paginateReportRows(rows, 2, 10).rows.map((row) => row.ticketId)).toEqual([
      'P57-11',
      'P57-12',
      'P57-13',
      'P57-14',
      'P57-15',
      'P57-16',
      'P57-17',
      'P57-18',
      'P57-19',
      'P57-20',
    ]);
    expect(paginateReportRows(rows, 9, 10).page).toBe(3);
    expect(paginateReportRows([], 1, 10)).toMatchObject({
      page: 1,
      totalRows: 0,
      totalPages: 1,
      startRow: 0,
      endRow: 0,
      rows: [],
    });
  });

  it('normalizes report narrative payloads and fallbacks when arrays are missing', () => {
    const report = buildReport({
      reportId: 'executive_operations_summary',
      tickets: [
        baseTicket({
          id: 'P57-8',
          title: 'Owner follow-up needed',
          priority: 'High',
          status: 'In Progress',
        }),
      ],
      events: [],
      period: { from: '2026-05-01', to: '2026-05-19' },
      filters: DEFAULT_REPORT_FILTERS,
      generatedAt: '2026-05-19T09:30:00.000Z',
    });
    const malformedReport = {
      ...report,
      metrics: undefined,
      sections: undefined,
      sourceRows: undefined,
      assumptions: undefined,
      dataQualityNotes: undefined,
    } as unknown as typeof report;

    expect(() => fallbackNarrativeForReport(malformedReport)).not.toThrow();
    expect(reportPayloadForNarrative(malformedReport)).toMatchObject({
      metrics: [],
      sections: [],
      topRows: [],
      dataQualityNotes: [],
      assumptions: [],
    });

    const normalized = normalizeReportNarrativeResponse({ summary: 'Athena summary' }, report);
    expect(normalized.summary).toBe('Athena summary');
    expect(normalized.findings.length).toBeGreaterThan(0);
    expect(normalized.risks.length).toBeGreaterThan(0);
    expect(normalized.dataQualityNotes.length).toBeGreaterThan(0);
  });

  it('replaces raw browser fetch failures with report-specific fallback copy', () => {
    expect(reportRuntimeErrorMessage(new TypeError('Failed to fetch'), 'Athena summary service could not be reached.')).toBe(
      'Athena summary service could not be reached.'
    );
    expect(reportRuntimeErrorMessage(new Error('Unauthorized'), 'Fallback copy')).toBe('Unauthorized');
  });
});
