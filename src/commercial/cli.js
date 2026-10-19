import { activateLicense, clearLicenseState, deactivateLicense, readLicenseState, validateLicense } from './license.js';
import { resolveCommercialConfig } from './config.js';

// A piped key avoids exposing a sensitive value in shell history or argv.
async function readActivationKey(input) {
  if (input?.isTTY) throw new Error('Pipe the license key into "merge-guard activate --stdin"; interactive input is not supported.');
  if (!input || typeof input[Symbol.asyncIterator] !== 'function') {
    throw new Error('activate --stdin requires a readable standard input stream');
  }
  let received = '';
  for await (const chunk of input) {
    received += chunk.toString('utf8');
    if (Buffer.byteLength(received, 'utf8') > 4096) {
      throw new Error('activate --stdin input exceeds the 4096-byte maximum');
    }
  }
  const key = received.replace(/\r?\n$/, '');
  if (!key || /[\r\n]/.test(key)) {
    throw new Error('activate --stdin requires exactly one nonempty license key');
  }
  return key;
}

function titleCase(value) {
  return String(value || '').replace(/(^|_)([a-z])/g, (_, prefix, char) => `${prefix ? ' ' : ''}${char.toUpperCase()}`);
}

function checkoutUrl(plan, env) {
  const config = resolveCommercialConfig(env);
  return plan === 'team' ? config.teamCheckoutUrl : config.proCheckoutUrl;
}

export async function runCommercialCommand(args, { env = process.env, stdin = process.stdin } = {}) {
  const [command, value, ...rest] = args;
  if (!['plan', 'activate', 'license', 'account'].includes(command)) return false;
  if (rest.length) throw new Error(`${command} received unexpected extra arguments`);
  if ((command === 'plan' || command === 'account') && value) throw new Error(`${command} does not accept an argument`);
  if (command === 'license' && value && value !== 'clear') throw new Error('license accepts only the optional "clear" argument');

  if (command === 'activate') {
    if (!value) throw new Error('activate requires a Polar license key or --stdin');
    const key = value === '--stdin' ? await readActivationKey(stdin) : value;
    const state = await activateLicense(key, { env });
    console.log(`Merge Guard ${titleCase(state.plan)} activated.\n\nPlan: ${titleCase(state.plan)}\nLicense: ${titleCase(state.status)}`);
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
  return state ? { provider: state.provider, plan: state.plan, status: state.status, lastValidatedAt: state.lastValidatedAt } : null;
}
