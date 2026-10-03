/**
 * 存储相关功能
 */

/**
 * 保存锁定状态到 storage
 */
async function saveLockedFields() {
    try {
        await chrome.storage.local.set({
            [LOCKED_KEY]: Array.from(lockedFields)
        });
    } catch (e) {
        log.info('保存锁定状态失败:', e);
    }
}

/**
 * 从 storage 加载锁定状态
 */
async function loadLockedFields() {
    try {
        const result = await chrome.storage.local.get(LOCKED_KEY);
        if (result[LOCKED_KEY]) {
            lockedFields = new Set(result[LOCKED_KEY]);
            lockedFields.forEach(field => {
                const btn = document.querySelector(`.lock-btn[data-field="${field}"]`);
                if (btn) {
                    btn.classList.add('locked');
                    btn.textContent = '🔒';
                }
            });
        }
    } catch (e) {
        log.info('加载锁定状态失败:', e);
    }
}

/**
 * 保存数据到 chrome.storage
 */
async function saveDataToStorage() {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEY]: {
                version: CACHE_VERSION,
                currentData,
                ipData,
                emailDomain: elements.emailDomainType?.value,
                customDomain: elements.customDomain?.value
            }
        });
    } catch (e) {
        log.info('保存数据失败:', e);
    }
}

/**
 * 从 chrome.storage 加载数据
 */
async function loadDataFromStorage() {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const cached = result[STORAGE_KEY];
        if (cached && cached.version !== CACHE_VERSION) {
            log.info('缓存版本不匹配，清除旧缓存');
            await chrome.storage.local.remove(STORAGE_KEY);
            return null;
        }
        if (cached?.currentData) {
            if (cached.currentData.addressSource === undefined) {
                cached.currentData.addressSource = '';
            }
            if (cached.currentData.addressConfidence === undefined) {
                cached.currentData.addressConfidence = '';
            }
            if (cached.currentData.addressLastUpdatedAt === undefined) {
                cached.currentData.addressLastUpdatedAt = '';
            }
        }
        return cached || null;
    } catch (e) {
        log.info('加载数据失败:', e);
        return null;
    }
}

/**
 * 保存主题
 */
async function saveTheme(theme) {
    try {
        await chrome.storage.local.set({ [THEME_KEY]: theme });
    } catch (e) {
        log.info('保存主题失败:', e);
    }
}

/**
 * 加载主题
 */
async function loadTheme() {
    try {
        const result = await chrome.storage.local.get(THEME_KEY);
        const theme = result[THEME_KEY] || 'dark';
        applyTheme(theme);
    } catch (e) {
        log.info('加载主题失败:', e);
    }
}

/**
 * 保存设置
 */
async function saveSettings() {
    userSettings = {
        enableAI: elements.enableAI?.checked ?? false,
        openaiBaseUrl: elements.openaiBaseUrl?.value?.trim() || 'https://api.openai.com/v1',
        openaiKey: elements.openaiKey?.value?.trim() || '',
        openaiModel: elements.openaiModel?.value?.trim() || 'gpt-3.5-turbo',
        aiPersona: elements.aiPersona?.value?.trim() || '',
        passwordLength: parseInt(elements.passwordLength?.value) || 12,
        passwordMode: elements.passwordMode?.value || 'custom',
        pwdUppercase: elements.pwdUppercase?.checked ?? true,
        pwdLowercase: elements.pwdLowercase?.checked ?? true,
        pwdNumbers: elements.pwdNumbers?.checked ?? true,
        pwdSymbols: elements.pwdSymbols?.checked ?? true,
        pwdNoAmbiguous: elements.pwdNoAmbiguous?.checked ?? false,
        minAge: parseInt(elements.minAge?.value) || 18,
        maxAge: parseInt(elements.maxAge?.value) || 55,
        autoClearData: elements.autoClearData?.checked ?? false,
        geoapifyKey: elements.geoapifyKey?.value?.trim() || ''
    };

    try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: userSettings });
        await chrome.storage.local.set({ [AUTO_CLEAR_KEY]: userSettings.autoClearData });
        if (window.generators && window.generators.updateSettings) {
            window.generators.updateSettings(userSettings);
        }
        // 设置 Geoapify API Key 到 generators
        if (window.generators && window.generators.setGeoapifyApiKey) {
            window.generators.setGeoapifyApiKey(userSettings.geoapifyKey);
        }
    } catch (e) {
        log.info('保存设置失败:', e);
    }
}

/**
 * 加载设置
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(SETTINGS_KEY);
        if (result[SETTINGS_KEY]) {
            userSettings = { ...userSettings, ...result[SETTINGS_KEY] };
        }
        updateSettingsUI();
        if (window.generators && window.generators.updateSettings) {
            window.generators.updateSettings(userSettings);
        }
        // 加载 Geoapify API Key (独立存储)
        await loadGeoapifyKey();
        // 加载自托管地址服务配置 (独立存储)
        await loadSelfHostedAddressConfig();
    } catch (e) {
        log.info('加载设置失败:', e);
    }
}

/**
 * 加载 Geoapify API Key (独立存储)
 */
async function loadAddressApiToggle() {
    try {
        const result = await chrome.storage.local.get(ADDRESS_API_ENABLED_KEY);
        if (elements.useAddressApiToggle) {
            elements.useAddressApiToggle.checked = result[ADDRESS_API_ENABLED_KEY] === true;
        }
    } catch (e) {
        log.info('Load address API toggle failed:', e);
    }
}

async function saveAddressApiToggle(enabled) {
    try {
        await chrome.storage.local.set({ [ADDRESS_API_ENABLED_KEY]: Boolean(enabled) });
    } catch (e) {
        log.info('Save address API toggle failed:', e);
    }
}
async function loadGeoapifyKey() {
    try {
        const result = await chrome.storage.local.get(GEOAPIFY_KEY);
        geoapifyApiKey = result[GEOAPIFY_KEY] || '';
        if (elements.geoapifyKey) {
            elements.geoapifyKey.value = geoapifyApiKey;
        }
        // 同步到 generators
        if (window.generators && window.generators.setGeoapifyApiKey) {
            window.generators.setGeoapifyApiKey(geoapifyApiKey);
        }
        log.info(' Geoapify API Key 已加载');
    } catch (e) {
        log.info('加载 Geoapify API Key 失败:', e);
    }
}

/**
 * 保存 Geoapify API Key (独立存储，实时保存)
 */
async function saveGeoapifyKey() {
    const key = elements.geoapifyKey?.value?.trim() || '';
    geoapifyApiKey = key;
    try {
        await chrome.storage.local.set({ [GEOAPIFY_KEY]: key });
        // 同步到 generators
        if (window.generators && window.generators.setGeoapifyApiKey) {
            window.generators.setGeoapifyApiKey(key);
        }
        showToast(key ? 'Geoapify API Key 已保存' : 'Geoapify API Key 已清除');
        log.info(' Geoapify API Key 已保存');
    } catch (e) {
        log.info('保存 Geoapify API Key 失败:', e);
    }
}
/**
 * 加载自托管地址服务配置 (独立存储)
 */
async function loadSelfHostedAddressConfig() {
    try {
        const result = await chrome.storage.local.get([SELFHOSTED_ADDR_URL_KEY, SELFHOSTED_ADDR_TOKEN_KEY]);
        selfHostedAddrUrl = result[SELFHOSTED_ADDR_URL_KEY] || '';
        selfHostedAddrToken = result[SELFHOSTED_ADDR_TOKEN_KEY] || '';
        if (elements.selfHostedAddrUrl) {
            elements.selfHostedAddrUrl.value = selfHostedAddrUrl;
        }
        if (elements.selfHostedAddrToken) {
            elements.selfHostedAddrToken.value = selfHostedAddrToken;
        }
        // 同步到 generators
        if (window.generators && window.generators.setSelfHostedAddressConfig) {
            window.generators.setSelfHostedAddressConfig(selfHostedAddrUrl, selfHostedAddrToken);
        }
        log.info('自托管地址服务配置已加载');
    } catch (e) {
        log.info('加载自托管地址服务配置失败:', e);
    }
}

/**
 * 保存自托管地址服务配置 (独立存储，实时保存)
 */
async function saveSelfHostedAddressConfig() {
    selfHostedAddrUrl = elements.selfHostedAddrUrl?.value?.trim() || '';
    selfHostedAddrToken = elements.selfHostedAddrToken?.value?.trim() || '';
    try {
        await chrome.storage.local.set({
            [SELFHOSTED_ADDR_URL_KEY]: selfHostedAddrUrl,
            [SELFHOSTED_ADDR_TOKEN_KEY]: selfHostedAddrToken
        });
        // 同步到 generators
        if (window.generators && window.generators.setSelfHostedAddressConfig) {
            window.generators.setSelfHostedAddressConfig(selfHostedAddrUrl, selfHostedAddrToken);
        }
        showToast(selfHostedAddrUrl ? '自托管地址服务已保存' : '自托管地址服务已清除');
        log.info('自托管地址服务配置已保存');
    } catch (e) {
        log.info('保存自托管地址服务配置失败:', e);
    }
}
