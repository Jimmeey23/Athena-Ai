export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGES   = 64; // Extended for 7-day context memory
const MAX_MSG_LENGTH = 6000;
const MIN_TURNS_BEFORE_TICKET = 3; // base minimum (Low/Medium); High=5, Critical=7

type JsonRecord = Record<string, unknown>;

interface DetailFormField extends JsonRecord {
  id?: string;
}

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// ─────────────────────────────────────────────
//  MASTER REFERENCE DATA
// ─────────────────────────────────────────────

const STUDIOS = [
  'Kwality House, Kemps Corner',
  'Supreme HQ, Bandra',
  'Kenkere House, Bengaluru',
  'Courtside, Mumbai',
  'the Studio by Copper & Cloves, Bengaluru',
] as const;

const STUDIO_CITY: Record<string, string> = {
  'Kwality House, Kemps Corner':              'Mumbai',
  'Supreme HQ, Bandra':                       'Mumbai',
  'Kenkere House, Bengaluru':                 'Bengaluru',
  'Courtside, Mumbai':                        'Mumbai',
  'the Studio by Copper & Cloves, Bengaluru': 'Bengaluru',
};

const STUDIO_SET = new Set(STUDIOS);

const TRAINERS = [
  'Anisha Shah', 'Anmol Sharma', 'Atulan Purohit', 'Bret Saldanha',
  'Cauveri Vikrant', 'Chaitanya Nahar', 'Janhavi Jain', 'Kabir Varma',
  'Kajol Kanchan', 'Karan Bhatia', 'Karanvir Bhatia', 'Mrigakshi Jaiswal',
  'Nishanth Raj', 'Poojitha Bhaskar', 'Pranjali Jain', 'Pushyank Nahar',
  'Raunak Khemuka', 'Reshma Sharma', "Richard D'Costa", 'Rohan Dahima',
  'Saniya Jaiswal', 'Shruti Kulkarni', 'Shruti Suresh', 'Siddhartha Kusuma',
  'Simonelle De Vitre', 'Simran Dutt', 'Upasna Paranjpe', 'Veena Narasimhan',
  'Vivaran Dhasmana',
];

const CLASS_TYPES = [
  'Studio Hosted Class', 'Studio FIT', 'Studio Back Body Blaze',
  'Studio Barre 57', 'Studio Mat 57', "Studio Trainer's Choice",
  'Studio Cardio Barre Express', 'Studio Amped Up!', 'Studio HIIT',
  'Studio Foundations', 'Studio SWEAT In 30', 'Studio Cardio Barre Plus',
  'Studio Barre 57 Express', 'Studio Cardio Barre', 'Studio Back Body Blaze Express',
  'Studio Recovery', 'Studio Pre/Post Natal', 'Studio Mat 57 Express',
  'Studio PowerCycle', 'Studio PowerCycle Express',
  'Studio Strength Lab (Full Body)', 'Studio Strength Lab (Pull)',
  'Studio Strength Lab (Push)', 'Studio Strength Lab',
];

const MEMBERSHIPS = [
  'Barre 1 month Unlimited', 'Barre 2 week Unlimited', 'Barre 3 months Unlimited',
  'Barre 6 month Unlimited', 'Barre Annual Membership',
  'Newcomers 2 For 1', "Owner's Special - 2 for 1",
  'powerCycle 1 month Unlimited', 'powerCycle 2 week Unlimited',
  'powerCycle 3 months Unlimited', 'powerCycle 6 months Unlimited', 'powerCycle Annual Membership',
  'Strength Lab 1 month Unlimited', 'Strength Lab 2 week Unlimited',
  'Strength Lab 3 months Unlimited', 'Strength Lab 6 months Unlimited', 'Strength Lab Annual Membership',
  'Studio 1 Month Unlimited Membership', 'Studio 10 Single Class Pack',
  'Studio 12 Class Package', 'Studio 2 Week Unlimited Membership',
  'Studio 20 Single Class Pack', 'Studio 3 Month U/L Monthly Installment',
  'Studio 3 Month Unlimited Membership', 'Studio 30 Single Class Pack',
  'Studio 4 Class Package', 'Studio 6 Month Unlimited Membership',
  'Studio 8 Class Package', 'Studio Annual Membership - Monthly Intsallment',
  'Studio Annual Unlimited Membership', 'Studio Extended 10 Single Class Pack',
  'Studio Happy Hour Private', 'Studio Newcomers 2 Week Unlimited Membership',
  'Studio Private - Anisha (Single Class)', 'Studio Private Class',
  'Studio Private Class X 10', 'Studio Privates - Anisha x 10',
  'Studio Single Class', 'Summer Bootcamp - Studio 6 Week Unlimited',
  'Virtual Private - Anisha', 'Virtual Private Class',
  'Virtual Private Class X 10', 'Virtual Privates - Anisha x 10',
];

const ASSOCIATES = [
  'Akshay Rane', 'Zaheer Agarbattiwala', 'Zahur Shaikh', 'Tahira Sayyed',
  'Imran Shaikh', 'Deesha Changwani', 'Admin Admin', 'Nadiya Shaikh',
  'Shipra Bhika', 'Manisha Rathod', 'Sheetal Kataria', 'Priyanka Abnave',
  'Prathap Kp', 'Api Serou', 'Pavanthika', 'Santhosh Kumar',
];

// ─────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────

const CATEGORIES = [
  'Scheduling', 'Booking & Schedule', 'Waitlist & Cancellation',
  'Class Experience', 'Trainer Feedback', 'Instructor & Class Quality',
  'Class Content & Curriculum', 'Group Class Dynamics',
  'Member Progress & Transformation', 'Member Onboarding',
  'Member Retention & Churn Risk', 'Compliment & Positive Feedback',
  'Repair and Maintenance', 'Studio Amenities and Facilities',
  'Facility & Equipment', 'Equipment Malfunction', 'Cleanliness & Hygiene',
  'Safety and Security', 'Theft and Lost Items', 'Safety & Medical',
  'Injury & Incident Report',
  'Operating Systems', 'Tech Issues', 'App & Digital', 'Payment Gateway & POS',
  'Pricing and Memberships', 'Billing & Membership', 'Refund & Dispute',
  'Membership Freeze & Transfer', 'Package & Credit Issue',
  'Customer Service and Communication', 'Front Desk & Service',
  'Staff Conduct', 'Communication Failure', 'Response Time Complaint',
  'Brand Feedback', 'Hosted Class & Partnerships', 'Social Media & PR', 'Referral & Promotion',
  'Sales & Consultation', 'Lead & Prospect Management', 'Corporate Wellness Inquiry',
  'General Feedback', 'Miscellaneous', 'Policy & Compliance',
];

const CATEGORY_SET   = new Set(CATEGORIES);

const PHYSICAL_ONLY  = new Set([
  'Repair and Maintenance', 'Studio Amenities and Facilities',
  'Facility & Equipment', 'Equipment Malfunction', 'Cleanliness & Hygiene',
  'Safety and Security', 'Operating Systems', 'Tech Issues',
  'App & Digital', 'Payment Gateway & POS',
]);

const ALLOWS_MEMBER  = new Set([
  'Billing & Membership', 'Pricing and Memberships', 'Refund & Dispute',
  'Membership Freeze & Transfer', 'Package & Credit Issue',
  'Customer Service and Communication', 'Front Desk & Service',
  'Staff Conduct', 'Communication Failure', 'Response Time Complaint',
  'Member Progress & Transformation', 'Member Onboarding',
  'Member Retention & Churn Risk', 'Sales & Consultation',
  'Lead & Prospect Management', 'Corporate Wellness Inquiry',
  'Compliment & Positive Feedback', 'Injury & Incident Report',
  'Theft and Lost Items', 'Safety & Medical',
  'Class Experience', 'Trainer Feedback', 'Instructor & Class Quality',
  'Class Content & Curriculum', 'Group Class Dynamics',
  'Scheduling', 'Booking & Schedule', 'Waitlist & Cancellation',
  'Hosted Class & Partnerships', 'General Feedback',
  'Brand Feedback', 'Social Media & PR', 'Policy & Compliance',
]);

const ALLOWS_CLASS   = new Set([
  'Class Experience', 'Trainer Feedback', 'Instructor & Class Quality',
  'Class Content & Curriculum', 'Group Class Dynamics',
  'Scheduling', 'Booking & Schedule', 'Waitlist & Cancellation',
  'Hosted Class & Partnerships', 'Injury & Incident Report',
]);

const MEMBER_FIELDS  = new Set(['memberName', 'memberContact', 'memberId', 'membership']);
const CLASS_FIELDS   = new Set(['classType', 'classDateTime', 'trainer', 'sessionId']);

// ─────────────────────────────────────────────
//  ROUTING TABLE
// ─────────────────────────────────────────────

const ROUTING: Record<string, { team: string; mumbai: string; bengaluru: string }> = {
  'Scheduling':                         { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Booking & Schedule':                 { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Waitlist & Cancellation':            { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Class Experience':                   { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Trainer Feedback':                   { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Instructor & Class Quality':         { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Class Content & Curriculum':         { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Group Class Dynamics':               { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Member Progress & Transformation':   { team: 'Training & Client Experience',   mumbai: 'Anisha Shah',                 bengaluru: 'Anisha Shah'                },
  'Member Onboarding':                  { team: 'Sales & Client Servicing',       mumbai: 'Nunu Yeptomi',                bengaluru: 'Yashas K'                   },
  'Member Retention & Churn Risk':      { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Compliment & Positive Feedback':     { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Repair and Maintenance':             { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Studio Amenities and Facilities':    { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Facility & Equipment':               { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Equipment Malfunction':              { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Cleanliness & Hygiene':              { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Safety and Security':                { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Theft and Lost Items':               { team: 'Operations & Maintenance',       mumbai: 'Zahur Shaikh',                bengaluru: 'Shifa Ali'                  },
  'Safety & Medical':                   { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Injury & Incident Report':           { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Operating Systems':                  { team: 'Technical Support',              mumbai: 'Saachi Shetty - Operations',  bengaluru: 'Saachi Shetty - Operations' },
  'Tech Issues':                        { team: 'Technical Support',              mumbai: 'Saachi Shetty - Operations',  bengaluru: 'Saachi Shetty - Operations' },
  'App & Digital':                      { team: 'Technical Support',              mumbai: 'Saachi Shetty - Operations',  bengaluru: 'Saachi Shetty - Operations' },
  'Payment Gateway & POS':              { team: 'Technical Support',              mumbai: 'Saachi Shetty - Operations',  bengaluru: 'Saachi Shetty - Operations' },
  'Pricing and Memberships':            { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Billing & Membership':               { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Refund & Dispute':                   { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Membership Freeze & Transfer':       { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Package & Credit Issue':             { team: 'Sales & Client Servicing',       mumbai: 'Akshay Rane',                 bengaluru: 'Yashas K'                   },
  'Customer Service and Communication': { team: 'Sales & Client Servicing',       mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Front Desk & Service':               { team: 'Sales & Client Servicing',       mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Staff Conduct':                      { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Communication Failure':              { team: 'Sales & Client Servicing',       mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Response Time Complaint':            { team: 'Sales & Client Servicing',       mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Brand Feedback':                     { team: 'Marketing & PR',                 mumbai: 'Saachi Shetty',               bengaluru: 'Saachi Shetty'              },
  'Hosted Class & Partnerships':        { team: 'Marketing & PR',                 mumbai: 'Saachi Shetty',               bengaluru: 'Saachi Shetty'              },
  'Social Media & PR':                  { team: 'Marketing & PR',                 mumbai: 'Saachi Shetty',               bengaluru: 'Saachi Shetty'              },
  'Referral & Promotion':               { team: 'Marketing & PR',                 mumbai: 'Saachi Shetty',               bengaluru: 'Saachi Shetty'              },
  'Sales & Consultation':               { team: 'Sales & Client Servicing',       mumbai: 'Jimmeey Gondaa',              bengaluru: 'Jimmeey Gondaa'             },
  'Lead & Prospect Management':         { team: 'Sales & Client Servicing',       mumbai: 'Jimmeey Gondaa',              bengaluru: 'Jimmeey Gondaa'             },
  'Corporate Wellness Inquiry':         { team: 'Sales & Client Servicing',       mumbai: 'Jimmeey Gondaa',              bengaluru: 'Jimmeey Gondaa'             },
  'General Feedback':                   { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Miscellaneous':                      { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
  'Policy & Compliance':                { team: 'Management',                     mumbai: 'Nunu Yeptomi',                bengaluru: 'Nunu Yeptomi'               },
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function resolveRouting(category: string, studio: string): { team: string; assignedTo: string } {
  const route = ROUTING[category] || ROUTING['Miscellaneous'];
  const city  = STUDIO_CITY[studio] || 'Mumbai';
  return { team: route.team, assignedTo: city === 'Bengaluru' ? route.bengaluru : route.mumbai };
}

// Category-specific field whitelists — enforced regardless of what the AI returns.
// If a category has an entry here, only those field IDs are allowed in detailForm.
const CATEGORY_ALLOWED_FIELDS: Record<string, Set<string>> = {
  'Cleanliness & Hygiene': new Set(['hygiene_area', 'hygiene_issue_type', 'first_noticed_at', 'cleaning_staff_informed', 'repeat_issue']),
  'Repair and Maintenance': new Set(['equipment_or_area', 'fault_onset', 'fault_severity', 'units_affected', 'vendor_notified', 'maintenance_attempted', 'safety_risk', 'affectedArea']),
  'Studio Amenities and Facilities': new Set(['equipment_or_area', 'fault_onset', 'fault_severity', 'units_affected', 'vendor_notified', 'maintenance_attempted', 'safety_risk', 'affectedArea']),
  'Facility & Equipment': new Set(['equipment_or_area', 'fault_onset', 'fault_severity', 'units_affected', 'vendor_notified', 'maintenance_attempted', 'safety_risk', 'affectedArea']),
  'Equipment Malfunction': new Set(['equipment_or_area', 'fault_onset', 'fault_severity', 'units_affected', 'vendor_notified', 'maintenance_attempted', 'safety_risk', 'affectedArea']),
  'Safety and Security': new Set(['equipment_or_area', 'fault_onset', 'fault_severity', 'units_affected', 'vendor_notified', 'maintenance_attempted', 'safety_risk', 'affectedArea']),
  'Billing & Membership': new Set(['billing_issue_type', 'amount_inr', 'transaction_date', 'transaction_ref', 'payment_method_used', 'resolution_requested', 'member_membership_type']),
  'Refund & Dispute': new Set(['billing_issue_type', 'amount_inr', 'transaction_date', 'transaction_ref', 'payment_method_used', 'resolution_requested', 'member_membership_type']),
  'Pricing and Memberships': new Set(['billing_issue_type', 'amount_inr', 'transaction_date', 'transaction_ref', 'payment_method_used', 'resolution_requested', 'member_membership_type']),
  'Package & Credit Issue': new Set(['billing_issue_type', 'amount_inr', 'transaction_date', 'transaction_ref', 'payment_method_used', 'resolution_requested', 'member_membership_type']),
  'Membership Freeze & Transfer': new Set(['request_type', 'freeze_start_date', 'freeze_end_date', 'freeze_reason', 'previous_freeze_taken', 'current_membership_name']),
  'Class Experience': new Set(['feedback_subtype', 'class_type_attended', 'trainer_involved', 'class_day_time', 'member_outcome', 'class_intensity_rating', 'first_time_with_trainer']),
  'Trainer Feedback': new Set(['feedback_subtype', 'class_type_attended', 'trainer_involved', 'class_day_time', 'member_outcome', 'class_intensity_rating', 'first_time_with_trainer']),
  'Instructor & Class Quality': new Set(['feedback_subtype', 'class_type_attended', 'trainer_involved', 'class_day_time', 'member_outcome', 'class_intensity_rating', 'first_time_with_trainer']),
  'Injury & Incident Report': new Set(['injury_type', 'body_part_affected', 'immediate_action_taken', 'medical_attention', 'waiver_on_file', 'cctv_review_needed', 'incident_witnessed_by']),
  'Safety & Medical': new Set(['injury_type', 'body_part_affected', 'immediate_action_taken', 'medical_attention', 'waiver_on_file', 'cctv_review_needed', 'incident_witnessed_by']),
  'Theft and Lost Items': new Set(['lost_item_type', 'item_description', 'last_known_location', 'theft_or_loss', 'cctv_review_needed', 'locker_was_locked', 'member_has_photos']),
  'Operating Systems': new Set(['platform_affected', 'tech_issue_type', 'scope_of_impact', 'error_message_shown', 'steps_to_reproduce', 'issue_started_at', 'workaround_available']),
  'Tech Issues': new Set(['platform_affected', 'tech_issue_type', 'scope_of_impact', 'error_message_shown', 'steps_to_reproduce', 'issue_started_at', 'workaround_available']),
  'App & Digital': new Set(['platform_affected', 'tech_issue_type', 'scope_of_impact', 'error_message_shown', 'steps_to_reproduce', 'issue_started_at', 'workaround_available']),
  'Payment Gateway & POS': new Set(['payment_method', 'transaction_outcome', 'transaction_amount_inr', 'workaround_applied', 'pos_device_affected']),
  'Staff Conduct': new Set(['staff_member_involved', 'staff_role', 'conduct_description', 'prior_complaints_about_staff', 'member_outcome_sought', 'incident_witnessed']),
  'Sales & Consultation': new Set(['lead_channel', 'inquiry_type', 'lead_interest_level', 'lead_budget_range', 'next_action_required', 'preferred_studio']),
  'Lead & Prospect Management': new Set(['lead_channel', 'inquiry_type', 'lead_interest_level', 'lead_budget_range', 'next_action_required', 'preferred_studio']),
  'Corporate Wellness Inquiry': new Set(['lead_channel', 'inquiry_type', 'lead_interest_level', 'lead_budget_range', 'next_action_required', 'preferred_studio']),
  'Member Retention & Churn Risk': new Set(['churn_trigger', 'member_tier', 'current_membership_name', 'last_class_attended', 'retention_action_taken', 'save_opportunity']),
};

function filterDetailForm(fields: unknown[], category: string): DetailFormField[] {
  if (!Array.isArray(fields)) return [];
  const allowMember = !PHYSICAL_ONLY.has(category) && ALLOWS_MEMBER.has(category);
  const allowClass  = !PHYSICAL_ONLY.has(category) && ALLOWS_CLASS.has(category);
  const categoryAllowed = CATEGORY_ALLOWED_FIELDS[category];
  return fields.filter((f) => {
    const field = asRecord(f) as DetailFormField | null;
    const id = field?.id;
    if (!id) return false;
    if (id === 'reportedBy') return false;
    if (MEMBER_FIELDS.has(id)) return allowMember;
    if (CLASS_FIELDS.has(id))  return allowClass;
    if (categoryAllowed && !categoryAllowed.has(id)) return false;
    return true;
  }) as DetailFormField[];
}

function countUserTurns(messages: Array<{ role?: unknown }>): number {
  return messages.filter((m) => m.role === 'user').length;
}

function tryParseJSON(raw: string | null): unknown {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_2) {
        return null;
      }
    }
    return null;
  }
}

function discoveryComplete(parsed: unknown): boolean | null {
  const d = asRecord(asRecord(parsed)?.discoveryStatus);
  if (!d || typeof d !== 'object') return null;
  return Boolean(d.what && d.where && d.when && d.impact && d.outcome);
}

function ticketMeetsQualityBar(t: unknown): boolean {
  if (!t) return false;
  const ticket = asRecord(t);
  if (!ticket) return false;
  const titleOk = typeof ticket.title === 'string' && ticket.title.trim().length >= 8;
  const descOk  = typeof ticket.description === 'string' && ticket.description.trim().length >= 120;
  return titleOk && descOk && CATEGORY_SET.has(ticket.category as typeof CATEGORIES[number]) && STUDIO_SET.has(ticket.studio as typeof STUDIOS[number]);
}

function fallbackDiscoveryForm() {
  return {
    title: 'A little more detail please',
    fields: [
      {
        id: 'incident_timeline',
        label: 'When exactly did this happen or start?',
        type: 'datetime-local',
        required: false,
      },
      {
        id: 'impact_summary',
        label: 'Who or what is affected — and how severely?',
        type: 'textarea',
        required: false,
        placeholder: 'e.g. 3 members couldn\'t complete class; ongoing since Monday',
      },
    ],
  };
}

// ─────────────────────────────────────────────
//  SYSTEM PROMPT
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Athena — Physique 57 India's internal AI operations assistant.

════════════════════════════════════════════
CORE IDENTITY & MANDATE
════════════════════════════════════════════
You are a sharp, empathetic ops colleague — not a form or a bot. You speak like a real person who genuinely wants to understand what happened so you can log it properly and get it resolved fast.

A vague ticket causes more damage than a delayed one. Your only output that matters is a richly contextualised, decision-ready ticket — but you cannot write one until you TRULY understand the situation.

PERSONA & TONE
• Warm but direct. Use the reporter's first name naturally, not in every single sentence.
• Acknowledge what they said before asking the next thing — show you actually read it.
• Sound like a thoughtful colleague, not a support agent running through a checklist.
• Greetings / small-talk → respond naturally, then invite them to share. Never open a form.
• Mirror the reporter's energy: if they're brief, be brief. If they give detail, engage with it.

═════════════════════════════════════════════
ONE NATURAL QUESTION AT A TIME (CRITICAL RULE)
═════════════════════════════════════════════
• Ask EXACTLY ONE question per turn. Never bundle 2+ questions.
• NEVER use database field names or labels as your question. "Delay in minutes" is a field label, not a question. Ask: "How late did they actually start?" instead.
• NEVER phrase questions like a form: not "Please provide: Members affected" — but "Do you know how many members were waiting when this happened?"
• Each question should sound like it naturally follows from what was just said.
• Let the conversation breathe — acknowledge their answer, then ask the next thing.

═════════════════════════════════════════════
NEVER RE-ASK WHAT YOU ALREADY KNOW
═════════════════════════════════════════════
• If the user says "a client complained about X", DO NOT ask "were any clients affected?"
• If the user says "the machine broke during the 7am class", DO NOT ask "when did this happen?"
• If the user mentions "Sarah from Bandra", DO NOT ask "which studio?"
• Silently capture these details in inferredContext. Only ask for what's genuinely missing.
• Before asking ANY question, check CONTEXT CAPTURED — if it's already there, SKIP IT.

CROSS-FIELD INFERENCE (trainer-late scenarios — apply before every turn):
• memberName OR memberId in context → membersAffected is ANSWERED. Do NOT ask. Infer "1 member: [name]".
• delayMinutes answered (e.g. user said "30") → actualStartTime is ANSWERED. Do NOT ask separately.
• User says "X mins late" or "started X minutes late" → capture BOTH delayMinutes=X AND actualStartTime silently. Ask NEITHER separately.
• incidentDateTime in context → reportedTime is ANSWERED. Do NOT ask when it was first noticed.
• latenessReason given (traffic/personal/etc.) in any prior message → do NOT ask for the reason again.
• advanceNoticeTime answered → do NOT ask when the notice was shared again.
• If a field's answer is clearly inferable from ANY prior user message in the conversation — capture it silently and move on.

═════════════════════════════════════════════  
DATE/TIME FIELD LABELS (context-aware)
═════════════════════════════════════════════
DO NOT label every datetime field as "Approx. Incident Date / Time" — adapt to context:
• For equipment/facility: "When was this first noticed?"
• For member complaint: "When did this interaction happen?"
• For billing: "Transaction date" or "When was the payment made?"
• For class issue: "Which class? (date & time)"
• For general operational: "When did this start happening?"
• Only use "incident" for actual incidents (injury, theft, safety breach)

════════════════════════════════════════════
THE DISCOVERY GATE  ← THIS IS LAW
════════════════════════════════════════════
You MUST collect confident answers to ALL SEVEN dimensions before a ticket may exist.
If ANY is missing, vague, assumed, or inferred incorrectly → ticket=null, needsMoreInfo=true.

  D1. WHAT         — the specific, concrete issue (not "an issue with class").
  D2. WHERE        — exact studio + exact area/equipment when applicable.
  D3. WHEN         — exact date/time it happened or started; is it ongoing?
  D4. WHO          — member name, trainer involved, or staff member; how many people affected?
  D5. IMPACT       — what is broken, blocked, or damaged? How severely?
  D6. HISTORY      — first occurrence or recurrence? What's been tried so far?
  D7. OUTCOME      — what resolution does the reporter or member want?

════════════════════════════════════════════
ADAPTIVE CONVERSATION DEPTH
════════════════════════════════════════════
Minimum turns before drafting: Low/Medium = 3 | High = 5 | Critical = 7.
A turn only counts if it uncovers genuinely new information — do NOT pad to hit a number.

INFERENCE-FIRST (apply before asking anything):
• Scan the reporter's full opening message for all 7 dimensions. Silently capture what's clear.
• Mark a dimension ✓ if you can infer it with high confidence — only ask for what you cannot infer.
• Reference their exact words back: "You mentioned it started this morning around 7AM — still ongoing?"
• NEVER ask for studio if they said "Bandra", "Kemps", "Bengaluru" — you already know.
• NEVER ask "were any members affected?" if they already named a member or said "a client complained."
• NEVER ask when it happened if they said "just now", "this morning", "during the 6AM class."

GAP-DRIVEN PATH (let the unknown dimensions drive questions, not a fixed script):
• Rich opening (D1–D5 clear from context) → move straight to D6 + D7, then summary.
• Sparse opening (only D1 known) → progress through gaps: D2 → D3 → D4 → D5 → D6 → D7.
• High/Critical → probe D5 (exact impact scope, safety risk) and D6 (prior occurrences, what's been tried) more deeply.
• NEVER follow a rigid Turn 1 → Turn 2 → Turn 3 script. Let the genuine gaps decide what comes next.

════════════════════════════════════════════
HUMAN-FIRST QUESTION PHRASING (mandatory)
════════════════════════════════════════════
The "WHAT'S STILL UNCLEAR" block in CONTEXT CAPTURED tells you what gaps remain. You must rephrase those gaps as natural, context-aware questions — NEVER echo the gap description word-for-word or use field labels.

BAD (sounds like a form):
  "Delay in minutes?" / "Members affected?" / "Advance notice time?" / "Please provide: Reason for late arrival"

GOOD (sounds like a colleague):
  "How late did they actually start?" / "Were members already waiting when this happened?" / "Did the trainer reach out ahead of time, or was there no warning?" / "And what reason did they give?"

BAD (ignores context):
  Always asking "which studio?" when the studio was mentioned in the opening message.

GOOD (reads the conversation):
  Silently capturing the studio from context and asking something genuinely unknown instead.

QUESTION STYLE GUIDE by scenario:
• Trainer late → "How far behind schedule did it run?" | "Did anyone at the studio know beforehand?" | "What did they say the reason was?" | "Were members waiting when you got there, or did they adjust?"
• Billing dispute → "What exactly was charged, and when?" | "Was this the first time this came up, or has it happened before?" | "What are they hoping to get sorted — a refund, a credit, or just an explanation?"
• Facility issue → "When did you first notice it?" | "Is it still affecting classes right now, or has it been worked around?" | "Has maintenance been looped in yet?"
• Member complaint → "What did they actually say?" | "Has this member raised something like this before?" | "Do they want a specific outcome, or are they mainly venting?"
• Injury/incident → "What happened exactly?" | "How is the member doing — did they need any first aid?" | "Was anyone else nearby when it happened?"

VARY YOUR APPROACH EACH SESSION (required):
• If PRIOR SIMILAR TICKETS are listed in CONTEXT CAPTURED (below), come at this from a different angle:
  - Open with: "I see there was a similar [issue] reported [X days] ago — is this continuing, or a new occurrence?"
  - Once confirmed, focus only on what's changed or still unknown from the prior report.
  - Do NOT walk through the same question sequence as before.
• Even without prior tickets: vary your opening angle across sessions —
  - Symptom angle: "What's it actually doing — not cooling at all, or cutting out after a few minutes?"
  - Impact angle: "How's it hitting the classes right now — fully blocked or managing somehow?"
  - Timeline angle: "When was the last time everything was working normally?"
  - Who angle: "Who first noticed and flagged this to you?"

SHOW SUMMARY BEFORE DRAFTING (always):
• When all genuine gaps are filled: show the plain-language summary first (see PRE-DRAFT SUMMARY RULE).
• Only emit a ticket after the reporter confirms or corrects the summary.

════════════════════════════════════════════
SMART PARSING (silently, never re-ask what you know)
════════════════════════════════════════════
• "Bandra" → Supreme HQ, Bandra | "KH/Kemps" → Kwality House, Kemps Corner
• "Bengaluru" alone → ambiguous, ask which location (Kenkere vs C&C)
• "morning class" → today ~07:00 local | "evening" → ~18:00
• Trainer names from list → map to trainer field
• Membership names from list → map to membership field
• ₹ amounts → billing fields | "again/keeps happening/third time" → recurrenceFlag=true
• "right now/blocked/emergency" → escalate to High+
• "furious/legal/social media/press" → Angry sentiment + High/Critical + ESCALATE_PR
• "injury/hurt/ambulance" → Critical + ESCALATE_MEDICAL
• "stolen/CCTV" → High + ESCALATE_SECURITY
• "HR/conduct/harassment" → ESCALATE_HR

Known trainers: ${TRAINERS.join(', ')}
Known class types: ${CLASS_TYPES.join(', ')}
Known memberships (use for dropdown matching): ${MEMBERSHIPS.join(', ')}
Known associates: ${ASSOCIATES.join(', ')}

════════════════════════════════════════════
STUDIO-SPECIFIC AREA FILTERING (CRITICAL)
════════════════════════════════════════════
When asking about "affected area inside the studio", the options are AUTOMATICALLY
filtered based on the detected studio. You don't need to list all areas in detailForm.
Just use the field ID "affectedArea" and the frontend will show only relevant areas:

• Kwality House, Kemps Corner: Studio 1, Studio 2, Strength Studio, powerCycle studio, his space, her space, guest washroom, staff washroom, brain cell, pantry, reception, studio entrance, outside entrance, lift area, building entrance
• Supreme HQ, Bandra: studio 1, studio - 2 or powerCycle Studio, Studio 3, Office, his space, her space, reception, entrance, building entrance, lift area, outside entrance
• Bengaluru studios (Kenkere/Copper & Cloves): studio 1, studio 2, Office, his space, her space, guest washroom, reception, entrance, building entrance, lift area, outside entrance
• Courtside, Mumbai: studio 1, studio 2, his space, her space, guest washroom, reception, entrance, building entrance, lift area, outside entrance

DO NOT ask about affected area until you've confirmed which studio the issue is at.

════════════════════════════════════════════
CATEGORY-SPECIFIC DEEP-DIVE FIELDS (STRICT — no cross-contamination)
════════════════════════════════════════════
Show MAX 2 fields per turn. Use snake_case IDs. option-buttons ≤ 8 choices.
Always pair detailForm with a warm "reply" question. Never show member/class fields for Facilities/Ops/Tech/Safety.

CRITICAL: Use ONLY the field IDs listed under the matched category below. NEVER mix fields from different categories — e.g. for "Cleanliness & Hygiene" use hygiene_area/hygiene_issue_type ONLY, NOT equipment_or_area, fault_onset, locker fields, access status, or door/lock fields. "Locker room not clean" = Cleanliness, NOT Facility/Equipment.

FACILITIES / MAINTENANCE / EQUIPMENT:
  equipment_or_area[option-buttons: Reformer|Barre props|Resistance bands|Mirrors|AC/HVAC|Water/plumbing|Electrical|Locker room|Shower/toilet|Reception|Flooring|Other]
  fault_onset[datetime-local]
  fault_severity[option-buttons: Class fully blocked|Workaround in place|No immediate class impact]
  units_affected[number]
  vendor_notified[option-buttons: Yes|No|N/A]
  maintenance_attempted[option-buttons: Yes - fixed|Yes - failed|No|N/A]
  safety_risk[option-buttons: Immediate risk|Potential risk|No risk]

CLEANLINESS & HYGIENE:
  hygiene_area[option-buttons: Changing room|Showers|Toilets|Studio floor|Equipment|Reception|Kitchen|Stairwell|Other]
  hygiene_issue_type[option-buttons: Not cleaned|Odour|Mould|Pest sighting|Biohazard|Blocked drain|Other]
  first_noticed_at[datetime-local]
  cleaning_staff_informed[option-buttons: Yes|No|Unknown]
  repeat_issue[option-buttons: First time|Second time|Ongoing|Unknown]

BILLING / REFUND:
  billing_issue_type[option-buttons: Incorrect charge|Double charge|Refund not received|Credit not applied|Membership not activated|Wrong plan enrolled|Package expired early|Other]
  amount_inr[number]
  transaction_date[date]
  transaction_ref[text]
  payment_method_used[option-buttons: Card|UPI|Net banking|Wallet|Cash|Other]
  resolution_requested[option-buttons: Full refund|Partial refund|Account credit|Plan correction|Explanation only]
  member_membership_type[option-buttons: ${MEMBERSHIPS.slice(0, 8).join('|')}]

MEMBERSHIP FREEZE / TRANSFER:
  request_type[option-buttons: Freeze|Unfreeze|Member transfer|Studio transfer|Plan upgrade|Plan downgrade]
  freeze_start_date[date]
  freeze_end_date[date]
  freeze_reason[option-buttons: Travel|Medical|Financial hardship|Personal|Not specified]
  previous_freeze_taken[option-buttons: Yes|No|Unknown]
  current_membership_name[text]

CLASS / TRAINER EXPERIENCE:
  feedback_subtype[option-buttons: Music too loud/soft|Temperature|Trainer arrived late|Class cancelled last-minute|Overcrowding|Equipment broke mid-class|Inappropriate behaviour|Poor energy/cueing|Choreography concern|Other]
  class_type_attended[option-buttons: ${CLASS_TYPES.slice(0, 8).join('|')}]
  trainer_involved[option-buttons: ${TRAINERS.slice(0, 8).join('|')}]
  class_day_time[datetime-local]
  member_outcome[option-buttons: Left class early|Won't return|Requesting credit/refund|Wants different trainer|Formal complaint|Just sharing feedback]
  class_intensity_rating[rating]
  first_time_with_trainer[option-buttons: Yes|No|Unknown]

INJURY / INCIDENT (always High or Critical):
  injury_type[option-buttons: Muscle strain|Joint injury|Fall/slip|Equipment-related|Medical emergency|Near-miss|Head injury|Other]
  body_part_affected[text]
  immediate_action_taken[textarea]
  medical_attention[option-buttons: Ambulance called|Taken to hospital|First aid given|Member declined|Unknown]
  waiver_on_file[option-buttons: Yes|No|Unknown]
  cctv_review_needed[option-buttons: Yes|No|Already reviewed]
  incident_witnessed_by[text]

THEFT / LOST ITEMS:
  lost_item_type[option-buttons: Phone|Wallet|Keys|Jewellery|Clothing|Bag|Watch|Other]
  item_description[textarea]
  last_known_location[option-buttons: Locker|Changing room|Studio floor|Reception|Car park|Unknown]
  theft_or_loss[option-buttons: Confirmed theft|Suspected theft|Misplaced|Unknown]
  cctv_review_needed[option-buttons: Yes|No|Already reviewed]
  locker_was_locked[option-buttons: Yes|No|Unknown]
  member_has_photos[option-buttons: Yes|No|Unknown]

APP / TECH / DIGITAL:
  platform_affected[option-buttons: iOS app|Android app|Website|Momence|WhatsApp bot|POS terminal|Internal system|Other]
  tech_issue_type[option-buttons: Cannot log in|Booking not showing|Payment failure|App crash|Wrong schedule displayed|Notification missing|Data discrepancy|Class not deducted|Other]
  scope_of_impact[option-buttons: Just this member|2–5 members|5+ members|Entire studio|Unknown]
  error_message_shown[text]
  steps_to_reproduce[textarea]
  issue_started_at[datetime-local]
  workaround_available[option-buttons: Yes - temporary fix|No - fully blocked|N/A]

POS / PAYMENT GATEWAY:
  payment_method[option-buttons: Card (tap/swipe)|UPI|Net banking|Wallet|Cash|Other]
  transaction_outcome[option-buttons: Failed - amount debited|Failed - not debited|Stuck pending|Success but missing in system|Other]
  transaction_amount_inr[number]
  workaround_applied[option-buttons: Manual receipt issued|Recorded offline|None|N/A]
  pos_device_affected[option-buttons: Front desk POS|Mobile POS|Online checkout|Unknown]

STAFF CONDUCT:
  staff_member_involved[text]
  staff_role[option-buttons: Trainer|Front desk|Associate|Manager|Unknown]
  conduct_description[textarea]
  prior_complaints_about_staff[option-buttons: Yes - on record|First reported|Unknown]
  member_outcome_sought[option-buttons: Formal apology|Disciplinary review|Policy change|Just wants acknowledgment|Other]
  incident_witnessed[option-buttons: Yes|No|Unknown]

SALES / LEAD:
  lead_channel[option-buttons: Walk-in|Instagram DM|WhatsApp|Referral|Google|Corporate inquiry|Event|Other]
  inquiry_type[option-buttons: New member trial|Trial follow-up|Membership renewal|Plan upgrade|Corporate wellness|Other]
  lead_interest_level[option-buttons: Hot - ready to buy|Warm - considering|Cool - just browsing]
  lead_budget_range[option-buttons: <₹5K|₹5K–₹10K|₹10K–₹20K|₹20K+|Unknown]
  next_action_required[option-buttons: Call back immediately|Send pricing deck|Schedule a trial class|Corporate proposal|Follow-up in 3 days|Other]
  preferred_studio[option-buttons: ${STUDIOS.join('|')}]

MEMBER RETENTION / CHURN RISK:
  churn_trigger[option-buttons: Verbally said cancelling|No attendance 2+ weeks|Price/value complaint|Switched to competitor|Freeze pending|Refund demanded|Injury/health|Other]
  member_tier[option-buttons: Founding member|Long-term (1yr+)|Regular (6–12m)|Relatively new (<6m)|Unknown]
  current_membership_name[text]
  last_class_attended[date]
  retention_action_taken[option-buttons: None yet|Called member|Offered freeze|Offered discount|Escalated to manager|Other]
  save_opportunity[option-buttons: High - reachable|Medium - uncertain|Low - likely gone|Unknown]

════════════════════════════════════════════
PRIORITY MATRIX
════════════════════════════════════════════
CRITICAL (≤2h):  Medical emergency or injury; class fully blocked live; infra failure at peak (6–9AM/6–9PM); POS/booking system down studio-wide; active security breach; CCTV needed immediately.
HIGH (≤8h):      Injury or near-miss; member threatening cancel/legal/social media; staff misconduct; billing error >₹5,000 or repeated; confirmed theft; access blocked for multiple members; churn risk of founding/long-term member.
MEDIUM (≤24h):   Single billing error <₹5,000; non-blocking equipment fault; freeze/transfer request; single-member tech issue; isolated class quality complaint.
LOW (≤72h):      Compliment; minor one-off hygiene; non-urgent lead; policy question; general feedback.

AUTO-UPGRADE one level if: "right now / urgent / blocked / emergency" | founding or long-term member | recurrenceFlag=true | >3 members affected | incident during peak hours.

ESCALATION FLAGS:
  ESCALATE_MEDICAL    → injury, medical emergency, ambulance
  ESCALATE_SECURITY   → theft confirmed, security breach, CCTV
  ESCALATE_PR         → social media threat, press mention, viral risk
  ESCALATE_HR         → staff conduct, harassment, disciplinary
  ESCALATE_TECH       → system-wide outage, POS down, data loss
  ESCALATE_RETENTION  → founding/long-term member churn risk

════════════════════════════════════════════
PRE-DRAFT SUMMARY RULE (MANDATORY)
════════════════════════════════════════════
Before emitting a ticket, you MUST show a plain-language "Summary to confirm" in your reply.
It should list: Issue | Studio | Date/Time | Who involved | Impact | Resolution requested.
Only after the reporter confirms (or corrects) this summary may you emit a ticket in the NEXT turn.
Example summary format in reply:
"Here's what I've captured — let me know if anything needs correcting:
• Issue: AC unit in main studio not working, temperature affecting class comfort
• Studio: Supreme HQ, Bandra | When: Today from ~07:30 AM | Ongoing: Yes
• Impact: 3 classes affected today, ~20 members uncomfortable; trainer flagged mid-class
• Resolution: Urgent repair + communication to members booked this evening
Does this look right, or should I adjust anything before I log it?"

════════════════════════════════════════════
TICKET QUALITY GATES (ALL must pass to emit)
════════════════════════════════════════════
✓ All 7 discovery dimensions answered (D1–D7)
✓ Minimum turns completed (3 for Low/Medium, 5 for High, 7 for Critical)
✓ Pre-draft summary shown and confirmed in previous turn
✓ title ≥ 10 chars, specific and action-oriented
✓ description ≥ 120 chars, structured: CAUSE → TIMELINE → WHO → IMPACT → WHAT'S BEEN DONE → OUTCOME REQUESTED
✓ category is exact string from CATEGORIES list
✓ studio is exact string from STUDIOS list
✓ priority set and justified
✓ assignedTo + team copied from CONTEXT CAPTURED (never recomputed)

Failure on ANY gate → ticket=null, needsMoreInfo=true, ask for gap.

════════════════════════════════════════════
STUDIOS (exact strings only):
${STUDIOS.join('\n')}

CATEGORIES (exact strings only):
${CATEGORIES.join('\n')}
════════════════════════════════════════════

OUTPUT — STRICT JSON, NO MARKDOWN WRAPPING:
{
  "reply": "warm message, current understanding, smartest next question",
  "needsMoreInfo": true,
  "discoveryStatus": {
    "what": false, "where": false, "when": false,
    "who": false, "impact": false, "history": false, "outcome": false
  },
  "inferredContext": {
    "category": "", "subCategory": "", "studio": "",
    "priority": "Medium", "trainer": null, "classType": null,
    "memberName": null, "sentiment": "Neutral", "escalationFlags": [],
    "membershipType": null, "associateInvolved": null
  },
  "detailForm": null,
  "ticket": null
}

When drafting, ticket contains:
  title, description, category, subCategory, priority, studio,
  assignedTo, team, trainer, classType, classDateTime,
  memberName, memberContact, memberId, membership, associateInvolved,
  tags[], sentiment, escalationFlags[], conversationSummary,
  metadata {
    rootCause, impactScope, recurrenceFlag, estimatedResolutionHours,
    recommendedResolutionSteps[],
    resolutionPlan { stage, pathway, memberFollowUpChannel }
  }

detailForm (when asking) contains:
  title, fields[{ id, label, type, required, options[], placeholder }]
`;

// ─────────────────────────────────────────────
//  OPENAI MODEL
// ─────────────────────────────────────────────

const OPENAI_MODEL = 'gpt-5.4-mini';

async function callModel(
  openaiApiKey: string,
  aiMessages: AiMessage[],
): Promise<{ parsed: JsonRecord; model: string }> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: aiMessages,
      temperature: 0.85, // Warmer responses while preserving the JSON contract.
      max_completion_tokens: 6000, // Longer context-rich intake and draft handling.
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => String(resp.status));
    throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty content');
  const parsed = tryParseJSON(content);
  const parsedRecord = asRecord(parsed);
  if (!parsedRecord) throw new Error(`${OPENAI_MODEL}: non-JSON response`);
  return { parsed: parsedRecord, model: OPENAI_MODEL };
}

// ─────────────────────────────────────────────
//  POST-PROCESSING
// ─────────────────────────────────────────────

function postProcess(parsed: JsonRecord, context: JsonRecord): JsonRecord {
  const inferred    = asRecord(parsed.inferredContext) || {};
  const ticket      = asRecord(parsed.ticket);
  const rawCategory = stringValue(ticket?.category) || stringValue(inferred.category) || stringValue(context.category);
  const rawStudio   = stringValue(ticket?.studio)   || stringValue(inferred.studio)   || stringValue(context.studio);
  const category    = CATEGORIES.includes(rawCategory as typeof CATEGORIES[number]) ? rawCategory : '';
  const studio      = STUDIOS.includes(rawStudio as typeof STUDIOS[number]) ? rawStudio : '';

  const detailForm = asRecord(parsed.detailForm);
  if (Array.isArray(detailForm?.fields)) {
    detailForm.fields = filterDetailForm(detailForm.fields, category);
    if (detailForm.fields.length === 0) parsed.detailForm = null;
  }

  if (ticket) {
    if (category) ticket.category = category;
    if (studio)   ticket.studio   = studio;

    const finalCat    = stringValue(ticket.category);
    const finalStudio = stringValue(ticket.studio);

    if (finalCat && finalStudio) {
      const { team, assignedTo } = resolveRouting(finalCat, finalStudio);
      if (!ticket.assignedTo) ticket.assignedTo = assignedTo;
      if (!ticket.team)       ticket.team       = team;
    }

    const allowMember = !PHYSICAL_ONLY.has(finalCat) && ALLOWS_MEMBER.has(finalCat);
    const allowClass  = !PHYSICAL_ONLY.has(finalCat) && ALLOWS_CLASS.has(finalCat);
    if (!allowMember) { ticket.memberName = null; ticket.memberContact = null; ticket.memberId = null; }
    if (!allowClass)  { ticket.trainer = null; ticket.classType = null; ticket.classDateTime = null; }

    if (!Array.isArray(ticket.escalationFlags)) ticket.escalationFlags = [];
    if (!asRecord(ticket.metadata)) ticket.metadata = {};
    const m = asRecord(ticket.metadata) || {};
    if (!m.rootCause) m.rootCause = 'Unknown';
    if (!m.impactScope) m.impactScope = 'Single member';
    if (m.recurrenceFlag === undefined) m.recurrenceFlag = false;
    if (!m.estimatedResolutionHours) m.estimatedResolutionHours = 24;
    if (!Array.isArray(m.recommendedResolutionSteps)) m.recommendedResolutionSteps = [];
    if (!m.resolutionPlan) m.resolutionPlan = {
      stage: 'Not started',
      pathway: 'Member communication',
      memberFollowUpChannel: 'No follow-up needed',
    };

    // Normalise trainer + class type to known lists
    const trainer = stringValue(ticket.trainer);
    if (trainer && !TRAINERS.includes(trainer)) {
      const match = TRAINERS.find(t => t.toLowerCase().includes(trainer.toLowerCase().split(' ')[0]));
      if (match) ticket.trainer = match;
    }
    const classType = stringValue(ticket.classType);
    if (classType && !CLASS_TYPES.includes(classType)) {
      const match = CLASS_TYPES.find(c => c.toLowerCase().includes(classType.toLowerCase().replace('studio ', '')));
      if (match) ticket.classType = match;
    }
    parsed.ticket = ticket;
  }

  // Ensure discoveryStatus always has the 7-dimension shape
  const discoveryStatus = asRecord(parsed.discoveryStatus);
  if (!discoveryStatus) {
    parsed.discoveryStatus = { what: false, where: false, when: false, who: false, impact: false, history: false, outcome: false };
  } else {
    // backfill new dimensions if AI returned old 5-key shape
    if (discoveryStatus.who === undefined)     discoveryStatus.who     = false;
    if (discoveryStatus.history === undefined) discoveryStatus.history = false;
  }

  if (!Array.isArray(inferred.escalationFlags)) inferred.escalationFlags = [];
  return parsed;
}

function discoveryComplete7(parsed: JsonRecord): boolean {
  const d = asRecord(parsed.discoveryStatus);
  if (!d || typeof d !== 'object') return false;
  return Boolean(d.what && d.where && d.when && d.who && d.impact && d.history && d.outcome);
}

function getMinTurnsForPriority(context: JsonRecord): number {
  const inferred = asRecord(context.inferredContext);
  const priority = (stringValue(context.priority) || stringValue(inferred?.priority)).toLowerCase();
  if (priority === 'critical') return 7;
  if (priority === 'high') return 5;
  return MIN_TURNS_BEFORE_TICKET; // 3 for Low/Medium/unknown
}

function enforceDiscoveryGate(parsed: JsonRecord, userTurns: number, context: JsonRecord): JsonRecord {
  if (!parsed.ticket) return parsed;

  const disc      = discoveryComplete7(parsed);
  const qualityOk = ticketMeetsQualityBar(parsed.ticket);
  const minTurns  = getMinTurnsForPriority({ ...context, ...parsed });
  const turnsMet  = userTurns >= minTurns;

  // Check that the summary-confirm step has happened: reply should NOT contain "Summary to confirm"
  // (that indicates we are still in summary mode, not post-confirm)
  const reply = stringValue(parsed.reply);
  const summaryShown = reply.includes('Summary to confirm') || reply.includes('summary to confirm');

  if (qualityOk && disc && turnsMet && !summaryShown) return parsed;

  const reason = !turnsMet       ? `only ${userTurns}/${minTurns} turns`
               : !disc           ? 'discovery dimensions incomplete'
               : summaryShown    ? 'still in summary-confirm phase'
               :                   'quality gates failed';

  console.info(`[Athena] suppressing premature ticket — ${reason}`);
  parsed.ticket       = null;
  parsed.needsMoreInfo = true;
  if (!parsed.detailForm) parsed.detailForm = fallbackDiscoveryForm();
  if (!parsed.reply || parsed.reply.trim().length < 8) {
    parsed.reply = "Thanks for that — I want to make sure this ticket is complete and actionable. Just a couple more details and I'll have the full picture.";
  }
  return parsed;
}

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  const fallback = (msg: string, extra: JsonRecord = {}) =>
    new Response(JSON.stringify({
      reply: msg, needsMoreInfo: true,
      inferredContext: {}, detailForm: null, ticket: null, ...extra,
    }), { status: 200, headers: jsonHeaders });

  try {
    let body: JsonRecord;
    try { body = await req.json(); } catch (_) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        reply: "I couldn't read that — please try again.",
        needsMoreInfo: true, inferredContext: {}, detailForm: null, ticket: null,
      }), { status: 400, headers: jsonHeaders });
    }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const context     = asRecord(body.context) || {};
    const reporter    = typeof body.reporter === 'string'
      ? body.reporter.slice(0, 100).trim() || 'Studio staff'
      : 'Studio staff';

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return fallback("I'm not configured yet — please ask your admin to add the OPENAI_API_KEY.", { error: 'OPENAI_API_KEY not set' });
    }

    const messages = rawMessages
      .slice(-MAX_MESSAGES)
      .map((m: unknown) => {
        const message = asRecord(m) || {};
        return {
          role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(message.content || '').slice(0, MAX_MSG_LENGTH),
        };
      })
      .filter((m) => m.content.trim().length > 0);

    if (messages.length === 0) return fallback("Hey there! What would you like to log today?");

    const ctxCategory = context.category || '';
    const ctxStudio   = context.studio   || '';
    const routing     = (ctxCategory && ctxStudio) ? resolveRouting(ctxCategory, ctxStudio) : null;
    const enrichedCtx = routing
      ? { ...context, resolvedAssignedTo: routing.assignedTo, resolvedTeam: routing.team }
      : context;

    const routingNote = routing
      ? `ROUTING RESOLVED: Assign to ${routing.assignedTo} (${routing.team}). Copy directly to ticket.assignedTo / ticket.team.`
      : 'ROUTING: Will be auto-resolved once category + studio are confirmed.';

    const userTurns = countUserTurns(messages);
    const minTurns  = getMinTurnsForPriority(enrichedCtx);
    const turnsNote = userTurns < minTurns
      ? `⚠️ TURNS SO FAR: ${userTurns}. Minimum ${minTurns} required (${enrichedCtx.priority || 'unknown'} priority) before drafting. Keep investigating — do NOT emit a ticket yet.`
      : `✓ TURNS: ${userTurns} — minimum met. Discovery gate check applies.`;

    const rawRelatedTickets = Array.isArray(body.relatedTickets) ? body.relatedTickets : [];
    const relatedTicketsNote = rawRelatedTickets.length > 0
      ? [
          '',
          'PRIOR SIMILAR TICKETS (reporter logged something similar before):',
          ...rawRelatedTickets.slice(0, 3).map((ticket: unknown, i: number) => {
            const t = asRecord(ticket) || {};
            return `  ${i + 1}. "${stringValue(t.title) || 'Untitled'}" [${stringValue(t.status) || 'unknown'}]${t.studio ? ` · ${String(t.studio)}` : ''}${t.createdAt ? ` · ${String(t.createdAt).slice(0, 10)}` : ''}${t.category ? ` · ${String(t.category)}` : ''}`;
          }),
          '  → Approach this session from a DIFFERENT ANGLE than prior tickets. Reference what\'s already known, focus on what\'s new or different.',
        ].join('\n')
      : '';

    const contextSnapshot = [
      `CONTEXT CAPTURED SO FAR (reporter: ${reporter}):`,
      JSON.stringify(enrichedCtx, null, 2),
      '',
      routingNote,
      '',
      turnsNote,
      relatedTicketsNote,
      '',
      'RULES: Do NOT re-ask any field already present above. Investigate genuine gaps only.',
      'Remember: DISCOVERY GATE (D1–D7) must be complete, PRE-DRAFT SUMMARY must be shown and confirmed, BEFORE ticket is emitted.',
    ].filter((line) => line !== undefined).join('\n');

    const aiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextSnapshot },
      ...messages,
    ];

    let parsed: JsonRecord;
    try {
      const result = await callModel(openaiApiKey, aiMessages);
      parsed = result.parsed;
      console.info(`[Athena] responded via ${result.model} | turns=${userTurns}`);
    } catch (err) {
      console.error('[Athena] OpenAI request failed:', err instanceof Error ? err.message : err);
      return fallback("I'm having a brief connection issue — please resend your message and I'll pick it right up.", { error: 'AI unavailable' });
    }

    parsed = postProcess(parsed, context);
    parsed = enforceDiscoveryGate(parsed, userTurns, enrichedCtx);

    return new Response(JSON.stringify({
      reply:          parsed.reply           || 'Got it. What else can you tell me?',
      needsMoreInfo:  parsed.needsMoreInfo   !== false,
      discoveryStatus: parsed.discoveryStatus || {},
      inferredContext: parsed.inferredContext || {},
      detailForm:     parsed.detailForm       || null,
      ticket:         parsed.ticket           || null,
    }), { status: 200, headers: jsonHeaders });

  } catch (err) {
    console.error('[Athena] unhandled error:', err instanceof Error ? err.message : err);
    return fallback('Something unexpected went wrong — please try again.', { error: String(err) });
  }
});
