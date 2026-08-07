const BUTTON_FIELD_IDS = new Set([
  'intakeRoute',
  'priority',
  'clientsAffected',
  'classImpactType',
  'memberSentiment',
  'prospectQuality',
  'followUpPreference',
  'hvacSymptom',
  'machineSymptom',
  'bikeSymptom',
  'equipmentSymptom',
  'lockFaultType',
  'accessStatus',
  'securityRisk',
  'resolutionRequirement',
  'plumbingSymptom',
  'electricalSymptom',
  'appIssueSurface',
]);

const DROPDOWN_ONLY_FIELD_IDS = new Set([
  'studio',
  'category',
  'subCategory',
  'trainer',
  'classType',
  'sessionId',
  'membership',
]);

export function shouldUseOptionButtons({ id, optionCount }: { id: string; optionCount: number }): boolean {
  if (optionCount <= 0 || optionCount > 8) return false;
  if (DROPDOWN_ONLY_FIELD_IDS.has(id)) return false;
  return BUTTON_FIELD_IDS.has(id) || optionCount <= 6;
}
