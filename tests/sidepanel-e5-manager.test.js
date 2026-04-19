const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('sidepanel loads e5 manager before sidepanel bootstrap', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const e5ManagerIndex = html.indexOf('<script src="e5-manager.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');

  assert.notEqual(e5ManagerIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(e5ManagerIndex < sidepanelIndex);
});

test('e5 manager exposes a factory and renders empty state', () => {
  const source = fs.readFileSync('sidepanel/e5-manager.js', 'utf8');
  const windowObject = {};
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelE5Manager;`)(
    windowObject,
    localStorageMock
  );

  assert.equal(typeof api?.createE5Manager, 'function');

  const e5AccountsList = { innerHTML: '' };
  const toggleButton = {
    textContent: '',
    disabled: false,
    setAttribute() {},
  };
  const noopClassList = { toggle() {} };

  const manager = api.createE5Manager({
    state: {
      getLatestState: () => ({ currentE5AccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnAddE5Account: {},
      btnClearRegisteredE5Accounts: { textContent: '', disabled: false },
      btnDeleteAllE5Accounts: { textContent: '', disabled: false },
      btnImportE5Accounts: {},
      btnToggleE5List: toggleButton,
      e5AccountsList,
      e5ListShell: { classList: noopClassList },
      inputE5Email: { value: '' },
      inputE5Import: { value: '' },
      inputEmail: { value: '' },
      selectMailProvider: { value: 'e5-pool' },
    },
    helpers: {
      copyTextToClipboard: async () => {},
      escapeHtml: (value) => String(value || ''),
      getCurrentE5Email: () => '',
      getE5Accounts: () => [],
      openConfirmModal: async () => true,
      showToast() {},
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-e5-list-expanded',
    },
    e5Utils: {},
  });

  assert.equal(typeof manager.renderE5Accounts, 'function');
  assert.equal(typeof manager.bindE5Events, 'function');
  assert.equal(typeof manager.initE5ListExpandedState, 'function');

  manager.renderE5Accounts();
  assert.match(e5AccountsList.innerHTML, /还没有 E5 账号/);
});
