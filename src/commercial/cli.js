import { activateLicense, clearLicenseState, deactivateLicense, readLicenseState, validateLicense } from './license.js';
import { resolveCommercialConfig } from './config.js';

function titleCase(value) {
  return String(value || '').replace(/(^|_)([a-z])/g, (_, prefix, char) => `${prefix ? ' ' : ''}${char.toUpperCase()}`);
}

function checkoutUrl(plan, env) {
  const config = resolveCommercialConfig(env);
  return plan === 'team' ? config.teamCheckoutUrl : config.proCheckoutUrl;
}

export async function runCommercialCommand(args, { env = process.env } = {}) {
  const [command, value, ...rest] = args;
  if (!['plan', 'activate', 'license', 'account'].includes(command)) return false;
  if (rest.length) throw new Error(`${command} received unexpected extra arguments`);
  if ((command === 'plan' || command === 'account') && value) throw new Error(`${command} does not accept an argument`);
  if (command === 'license' && value && value !== 'clear') throw new Error('license accepts only the optional "clear" argument');
  const { environment } = resolveCommercialConfig(env);
  if (environment === 'sandbox') console.log('Polar environment: Sandbox (test licenses only)');

  if (command === 'activate') {
    if (!value) throw new Error('activate requires a Polar license key');
    const state = await activateLicense(value, { env });
    console.log(`Merge Guard ${titleCase(state.plan)} activated.\n\nPlan: ${titleCase(state.plan)}\nLicense: ${titleCase(state.status)}`);
    if (state.warning) console.log(`\nWarning: ${state.warning}`);
    return true;
  }

  if (command === 'license' && value === 'clear') {
    try {
      await deactivateLicense({ env });
      console.log('Merge Guard license deactivated and local state cleared. Free features remain available.');
    } catch (error) {
      clearLicenseState({ env });
      console.log(`Merge Guard local license state cleared. Polar deactivation could not be confirmed: ${error.message}`);
    }
    return true;
  }

  if (command === 'account') {
    const url = resolveCommercialConfig(env).customerPortalUrl;
    if (!url) {
      console.log('Customer portal URL is not configured. Set MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL.');
    } else {
      console.log(`Manage your Merge Guard subscription: ${url}`);
    }
    return true;
  }

  const state = command === 'license' ? await validateLicense({ env, force: true }) : await validateLicense({ env });
  console.log(`Merge Guard ${titleCase(state.plan)}\n\nPlan: ${titleCase(state.plan)}\nLicense: ${titleCase(state.status)}`);
  if (state.lastValidatedAt) console.log(`Last validation: ${state.lastValidatedAt}`);
  console.log('\nCapabilities:');
  for (const capability of state.capabilities) console.log(`- ${titleCase(capability)}`);
  if (state.warning) console.log(`\nWarning: ${state.warning}`);
  if (state.plan === 'free') {
    const url = checkoutUrl('pro', env);
    console.log(`\nUpgrade: ${url || 'Set MERGE_GUARD_PRO_CHECKOUT_URL to configure checkout.'}`);
  }
  return true;
}

export function currentLicenseSummary({ env = process.env } = {}) {
  const state = readLicenseState({ env });
  // A synchronous disk summary cannot establish a paid authorization.
  return state ? { provider: state.provider, plan: 'free', status: 'unverified', lastValidatedAt: state.lastValidatedAt } : null;
}
