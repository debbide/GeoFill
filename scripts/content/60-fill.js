/**
 * GeoFill content script - 60-fill.js
 * fillForm 主流程：动态重试、结果合并
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
const DYNAMIC_FILL_RETRY_DELAYS = [200, 500, 900];
const POST_FILL_DIAGNOSTIC_DELAYS = [120, 380];

/**
 * 填写表单（增强版）
 */
function fillForm(data, options = {}) {
    let filledCount = 0;
    const results = {};
    const usedElements = options.usedElements || new Set();

    const identityFilled = fillIdentityParts(data, usedElements);
    if (identityFilled > 0) {
        filledCount += identityFilled;
        results['identityParts'] = `filled ${identityFilled} field(s)`;
    }

    const passwordFilled = fillPasswordParts(data, usedElements);
    if (passwordFilled > 0) {
        filledCount += passwordFilled;
        results['password'] = `filled ${passwordFilled} field(s)`;
    } else if (data.password) {
        results['password'] = 'not found';
    }

    const countryPhoneFilled = fillCountryAndPhoneParts(data, usedElements);
    if (countryPhoneFilled > 0) {
        filledCount += countryPhoneFilled;
        results['countryPhoneParts'] = `filled ${countryPhoneFilled} field(s)`;
    }

    const addressPartsFilled = fillAddressParts(data, usedElements);
    if (addressPartsFilled > 0) {
        filledCount += addressPartsFilled;
        results['addressParts'] = `filled ${addressPartsFilled} field(s)`;
    }

    const birthdayPartsFilled = fillBirthdayParts(data, usedElements);
    if (birthdayPartsFilled > 0) {
        filledCount += birthdayPartsFilled;
        results['birthdayParts'] = `filled ${birthdayPartsFilled} field(s)`;
    }

    const checkboxFilled = fillConsentCheckboxes(usedElements);
    if (checkboxFilled > 0) {
        filledCount += checkboxFilled;
        results['checkboxes'] = `updated ${checkboxFilled} field(s)`;
    }

    for (const [fieldName, value] of Object.entries(data)) {
        if (!value) continue;

        // 这些字段前面已经走专项拆分/匹配逻辑，避免重复覆盖。
        if (SPECIAL_HANDLED_FIELDS.has(fieldName)) {
            continue;
        }

        // 性别字段特殊处理（可能是 radio）
        if (fieldName === 'gender') {
            const element = findField(fieldName) || findFieldByIntent('gender', usedElements);
            if (element) {
                if (element.tagName.toLowerCase() === 'select') {
                    if (fillGenderSelect(element, value)) {
                        filledCount++;
                        usedElements.add(element);
                        results[fieldName] = 'filled (select)';
                    }
                } else if (String(element.type || '').toLowerCase() === 'radio') {
                    if (fillGenderRadio(value)) {
                        filledCount++;
                        usedElements.add(element);
                        results[fieldName] = 'filled (radio)';
                    }
                } else {
                    simulateInput(element, value);
                    usedElements.add(element);
                    filledCount++;
                    results[fieldName] = 'filled';
                }
            } else {
                // 尝试 radio 按钮
                if (fillGenderRadio(value) || fillRadio('gender', value) || fillRadio('sex', value)) {
                    filledCount++;
                    results[fieldName] = 'filled (radio)';
                } else {
                    results[fieldName] = 'not found';
                }
            }
            continue;
        }

        const element = findField(fieldName);

        if (element && usedElements.has(element)) {
            results[fieldName] = 'already filled';
        } else if (element) {
            if (element.tagName.toLowerCase() === 'select') {
                if (fillSelect(element, value)) {
                    filledCount++;
                    usedElements.add(element);
                    results[fieldName] = 'filled';
                } else {
                    results[fieldName] = 'no matching option';
                }
            } else {
                simulateInput(element, value);
                usedElements.add(element);
                filledCount++;
                results[fieldName] = 'filled';
            }
        } else {
            results[fieldName] = 'not found';
        }
    }

    const validation = buildFillValidation(data);
    const diagnostics = buildFillDiagnostics(data, results, validation, filledCount);
    if (options.log !== false) {
        logFillSummary(filledCount, results, validation, diagnostics);
    }

    if (options.scheduleAddressFallback !== false) {
        scheduleDelayedAddressFallback(data, results, usedElements);
    }

    return { filledCount, results, validation, diagnostics };
}

async function finalizeFillResult(data, result, options = {}) {
    const delays = Array.isArray(options.diagnosticDelays) ? options.diagnosticDelays : POST_FILL_DIAGNOSTIC_DELAYS;
    let finalResult = result;
    let diagnosticPasses = 1;

    for (const waitMs of delays) {
        await delay(Number(waitMs) || 0);
        const validation = buildFillValidation(data);
        const diagnostics = buildFillDiagnostics(data, finalResult.results, validation, finalResult.filledCount);
        diagnosticPasses++;

        finalResult = {
            ...finalResult,
            validation,
            diagnostics
        };

        if (!diagnostics.isClean) break;
    }

    finalResult.diagnosticPasses = diagnosticPasses;
    return finalResult;
}

async function fillFormWithDynamicRetry(data, options = {}) {
    const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : DYNAMIC_FILL_RETRY_DELAYS;
    let result = { filledCount: 0, results: {}, validation: buildFillValidation(data) };
    const aggregate = { filledCount: 0, results: {}, validation: result.validation, diagnostics: buildFillDiagnostics(data, {}, result.validation, 0) };
    let pendingSelectFollowups = 0;
    let passes = 0;
    const usedElements = new Set();

    for (let pass = 0; pass <= retryDelays.length; pass++) {
        passes = pass + 1;
        const beforeSelectState = getSelectStateSignature();
        result = fillForm(data, { log: false, scheduleAddressFallback: false, usedElements });
        mergeFillPassResult(aggregate, result);
        const afterSelectState = getSelectStateSignature();
        const afterFieldSignature = getFillableElementSignature();

        if (beforeSelectState !== afterSelectState) {
            // 国家/州等 select 变化后，很多站点会延迟渲染下一级字段，额外等两轮更稳。
            pendingSelectFollowups = Math.max(pendingSelectFollowups, 2);
        }

        if (pass >= retryDelays.length) break;
        if (pass > 0 && result.validation?.isComplete && pendingSelectFollowups === 0) break;

        await delay(Number(retryDelays[pass]) || 0);
        const nextFieldSignature = getFillableElementSignature();
        const shouldRetry = pass === 0
            || !result.validation?.isComplete
            || nextFieldSignature !== afterFieldSignature
            || pendingSelectFollowups > 0;

        if (pendingSelectFollowups > 0) pendingSelectFollowups--;
        if (!shouldRetry) break;
    }

    aggregate.dynamicPasses = passes;
    aggregate.diagnostics = buildFillDiagnostics(data, aggregate.results, aggregate.validation, aggregate.filledCount);
    const finalAggregate = await finalizeFillResult(data, aggregate, options);
    logFillSummary(finalAggregate.filledCount, finalAggregate.results, finalAggregate.validation, finalAggregate.diagnostics);
    scheduleDelayedAddressFallback(data, finalAggregate.results);
    // 多步骤表单跟随：有实际填写才启动观察者
    if (finalAggregate.filledCount > 0) {
        armStepWatcher();
    }
    return finalAggregate;
}

/* ==========================================================================
 * 多步骤表单跟随
 * --------------------------------------------------------------------------
 * 向导类表单（点"下一步"后出现新字段）一次 fill 覆盖不到后续步骤。
 * fill 完成后启动一个有界（90 秒）的 MutationObserver：当检测到全新的
 * 空字段出现时，通知 background（扩展图标 badge + popup 待办），用户点
 * 一下即可继续填写下一步。不做自动填充，避免意外提交。
 * ========================================================================== */

const STEP_WATCHER_MAX_AGE_MS = 90000;
const STEP_WATCHER_DEBOUNCE_MS = 800;

let stepWatcher = null;

function stepFieldKey(element) {
    return String(element?.id || element?.name || '');
}

function disarmStepWatcher() {
    if (!stepWatcher) return;
    try { stepWatcher.observer.disconnect(); } catch (e) { /* 忽略 */ }
    try { clearTimeout(stepWatcher.debounceTimer); } catch (e) { /* 忽略 */ }
    try { clearTimeout(stepWatcher.maxAgeTimer); } catch (e) { /* 忽略 */ }
    stepWatcher = null;
}

function armStepWatcher() {
    disarmStepWatcher();
    if (typeof MutationObserver === 'undefined') return;
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;

    // 记录本次已填字段的身份；只统计有 id/name 的（无身份字段无法跨轮次识别）
    const knownKeys = new Set();
    try {
        getFillableElements().forEach((el) => {
            if (isElementFilled(el)) {
                const k = stepFieldKey(el);
                if (k) knownKeys.add(k);
            }
        });
    } catch (e) { return; }
    if (knownKeys.size === 0) return;

    const startTime = Date.now();

    const check = async () => {
        if (Date.now() - startTime > STEP_WATCHER_MAX_AGE_MS) {
            disarmStepWatcher();
            return;
        }
        let newEmpty = 0;
        try {
            const fields = getFillableElements();
            // 旧字段基本还在（排除 SPA 整页切换导致的误报）
            const stillThere = fields.filter((el) => knownKeys.has(stepFieldKey(el))).length;
            if (stillThere === 0) return;
            for (const el of fields) {
                const k = stepFieldKey(el);
                if (k && !knownKeys.has(k) && !isElementFilled(el)) newEmpty++;
            }
        } catch (e) { return; }

        if (newEmpty > 0) {
            // 把这批新字段也记入已知，避免对同一批重复通知
            try {
                getFillableElements().forEach((el) => {
                    const k = stepFieldKey(el);
                    if (k) knownKeys.add(k);
                });
            } catch (e) { /* 忽略 */ }
            try {
                await chrome.runtime.sendMessage({
                    action: 'multistepFieldsDetected',
                    newFieldCount: newEmpty
                });
            } catch (e) { /* popup 未打开时由 background 处理 */ }
        }
    };

    let observer = null;
    try {
        observer = new MutationObserver(() => {
            if (stepWatcher && stepWatcher.debounceTimer) {
                clearTimeout(stepWatcher.debounceTimer);
            }
            const t = setTimeout(check, STEP_WATCHER_DEBOUNCE_MS);
            if (stepWatcher) stepWatcher.debounceTimer = t;
        });
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    } catch (e) { return; }

    stepWatcher = {
        observer,
        debounceTimer: null,
        maxAgeTimer: setTimeout(disarmStepWatcher, STEP_WATCHER_MAX_AGE_MS + 1000)
    };
}
