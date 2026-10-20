// Public commercial identifiers and URLs may be committed here once Polar products exist.
// They are not authentication secrets. Environment variables override them for test, CI,
// or alternate distributions. Never place Polar organization access tokens in this file.
export const POLAR_BUILD_CONFIG = Object.freeze({
  organizationId: '',
  proBenefitId: '',
  teamBenefitId: '',
  proCheckoutUrl: '',
  teamCheckoutUrl: '',
  customerPortalUrl: '',
  proServiceUrl: ''
});

export function resolveCommercialConfig(env = process.env) {
  const environment = env.MERGE_GUARD_POLAR_ENVIRONMENT || 'production';
  if (environment !== 'production' && environment !== 'sandbox') {
    throw new Error('MERGE_GUARD_POLAR_ENVIRONMENT must be production or sandbox.');
  }
  // Sandbox must never inherit a production seller, benefit, checkout, or portal.
  const defaults = environment === 'production' ? POLAR_BUILD_CONFIG : {};
  return {
    environment,
    apiBaseUrl: environment === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh',
    organizationId: env.MERGE_GUARD_POLAR_ORGANIZATION_ID || defaults.organizationId || '',
    proBenefitId: env.MERGE_GUARD_POLAR_PRO_BENEFIT_ID || defaults.proBenefitId || '',
    teamBenefitId: env.MERGE_GUARD_POLAR_TEAM_BENEFIT_ID || defaults.teamBenefitId || '',
    proCheckoutUrl: env.MERGE_GUARD_PRO_CHECKOUT_URL || defaults.proCheckoutUrl || '',
    teamCheckoutUrl: env.MERGE_GUARD_TEAM_CHECKOUT_URL || defaults.teamCheckoutUrl || '',
    customerPortalUrl: env.MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL || defaults.customerPortalUrl || '',
    proServiceUrl: env.MERGE_GUARD_PRO_SERVICE_URL || defaults.proServiceUrl || ''
  };
}
