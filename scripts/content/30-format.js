/**
 * GeoFill content script - 30-format.js
 * 值格式化与输入模拟：邮编/生日/电话格式化、原生 setter
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
function getPositiveMaxLength(element) {
    const direct = Number(element.maxLength);
    const attr = Number(element.getAttribute?.('maxlength'));
    const value = Number.isFinite(direct) && direct > 0
        ? direct
        : Number.isFinite(attr) && attr > 0
            ? attr
            : 0;
    return value > 0 ? value : 0;
}

function getElementPatternText(element) {
    return String(element.pattern || element.getAttribute?.('pattern') || '');
}

function getElementInputMode(element) {
    return String(element.inputMode || element.getAttribute?.('inputmode') || '').toLowerCase();
}

function stripNonDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function compactAlphaNumeric(value) {
    return String(value || '').replace(/[^a-zA-Z0-9]/g, '');
}

function elementPrefersDigits(element) {
    const type = String(element.type || '').toLowerCase();
    const inputMode = getElementInputMode(element);
    const pattern = getElementPatternText(element);
    return type === 'number'
        || inputMode === 'numeric'
        || inputMode === 'decimal'
        || /(?:\\d|\[0-9\]|\[\\d\])/.test(pattern);
}

function elementHintsAtPlusPrefix(element) {
    const text = [
        element.placeholder,
        element.getAttribute?.('placeholder'),
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.name,
        element.id,
        getLabelText(element)
    ].filter(Boolean).join(' ');
    return /\+/.test(text) || /\\\+/.test(getElementPatternText(element));
}

function trimToMaxLength(element, value) {
    const maxLength = getPositiveMaxLength(element);
    const text = String(value || '');
    return maxLength && text.length > maxLength ? text.slice(0, maxLength) : text;
}

function formatPostalCodeForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const compact = compactAlphaNumeric(raw);
    const maxLength = getPositiveMaxLength(element);

    if (elementPrefersDigits(element) && digits) {
        return trimToMaxLength(element, digits);
    }

    if (maxLength && compact && compact.length <= maxLength && compact.length < raw.length) {
        return compact;
    }

    return trimToMaxLength(element, raw);
}

function formatBirthdayForInput(element, value) {
    const raw = String(value || '').trim();
    const type = String(element.type || '').toLowerCase();
    if (type === 'date') return raw;

    const parts = splitBirthdayParts(raw);
    if (!parts.year || !parts.month || !parts.day) return trimToMaxLength(element, raw);

    const placeholder = normalizeIntentText(element.placeholder || element.getAttribute?.('placeholder') || '');
    const pattern = getElementPatternText(element);
    const maxLength = getPositiveMaxLength(element);
    const yyyymmdd = `${parts.year}${parts.month}${parts.day}`;

    if (maxLength === 8 || elementPrefersDigits(element) || /(?:\\d|\[0-9\])\{8\}/.test(pattern) || placeholder.includes('yyyymmdd')) {
        return yyyymmdd;
    }

    if (placeholder.includes('mm/dd') || placeholder.includes('mm-dd')) {
        return trimToMaxLength(element, `${parts.month}/${parts.day}/${parts.year}`);
    }

    if (placeholder.includes('dd/mm') || placeholder.includes('dd-mm')) {
        return trimToMaxLength(element, `${parts.day}/${parts.month}/${parts.year}`);
    }

    return trimToMaxLength(element, raw);
}

function formatPhoneForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const national = splitPhoneParts(raw).national || digits;
    const maxLength = getPositiveMaxLength(element);
    const type = String(element.type || '').toLowerCase();
    const autocomplete = compactIntentText(element.autocomplete || '');
    const hintText = normalizeIntentText([
        element.placeholder,
        element.getAttribute?.('placeholder'),
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.name,
        element.id,
        getLabelText(element)
    ].filter(Boolean).join(' '));

    if (autocomplete === 'telnational' && national) {
        return trimToMaxLength(element, national);
    }

    if (autocomplete === 'telcountrycode') {
        const code = splitPhoneParts(raw).countryCode || raw;
        return formatPhoneCountryCodeForInput(element, code);
    }

    if (maxLength && national && national.length <= maxLength && raw.length > maxLength) {
        return trimToMaxLength(element, national);
    }

    if ((elementPrefersDigits(element) || type === 'number') && digits) {
        if (maxLength && national && national.length <= maxLength) {
            return trimToMaxLength(element, national);
        }
        return trimToMaxLength(element, digits);
    }

    if (hintText.includes('countrycode') || hintText.includes('dialcode') || hintText.includes('callingcode')) {
        return formatPhoneCountryCodeForInput(element, splitPhoneParts(raw).countryCode || raw);
    }

    if ((hintText.includes('national') || hintText.includes('without country') || hintText.includes('no country')) && national) {
        return trimToMaxLength(element, national);
    }

    return trimToMaxLength(element, raw);
}

function formatPhoneCountryCodeForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const maxLength = getPositiveMaxLength(element);
    const withPlus = raw.startsWith('+') ? raw : `+${digits || raw}`;

    if (elementPrefersDigits(element) || String(element.type || '').toLowerCase() === 'number') {
        return trimToMaxLength(element, digits);
    }

    if (elementHintsAtPlusPrefix(element) && (!maxLength || withPlus.length <= maxLength)) {
        return trimToMaxLength(element, withPlus);
    }

    if (maxLength && withPlus.length > maxLength && digits.length <= maxLength) {
        return digits;
    }

    return trimToMaxLength(element, withPlus);
}

function formatValueForField(element, value, intent) {
    if (!element || element.tagName?.toLowerCase() === 'select') return String(value || '');

    switch (intent) {
        case 'zipCode':
            return formatPostalCodeForInput(element, value);
        case 'birthday':
            return formatBirthdayForInput(element, value);
        case 'phone':
        case 'phoneArea':
        case 'phonePrefix':
        case 'phoneLine':
            return formatPhoneForInput(element, value);
        case 'phoneCountryCode':
            return formatPhoneCountryCodeForInput(element, value);
        default:
            return String(value || '');
    }
}

function simulateFieldInput(element, value, intent) {
    simulateInput(element, formatValueForField(element, value, intent));
}

function dispatchValueChangeEvents(element) {
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * 模拟用户输入（增强版，支持 React/Vue 等框架）
 */
function simulateInput(element, value) {
    // 聚焦元素
    element.focus();

    // 对于 React 等框架，需要使用原生 setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    )?.set;

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    // 清空并设置值
    if (element.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }

    // 触发各种事件以确保表单验证和框架状态更新
    dispatchValueChangeEvents(element);

    // 失焦触发验证
    element.blur();
}

/**
 * 处理 select 元素（增强版）
 */