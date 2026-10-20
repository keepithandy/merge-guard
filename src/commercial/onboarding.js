import { readLicenseState } from './license.js';
import { resolveCommercialConfig } from './config.js';

// Setup inspection is strictly read-only: a stored receipt is never a paid grant.
export function safeCustomerPortalUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  let url;
  try { url = new URL(value); }
  catch { throw new Error('Customer portal URL is invalid; configure a trusted HTTPS portal URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password
      || url.search || url.hash || /[\\x00-\\x1f\\x7f]/.test(value)) {
    throw new Error('Customer portal URL must be HTTPS without credentials, query or fragment.');
  }
  return url.toString();
}

export function inspectCommercialSetup({ env = process.env, readState = readLicenseState } = {}) {
  const config = resolveCommercialConfig(env);
  let portal = 'not-configured';
  if (config.customerPortalUrl) {
    try { safeCustomerPortalUrl(config.customerPortalUrl); portal = 'configured'; }
    catch { portal = 'invalid'; }
  }
  const stored = readState({ env });
  return {
    environment: config.environment,
    organizationConfigured: Boolean(config.organizationId),
    proBenefitConfigured: Boolean(config.proBenefitId),
    teamBenefitConfigured: Boolean(config.teamBenefitId),
    serviceConfigured: Boolean(config.environment === 'sandbox'
      ? env.MERGE_GUARD_PRO_SANDBOX_SERVICE_URL
      : (env.MERGE_GUARD_PRO_SERVICE_URL || config.proServiceUrl)),
    customerPortal: portal,
    localActivation: stored?.licenseKey && stored?.activationId
      ? 'stored-unverified' : 'not-activated',
    productionCheckoutEnabled: false
  };
}

export function formatCommercialSetup(setup) {
  const status = value => value ? 'configured' : 'not configured';
  return [
    'Merge Guard commercial setup (' + setup.environment + ')',
    'Organization: ' + status(setup.organizationConfigured),
    'Pro benefit: ' + status(setup.proBenefitConfigured),
    'Team benefit: ' + status(setup.teamBenefitConfigured),
    'Fulfillment gateway: ' + status(setup.serviceConfigured),
    'Customer portal: ' + setup.customerPortal,
    'Local activation: ' + setup.localActivation + ' (not a grant)',
    'Production checkout: disabled in this build',
    '',
    'Next: configure the selected Polar environment; activate using --stdin; run license to verify live.',
    'See docs/polar-setup.md. Free scanning works without licensing.'
  ].join('\\n');
}
