/**
 * 常量和配置
 */

// ============ 调试开关 ============
// 生产环境设为 false 关闭所有日志输出
const DEBUG = true;

// 统一日志函数
const log = {
    info: (...args) => DEBUG && console.log('[GeoFill]', ...args),
    error: (...args) => DEBUG && console.error('[GeoFill]', ...args),
    warn: (...args) => DEBUG && console.warn('[GeoFill]', ...args)
};

// 存储键名
const STORAGE_KEY = 'geoFillCachedData';
const THEME_KEY = 'geoFillTheme';
const LOCKED_KEY = 'geoFillLockedFields';
const SETTINGS_KEY = 'geoFillSettings';
const ARCHIVES_KEY = 'geoFillArchives';
const AUTO_CLEAR_KEY = 'geoFillAutoClear';
const HISTORY_KEY = 'geoFillHistory';
const GEOAPIFY_KEY = 'geoFillGeoapifyKey';

// 缓存版本
const CACHE_VERSION = 'v3';

// 历史记录最大条数
const MAX_HISTORY_ITEMS = 10;

// 字段列表
const FIELD_NAMES = [
    'firstName', 'lastName', 'gender', 'birthday',
    'username', 'email', 'password', 'phone',
    'address', 'city', 'state', 'zipCode', 'country'
];

// 默认设置
const DEFAULT_SETTINGS = {
    enableAI: false,
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiModel: 'gpt-3.5-turbo',
    aiPersona: '',
    passwordLength: 12,
    pwdUppercase: true,
    pwdLowercase: true,
    pwdNumbers: true,
    pwdSymbols: true,
    minAge: 18,
    maxAge: 55,
    autoClearData: false
};

// ============ 全局状态变量 ============
// 这些变量需要在模块加载前声明，供所有模块共享

let currentData = {};
let ipData = {};
let lockedFields = new Set();
let userSettings = { ...DEFAULT_SETTINGS };

// DOM 元素引用（在 DOMContentLoaded 后由 popup.js 填充）
const elements = {
    ipInfo: null,
    ipRefresh: null,
    fields: {},
    regenerateAll: null,
    fillForm: null,
    emailDomainType: null,
    customDomain: null,
    themeToggle: null,
    toast: null,
    copyAll: null,
    openSettings: null,
    closeSettings: null,
    settingsModal: null,
    useAIToggle: null,
    aiToggleWrapper: null,
    enableAI: null,
    openaiBaseUrl: null,
    openaiKey: null,
    openaiModel: null,
    aiPersona: null,
    passwordLength: null,
    pwdUppercase: null,
    pwdLowercase: null,
    pwdNumbers: null,
    pwdSymbols: null,
    minAge: null,
    maxAge: null,
    autoClearData: null,
    archiveName: null,
    saveArchive: null,
    archiveList: null,
    inboxGroup: null,
    refreshInbox: null,
    inboxList: null,
    openHistory: null,
    closeHistory: null,
    historyModal: null,
    historyList: null,
    clearHistory: null,
    geoapifyKey: null,
    testAI: null
};
