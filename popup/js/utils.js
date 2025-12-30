/**
 * 工具函数
 */

/**
 * HTML 转义函数，防止 XSS 攻击
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示 toast 提示
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

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            btn.classList.add('copied');
            btn.textContent = '✓';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = '📋';
            }, 1000);
        }
        showToast('已复制到剪贴板');
    } catch (err) {
        log.error('复制失败:', err);
        showToast('复制失败');
    }
}

/**
 * 一键复制全部信息
 */
async function copyAllToClipboard() {
    updateCurrentDataFromInputs();

    const lines = [
        `姓名: ${currentData.firstName} ${currentData.lastName} `,
        `性别: ${currentData.gender === 'male' ? '男' : '女'} `,
        `生日: ${currentData.birthday} `,
        `用户名: ${currentData.username} `,
        `邮箱: ${currentData.email} `,
        `密码: ${currentData.password} `,
        `电话: ${currentData.phone} `,
        `地址: ${currentData.address} `,
        `城市: ${currentData.city} `,
        `州 / 省: ${currentData.state} `,
        `邮编: ${currentData.zipCode} `,
        `国家: ${currentData.country} `
    ];

    const text = lines.join('\n');

    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制全部信息');
    } catch (err) {
        log.error('复制失败:', err);
        showToast('复制失败');
    }
}

/**
 * 确保 content script 已注入到指定 tab
 * @param {number} tabId - 标签页 ID
 * @returns {Promise<void>}
 */
async function ensureContentScriptInjected(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: [
                'scripts/selectors/common.js',
                'scripts/selectors/japan.js',
                'scripts/content.js'
            ]
        });
        // 等待脚本初始化
        await new Promise(r => setTimeout(r, 200));
    } catch (e) {
        log.error('[GeoFill] 脚本注入失败:', e);
        throw new Error('无法注入脚本，请刷新页面后重试');
    }
}

/**
 * 安全发送消息到 content script，自动处理脚本未加载的情况
 * @param {number} tabId - 标签页 ID
 * @param {object} message - 要发送的消息
 * @returns {Promise<any>} - content script 的响应
 */
async function sendMessageToTab(tabId, message) {
    try {
        return await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
        // content script 未加载，尝试注入
        await ensureContentScriptInjected(tabId);
        return await chrome.tabs.sendMessage(tabId, message);
    }
}

/**
 * 切换字段锁定状态
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
 * 格式化历史记录时间
 */
function formatHistoryTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) return '刚刚';
    // 小于1小时
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    // 小于24小时
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    // 小于7天
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    // 其他
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ============ 统一错误处理 ============

/**
 * 统一错误处理函数
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文描述
 * @param {boolean} showToastMsg - 是否显示 toast 提示
 */
function handleError(error, context = '操作', showToastMsg = true) {
    log.error(`${context}失败:`, error);
    if (showToastMsg) {
        const message = error.message || '未知错误';
        showToast(`${context}失败: ${message.slice(0, 50)}`);
    }
}

/**
 * 包装异步函数，自动处理错误
 * @param {Function} fn - 异步函数
 * @param {string} context - 错误上下文
 */
function withErrorHandler(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context);
        }
    };
}

// ============ 加载状态管理 ============

/**
 * 显示按钮加载状态
 * @param {HTMLElement} btn - 按钮元素
 * @param {string} loadingText - 加载中显示的文字
 * @returns {object} - 包含原始文字和恢复函数的对象
 */
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

/**
 * 显示元素的加载遮罩
 * @param {HTMLElement} container - 容器元素
 * @param {string} message - 加载提示文字
 * @returns {Function} - 移除遮罩的函数
 */
function showLoadingOverlay(container, message = '加载中...') {
    if (!container) return () => {};

    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${message}</div>`;

    container.style.position = 'relative';
    container.appendChild(overlay);

    return () => {
        overlay.remove();
    };
}

/**
 * 执行带加载状态的异步操作
 * @param {HTMLElement} btn - 按钮元素
 * @param {string} loadingText - 加载中文字
 * @param {Function} asyncFn - 异步函数
 * @param {string} errorContext - 错误上下文
 */
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


