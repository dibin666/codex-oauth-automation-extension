const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadFactory(path, exportName) {
  const source = fs.readFileSync(path, 'utf8');
  const globalObject = {};
  const api = new Function('self', 'globalThis', `${source}; return (self.${exportName} || globalThis.${exportName});`)(globalObject, globalObject);
  return api;
}

test('step 4 uses outlook polling for E5 outlook mode instead of manual bypass', async () => {
  const moduleApi = loadFactory('background/steps/fetch-signup-code.js', 'MultiPageBackgroundStep4');
  const events = { reuseCalls: [], confirmSteps: [], resolveCalls: [] };

  const executor = moduleApi.createStep4Executor({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async (step) => { events.confirmSteps.push(step); },
    getMailConfig: () => ({
      provider: 'e5-pool',
      source: 'e5-outlook-mail',
      url: 'https://outlook.cloud.microsoft/',
      label: 'E5 Outlook 邮箱',
      requestFreshCodeFirst: false,
      resendIntervalMs: 30000,
      inject: ['content/activation-utils.js', 'content/utils.js', 'content/outlook-mail.js'],
      injectSource: 'e5-outlook-mail',
    }),
    getTabId: async () => 11,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    resolveVerificationStep: async (...args) => { events.resolveCalls.push(args); },
    reuseOrCreateTab: async (...args) => { events.reuseCalls.push(args); },
    sendToContentScriptResilient: async () => ({}),
    shouldUseManualVerificationBypass: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    throwIfStopped: () => {},
  });

  await executor.executeStep4({});

  assert.deepEqual(events.confirmSteps, []);
  assert.equal(events.reuseCalls.length, 1);
  assert.equal(events.reuseCalls[0][0], 'e5-outlook-mail');
  assert.equal(events.reuseCalls[0][1], 'https://outlook.cloud.microsoft/');
  assert.equal(events.resolveCalls.length, 1);
  assert.equal(events.resolveCalls[0][2].source, 'e5-outlook-mail');
  assert.equal(events.resolveCalls[0][3].requestFreshCodeFirst, false);
  assert.equal(events.resolveCalls[0][3].resendIntervalMs, 30000);
  assert.equal(events.resolveCalls[0][3].mailTabSource, 'e5-outlook-mail');
});

test('step 8 uses outlook polling for E5 outlook mode instead of manual bypass', async () => {
  const moduleApi = loadFactory('background/steps/fetch-login-code.js', 'MultiPageBackgroundStep8');
  const events = { reuseCalls: [], confirmSteps: [], resolveCalls: [] };

  const executor = moduleApi.createStep8Executor({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    confirmCustomVerificationStepBypass: async (step) => { events.confirmSteps.push(step); },
    ensureStep8VerificationPageReady: async () => ({ state: 'verification_page', displayedEmail: 'demo@outlook.com' }),
    getOAuthFlowRemainingMs: async () => 60000,
    getOAuthFlowStepTimeoutMs: async () => 15000,
    getMailConfig: () => ({
      provider: 'e5-pool',
      source: 'e5-outlook-mail',
      url: 'https://outlook.cloud.microsoft/',
      label: 'E5 Outlook 邮箱',
      resendIntervalMs: 30000,
      inject: ['content/activation-utils.js', 'content/utils.js', 'content/outlook-mail.js'],
      injectSource: 'e5-outlook-mail',
    }),
    getState: async () => ({}),
    getTabId: async () => 22,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => false,
    isVerificationMailPollingError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    resolveVerificationStep: async (...args) => { events.resolveCalls.push(args); },
    rerunStep7ForStep8Recovery: async () => {},
    reuseOrCreateTab: async (...args) => { events.reuseCalls.push(args); },
    setState: async () => {},
    shouldUseManualVerificationBypass: () => false,
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 3,
    throwIfStopped: () => {},
  });

  await executor.executeStep8({ oauthUrl: 'https://oauth.example/current', email: 'demo@outlook.com' });

  assert.deepEqual(events.confirmSteps, []);
  assert.equal(events.reuseCalls.length, 1);
  assert.equal(events.reuseCalls[0][0], 'e5-outlook-mail');
  assert.equal(events.reuseCalls[0][1], 'https://outlook.cloud.microsoft/');
  assert.equal(events.resolveCalls.length, 1);
  assert.equal(events.resolveCalls[0][2].source, 'e5-outlook-mail');
  assert.equal(events.resolveCalls[0][3].requestFreshCodeFirst, false);
  assert.equal(events.resolveCalls[0][3].resendIntervalMs, 30000);
  assert.equal(events.resolveCalls[0][3].mailTabSource, 'e5-outlook-mail');
});
