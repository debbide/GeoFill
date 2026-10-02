const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSandbox() {
    const sandbox = {
        console: { ...console, log: () => {}, warn: () => {}, error: () => {} },
        Math,
        window: {}
    };
    vm.createContext(sandbox);
    for (const file of ['address-pool.js', 'country-extensions.js', 'japan-generators.js', 'generators.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'scripts', file), 'utf8'), sandbox);
    }
    return sandbox;
}

const CA_ZIP = /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVXY] \d[ABCEGHJKLMNPRSTVXY]\d$/;

test('加拿大邮编刷新符合 A1A 1A1 格式（回归：曾少一个字母）', () => {
    const sandbox = loadSandbox();
    const g = sandbox.window.generators;
    // 先确立加拿大 location（含两位前缀 M5 之类）
    g.generateAllInfoWithSettings({ country: 'Canada', city: '', region: '' }, {});
    for (let i = 0; i < 20; i++) {
        const zip = vm.runInContext('generateZipCode("Canada")', sandbox);
        assert.match(String(zip), CA_ZIP, `畸形加拿大邮编: ${zip}`);
    }
});

test('加拿大已有完整邮编时直接沿用（规范化空格）', () => {
    const sandbox = loadSandbox();
    vm.runInContext('currentLocation = { city: "Toronto", state: "Ontario", zip: "M5B2L7" }', sandbox);
    const zip = vm.runInContext('generateZipCode("Canada")', sandbox);
    assert.match(String(zip), CA_ZIP, `应规范化为 A1A 1A1: ${zip}`);
});

test('荷兰邮编符合 1234 AB 格式', () => {
    const sandbox = loadSandbox();
    for (let i = 0; i < 20; i++) {
        const zip = vm.runInContext('generateZipCode("Netherlands")', sandbox);
        assert.match(String(zip), /^\d{4} [A-Z]{2}$/, `畸形荷兰邮编: ${zip}`);
    }
});

test('日本邮编为 NNN-NNNN 格式', () => {
    const sandbox = loadSandbox();
    const g = sandbox.window.generators;
    const profile = g.generateAllInfoWithSettings({ country: 'Japan', city: '', region: '' }, {});
    assert.match(String(profile.zipCode), /^\d{3}-\d{4}$/);
});

test('各国电话号段前缀合法', () => {
    const sandbox = loadSandbox();
    const g = sandbox.window.generators;
    const checks = {
        'United States': /^\+1 \([2-9]\d{2}\)/,
        'China': /^\+86 1[3-9]\d /,
        'Japan': /^0[789]0-\d{4}-\d{4}$/
    };
    for (const [country, pattern] of Object.entries(checks)) {
        for (let i = 0; i < 10; i++) {
            const profile = g.generateAllInfoWithSettings({ country, city: '', region: '' }, {});
            assert.match(String(profile.phone), pattern, `${country} 电话格式异常: ${profile.phone}`);
        }
    }
});
