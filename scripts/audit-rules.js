/**
 * 生成规则审计：电话 + 邮编
 *
 * 对 19 个支持国家批量生成样本，校验：
 *  - 电话：国家区号正确、 national 部分长度符合 PHONE_FORMATS、号段前缀合法
 *  - 邮编：符合各国邮编格式正则
 *
 * 用法：npm run audit:rules
 * 退出码：0 = 全部通过，1 = 有失败项
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const COUNTRIES = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'China',
    'Japan', 'South Korea', 'Germany', 'France', 'Russia', 'Spain',
    'Italy', 'Brazil', 'India', 'Singapore', 'Taiwan', 'Hong Kong',
    'Mexico', 'Netherlands'
];

const SAMPLES = 30;

// 各国邮编期望格式（与 generateZipCode 分支对应）
const ZIP_PATTERNS = {
    'United States': /^\d{5}$/,
    'Canada': /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVXY] \d[ABCEGHJKLMNPRSTVXY]\d$/,
    'United Kingdom': /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
    'Germany': /^\d{5}$/,
    'France': /^\d{5}$/,
    'Spain': /^\d{5}$/,
    'Italy': /^\d{5}$/,
    'China': /^\d{6}$/,
    'Japan': /^\d{3}-\d{4}$/,
    'South Korea': /^\d{5}$/,
    'Australia': /^\d{4}$/,
    'India': /^\d{6}$/,
    'Brazil': /^\d{5}-\d{3}$/,
    'Russia': /^\d{6}$/,
    'Singapore': /^\d{6}$/,
    'Hong Kong': /^\d{6}$/,
    'Taiwan': /^\d{3,5}$/,
    'Mexico': /^\d{5}$/,
    'Netherlands': /^\d{4} [A-Z]{2}$/
};

function loadSandbox() {
    const sandbox = {
        console: { ...console, log: () => {}, warn: () => {}, error: () => {} },
        Math,
        window: {}
    };
    vm.createContext(sandbox);
    for (const file of ['address-pool.js', 'country-extensions.js', 'japan-generators.js', 'generators.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), sandbox);
    }
    return sandbox;
}

function auditPhones(sandbox, country) {
    const g = sandbox.window.generators;
    const config = vm.runInContext(`PHONE_FORMATS[${JSON.stringify(country)}]`, sandbox);
    const failures = [];
    if (!config) {
        return [`${country}: PHONE_FORMATS 缺少配置`];
    }

    const codeDigits = String(config.code || '').replace(/\D/g, '');
    const prefixes = [
        ...(config.mobilePrefixes || []),
        ...(config.areaCodePrefixes || [])
    ];

    for (let i = 0; i < SAMPLES; i++) {
        // 经完整 profile 路径生成（含扩展与质量过滤），更贴近真实使用
        const profile = g.generateAllInfoWithSettings({ country, city: '', region: '' }, {});
        const phone = String(profile.phone || '');
        const digits = phone.replace(/\D/g, '');

        if (codeDigits && !digits.startsWith(codeDigits)) {
            failures.push(`区号错误: ${phone}`);
            continue;
        }
        const national = codeDigits ? digits.slice(codeDigits.length) : digits;
        if (national.length !== config.length) {
            failures.push(`长度错误(期望${config.length}位): ${phone}`);
            continue;
        }
        if (prefixes.length > 0 && !prefixes.some((p) => national.startsWith(p))) {
            failures.push(`号段非法: ${phone}`);
        }
    }
    return failures;
}

function auditZips(sandbox, country) {
    const g = sandbox.window.generators;
    const pattern = ZIP_PATTERNS[country];
    const failures = [];
    if (!pattern) {
        return [`${country}: 缺少邮编期望格式定义`];
    }
    for (let i = 0; i < SAMPLES; i++) {
        // 直接调 generateZipCode：覆盖"单独刷新邮编"路径（含 prefix 拼接逻辑）
        const zip = vm.runInContext(
            `generateZipCode(${JSON.stringify(country)})`,
            sandbox
        );
        if (!pattern.test(String(zip))) {
            failures.push(`格式不符: ${JSON.stringify(zip)}`);
            if (failures.length >= 3) break;
        }
    }
    return failures;
}

function main() {
    const sandbox = loadSandbox();
    const rows = [];
    let failed = 0;

    for (const country of COUNTRIES) {
        const phoneFailures = auditPhones(sandbox, country);
        const zipFailures = auditZips(sandbox, country);
        const all = [...phoneFailures, ...zipFailures];
        if (all.length > 0) failed++;
        rows.push({
            country,
            phone: phoneFailures.length === 0 ? 'OK' : `${phoneFailures.length} 失败`,
            zip: zipFailures.length === 0 ? 'OK' : `${zipFailures.length} 失败`,
            example: all[0] || ''
        });
    }

    console.table(rows);
    console.log(`Countries: ${COUNTRIES.length}, failed: ${failed}`);

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main();
