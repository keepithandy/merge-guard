export const PLAN_FREE = 'free';
export const PLAN_PRO = 'pro';
export const PLAN_TEAM = 'team';

export const CAPABILITIES = Object.freeze({
  CORE_SCAN: 'core_scan',
  STANDARD_OUTPUTS: 'standard_outputs',
  CUSTOM_RULES: 'custom_rules',
  STARTER_POLICIES: 'starter_policies',
  REPORT_COMPARISON: 'report_comparison',
  LOCAL_DASHBOARD: 'local_dashboard',
  PREMIUM_POLICY_DELIVERY: 'premium_policy_delivery',
  PRIORITY_SUPPORT: 'priority_support',
  SHARED_POLICY_DELIVERY: 'shared_policy_delivery',
  TEAM_SUPPORT: 'team_support'
});

const FREE_CAPABILITIES = [
  CAPABILITIES.CORE_SCAN,
  CAPABILITIES.STANDARD_OUTPUTS,
  CAPABILITIES.CUSTOM_RULES,
  CAPABILITIES.STARTER_POLICIES,
  CAPABILITIES.REPORT_COMPARISON,
  CAPABILITIES.LOCAL_DASHBOARD
];

const PLAN_CAPABILITIES = Object.freeze({
  [PLAN_FREE]: Object.freeze([...FREE_CAPABILITIES]),
  [PLAN_PRO]: Object.freeze([
    ...FREE_CAPABILITIES,
    CAPABILITIES.PREMIUM_POLICY_DELIVERY,
    CAPABILITIES.PRIORITY_SUPPORT
  ]),
  [PLAN_TEAM]: Object.freeze([
    ...FREE_CAPABILITIES,
    CAPABILITIES.PREMIUM_POLICY_DELIVERY,
    CAPABILITIES.PRIORITY_SUPPORT,
    CAPABILITIES.SHARED_POLICY_DELIVERY,
    CAPABILITIES.TEAM_SUPPORT
  ])
});

export function normalizePlan(plan) {
  return [PLAN_FREE, PLAN_PRO, PLAN_TEAM].includes(plan) ? plan : PLAN_FREE;
}

export function capabilitiesForPlan(plan) {
  return PLAN_CAPABILITIES[normalizePlan(plan)];
}

export function hasCapability(plan, capability) {
  return capabilitiesForPlan(plan).includes(capability);
}

export function planForBenefitId(benefitId, env = process.env) {
  if (!benefitId) return PLAN_FREE;
  if (env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID && benefitId === env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID) return PLAN_TEAM;
  if (env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID && benefitId === env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID) return PLAN_PRO;
  return PLAN_FREE;
}
