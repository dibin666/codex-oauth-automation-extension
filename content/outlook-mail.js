// content/outlook-mail.js — Content script for Outlook Web mailbox polling
// Injected dynamically on: outlook.cloud.microsoft / outlook.office.com

const OUTLOOK_MAIL_PREFIX = '[MultiPage:e5-outlook-mail]';
const isTopFrame = window === window.top;

console.log(OUTLOOK_MAIL_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

if (!isTopFrame) {
  console.log(OUTLOOK_MAIL_PREFIX, 'Skipping child frame');
} else {

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'POLL_EMAIL') {
    resetStopState();
    handlePollEmail(message.step, message.payload).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      if (isStopError(err)) {
        log(`步骤 ${message.step}：已被用户停止。`, 'warn');
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      log(`步骤 ${message.step}：Outlook 轮询失败：${err.message}`, 'warn');
      sendResponse({ error: err.message });
    });
    return true;
  }
  return false;
});

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVisibleElement(element) {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function normalizeMinuteTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function extractVerificationCode(text) {
  const normalized = String(text || '');

  const openAiMatch = normalized.match(/your\s+(?:openai|chatgpt)\s+code\s+is[^0-9]{0,16}(\d{6})/i);
  if (openAiMatch) return openAiMatch[1];

  const verificationMatch = normalized.match(/(?:verification\s+code|temporary\s+verification\s+code|验证码|代码)[^0-9]{0,20}(\d{6})/i);
  if (verificationMatch) return verificationMatch[1];

  const plainMatch = normalized.match(/\b(\d{6})\b/);
  if (plainMatch) return plainMatch[1];

  return null;
}

function parseOutlookTimestampText(rawText) {
  const text = normalizeText(rawText);
  if (!text) return null;

  const parsedNative = Date.parse(text);
  if (Number.isFinite(parsedNative)) {
    return parsedNative;
  }

  let match = text.match(/(?:周.|星期.)?\s*(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, year, month, day, hourText = '0', minuteText = '0'] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hourText),
      Number(minuteText),
      0,
      0
    ).getTime();
  }

  match = text.match(/(?:周.|星期.)?\s*(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const now = new Date();
    const [, month, day, hourText = '0', minuteText = '0'] = match;
    return new Date(
      now.getFullYear(),
      Number(month) - 1,
      Number(day),
      Number(hourText),
      Number(minuteText),
      0,
      0
    ).getTime();
  }

  match = text.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]), 0, 0).getTime();
  }

  match = text.match(/昨天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]), 0, 0).getTime();
  }

  match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]), 0, 0).getTime();
  }

  return null;
}

function getMessageListRoot() {
  const selectors = [
    '#MailList',
    '[data-app-section="MessageList"] #MailList',
    '[data-app-section="MessageList"]',
    '[aria-label="邮件列表"]',
    '[aria-label="Message list"]',
  ];

  for (const selector of selectors) {
    const root = document.querySelector(selector);
    if (root) {
      return root;
    }
  }

  return null;
}

function getMessageListRows() {
  const root = getMessageListRoot() || document;
  const rows = Array.from(root.querySelectorAll('[role="option"][data-focusable-row="true"], [role="option"][data-convid]'));
  return rows.filter(isVisibleElement);
}

function getFirstTruthyRowValue(row, readers = []) {
  for (const reader of readers) {
    try {
      const value = normalizeText(reader(row));
      if (value) {
        return value;
      }
    } catch {
      // ignore bad selector reads
    }
  }
  return '';
}

function getRowMetadata(row, index = 0) {
  const sender = getFirstTruthyRowValue(row, [
    (item) => item.querySelector('.ESO13 span')?.getAttribute?.('title'),
    (item) => item.querySelector('.ESO13 span')?.textContent,
    (item) => item.querySelector('.ESO13')?.textContent,
    (item) => item.querySelector('[aria-label^="发件人"]')?.textContent,
  ]);

  const subject = getFirstTruthyRowValue(row, [
    (item) => item.querySelector('.TtcXM')?.getAttribute?.('title'),
    (item) => item.querySelector('.TtcXM')?.textContent,
    (item) => item.querySelector('[class*="subject"]')?.getAttribute?.('title'),
    (item) => item.querySelector('[class*="subject"]')?.textContent,
  ]);

  const preview = getFirstTruthyRowValue(row, [
    (item) => item.querySelector('.FqgPc')?.textContent,
    (item) => item.querySelector('[class*="preview"]')?.textContent,
  ]);

  const timeText = getFirstTruthyRowValue(row, [
    (item) => item.querySelector('._rWRU')?.getAttribute?.('title'),
    (item) => item.querySelector('._rWRU')?.textContent,
    (item) => item.querySelector('[title*="/"]')?.getAttribute?.('title'),
  ]);

  const ariaLabel = normalizeText(row.getAttribute('aria-label') || '');
  const combinedText = normalizeText([sender, subject, preview, timeText, ariaLabel].filter(Boolean).join(' '));
  const timestamp = parseOutlookTimestampText(timeText) || parseOutlookTimestampText(ariaLabel);
  const fingerprint = [
    row.getAttribute('id') || row.dataset?.convid || row.dataset?.itemIndex || `row-${index}`,
    subject,
    timeText,
  ].filter(Boolean).join('::').slice(0, 320);

  return {
    sender,
    subject,
    preview,
    timeText,
    ariaLabel,
    combinedText,
    timestamp,
    fingerprint,
  };
}

function rowMatchesFilters(meta, senderFilters = [], subjectFilters = []) {
  const senderText = normalizeText(meta.sender).toLowerCase();
  const subjectText = normalizeText([meta.subject, meta.preview].join(' ')).toLowerCase();
  const combinedText = normalizeText(meta.combinedText).toLowerCase();

  const senderMatch = senderFilters.some((filter) => {
    const value = String(filter || '').toLowerCase();
    return value && (senderText.includes(value) || combinedText.includes(value));
  });

  const subjectMatch = subjectFilters.some((filter) => {
    const value = String(filter || '').toLowerCase();
    return value && (subjectText.includes(value) || combinedText.includes(value));
  });

  return senderMatch || subjectMatch;
}

function selectLatestVerificationRow(rows = [], options = {}) {
  const {
    senderFilters = [],
    subjectFilters = [],
    filterAfterTimestamp = 0,
  } = options;

  const filterAfterMinute = normalizeMinuteTimestamp(Number(filterAfterTimestamp) || 0);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const meta = getRowMetadata(row, index);

    if (!rowMatchesFilters(meta, senderFilters, subjectFilters)) {
      continue;
    }

    if (filterAfterMinute) {
      const rowMinute = normalizeMinuteTimestamp(meta.timestamp || 0);
      if (!rowMinute || rowMinute < filterAfterMinute) {
        continue;
      }
    }

    const code = extractVerificationCode(meta.subject)
      || extractVerificationCode(meta.preview)
      || extractVerificationCode(meta.combinedText);

    return { row, meta, code };
  }

  return null;
}

async function waitForMessageListReady(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    throwIfStopped();
    const root = getMessageListRoot();
    if (root) {
      return root;
    }
    await sleep(200);
  }
  throw new Error('Outlook 邮件列表未加载完成，请确认当前已打开 Outlook 收件箱。');
}

async function handlePollEmail(step, payload) {
  const {
    senderFilters = [],
    subjectFilters = [],
    maxAttempts = 5,
    intervalMs = 3000,
    filterAfterTimestamp = 0,
    excludeCodes = [],
  } = payload || {};

  const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
  const timeBudgetSeconds = Math.max(1, Math.round((maxAttempts * intervalMs) / 1000));

  log(`步骤 ${step}：开始轮询 Outlook 邮箱（最多 ${maxAttempts} 次，不刷新页面）。`);
  await waitForMessageListReady(10000);

  let lastExcludedFingerprint = '';
  let lastMissingCodeFingerprint = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfStopped();
    log(`步骤 ${step}：正在等待 Outlook 最新验证码邮件，第 ${attempt}/${maxAttempts} 次`);

    const rows = getMessageListRows();
    const latestMatch = selectLatestVerificationRow(rows, {
      senderFilters,
      subjectFilters,
      filterAfterTimestamp,
    });

    if (latestMatch?.meta) {
      const { meta, code } = latestMatch;
      if (code && !excludedCodeSet.has(code)) {
        const timeLabel = meta.timestamp
          ? `，时间：${new Date(meta.timestamp).toLocaleString('zh-CN', { hour12: false })}`
          : '';
        log(`步骤 ${step}：已从 Outlook 最新邮件标题提取验证码：${code}${timeLabel}`, 'ok');
        return {
          ok: true,
          code,
          emailTimestamp: meta.timestamp || Date.now(),
          mailId: meta.fingerprint,
          preview: meta.subject || meta.preview || meta.combinedText.slice(0, 120),
        };
      }

      if (code && excludedCodeSet.has(code)) {
        if (lastExcludedFingerprint !== `${meta.fingerprint}::${code}`) {
          lastExcludedFingerprint = `${meta.fingerprint}::${code}`;
          log(`步骤 ${step}：最新匹配邮件仍是已排除验证码 ${code}，继续等待新邮件。`, 'info');
        }
      } else if (lastMissingCodeFingerprint !== meta.fingerprint) {
        lastMissingCodeFingerprint = meta.fingerprint;
        log(`步骤 ${step}：已检测到最新匹配邮件，但标题中暂未提取到验证码，继续等待。`, 'info');
      }
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  throw new Error(`${timeBudgetSeconds} 秒后仍未在 Outlook 中找到最新验证码邮件。`);
}

}
