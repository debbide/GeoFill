/**
 * GeoFill content script - 70-scan.js
 * scanForm：表单扫描、页面上下文与类型分析
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
/**
 * 扫描页面表单结构（增强版）
 */
function scanForm() {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
    const formStructure = [];

    inputs.forEach((input, index) => {
        if (!isFillableElement(input)) return;

        // 获取标签文本（增强版）
        const labelInfo = getEnhancedLabel(input);

        // 获取扩展上下文（向上遍历3层）
        const context = getExpandedContext(input);

        // 检测所属分组
        const group = detectFieldGroup(input);

        // 检测相邻字段关系
        const siblingInfo = detectSiblingRelation(input, inputs);

        // 获取 ID 或 Name 作为唯一标识
        const id = input.id || input.name || `field_${index}`;

        formStructure.push({
            id: id,
            type: input.type || input.tagName.toLowerCase(),
            label: labelInfo.text,
            labelSource: labelInfo.source,
            placeholder: input.placeholder || '',
            context: context,
            group: group,
            siblings: siblingInfo,
            name: input.name || '',
            className: input.className || '',
            required: input.required || input.getAttribute('aria-required') === 'true',
            min: input.min || '',
            max: input.max || '',
            maxLength: input.maxLength > 0 ? input.maxLength : '',
            pattern: input.pattern || '',
            autocomplete: input.autocomplete || ''
        });
    });

    // 获取页面语义信息（增强版）
    const pageContext = analyzePageContext();

    return {
        fields: formStructure,
        pageContext: pageContext
    };
}

/**
 * 获取增强的标签信息
 */
function getEnhancedLabel(element) {
    let labelText = '';
    let labelSource = '';

    // 1. 查找 <label for="id">
    const labels = getLabelElementsFor(element);
    if (labels.length > 0) {
        labelText = labels.map(getTextContent).filter(Boolean).join(' ');
        labelSource = 'label-for';
    }

    // 2. 查找父级 <label>
    if (!labelText) {
        const parentLabel = element.closest('label');
        if (parentLabel) {
            labelText = getTextContent(parentLabel);
            labelSource = 'parent-label';
        }
    }

    // 3. aria-label
    if (!labelText) {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            labelText = ariaLabel;
            labelSource = 'aria-label';
        }
    }

    // 4. aria-labelledby
    if (!labelText) {
        const labelledBy = element.getAttribute('aria-labelledby');
        const labelledText = getTextByElementIds(labelledBy);
        if (labelledText) {
            labelText = labelledText;
            labelSource = 'aria-labelledby';
        }
    }

    // 5. aria-describedby (作为补充上下文)
    if (!labelText) {
        const describedBy = element.getAttribute('aria-describedby');
        const describedText = getTextByElementIds(describedBy);
        if (describedText) {
            labelText = describedText;
            labelSource = 'aria-describedby';
        }
    }

    // 6. title 属性
    if (!labelText) {
        const title = element.getAttribute('title');
        if (title) {
            labelText = title;
            labelSource = 'title';
        }
    }

    // 7. placeholder
    if (!labelText) {
        const placeholder = element.getAttribute('placeholder');
        if (placeholder) {
            labelText = placeholder;
            labelSource = 'placeholder';
        }
    }

    // 8. 前置兄弟元素（表格布局常见）
    if (!labelText) {
        let previous = element.previousElementSibling;
        let attempts = 0;
        while (previous && attempts < 3) {
            if (['LABEL', 'SPAN', 'TD', 'TH', 'DIV', 'P'].includes(previous.tagName)) {
                const text = getTextContent(previous);
                if (text && text.length < 100) {
                    labelText = text;
                    labelSource = 'sibling-element';
                    break;
                }
            }
            previous = previous.previousElementSibling;
            attempts++;
        }
    }

    // 9. 父级元素中的文本节点（去除子元素文本后）
    if (!labelText) {
        const parent = getComposedParent(element);
        if (parent) {
            const cloned = parent.cloneNode(true);
            // 移除 input 元素
            cloned.querySelectorAll('input, select, textarea, button').forEach(el => el.remove());
            const text = getTextContent(cloned);
            if (text && text.length < 200) {
                labelText = text;
                labelSource = 'parent-text';
            }
        }
    }

    return {
        text: labelText.replace(/\s+/g, ' ').substring(0, 200),
        source: labelSource
    };
}

/**
 * 获取扩展上下文（向上遍历多层）
 */
function getExpandedContext(element) {
    const contextParts = [];
    let current = getComposedParent(element);
    let depth = 0;
    const maxDepth = 4;

    while (current && depth < maxDepth) {
        // 检查是否有有意义的语义信息
        const tagName = current.tagName.toLowerCase();

        // 跳过无意义的容器
        if (['body', 'html', 'main', 'article', 'section'].includes(tagName)) {
            break;
        }

        // 检查类名和 ID 中的语义
        const semantic = extractSemanticFromElement(current);
        if (semantic) {
            contextParts.push(semantic);
        }

        // 检查 heading 元素
        const heading = current.querySelector('h1, h2, h3, h4, h5, h6, legend');
        if (heading && !contextParts.includes(heading.innerText.trim())) {
            const headingText = heading.innerText.trim();
            if (headingText.length < 100) {
                contextParts.push(`[section: ${headingText}]`);
            }
        }

        current = getComposedParent(current);
        depth++;
    }

    return contextParts.join(' | ').substring(0, 300);
}

/**
 * 从元素中提取语义信息（class, id, data-* 属性）
 */
function extractSemanticFromElement(element) {
    const hints = [];

    // 检查 class
    const className = element.className;
    if (className && typeof className === 'string') {
        // 常见语义关键词
        const semanticKeywords = ['personal', 'contact', 'address', 'payment', 'billing', 'shipping',
            'account', 'profile', 'login', 'register', 'signup', 'form', 'info', 'details',
            '个人', '联系', '地址', '支付', '账户', '注册', '登录'];

        for (const keyword of semanticKeywords) {
            if (className.toLowerCase().includes(keyword)) {
                hints.push(`class:${keyword}`);
            }
        }
    }

    // 检查 data-* 属性
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-') && attr.value) {
            const value = attr.value.toLowerCase();
            if (value.length < 50 && !/^\d+$/.test(value)) {
                hints.push(`${attr.name}:${value}`);
            }
        }
    }

    return hints.length > 0 ? hints.join(', ') : '';
}

/**
 * 检测字段所属分组
 */
function detectFieldGroup(element) {
    // 1. 检查 fieldset
    const fieldset = element.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) {
            return legend.innerText.trim();
        }
    }

    // 2. 检查带有标题的父容器
    let current = getComposedParent(element);
    let depth = 0;
    while (current && depth < 5) {
        // 检查是否有分组标题
        const heading = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
        if (heading) {
            return heading.innerText.trim();
        }

        // 检查常见分组类名
        const className = (current.className || '').toLowerCase();
        if (className.includes('group') || className.includes('section') || className.includes('block') || className.includes('panel')) {
            // 尝试从第一个标题或 label 获取分组名
            const firstHeading = current.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
            if (firstHeading) {
                return firstHeading.innerText.trim();
            }
        }

        current = getComposedParent(current);
        depth++;
    }

    return '';
}

/**
 * 检测相邻字段关系
 */
function detectSiblingRelation(element, allInputs) {
    const info = {
        prevField: null,
        nextField: null,
        sameNamePrefix: []
    };

    const currentIndex = allInputs.indexOf(element);

    // 前一个字段
    if (currentIndex > 0) {
        const prev = allInputs[currentIndex - 1];
        if (prev.name || prev.id) {
            info.prevField = prev.name || prev.id;
        }
    }

    // 后一个字段
    if (currentIndex < allInputs.length - 1) {
        const next = allInputs[currentIndex + 1];
        if (next.name || next.id) {
            info.nextField = next.name || next.id;
        }
    }

    // 相同 name 前缀的字段（如 address_1, address_2）
    const currentName = element.name || '';
    if (currentName) {
        const prefix = currentName.replace(/[\[\]_-]?\d+[\[\]_-]?$/, '').replace(/[\[\]_-]$/, '');
        if (prefix && prefix !== currentName) {
            allInputs.forEach(input => {
                if (input !== element && input.name && input.name.startsWith(prefix)) {
                    info.sameNamePrefix.push(input.name);
                }
            });
        }
    }

    return info;
}

/**
 * 分析页面上下文（增强版）
 */
function analyzePageContext() {
    const pageTitle = document.title;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    const url = window.location.href;
    const language = document.documentElement.lang || navigator.language || 'en';

    // 检测页面类型
    const pageType = detectPageType(url, pageTitle, metaDesc);

    // 获取表单 action
    const forms = document.querySelectorAll('form');
    const formActions = [];
    forms.forEach(form => {
        if (form.action) {
            formActions.push(form.action);
        }
    });

    // 获取页面主标题
    const h1 = document.querySelector('h1');
    const mainHeading = h1 ? h1.innerText.trim() : '';

    // 检测是否有 CAPTCHA
    const hasCaptcha = !!(
        document.querySelector('[class*="captcha"]') ||
        document.querySelector('[id*="captcha"]') ||
        document.querySelector('[class*="recaptcha"]') ||
        document.querySelector('iframe[src*="recaptcha"]')
    );

    // 检测提交按钮文本
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    const submitText = submitBtn ? (submitBtn.innerText || submitBtn.value || '').trim() : '';

    return {
        title: pageTitle,
        description: metaDesc,
        url: url,
        language: language,
        pageType: pageType,
        mainHeading: mainHeading,
        formActions: formActions,
        hasCaptcha: hasCaptcha,
        submitButtonText: submitText
    };
}

/**
 * 检测页面类型
 */
function detectPageType(url, title, description) {
    const combined = `${url} ${title} ${description}`.toLowerCase();

    // 按优先级检测
    const patterns = [
        { type: 'login', keywords: ['login', 'signin', 'sign in', 'log in', '登录', 'ログイン', '로그인'] },
        { type: 'register', keywords: ['register', 'signup', 'sign up', 'create account', '注册', '新規登録', '会員登録', '가입'] },
        { type: 'checkout', keywords: ['checkout', 'payment', 'order', 'cart', '结账', '支付', '购物车', '決済', 'お支払い'] },
        { type: 'contact', keywords: ['contact', 'inquiry', 'message', '联系', '留言', 'お問い合わせ', '問い合わせ'] },
        { type: 'survey', keywords: ['survey', 'questionnaire', 'feedback', '问卷', '调查', 'アンケート'] },
        { type: 'profile', keywords: ['profile', 'account', 'settings', 'edit', '个人资料', '账户', 'プロフィール', '設定'] },
        { type: 'application', keywords: ['apply', 'application', 'job', 'career', '申请', '应聘', '応募', '申込'] },
        { type: 'subscription', keywords: ['subscribe', 'newsletter', 'mailing', '订阅', '购读'] }
    ];

    for (const { type, keywords } of patterns) {
        for (const keyword of keywords) {
            if (combined.includes(keyword)) {
                return type;
            }
        }
    }

    return 'unknown';
}

/**
 * 智能填写表单 (AI)
 */