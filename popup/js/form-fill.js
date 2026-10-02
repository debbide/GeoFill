/**
 * Form filling logic.
 */

function parseAiMappingContent(content) {
    const raw = String(content || '{}');
    let jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    return JSON.parse(jsonStr);
}

function normalizeMappingValue(value) {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return value;
    return '';
}

function buildFieldMetaMap(scanResult) {
    const map = new Map();
    const fields = Array.isArray(scanResult?.fields) ? scanResult.fields : [];

    fields.forEach((field) => {
        const id = String(field?.id || '').trim();
        if (id) map.set(id, field);

        const name = String(field?.name || '').trim();
        if (name && !map.has(name)) map.set(name, field);
    });

    return map;
}

function normalizeFieldText(value) {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-z0-9]+/gi, ' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function compactFieldText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fieldTextParts(fieldMeta, key) {
    return [
        key,
        fieldMeta?.id,
        fieldMeta?.name,
        fieldMeta?.label,
        fieldMeta?.placeholder,
        fieldMeta?.autocomplete,
        fieldMeta?.context,
        fieldMeta?.group
    ].filter(Boolean).join(' ');
}

function hasFieldWord(words, candidates) {
    const padded = ` ${normalizeFieldText(words)} `;
    return candidates.some((candidate) => {
        const normalized = normalizeFieldText(candidate);
        return normalized && padded.includes(` ${normalized} `);
    });
}

function isSensitiveOptionalCodeField(fieldMeta, key) {
    const text = fieldTextParts(fieldMeta, key);
    const compact = compactFieldText(text);
    const words = normalizeFieldText(text);
    return [
        'vpnbypass',
        'bypasstoken',
        'bypasscode',
        'token',
        'invite',
        'invitation',
        'referral',
        'refercode',
        'coupon',
        'promo',
        'promotioncode',
        'discountcode',
        'voucher',
        'giftcard',
        'accesscode',
        'activationcode',
        'licensekey',
        'apikey',
        'secretkey',
        'verificationcode',
        'authcode',
        'otp',
        '2fa',
        'mfa',
        'captcha'
    ].some((keyword) => compact.includes(keyword))
        || hasFieldWord(words, [
            'vpn',
            'bypass',
            'token',
            'invite',
            'invitation',
            'referral',
            'coupon',
            'promo',
            'promotion',
            'discount',
            'voucher',
            'gift card',
            'access code',
            'activation code',
            'license key',
            'api key',
            'secret key',
            'verification code',
            'auth code',
            'otp',
            'captcha'
        ]);
}

function isPasswordFieldMeta(fieldMeta, key) {
    const type = String(fieldMeta?.type || '').toLowerCase();
    const autocomplete = compactFieldText(fieldMeta?.autocomplete || '');
    const text = fieldTextParts(fieldMeta, key);
    const compact = compactFieldText(text);
    const words = normalizeFieldText(text);
    const hasPassword = autocomplete === 'newpassword'
        || autocomplete === 'currentpassword'
        || ['password', 'passwd', 'pwd', 'newpassword', 'confirmpassword', 'passwordconfirmation', 'repeatpassword', 'reenterpassword']
            .some((keyword) => compact.includes(keyword))
        || hasFieldWord(words, ['password', 'pass', 'pwd']);

    if (!hasPassword && type !== 'password') return false;
    if (isSensitiveOptionalCodeField(fieldMeta, key) && !hasPassword) return false;
    return true;
}

function sanitizeAiFormMapping(rawMapping, scanResult) {
    if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
        return {};
    }

    const result = {};
    const fieldMap = buildFieldMetaMap(scanResult);

    for (const [rawKey, rawValue] of Object.entries(rawMapping)) {
        const key = String(rawKey || '').trim();
        if (!key) continue;
        const fieldMeta = fieldMap.get(key);
        if (!fieldMeta && !/^field_\d+$/.test(key)) continue;
        if (fieldMeta && isSensitiveOptionalCodeField(fieldMeta, key) && !isPasswordFieldMeta(fieldMeta, key)) continue;

        let val = normalizeMappingValue(rawValue);
        if (!val) continue;

        val = val
            .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
            .replace(/\u3000/g, ' ')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .trim();

        if (!val) continue;
        result[key] = val.slice(0, 200);
    }

    return result;
}

function sanitizeFormMapping(mapping, scanResult) {
    const fields = Array.isArray(scanResult?.fields) ? scanResult.fields : [];

    Object.keys(mapping).forEach((key) => {
        let val = mapping[key];
        if (typeof val !== 'string') {
            delete mapping[key];
            return;
        }

        const fieldMeta = fields.find((f) => f.id === key || f.name === key);
        if (fieldMeta && isSensitiveOptionalCodeField(fieldMeta, key) && !isPasswordFieldMeta(fieldMeta, key)) {
            delete mapping[key];
            return;
        }

        const label = fieldMeta ? (fieldMeta.label || '').toLowerCase() : '';
        const type = fieldMeta ? (fieldMeta.type || '').toLowerCase() : '';
        const name = fieldMeta ? (fieldMeta.name || '').toLowerCase() : '';
        const lowerKey = key.toLowerCase();

        const isPassword = isPasswordFieldMeta(fieldMeta, key);
        const isEmail = type === 'email' || lowerKey.includes('email') || name.includes('email') || label.includes('email');
        const isPhone = type === 'tel' || lowerKey.includes('phone') || lowerKey.includes('mobile') || name.includes('phone') || label.includes('phone');
        const isZip = lowerKey.includes('zip') || lowerKey.includes('postal') || name.includes('zip') || label.includes('postal');

        if (isPassword) {
            if (currentData.password) {
                val = currentData.password;
            } else if (window.generators?.generatePasswordWithSettings) {
                val = window.generators.generatePasswordWithSettings(userSettings);
            } else {
                val = val.replace(/[^\x20-\x7E]/g, '');
            }
        } else if (isEmail) {
            val = val.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '').toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) && currentData.email) {
                val = currentData.email;
            }
        } else if (isPhone) {
            if (currentData.phone) {
                val = currentData.phone;
            } else if (window.generators?.generatePhone) {
                const country = ipData.country || 'United States';
                val = window.generators.generatePhone(country);
            } else {
                val = val.replace(/[^\d+\-() ]/g, '');
            }
        } else if (isZip) {
            val = val.replace(/[^\dA-Za-z -]/g, '');
            if (!val && currentData.zipCode) {
                val = currentData.zipCode;
            }
        } else {
            val = val.replace(/\s+/g, ' ').trim();
        }

        if (!val) {
            delete mapping[key];
            return;
        }

        mapping[key] = String(val).slice(0, 200);
    });
}

function buildFillResultMessage(result, prefix = '\u586b\u8868\u5b8c\u6210') {
    const filledCount = Number(result?.filledCount || 0);
    const validation = result?.validation || {};
    const diagnostics = result?.diagnostics || {};
    const missingRequired = Array.isArray(validation.missingRequiredFields) ? validation.missingRequiredFields.length : 0;
    const unfilledRequested = Array.isArray(validation.unfilledRequestedFields) ? validation.unfilledRequestedFields.length : 0;
    const pageErrors = Array.isArray(diagnostics.pageErrors) ? diagnostics.pageErrors.length : 0;
    const fieldIssues = Array.isArray(diagnostics.fieldIssues) ? diagnostics.fieldIssues : [];
    const selectMisses = fieldIssues.filter((issue) => issue.reason === 'select_option_not_matched').length;
    const issues = missingRequired + unfilledRequested + pageErrors;

    let message = `${prefix}\uff0c\u5df2\u586b ${filledCount} \u4e2a\u5b57\u6bb5`;
    if (issues > 0) {
        const parts = [];
        if (missingRequired > 0) parts.push(`${missingRequired} \u4e2a\u5fc5\u586b\u9879\u672a\u586b`);
        if (unfilledRequested > 0) {
            if (selectMisses > 0) {
                parts.push(`${unfilledRequested} \u4e2a\u5b57\u6bb5\u672a\u5339\u914d\uff0c\u5176\u4e2d ${selectMisses} \u4e2a\u4e0b\u62c9\u65e0\u5339\u914d\u9879`);
            } else {
                parts.push(`${unfilledRequested} \u4e2a\u5b57\u6bb5\u672a\u5339\u914d`);
            }
        }
        if (pageErrors > 0) parts.push(`\u9875\u9762\u63d0\u793a ${pageErrors} \u6761\u9519\u8bef`);
        message += `\uff0c\u4ecd\u6709 ${parts.join('\u3001')}`;
    }

    return message;
}

function getPopupElements() {
    return typeof elements !== 'undefined' ? elements : null;
}

const FILL_ISSUE_REASON_LABELS = {
    select_option_not_matched: '\u4e0b\u62c9\u6ca1\u6709\u5339\u914d\u9879',
    radio_option_not_matched: '\u5355\u9009\u9879\u672a\u5339\u914d',
    required_field_empty: '\u5fc5\u586b\u9879\u672a\u586b',
    field_not_found: '\u9875\u9762\u6ca1\u6709\u627e\u5230\u5bf9\u5e94\u5b57\u6bb5',
    empty_after_fill: '\u586b\u5199\u540e\u4ecd\u4e3a\u7a7a',
    page_error: '\u9875\u9762\u9519\u8bef\u63d0\u793a',
    unknown: '\u672a\u77e5\u95ee\u9898'
};

function getFillIssueReasonLabel(reason) {
    return FILL_ISSUE_REASON_LABELS[reason] || FILL_ISSUE_REASON_LABELS.unknown;
}

function cleanReportText(value, fallback = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function getIssueFieldLabel(issue) {
    return cleanReportText(
        issue?.label || issue?.field || issue?.target?.label || issue?.target?.name || issue?.target?.id,
        '\u672a\u547d\u540d\u5b57\u6bb5'
    );
}

function getCandidateHint(issue) {
    const candidates = Array.isArray(issue?.candidates) ? issue.candidates : [];
    const labels = candidates
        .map((candidate) => cleanReportText(candidate?.label || candidate?.name || candidate?.id))
        .filter(Boolean)
        .slice(0, 3);

    if (labels.length === 0) return '';
    return `\u5019\u9009\u5b57\u6bb5: ${labels.join(', ')}`;
}

function getRequestedValueHint(issue) {
    const value = cleanReportText(issue?.requestedValue);
    if (!value) return '';
    return `\u60f3\u586b: ${value.slice(0, 80)}`;
}

function getSelectOptionsHint(issue) {
    const candidates = Array.isArray(issue?.candidates) ? issue.candidates : [];
    const options = candidates
        .flatMap((candidate) => Array.isArray(candidate?.options) ? candidate.options : [])
        .map((option) => cleanReportText(option?.text || option?.value || option?.code))
        .filter(Boolean)
        .slice(0, 6);

    if (options.length === 0) return '';
    return `\u9875\u9762\u53ef\u9009: ${options.join(', ')}`;
}

function normalizeFillReportItems(result) {
    const diagnostics = result?.diagnostics || {};
    const validation = result?.validation || {};
    const items = [];
    const seen = new Set();

    function addItem(type, title, detail, keyParts = [], target = null) {
        const cleanTitle = cleanReportText(title, '\u586b\u5199\u95ee\u9898');
        const cleanDetail = cleanReportText(detail);
        const key = [type, cleanTitle, cleanDetail, ...keyParts].join('|').toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ type, title: cleanTitle, detail: cleanDetail, target });
    }

    const fieldIssues = Array.isArray(diagnostics.fieldIssues) ? diagnostics.fieldIssues : [];
    fieldIssues.forEach((issue) => {
        const fieldLabel = getIssueFieldLabel(issue);
        const reasonLabel = getFillIssueReasonLabel(issue?.reason);
        const candidateHint = getCandidateHint(issue);
        const requestedValueHint = getRequestedValueHint(issue);
        const selectOptionsHint = getSelectOptionsHint(issue);
        const detailParts = [reasonLabel];
        if (requestedValueHint) detailParts.push(requestedValueHint);
        if (selectOptionsHint) detailParts.push(selectOptionsHint);
        if (candidateHint) detailParts.push(candidateHint);
        const locateTarget = issue?.target || (Array.isArray(issue?.candidates) ? issue.candidates[0] : null) || null;
        addItem('field', fieldLabel, detailParts.join(' | '), [issue?.reason || ''], locateTarget);
    });

    const reportedRequired = new Set(fieldIssues
        .filter((issue) => issue?.reason === 'required_field_empty')
        .map((issue) => cleanReportText(issue?.field || issue?.label || issue?.target?.id).toLowerCase()));

    (validation.missingRequiredFields || []).forEach((field) => {
        const label = cleanReportText(field?.label || field?.name || field?.id, '\u5fc5\u586b\u5b57\u6bb5');
        const key = cleanReportText(field?.intent || field?.name || field?.id || label).toLowerCase();
        if (reportedRequired.has(key)) return;
        addItem('field', label, FILL_ISSUE_REASON_LABELS.required_field_empty, ['required'], field);
    });

    const reportedUnfilled = new Set(fieldIssues
        .filter((issue) => issue?.kind === 'requested_unfilled')
        .map((issue) => cleanReportText(issue?.field || issue?.label).toLowerCase()));

    (validation.unfilledRequestedFields || []).forEach((issue) => {
        const field = cleanReportText(issue?.field, '\u672a\u5339\u914d\u5b57\u6bb5');
        if (reportedUnfilled.has(field.toLowerCase())) return;
        const unfilledTarget = Array.isArray(issue?.candidates) ? issue.candidates[0] : null;
        addItem('field', field, FILL_ISSUE_REASON_LABELS.field_not_found, ['unfilled'], unfilledTarget || null);
    });

    const pageErrors = Array.isArray(diagnostics.pageErrors) ? diagnostics.pageErrors : [];
    pageErrors.forEach((error) => {
        const fieldLabel = cleanReportText(error?.field?.label || error?.field?.name || error?.field?.id);
        const title = fieldLabel || FILL_ISSUE_REASON_LABELS.page_error;
        const detail = cleanReportText(error?.text, FILL_ISSUE_REASON_LABELS.page_error);
        addItem('page', title, detail, [error?.source || '']);
    });

    return items.slice(0, 8);
}

function hasFillResultIssues(result) {
    const diagnostics = result?.diagnostics || {};
    const validation = result?.validation || {};
    const hasDiagnosticsIssues = diagnostics.isClean === false
        || (Array.isArray(diagnostics.fieldIssues) && diagnostics.fieldIssues.length > 0)
        || (Array.isArray(diagnostics.pageErrors) && diagnostics.pageErrors.length > 0);
    const hasValidationIssues = validation.isComplete === false
        || (Array.isArray(validation.missingRequiredFields) && validation.missingRequiredFields.length > 0)
        || (Array.isArray(validation.unfilledRequestedFields) && validation.unfilledRequestedFields.length > 0);
    return hasDiagnosticsIssues || hasValidationIssues;
}

function buildFillReport(result, prefix = '\u586b\u8868\u5b8c\u6210') {
    const filledCount = Number(result?.filledCount || 0);
    const diagnostics = result?.diagnostics || {};
    const validation = result?.validation || {};
    const summary = diagnostics.summary || {};
    const items = normalizeFillReportItems(result);
    const hasIssues = hasFillResultIssues(result);
    const issueCount = items.length || Number(summary.fieldIssueCount || 0) + Number(summary.pageErrorCount || 0);
    const missingRequired = Array.isArray(validation.missingRequiredFields) ? validation.missingRequiredFields.length : Number(summary.missingRequiredCount || 0);
    const unfilledRequested = Array.isArray(validation.unfilledRequestedFields) ? validation.unfilledRequestedFields.length : Number(summary.unfilledRequestedCount || 0);
    const pageErrors = Array.isArray(diagnostics.pageErrors) ? diagnostics.pageErrors.length : Number(summary.pageErrorCount || 0);
    const parts = [`\u5df2\u586b ${filledCount} \u4e2a\u5b57\u6bb5`];

    if (missingRequired > 0) parts.push(`${missingRequired} \u4e2a\u5fc5\u586b\u672a\u586b`);
    if (unfilledRequested > 0) parts.push(`${unfilledRequested} \u4e2a\u5b57\u6bb5\u672a\u5339\u914d`);
    if (pageErrors > 0) parts.push(`${pageErrors} \u6761\u9875\u9762\u9519\u8bef`);
    if (!hasIssues) parts.push('\u672a\u53d1\u73b0\u660e\u663e\u95ee\u9898');

    return {
        hasIssues,
        issueCount,
        title: hasIssues ? '\u586b\u5199\u62a5\u544a\uff1a\u6709\u9700\u68c0\u67e5\u7684\u9879' : '\u586b\u5199\u62a5\u544a\uff1a\u672a\u53d1\u73b0\u95ee\u9898',
        summary: `${prefix}\uff0c${parts.join('\uff0c')}`,
        items
    };
}

function hideFillReport() {
    const popupElements = getPopupElements();
    if (!popupElements?.fillReport) return;
    popupElements.fillReport.hidden = true;
    popupElements.fillReport.classList.remove('is-clean');
    if (popupElements.fillReportList) popupElements.fillReportList.textContent = '';
}

function renderFillReport(result, prefix = '\u586b\u8868\u5b8c\u6210') {
    const popupElements = getPopupElements();
    if (!popupElements?.fillReport) return buildFillReport(result, prefix);

    const report = buildFillReport(result, prefix);
    popupElements.fillReport.hidden = false;
    popupElements.fillReport.classList.toggle('is-clean', !report.hasIssues);

    if (popupElements.fillReportTitle) popupElements.fillReportTitle.textContent = report.title;
    if (popupElements.fillReportSummary) popupElements.fillReportSummary.textContent = report.summary;
    if (popupElements.fillReportList) {
        popupElements.fillReportList.textContent = '';
        report.items.forEach((item) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'fill-report-item';

            const titleEl = document.createElement('div');
            titleEl.className = 'fill-report-item-title';
            titleEl.textContent = item.title;

            const detailEl = document.createElement('div');
            detailEl.className = 'fill-report-item-detail';
            detailEl.textContent = item.detail;

            itemEl.appendChild(titleEl);
            itemEl.appendChild(detailEl);
            if (item.target && (item.target.id || item.target.name)) {
                const locateBtn = document.createElement('button');
                locateBtn.className = 'fill-report-locate';
                locateBtn.textContent = '\uD83D\uDCCD \u5B9A\u4F4D';
                locateBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    highlightFieldInPage(item.target);
                });
                itemEl.appendChild(locateBtn);
            }
            popupElements.fillReportList.appendChild(itemEl);
        });
    }

    return report;
}

function showFillResult(result, prefix = '\u586b\u8868\u5b8c\u6210') {
    const message = buildFillResultMessage(result, prefix);
    const report = renderFillReport(result, prefix);
    showToast(message);
    return report;
}

/**
 * 在页面上定位高亮字段（向各 frame 广播，命中的 frame 负责滚动+闪烁）。
 */
async function highlightFieldInPage(target) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        const results = await sendMessageToTab(tab.id, { action: 'highlightField', target }, { broadcast: true });
        const list = Array.isArray(results) ? results : [results];
        if (!list.some((r) => r && r.ok)) {
            showToast('\u672a\u5728\u9875\u9762\u4e0a\u627e\u5230\u8be5\u5b57\u6bb5');
        }
    } catch (e) {
        log.error('Highlight field failed:', e);
        showToast('\u5b9a\u4f4d\u5931\u8d25: ' + e.message);
    }
}

const STEP_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * popup 打开时检查：当前 tab 是否有多步骤待办（上一步填完后出现了新字段）。
 * 有则把填写按钮文案改成"继续填写"，点一次即可补上。
 */
async function checkPendingStep() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        const stored = await chrome.storage.local.get('geoFillStepPending');
        const pending = stored && stored.geoFillStepPending;
        if (pending && Number(pending.tabId) === tab.id &&
            Date.now() - Number(pending.ts || 0) < STEP_PENDING_MAX_AGE_MS &&
            elements.fillForm && !elements.fillForm.dataset.stepMode) {
            elements.fillForm.dataset.stepMode = '1';
            elements.fillForm.dataset.originalText = elements.fillForm.textContent;
            elements.fillForm.textContent = `\u27A1\uFE0F \u7EE7\u7EED\u586B\u5199 (${pending.count} \u4E2A\u65B0\u5B57\u6BB5)`;
            showToast('\u68C0\u6D4B\u5230\u8868\u5355\u65B0\u6B65\u9AA4\uFF0C\u70B9\u300C\u7EE7\u7EED\u586B\u5199\u300D\u8865\u4E0A');
        }
    } catch (e) { /* 忽略 */ }
}

/**
 * 开始填写时清掉 badge 和待办，并恢复按钮文案。
 */
function clearStepPending() {
    try {
        const p = (async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.runtime.sendMessage({ action: 'clearStepBadge', tabId: tab.id });
            }
            await chrome.storage.local.remove('geoFillStepPending');
        })();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* 忽略 */ }
    if (elements.fillForm && elements.fillForm.dataset.stepMode) {
        delete elements.fillForm.dataset.stepMode;
        if (elements.fillForm.dataset.originalText) {
            elements.fillForm.textContent = elements.fillForm.dataset.originalText;
            delete elements.fillForm.dataset.originalText;
        }
    }
}

/**
 * 合并多 frame 的 scanForm 结果（主 frame + iframe）。
 */
function mergeScanResults(results) {
    const list = Array.isArray(results) ? results : [results];
    const merged = { fields: [], pageContext: null };
    for (const r of list) {
        if (!r) continue;
        if (Array.isArray(r.fields)) merged.fields.push(...r.fields);
        if (!merged.pageContext && r.pageContext) merged.pageContext = r.pageContext;
    }
    return merged;
}

/**
 * 合并多 frame 的 fill 结果：filledCount 累加，各类问题列表拼接。
 */
function mergeFillResults(results) {
    const list = Array.isArray(results) ? results : [results];
    const merged = {
        filledCount: 0,
        validation: { missingRequiredFields: [], unfilledRequestedFields: [] },
        diagnostics: { pageErrors: [], fieldIssues: [] }
    };
    for (const r of list) {
        if (!r || typeof r !== 'object') continue;
        merged.filledCount += Number(r.filledCount || 0);
        for (const k of ['missingRequiredFields', 'unfilledRequestedFields']) {
            const arr = r.validation && r.validation[k];
            if (Array.isArray(arr)) merged.validation[k].push(...arr);
        }
        for (const k of ['pageErrors', 'fieldIssues']) {
            const arr = r.diagnostics && r.diagnostics[k];
            if (Array.isArray(arr)) merged.diagnostics[k].push(...arr);
        }
        // 透传首个结果的状态等标量字段
        if (merged.status === undefined && r.status !== undefined) merged.status = r.status;
    }
    return merged;
}

function closePopupWhenClean(report) {
    if (report?.hasIssues) return;
    if (typeof window !== 'undefined' && typeof window.close === 'function') {
        window.close();
    }
}

async function fillFormInPage() {
    clearStepPending();
    updateCurrentDataFromInputs();
    const btn = elements.fillForm;
    const originalText = btn.textContent;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const useAI = elements.useAIToggle?.checked && userSettings.openaiKey;
        if (useAI) {
            btn.textContent = '\u5904\u7406\u4e2d...';
            btn.disabled = true;

            const scanResult = mergeScanResults(await sendMessageToTab(tab.id, { action: 'scanForm' }, { broadcast: true }));
            if (!scanResult || !scanResult.fields || scanResult.fields.length === 0) {
                throw new Error('\u672a\u627e\u5230\u53ef\u89c1\u8868\u5355\u5b57\u6bb5');
            }

            const prompt = buildAIFormPrompt(scanResult);
            const apiUrl = normalizeApiUrl(userSettings.openaiBaseUrl);

            const granted = await ensureHostPermission(apiUrl);
            if (!granted) {
                throw new Error('\u672a\u6388\u4e88 AI \u63a5\u53e3\u7ad9\u70b9\u6743\u9650');
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userSettings.openaiKey}`
                },
                body: JSON.stringify({
                    model: userSettings.openaiModel,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that fills forms based on user profiles.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error (${response.status}): ${text.slice(0, 100)}...`);
            }

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`API \u8fd4\u56de\u975e JSON \u6570\u636e: ${text.slice(0, 80)}...`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '{}';

            const rawMapping = parseAiMappingContent(content);
            const mapping = sanitizeAiFormMapping(rawMapping, scanResult);
            sanitizeFormMapping(mapping, scanResult);

            btn.textContent = '\u586b\u5199\u4e2d...';
            const result = mergeFillResults(await sendMessageToTab(tab.id, { action: 'fillFormSmart', data: mapping }, { broadcast: true }));

            const report = showFillResult(result, 'AI \u667a\u80fd\u586b\u8868\u5b8c\u6210');
            saveToHistory();
            closePopupWhenClean(report);
        } else {
            const result = mergeFillResults(await sendMessageToTab(tab.id, { action: 'fillForm', data: currentData }, { broadcast: true }));
            saveToHistory();
            const report = showFillResult(result);
            closePopupWhenClean(report);
        }
    } catch (error) {
        log.error('Fill form failed:', error);
        showToast('\u586b\u5199\u5931\u8d25: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function buildAIFormPrompt(scanResult) {
    return `
You are an advanced AI Form Assistant. Your goal is to fill a web form intelligently, acting as the Persona defined below.

Current User Profile: ${JSON.stringify(currentData)}
Persona Description: ${userSettings.aiPersona || 'None'}

Page Context:
Title: ${scanResult.pageContext.title}
Description: ${scanResult.pageContext.description}
URL: ${scanResult.pageContext.url}

Form Fields Found:
${JSON.stringify(scanResult.fields)}

Instructions:
1. Analyze context and field intent.
2. Respect required fields and avoid intrusive optional fields when reasonable.
3. Keep locale-correct formats (name/address/zip/phone).
4. Use ASCII for password/email/phone/zip and numeric-only fields.
5. Return only JSON mapping from field id to value.

Output format example:
{
  "field_1": "John",
  "field_2": "Doe"
}
`;
}

async function fillFormNormalInPage() {
    clearStepPending();
    updateCurrentDataFromInputs();
    const btn = elements.fillForm;
    const originalText = btn.textContent;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const result = mergeFillResults(await sendMessageToTab(tab.id, { action: 'fillForm', data: currentData }, { broadcast: true }));
        saveToHistory();
        const report = showFillResult(result, '\u666e\u901a\u586b\u8868\u5b8c\u6210');
        closePopupWhenClean(report);
    } catch (error) {
        log.error('Normal fill failed:', error);
        showToast('\u586b\u5199\u5931\u8d25: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
