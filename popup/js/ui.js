/**
 * UI 管理模块
 */

/**
 * 更新界面显示
 */
function updateUI() {
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name] && currentData[name] !== undefined) {
            if (name === 'country' || name === 'gender') {
                const selectEl = elements.fields[name];
                const options = Array.from(selectEl.options).map(opt => opt.value);
                if (options.includes(currentData[name])) {
                    selectEl.value = currentData[name];
                } else if (name === 'country') {
                    selectEl.selectedIndex = 0;
                    currentData[name] = selectEl.value;
                    ipData.country = selectEl.value;
                }
            } else {
                elements.fields[name].value = currentData[name];
            }
        }
    });
}

/**
 * 更新设置 UI
 */
function updateSettingsUI() {
    if (elements.enableAI) elements.enableAI.checked = userSettings.enableAI;
    if (elements.openaiBaseUrl) elements.openaiBaseUrl.value = userSettings.openaiBaseUrl;
    if (elements.openaiKey) elements.openaiKey.value = userSettings.openaiKey;
    if (elements.openaiModel) elements.openaiModel.value = userSettings.openaiModel;
    if (elements.aiPersona) elements.aiPersona.value = userSettings.aiPersona;
    if (elements.passwordLength) elements.passwordLength.value = userSettings.passwordLength;
    if (elements.pwdUppercase) elements.pwdUppercase.checked = userSettings.pwdUppercase;
    if (elements.pwdLowercase) elements.pwdLowercase.checked = userSettings.pwdLowercase;
    if (elements.pwdNumbers) elements.pwdNumbers.checked = userSettings.pwdNumbers;
    if (elements.pwdSymbols) elements.pwdSymbols.checked = userSettings.pwdSymbols;
    if (elements.minAge) elements.minAge.value = userSettings.minAge;
    if (elements.maxAge) elements.maxAge.value = userSettings.maxAge;
    if (elements.autoClearData) elements.autoClearData.checked = userSettings.autoClearData;
    if (elements.geoapifyKey) elements.geoapifyKey.value = userSettings.geoapifyKey || '';

    // 显示/隐藏 AI 开关
    if (elements.aiToggleWrapper) {
        if (userSettings.enableAI && userSettings.openaiKey) {
            elements.aiToggleWrapper.style.display = 'flex';
        } else {
            elements.aiToggleWrapper.style.display = 'none';
        }
    }
}

/**
 * 渲染历史记录列表
 */
function renderHistoryList(history) {
    if (!elements.historyList) return;

    if (!history || history.length === 0) {
        elements.historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
        return;
    }

    elements.historyList.innerHTML = history.map(item => {
        const data = item.data;
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || '未知';
        const email = data.email || '无邮箱';
        const time = formatHistoryTime(item.timestamp);

        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-info" title="点击加载此记录">
                    <div class="history-item-name">${name}</div>
                    <div class="history-item-email">${email}</div>
                </div>
                <div class="history-item-time">${time}</div>
                <button class="history-item-delete" data-id="${item.id}" title="删除">🗑️</button>
            </div>
        `;
    }).join('');

    // 绑定点击事件
    elements.historyList.querySelectorAll('.history-item-info').forEach(el => {
        el.addEventListener('click', (e) => {
            const item = e.currentTarget.closest('.history-item');
            const id = parseInt(item.dataset.id);
            loadHistoryItem(id);
        });
    });

    // 绑定删除事件
    elements.historyList.querySelectorAll('.history-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            deleteHistoryItem(id);
        });
    });
}

/**
 * 渲染收件箱
 */
function renderInbox(messages) {
    if (!elements.inboxList) return;

    if (!messages || messages.length === 0) {
        elements.inboxList.innerHTML = '<div class="inbox-empty">暂无邮件</div>';
        return;
    }

    elements.inboxList.innerHTML = messages.map(msg => {
        const subject = escapeHtml(msg.subject) || '(无主题)';
        const from = escapeHtml(msg.from?.address || '');
        const intro = escapeHtml(msg.intro) || '';
        // 尝试提取验证码（只匹配纯数字，确保安全）
        const codeMatch = (msg.subject || '').match(/\b\d{4,6}\b/) || (msg.intro || '').match(/\b\d{4,6}\b/);
        const codeHtml = codeMatch ? `<span class="verification-code" title="点击复制" data-code="${escapeHtml(codeMatch[0])}">${escapeHtml(codeMatch[0])}</span>` : '';

        return `
            <div class="email-item">
                <div class="email-header">
                    <span class="email-from">${from}</span>
                    ${codeHtml}
                </div>
                <div class="email-subject">${subject}</div>
                <div class="email-intro">${intro}</div>
            </div>
        `;
    }).join('');

    // 使用事件委托绑定验证码点击事件
    elements.inboxList.querySelectorAll('.verification-code').forEach(el => {
        el.addEventListener('click', async (e) => {
            const code = e.target.dataset.code;
            if (code) {
                try {
                    await navigator.clipboard.writeText(code);
                    showToast('验证码已复制');
                } catch (err) {
                    log.error('复制失败:', err);
                }
            }
        });
    });
}

/**
 * 渲染存档列表
 */
async function renderArchiveList(archives) {
    if (!elements.archiveList) return;

    if (!archives || archives.length === 0) {
        elements.archiveList.innerHTML = '<div class="archive-empty">暂无存档</div>';
        return;
    }

    elements.archiveList.innerHTML = archives.map((archive, index) => `
        <div class="archive-item" data-index="${index}">
            <span class="archive-item-name">${archive.name}</span>
            <div class="archive-item-actions">
                <button class="load-btn" title="加载" data-action="load" data-index="${index}">📂</button>
                <button class="delete-btn" title="删除" data-action="delete" data-index="${index}">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============ 主题功能 ============

/**
 * 应用主题
 */
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (elements.themeToggle) elements.themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        if (elements.themeToggle) elements.themeToggle.textContent = '🌙';
    }
}

/**
 * 切换主题
 */
async function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    await saveTheme(newTheme);
}

/**
 * 初始化主题
 */
async function initTheme() {
    try {
        const theme = await loadTheme();
        applyTheme(theme);
    } catch (e) {
        log.info('初始化主题失败:', e);
    }
}

