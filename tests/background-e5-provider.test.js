const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('normalizeMailProvider keeps e5 provider', () => {
  const bundle = extractFunction('normalizeMailProvider');
  const api = new Function(`
const E5_PROVIDER = 'e5-pool';
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const PERSISTED_SETTING_DEFAULTS = { mailProvider: '163' };
${bundle}
return { normalizeMailProvider };
`)();

  assert.equal(api.normalizeMailProvider('e5-pool'), 'e5-pool');
  assert.equal(api.normalizeMailProvider('E5-POOL'), 'e5-pool');
});

test('normalizePersistentSettingValue handles e5 settings', () => {
  const bundle = [
    extractFunction('normalizePersistentSettingValue'),
  ].join('\n');

  const api = new Function(`
const E5_PROVIDER = 'e5-pool';
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const HOTMAIL_SERVICE_MODE_LOCAL = 'local';
const DEFAULT_LOCAL_CPA_STEP9_MODE = 'submit';
const DEFAULT_HOTMAIL_REMOTE_BASE_URL = '';
const DEFAULT_HOTMAIL_LOCAL_BASE_URL = 'http://127.0.0.1:17373';
const DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL = 'http://127.0.0.1:17373';
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const VERIFICATION_RESEND_COUNT_MIN = 0;
const VERIFICATION_RESEND_COUNT_MAX = 20;
const PERSISTED_SETTING_DEFAULTS = { mailProvider: '163', autoStepDelaySeconds: null };
function normalizePanelMode(value = '') { return String(value || '').trim().toLowerCase() === 'sub2api' ? 'sub2api' : 'cpa'; }
function normalizeMailProvider(value = '') { return String(value || '').trim().toLowerCase() || '163'; }
function normalizeE5InboxMode(value = '') { return String(value || '').trim().toLowerCase() === 'gmail' ? 'gmail' : 'outlook'; }
function normalizeMail2925Mode(value = '') { return String(value || '').trim().toLowerCase() === 'receive' ? 'receive' : 'provide'; }
function normalizeEmailGenerator(value = '') { return String(value || '').trim().toLowerCase() || 'duck'; }
function normalizeIcloudHost(value = '') { return ['icloud.com', 'icloud.com.cn'].includes(String(value || '').trim().toLowerCase()) ? String(value || '').trim().toLowerCase() : ''; }
function normalizeAutoRunFallbackThreadIntervalMinutes(value) { return Math.max(0, Math.floor(Number(value) || 0)); }
function normalizeAutoRunDelayMinutes(value) { return Math.max(1, Math.floor(Number(value) || 30)); }
function normalizeAutoStepDelaySeconds(value, fallback = null) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback; }
function normalizeVerificationResendCount(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.min(20, Math.max(0, Math.floor(numeric))) : fallback; }
function normalizeLocalCpaStep9Mode(value = '') { return String(value || '').trim().toLowerCase() === 'bypass' ? 'bypass' : DEFAULT_LOCAL_CPA_STEP9_MODE; }
function normalizeHotmailServiceMode() { return HOTMAIL_SERVICE_MODE_LOCAL; }
function normalizeHotmailRemoteBaseUrl(value = '') { return String(value || '').trim() || DEFAULT_HOTMAIL_REMOTE_BASE_URL; }
function normalizeHotmailLocalBaseUrl(value = '') { return String(value || '').trim() || DEFAULT_HOTMAIL_LOCAL_BASE_URL; }
function normalizeAccountRunHistoryHelperBaseUrl(value = '') { return String(value || '').trim() || DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL; }
function normalizeCloudflareDomain(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareDomains(values = []) { return Array.isArray(values) ? values : []; }
function normalizeCloudflareTempEmailBaseUrl(value = '') { return String(value || '').trim(); }
function normalizeCloudflareTempEmailReceiveMailbox(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomain(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailDomains(values = []) { return Array.isArray(values) ? values : []; }
function normalizeCloudflareTempEmailAddress(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeE5Accounts(value = []) { return Array.isArray(value) ? value : []; }
function normalizeHotmailAccounts(value = []) { return Array.isArray(value) ? value : []; }
${bundle}
return { normalizePersistentSettingValue };
`)();

  assert.equal(api.normalizePersistentSettingValue('e5InboxMode', 'gmail'), 'gmail');
  assert.equal(api.normalizePersistentSettingValue('e5InboxMode', 'bad-value'), 'outlook');
  assert.deepEqual(api.normalizePersistentSettingValue('e5Accounts', [{ email: 'demo@outlook.com' }]), [{ email: 'demo@outlook.com' }]);
});

test('getMailConfig returns e5 outlook polling config and gmail forwarded config', () => {
  const bundle = extractFunction('getMailConfig');
  const api = new Function(`
const E5_PROVIDER = 'e5-pool';
const E5_INBOX_MODE_GMAIL = 'gmail';
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const DEFAULT_E5_INBOX_URL = 'https://outlook.cloud.microsoft/';
function getE5InboxMode(state = {}) { return String(state?.e5InboxMode || '').trim().toLowerCase() === 'gmail' ? 'gmail' : 'outlook'; }
function normalizeIcloudHost(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeInbucketOrigin(value = '') { return String(value || '').trim(); }
function getConfiguredIcloudHostPreference() { return ''; }
function getIcloudLoginUrlForHost() { return 'https://www.icloud.com/'; }
function getIcloudMailUrlForHost() { return 'https://www.icloud.com/mail/'; }
${bundle}
return { getMailConfig };
`)();

  assert.deepEqual(api.getMailConfig({ mailProvider: 'e5-pool', e5InboxMode: 'outlook' }), {
    provider: 'e5-pool',
    source: 'e5-outlook-mail',
    url: 'https://outlook.cloud.microsoft/',
    label: 'E5 Outlook 邮箱',
    navigateOnReuse: true,
    inject: ['content/activation-utils.js', 'content/utils.js', 'content/outlook-mail.js'],
    injectSource: 'e5-outlook-mail',
    requestFreshCodeFirst: false,
    resendIntervalMs: 30000,
  });

  assert.deepEqual(api.getMailConfig({ mailProvider: 'e5-pool', e5InboxMode: 'gmail' }), {
    provider: 'e5-pool',
    source: 'gmail-mail',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    label: 'E5 转发 Gmail 邮箱',
    inject: ['content/activation-utils.js', 'content/utils.js', 'content/gmail-mail.js'],
    injectSource: 'gmail-mail',
  });
});

test('finalizeE5AccountAfterSuccessfulFlow marks current e5 account as registered', async () => {
  const bundle = extractFunction('finalizeE5AccountAfterSuccessfulFlow');
  const api = new Function(`
const calls = { patches: [], logs: [] };
function isE5Provider(state) { return state?.mailProvider === 'e5-pool'; }
async function patchE5Account(accountId, updates) {
  calls.patches.push({ accountId, updates });
  return { id: accountId, email: 'demo@outlook.com', ...updates };
}
async function addLog(message, level) {
  calls.logs.push({ message, level });
}
${bundle}
return { calls, finalizeE5AccountAfterSuccessfulFlow };
`)();

  const result = await api.finalizeE5AccountAfterSuccessfulFlow({
    mailProvider: 'e5-pool',
    currentE5AccountId: 'e5-1',
  });

  assert.equal(result.handled, true);
  assert.equal(result.account.email, 'demo@outlook.com');
  assert.equal(api.calls.patches.length, 1);
  assert.equal(api.calls.patches[0].accountId, 'e5-1');
  assert.equal(api.calls.patches[0].updates.status, 'registered');
  assert.equal(api.calls.logs.length, 1);
});
