export type GuardFieldType = 'select' | 'text' | 'textarea' | 'date' | 'datetime-local' | 'number';

export interface GuardFieldDefinition {
  id: string;
  label: string;
  type: GuardFieldType;
  required?: boolean;
}

const GUARD_FIELD_TYPES: Record<string, GuardFieldType> = {
  intakeRoute: 'select',
  requestType: 'select',
  clientsAffected: 'select',
  studio: 'select',
  category: 'select',
  subCategory: 'select',
  trainer: 'select',
  classType: 'select',
  membership: 'select',
  memberName: 'text',
  memberContact: 'text',
  reportedBy: 'select',
  priority: 'select',
  description: 'textarea',
  desiredResolution: 'textarea',
  resolutionRequired: 'select',
  incidentDateTime: 'datetime-local',
  memberSentiment: 'select',
  momencePurchaseContext: 'textarea',
  classImpactType: 'select',
  classImpactDetails: 'textarea',
  reportedTime: 'datetime-local',
  actualStartTime: 'datetime-local',
  delayMinutes: 'number',
  advanceNoticeGiven: 'select',
  advanceNoticeTime: 'datetime-local',
  membersAffected: 'textarea',
  membersUpset: 'textarea',
  latenessReason: 'textarea',
  serviceRecoveryNeeded: 'select',
  serviceRecoveryAction: 'textarea',
  freezeStartDate: 'date',
  freezeEndDate: 'date',
  freezeReason: 'select',
  classesRemaining: 'number',
  packageExpiryDate: 'date',
  requestedRolloverDate: 'date',
  rolloverReason: 'select',
  partnerName: 'text',
  hostedFeedbackArea: 'select',
  attendeeCount: 'number',
  prospectQuality: 'select',
  followUpPreference: 'select',
  machineSymptom: 'select',
  bikeSymptom: 'select',
  equipmentSymptom: 'select',
  hvacSymptom: 'select',
  lockFaultType: 'select',
  accessStatus: 'select',
  securityRisk: 'select',
  plumbingSymptom: 'select',
  electricalSymptom: 'select',
  affectedArea: 'select',
  operationalImpact: 'select',
  currentWorkaround: 'select',
  resolutionRequirement: 'select',
  appIssueSurface: 'select',
  appErrorObserved: 'textarea',
  deviceContext: 'text',
};

export function getGuardFieldType(id: string): GuardFieldType | undefined {
  return GUARD_FIELD_TYPES[id];
}

export function buildGuardFieldDefinition(id: string): GuardFieldDefinition {
  return {
    id,
    label: '',
    type: getGuardFieldType(id) || 'text',
    required: true,
  };
}
