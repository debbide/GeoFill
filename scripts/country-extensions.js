/**
 * 国家字段扩展注册表
 *
 * 各国特殊字段逻辑（数据生成器 / 页面选择器 / AI 提示词）按国家注册，
 * 调用方通过 get(country) 获取扩展，不再硬编码 if (country === 'Japan')。
 * 新增国家时只需新增扩展文件并注册，无需改动调用方。
 *
 * 扩展形状（各字段可选）：
 * {
 *   generateProfile: (gender, settings, helpers) => profile|null,
 *       // 完整 profile 生成器；helpers = { generatePhone, generateBirthday,
 *       //   generateUsername, generateEmail, generatePasswordWithSettings }
 *       // 返回 null/undefined 时回落到通用生成逻辑
 *   selectors: {...},        // 页面选择器（content script 合并）
 *   selectorLabels: {...},   // 选择器 label 关键字（content script 合并）
 *   aiPromptExtra: '...'     // AI 提示词追加片段
 * }
 */
(function (root) {
    const registry = Object.create(null);

    root.GeoFillCountryExtensions = {
        register(country, extension) {
            if (!country || !extension || typeof extension !== 'object') return;
            registry[country] = Object.assign({}, registry[country], extension);
        },
        get(country) {
            return (country && registry[country]) || null;
        },
        has(country) {
            return Boolean(country && registry[country]);
        },
        countries() {
            return Object.keys(registry);
        }
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
