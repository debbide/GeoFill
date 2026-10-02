const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CONTENT_PARTS = [
    '10-dom.js',
    '20-intent.js',
    '30-format.js',
    '40-controls.js',
    '50-diagnostics.js',
    '60-fill.js',
    '70-scan.js',
    '80-smart.js',
    '90-main.js'
];

function loadContentCode() {
    return CONTENT_PARTS
        .map((name) => fs.readFileSync(path.join(__dirname, '..', 'scripts', 'content', name), 'utf8'))
        .join('\n');
}

function makeInput(id, value = '') {
    return {
        tagName: 'INPUT',
        type: 'text',
        id,
        name: id,
        value,
        checked: false,
        disabled: false,
        children: [],
        shadowRoot: null,
        parentElement: null,
        getAttribute() { return null; },
        getBoundingClientRect: () => ({ width: 100, height: 20 }),
        getRootNode() { return documentStub; },
        querySelectorAll() { return []; },
        closest() { return null; },
        previousElementSibling: null,
        scrollIntoView() {},
        style: {},
        dispatchEvent() {},
        labels: []
    };
}

const documentStub = {
    title: 'step test',
    body: null,
    querySelectorAll(selector) {
        // 仅服务 getFillableElements 的选择器：按 tag 粗分
        const tags = selector.split(',').map((s) => {
            const m = s.trim().match(/^([a-z]+)/i);
            return m ? m[1].toUpperCase() : null;
        }).filter(Boolean);
        return (this.body ? this.body.children : []).filter((el) => tags.includes(el.tagName));
    },
    querySelector() { return null; },
    getElementById() { return null; },
    getElementsByName() { return []; },
    addEventListener() {}
};
documentStub.body = {
    tagName: 'BODY',
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll() { return []; }
};

function buildSandbox() {
    const sentMessages = [];
    let observerCallback = null;
    const timers = [];
    const observer = {
        observe() {},
        disconnect() { observerCallback = 'disconnected'; }
    };

    const sandbox = {
        console: { ...console, log: () => {}, warn: () => {} },
        window: {
            GeoFillSelectors: { fullNames: [] },
            getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
            location: { href: 'https://example.com' }
        },
        document: documentStub,
        MutationObserver: class MutationObserver {
            constructor(cb) { observerCallback = cb; this._obs = observer; }
            observe() {}
            disconnect() { observerCallback = 'disconnected'; }
        },
        setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
        clearTimeout: () => {},
        chrome: {
            runtime: {
                onMessage: { addListener: () => {} },
                sendMessage: async (msg) => { sentMessages.push(msg); return {}; }
            }
        },
        Event: class Event { constructor(type) { this.type = type; } },
        KeyboardEvent: class KeyboardEvent { constructor(type) { this.type = type; } }
    };
    vm.createContext(sandbox);
    vm.runInContext(loadContentCode(), sandbox);
    return {
        sandbox,
        sentMessages,
        triggerMutation() {
            if (typeof observerCallback === 'function') observerCallback();
        },
        async runDebounce() {
            const fns = timers.splice(0);
            for (const fn of fns) await fn();
            // 让 check() 内的 await 完成
            await new Promise((r) => setImmediate(r));
            await new Promise((r) => setImmediate(r));
        },
        isDisconnected() { return observerCallback === 'disconnected'; }
    };
}

test('armStepWatcher 在有已填字段时启动观察者', () => {
    documentStub.body.children = [makeInput('email', 'a@b.com')];
    const t = buildSandbox();
    t.sandbox.armStepWatcher();
    // 触发一次 mutation（debounce 被 stub 为同步-ish，这里只验证不抛错）
    t.triggerMutation();
    assert.equal(t.isDisconnected(), false);
    t.sandbox.disarmStepWatcher();
    assert.equal(t.isDisconnected(), true);
    documentStub.body.children = [];
});

test('无已填字段时不启动观察者', () => {
    documentStub.body.children = [makeInput('email', '')];
    const t = buildSandbox();
    t.sandbox.armStepWatcher();
    // observerCallback 应保持为初始 null（未构造 MutationObserver）
    t.triggerMutation(); // null，不是函数，不抛错
    documentStub.body.children = [];
});

test('检测到新步骤空字段时通知 background', async () => {
    documentStub.body.children = [makeInput('email', 'a@b.com')];
    const t = buildSandbox();
    t.sandbox.armStepWatcher();

    // 模拟点"下一步"后出现新字段
    documentStub.body.children.push(makeInput('phone', ''));
    t.triggerMutation();
    await t.runDebounce();

    assert.equal(t.sentMessages.length, 1);
    assert.equal(t.sentMessages[0].action, 'multistepFieldsDetected');
    assert.equal(t.sentMessages[0].newFieldCount, 1);

    t.sandbox.disarmStepWatcher();
    documentStub.body.children = [];
});

test('同一批新字段不重复通知', async () => {
    documentStub.body.children = [makeInput('email', 'a@b.com')];
    const t = buildSandbox();
    t.sandbox.armStepWatcher();

    documentStub.body.children.push(makeInput('phone', ''));
    t.triggerMutation();
    await t.runDebounce();
    assert.equal(t.sentMessages.length, 1);

    // 再次 mutation：同一批字段已记入 known，不再通知
    t.triggerMutation();
    await t.runDebounce();
    assert.equal(t.sentMessages.length, 1);

    t.sandbox.disarmStepWatcher();
    documentStub.body.children = [];
});

test('disarmStepWatcher 幂等', () => {
    const t = buildSandbox();
    t.sandbox.disarmStepWatcher();
    t.sandbox.disarmStepWatcher();
});
