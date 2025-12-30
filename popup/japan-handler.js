/**
 * 日本字段处理器 - 处理popup中的日本专用字段
 */

// 日本字段数据
let japanData = {};

// 日本字段元素
const japanElements = {
    japanFields: null,
    lastNameKanji: null,
    firstNameKanji: null,
    lastNameKana: null,
    firstNameKana: null,
    prefectureJp: null,
    cityJp: null,
    chomeJp: null,
    buildingJp: null,
    phoneJp: null
};

/**
 * 初始化日本字段元素
 */
function initJapanElements() {
    japanElements.japanFields = document.getElementById('japanFields');
    japanElements.lastNameKanji = document.getElementById('lastNameKanji');
    japanElements.firstNameKanji = document.getElementById('firstNameKanji');
    japanElements.lastNameKana = document.getElementById('lastNameKana');
    japanElements.firstNameKana = document.getElementById('firstNameKana');
    japanElements.prefectureJp = document.getElementById('prefectureJp');
    japanElements.cityJp = document.getElementById('cityJp');
    japanElements.chomeJp = document.getElementById('chomeJp');
    japanElements.buildingJp = document.getElementById('buildingJp');
    japanElements.phoneJp = document.getElementById('phoneJp');
}

/**
 * 生成日本专用数据
 */
function generateJapanData(gender) {
    if (!window.japanGenerators) {
        log.info(' japanGenerators 未加载');
        return;
    }

    const name = window.japanGenerators.generateJapanName(gender);
    const addr = window.japanGenerators.generateJapanAddress();
    const phone = window.japanGenerators.generateJapanPhoneFormatted();

    japanData = {
        lastNameKanji: name.lastNameKanji,
        firstNameKanji: name.firstNameKanji,
        lastNameKana: name.lastNameKana,
        firstNameKana: name.firstNameKana,
        prefectureJp: addr.prefecture,
        cityJp: addr.city,
        chomeJp: addr.chome,
        buildingJp: addr.building,
        phoneJp: phone,
        zipCodeJp: addr.zipCodeFormatted
    };

    // 同步到window对象
    window.japanData = japanData;

    updateJapanUI();
    return japanData;
}

/**
 * 更新日本字段UI
 */
function updateJapanUI() {
    if (japanElements.lastNameKanji) japanElements.lastNameKanji.value = japanData.lastNameKanji || '';
    if (japanElements.firstNameKanji) japanElements.firstNameKanji.value = japanData.firstNameKanji || '';
    if (japanElements.lastNameKana) japanElements.lastNameKana.value = japanData.lastNameKana || '';
    if (japanElements.firstNameKana) japanElements.firstNameKana.value = japanData.firstNameKana || '';
    if (japanElements.prefectureJp) japanElements.prefectureJp.value = japanData.prefectureJp || '';
    if (japanElements.cityJp) japanElements.cityJp.value = japanData.cityJp || '';
    if (japanElements.chomeJp) japanElements.chomeJp.value = japanData.chomeJp || '';
    if (japanElements.buildingJp) japanElements.buildingJp.value = japanData.buildingJp || '';
    if (japanElements.phoneJp) japanElements.phoneJp.value = japanData.phoneJp || '';
}

/**
 * 显示/隐藏日本字段
 */
function toggleJapanFields(show) {
    if (japanElements.japanFields) {
        japanElements.japanFields.style.display = show ? 'block' : 'none';
    }
}

/**
 * 复制到剪贴板
 */
async function copyJapanField(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = originalText;
        }, 1000);
    } catch (err) {
        log.error('复制失败:', err);
    }
}

/**
 * 初始化日本字段功能
 */
function initJapanFieldsHandler() {
    // 初始化元素引用
    initJapanElements();

    // 绑定复制按钮
    document.querySelectorAll('#japanFields .copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldName = e.currentTarget.dataset.field;
            const el = document.getElementById(fieldName);
            if (el && el.value) {
                copyJapanField(el.value, e.currentTarget);
            }
        });
    });

    // 监听国家变化
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        const checkAndUpdate = () => {
            const isJapan = countrySelect.value === 'Japan';
            toggleJapanFields(isJapan);
            if (isJapan && (!japanData.lastNameKanji || japanData.lastNameKanji === '')) {
                const genderEl = document.getElementById('gender');
                const gender = genderEl ? genderEl.value : 'male';
                generateJapanData(gender);
            }
        };

        // 初始检查（延迟等待数据加载）
        setTimeout(checkAndUpdate, 800);

        // 监听变化
        countrySelect.addEventListener('change', () => {
            checkAndUpdate();
        });
    }

    // 监听重新生成按钮
    const regenerateBtn = document.getElementById('regenerateAll');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            const countrySelect = document.getElementById('country');
            if (countrySelect && countrySelect.value === 'Japan') {
                const genderEl = document.getElementById('gender');
                const gender = genderEl ? genderEl.value : 'male';
                generateJapanData(gender);
            }
        });
    }

    log.info(' 日本字段处理器已初始化');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJapanFieldsHandler);
} else {
    initJapanFieldsHandler();
}

// 暴露给全局
window.generateJapanData = generateJapanData;
window.japanData = japanData;
window.initJapanFieldsHandler = initJapanFieldsHandler;
