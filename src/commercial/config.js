// Public commercial identifiers and URLs may be committed here once Polar products exist.
// They are not authentication secrets. Environment variables override them for test, CI,
// or alternate distributions. Never place Polar organization access tokens in this file.
export const POLAR_BUILD_CONFIG = Object.freeze({
  organizationId: '',
  proBenefitId: '',
  teamBenefitId: '',
  proCheckoutUrl: '',
  teamCheckoutUrl: '',
  customerPortalUrl: ''
});

export function resolveCommercialConfig(env = process.env) {
  return {
    organizationId: env.MERGE_GUARD_POLAR_ORGANIZATION_ID || POLAR_BUILD_CONFIG.organizationId,
    proBenefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID || POLAR_BUILD_CONFIG.proBenefitId,
    teamBenefitId: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID || POLAR_BUILD_CONFIG.teamBenefitId,
    proCheckoutUrl: env.MERGE_GUARD_PRO_CHECKOUT_URL || POLAR_BUILD_CONFIG.proCheckoutUrl,
    teamCheckoutUrl: env.MERGE_GUARD_TEAM_CHECKOUT_URL || POLAR_BUILD_CONFIG.teamCheckoutUrl,
    customerPortalUrl: env.MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL || POLAR_BUILD_CONFIG.customerPortalUrl
  };
}
