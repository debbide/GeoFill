/**
 * UI 管理模块
 */

function sourceLabel(source) {
    switch (source) {
        case 'selfhosted':
            return '自托管';
        case 'local_verified':
            return '本地真实池';
        case 'geoapify':
            return 'Geoapify';
        case 'openstreetmap':
            return 'OSM';
        case 'synthetic':
            return '本地合成';
        default:
            return '未校验';
    }
}

function confidenceLabel(confidence) {
    switch (confidence) {
        case 'high':
            return '高置信';
        case 'medium':
            return '中置信';
        case 'low':
            return '基础';
        default:
            return '未校验';
    }
}

function formatAddressUpdateTime(isoString) {
    if (!isoString) return '未记录';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '未记录';
    return date.toLocaleString();
}

function getCurrentCountryPoolText(country) {
    const stats = window.generators?.getAddressPoolStats ? window.generators.getAddressPoolStats(country) : null;
    if (!stats) return '当前国家未记录';
    return `${country}: ${stats.entries || 0}条/${stats.cities || 0}城`;
}

function showAddressQualityDetail() {
    const sourceText = sourceLabel(currentData.addressSource || '');
    const qualityText = confidenceLabel(currentData.addressConfidence || '');
    const countryText = currentData.country || 'Unknown';
    const updatedAt = formatAddressUpdateTime(currentData.addressLastUpdatedAt || '');
    const poolMeta = window.generators?.getAddressPoolMeta ? window.generators.getAddressPoolMeta() : {};
    const poolCount = poolMeta.totalEntries ? `${poolMeta.countryCount || '-'}国/${poolMeta.totalEntries}条` : '未记录';
    const countryPoolText = getCurrentCountryPoolText(countryText);
    showToast(`来源:${sourceText} | ${countryPoolText}`);

    if (elements.addressQualityBadge) {
        elements.addressQualityBadge.title = `来源: ${sourceText}\n置信度: ${qualityText}\n国家: ${countryText}\n当前国家地址池: ${countryPoolText}\n总地址池: ${poolCount}\n更新时间: ${updatedAt}`;
    }
}

function updateAddressQualityBadge() {
    const badge = elements.addressQualityBadge;
    if (!badge) return;

    const source = currentData.addressSource || '';
    const confidence = currentData.addressConfidence || '';
    const country = currentData.country || 'Unknown';
    const updatedAt = formatAddressUpdateTime(currentData.addressLastUpdatedAt || '');
    const sourceText = sourceLabel(source);
    const qualityText = confidenceLabel(confidence);

    badge.classList.remove('is-high', 'is-medium', 'is-low');
    if (confidence === 'high') badge.classList.add('is-high');
    if (confidence === 'medium') badge.classList.add('is-medium');
    if (confidence === 'low') badge.classList.add('is-low');

    if (!source && !confidence) {
        badge.textContent = '未校验';
        badge.title = `地址来源与置信度\n国家: ${country}\n当前国家地址池: ${getCurrentCountryPoolText(country)}\n更新时间: ${updatedAt}`;
        return;
    }

    badge.textContent = `${sourceText}·${qualityText}`;
    badge.title = `来源: ${sourceText}\n置信度: ${qualityText}\n国家: ${country}\n当前国家地址池: ${getCurrentCountryPoolText(country)}\n更新时间: ${updatedAt}`;
}

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
    updateAddressQualityBadge();
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
    if (elements.pwdNoAmbiguous) elements.pwdNoAmbiguous.checked = userSettings.pwdNoAmbiguous === true;
    if (elements.passwordMode) elements.passwordMode.value = userSettings.passwordMode || 'custom';
    if (elements.passwordLengthRange) elements.passwordLengthRange.value = userSettings.passwordLength;
    syncPasswordModeButtons();
    refreshPasswordPreview();
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

    elements.historyList.textContent = '';

    if (!history || history.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.textContent = '暂无历史记录';
        elements.historyList.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    history.forEach(item => {
        const data = item?.data || {};
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || '未知';
        const email = data.email || '无邮箱';
        const time = formatHistoryTime(item.timestamp);

        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';
        itemEl.dataset.id = String(item.id);

        const infoEl = document.createElement('div');
        infoEl.className = 'history-item-info';
        infoEl.title = '点击加载此记录';
        infoEl.addEventListener('click', (e) => {
            const itemNode = e.currentTarget.closest('.history-item');
            const id = Number.parseInt(itemNode?.dataset.id || '', 10);
            if (!Number.isNaN(id)) {
                loadHistoryItem(id);
            }
        });

        const nameEl = document.createElement('div');
        nameEl.className = 'history-item-name';
        nameEl.textContent = name;

        const emailEl = document.createElement('div');
        emailEl.className = 'history-item-email';
        emailEl.textContent = email;

        infoEl.appendChild(nameEl);
        infoEl.appendChild(emailEl);

        const timeEl = document.createElement('div');
        timeEl.className = 'history-item-time';
        timeEl.textContent = time;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'history-item-delete';
        deleteBtn.dataset.id = String(item.id);
        deleteBtn.title = '删除';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number.parseInt(e.currentTarget.dataset.id, 10);
            if (!Number.isNaN(id)) {
                deleteHistoryItem(id);
            }
        });

        itemEl.appendChild(infoEl);
        itemEl.appendChild(timeEl);
        itemEl.appendChild(deleteBtn);
        fragment.appendChild(itemEl);
    });

    elements.historyList.appendChild(fragment);
}

/**
 * 渲染存档列表
 */
async function renderArchiveList(archives) {
    if (!elements.archiveList) return;

    elements.archiveList.textContent = '';

    if (!archives || archives.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'archive-empty';
        empty.textContent = '暂无存档';
        elements.archiveList.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    archives.forEach((archive, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'archive-item';
        itemEl.dataset.index = String(index);

        const nameEl = document.createElement('span');
        nameEl.className = 'archive-item-name';
        nameEl.textContent = archive?.name || '';

        const actionsEl = document.createElement('div');
        actionsEl.className = 'archive-item-actions';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'load-btn';
        loadBtn.title = '加载';
        loadBtn.dataset.action = 'load';
        loadBtn.dataset.index = String(index);
        loadBtn.textContent = '📂';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = '删除';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.index = String(index);
        deleteBtn.textContent = '🗑️';

        actionsEl.appendChild(loadBtn);
        actionsEl.appendChild(deleteBtn);
        itemEl.appendChild(nameEl);
        itemEl.appendChild(actionsEl);
        fragment.appendChild(itemEl);
    });

    elements.archiveList.appendChild(fragment);
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

/**
 * 高亮当前密码模式按钮
 */
function syncPasswordModeButtons() {
    const mode = elements.passwordMode?.value || 'custom';
    document.querySelectorAll('#passwordModeGroup [data-pwd-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pwdMode === mode);
    });
}

/**
 * 刷新密码预览（示例密码 + 熵估算）
 */
function refreshPasswordPreview() {
    if (!elements.passwordPreview) return;
    const gen = window.generators;
    if (!gen || typeof gen.generatePasswordWithSettings !== 'function') return;
    const settings = {
        passwordMode: elements.passwordMode?.value || 'custom',
        passwordLength: parseInt(elements.passwordLength?.value, 10) || 12,
        pwdUppercase: elements.pwdUppercase?.checked ?? true,
        pwdLowercase: elements.pwdLowercase?.checked ?? true,
        pwdNumbers: elements.pwdNumbers?.checked ?? true,
        pwdSymbols: elements.pwdSymbols?.checked ?? true,
        pwdNoAmbiguous: elements.pwdNoAmbiguous?.checked ?? false
    };
    elements.passwordPreview.textContent = gen.generatePasswordWithSettings(settings);
    if (elements.passwordEntropy && typeof gen.resolvePasswordConfig === 'function') {
        const cfg = gen.resolvePasswordConfig(settings);
        const sets = { uppercase: 26, lowercase: 26, numbers: 10, symbols: 8 };
        if (cfg.noAmbiguous) { sets.uppercase -= 2; sets.lowercase -= 1; sets.numbers -= 2; }
        let pool = 0;
        if (cfg.uppercase) pool += sets.uppercase;
        if (cfg.lowercase) pool += sets.lowercase;
        if (cfg.numbers) pool += sets.numbers;
        if (cfg.symbols) pool += sets.symbols;
        const bits = pool > 0 ? Math.round(cfg.length * Math.log2(pool)) : 0;
        elements.passwordEntropy.textContent = `约 ${bits} 位熵`;
    }
}
