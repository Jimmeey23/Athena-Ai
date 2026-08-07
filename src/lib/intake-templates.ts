export type ContextTemplateFieldType = 'text' | 'textarea' | 'select' | 'datetime-local' | 'number' | 'rating';

export interface ContextTemplateField {
  id: string;
  label: string;
  type: ContextTemplateFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  section?: string;
  scoreWeight?: number;
  dependsOn?: string;
  dependsOnValue?: string;
}

export interface ContextTemplate {
  id: string;
  label: string;
  description: string;
  intakeRoute: string;
  category: string;
  subCategory: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  prompts: string[];
  fields?: ContextTemplateField[];
}

export interface HostedClassSessionSummary {
  id: string;
  classType: string;
  trainer?: string;
  studio?: string;
  startsAt?: string;
  bookingCount?: number;
  capacity?: number;
  waitlistBookingCount?: number;
  waitlistCapacity?: number;
}

export interface HostedClassAttendeeFeedback {
  bookingId: string;
  memberName: string;
  memberContact?: string;
  status: string;
  comment?: string;
  followUpPreference?: string;
  conversionSignal?: string;
}

export interface HostedClassFeedbackInput {
  partnerName?: string;
  partnerType?: string;
  acquisitionSource?: string;
  audienceFit?: string;
  session: HostedClassSessionSummary;
  attendees: HostedClassAttendeeFeedback[];
  classFeedback: string;
  hostFeedback?: string;
  lateComerFeedback?: string;
  otherFeedback?: string;
  conversionSummary?: string;
  socialAmplification?: string;
  followUpPlan?: string;
}

export const CONTEXT_TEMPLATES: ContextTemplate[] = [
  {
    id: 'hosted-class-feedback',
    label: 'Hosted class feedback',
    description: 'Partner audience insight, attendee response, and conversion follow-up.',
    intakeRoute: 'Feedback',
    category: 'Hosted Class & Partnerships',
    subCategory: 'Hosted Class Feedback',
    priority: 'Medium',
    prompts: [
      'Host name:',
      'Class details and studio space:',
      'Attendee details with comments:',
      'Feedback on host:',
      'Late arrivals:',
      'Interested to buy:',
      'Proximity issue or audience fit:',
      'Collaborate again in future:',
    ],
    fields: [
      { id: 'partnerName', label: 'Partner / host name', type: 'text', required: true },
      { id: 'classType', label: 'Class details / session', type: 'select', required: true },
      { id: 'studio', label: 'Studio name', type: 'select', required: true },
      { id: 'memberFeedback', label: 'Member/guest verbatim feedback', type: 'textarea', required: true, placeholder: 'Summarise each attendee response and include comments captured from the session.' },
      { id: 'hostFeedback', label: 'Feedback on host', type: 'select', required: true, options: ['Partner expressed strong satisfaction', 'Partner expressed mixed feedback', 'Partner requested another collaboration', 'Partner requested changes before repeating', 'No partner feedback captured'] },
      { id: 'lateComerFeedback', label: 'Late arrivals', type: 'select', required: true, options: ['No late arrivals noted', '1-2 late arrivals', '3+ late arrivals', 'Late arrivals affected class flow', 'Unable to determine'] },
      { id: 'conversionSummary', label: 'Interested to buy', type: 'select', required: true, options: ['Strong package interest', 'Intro offer interest', 'Needs nurturing', 'Low purchase intent', 'Package sold', 'Unable to determine'] },
      { id: 'audienceFit', label: 'Proximity issue / audience fit', type: 'select', required: true, options: ['Strong P57 fit', 'Good fit with nurturing', 'Mixed audience fit', 'Low conversion fit', 'Proximity was an issue', 'Unable to determine'] },
      { id: 'followUpPlan', label: 'Follow-up preference indicated', type: 'select', required: true, options: ['Definitely collaborate again', 'Maybe collaborate again', 'Do not collaborate again', 'Needs further review', 'Unable to determine'] },
      { id: 'acquisitionSource', label: 'Acquisition source', type: 'select', required: true, options: ['Partner referral', 'Instagram / social', 'Existing member guest', 'Corporate community', 'Walk-in / studio invite', 'Other'] },
      { id: 'hostedFeedbackArea', label: 'Overall class comments', type: 'textarea', required: true, placeholder: 'Capture the overall class details, including tone, energy, and any notable attendee reactions.' },
      { id: 'otherFeedback', label: 'Additional notes', type: 'textarea', placeholder: 'Add any extra context, partner observations, or next-step notes.' },
    ],
  },
  {
    id: 'instructor-late-for-class',
    label: 'Instructor late for class',
    description: 'Member-reported class delay, instructor punctuality concern, and recovery action.',
    intakeRoute: 'Complaint',
    category: 'Trainer Feedback',
    subCategory: 'Trainer Punctuality Issues',
    priority: 'High',
    prompts: [
      'Momence studio session and scheduled start time:',
      'Momence member who shared the feedback:',
      'Instructor name:',
      'Actual start time / delay duration:',
      'Trainer arrival time:',
      'Whether the instructor informed in advance, and at what time:',
      'Reason provided for lateness:',
      'Member verbatim concern:',
      'Impact member reported on their practice experience:',
      'Recovery action offered:',
      'Member response to resolution:',
      'Other members affected:',
    ],
    fields: [
      { id: 'classType', label: 'Momence studio session', type: 'select', required: true },
      { id: 'memberName', label: 'Momence member who shared feedback', type: 'text', required: true },
      { id: 'memberContact', label: 'Momence member contact', type: 'text' },
      { id: 'trainer', label: 'Instructor scheduled for session', type: 'select', required: true },
      { id: 'scheduledStartTime', label: 'Scheduled start time', type: 'datetime-local', required: true },
      { id: 'actualStartTime', label: 'Actual start time', type: 'datetime-local', required: true },
      { id: 'delayMinutes', label: 'Delay in minutes', type: 'number', required: true },
      { id: 'instructorArrivalTime', label: 'Instructor arrival time', type: 'datetime-local', required: true },
      { id: 'advanceNoticeGiven', label: 'Did instructor inform in advance?', type: 'select', required: true, options: ['Yes - before scheduled start', 'Yes - after scheduled start', 'No advance notice', 'Unable to confirm'] },
      { id: 'advanceNoticeTime', label: 'Advance notice time', type: 'datetime-local' },
      { id: 'latenessReason', label: 'Reason provided for lateness', type: 'textarea', required: true },
      { id: 'memberFeedback', label: 'Member verbatim concern', type: 'textarea', required: true },
      { id: 'reportedImpact', label: 'Member-reported impact on practice', type: 'textarea', required: true },
      { id: 'recoveryAction', label: 'Recovery action offered', type: 'textarea', required: true },
      { id: 'memberResponse', label: 'Member response to resolution', type: 'select', required: true, options: ['Member Satisfied with Resolution', 'Member Accepted but Not Fully Satisfied', 'Member Requested Escalation', 'Member Declined Offered Solution', 'Follow-up Pending'] },
      { id: 'clientsAffected', label: 'Members affected', type: 'select', required: true, options: ['Single member', '2-5 members', '6+ members', 'Full class', 'Unknown'] },
      { id: 'followUpNeeded', label: 'Follow-up needed', type: 'select', required: true, options: ['No follow-up needed', 'Instructor follow-up', 'Studio manager follow-up', 'Client success follow-up', 'Training team review'] },
    ],
  },
  {
    id: 'late-arrival-entry-denied',
    label: 'Class entry denied due to late arrival',
    description: 'Late-arrival policy concern, front-desk handling, and requested resolution — linked to Momence session and member.',
    intakeRoute: 'Complaint',
    category: 'Booking & Schedule',
    subCategory: 'Late Arrival Policy',
    priority: 'Medium',
    prompts: [
      'Studio location:',
      'Momence session / booking:',
      'Momence member affected:',
      'Member arrival time:',
      'Entry deny reason:',
      'Policy conveyed in advance:',
      'Member verbatim feedback / concern:',
      'Policy conveyed when / where:',
      'Class credited back or rescheduled:',
      'Escalation required:',
      'Preferred service recovery route:',
    ],
    fields: [
      { id: 'classType', label: 'Booked Momence session', type: 'select', required: true },
      { id: 'memberName', label: 'Momence member affected', type: 'text', required: true },
      { id: 'memberContact', label: 'Member contact (email / phone)', type: 'text' },
      { id: 'studio', label: 'Studio location', type: 'select', required: true },
      { id: 'memberArrivalTime', label: 'Member arrival time', type: 'datetime-local', required: true },
      { id: 'entryDeniedReason', label: 'Entry deny reason', type: 'textarea', required: true, placeholder: 'What exact reason was given for denying entry?' },
      { id: 'policyConveyedInAdvance', label: 'Was the policy conveyed in advance?', type: 'select', required: true, options: ['Yes', 'No', 'Unable to confirm'] },
      { id: 'policyConveyedWhen', label: 'Policy conveyed when', type: 'datetime-local' },
      { id: 'policyConveyedWhere', label: 'Policy conveyed where', type: 'select', options: ['WhatsApp', 'Email', 'Phone Call', 'Front desk', 'In-person before class', 'In-app message', 'Unable to determine'] },
      { id: 'memberFeedback', label: 'Member verbatim feedback / concern', type: 'textarea', required: true, placeholder: 'Use the member\'s exact words. E.g. "I was only 3 minutes late — this is unfair."' },
      { id: 'classCreditedOrRescheduled', label: 'Was the class credited back / rescheduled?', type: 'select', required: true, options: ['Credited back', 'Rescheduled', 'Both', 'Neither', 'Unable to determine'] },
      { id: 'requestedResolution', label: 'Requested resolution or follow-up', type: 'textarea', placeholder: 'What is the member asking for? E.g. class credit, refund, policy exception, callback from manager.' },
      { id: 'memberSentiment', label: 'Member sentiment', type: 'select', required: true, options: ['Member Expressed Satisfaction', 'Member Expressed Neutral/Mixed Feelings', 'Member Expressed Dissatisfaction', 'Member Expressed Frustration/Anger', 'Unable to Determine', 'Member Declined to Share'] },
      { id: 'escalationRequired', label: 'Escalation required?', type: 'select', required: true, options: ['Yes', 'No', 'Unable to determine'] },
      { id: 'followUpPreference', label: 'Preferred service recovery route', type: 'select', options: ['Phone Call', 'WhatsApp', 'Email', 'In-Person (Next Visit)', 'Member Will Reach Out', 'No Follow-up Needed'] },
    ],
  },
  {
    id: 'trainer-class-assessment',
    label: 'Trainer class assessment',
    description: 'Structured internal assessment for instructor delivery across PowerCycle and Strength/Fit coaching rubrics.',
    intakeRoute: 'Internal Reporting',
    category: 'Trainer Feedback',
    subCategory: 'Knowledge and Competence',
    priority: 'Low',
    prompts: [
      'Instructor assessed:',
      'Momence session observed:',
      'Template type: PowerCycle / Strength-Fit',
      'PowerCycle or Strength/Fit rubric scores:',
      'Weighted evaluation score out of 100:',
      'Key strengths observed:',
      'Areas for improvement:',
      'Coaching action plan:',
    ],
    fields: [
      { id: 'classType', label: 'Studio session / practice type', type: 'select', required: true, section: 'Session Details' },
      { id: 'studio', label: 'Studio space', type: 'select', required: true, section: 'Session Details' },
      { id: 'trainer', label: 'Instructor assessed', type: 'select', required: true, section: 'Session Details' },
      { id: 'classDateTime', label: 'Class date and start time', type: 'datetime-local', required: true, section: 'Session Details' },
      { id: 'templateType', label: 'Assessment template', type: 'select', required: true, options: ['PowerCycle', 'Strength/Fit'], section: 'Evaluation Setup' },
      { id: 'evaluatorName', label: 'Evaluator name', type: 'text', required: true, section: 'Evaluation Setup' },
      { id: 'pcAttendance', label: 'Class attendance and bike fill rate', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 12.5, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcRetention', label: 'Client retention and repeat riders', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 12.5, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcConnection', label: 'Client outreach, communication and connection', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 12.5, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcFeedback', label: 'Client feedback', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 12.5, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcMotivation', label: 'Ride motivation / USP integration', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcMusicality', label: 'Musicality and beat matching', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 10, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcEnergy', label: 'Energy, vocals and command', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 10, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcProgramming', label: 'Ride programming and sequencing', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcSafety', label: 'Safety, setup and form corrections', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'pcWorkEthics', label: 'Work ethics, meetings and core values', type: 'rating', required: true, section: 'PowerCycle Scorecard', scoreWeight: 6, dependsOn: 'templateType', dependsOnValue: 'PowerCycle' },
      { id: 'sfPreClassSetup', label: 'Pre-class setup', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfVerbalCues', label: 'Verbal cues', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfVisualDemonstrations', label: 'Visual demonstrations', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfInjuryModifications', label: 'Injury modifications', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfLevelModifications', label: 'Level-appropriate personal modifications', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfUspMotivationConnection', label: 'USP integration, motivation and connection', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfMusicChoices', label: 'Music choices', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 7, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfSpaceEquipment', label: 'Studio space and equipment organisation', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 7, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfTimeManagement', label: 'Time management and class flow', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 7, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfUseOfNames', label: 'Use of client names', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 7, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfOverallEnergy', label: 'Overall energy', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfMindfulMoment', label: 'Mindful moment', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'sfPostClassSpiel', label: 'Post-class spiel', type: 'rating', required: true, section: 'Strength/Fit Scorecard', scoreWeight: 8, dependsOn: 'templateType', dependsOnValue: 'Strength/Fit' },
      { id: 'keyStrengths', label: 'Key strengths observed', type: 'textarea', required: true, section: 'Coaching Notes' },
      { id: 'areasForImprovement', label: 'Areas for improvement', type: 'textarea', required: true, section: 'Coaching Notes' },
      { id: 'coachingActionPlan', label: 'Coaching action plan', type: 'textarea', required: true, section: 'Coaching Notes' },
    ],
  },
  {
    id: 'member-class-experience-feedback',
    label: 'Member class experience feedback',
    description: 'General member feedback after a studio session — linked to the Momence session and member profile.',
    intakeRoute: 'Feedback',
    category: 'Class Experience',
    subCategory: 'Class Format Satisfaction',
    priority: 'Medium',
    prompts: [
      'Momence studio session attended:',
      'Momence member who gave feedback:',
      'Member verbatim feedback:',
      'What part of the practice did member mention:',
      'Instructor / music / environment feedback:',
      'Member-indicated satisfaction or concern:',
      'Requested change or follow-up:',
    ],
    fields: [
      { id: 'classType', label: 'Momence studio session attended', type: 'select', required: true },
      { id: 'memberName', label: 'Momence member who gave feedback', type: 'text', required: true },
      { id: 'memberContact', label: 'Member contact (email / phone)', type: 'text' },
      { id: 'studio', label: 'Studio location', type: 'select', required: true },
      { id: 'trainer', label: 'Instructor for this session', type: 'select' },
      { id: 'memberFeedback', label: 'Member verbatim feedback', type: 'textarea', required: true, placeholder: 'Quote what the member said as closely as possible — use their exact words where known.' },
      { id: 'practiceElement', label: 'Practice element mentioned', type: 'select', required: true, options: ['Class format', 'Instructor', 'Music / audio', 'Pacing', 'Intensity', 'Modifications offered', 'Studio environment', 'Late start or timing', 'Other'] },
      { id: 'sessionFeedback', label: 'Additional instructor / music / environment detail', type: 'textarea', placeholder: 'Describe any specific feedback about the instructor\'s cues, music selection, temperature, or studio layout.' },
      { id: 'memberSentiment', label: 'Member-indicated sentiment', type: 'select', required: true, options: ['Member Expressed Satisfaction', 'Member Expressed Neutral/Mixed Feelings', 'Member Expressed Dissatisfaction', 'Member Expressed Frustration/Anger', 'Member Expressed Delight/Enthusiasm'] },
      { id: 'requestedChange', label: 'Requested change or follow-up', type: 'textarea', placeholder: 'What did the member ask for? E.g. refund, schedule change, instructor reassignment, follow-up call.' },
      { id: 'followUpPreference', label: 'Member follow-up preference', type: 'select', options: ['No Follow-up Needed', 'Phone Call', 'WhatsApp', 'Email', 'In-Person (Next Visit)', 'Member Will Reach Out'] },
    ],
  },
  {
    id: 'studio-environment-feedback',
    label: 'Studio environment feedback',
    description: 'Member-reported ambiance, cleanliness, amenities, or practice-space issue — linked to studio location.',
    intakeRoute: 'Feedback',
    category: 'Studio Amenities and Facilities',
    subCategory: 'Cleanliness and Hygiene',
    priority: 'Medium',
    prompts: [
      'Studio location:',
      'Studio space / area affected:',
      'Member verbatim feedback:',
      'Environmental element raised:',
      'Reported impact on member journey:',
      'Immediate action taken:',
      'Follow-up preference indicated:',
    ],
    fields: [
      { id: 'studio', label: 'Studio location', type: 'select', required: true },
      { id: 'studioArea', label: 'Specific area within the studio', type: 'text', required: true, placeholder: 'E.g. locker room, PowerCycle studio, reception area, shower, waiting area.' },
      { id: 'memberName', label: 'Member who reported the issue', type: 'text' },
      { id: 'memberContact', label: 'Member contact (optional)', type: 'text' },
      { id: 'memberFeedback', label: 'Member verbatim feedback', type: 'textarea', required: true, placeholder: 'Use the member\'s exact words where possible — this forms the basis of the ticket description.' },
      { id: 'environmentElement', label: 'Environmental element raised', type: 'select', required: true, options: ['Temperature / AC / heating', 'Lighting', 'Sound / music volume', 'Cleanliness', 'Odour / aroma', 'Amenities (shampoo, towels, etc.)', 'Locker / shower area', 'Waiting or reception area', 'Equipment placement / spacing', 'Other'] },
      { id: 'reportedImpact', label: 'Reported impact on member journey', type: 'textarea', required: true, placeholder: 'How did the environmental issue affect their practice or experience? Did they leave early, feel uncomfortable, or express intent not to return?' },
      { id: 'immediateAction', label: 'Immediate action taken', type: 'textarea', placeholder: 'What did you or the studio team do right away to address the issue? If nothing, note "No immediate action taken."' },
      { id: 'followUpPreference', label: 'Member follow-up preference', type: 'select', options: ['No Follow-up Needed', 'Phone Call', 'Email', 'WhatsApp', 'In-Person (Next Visit)', 'Member Will Reach Out'] },
    ],
  },
];

export function buildContextTemplateText(template: ContextTemplate, values: Record<string, string> = {}): string {
  const fields = template.fields?.length
    ? template.fields.map((field) => `${field.label}: ${values[field.id] || ''}`.trimEnd())
    : template.prompts.map((prompt) => `${prompt} ${values[prompt] || ''}`.trimEnd());
  const scoreLine = template.id === 'trainer-class-assessment' && values.evaluationScore
    ? [`Weighted evaluation score: ${values.evaluationScore}`]
    : [];

  return [
    `Intake route: ${template.intakeRoute}`,
    `Category: ${template.category}`,
    `Sub-category: ${template.subCategory}`,
    `Priority: ${template.priority}`,
    '',
    ...scoreLine,
    ...fields,
  ].join('\n');
}

export function buildHostedClassFeedbackText(input: HostedClassFeedbackInput): string {
  const attendeeLines = input.attendees.length
    ? input.attendees.map((attendee, index) => [
        `${index + 1}. ${attendee.memberName}`,
        attendee.memberContact ? `Contact: ${attendee.memberContact}` : '',
        attendee.status ? `Status: ${attendee.status}` : '',
        attendee.followUpPreference ? `Follow-up preference: ${attendee.followUpPreference}` : '',
        attendee.conversionSignal ? `Conversion signal: ${attendee.conversionSignal}` : '',
        attendee.comment ? `Comment: ${attendee.comment}` : '',
      ].filter(Boolean).join(' | '))
    : ['No attendee-level feedback captured.'];

  return [
    'Intake route: Feedback',
    'Category: Hosted Class & Partnerships',
    'Sub-category: Hosted Class Feedback',
    'Priority: Medium',
    '',
    `Momence session ID: ${input.session.id}`,
    `Signature Partnership Experience: ${input.session.classType}`,
    input.session.startsAt ? `Session date/time: ${input.session.startsAt}` : '',
    input.session.studio ? `Studio space: ${input.session.studio}` : '',
    input.session.trainer ? `Instructor: ${input.session.trainer}` : '',
    input.session.capacity != null ? `Booked / capacity: ${input.session.bookingCount || 0}/${input.session.capacity}` : '',
    input.session.waitlistBookingCount != null ? `Waitlist: ${input.session.waitlistBookingCount}/${input.session.waitlistCapacity ?? 'unlimited'}` : '',
    input.partnerName ? `Partner / host name: ${input.partnerName}` : '',
    input.partnerType ? `Partner type: ${input.partnerType}` : '',
    input.acquisitionSource ? `Attendance source: ${input.acquisitionSource}` : '',
    input.audienceFit ? `Audience alignment / proximity: ${input.audienceFit}` : '',
    '',
    'Attendee intelligence:',
    ...attendeeLines,
    '',
    `Class feedback: ${input.classFeedback}`,
    input.hostFeedback ? `Host feedback: ${input.hostFeedback}` : '',
    input.lateComerFeedback ? `Late-comer feedback: ${input.lateComerFeedback}` : '',
    input.conversionSummary ? `Interested to buy: ${input.conversionSummary}` : '',
    input.socialAmplification ? `Social/content amplification: ${input.socialAmplification}` : '',
    input.otherFeedback ? `Other feedback: ${input.otherFeedback}` : '',
    input.followUpPlan ? `Follow-up plan: ${input.followUpPlan}` : '',
  ].filter((line) => line !== '').join('\n');
}
