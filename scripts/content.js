/**
 * Content Script - 表单自动填写（增强版）
 */

// 常见表单字段选择器映射（扩展版）
const FIELD_SELECTORS = {
    firstName: [
        // 标准属性匹配
        'input[name*="first" i]',
        'input[name*="fname" i]',
        'input[name*="given" i]',
        'input[id*="first" i]',
        'input[id*="fname" i]',
        // placeholder 匹配
        'input[placeholder*="first" i]',
        'input[placeholder*="given" i]',
        'input[placeholder*="名" i]',
        // autocomplete 标准
        'input[autocomplete="given-name"]',
        'input[autocomplete="first-name"]',
        // aria-label 匹配
        'input[aria-label*="first" i]',
        'input[aria-label*="given" i]',
        // data 属性匹配
        'input[data-field*="first" i]',
        'input[data-type*="first" i]'
    ],
    lastName: [
        'input[name*="last" i]',
        'input[name*="lname" i]',
        'input[name*="surname" i]',
        'input[name*="family" i]',
        'input[id*="last" i]',
        'input[id*="lname" i]',
        'input[id*="surname" i]',
        'input[placeholder*="last" i]',
        'input[placeholder*="surname" i]',
        'input[placeholder*="family" i]',
        'input[placeholder*="姓" i]',
        'input[autocomplete="family-name"]',
        'input[autocomplete="last-name"]',
        'input[aria-label*="last" i]',
        'input[aria-label*="surname" i]',
        'input[data-field*="last" i]'
    ],
    gender: [
        'select[name*="gender" i]',
        'select[id*="gender" i]',
        'select[name*="sex" i]',
        'select[id*="sex" i]',
        'input[name*="gender" i]',
        'input[id*="gender" i]',
        'input[aria-label*="gender" i]',
        'select[aria-label*="gender" i]'
    ],
    birthday: [
        'input[type="date"]',
        'input[name*="birth" i]',
        'input[name*="dob" i]',
        'input[name*="bday" i]',
        'input[id*="birth" i]',
        'input[id*="dob" i]',
        'input[id*="bday" i]',
        'input[placeholder*="birth" i]',
        'input[placeholder*="生日" i]',
        'input[placeholder*="出生" i]',
        'input[autocomplete="bday"]',
        'input[autocomplete="birthday"]',
        'input[aria-label*="birth" i]',
        'input[data-field*="birth" i]'
    ],
    username: [
        'input[name*="user" i]:not([type="password"])',
        'input[name*="login" i]:not([type="password"])',
        'input[name*="account" i]:not([type="password"])',
        'input[name*="nickname" i]',
        'input[name*="nick" i]',
        'input[id*="user" i]:not([type="password"])',
        'input[id*="nickname" i]',
        'input[placeholder*="user" i]',
        'input[placeholder*="用户" i]',
        'input[placeholder*="昵称" i]',
        'input[autocomplete="username"]',
        'input[aria-label*="user" i]',
        'input[data-field*="user" i]'
    ],
    email: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[name*="mail" i]',
        'input[name*="e-mail" i]',
        'input[id*="email" i]',
        'input[id*="mail" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="邮箱" i]',
        'input[placeholder*="电子邮件" i]',
        'input[autocomplete="email"]',
        'input[aria-label*="email" i]',
        'input[aria-label*="mail" i]',
        'input[data-field*="email" i]'
    ],
    password: [
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[name*="pwd" i]',
        'input[name*="secret" i]',
        'input[id*="pass" i]',
        'input[id*="pwd" i]',
        'input[placeholder*="password" i]',
        'input[placeholder*="密码" i]',
        'input[autocomplete="new-password"]',
        'input[autocomplete="current-password"]',
        'input[aria-label*="password" i]'
    ],
    phone: [
        'input[type="tel"]',
        'input[name*="phone" i]',
        'input[name*="mobile" i]',
        'input[name*="tel" i]',
        'input[name*="cell" i]',
        'input[name*="contact" i]',
        'input[id*="phone" i]',
        'input[id*="mobile" i]',
        'input[id*="tel" i]',
        'input[placeholder*="phone" i]',
        'input[placeholder*="mobile" i]',
        'input[placeholder*="电话" i]',
        'input[placeholder*="手机" i]',
        'input[autocomplete="tel"]',
        'input[autocomplete="tel-national"]',
        'input[aria-label*="phone" i]',
        'input[aria-label*="mobile" i]',
        'input[data-field*="phone" i]'
    ],
    address: [
        'input[name*="address" i]',
        'input[name*="street" i]',
        'input[name*="addr" i]',
        'input[id*="address" i]',
        'input[id*="street" i]',
        'input[placeholder*="address" i]',
        'input[placeholder*="street" i]',
        'input[placeholder*="地址" i]',
        'input[placeholder*="街道" i]',
        'input[autocomplete="street-address"]',
        'input[autocomplete="address-line1"]',
        'input[autocomplete="address-line2"]',
        'input[aria-label*="address" i]',
        'input[aria-label*="street" i]',
        'textarea[name*="address" i]',
        'textarea[id*="address" i]',
        'textarea[placeholder*="address" i]'
    ],
    city: [
        'input[name*="city" i]',
        'input[name*="town" i]',
        'input[name*="locality" i]',
        'input[id*="city" i]',
        'input[id*="town" i]',
        'input[placeholder*="city" i]',
        'input[placeholder*="城市" i]',
        'input[autocomplete="address-level2"]',
        'input[aria-label*="city" i]',
        'select[name*="city" i]',
        'select[id*="city" i]'
    ],
    zipCode: [
        'input[name*="zip" i]',
        'input[name*="postal" i]',
        'input[name*="postcode" i]',
        'input[name*="post_code" i]',
        'input[id*="zip" i]',
        'input[id*="postal" i]',
        'input[placeholder*="zip" i]',
        'input[placeholder*="postal" i]',
        'input[placeholder*="邮编" i]',
        'input[placeholder*="邮政编码" i]',
        'input[autocomplete="postal-code"]',
        'input[aria-label*="zip" i]',
        'input[aria-label*="postal" i]',
        'input[data-field*="zip" i]'
    ],
    state: [
        'input[name*="state" i]',
        'input[name*="province" i]',
        'input[name*="region" i]',
        'input[name*="prefecture" i]',
        'input[id*="state" i]',
        'input[id*="province" i]',
        'input[id*="region" i]',
        'input[placeholder*="state" i]',
        'input[placeholder*="province" i]',
        'input[placeholder*="省" i]',
        'input[placeholder*="州" i]',
        'select[name*="state" i]',
        'select[name*="province" i]',
        'select[name*="region" i]',
        'select[id*="state" i]',
        'select[id*="province" i]',
        'input[autocomplete="address-level1"]',
        'input[aria-label*="state" i]',
        'input[aria-label*="province" i]'
    ],
    country: [
        'input[name*="country" i]',
        'input[name*="nation" i]',
        'input[id*="country" i]',
        'input[placeholder*="country" i]',
        'input[placeholder*="国家" i]',
        'select[name*="country" i]',
        'select[id*="country" i]',
        'input[autocomplete="country-name"]',
        'input[autocomplete="country"]',
        'input[aria-label*="country" i]',
        'select[aria-label*="country" i]'
    ]
};

// 用于检测全名字段（需要拆分）
const FULLNAME_SELECTORS = [
    'input[name*="fullname" i]',
    'input[name*="full_name" i]',
    'input[name*="name" i]:not([name*="user" i]):not([name*="first" i]):not([name*="last" i])',
    'input[id*="fullname" i]',
    'input[placeholder*="full name" i]',
    'input[placeholder*="your name" i]',
    'input[placeholder*="姓名" i]',
    'input[autocomplete="name"]',
    'input[aria-label*="full name" i]',
    'input[aria-label*="your name" i]'
];

/**
 * 查找表单字段（单个）
 */
function findField(fieldName) {
    const selectors = FIELD_SELECTORS[fieldName] || [];

    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && isVisible(element) && !element.disabled && !element.readOnly) {
                return element;
            }
        } catch (e) {
            // 选择器语法错误时跳过
            console.log('[GeoFill] Selector error:', selector, e);
        }
    }

    return null;
}

/**
 * 查找全名字段
 */
function findFullNameField() {
    for (const selector of FULLNAME_SELECTORS) {
        try {
            const element = document.querySelector(selector);
            if (element && isVisible(element) && !element.disabled && !element.readOnly) {
                return element;
            }
        } catch (e) {
            console.log('[GeoFill] Selector error:', selector, e);
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
        try {
            const allElements = document.querySelectorAll(selector);
            allElements.forEach(element => {
                if (isVisible(element) && !element.disabled && !element.readOnly) {
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

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0;
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
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

    // 失焦触发验证
    element.blur();
}

/**
 * 处理 select 元素（增强版）
 */
function fillSelect(element, value) {
    const options = element.options;
    const searchValue = value.toLowerCase();

    // 首先尝试精确匹配
    for (let i = 0; i < options.length; i++) {
        const optionText = options[i].text.toLowerCase();
        const optionValue = options[i].value.toLowerCase();

        if (optionText === searchValue || optionValue === searchValue) {
            element.selectedIndex = i;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    // 然后尝试包含匹配
    for (let i = 0; i < options.length; i++) {
        const optionText = options[i].text.toLowerCase();
        const optionValue = options[i].value.toLowerCase();

        if (optionText.includes(searchValue) || optionValue.includes(searchValue) ||
            searchValue.includes(optionText) || searchValue.includes(optionValue)) {
            element.selectedIndex = i;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }

    return false;
}

/**
 * 处理 radio 按钮
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

/**
 * 填写表单（增强版）
 */
function fillForm(data) {
    let filledCount = 0;
    const results = {};

    // 先检查是否有全名字段
    const fullNameField = findFullNameField();
    if (fullNameField && data.firstName && data.lastName) {
        const fullName = `${data.firstName} ${data.lastName}`;
        simulateInput(fullNameField, fullName);
        filledCount++;
        results['fullName'] = 'filled';
    }

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

        // 电话字段去掉区号，只填写号码部分
        if (fieldName === 'phone') {
            const element = findField(fieldName);
            if (element) {
                // 根据字段类型决定是否保留格式
                const phoneNumber = value.replace(/^\+\d+\s*/, '');
                simulateInput(element, phoneNumber);
                filledCount++;
                results[fieldName] = 'filled';
            } else {
                results[fieldName] = 'not found';
            }
            continue;
        }

        // 性别字段特殊处理（可能是 radio）
        if (fieldName === 'gender') {
            const element = findField(fieldName);
            if (element) {
                if (element.tagName.toLowerCase() === 'select') {
                    if (fillSelect(element, value)) {
                        filledCount++;
                        results[fieldName] = 'filled (select)';
                    }
                } else {
                    simulateInput(element, value);
                    filledCount++;
                    results[fieldName] = 'filled';
                }
            } else {
                // 尝试 radio 按钮
                if (fillRadio('gender', value) || fillRadio('sex', value)) {
                    filledCount++;
                    results[fieldName] = 'filled (radio)';
                } else {
                    results[fieldName] = 'not found';
                }
            }
            continue;
        }

        const element = findField(fieldName);

        if (element) {
            if (element.tagName.toLowerCase() === 'select') {
                if (fillSelect(element, value)) {
                    filledCount++;
                    results[fieldName] = 'filled';
                } else {
                    results[fieldName] = 'no matching option';
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
console.log('[GeoFill] Content script loaded (Enhanced)');
