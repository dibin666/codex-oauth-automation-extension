const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/outlook-mail.js', 'utf8');

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

function createOutlookRow({
  id,
  dataConvid,
  sender = '',
  subject = '',
  preview = '',
  timeTitle = '',
  timeText = '',
  ariaLabel = '',
}) {
  const selectorMap = {
    '.ESO13 span': {
      getAttribute(name) {
        return name === 'title' ? sender : '';
      },
      textContent: sender,
    },
    '.ESO13': { textContent: sender },
    '.TtcXM': {
      getAttribute(name) {
        return name === 'title' ? subject : '';
      },
      textContent: subject,
    },
    '.FqgPc': { textContent: preview },
    '._rWRU': {
      getAttribute(name) {
        return name === 'title' ? timeTitle : '';
      },
      textContent: timeText,
    },
  };

  return {
    dataset: dataConvid ? { convid: dataConvid } : {},
    getAttribute(name) {
      if (name === 'id') return id || '';
      if (name === 'aria-label') return ariaLabel || '';
      return '';
    },
    querySelector(selector) {
      return selectorMap[selector] || null;
    },
  };
}

test('parseOutlookTimestampText parses chinese full datetime title', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('parseOutlookTimestampText'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { parseOutlookTimestampText };
`)();

  assert.equal(
    api.parseOutlookTimestampText('周日 2026/4/19 22:46'),
    new Date(2026, 3, 19, 22, 46, 0, 0).getTime()
  );
});

test('selectLatestVerificationRow returns the newest matching openai mail only', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('normalizeMinuteTimestamp'),
    extractFunction('extractVerificationCode'),
    extractFunction('parseOutlookTimestampText'),
    extractFunction('getFirstTruthyRowValue'),
    extractFunction('getRowMetadata'),
    extractFunction('rowMatchesFilters'),
    extractFunction('selectLatestVerificationRow'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { selectLatestVerificationRow };
`)();

  const rows = [
    createOutlookRow({
      id: 'latest',
      dataConvid: 'conv-latest',
      sender: 'noreply@tm.openai.com',
      subject: 'Your OpenAI code is 487580',
      preview: 'Enter this temporary verification code to continue: 487580',
      timeTitle: '周日 2026/4/19 22:46',
      timeText: '22:46',
      ariaLabel: 'noreply@tm.openai.com Your OpenAI code is 487580 22:46',
    }),
    createOutlookRow({
      id: 'older',
      dataConvid: 'conv-older',
      sender: 'OpenAI',
      subject: 'Your ChatGPT code is 992898',
      preview: 'Enter this temporary verification code to continue: 992898',
      timeTitle: '周日 2026/4/19 22:45',
      timeText: '22:45',
      ariaLabel: 'OpenAI Your ChatGPT code is 992898 22:45',
    }),
  ];

  const result = api.selectLatestVerificationRow(rows, {
    senderFilters: ['openai', 'noreply'],
    subjectFilters: ['code', 'verification'],
    filterAfterTimestamp: new Date(2026, 3, 19, 22, 46, 30, 0).getTime(),
  });

  assert.equal(result.meta.fingerprint.includes('latest'), true);
  assert.equal(result.code, '487580');
});

test('selectLatestVerificationRow skips rows older than filterAfterTimestamp', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('normalizeMinuteTimestamp'),
    extractFunction('extractVerificationCode'),
    extractFunction('parseOutlookTimestampText'),
    extractFunction('getFirstTruthyRowValue'),
    extractFunction('getRowMetadata'),
    extractFunction('rowMatchesFilters'),
    extractFunction('selectLatestVerificationRow'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { selectLatestVerificationRow };
`)();

  const rows = [
    createOutlookRow({
      id: 'older',
      dataConvid: 'conv-older',
      sender: 'OpenAI',
      subject: 'Your ChatGPT code is 992898',
      preview: 'Enter this temporary verification code to continue: 992898',
      timeTitle: '周日 2026/4/19 22:45',
      timeText: '22:45',
      ariaLabel: 'OpenAI Your ChatGPT code is 992898 22:45',
    }),
  ];

  const result = api.selectLatestVerificationRow(rows, {
    senderFilters: ['openai', 'noreply'],
    subjectFilters: ['code', 'verification'],
    filterAfterTimestamp: new Date(2026, 3, 19, 22, 46, 30, 0).getTime(),
  });

  assert.equal(result, null);
});
