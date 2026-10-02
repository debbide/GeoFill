const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readScript(name) {
    return fs.readFileSync(path.join(__dirname, '..', 'scripts', name), 'utf8');
}

function loadRegistryOnly() {
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(readScript('country-extensions.js'), sandbox);
    return sandbox.GeoFillCountryExtensions;
}

test('注册表基本操作：register/get/has/countries', () => {
    const reg = loadRegistryOnly();
    assert.equal(reg.has('Japan'), false);
    assert.equal(reg.get('Japan'), null);

    reg.register('Japan', { aiPromptExtra: 'xxx' });
    assert.equal(reg.has('Japan'), true);
    assert.equal(reg.get('Japan').aiPromptExtra, 'xxx');

    // 二次注册合并而非覆盖
    reg.register('Japan', { selectors: { a: 1 } });
    const ext = reg.get('Japan');
    assert.equal(ext.aiPromptExtra, 'xxx');
    assert.deepEqual({ ...ext.selectors }, { a: 1 });

    assert.deepEqual([...reg.countries()], ['Japan']);

    // 非法输入不抛错
    reg.register(null, {});
    reg.register('X', null);
    assert.equal(reg.has('X'), false);
});

test('japan-generators.js 加载后自动注册 Japan 扩展', () => {
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(readScript('country-extensions.js'), sandbox);
    vm.runInContext(readScript('japan-generators.js'), sandbox);

    const reg = sandbox.GeoFillCountryExtensions;
    assert.equal(reg.has('Japan'), true);
    const ext = reg.get('Japan');
    assert.equal(typeof ext.generateProfile, 'function');
    assert.ok(typeof ext.aiPromptExtra === 'string' && ext.aiPromptExtra.includes('NNN-NNNN'));
});

test('generators.js 经注册表走 Japan 扩展路径（端到端）', () => {
    const sandbox = { console, Math, window: {} };
    vm.createContext(sandbox);
    vm.runInContext(readScript('address-pool.js'), sandbox);
    vm.runInContext(readScript('country-extensions.js'), sandbox);
    vm.runInContext(readScript('japan-generators.js'), sandbox);
    vm.runInContext(readScript('generators.js'), sandbox);
    const g = sandbox.window.generators;

    const profile = g.generateAllInfoWithSettings(
        { country: 'Japan', city: '', region: '' },
        { minAge: 20, maxAge: 40 }
    );
    // Japan 扩展返回汉字姓名 + 假名 + XServer 字段
    assert.ok(profile.firstName && /[\u4e00-\u9fff]/.test(profile.firstName), 'firstName 应为汉字');
    assert.ok(profile.firstNameKana && /[\u30a0-\u30ff]/.test(profile.firstNameKana), '应有片假名');
    assert.equal(profile.id_usertype, '100');
    assert.match(profile.zipCode, /^\d{3}-\d{4}$/);
});

test('未注册国家回落到通用生成逻辑', () => {
    const sandbox = { console, Math, window: {} };
    vm.createContext(sandbox);
    vm.runInContext(readScript('address-pool.js'), sandbox);
    vm.runInContext(readScript('country-extensions.js'), sandbox);
    // 注意：不加载 japan-generators.js
    vm.runInContext(readScript('generators.js'), sandbox);
    const g = sandbox.window.generators;

    const profile = g.generateAllInfoWithSettings(
        { country: 'Japan', city: '', region: '' },
        { minAge: 20, maxAge: 40 }
    );
    // 无扩展时走通用逻辑：无汉字专属字段
    assert.equal(profile.id_usertype, undefined);
    assert.ok(profile.firstName);
});
