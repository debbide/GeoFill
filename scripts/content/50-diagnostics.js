/**
 * GeoFill content script - 50-diagnostics.js
 * 诊断与校验：字段描述、缺失必填项、页面错误收集
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
function fillRadio(name, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name*="${name}" i]`);
    const searchValue = value.toLowerCase();

    for (const radio of radios) {
        const radioValue = radio.value.toLowerCase();
        const labelText = radio.labels?.[0]?.textContent?.toLowerCase() || '';

        if (radioValue.includes(searchValue) || labelText.includes(searchValue)) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return false;
}

function getElementCurrentValue(element) {
    if (!element) return '';
    const value = element.value;
    if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
    }
    if (element._v !== undefined && element._v !== null) {
        return String(element._v).trim();
    }
    return '';
}

function isElementRequired(element) {
    return Boolean(
        element.required
        || element.getAttribute?.('required') !== '' && element.getAttribute?.('required') != null
        || element.getAttribute?.('aria-required') === 'true'
    );
}

function isRadioGroupFilled(element) {
    return getRadioGroup(element).some((radio) => radio.checked);
}

function isElementFilled(element) {
    if (!element) return false;

    const tag = element.tagName?.toLowerCase() || '';
    const type = String(element.type || '').toLowerCase();

    if (type === 'checkbox') return Boolean(element.checked);
    if (type === 'radio') return isRadioGroupFilled(element);

    if (tag === 'select') {
        const selected = getSelectOptions(element)[element.selectedIndex];
        if (!selected || isPlaceholderOption(selected) || isOptionDisabled(selected)) return false;
        return Boolean(String(selected.value || selected.text || '').trim());
    }

    return getElementCurrentValue(element) !== '';
}

function describeField(element, fallbackIndex = 0) {
    const intent = classifyFieldIntent(element) || '';
    const id = String(element.id || '').trim();
    const name = String(element.name || '').trim();
    const label = String(getLabelText(element) || element.placeholder || element.getAttribute?.('aria-label') || '').trim();

    return {
        id: id || name || `field_${fallbackIndex}`,
        name,
        type: String(element.type || element.tagName?.toLowerCase() || '').trim(),
        intent,
        label
    };
}

function getSelectOptionDiagnostics(element, limit = 8) {
    if (!element || element.tagName?.toLowerCase() !== 'select') return [];

    return getSelectOptions(element)
        .filter((option) => !isOptionDisabled(option) && !isPlaceholderOption(option))
        .map((option) => ({
            text: String(option.text || '').trim(),
            value: String(option.value || '').trim(),
            code: String(option.getAttribute?.('data-code') || option.getAttribute?.('data-country-code') || '').trim()
        }))
        .filter((option) => option.text || option.value || option.code)
        .slice(0, limit);
}

function describeCandidateForDiagnostics(element, fallbackIndex = 0) {
    const description = describeField(element, fallbackIndex);
    const options = getSelectOptionDiagnostics(element);
    if (options.length > 0) {
        description.options = options;
    }
    return description;
}

function getMissingRequiredFields() {
    const missing = [];
    const seenRadioGroups = new Set();

    getFillableElements().forEach((element, index) => {
        if (!isElementRequired(element)) return;

        if (String(element.type || '').toLowerCase() === 'radio') {
            const key = element.name || element.id || `radio_${index}`;
            if (seenRadioGroups.has(key)) return;
            seenRadioGroups.add(key);
        }

        if (!isElementFilled(element)) {
            missing.push(describeField(element, index));
        }
    });

    return missing;
}

function addUniqueElements(target, elements) {
    elements.forEach((element) => {
        if (element && !target.includes(element)) target.push(element);
    });
}

function getElementsByIntents(intents) {
    const normalized = new Set(intents);
    return getFillableElements().filter((element) => normalized.has(classifyFieldIntent(element)));
}

function getRequestedFieldCandidates(fieldName, data) {
    const candidates = [];

    if (FIELD_INTENTS.simpleRequested.includes(fieldName)) {
        addUniqueElements(candidates, getElementsByIntents([fieldName]));
        return candidates;
    }

    switch (fieldName) {
        case 'firstName':
            addUniqueElements(candidates, getElementsByIntents(['firstName']));
            if (data.firstName && data.lastName) addUniqueElements(candidates, getElementsByIntents(['fullName']));
            break;
        case 'lastName':
            addUniqueElements(candidates, getElementsByIntents(['lastName']));
            if (data.firstName && data.lastName) addUniqueElements(candidates, getElementsByIntents(['fullName']));
            break;
        case 'address':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.address.slice(0, 2)));
            break;
        case 'phone':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.phone));
            break;
        case 'birthday':
        case 'birthDate':
        case 'dateOfBirth':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.birthday));
            break;
        case 'password':
            addUniqueElements(candidates, findPasswordFields());
            break;
        default: {
            const fallback = findField(fieldName);
            if (fallback) candidates.push(fallback);
        }
    }

    return candidates;
}

function isRequestedFieldSatisfied(fieldName, candidates) {
    if (candidates.length === 0) return true;

    const filledByIntent = (intent) => candidates.some((element) => classifyFieldIntent(element) === intent && isElementFilled(element));

    switch (fieldName) {
        case 'firstName':
            return filledByIntent('firstName') || filledByIntent('fullName');
        case 'lastName':
            return filledByIntent('lastName') || filledByIntent('fullName');
        case 'address':
            return filledByIntent('addressLine1');
        case 'phone':
            return filledByIntent('phone')
                || FIELD_INTENTS.phoneSegments.filter((intent) => filledByIntent(intent)).length >= 2;
        case 'birthday':
        case 'birthDate':
        case 'dateOfBirth':
            return filledByIntent('birthday')
                || FIELD_INTENTS.birthday.filter((intent) => intent !== 'birthday').every((intent) => filledByIntent(intent));
        case 'password':
            return candidates.some(isElementFilled);
        default:
            return candidates.some(isElementFilled);
    }
}

function buildFillValidation(data) {
    const missingRequiredFields = getMissingRequiredFields();
    const unfilledRequestedFields = [];

    VALIDATION_REQUESTED_FIELDS.forEach((fieldName) => {
        if (!data[fieldName]) return;
        const candidates = getRequestedFieldCandidates(fieldName, data);
        if (candidates.length === 0) return;
        if (isRequestedFieldSatisfied(fieldName, candidates)) return;

        unfilledRequestedFields.push({
            field: fieldName,
            requestedValue: String(data[fieldName] || '').slice(0, 120),
            reason: 'empty_after_fill',
            candidates: candidates.map((element, index) => describeCandidateForDiagnostics(element, index))
        });
    });

    return {
        isComplete: missingRequiredFields.length === 0 && unfilledRequestedFields.length === 0,
        missingRequiredFields,
        unfilledRequestedFields
    };
}

const PAGE_ERROR_SELECTORS = [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
    '.error',
    '.errors',
    '.field-error',
    '.form-error',
    '.error-message',
    '.invalid-feedback',
    '.validation-error',
    '[class*="error"]',
    '[class*="invalid"]',
    '[id*="error"]',
    '[id*="invalid"]'
];

function normalizeDiagnosticText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
}

function isLikelyErrorText(text) {
    const normalized = normalizeIntentText(text);
    return /(?:error|invalid|required|missing|please|enter|select|choose|failed|wrong|not valid|must|cannot|can't|必填|错误|錯誤|无效|無效|请输入|請輸入|请选择|請選擇|未入力|エラー|無効|필수|오류)/.test(normalized);
}

function isDiagnosticNodeVisible(node) {
    if (!node || node.hidden || node.getAttribute?.('hidden') !== '' && node.getAttribute?.('hidden') != null) {
        return false;
    }
    if (node.getAttribute?.('aria-hidden') === 'true') return false;

    const style = window.getComputedStyle?.(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
        return false;
    }

    const rect = node.getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return false;

    return true;
}

function collectDescribedByText(element) {
    return normalizeDiagnosticText(getTextByElementIds(element.getAttribute?.('aria-describedby')));
}

function collectNativeInvalidFieldErrors() {
    const errors = [];
    const seen = new Set();

    getFillableElements().forEach((element, index) => {
        const ariaInvalid = element.getAttribute?.('aria-invalid') === 'true';
        let nativeInvalid = false;
        try {
            nativeInvalid = Boolean(element.validity && element.validity.valid === false);
        } catch (e) {
            nativeInvalid = false;
        }
        try {
            nativeInvalid = nativeInvalid || Boolean(element.matches?.(':invalid'));
        } catch (e) {
            // Some fake DOMs or browser restrictions can throw on :invalid.
        }

        if (!ariaInvalid && !nativeInvalid) return;

        const description = collectDescribedByText(element);
        const message = normalizeDiagnosticText(element.validationMessage || description || `${describeField(element, index).id} is invalid`);
        if (!message) return;

        const key = `field:${describeField(element, index).id}:${message}`;
        if (seen.has(key)) return;
        seen.add(key);

        errors.push({
            source: ariaInvalid ? 'aria-invalid' : 'native-validation',
            text: message,
            field: describeField(element, index)
        });
    });

    return errors;
}

function collectPageErrorMessages() {
    const errors = [];
    const seen = new Set();

    try {
        Array.from(document.querySelectorAll(PAGE_ERROR_SELECTORS.join(','))).forEach((node) => {
            if (!isDiagnosticNodeVisible(node)) return;
            const text = normalizeDiagnosticText(node.innerText || node.textContent || node.getAttribute?.('aria-label'));
            if (!text) return;
            if (text.length < 3 || text.length > 240) return;
            if (!isLikelyErrorText(text) && node.getAttribute?.('role') !== 'alert') return;

            const key = compactIntentText(text);
            if (seen.has(key)) return;
            seen.add(key);

            errors.push({
                source: node.getAttribute?.('role') === 'alert' ? 'alert' : 'page-error-text',
                text
            });
        });
    } catch (e) {
        // Error scanning is diagnostic-only; never block form filling.
    }

    return [...collectNativeInvalidFieldErrors(), ...errors].slice(0, 12);
}

function inferUnfilledRequestedReason(issue) {
    const candidates = Array.isArray(issue?.candidates) ? issue.candidates : [];
    if (candidates.length === 0) return 'field_not_found';
    if (candidates.some((candidate) => String(candidate.type || '').toLowerCase().includes('select'))) {
        return 'select_option_not_matched';
    }
    if (candidates.some((candidate) => String(candidate.type || '').toLowerCase() === 'radio')) {
        return 'radio_option_not_matched';
    }
    return issue?.reason || 'empty_after_fill';
}

function buildFillDiagnostics(data, results, validation, filledCount = 0) {
    const fieldIssues = [];

    (validation?.missingRequiredFields || []).forEach((field) => {
        fieldIssues.push({
            kind: 'required_missing',
            field: field.intent || field.name || field.id,
            reason: 'required_field_empty',
            label: field.label || field.name || field.id,
            target: field
        });
    });

    (validation?.unfilledRequestedFields || []).forEach((issue) => {
        fieldIssues.push({
            kind: 'requested_unfilled',
            field: issue.field,
            requestedValue: issue.requestedValue || '',
            reason: inferUnfilledRequestedReason(issue),
            label: issue.candidates?.[0]?.label || issue.field,
            candidates: issue.candidates || []
        });
    });

    const pageErrors = collectPageErrorMessages();

    return {
        isClean: fieldIssues.length === 0 && pageErrors.length === 0,
        summary: {
            filledCount: Number(filledCount || 0),
            missingRequiredCount: validation?.missingRequiredFields?.length || 0,
            unfilledRequestedCount: validation?.unfilledRequestedFields?.length || 0,
            pageErrorCount: pageErrors.length,
            fieldIssueCount: fieldIssues.length
        },
        fieldIssues,
        pageErrors
    };
}

function logFillSummary(filledCount, results, validation, diagnostics) {
    if (validation?.isComplete) {
        if (diagnostics?.pageErrors?.length) {
            console.warn('[GeoFill] 填写完成但页面仍显示错误:', {
                filledCount,
                pageErrorCount: diagnostics.pageErrors.length,
                pageErrors: diagnostics.pageErrors
            });
            return;
        }
        console.log('[GeoFill] 填写完成:', filledCount, '个字段');
        return;
    }

    console.warn('[GeoFill] 填写完成但仍有未填项:', {
        filledCount,
        missingRequiredCount: validation?.missingRequiredFields?.length || 0,
        unfilledRequestedCount: validation?.unfilledRequestedFields?.length || 0,
        pageErrorCount: diagnostics?.pageErrors?.length || 0,
        results,
        validation,
        diagnostics
    });
}

function isSuccessfulFillStatus(status) {
    return /^(filled|updated|already filled)/.test(String(status || ''));
}

function parseFillResultCount(value) {
    const match = String(value || '').match(/^(filled|updated)\s+(\d+)\s+field/);
    if (!match) return null;
    return {
        action: match[1],
        count: Number.parseInt(match[2], 10)
    };
}

function mergeFillResultStatus(previous, next) {
    if (!previous) return next;
    if (!next) return previous;

    const previousCount = parseFillResultCount(previous);
    const nextCount = parseFillResultCount(next);
    if (previousCount && nextCount && previousCount.action === nextCount.action) {
        return `${previousCount.action} ${previousCount.count + nextCount.count} field(s)`;
    }

    if (isSuccessfulFillStatus(previous) && !isSuccessfulFillStatus(next)) {
        return previous;
    }

    return next;
}

function mergeFillPassResult(target, source) {
    target.filledCount += Number(source?.filledCount || 0);
    Object.entries(source?.results || {}).forEach(([key, value]) => {
        target.results[key] = mergeFillResultStatus(target.results[key], value);
    });
    target.validation = source?.validation || target.validation;
    target.diagnostics = source?.diagnostics || target.diagnostics;
}

function scheduleDelayedAddressFallback(data, results, usedElements = new Set()) {
    if (!data.address || results.addressParts || isSuccessfulFillStatus(results.address)) return;

    // 最后兜底只允许填写明确识别为地址行的字段。宁可漏填，也不要把地址写入验证码、token、备注等宽匹配字段。
    setTimeout(() => {
        const addressEl = findFieldByIntent('addressLine1', usedElements);
        if (addressEl && classifyFieldIntent(addressEl) === 'addressLine1' && !isTokenOrOptionalCodeField(addressEl)) {
            simulateInput(addressEl, data.address);
            console.log('[GeoFill] 延迟填写 address:', data.address);
        }
    }, 1500);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFillableElementSignature() {
    return getFillableElements().map((element, index) => [
        index,
        element.tagName,
        element.type,
        element.id,
        element.name,
        element.autocomplete,
        element.getAttribute?.('aria-label') || ''
    ].join(':')).join('|');
}

function getSelectStateSignature() {
    return getFillableElements()
        .filter((element) => element.tagName?.toLowerCase() === 'select')
        .map((element, index) => [
            index,
            element.id,
            element.name,
            element.selectedIndex,
            element.value
        ].join(':')).join('|');
}

/**
 * 在页面上高亮定位字段：滚动到可视区并闪烁红色描边 2.5 秒。
 * target 为诊断描述体 {id, name}（见 describeField）。
 * 穿透 open shadow DOM 查找；找不到时返回 {ok:false}。
 */
function highlightFieldElement(target) {
    const rawId = String(target?.id || '').trim();
    const name = String(target?.name || '').trim();
    // describeField 在无 id/name 时会生成 field_N 占位 id，不可用于查找
    const id = /^field_\d+$/.test(rawId) ? '' : rawId;
    let element = null;

    if (id) {
        const all = querySelectorAllDeep('[id]');
        element = all.find((el) => el.id === id) || null;
    }
    if (!element && name) {
        try {
            const esc = (typeof CSS !== 'undefined' && CSS.escape)
                ? CSS.escape(name)
                : name.replace(/["\\]/g, '\\$&');
            const all = querySelectorAllDeep(`[name="${esc}"]`);
            element = all[0] || null;
        } catch (e) { /* 选择器异常则放弃 */ }
    }
    if (!element || typeof element.scrollIntoView !== 'function') {
        return { ok: false };
    }

    try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
        try { element.scrollIntoView(); } catch (e2) { /* 忽略 */ }
    }

    try {
        const style = element.style;
        if (!style) return { ok: true };
        const prevOutline = style.outline;
        const prevOffset = style.outlineOffset;
        style.outline = '3px solid #ff453a';
        style.outlineOffset = '2px';
        setTimeout(() => {
            style.outline = prevOutline;
            style.outlineOffset = prevOffset;
        }, 2500);
    } catch (e) { /* 忽略 */ }
    return { ok: true };
}
