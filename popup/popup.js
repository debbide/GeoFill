/**
 * Popup 主逻辑 - 获取IP信息、生成数据、与content script通信
 */

// 当前生成的数据
let currentData = {};
let ipData = {};

// DOM 元素引用
const elements = {
    ipInfo: null,
    fields: {},
    regenerateAll: null,
    fillForm: null,
    emailDomainType: null,
    customDomain: null,
    themeToggle: null,
    toast: null
};

// 字段列表
const FIELD_NAMES = ['firstName', 'lastName', 'gender', 'birthday', 'username', 'email', 'password', 'phone', 'address', 'city', 'state', 'zipCode', 'country'];

// 存储键名
const STORAGE_KEY = 'geoFillCachedData';
const THEME_KEY = 'geoFillTheme';

/**
 * 显示 toast 提示
 */
function showToast(message) {
    const toast = elements.toast;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        btn.textContent = '✓';
        showToast('已复制到剪贴板');
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = '📋';
        }, 1000);
    } catch (err) {
        console.error('复制失败:', err);
    }
}

/**
 * 保存数据到 chrome.storage
 */
async function saveDataToStorage() {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEY]: {
                currentData,
                ipData,
                emailDomain: elements.emailDomainType?.value,
                customDomain: elements.customDomain?.value
            }
        });
    } catch (e) {
        console.log('保存数据失败:', e);
    }
}

/**
 * 从 chrome.storage 加载数据
 */
async function loadDataFromStorage() {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] || null;
    } catch (e) {
        console.log('加载数据失败:', e);
        return null;
    }
}

/**
 * 加载主题设置
 */
async function loadTheme() {
    try {
        const result = await chrome.storage.local.get(THEME_KEY);
        const theme = result[THEME_KEY] || 'dark';
        applyTheme(theme);
    } catch (e) {
        console.log('加载主题失败:', e);
    }
}

/**
 * 应用主题
 */
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        elements.themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        elements.themeToggle.textContent = '🌙';
    }
}

/**
 * 切换主题
 */
async function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    await chrome.storage.local.set({ [THEME_KEY]: newTheme });
}

/**
 * 初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 加载生成器模块
    await loadGeneratorsScript();

    // 缓存 DOM 元素
    elements.ipInfo = document.getElementById('ipInfo');
    elements.regenerateAll = document.getElementById('regenerateAll');
    elements.fillForm = document.getElementById('fillForm');
    elements.themeToggle = document.getElementById('themeToggle');
    elements.toast = document.getElementById('toast');

    FIELD_NAMES.forEach(name => {
        elements.fields[name] = document.getElementById(name);
    });

    // 邮箱后缀相关元素
    elements.emailDomainType = document.getElementById('emailDomainType');
    elements.customDomain = document.getElementById('customDomain');

    // 加载主题
    await loadTheme();

    // 绑定事件
    bindEvents();

    // 尝试从缓存加载数据
    const cachedData = await loadDataFromStorage();

    if (cachedData && cachedData.currentData && Object.keys(cachedData.currentData).length > 0) {
        // 使用缓存的数据
        currentData = cachedData.currentData;
        ipData = cachedData.ipData || {};

        // 恢复邮箱后缀设置
        if (cachedData.emailDomain) {
            elements.emailDomainType.value = cachedData.emailDomain;
            if (cachedData.emailDomain === 'custom' && cachedData.customDomain) {
                elements.customDomain.value = cachedData.customDomain;
                elements.customDomain.style.display = 'block';
            }
        }

        // 设置邮箱后缀
        window.generators.setCustomEmailDomain(elements.emailDomainType.value);

        // 更新 IP 信息显示（避免城市和国家相同时重复显示）
        if (ipData.city && ipData.country) {
            if (ipData.city === ipData.country || ipData.city === 'Singapore' || ipData.city === 'Hong Kong') {
                elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.country}</span>`;
            } else {
                elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.city}, ${ipData.country}</span>`;
            }
        } else if (ipData.country) {
            elements.ipInfo.innerHTML = `<span class="location">📍 ${ipData.country}</span>`;
        } else {
            elements.ipInfo.innerHTML = `<span class="location">📍 已缓存数据</span>`;
        }

        // 更新界面
        updateUI();
    } else {
        // 没有缓存，获取新数据
        window.generators.setCustomEmailDomain(elements.emailDomainType.value);
        await fetchIPInfo();
    }
});

/**
 * 加载生成器脚本
 */
function loadGeneratorsScript() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '../scripts/generators.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

/**
 * 绑定事件处理器
 */
function bindEvents() {
    // 主题切换
    elements.themeToggle.addEventListener('click', toggleTheme);

    // 全部重新生成
    elements.regenerateAll.addEventListener('click', () => {
        currentData = window.generators.generateAllInfo(ipData);
        updateUI();
        saveDataToStorage();
        showToast('已重新生成所有信息');
    });

    // 填写表单
    elements.fillForm.addEventListener('click', fillFormInPage);

    // 复制按钮
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldName = e.currentTarget.dataset.field;
            const value = currentData[fieldName] || elements.fields[fieldName]?.value;
            if (value) {
                copyToClipboard(value, e.currentTarget);
            }
        });
    });

    // 单个字段重新生成
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldName = e.currentTarget.dataset.field;
            // 先从输入框更新 currentData
            updateCurrentDataFromInputs();
            // 重新生成该字段
            const result = window.generators.regenerateField(fieldName, currentData, ipData);

            // 检查是否是位置更新（城市/州刷新会返回关联对象）
            if (result && result._isLocationUpdate) {
                // 更新城市、州、邮编
                currentData.city = result.city;
                currentData.state = result.state;
                currentData.zipCode = result.zipCode;

                // 更新所有相关字段的显示
                if (elements.fields.city) elements.fields.city.value = result.city;
                if (elements.fields.state) elements.fields.state.value = result.state;
                if (elements.fields.zipCode) elements.fields.zipCode.value = result.zipCode;
            } else {
                currentData[fieldName] = result;
                // 更新显示
                if (elements.fields[fieldName]) {
                    elements.fields[fieldName].value = currentData[fieldName];
                }
            }
            saveDataToStorage();
        });
    });

    // 监听输入框变化，同步到 currentData
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name]) {
            elements.fields[name].addEventListener('input', () => {
                currentData[name] = elements.fields[name].value;
                saveDataToStorage();
            });
            // select 元素使用 change 事件
            elements.fields[name].addEventListener('change', () => {
                currentData[name] = elements.fields[name].value;
                saveDataToStorage();
            });
        }
    });

    // 监听国家选择变化，重新生成相关信息
    elements.fields.country.addEventListener('change', () => {
        const newCountry = elements.fields.country.value;
        ipData.country = newCountry;

        // 使用 generateAllInfo 重新生成所有信息，确保地址关联正确
        currentData = window.generators.generateAllInfo(ipData);

        updateUI();
        saveDataToStorage();
    });

    // 监听邮箱后缀选择变化
    elements.emailDomainType.addEventListener('change', () => {
        const domain = elements.emailDomainType.value;

        // 显示/隐藏自定义输入框
        if (domain === 'custom') {
            elements.customDomain.style.display = 'block';
            // 如果有自定义后缀，使用它
            if (elements.customDomain.value.trim()) {
                window.generators.setCustomEmailDomain(elements.customDomain.value.trim());
                regenerateEmail();
            }
        } else {
            elements.customDomain.style.display = 'none';
            // 直接使用选择的域名作为后缀
            window.generators.setCustomEmailDomain(domain);
            regenerateEmail();
        }
        saveDataToStorage();
    });

    // 监听自定义后缀输入
    elements.customDomain.addEventListener('input', () => {
        const domain = elements.customDomain.value.trim();
        if (domain) {
            window.generators.setCustomEmailDomain(domain);
            regenerateEmail();
        }
        saveDataToStorage();
    });
}

/**
 * 重新生成邮箱（使用当前选择的后缀）
 */
function regenerateEmail() {
    updateCurrentDataFromInputs();
    currentData.email = window.generators.generateEmail(currentData.username);
    elements.fields.email.value = currentData.email;
}

/**
 * 从输入框更新 currentData
 */
function updateCurrentDataFromInputs() {
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name]) {
            currentData[name] = elements.fields[name].value;
        }
    });
}

/**
 * 获取 IP 信息
 */
async function fetchIPInfo() {
    elements.ipInfo.innerHTML = '<span class="loading">获取位置中...</span>';

    let country = 'United States';
    let city = 'New York';
    let success = false;

    // 尝试 ipapi.co (HTTPS)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (result.country_name) {
            country = result.country_name;
            city = result.city || 'Unknown';
            success = true;
        }
    } catch (e) {
        console.log('ipapi.co failed:', e.message);
    }

    // 备用: ip-api.com
    if (!success) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('http://ip-api.com/json/', { signal: controller.signal });
            clearTimeout(timeoutId);

            const result = await response.json();
            if (result.status === 'success') {
                country = result.country;
                city = result.city || 'Unknown';
                success = true;
            }
        } catch (e) {
            console.log('ip-api.com failed:', e.message);
        }
    }

    // 标准化国家名称
    const normalizedCountry = window.generators.normalizeCountry(country);

    ipData = {
        country: normalizedCountry,
        city: city
    };

    // 更新位置显示（避免城市和国家相同时重复显示）
    if (success) {
        if (city === normalizedCountry || city === 'Singapore' || city === 'Hong Kong') {
            // 城市国家（如新加坡、香港）只显示一次
            elements.ipInfo.innerHTML = `<span class="location">📍 ${normalizedCountry}</span>`;
        } else {
            elements.ipInfo.innerHTML = `<span class="location">📍 ${city}, ${normalizedCountry}</span>`;
        }
    } else {
        elements.ipInfo.innerHTML = `<span class="location">📍 ${normalizedCountry} (默认)</span>`;
    }

    // 生成信息
    currentData = window.generators.generateAllInfo(ipData);
    updateUI();
    saveDataToStorage();
}

/**
 * 更新界面显示
 */
function updateUI() {
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name] && currentData[name] !== undefined) {
            if (name === 'country' || name === 'gender') {
                // select 元素
                const selectEl = elements.fields[name];
                const options = Array.from(selectEl.options).map(opt => opt.value);
                if (options.includes(currentData[name])) {
                    selectEl.value = currentData[name];
                } else if (name === 'country') {
                    // 如果检测到的国家不在列表中，使用第一个选项（美国）
                    selectEl.selectedIndex = 0;
                    currentData[name] = selectEl.value;
                    ipData.country = selectEl.value;
                }
            } else {
                elements.fields[name].value = currentData[name];
            }
        }
    });
}

/**
 * 在页面中填写表单
 */
async function fillFormInPage() {
    // 更新 currentData 以获取用户可能的修改
    updateCurrentDataFromInputs();

    try {
        // 获取当前标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 发送消息给 content script
        await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            data: currentData
        });

        // 关闭弹窗
        window.close();
    } catch (error) {
        console.error('填写表单失败:', error);
        alert('填写失败，请确保页面已完全加载');
    }
}
