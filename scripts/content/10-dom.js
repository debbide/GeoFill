/**
 * GeoFill content script - 10-dom.js
 * DOM 基础：字段选择器、label 解析、可见性/禁用判断
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
/**
 * Content Script - 表单自动填写（增强版）
 */

// 常见表单字段选择器映射（扩展版）
// 常见表单字段选择器映射（扩展版）
const FIELD_SELECTORS = {
    ...window.GeoFillSelectors.common
};

// 标签关键字映射
const LABEL_KEYWORDS = {
    ...window.GeoFillSelectors.commonLabels
};

// 合并各国注册的选择器扩展（替代原来硬编码的 japan 展开）
if (typeof GeoFillCountryExtensions !== 'undefined') {
    for (const extCountry of GeoFillCountryExtensions.countries()) {
        const ext = GeoFillCountryExtensions.get(extCountry);
        if (ext && ext.selectors) Object.assign(FIELD_SELECTORS, ext.selectors);
        if (ext && ext.selectorLabels) Object.assign(LABEL_KEYWORDS, ext.selectorLabels);
    }
}

// 用于检测全名字段（需要拆分）
const FULLNAME_SELECTORS = window.GeoFillSelectors.fullNames || [];

function getTextContent(element) {
    return String(element?.innerText || element?.textContent || '').trim();
}

function getLabelElementsFor(element) {
    const labels = [];

    Array.from(element.labels || []).forEach((label) => {
        if (label && !labels.includes(label)) labels.push(label);
    });

    const id = element.id;
    if (!id) return labels;

    const escapedId = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    try {
        const label = document.querySelector(`label[for="${escapedId}"]`);
        if (label && !labels.includes(label)) labels.push(label);
    } catch (e) {
        // 部分框架生成的 id 可能包含特殊字符，选择器失败时走 label 全量兜底。
    }

    try {
        Array.from(document.querySelectorAll('label')).forEach((label) => {
            if (label?.getAttribute?.('for') === id && !labels.includes(label)) {
                labels.push(label);
            }
        });
    } catch (e) {
        // 忽略不可用的 DOM API。
    }

    return labels;
}

function getTextByElementIds(value) {
    return String(value || '')
        .split(/\s+/)
        .map((id) => getTextContent(document.getElementById(id)))
        .filter(Boolean)
        .join(' ');
}

/**
 * 获取元素的标签文本
 */
function getLabelText(element) {
    let labelText = '';
    const id = element.id;

    // 1. 查找关联 label（支持 input.labels 和特殊 id 的 label[for]）
    labelText += getLabelElementsFor(element).map(getTextContent).join(' ');

    // 2. 查找父级 <label>
    const parentLabel = element.closest('label');
    if (parentLabel) labelText += getTextContent(parentLabel);

    // 3. 查找 aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) labelText += ariaLabel;

    // 4. 查找 aria-labelledby / aria-describedby
    const labelledByText = getTextByElementIds(element.getAttribute('aria-labelledby'));
    if (labelledByText) labelText += labelledByText;

    const describedByText = getTextByElementIds(element.getAttribute('aria-describedby'));
    if (describedByText) labelText += describedByText;

    // 5. title 和 placeholder
    const title = element.getAttribute('title');
    if (title) labelText += title;

    const placeholder = element.getAttribute('placeholder');
    if (placeholder) labelText += placeholder;

    // 6. 查找前置文本节点 (简单的启发式)
    // 很多表格布局中，label 在 input 的前一个 td 或兄弟节点
    let previous = element.previousElementSibling;
    while (previous) {
        if (previous.tagName === 'LABEL' || previous.tagName === 'SPAN' || previous.tagName === 'TD' || previous.tagName === 'TH') {
            labelText += getTextContent(previous);
            break;
        }
        previous = previous.previousElementSibling;
    }

    // 7. Shadow DOM：元素在 shadow root 内时，宿主链的 id/class 常带有字段语义
    if (isInsideShadowDom(element)) {
        labelText += ' ' + getShadowHostContextText(element);
    }

    return labelText.toLowerCase().replace(/\s+/g, '');
}

/**
 * 通过标签文本查找字段
 */
function findFieldByLabel(fieldName) {
    const keywords = LABEL_KEYWORDS[fieldName];
    if (!keywords || keywords.length === 0) return null;

    // 获取所有可见的输入框
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));

    for (const input of inputs) {
        if (!isFillableElement(input) || !isCandidateSafeForField(input, fieldName)) continue;

        const text = getLabelText(input);
        if (!text) continue;

        for (const keyword of keywords) {
            // 简单的包含匹配；命中后仍需通过 intent 复核，避免宽标签误填。
            if (text.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
                return input;
            }
        }
    }
    return null;
}

function getCompatibleIntentsForField(fieldName) {
    const compatible = {
        address: ['addressLine1', 'addressLine2'],
        birthday: ['birthday', 'birthYear', 'birthMonth', 'birthDay'],
        phone: ['phone', 'phoneArea', 'phonePrefix', 'phoneLine', 'phoneCountryCode']
    };
    return compatible[fieldName] || [fieldName];
}

function isCandidateSafeForField(element, fieldName) {
    if (!element || isTokenOrOptionalCodeField(element)) return false;
    const intent = classifyFieldIntent(element);
    if (!intent) return true;
    return getCompatibleIntentsForField(fieldName).includes(intent);
}

/**
 * 查找表单字段（单个）
 */
function findField(fieldName) {
    // 1. 优先尝试 CSS 选择器，但需要 intent 复核，避免宽泛选择器误命中。
    const selectors = FIELD_SELECTORS[fieldName] || [];
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && isFillableElement(element) && isCandidateSafeForField(element, fieldName)) {
                return element;
            }
        } catch (e) {
            // 忽略无效选择器
        }
    }

    // 2. 尝试智能标签匹配
    return findFieldByLabel(fieldName);
}


/**
 * 查找全名字段
 */
function findFullNameField() {
    for (const selector of FULLNAME_SELECTORS) {
        try {
            const element = document.querySelector(selector);
            if (element && isFillableElement(element)) {
                return element;
            }
        } catch (e) {
            console.log('[GeoFill] Selector error:', selector, e);
        }
    }
    return findFieldByIntent('fullName');
}

/**
 * 查找所有匹配的字段（用于密码等需要填写多次的字段）
 */
function findAllFields(fieldName) {
    const selectors = FIELD_SELECTORS[fieldName] || [];
    const elements = [];

    for (const selector of selectors) {
        try {
            const allElements = document.querySelectorAll(selector);
            allElements.forEach(element => {
                if (isFillableElement(element)) {
                    // 避免重复添加
                    if (!elements.includes(element)) {
                        elements.push(element);
                    }
                }
            });
        } catch (e) {
            console.log('[GeoFill] Selector error:', selector, e);
        }
    }

    return elements;
}

/**
 * 检查元素是否可见
 */
function isVisible(element) {
    if (!element) return false;

    if (element.hidden || element.getAttribute?.('hidden') !== '' && element.getAttribute?.('hidden') != null) {
        return false;
    }
    if (element.getAttribute?.('aria-hidden') === 'true') {
        return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0;
}

function isDisabledByContainer(element) {
    return Boolean(
        element.closest?.('[disabled]')
        || element.closest?.('[aria-disabled="true"]')
        || element.closest?.('[inert]')
    );
}

function isReadOnlyLike(element) {
    return Boolean(
        element.readOnly
        || element.getAttribute?.('readonly') !== '' && element.getAttribute?.('readonly') != null
        || element.getAttribute?.('aria-readonly') === 'true'
    );
}

function isDisabledLike(element) {
    return Boolean(
        element.disabled
        || element.getAttribute?.('disabled') !== '' && element.getAttribute?.('disabled') != null
        || element.getAttribute?.('aria-disabled') === 'true'
        || isDisabledByContainer(element)
    );
}

function hasOptionalTokenIntent(element) {
    if (!element) return false;
    const text = [
        element.id,
        element.name,
        element.placeholder,
        element.className,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.getAttribute?.('data-field'),
        element.getAttribute?.('data-testid'),
        element.getAttribute?.('data-test'),
        getLabelText(element)
    ].filter(Boolean).join(' ');
    const signature = compactIntentText(text);
    const intentWords = normalizeIntentWords(text);

    return hasAnyIntent(signature, [
        'vpnbypass',
        'bypasstoken',
        'bypasscode',
        'invitecode',
        'invitationcode',
        'referralcode',
        'couponcode',
        'promocode',
        'promotioncode',
        'discountcode',
        'vouchercode',
        'giftcard',
        'accesscode',
        'activationcode',
        'licensekey',
        'apikey',
        'secretkey',
        'verificationcode',
        'authcode',
        'otpauth',
        'captcha'
    ])
        || hasIntentWord(intentWords, [
            'vpn bypass',
            'bypass token',
            'bypass code',
            'invite code',
            'invitation code',
            'referral code',
            'coupon code',
            'promo code',
            'promotion code',
            'discount code',
            'voucher code',
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

function shouldSkipAutoFillElement(element) {
    return hasOptionalTokenIntent(element);
}

function isFillableElement(element) {
    return Boolean(element && isVisible(element) && !isDisabledLike(element) && !isReadOnlyLike(element) && !shouldSkipAutoFillElement(element));
}

/* ==========================================================================
 * Shadow DOM 支持
 * --------------------------------------------------------------------------
 * 现代站点大量使用 Web Components，表单字段可能藏在 open shadow root 里。
 * closed shadow root 按浏览器设计无法穿透，会被跳过（接受此限制）。
 * ========================================================================== */

const FILLABLE_ELEMENTS_SELECTOR =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';

/**
 * 穿透 open shadow root 的深度查询。
 * @param {string} selector CSS 选择器
 * @param {Document|ShadowRoot|Element} root 起始根节点，默认 document
 * @returns {Element[]} 去重后的匹配元素
 */
function querySelectorAllDeep(selector, root = document) {
    const results = [];
    const visited = new Set();

    const walk = (node) => {
        if (!node || visited.has(node)) return;
        visited.add(node);

        try {
            if (typeof node.querySelectorAll === 'function') {
                for (const el of node.querySelectorAll(selector)) {
                    results.push(el);
                }
            }
        } catch (e) {
            // detached 节点等情况忽略
        }

        // 递归进入所有后代元素的 open shadow root
        let descendants = [];
        try {
            descendants = typeof node.querySelectorAll === 'function'
                ? Array.from(node.querySelectorAll('*'))
                : [];
        } catch (e) { /* 忽略 */ }
        for (const el of descendants) {
            if (el.shadowRoot) {
                walk(el.shadowRoot);
            }
        }
    };

    walk(root);
    return results;
}

/**
 * 跨 shadow 边界取父元素：普通情况返回 parentElement；
 * 若已到 shadow root 顶部，则返回宿主元素（host）。
 * @returns {Element|null}
 */
function getComposedParent(element) {
    if (!element) return null;
    if (element.parentElement) return element.parentElement;
    try {
        const root = element.getRootNode && element.getRootNode();
        if (root && root instanceof ShadowRoot && root.host) {
            return root.host;
        }
    } catch (e) { /* 忽略 */ }
    return null;
}

/**
 * 元素是否位于 shadow DOM 内。
 */
function isInsideShadowDom(element) {
    try {
        const root = element && element.getRootNode && element.getRootNode();
        return Boolean(root && root instanceof ShadowRoot);
    } catch (e) {
        return false;
    }
}

/**
 * 收集 shadow 宿主链上的上下文文本（用于意图识别补强）。
 * 例如 <my-input id="email-field"> 内的 input，宿主的 id/class 常带有语义。
 */
function getShadowHostContextText(element) {
    const parts = [];
    let current = element;
    try {
        while (current) {
            const root = current.getRootNode && current.getRootNode();
            if (!(root instanceof ShadowRoot) || !root.host) break;
            const host = root.host;
            const tag = (host.tagName || '').toLowerCase();
            if (tag && !tag.includes('-')) break; // 非自定义元素就停
            for (const attr of ['id', 'name', 'aria-label', 'placeholder', 'label']) {
                const v = host.getAttribute && host.getAttribute(attr);
                if (v) parts.push(v);
            }
            const cls = host.getAttribute && host.getAttribute('class');
            if (cls) parts.push(cls);
            current = host;
        }
    } catch (e) { /* 忽略 */ }
    return parts.join(' ');
}
