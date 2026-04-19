const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/verification-flow.js', 'utf8');

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

test('requestVerificationCodeResend switches back to configured mail tab after resend', async () => {
  const bundle = extractFunction('requestVerificationCodeResend');
  const api = new Function(`
const calls = { updates: [], logs: [], sent: [] };
const chrome = {
  tabs: {
    update: async (tabId, payload) => {
      calls.updates.push({ tabId, payload });
    },
  },
};
async function getTabId(source) {
  if (source === 'signup-page') return 11;
  if (source === 'e5-outlook-mail') return 22;
  return null;
}
function throwIfStopped() {}
async function sendToContentScript(_source, message) {
  calls.sent.push(message);
  return { ok: true };
}
async function getResponseTimeoutMsForStep() { return 30000; }
function getVerificationCodeLabel(step) { return step === 4 ? '注册' : '登录'; }
async function addLog(message, level) {
  calls.logs.push({ message, level });
}
async function setState() {}
async function getState() { return { mailProvider: 'e5-pool' }; }
${bundle}
return { calls, requestVerificationCodeResend };
`)();

  const requestedAt = await api.requestVerificationCodeResend(4, {
    mailTabSource: 'e5-outlook-mail',
    mailTabLabel: 'E5 Outlook 邮箱',
  });

  assert.equal(Number.isFinite(requestedAt), true);
  assert.deepEqual(api.calls.updates, [
    { tabId: 11, payload: { active: true } },
    { tabId: 22, payload: { active: true } },
  ]);
  assert.equal(api.calls.sent.length, 1);
  assert.match(api.calls.logs[1].message, /已切换回E5 Outlook 邮箱标签页等待新邮件/);
});
