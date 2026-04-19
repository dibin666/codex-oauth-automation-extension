(function e5UtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.E5Utils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createE5Utils() {
  const E5_INBOX_MODE_OUTLOOK = 'outlook';
  const E5_INBOX_MODE_GMAIL = 'gmail';

  function normalizeTimestamp(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  function generateAccountId() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `e5-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeE5InboxMode(value = '') {
    return String(value || '').trim().toLowerCase() === E5_INBOX_MODE_GMAIL
      ? E5_INBOX_MODE_GMAIL
      : E5_INBOX_MODE_OUTLOOK;
  }

  function normalizeE5Account(account = {}) {
    const email = String(account.email || '').trim().toLowerCase();
    const status = String(account.status || '').trim().toLowerCase() === 'registered'
      || account.registered === true
      ? 'registered'
      : 'pending';

    return {
      id: String(account.id || generateAccountId()),
      email,
      status,
      lastRegisteredAt: normalizeTimestamp(account.lastRegisteredAt),
      lastSelectedAt: normalizeTimestamp(account.lastSelectedAt),
      lastError: String(account.lastError || '').trim(),
    };
  }

  function normalizeE5Accounts(accounts) {
    if (!Array.isArray(accounts)) return [];

    const deduped = new Map();
    for (const account of accounts) {
      const normalized = normalizeE5Account(account);
      if (!normalized.email) continue;
      deduped.set(normalized.email, normalized);
    }
    return [...deduped.values()];
  }

  function filterE5AccountsByStatus(accounts, mode = 'all') {
    const list = Array.isArray(accounts) ? accounts.slice() : [];
    if (mode === 'registered') {
      return list.filter((account) => account?.status === 'registered');
    }
    if (mode === 'pending') {
      return list.filter((account) => account?.status !== 'registered');
    }
    return list;
  }

  function getE5BulkActionLabel(mode = 'all', count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const prefix = mode === 'registered' ? '清空已注册' : '全部删除';
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${prefix}${suffix}`;
  }

  function getE5ListToggleLabel(expanded, count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
    return `${expanded ? '收起列表' : '展开列表'}${suffix}`;
  }

  function shouldClearCurrentE5Selection(account) {
    return Boolean(account) && String(account.status || '').trim().toLowerCase() === 'registered';
  }

  function upsertE5AccountInList(accounts, nextAccount) {
    const list = normalizeE5Accounts(accounts);
    const normalizedNext = normalizeE5Account(nextAccount);
    if (!normalizedNext.email) return list;

    const existingIndex = list.findIndex((account) => account.id === normalizedNext.id || account.email === normalizedNext.email);
    if (existingIndex === -1) {
      list.push(normalizedNext);
      return list;
    }

    list[existingIndex] = {
      ...list[existingIndex],
      ...normalizedNext,
      id: list[existingIndex].id || normalizedNext.id,
    };
    return list;
  }

  function pickE5AccountForRun(accounts, options = {}) {
    const candidates = filterE5AccountsByStatus(accounts, 'pending');
    if (!candidates.length) return null;

    const excludeIds = new Set((options.excludeIds || []).filter(Boolean));
    const filtered = candidates.filter((account) => !excludeIds.has(account.id));
    const pool = filtered.length ? filtered : candidates;

    return pool
      .slice()
      .sort((left, right) => {
        const leftSelectedAt = normalizeTimestamp(left.lastSelectedAt);
        const rightSelectedAt = normalizeTimestamp(right.lastSelectedAt);
        if (leftSelectedAt !== rightSelectedAt) {
          return leftSelectedAt - rightSelectedAt;
        }
        return String(left.email || '').localeCompare(String(right.email || ''));
      })[0] || null;
  }

  function parseE5ImportText(text = '') {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(emailPattern);
        if (!match) return null;
        return normalizeE5Account({
          email: match[0],
          status: /已注册|registered/i.test(line) ? 'registered' : 'pending',
        });
      })
      .filter(Boolean);
  }

  return {
    E5_INBOX_MODE_GMAIL,
    E5_INBOX_MODE_OUTLOOK,
    filterE5AccountsByStatus,
    getE5BulkActionLabel,
    getE5ListToggleLabel,
    normalizeE5Account,
    normalizeE5Accounts,
    normalizeE5InboxMode,
    parseE5ImportText,
    pickE5AccountForRun,
    shouldClearCurrentE5Selection,
    upsertE5AccountInList,
  };
});
