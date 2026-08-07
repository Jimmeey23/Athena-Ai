import { describe, expect, it } from 'vitest';
import {
  captureMemberFeedbackFromText,
  getIntakeFieldDefinition,
  getIntakeFieldDefinitions,
  getMissingIntakeFields,
  inferIntakeContextFromText,
  isIntakePublishable,
  isMissingIntakeValue,
  type IntakeContext,
} from './intake-rules';

describe('intake publishability rules', () => {
  it('requires route, category, and subcategory for an empty context', () => {
    expect(getMissingIntakeFields({})).toEqual(['intakeRoute', 'category', 'subCategory']);
    expect(isIntakePublishable({})).toBe(false);
  });

  it('requires complaint details after route, category, and subcategory are present', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Customer Service and Communication',
      subCategory: 'Delay in Response',
    };

    expect(getMissingIntakeFields(context)).toEqual([
      'clientsAffected',
      'reportedBy',
      'priority',
      'description',
      'resolutionRequired',
    ]);
    expect(isIntakePublishable(context)).toBe(false);
  });

  it('does not require client impact for purely internal operational issues', () => {
    const text = 'AC not cooling in Bandra studio';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      incidentDateTime: '2026-05-23T09:30',
      hvacSymptom: 'Not cooling',
      affectedArea: 'Reception and studio one',
      operationalImpact: 'Front desk moved check-in away from the warm area.',
      currentWorkaround: 'Fans are running until the technician arrives.',
      resolutionRequirement: 'Vendor inspection and repair needed today.',
    };

    expect(getMissingIntakeFields(context)).toEqual(['clientsAffected']);
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual([]);
  });

  it('treats placeholder values as missing while accepting a real studio', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Studio Amenities and Facilities',
      subCategory: 'Cleanliness',
      studio: 'Unspecified Studio',
      memberName: 'Aarohi Mehta',
      desiredResolution: 'Member requested a manager follow-up.',
      memberSentiment: 'Member Expressed Dissatisfaction',
      reportedBy: 'AI Intake',
      priority: 'Medium',
      description: 'Member-reported issue',
    };

    expect(isMissingIntakeValue('Unspecified Studio')).toBe(true);
    expect(isMissingIntakeValue('Member-reported issue')).toBe(true);
    expect(isMissingIntakeValue('AI Intake')).toBe(true);
    expect(isMissingIntakeValue('Bandra')).toBe(false);
    expect(getMissingIntakeFields(context)).toEqual(['clientsAffected', 'studio', 'incidentDateTime', 'reportedBy']);

    expect(getMissingIntakeFields({ ...context, studio: 'Bandra' })).toEqual(['clientsAffected', 'incidentDateTime', 'reportedBy']);
  });

  it('marks a complete member-facing complaint context publishable', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Customer Service and Communication',
      subCategory: 'Delay in Response',
      memberId: 'mom_123',
      clientsAffected: 'Yes - directly affected',
      desiredResolution: 'Member requested a WhatsApp update and timeline for resolution.',
      memberSentiment: 'Member Expressed Frustration/Anger',
      reportedBy: 'Priya Shah',
      priority: 'High',
      description: 'Member reported that her WhatsApp query was not answered for two days.',
      resolutionRequired: 'Yes',
    };

    expect(getMissingIntakeFields(context)).toEqual([]);
    expect(isIntakePublishable(context)).toBe(true);
  });

  it('accepts concise member voice when refund reason details were captured separately', () => {
    const context: IntakeContext = {
      intakeRoute: 'Request',
      category: 'Pricing and Memberships',
      subCategory: 'Refund and Cancellation Policy Issue',
      clientsAffected: 'Yes - directly affected',
      memberId: '29887042',
      memberName: 'Smita Modi',
      memberContact: 'smita.modi@ymail.com',
      desiredResolution: 'Full refund of entire 3-month membership',
      reportedBy: 'Jimmeey',
      priority: 'High',
      initialReport: 'smita modi wants a refund of her membership',
      description: 'i want a refund by tomorrow orelse il sue you',
      refundRequestReason: 'overcrowding in class',
      resolutionRequired: 'Yes',
    };

    expect(getMissingIntakeFields(context)).toEqual([]);
    expect(isIntakePublishable(context)).toBe(true);
  });

  it('does not ask for reportedBy when auth has supplied a real user', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Customer Service and Communication',
      subCategory: 'Delay in Response',
      memberId: 'mom_123',
      clientsAffected: 'Yes - directly affected',
      desiredResolution: 'Member requested a written update.',
      memberSentiment: 'Member Expressed Dissatisfaction',
      reportedBy: 'frontdesk@physique57india.com',
      priority: 'High',
      urgencyReason: 'Member described an unresolved delay affecting renewal confidence.',
      description: 'Member reported that her WhatsApp query was not answered for two days.',
      resolutionRequired: 'Yes',
    };

    expect(getMissingIntakeFields(context)).toEqual([]);
    expect(isIntakePublishable(context)).toBe(true);
  });

  it('always asks the mandatory resolution-required question last before publishing', () => {
    const context: IntakeContext = {
      intakeRoute: 'Feedback',
      category: 'General Feedback',
      subCategory: 'Suggestion',
      clientsAffected: 'No clients affected',
      reportedBy: 'frontdesk@physique57india.com',
      description: 'Member suggested adding more weekend recovery sessions.',
    };

    expect(getMissingIntakeFields(context)).toEqual(['resolutionRequired']);
    expect(getIntakeFieldDefinitions(context)).toEqual([
      expect.objectContaining({
        id: 'resolutionRequired',
        label: 'Does this ticket require a resolution?',
        type: 'select',
        required: true,
        options: ['Yes', 'No'],
      }),
    ]);
    expect(isIntakePublishable(context)).toBe(false);
    expect(isIntakePublishable({ ...context, resolutionRequired: 'No' })).toBe(true);
  });

  it('keeps the resolution-required question after every other missing intake field', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Customer Service and Communication',
      subCategory: 'Delay in Response',
      clientsAffected: 'No clients affected',
    };

    expect(getMissingIntakeFields(context).at(-1)).toBe('resolutionRequired');
    expect(getMissingIntakeFields(context)).toEqual([
      'reportedBy',
      'priority',
      'description',
      'resolutionRequired',
    ]);
  });

  it('requires trainer punctuality details when a late-start report is logged', () => {
    const context: IntakeContext = {
      intakeRoute: 'Complaint',
      category: 'Trainer Feedback',
      subCategory: 'Trainer Punctuality Issues',
      clientsAffected: 'Yes - directly affected',
      reportedBy: 'Priya Shah',
      priority: 'High',
      description: 'Trainer arrived late and the 7:15 class started behind schedule.',
      classType: 'Studio Barre 57',
      trainer: 'Siddhartha Kusuma',
      classDateTime: '2026-06-08T07:15',
      resolutionRequired: 'Yes',
    };

    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual(expect.arrayContaining([
      'reportedTime',
      'delayMinutes',
      'advanceNoticeGiven',
      'latenessReason',
      'membersAffected',
      'membersUpset',
      'serviceRecoveryNeeded',
    ]));
  });

  it('still treats AI Intake and empty auth fallbacks as missing reportedBy values', () => {
    const base: IntakeContext = {
      intakeRoute: 'Feedback',
      category: 'General Feedback',
      subCategory: 'Suggestion',
      priority: 'Low',
      description: 'Member suggested adding more weekend recovery sessions.',
    };

    expect(getMissingIntakeFields({ ...base, reportedBy: 'AI Intake' })).toContain('reportedBy');
    expect(getMissingIntakeFields({ ...base, reportedBy: 'Authenticated user' })).toContain('reportedBy');
    expect(getMissingIntakeFields({ ...base, reportedBy: 'ops@physique57india.com' })).not.toContain('reportedBy');
  });

  it('captures only pasted member statements as member feedback', () => {
    const context: IntakeContext = {};

    expect(captureMemberFeedbackFromText('Complaint', context)).toBeNull();
    expect(captureMemberFeedbackFromText('Route this as Complaint', context)).toBeNull();
    expect(
      captureMemberFeedbackFromText(
        'Here are the missing details:\nPriority: High\nDocumented By: Priya Shah',
        context
      )
    ).toBeNull();

    expect(
      captureMemberFeedbackFromText(
        'Member said she has called twice about a refund and still has not received a clear response.',
        context
      )
    ).toBe('Member said she has called twice about a refund and still has not received a clear response.');
  });

  it('captures member feedback phrasing even when it contains a colon', () => {
    expect(
      captureMemberFeedbackFromText(
        'Member said: she has called twice about a refund and still has not received a clear response.',
        {}
      )
    ).toBe('Member said: she has called twice about a refund and still has not received a clear response.');

    expect(
      captureMemberFeedbackFromText(
        'Client stated: the studio space felt too warm during the full session.',
        {}
      )
    ).toBe('Client stated: the studio space felt too warm during the full session.');
  });

  it('infers real historical ticket patterns without manual route selection', () => {
    expect(
      inferIntakeContextFromText(
        'Trial client walked out mid-class because the music was too loud and the session felt more intense than expected.'
      )
    ).toMatchObject({
      intakeRoute: 'Complaint',
      category: 'Class Experience',
      subCategory: 'Audio Issues',
      priority: 'High',
    });

    expect(
      inferIntakeContextFromText(
        'Regional operations reported Momence CRM data is inaccurate for lapsed clients and follow-ups are falling through.'
      )
    ).toMatchObject({
      intakeRoute: 'Feedback',
      category: 'Operating Systems',
      subCategory: 'Momence Issues',
      priority: 'Medium',
    });

    expect(
      inferIntakeContextFromText(
        'Client reported a missing cash envelope from the locker after a cycle trial class.'
      )
    ).toMatchObject({
      intakeRoute: 'Complaint',
      category: 'Safety and Security',
      subCategory: 'Theft Prevention Measures',
      priority: 'Critical',
    });

    expect(
      inferIntakeContextFromText(
        'Hosted class feedback: attendees said the studio was too far and several prospects requested drop-in pricing details.'
      )
    ).toMatchObject({
      intakeRoute: 'Feedback',
      category: 'Hosted Class & Partnerships',
      subCategory: 'Prospect Conversion Opportunity',
      priority: 'Medium',
    });

    expect(
      inferIntakeContextFromText(
        [
          "Host Class Name: Ahana's Powercycle Hosted Class.",
          'Date: 17th May',
          'Start Time: 11:30 AM',
          'Trainer Name: Rohan',
          'Location: Kwality House, Kemps Corner.',
          'Attendees: 10',
          'Comments/Feedback:',
          'Client Taneeya Rele requested details regarding our classes, which have been shared via WhatsApp.',
          'Several attendees may opt for drop-in classes or Single Classes.',
        ].join('\n')
      )
    ).toMatchObject({
      intakeRoute: 'Feedback',
      category: 'Hosted Class & Partnerships',
      subCategory: 'Prospect Conversion Opportunity',
      priority: 'Medium',
      studio: 'Kwality House, Kemps Corner',
    });
  });

  it('requires Momence class search for class-related feedback before drafting', () => {
    const context = {
      ...inferIntakeContextFromText('Member said Rohan class was too intense and the music was too loud.'),
      description: 'Member said Rohan class was too intense and the music was too loud.',
      reportedBy: 'ops@physique57india.com',
    };

    expect(getMissingIntakeFields(context)).toContain('classType');
    expect(getMissingIntakeFields({ ...context, sessionId: 'session_123', classType: 'Studio Barre 57' })).not.toContain('classType');
  });

  it('infers direct client impact and requires Momence member search for singular member-related feedback before drafting', () => {
    const context = {
      ...inferIntakeContextFromText('Member Asha reported a refund issue and wants a follow-up.'),
      description: 'Member Asha reported a refund issue and wants a follow-up.',
      reportedBy: 'ops@physique57india.com',
    };

    expect(context.clientsAffected).toBe('Yes - directly affected');
    expect(getMissingIntakeFields(context)).not.toContain('clientsAffected');
    expect(getMissingIntakeFields(context)).toContain('memberName');
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toContain('memberName');
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toContain('clientsAffected');
    expect(getMissingIntakeFields({ ...context, clientsAffected: 'Yes - directly affected' })).toContain('memberName');
    expect(getMissingIntakeFields({
      ...context,
      clientsAffected: 'Yes - directly affected',
      memberId: 'mom_123',
      memberName: 'Asha Mehta',
    })).not.toContain('memberName');
  });

  it('asks for member, requested resolution, and substance for brief refund complaints without fixed Momence/payment fields', () => {
    const text = 'A member complained about refund delay';
    const context = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      description: text,
      reportedBy: 'ops@physique57india.com',
    };

    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual([
      'memberName',
      'desiredResolution',
      'description',
      'resolutionRequired',
    ]);
  });

  it('does not force fixed commercial verification fields for named refund requests', () => {
    const text = 'SMITA PATIL IS ASKING FOR A REFUND OF HER MEMBERSHIP FEES.';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      clientsAffected: 'Yes - directly affected',
      description: text,
      reportedBy: 'Jimmeey',
      priority: 'High',
      resolutionRequired: 'Yes',
    };

    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual(expect.arrayContaining([
      'memberName',
      'description',
    ]));
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toEqual(expect.arrayContaining([
      'studio',
      'membership',
      'incidentDateTime',
      'momencePurchaseContext',
      'memberSentiment',
    ]));
    expect(isIntakePublishable(context)).toBe(false);
  });

  it('lets AI choose follow-up context for member package and class access disputes', () => {
    const text = [
      'Client Shaziya Andhyrujina is currently on a 3-month unlimited package.',
      'She came in for the 4:30 PM Power Cycle but was denied entry because it was her first Power Cycle class.',
      'She said the restriction was not clearly communicated when she purchased the membership and requested a refund.',
    ].join(' ');
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      description: text,
      priority: 'High',
      reportedBy: 'Front Desk',
    };

    expect(context.membership).toBe('Studio 3 Month Unlimited Membership');
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toContain('memberName');
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toEqual(expect.arrayContaining([
      'studio',
      'incidentDateTime',
      'momencePurchaseContext',
      'memberSentiment',
    ]));
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toContain('classType');
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toContain('membership');
  });

  it('does not treat instructor lateness as a member commercial access dispute', () => {
    const text = 'instructor arrived late for class';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      description: text,
      clientsAffected: 'Yes - directly affected',
      memberId: 'mom_123',
      memberName: 'Mitali Kumar',
      studio: 'Kwality House, Kemps Corner',
      sessionId: 'session_456',
      classType: 'powerCycle',
      reportedBy: 'ops@physique57india.com',
      priority: 'Low',
    };

    expect(context).toMatchObject({
      category: 'Trainer Feedback',
      subCategory: 'Trainer Punctuality Issues',
    });
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual(expect.arrayContaining([
      'trainer',
      'classDateTime',
      'reportedTime',
      'delayMinutes',
      'advanceNoticeGiven',
      'latenessReason',
      'serviceRecoveryNeeded',
      'resolutionRequired',
    ]));
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).not.toEqual(expect.arrayContaining([
      'membership',
      'incidentDateTime',
      'momencePurchaseContext',
      'desiredResolution',
      'memberSentiment',
    ]));
  });

  it('infers specified membership packages from the initial report', () => {
    expect(
      inferIntakeContextFromText('Client is currently on a 3-month unlimited package and requested a refund.')
    ).toMatchObject({
      membership: 'Studio 3 Month Unlimited Membership',
    });

    expect(
      inferIntakeContextFromText('Member has a power cycle 3 months unlimited membership.')
    ).toMatchObject({
      membership: 'powerCycle 3 months Unlimited',
    });
  });

  it('normalizes common studio, class, trainer, and area shorthand from natural reports', () => {
    expect(
      inferIntakeContextFromText('member said the mat class at kemps with Rohan was too crowded in studio 1')
    ).toMatchObject({
      studio: 'Kwality House, Kemps Corner',
      classType: 'Studio Mat 57',
      trainer: 'Rohan Dahima',
      affectedArea: 'Studio 1',
    });

    expect(
      inferIntakeContextFromText('pc class at bandra had audio issues in the powercycle room')
    ).toMatchObject({
      studio: 'Supreme HQ, Bandra',
      classType: 'Studio PowerCycle',
      affectedArea: 'studio - 2 or powerCycle Studio',
    });

    expect(
      inferIntakeContextFromText('bb class at blr with Siddhartha had a late start')
    ).toMatchObject({
      studio: 'Kenkere House, Bengaluru',
      classType: 'Studio Back Body Blaze',
      trainer: 'Siddhartha Kusuma',
    });
  });

  it('requires client impact confirmation when an operational issue mentions member impact', () => {
    const text = 'AC not cooling in Bandra studio and two members said they felt uncomfortable after class.';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      incidentDateTime: '2026-05-23T09:30',
      hvacSymptom: 'Not cooling',
      affectedArea: 'Reception and studio one',
      operationalImpact: 'Front desk moved check-in away from the warm area.',
      currentWorkaround: 'Fans are running until the technician arrives.',
      resolutionRequirement: 'Vendor inspection and repair needed today.',
    };

    expect(getMissingIntakeFields(context)).toEqual(['clientsAffected']);
    expect(getMissingIntakeFields(context, { includeClientImpact: false })).toEqual([]);
    expect(getMissingIntakeFields({ ...context, clientsAffected: 'No clients affected' })).toEqual([]);
  });

  it('requires Momence member search when affected clients are confirmed', () => {
    const text = 'AC not cooling in Bandra studio';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      incidentDateTime: '2026-05-23T09:30',
      hvacSymptom: 'Not cooling',
      affectedArea: 'Reception and studio one',
      operationalImpact: 'Two members said they felt uncomfortable after class.',
      currentWorkaround: 'Fans are running until the technician arrives.',
      resolutionRequirement: 'Vendor inspection and repair needed today.',
      clientsAffected: 'Yes - indirectly affected',
    };

    expect(getMissingIntakeFields(context)).toEqual(['memberName']);
    expect(getMissingIntakeFields({
      ...context,
      memberId: 'mom_456 | mom_789',
      memberName: 'Asha Mehta | Tara Rao',
    })).toEqual([]);
  });

  it('requires affected class selection and impact details when a class was affected', () => {
    const text = 'AC not cooling in Bandra studio and the evening classes were affected.';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      incidentDateTime: '2026-05-23T09:30',
      hvacSymptom: 'Not cooling',
      affectedArea: 'Main studio',
      operationalImpact: 'The 6:30 PM class had to pause twice because the room was too warm.',
      currentWorkaround: 'Fans are running until the technician arrives.',
      resolutionRequirement: 'Vendor inspection and repair needed today.',
      clientsAffected: 'Yes - directly affected',
    };

    expect(getMissingIntakeFields(context)).toEqual(expect.arrayContaining([
      'memberName',
      'classType',
      'classImpactType',
      'classImpactDetails',
    ]));

    expect(getMissingIntakeFields({
      ...context,
      memberId: 'mom_456',
      memberName: 'Asha Mehta',
      sessionId: 'session_123',
      classType: 'Barre 57',
      classImpactType: 'Paused during session',
      classImpactDetails: 'Class paused twice and two members stepped out for water.',
    })).toEqual([]);
  });

  it('always asks the client impact check before publish when unanswered', () => {
    const context: IntakeContext = {
      intakeRoute: 'Internal Reporting',
      category: 'Repair and Maintenance',
      subCategory: 'Door Lock Issues',
      studio: 'Kwality House, Kemps Corner',
      reportedBy: 'ops@physique57india.com',
      priority: 'Medium',
      incidentDateTime: '2026-05-23T09:30',
      lockFaultType: 'Latch not catching',
      accessStatus: 'Access restricted but workaround available',
      securityRisk: 'No immediate risk',
      resolutionRequirement: 'Vendor needs to repair the latch today.',
    };

    expect(getMissingIntakeFields(context)).toEqual(['clientsAffected']);
  });

  it('asks washing machine operational questions without member or class fields', () => {
    const text = 'washing machine not working';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
    };

    expect(context).toMatchObject({
      intakeRoute: 'Internal Reporting',
      category: 'Repair and Maintenance',
      subCategory: 'Broken Equipment',
    });

    expect(getMissingIntakeFields(context)).toEqual([
      'clientsAffected',
      'studio',
      'incidentDateTime',
      'machineSymptom',
      'resolutionRequirement',
    ]);
    expect(getMissingIntakeFields(context)).not.toContain('memberName');
    expect(getMissingIntakeFields(context)).not.toContain('classType');
    expect(getIntakeFieldDefinitions(context).map((field) => field.id)).toContain('machineSymptom');
  });

  it('asks bike-specific repair questions without leaking-water machine options', () => {
    const text = 'BIKE NO 7 IS NOT WORKING AT THE STUDIO';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      clientsAffected: 'No clients affected',
      studio: 'Kwality House, Kemps Corner',
      incidentDateTime: '2026-06-02T10:37',
    };

    expect(context).toMatchObject({
      intakeRoute: 'Internal Reporting',
      category: 'Repair and Maintenance',
      subCategory: 'Broken Equipment',
    });
    expect(getMissingIntakeFields(context)).toEqual([
      'bikeSymptom',
      'resolutionRequirement',
    ]);
    expect(getMissingIntakeFields(context)).not.toContain('machineSymptom');
    expect(getIntakeFieldDefinitions(context).find((field) => field.id === 'bikeSymptom')?.options).not.toContain('Leaking water');
  });

  it('uses structured options for operational impact, workaround, and resolution requirement', () => {
    const text = 'BIKE NO 7 IS NOT WORKING AT THE STUDIO';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
      clientsAffected: 'No clients affected',
      studio: 'Kwality House, Kemps Corner',
      incidentDateTime: '2026-06-02T10:37',
    };
    const fields = getIntakeFieldDefinitions(context);

    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'resolutionRequirement',
        type: 'select',
        options: expect.arrayContaining(['Vendor inspection / repair required', 'No action needed / record only']),
      }),
    ]));
    expect(fields.map((f) => f.id)).not.toContain('operationalImpact');
    expect(fields.map((f) => f.id)).not.toContain('currentWorkaround');
  });

  it('uses app constants for studio, instructor, reporter, and studio-area options', () => {
    expect(getIntakeFieldDefinition('studio')).toEqual(expect.objectContaining({
      type: 'select',
      options: expect.arrayContaining(['Kwality House, Kemps Corner', 'the Studio by Copper & Cloves, Bengaluru']),
    }));
    expect(getIntakeFieldDefinition('trainer')).toEqual(expect.objectContaining({
      type: 'select',
      options: expect.arrayContaining(['Janhavi Jain', 'Kabir Varma', 'Veena Narasimhan']),
    }));

    const text = 'AC is not cooling in Studio 1 at Kwality House';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      category: 'Repair and Maintenance',
      subCategory: 'AC and HVAC Issues',
      studio: 'Kwality House, Kemps Corner',
      clientsAffected: 'No clients affected',
      incidentDateTime: '2026-06-02T10:37',
    };

    expect(context.affectedArea).toBe('Studio 1');

    const fields = getIntakeFieldDefinitions({ ...context, affectedArea: undefined });

    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'reportedBy',
        type: 'select',
        options: expect.arrayContaining(['Akshay Rane', 'Tahira Sayyed', 'Santhosh Kumar']),
      }),
      expect.objectContaining({
        id: 'affectedArea',
        type: 'select',
        options: expect.arrayContaining(['Studio 1', 'Strength Studio', 'powerCycle studio']),
      }),
    ]));
  });

  it('classifies loose office skirting as maintenance without digital fields', () => {
    const text = 'the office walla skirting has come off at Kwality';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
    };

    expect(context).toMatchObject({
      intakeRoute: 'Internal Reporting',
      category: 'Repair and Maintenance',
      subCategory: 'General Maintenance Delays',
      studio: 'Kwality House, Kemps Corner',
    });
    expect(getMissingIntakeFields(context)).not.toContain('appIssueSurface');
    expect(getMissingIntakeFields(context)).not.toContain('appErrorObserved');
  });

  it('asks door lock operational questions and infers Kwality without entity fields', () => {
    const text = 'door lock not closing at Kwality';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
    };

    expect(context).toMatchObject({
      category: 'Repair and Maintenance',
      subCategory: 'Door Lock Issues',
      studio: 'Kwality House, Kemps Corner',
    });

    expect(getMissingIntakeFields(context)).toEqual([
      'clientsAffected',
      'incidentDateTime',
      'lockFaultType',
      'accessStatus',
      'securityRisk',
      'resolutionRequirement',
    ]);
    expect(getMissingIntakeFields(context)).not.toContain('memberName');
    expect(getMissingIntakeFields(context)).not.toContain('classType');
  });

  it('uses HVAC-specific repair fields for AC breakdown reports', () => {
    const text = 'AC not cooling in Bandra studio';
    const context: IntakeContext = {
      ...inferIntakeContextFromText(text),
      initialReport: text,
      reportedBy: 'ops@physique57india.com',
    };

    expect(context).toMatchObject({
      category: 'Repair and Maintenance',
      subCategory: 'AC and HVAC Issues',
      studio: 'Supreme HQ, Bandra',
    });

    expect(getMissingIntakeFields(context)).toEqual([
      'clientsAffected',
      'incidentDateTime',
      'hvacSymptom',
      'affectedArea',
      'resolutionRequirement',
    ]);
  });
});
