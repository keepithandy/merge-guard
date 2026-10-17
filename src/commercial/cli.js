import { activateLicense, clearLicenseState, readLicenseState, validateLicense } from './license.js';

function titleCase(value) {
  return String(value || '').replace(/(^|_)([a-z])/g, (_, prefix, char) => `${prefix ? ' ' : ''}${char.toUpperCase()}`);
}

function checkoutUrl(plan, env) {
  return plan === 'team' ? env.MERGE_GUARD_TEAM_CHECKOUT_URL : env.MERGE_GUARD_PRO_CHECKOUT_URL;
}

export async function runCommercialCommand(args, { env = process.env } = {}) {
  const [command, value] = args;
  if (!['plan', 'activate', 'license', 'account'].includes(command)) return false;

  if (command === 'activate') {
    if (!value) throw new Error('activate requires a Polar license key');
    const state = await activateLicense(value, { env });
    console.log(`Merge Guard ${titleCase(state.plan)} activated.\n\nPlan: ${titleCase(state.plan)}\nLicense: ${titleCase(state.status)}`);
    return true;
  }

  if (command === 'license' && value === 'clear') {
    clearLicenseState({ env });
    console.log('Merge Guard license state cleared. Free features remain available.');
    return true;
  }

  if (command === 'account') {
    const url = env.MERGE_GUARD_POLAR_CUSTOMER_PORTAL_URL;
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
  return state ? { provider: state.provider, plan: state.plan, status: state.status, lastValidatedAt: state.lastValidatedAt } : null;
}
