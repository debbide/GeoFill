const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGenerators() {
    const poolCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'address-pool.js'), 'utf8');
    const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'generators.js'), 'utf8');
    const sandbox = { console, Math, window: {} };
    vm.createContext(sandbox);
    vm.runInContext(poolCode, sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.generators;
}

const sample = (fn, n = 200) => Array.from({ length: n }, fn);

test('simple preset: 10 chars, lowercase + digits only', () => {
    const g = loadGenerators();
    for (const pwd of sample(() => g.generatePasswordWithSettings({ passwordMode: 'simple' }))) {
        assert.match(pwd, /^[a-z0-9]{10}$/);
    }
});

test('standard preset: 12 chars, letters + digits, no symbols', () => {
    const g = loadGenerators();
    for (const pwd of sample(() => g.generatePasswordWithSettings({ passwordMode: 'standard' }))) {
        assert.match(pwd, /^[A-Za-z0-9]{12}$/);
    }
});

test('strong preset: 16 chars, symbols appear', () => {
    const g = loadGenerators();
    const pwds = sample(() => g.generatePasswordWithSettings({ passwordMode: 'strong' }));
    assert.ok(pwds.every(p => p.length === 16));
    assert.ok(pwds.some(p => /[!@#$%^&*]/.test(p)), 'expected at least one password with a symbol');
});

test('preset overrides conflicting stored settings', () => {
    const g = loadGenerators();
    const pwd = g.generatePasswordWithSettings({
        passwordMode: 'simple', passwordLength: 30,
        pwdUppercase: true, pwdSymbols: true
    });
    assert.match(pwd, /^[a-z0-9]{10}$/);
});

test('custom + noAmbiguous never emits 0O1lI', () => {
    const g = loadGenerators();
    for (const pwd of sample(() => g.generatePasswordWithSettings({
        passwordMode: 'custom', passwordLength: 24, pwdNoAmbiguous: true
    }))) {
        assert.equal(pwd.length, 24);
        assert.ok(!/[0O1lI]/.test(pwd), `ambiguous char in ${pwd}`);
    }
});

test('legacy settings without mode keep old behavior', () => {
    const g = loadGenerators();
    const pwd = g.generatePasswordWithSettings({});
    assert.equal(pwd.length, 12);
    const cfg = g.resolvePasswordConfig({});
    assert.deepEqual(JSON.parse(JSON.stringify(cfg)), {
        length: 12, uppercase: true, lowercase: true,
        numbers: true, symbols: true, noAmbiguous: false
    });
});
