const test = require('node:test');
const assert = require('node:assert/strict');

const {
  E5_INBOX_MODE_GMAIL,
  E5_INBOX_MODE_OUTLOOK,
  normalizeE5InboxMode,
  parseE5ImportText,
  pickE5AccountForRun,
  shouldClearCurrentE5Selection,
  upsertE5AccountInList,
} = require('../e5-utils.js');

test('normalizeE5InboxMode defaults to outlook and accepts gmail', () => {
  assert.equal(normalizeE5InboxMode('gmail'), E5_INBOX_MODE_GMAIL);
  assert.equal(normalizeE5InboxMode('GMAIL'), E5_INBOX_MODE_GMAIL);
  assert.equal(normalizeE5InboxMode('outlook'), E5_INBOX_MODE_OUTLOOK);
  assert.equal(normalizeE5InboxMode('anything-else'), E5_INBOX_MODE_OUTLOOK);
});

test('parseE5ImportText reads one email per line and preserves registered marker', () => {
  const accounts = parseE5ImportText([
    'alpha@outlook.com',
    'beta@outlook.com 已注册',
    'invalid-line',
  ].join('\n'));

  assert.deepEqual(
    accounts.map((account) => ({ email: account.email, status: account.status })),
    [
      { email: 'alpha@outlook.com', status: 'pending' },
      { email: 'beta@outlook.com', status: 'registered' },
    ]
  );
});

test('pickE5AccountForRun prefers pending account with oldest lastSelectedAt', () => {
  const selected = pickE5AccountForRun([
    { id: 'recent', email: 'recent@outlook.com', status: 'pending', lastSelectedAt: 20 },
    { id: 'registered', email: 'done@outlook.com', status: 'registered', lastSelectedAt: 0 },
    { id: 'oldest', email: 'oldest@outlook.com', status: 'pending', lastSelectedAt: 10 },
  ]);

  assert.equal(selected?.id, 'oldest');
});

test('upsertE5AccountInList replaces matching email and registered accounts clear current selection', () => {
  const nextAccounts = upsertE5AccountInList([
    { id: 'a', email: 'alpha@outlook.com', status: 'pending' },
  ], {
    id: 'a',
    email: 'alpha@outlook.com',
    status: 'registered',
  });

  assert.equal(nextAccounts.length, 1);
  assert.equal(nextAccounts[0].status, 'registered');
  assert.equal(shouldClearCurrentE5Selection(nextAccounts[0]), true);
  assert.equal(shouldClearCurrentE5Selection({ status: 'pending' }), false);
});
