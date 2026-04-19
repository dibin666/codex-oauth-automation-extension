(function attachSidepanelE5Manager(globalScope) {
  function createE5Manager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
      e5Utils = {},
    } = context;

    const expandedStorageKey = constants.expandedStorageKey || 'multipage-e5-list-expanded';
    const displayTimeZone = constants.displayTimeZone || 'Asia/Shanghai';
    const copyIcon = constants.copyIcon || '';

    let listExpanded = false;

    function getE5AccountsByStatus(mode = 'all') {
      const accounts = helpers.getE5Accounts();
      if (typeof e5Utils.filterE5AccountsByStatus === 'function') {
        return e5Utils.filterE5AccountsByStatus(accounts, mode);
      }
      if (mode === 'registered') {
        return accounts.filter((account) => account?.status === 'registered');
      }
      if (mode === 'pending') {
        return accounts.filter((account) => account?.status !== 'registered');
      }
      return accounts.slice();
    }

    function getBulkActionText(mode, count) {
      if (typeof e5Utils.getE5BulkActionLabel === 'function') {
        return e5Utils.getE5BulkActionLabel(mode, count);
      }
      const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
      const prefix = mode === 'registered' ? '清空已注册' : '全部删除';
      const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
      return `${prefix}${suffix}`;
    }

    function getListToggleText(expanded, count) {
      if (typeof e5Utils.getE5ListToggleLabel === 'function') {
        return e5Utils.getE5ListToggleLabel(expanded, count);
      }
      const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
      const suffix = normalizedCount > 0 ? `（${normalizedCount}）` : '';
      return `${expanded ? '收起列表' : '展开列表'}${suffix}`;
    }

    function shouldClearCurrentSelectionLocally(account) {
      if (typeof e5Utils.shouldClearCurrentE5Selection === 'function') {
        return e5Utils.shouldClearCurrentE5Selection(account);
      }
      return Boolean(account) && account.status === 'registered';
    }

    function upsertE5AccountListLocally(accounts, nextAccount) {
      if (typeof e5Utils.upsertE5AccountInList === 'function') {
        return e5Utils.upsertE5AccountInList(accounts, nextAccount);
      }
      const list = Array.isArray(accounts) ? accounts.slice() : [];
      const existingIndex = list.findIndex((account) => account?.id === nextAccount?.id || account?.email === nextAccount?.email);
      if (existingIndex === -1) {
        list.push(nextAccount);
        return list;
      }
      list[existingIndex] = nextAccount;
      return list;
    }

    function updateE5ListViewport() {
      const count = helpers.getE5Accounts().length;
      const registeredCount = getE5AccountsByStatus('registered').length;
      if (dom.btnClearRegisteredE5Accounts) {
        dom.btnClearRegisteredE5Accounts.textContent = getBulkActionText('registered', registeredCount);
        dom.btnClearRegisteredE5Accounts.disabled = registeredCount === 0;
      }
      if (dom.btnDeleteAllE5Accounts) {
        dom.btnDeleteAllE5Accounts.textContent = getBulkActionText('all', count);
        dom.btnDeleteAllE5Accounts.disabled = count === 0;
      }
      if (dom.btnToggleE5List) {
        dom.btnToggleE5List.textContent = getListToggleText(listExpanded, count);
        dom.btnToggleE5List.setAttribute('aria-expanded', String(listExpanded));
        dom.btnToggleE5List.disabled = count === 0;
      }
      if (dom.e5ListShell) {
        dom.e5ListShell.classList.toggle('is-expanded', listExpanded);
        dom.e5ListShell.classList.toggle('is-collapsed', !listExpanded);
      }
    }

    function setE5ListExpanded(expanded, options = {}) {
      const { persist = true } = options;
      listExpanded = Boolean(expanded);
      updateE5ListViewport();
      if (persist) {
        localStorage.setItem(expandedStorageKey, listExpanded ? '1' : '0');
      }
    }

    function initE5ListExpandedState() {
      const saved = localStorage.getItem(expandedStorageKey);
      setE5ListExpanded(saved === '1', { persist: false });
    }

    function formatDateTime(timestamp) {
      const value = Number(timestamp);
      if (!Number.isFinite(value) || value <= 0) {
        return '未注册';
      }
      return new Date(value).toLocaleString('zh-CN', {
        hour12: false,
        timeZone: displayTimeZone,
      });
    }

    function getStatusLabel(account) {
      return account?.status === 'registered' ? '已注册' : '待注册';
    }

    function getStatusClass(account) {
      return account?.status === 'registered' ? 'status-used' : 'status-pending';
    }

    function refreshSelectionUI() {
      renderE5Accounts();
      if (dom.selectMailProvider.value === 'e5-pool') {
        dom.inputEmail.value = helpers.getCurrentE5Email();
      }
    }

    function applyE5AccountMutation(account, options = {}) {
      if (!account?.id) return;
      const { preserveCurrentSelection = false } = options;
      const latestState = state.getLatestState();
      const nextState = {
        e5Accounts: upsertE5AccountListLocally(helpers.getE5Accounts(), account),
      };

      if (!preserveCurrentSelection
        && latestState?.currentE5AccountId === account.id
        && shouldClearCurrentSelectionLocally(account)) {
        nextState.currentE5AccountId = null;
        if (dom.selectMailProvider.value === 'e5-pool') {
          nextState.email = null;
        }
      }

      state.syncLatestState(nextState);
      refreshSelectionUI();
    }

    function clearSingleAddForm() {
      if (dom.inputE5Email) {
        dom.inputE5Email.value = '';
      }
    }

    function renderE5Accounts() {
      if (!dom.e5AccountsList) return;
      const latestState = state.getLatestState();
      const accounts = helpers.getE5Accounts();
      const currentId = latestState?.currentE5AccountId || '';

      if (!accounts.length) {
        dom.e5AccountsList.innerHTML = '<div class="hotmail-empty">还没有 E5 账号，先在下方导入一条邮箱再使用。</div>';
        updateE5ListViewport();
        return;
      }

      dom.e5AccountsList.innerHTML = accounts.map((account) => `
        <div class="hotmail-account-item${account.id === currentId ? ' is-current' : ''}">
          <div class="hotmail-account-top">
            <div class="hotmail-account-title-row">
              <div class="hotmail-account-email">${helpers.escapeHtml(account.email || '(未命名账号)')}</div>
              <button
                class="hotmail-copy-btn"
                type="button"
                data-account-action="copy-email"
                data-account-id="${helpers.escapeHtml(account.id)}"
                title="复制邮箱"
                aria-label="复制邮箱 ${helpers.escapeHtml(account.email || '')}"
              >${copyIcon}</button>
            </div>
            <span class="hotmail-status-chip ${helpers.escapeHtml(getStatusClass(account))}">${helpers.escapeHtml(getStatusLabel(account))}</span>
          </div>
          <div class="hotmail-account-meta">
            <span>邮箱服务：E5 账号池</span>
            <span>上次注册：${helpers.escapeHtml(formatDateTime(account.lastRegisteredAt))}</span>
            ${account.lastError ? `<span>最近错误：${helpers.escapeHtml(account.lastError)}</span>` : ''}
          </div>
          <div class="hotmail-account-actions">
            <button class="btn btn-outline btn-sm" type="button" data-account-action="select" data-account-id="${helpers.escapeHtml(account.id)}">使用此账号</button>
            <button class="btn btn-outline btn-sm" type="button" data-account-action="toggle-registered" data-account-id="${helpers.escapeHtml(account.id)}">${account.status === 'registered' ? '标记待注册' : '标记已注册'}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-account-action="delete" data-account-id="${helpers.escapeHtml(account.id)}">删除</button>
          </div>
        </div>
      `).join('');
      updateE5ListViewport();
    }

    async function deleteE5AccountsByMode(mode) {
      const isRegisteredMode = mode === 'registered';
      const targetAccounts = getE5AccountsByStatus(isRegisteredMode ? 'registered' : 'all');
      if (!targetAccounts.length) {
        helpers.showToast(isRegisteredMode ? '没有已注册账号可清空。' : '没有可删除的 E5 账号。', 'warn');
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: isRegisteredMode ? '清空已注册账号' : '全部删除账号',
        message: isRegisteredMode
          ? `确认删除当前 ${targetAccounts.length} 个已注册 E5 账号吗？`
          : `确认删除全部 ${targetAccounts.length} 个 E5 账号吗？`,
        confirmLabel: isRegisteredMode ? '确认清空已注册' : '确认全部删除',
        confirmVariant: isRegisteredMode ? 'btn-outline' : 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'DELETE_E5_ACCOUNTS',
        source: 'sidepanel',
        payload: { mode: isRegisteredMode ? 'registered' : 'all' },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      const latestState = state.getLatestState();
      const targetIds = new Set(targetAccounts.map((account) => account.id));
      const nextAccounts = isRegisteredMode
        ? helpers.getE5Accounts().filter((account) => !targetIds.has(account.id))
        : [];
      const nextState = { e5Accounts: nextAccounts };
      if (targetIds.has(latestState?.currentE5AccountId)) {
        nextState.currentE5AccountId = null;
        if (dom.selectMailProvider.value === 'e5-pool') {
          nextState.email = null;
        }
      }
      state.syncLatestState(nextState);
      refreshSelectionUI();
      helpers.showToast(isRegisteredMode ? `已清空 ${targetAccounts.length} 个已注册账号` : '已删除全部 E5 账号', 'success', 2200);
    }

    function getFallbackImportParser() {
      return (text = '') => String(text || '')
        .split(/\r?\n/)
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .map((email) => ({ email }));
    }

    async function handleE5ListAction(event) {
      const button = event.target.closest('[data-account-action]');
      if (!button) return;
      const action = button.dataset.accountAction;
      const accountId = button.dataset.accountId;
      const account = helpers.getE5Accounts().find((item) => item.id === accountId);
      if (!account) return;

      if (action === 'copy-email') {
        await helpers.copyTextToClipboard(account.email || '');
        helpers.showToast(`已复制 ${account.email}`, 'success', 1500);
        return;
      }

      if (action === 'select') {
        const response = await runtime.sendMessage({
          type: 'SELECT_E5_ACCOUNT',
          source: 'sidepanel',
          payload: { accountId },
        });
        if (response?.error) throw new Error(response.error);
        state.syncLatestState({ currentE5AccountId: accountId, email: response?.account?.email || account.email });
        refreshSelectionUI();
        helpers.showToast(`已切换到 E5 账号 ${account.email}`, 'success', 1800);
        return;
      }

      if (action === 'toggle-registered') {
        const nextStatus = account.status === 'registered' ? 'pending' : 'registered';
        const response = await runtime.sendMessage({
          type: 'PATCH_E5_ACCOUNT',
          source: 'sidepanel',
          payload: {
            accountId,
            updates: {
              status: nextStatus,
              lastRegisteredAt: nextStatus === 'registered' ? Date.now() : 0,
              lastError: '',
            },
          },
        });
        if (response?.error) throw new Error(response.error);
        applyE5AccountMutation(response.account);
        helpers.showToast(
          `${account.email} 已${nextStatus === 'registered' ? '标记为已注册' : '恢复为待注册'}`,
          'success',
          2000
        );
        return;
      }

      if (action === 'delete') {
        const confirmed = await helpers.openConfirmModal({
          title: '删除 E5 账号',
          message: `确认删除 ${account.email} 吗？此操作不可撤销。`,
          confirmLabel: '确认删除',
          confirmVariant: 'btn-danger',
        });
        if (!confirmed) {
          return;
        }

        const response = await runtime.sendMessage({
          type: 'DELETE_E5_ACCOUNT',
          source: 'sidepanel',
          payload: { accountId },
        });
        if (response?.error) throw new Error(response.error);

        const nextAccounts = helpers.getE5Accounts().filter((item) => item.id !== accountId);
        const nextState = { e5Accounts: nextAccounts };
        if (state.getLatestState()?.currentE5AccountId === accountId) {
          nextState.currentE5AccountId = null;
          if (dom.selectMailProvider.value === 'e5-pool') {
            nextState.email = null;
          }
        }
        state.syncLatestState(nextState);
        refreshSelectionUI();
        helpers.showToast(`已删除 ${account.email}`, 'success', 1800);
      }
    }

    async function handleAddSingleAccount() {
      const email = String(dom.inputE5Email?.value || '').trim();
      if (!email) {
        helpers.showToast('请先填写一个 E5 邮箱地址。', 'warn');
        dom.inputE5Email?.focus?.();
        return;
      }

      const response = await runtime.sendMessage({
        type: 'UPSERT_E5_ACCOUNT',
        source: 'sidepanel',
        payload: { email },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      applyE5AccountMutation(response.account, { preserveCurrentSelection: true });
      clearSingleAddForm();
      helpers.showToast(`已添加 E5 账号 ${response.account.email}`, 'success', 1800);
    }

    async function handleImportAccounts() {
      const importText = String(dom.inputE5Import?.value || '').trim();
      if (!importText) {
        helpers.showToast('请先粘贴要导入的 E5 邮箱账号。', 'warn');
        dom.inputE5Import?.focus?.();
        return;
      }

      const parser = typeof e5Utils.parseE5ImportText === 'function'
        ? e5Utils.parseE5ImportText
        : getFallbackImportParser();
      const accounts = parser(importText);
      if (!accounts.length) {
        helpers.showToast('没有识别到可导入的邮箱地址。', 'warn');
        return;
      }

      const response = await runtime.sendMessage({
        type: 'IMPORT_E5_ACCOUNTS',
        source: 'sidepanel',
        payload: { accounts },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      state.syncLatestState({ e5Accounts: Array.isArray(response.accounts) ? response.accounts : helpers.getE5Accounts() });
      refreshSelectionUI();
      dom.inputE5Import.value = '';
      helpers.showToast(`已导入 ${response.importedCount || accounts.length} 个 E5 账号`, 'success', 2200);
    }

    function bindE5Events() {
      dom.btnToggleE5List?.addEventListener('click', () => {
        setE5ListExpanded(!listExpanded);
      });
      dom.btnClearRegisteredE5Accounts?.addEventListener('click', async () => {
        await deleteE5AccountsByMode('registered');
      });
      dom.btnDeleteAllE5Accounts?.addEventListener('click', async () => {
        await deleteE5AccountsByMode('all');
      });
      dom.btnAddE5Account?.addEventListener('click', async () => {
        await handleAddSingleAccount();
      });
      dom.btnImportE5Accounts?.addEventListener('click', async () => {
        await handleImportAccounts();
      });
      dom.e5AccountsList?.addEventListener('click', async (event) => {
        await handleE5ListAction(event);
      });
    }

    return {
      bindE5Events,
      initE5ListExpandedState,
      renderE5Accounts,
    };
  }

  globalScope.SidepanelE5Manager = {
    createE5Manager,
  };
})(window);
