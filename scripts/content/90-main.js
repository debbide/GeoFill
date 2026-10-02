/**
 * GeoFill content script - 90-main.js
 * 消息监听与 content script 就绪标记
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        fillFormWithDynamicRetry(request.data)
            .then(sendResponse)
            .catch((error) => {
                console.warn('[GeoFill] Dynamic fill failed:', error);
                sendResponse({
                    filledCount: 0,
                    results: { error: error?.message || 'fill_failed' },
                    validation: {
                        isComplete: false,
                        missingRequiredFields: [],
                        unfilledRequestedFields: []
                    },
                    diagnostics: {
                        isClean: false,
                        summary: {
                            filledCount: 0,
                            missingRequiredCount: 0,
                            unfilledRequestedCount: 0,
                            pageErrorCount: 0,
                            fieldIssueCount: 1
                        },
                        fieldIssues: [{
                            kind: 'runtime_error',
                            field: '',
                            reason: error?.message || 'fill_failed'
                        }],
                        pageErrors: []
                    }
                });
            });
    } else if (request.action === 'scanForm') {
        const result = scanForm();
        sendResponse(result);
    } else if (request.action === 'fillFormSmart') {
        fillFormSmart(request.data)
            .then(sendResponse)
            .catch((error) => {
                console.warn('[GeoFill] Smart fill failed:', error);
                sendResponse({
                    filledCount: 0,
                    results: { error: error?.message || 'smart_fill_failed' },
                    validation: {
                        isComplete: false,
                        missingRequiredFields: [],
                        unfilledRequestedFields: []
                    },
                    diagnostics: {
                        isClean: false,
                        summary: {
                            filledCount: 0,
                            missingRequiredCount: 0,
                            unfilledRequestedCount: 0,
                            pageErrorCount: 0,
                            fieldIssueCount: 1
                        },
                        fieldIssues: [{
                            kind: 'runtime_error',
                            field: '',
                            reason: error?.message || 'smart_fill_failed'
                        }],
                        pageErrors: []
                    }
                });
            });
    } else if (request.action === 'highlightField') {
        sendResponse(highlightFieldElement(request.target));
    }
    return true;
});

// 标记 content script 已加载（注入就绪轮询依赖此标记）
// 注意：content.js 若继续拆分，此标记必须保留在最后注入的文件末尾
window.__GeoFillContentReady = true;
console.log('[GeoFill] Content script loaded (Enhanced)');
