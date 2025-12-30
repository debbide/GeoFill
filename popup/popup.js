/**
 * Popup 主逻辑 - 初始化与协调
 * 全局变量 (currentData, ipData, lockedFields, userSettings, elements)
 * 已在 constants.js 中声明
 */

/**
 * 初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
    log.info(' 开始初始化...');

    // 缓存 DOM 元素
    elements.ipInfo = document.getElementById('ipInfo');
    elements.ipRefresh = document.getElementById('ipRefresh');
    elements.regenerateAll = document.getElementById('regenerateAll');
    elements.fillForm = document.getElementById('fillForm');
    elements.useAIToggle = document.getElementById('useAIToggle');
    elements.aiToggleWrapper = document.getElementById('aiToggleWrapper');
    elements.themeToggle = document.getElementById('themeToggle');
    elements.toast = document.getElementById('toast');

    FIELD_NAMES.forEach(name => {
        elements.fields[name] = document.getElementById(name);
    });

    elements.emailDomainType = document.getElementById('emailDomainType');
    elements.customDomain = document.getElementById('customDomain');

    elements.copyAll = document.getElementById('copyAll');
    elements.openSettings = document.getElementById('openSettings');
    elements.closeSettings = document.getElementById('closeSettings');
    elements.settingsModal = document.getElementById('settingsModal');
    elements.enableAI = document.getElementById('enableAI');
    elements.openaiBaseUrl = document.getElementById('openaiBaseUrl');
    elements.openaiKey = document.getElementById('openaiKey');
    elements.openaiModel = document.getElementById('openaiModel');
    elements.aiPersona = document.getElementById('aiPersona');
    elements.passwordLength = document.getElementById('passwordLength');
    elements.testAI = document.getElementById('testAI');
    elements.pwdUppercase = document.getElementById('pwdUppercase');
    elements.pwdLowercase = document.getElementById('pwdLowercase');
    elements.pwdNumbers = document.getElementById('pwdNumbers');
    elements.pwdSymbols = document.getElementById('pwdSymbols');
    elements.minAge = document.getElementById('minAge');
    elements.maxAge = document.getElementById('maxAge');
    elements.autoClearData = document.getElementById('autoClearData');
    elements.archiveName = document.getElementById('archiveName');
    elements.saveArchive = document.getElementById('saveArchive');
    elements.archiveList = document.getElementById('archiveList');
    elements.inboxGroup = document.getElementById('inboxGroup');
    elements.refreshInbox = document.getElementById('refreshInbox');
    elements.inboxList = document.getElementById('inboxList');
    elements.openHistory = document.getElementById('openHistory');
    elements.closeHistory = document.getElementById('closeHistory');
    elements.historyModal = document.getElementById('historyModal');
    elements.historyList = document.getElementById('historyList');
    elements.clearHistory = document.getElementById('clearHistory');
    elements.geoapifyKey = document.getElementById('geoapifyKey');

    // 加载配置
    try { await loadTheme(); } catch (e) { log.info('loadTheme error:', e); }
    try { await loadSettings(); } catch (e) { log.info('loadSettings error:', e); }
    try { await loadLockedFields(); } catch (e) { log.info('loadLockedFields error:', e); }

    // 加载 AI 开关状态
    try {
        const result = await chrome.storage.local.get('geoFillUseAI');
        if (elements.useAIToggle && result.geoFillUseAI !== undefined) {
            elements.useAIToggle.checked = result.geoFillUseAI;
        }
    } catch (e) { log.info('loadAIToggle error:', e); }

    // 绑定事件
    bindEvents();

    // 加载数据
    let cachedData = null;
    try {
        cachedData = await loadDataFromStorage();
    } catch (e) {
        log.info('loadDataFromStorage error:', e);
    }

    if (cachedData && cachedData.currentData && Object.keys(cachedData.currentData).length > 0) {
        log.info(' 使用缓存数据');
        currentData = cachedData.currentData;
        ipData = cachedData.ipData || {};

        if (cachedData.emailDomain && elements.emailDomainType) {
            elements.emailDomainType.value = cachedData.emailDomain;
            if (cachedData.emailDomain === 'custom' && cachedData.customDomain && elements.customDomain) {
                elements.customDomain.value = cachedData.customDomain;
                elements.customDomain.style.display = 'block';
            }

            // 如果是临时邮箱，尝试恢复会话
            if (cachedData.emailDomain === 'temp' && window.mailTM && currentData.email && currentData.password) {
                if (elements.inboxGroup) elements.inboxGroup.style.display = 'block';
                window.mailTM.login(currentData.email, currentData.password).then(() => {
                    refreshInbox();
                }).catch(e => log.info('Silent login failed:', e));
            }
        }

        if (window.generators) {
            window.generators.setCustomEmailDomain(elements.emailDomainType?.value || 'gmail.com');
        }

        if (elements.ipInfo) {
            if (ipData.city && ipData.country) {
                if (ipData.city === ipData.country || ipData.city === 'Singapore' || ipData.city === 'Hong Kong') {
                    elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.country}</span>`;
                } else {
                    elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.city}, ${ipData.country}</span>`;
                }
            } else if (ipData.country) {
                elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.country}</span>`;
            } else {
                elements.ipInfo.innerHTML = `<span class="location">📍 已缓存数据</span>`;
            }
        }

        updateUI();
    } else {
        log.info(' 无缓存，获取 IP 信息...');
        if (window.generators) {
            window.generators.setCustomEmailDomain(elements.emailDomainType?.value || 'gmail.com');
        }
        try {
            await fetchIPInfo();
        } catch (e) {
            log.error(' fetchIPInfo 失败:', e);
            // 使用默认值
            if (elements.ipInfo) {
                elements.ipInfo.innerHTML = `<span class="location">📍 United States (默认)</span>`;
            }
            if (window.generators) {
                ipData = { country: 'United States', city: 'New York', region: '' };
                currentData = window.generators.generateAllInfoWithSettings(ipData, userSettings);
                updateUI();
                saveDataToStorage();
            }
        }
    }

    log.info(' 初始化完成');
});

/**
 * 从输入框更新 currentData
 */
function updateCurrentDataFromInputs() {
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name]) {
            currentData[name] = elements.fields[name].value;
        }
    });
}

// 暴露函数给全局 (如果需要)
window.loadArchive = loadArchive;
window.deleteArchive = deleteArchive;
