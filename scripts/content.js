/**
 * Content Script - 表单自动填写（增强版）
 */

// 常见表单字段选择器映射（扩展版）
// 常见表单字段选择器映射（扩展版）
const FIELD_SELECTORS = {
    ...window.GeoFillSelectors.common,
    ...window.GeoFillSelectors.japan
};

// 标签关键字映射
const LABEL_KEYWORDS = {
    ...window.GeoFillSelectors.commonLabels,
    ...window.GeoFillSelectors.japanLabels
};

// 用于检测全名字段（需要拆分）
const FULLNAME_SELECTORS = window.GeoFillSelectors.fullNames || [];

/**
 * 获取元素的标签文本
 */
function getLabelText(element) {
    let labelText = '';
    const id = element.id;

    // 1. 查找 <label for="id">
    if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) labelText += label.innerText;
    }

    // 2. 查找父级 <label>
    const parentLabel = element.closest('label');
    if (parentLabel) labelText += parentLabel.innerText;

    // 3. 查找 aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) labelText += ariaLabel;

    // 4. 查找 placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) labelText += placeholder;

    // 5. 查找前置文本节点 (简单的启发式)
    // 很多表格布局中，label 在 input 的前一个 td 或兄弟节点
    let previous = element.previousElementSibling;
    while (previous) {
        if (previous.tagName === 'LABEL' || previous.tagName === 'SPAN' || previous.tagName === 'TD' || previous.tagName === 'TH') {
            labelText += previous.innerText;
            break;
        }
        previous = previous.previousElementSibling;
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
        if (input.disabled || input.readOnly || !isVisible(input)) continue;

        // 如果该输入框已经被其他规则匹配过，可能需要跳过（这里简化处理，优先匹配）

        const text = getLabelText(input);
        if (!text) continue;

        for (const keyword of keywords) {
            // 简单的包含匹配
            if (text.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
                return input;
            }
        }
    }
    return null;
}

/**
 * 查找表单字段（单个）
 */
function findField(fieldName) {
    // 1. 优先尝试 CSS 选择器
    const selectors = FIELD_SELECTORS[fieldName] || [];
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && isVisible(element) && !element.disabled && !element.readOnly) {
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

        // address 字段延迟到最后填写，避免被邮编自动填充覆盖
        if (fieldName === 'address') {
            continue;
        }

        // 跳过 gender 字段（日本网站通常不需要，且容易误匹配其他 radio）
        if (fieldName === 'gender') {
            continue;
        }

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

    // 最后填写 address 字段，避免被邮编自动填充覆盖
    if (data.address) {
        setTimeout(() => {
            const addressEl = findField('address');
            if (addressEl) {
                // 确保不是邮箱字段
                const elName = (addressEl.name || '').toLowerCase();
                const elType = (addressEl.type || '').toLowerCase();
                if (elType === 'email' || elName.includes('mail')) {
                    console.log('[GeoFill] 跳过 address 填写，目标是邮箱字段');
                } else {
                    addressEl.value = data.address;
                    console.log('[GeoFill] 延迟填写 address:', data.address);
                }
            }
        }, 1500);
    }

    return { filledCount, results };
}

/**
 * 扫描页面表单结构
 */
function scanForm() {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
    const formStructure = [];

    inputs.forEach((input, index) => {
        if (!isVisible(input) || input.disabled || input.readOnly) return;

        // 获取标签文本
        const label = getLabelText(input);

        // 获取上下文（前后的文本）
        let context = '';
        const parent = input.parentElement;
        if (parent) {
            context = parent.innerText.replace(/\s+/g, ' ').trim().substring(0, 100); // 限制长度
        }

        // 获取 ID 或 Name 作为唯一标识
        const id = input.id || input.name || `field_${index}`;

        formStructure.push({
            id: id,
            type: input.type || input.tagName.toLowerCase(),
            label: label,
            placeholder: input.placeholder || '',
            context: context,
            name: input.name || '',
            required: input.required || input.getAttribute('aria-required') === 'true',
            min: input.min || '',
            max: input.max || '',
            pattern: input.pattern || ''
        });
    });

    // 获取页面标题和 meta description 作为整体上下文
    const pageTitle = document.title;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

    return {
        fields: formStructure,
        pageContext: {
            title: pageTitle,
            description: metaDesc,
            url: window.location.href,
            language: document.documentElement.lang || 'en'
        }
    };
}

/**
 * 智能填写表单 (AI)
 */
function fillFormSmart(mapping) {
    let filledCount = 0;
    const results = {};

    for (const [key, value] of Object.entries(mapping)) {
        // key 可能是 id 或 name
        let element = document.getElementById(key);
        if (!element) {
            element = document.querySelector(`[name="${key}"]`);
        }

        // 如果是生成的临时 ID (field_x)，尝试通过索引找回（不太可靠，但作为兜底）
        if (!element && key.startsWith('field_')) {
            const index = parseInt(key.split('_')[1]);
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
            if (inputs[index]) element = inputs[index];
        }

        if (element && isVisible(element)) {
            if (element.tagName.toLowerCase() === 'select') {
                fillSelect(element, value);
            } else if (element.type === 'radio' || element.type === 'checkbox') {
                // 对于 radio/checkbox，AI 可能会返回 true/false 或 value
                if (value === true || value === 'true' || value === element.value) {
                    element.checked = true;
                }
            } else {
                simulateInput(element, value);
            }
            filledCount++;
            results[key] = 'filled';
        } else {
            results[key] = 'not found';
        }
    }

    return { filledCount, results };
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        const result = fillForm(request.data);
        sendResponse(result);
    } else if (request.action === 'scanForm') {
        const result = scanForm();
        sendResponse(result);
    } else if (request.action === 'fillFormSmart') {
        const result = fillFormSmart(request.data);
        sendResponse(result);
    }
    return true;
});

// 标记 content script 已加载
console.log('[GeoFill] Content script loaded (Enhanced)');
