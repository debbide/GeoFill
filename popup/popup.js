/**
 * Popup main entry.
 */

document.addEventListener('DOMContentLoaded', async () => {
    log.info('Start initializing...');

    // Cache DOM elements
    elements.ipInfo = document.getElementById('ipInfo');
    elements.ipRefresh = document.getElementById('ipRefresh');
    elements.regenerateAll = document.getElementById('regenerateAll');
    elements.fillForm = document.getElementById('fillForm');
    elements.useAIToggle = document.getElementById('useAIToggle');
    elements.aiToggleWrapper = document.getElementById('aiToggleWrapper');
    elements.useAddressApiToggle = document.getElementById('useAddressApiToggle');
    elements.addressApiToggleWrapper = document.getElementById('addressApiToggleWrapper');
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
    elements.openHistory = document.getElementById('openHistory');
    elements.closeHistory = document.getElementById('closeHistory');
    elements.historyModal = document.getElementById('historyModal');
    elements.historyList = document.getElementById('historyList');
    elements.clearHistory = document.getElementById('clearHistory');
    elements.geoapifyKey = document.getElementById('geoapifyKey');
    elements.addressQualityBadge = document.getElementById('addressQualityBadge');
    elements.fillReport = document.getElementById('fillReport');
    elements.fillReportTitle = document.getElementById('fillReportTitle');
    elements.fillReportSummary = document.getElementById('fillReportSummary');
    elements.fillReportList = document.getElementById('fillReportList');
    elements.fillReportDismiss = document.getElementById('fillReportDismiss');

    // Load persisted settings/state
    try { await loadTheme(); } catch (e) { log.info('loadTheme error:', e); }
    try { await loadSettings(); } catch (e) { log.info('loadSettings error:', e); }
    try { await loadAddressApiToggle(); } catch (e) { log.info('loadAddressApiToggle error:', e); }
    try { await loadLockedFields(); } catch (e) { log.info('loadLockedFields error:', e); }

    // Load AI toggle state
    try {
        const result = await chrome.storage.local.get('geoFillUseAI');
        if (elements.useAIToggle && result.geoFillUseAI !== undefined) {
            elements.useAIToggle.checked = result.geoFillUseAI;
        }
    } catch (e) { log.info('loadAIToggle error:', e); }

    bindEvents();

    let cachedData = null;
    try {
        cachedData = await loadDataFromStorage();
    } catch (e) {
        log.info('loadDataFromStorage error:', e);
    }

    if (cachedData && cachedData.currentData && Object.keys(cachedData.currentData).length > 0) {
        log.info('Using cached data');
        currentData = cachedData.currentData;
        ipData = cachedData.ipData || {};

        if (cachedData.emailDomain && elements.emailDomainType) {
            // Migrate removed Mail.tm temp domain to a normal default.
            const emailDomain = cachedData.emailDomain === 'temp' ? 'gmail.com' : cachedData.emailDomain;
            const hasOption = Array.from(elements.emailDomainType.options)
                .some((option) => option.value === emailDomain);
            elements.emailDomainType.value = hasOption ? emailDomain : 'gmail.com';

            if (elements.emailDomainType.value === 'custom' && cachedData.customDomain && elements.customDomain) {
                elements.customDomain.value = cachedData.customDomain;
                elements.customDomain.style.display = 'block';
            }
        }

        if (window.generators) {
            window.generators.setCustomEmailDomain(elements.emailDomainType?.value || 'gmail.com');
        }

        if (elements.ipInfo) {
            if (ipData.city && ipData.country) {
                if (ipData.city === ipData.country || ipData.city === 'Singapore' || ipData.city === 'Hong Kong') {
                    setIpInfoText(ipData.country);
                } else {
                    setIpInfoText(`${ipData.city}, ${ipData.country}`);
                }
            } else if (ipData.country) {
                setIpInfoText(ipData.country);
            } else {
                setIpInfoText('已缓存数据');
            }
        }

        updateUI();
    } else {
        log.info('No cache, fetching IP info...');
        if (window.generators) {
            window.generators.setCustomEmailDomain(elements.emailDomainType?.value || 'gmail.com');
        }

        try {
            await fetchIPInfo();
        } catch (e) {
            log.error('fetchIPInfo failed:', e);
            if (elements.ipInfo) {
                setIpInfoText('United States (默认)');
            }
            if (window.generators) {
                ipData = { country: 'United States', city: 'New York', region: '' };
                currentData = window.generators.generateAllInfoWithSettings(ipData, userSettings);
                updateUI();
                saveDataToStorage();
            }
        }
    }

    log.info('Initialization done');
});

function updateCurrentDataFromInputs() {
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name]) {
            currentData[name] = elements.fields[name].value;
        }
    });
}

window.loadArchive = loadArchive;
window.deleteArchive = deleteArchive;
