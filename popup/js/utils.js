/**
 * Utility helpers.
 */

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast.
 */
function showToast(message) {
    const toast = elements.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

function getAddressSourceText(source) {
    if (source === 'selfhosted') return '自托管';
    if (source === 'geoapify') return 'Geoapify';
    if (source === 'openstreetmap') return 'OSM';
    if (source === 'local_verified') return '本地真实池';
    return '本地合成';
}

function getAddressQualityText(confidence) {
    if (confidence === 'high') return '高置信';
    if (confidence === 'medium') return '中置信';
    return '基础';
}

function applyGeneratedAddress(realAddress, options = {}) {
    if (!realAddress || !realAddress.address) return false;

    const forceAddress = options.forceAddress === true;

    if (forceAddress || !lockedFields.has('address')) {
        currentData.address = realAddress.address;
    }

    currentData.addressSource = realAddress.source || 'synthetic';
    currentData.addressConfidence = realAddress.confidence || 'low';
    currentData.addressLastUpdatedAt = new Date().toISOString();

    if (realAddress.city && !lockedFields.has('city')) {
        currentData.city = realAddress.city;
    }
    if (realAddress.state && !lockedFields.has('state')) {
        currentData.state = realAddress.state;
    }
    if (realAddress.zipCode && !lockedFields.has('zipCode')) {
        currentData.zipCode = realAddress.zipCode;
    }
    if (realAddress.country && !lockedFields.has('country')) {
        currentData.country = realAddress.country;
    }

    return true;
}

function sameAddressText(a, b) {
    return String(a || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') === String(b || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
}

function getAddressGenerationContext(lockedValues = {}) {
    const country = lockedFields.has('country') && lockedValues.country ? lockedValues.country : currentData.country;
    return {
        country,
        city: lockedFields.has('city') && lockedValues.city ? lockedValues.city : currentData.city,
        state: lockedFields.has('state') && lockedValues.state ? lockedValues.state : currentData.state,
        zipCode: lockedFields.has('zipCode') && lockedValues.zipCode ? lockedValues.zipCode : currentData.zipCode
    };
}

function hasHighConfidenceAddressForContext(context) {
    if (!currentData.address || currentData.addressSource !== 'local_verified' || currentData.addressConfidence !== 'high') {
        return false;
    }

    const normalizedCurrentCountry = window.generators?.normalizeCountry
        ? window.generators.normalizeCountry(currentData.country)
        : currentData.country;
    const normalizedTargetCountry = window.generators?.normalizeCountry
        ? window.generators.normalizeCountry(context.country)
        : context.country;

    if (normalizedCurrentCountry !== normalizedTargetCountry) return false;
    if (context.city && !sameAddressText(currentData.city, context.city)) return false;
    if (context.state && currentData.state && !sameAddressText(currentData.state, context.state)) return false;
    if (context.zipCode && currentData.zipCode && !sameAddressText(currentData.zipCode, context.zipCode)) return false;
    return true;
}

async function generateAddressForCurrentContext(lockedValues = {}, options = {}) {
    if (!window.generators?.generateAddressAsync) return null;

    const context = getAddressGenerationContext(lockedValues);
    if (options.forceRefresh !== true && hasHighConfidenceAddressForContext(context)) {
        return null;
    }

    const allowApi = options.allowApi !== undefined ? options.allowApi : false;

    return await window.generators.generateAddressAsync(
        context.country,
        context.city,
        {
            requireCityMatch: Boolean(context.city),
            allowApi,
            locationContext: {
                state: context.state,
                zipCode: context.zipCode
            }
        }
    );
}

function isAddressApiToggleEnabled() {
    return elements.useAddressApiToggle?.checked === true;
}

async function hasHostPermission(url) {
    try {
        const parsed = new URL(url);
        const originPattern = `${parsed.protocol}//${parsed.host}/*`;
        return await chrome.permissions.contains({ origins: [originPattern] });
    } catch (e) {
        log.error('Permission check failed:', e);
        return false;
    }
}

async function ensureAddressApiPermission(options = {}) {
    if (!isAddressApiToggleEnabled()) return false;
    const requestIfMissing = options.requestIfMissing === true;

    const targets = ['https://nominatim.openstreetmap.org/reverse'];
    if (userSettings.geoapifyKey) {
        targets.unshift('https://api.geoapify.com/v1/geocode/reverse');
    }
    if (selfHostedAddrUrl) {
        targets.unshift(selfHostedAddrUrl);
    }

    for (const target of targets) {
        const granted = requestIfMissing ? await ensureHostPermission(target) : await hasHostPermission(target);
        if (!granted) {
            if (elements.useAddressApiToggle) {
                elements.useAddressApiToggle.checked = false;
            }
            await saveAddressApiToggle(false);
            if (requestIfMissing) {
                showToast('未授权地址 API，已切回本地地址池');
            }
            return false;
        }
    }

    return true;
}

async function shouldUseAddressApi(options = {}) {
    if (options.allowApi !== true) return false;
    return await ensureAddressApiPermission({
        requestIfMissing: options.requestPermission === true
    });
}

function showAddressUpdatedToast(realAddress) {
    const sourceText = getAddressSourceText(realAddress?.source);
    const qualityText = getAddressQualityText(realAddress?.confidence);
    showToast(`地址已更新 (${sourceText} / ${qualityText})`);
}

/**
 * Copy text to clipboard.
 */
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            btn.classList.add('copied');
            btn.textContent = '✅';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = '📋';
            }, 1000);
        }
        showToast('已复制到剪贴板');
    } catch (err) {
        log.error('Copy failed:', err);
        showToast('复制失败');
    }
}

/**
 * Copy all generated fields.
 */
async function copyAllToClipboard() {
    updateCurrentDataFromInputs();

    const lines = [
        `姓名: ${currentData.firstName} ${currentData.lastName}`,
        `性别: ${currentData.gender === 'male' ? '男' : '女'}`,
        `生日: ${currentData.birthday}`,
        `用户名: ${currentData.username}`,
        `邮箱: ${currentData.email}`,
        `密码: ${currentData.password}`,
        `电话: ${currentData.phone}`,
        `地址: ${currentData.address}`,
        `城市: ${currentData.city}`,
        `州/省: ${currentData.state}`,
        `邮编: ${currentData.zipCode}`,
        `国家: ${currentData.country}`
    ];

    const text = lines.join('\n');

    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制全部信息');
    } catch (err) {
        log.error('Copy all failed:', err);
        showToast('复制失败');
    }
}

/**
 * Ensure host permission for a URL.
 */
async function ensureHostPermission(url) {
    try {
        const parsed = new URL(url);
        const originPattern = `${parsed.protocol}//${parsed.host}/*`;

        const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
        if (hasPermission) return true;

        return await chrome.permissions.request({ origins: [originPattern] });
    } catch (e) {
        log.error('Permission check failed:', e);
        return false;
    }
}

/**
 * Content script 文件列表（按顺序注入，90-main.js 必须最后）。
 * background.js 里有一份同样的列表，改动时记得同步。
 */
const CONTENT_SCRIPT_FILES = [
    'scripts/selectors/common.js',
    'scripts/country-extensions.js',
    'scripts/selectors/japan.js',
    'scripts/content/10-dom.js',
    'scripts/content/20-intent.js',
    'scripts/content/30-format.js',
    'scripts/content/40-controls.js',
    'scripts/content/50-diagnostics.js',
    'scripts/content/60-fill.js',
    'scripts/content/70-scan.js',
    'scripts/content/80-smart.js',
    'scripts/content/90-main.js'
];

// tabId -> 已注入 content script 的 frameId 集合（避免重复注入）
const injectedFrameIds = new Map();

function markFrameInjected(tabId, frameId) {
    let set = injectedFrameIds.get(tabId);
    if (!set) {
        set = new Set();
        injectedFrameIds.set(tabId, set);
    }
    set.add(frameId);
}

function getInjectedFrameIds(tabId) {
    const set = injectedFrameIds.get(tabId);
    return set && set.size > 0 ? Array.from(set) : [0];
}

async function injectIntoFrame(tabId, frameId) {
    await chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [frameId] },
        files: CONTENT_SCRIPT_FILES
    });
}

/**
 * 轮询 content script 就绪标记，替代固定时长硬等待。
 * @returns {Promise<boolean>} 就绪返回 true，超时返回 false
 */
async function waitForContentScriptReady(tabId, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => window.__GeoFillContentReady === true
            });
            if (results && results[0] && results[0].result === true) {
                return true;
            }
        } catch (e) {
            // 页面跳转/关闭等情况直接放弃轮询
            return false;
        }
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
}

/**
 * Ensure content script is injected.
 * 主 frame 必注；子 frame 尽力注入（iframe 内表单支持），跨域或特殊页面失败则跳过。
 */
async function ensureContentScriptInjected(tabId) {
    try {
        await injectIntoFrame(tabId, 0);
        markFrameInjected(tabId, 0);

        try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId });
            for (const frame of frames || []) {
                const fid = frame.frameId;
                if (fid === 0) continue;
                const known = injectedFrameIds.get(tabId);
                if (known && known.has(fid)) continue;
                try {
                    await injectIntoFrame(tabId, fid);
                    markFrameInjected(tabId, fid);
                } catch (e) {
                    // 跨域 frame / chrome:// 等，跳过
                }
            }
        } catch (e) {
            // webNavigation 不可用时仅注入主 frame
        }

        const ready = await waitForContentScriptReady(tabId);
        if (!ready) {
            throw new Error('内容脚本注入后未就绪');
        }
    } catch (e) {
        log.error('[GeoFill] Script injection failed:', e);
        throw new Error('无法注入脚本，请刷新页面后重试');
    }
}

/**
 * 向已注入的各 frame 广播消息并收集结果（主 frame 结果在首位）。
 */
async function broadcastToFrames(tabId, message, primaryResult) {
    const results = [primaryResult];
    for (const fid of getInjectedFrameIds(tabId)) {
        if (fid === 0) continue;
        try {
            results.push(await chrome.tabs.sendMessage(tabId, message, { frameId: fid }));
        } catch (e) {
            // frame 已卸载等情况跳过
        }
    }
    return results;
}

/**
 * Send message to content script with auto-injection fallback.
 * @param {object} options.broadcast 为 true 时向所有已注入 frame 广播，返回结果数组
 */
async function sendMessageToTab(tabId, message, options = {}) {
    const { broadcast = false } = options;
    const sendPrimary = () => chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    try {
        const primary = await sendPrimary();
        return broadcast ? await broadcastToFrames(tabId, message, primary) : primary;
    } catch (e) {
        await ensureContentScriptInjected(tabId);
        const primary = await sendPrimary();
        return broadcast ? await broadcastToFrames(tabId, message, primary) : primary;
    }
}

/**
 * Toggle lock state for a field.
 */
function toggleLock(fieldName, btn) {
    if (lockedFields.has(fieldName)) {
        lockedFields.delete(fieldName);
        btn.classList.remove('locked');
        btn.textContent = '🔓';
        showToast(`${fieldName} 已解锁`);
    } else {
        lockedFields.add(fieldName);
        btn.classList.add('locked');
        btn.textContent = '🔒';
        showToast(`${fieldName} 已锁定`);
    }
    saveLockedFields();
}

/**
 * Format history timestamp.
 */
function formatHistoryTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Unified error handling
function handleError(error, context = '操作', showToastMsg = true) {
    log.error(`${context}失败:`, error);
    if (showToastMsg) {
        const message = error.message || '未知错误';
        showToast(`${context}失败: ${message.slice(0, 50)}`);
    }
}

function withErrorHandler(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context);
        }
    };
}

function showLoading(btn, loadingText = '加载中...') {
    if (!btn) return { restore: () => {} };

    const originalText = btn.textContent;
    const originalDisabled = btn.disabled;

    btn.textContent = loadingText;
    btn.disabled = true;
    btn.classList.add('loading');

    return {
        originalText,
        restore: () => {
            btn.textContent = originalText;
            btn.disabled = originalDisabled;
            btn.classList.remove('loading');
        }
    };
}

function showLoadingOverlay(container, message = '加载中...') {
    if (!container) return () => {};

    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';

    const textEl = document.createElement('div');
    textEl.className = 'loading-text';
    textEl.textContent = message;

    overlay.appendChild(spinner);
    overlay.appendChild(textEl);

    container.style.position = 'relative';
    container.appendChild(overlay);

    return () => {
        overlay.remove();
    };
}

async function withLoading(btn, loadingText, asyncFn, errorContext = '操作') {
    const loading = showLoading(btn, loadingText);
    try {
        return await asyncFn();
    } catch (error) {
        handleError(error, errorContext);
    } finally {
        loading.restore();
    }
}
