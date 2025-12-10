/**
 * Content Script - 表单自动填写
 */

// 常见表单字段选择器映射
const FIELD_SELECTORS = {
    firstName: [
        'input[name*="first" i]',
        'input[name*="fname" i]',
        'input[id*="first" i]',
        'input[placeholder*="first" i]',
        'input[autocomplete="given-name"]',
        'input[name*="given" i]'
    ],
    lastName: [
        'input[name*="last" i]',
        'input[name*="lname" i]',
        'input[name*="surname" i]',
        'input[id*="last" i]',
        'input[placeholder*="last" i]',
        'input[autocomplete="family-name"]',
        'input[name*="family" i]'
    ],
    username: [
        'input[name*="user" i]',
        'input[name*="login" i]',
        'input[name*="account" i]',
        'input[id*="user" i]',
        'input[placeholder*="user" i]',
        'input[autocomplete="username"]'
    ],
    email: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[name*="mail" i]',
        'input[id*="email" i]',
        'input[placeholder*="email" i]',
        'input[autocomplete="email"]'
    ],
    password: [
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[name*="pwd" i]',
        'input[id*="pass" i]',
        'input[autocomplete="new-password"]',
        'input[autocomplete="current-password"]'
    ],
    phone: [
        'input[type="tel"]',
        'input[name*="phone" i]',
        'input[name*="mobile" i]',
        'input[name*="tel" i]',
        'input[id*="phone" i]',
        'input[placeholder*="phone" i]',
        'input[autocomplete="tel"]'
    ],
    address: [
        'input[name*="address" i]',
        'input[name*="street" i]',
        'input[id*="address" i]',
        'input[placeholder*="address" i]',
        'input[autocomplete="street-address"]',
        'input[autocomplete="address-line1"]',
        'textarea[name*="address" i]'
    ],
    city: [
        'input[name*="city" i]',
        'input[id*="city" i]',
        'input[placeholder*="city" i]',
        'input[autocomplete="address-level2"]'
    ],
    zipCode: [
        'input[name*="zip" i]',
        'input[name*="postal" i]',
        'input[name*="postcode" i]',
        'input[id*="zip" i]',
        'input[placeholder*="zip" i]',
        'input[autocomplete="postal-code"]'
    ],
    country: [
        'input[name*="country" i]',
        'input[id*="country" i]',
        'select[name*="country" i]',
        'select[id*="country" i]',
        'input[autocomplete="country-name"]'
    ]
};

/**
 * 查找表单字段（单个）
 */
function findField(fieldName) {
    const selectors = FIELD_SELECTORS[fieldName] || [];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && isVisible(element) && !element.disabled && !element.readOnly) {
            return element;
        }
    }

    return null;
}

/**
 * 查找所有匹配的字段（用于密码等需要填写多次的字段）
 */
function findAllFields(fieldName) {
    const selectors = FIELD_SELECTORS[fieldName] || [];
    const elements = [];

    for (const selector of selectors) {
        const allElements = document.querySelectorAll(selector);
        allElements.forEach(element => {
            if (isVisible(element) && !element.disabled && !element.readOnly) {
                // 避免重复添加
                if (!elements.includes(element)) {
                    elements.push(element);
                }
            }
        });
    }

    return elements;
}

/**
 * 检查元素是否可见
 */
function isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.offsetParent !== null;
}

/**
 * 模拟用户输入
 */
function simulateInput(element, value) {
    // 聚焦元素
    element.focus();

    // 清空现有值
    element.value = '';

    // 触发输入事件
    element.value = value;

    // 触发各种事件以确保表单验证正常工作
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    // 失焦触发验证
    element.blur();
}

/**
 * 处理 select 元素
 */
function fillSelect(element, value) {
    const options = element.options;

    for (let i = 0; i < options.length; i++) {
        const optionText = options[i].text.toLowerCase();
        const optionValue = options[i].value.toLowerCase();
        const searchValue = value.toLowerCase();

        if (optionText.includes(searchValue) || optionValue.includes(searchValue)) {
            element.selectedIndex = i;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    return false;
}

/**
 * 填写表单
 */
function fillForm(data) {
    let filledCount = 0;
    const results = {};

    for (const [fieldName, value] of Object.entries(data)) {
        if (!value) continue;

        // 密码字段需要填写所有匹配项（密码 + 确认密码）
        if (fieldName === 'password') {
            const elements = findAllFields('password');
            if (elements.length > 0) {
                elements.forEach(element => {
                    simulateInput(element, value);
                    filledCount++;
                });
                results[fieldName] = `filled ${elements.length} field(s)`;
            } else {
                results[fieldName] = 'not found';
            }
            continue;
        }

        const element = findField(fieldName);

        if (element) {
            if (element.tagName.toLowerCase() === 'select') {
                if (fillSelect(element, value)) {
                    filledCount++;
                    results[fieldName] = 'filled';
                }
            } else {
                simulateInput(element, value);
                filledCount++;
                results[fieldName] = 'filled';
            }
        } else {
            results[fieldName] = 'not found';
        }
    }

    console.log('[GeoFill] 填写完成:', filledCount, '个字段', results);
    return { filledCount, results };
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        const result = fillForm(request.data);
        sendResponse(result);
    }
    return true;
});

// 标记 content script 已加载
console.log('[IP Auto Fill] Content script loaded');
