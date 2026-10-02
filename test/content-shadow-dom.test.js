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

// ---- 最小 fake DOM：支持 shadowRoot 穿透 ----
function makeElement(tag, attrs = {}) {
    const el = {
        tagName: tag.toUpperCase(),
        children: [],
        shadowRoot: null,
        parentElement: null,
        _attrs: { ...attrs },
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
        },
        setAttribute(name, value) { this._attrs[name] = value; },
        getRootNode() {
            // 若自己是 shadow root 的直接子级，返回该 shadow root
            return this._rootNode || documentStub;
        },
        querySelectorAll(selector) {
            // 极简选择器：支持 '*'、tag 名、input:not(...)、[id]、[name="..."]
            const rawParts = selector.split(',').map((s) => s.trim());
            const matchAll = rawParts.some((s) => s === '*');
            const attrMatchers = rawParts.map((s) => {
                let m = s.match(/^\[id\]$/);
                if (m) return (el) => Boolean(el.getAttribute('id'));
                m = s.match(/^\[name="((?:[^"\\]|\\.)*)"\]$/);
                if (m) return (el) => el.getAttribute('name') === m[1].replace(/\\"/g, '"');
                return null;
            }).filter(Boolean);
            const tags = rawParts.map((s) => {
                const m = s.match(/^([a-z]+)/i);
                return m ? m[1].toUpperCase() : null;
            }).filter(Boolean);
            const out = [];
            const walk = (node) => {
                for (const child of node.children || []) {
                    const tagOk = matchAll || tags.includes(child.tagName);
                    const attrOk = attrMatchers.length > 0 && attrMatchers.some((fn) => fn(child));
                    if (tagOk || attrOk) out.push(child);
                    walk(child);
                }
            };
            walk(this);
            return out;
        },
        appendChild(child) {
            child.parentElement = this;
            this.children.push(child);
            return child;
        },
        attachShadow() {
            const root = makeShadowRoot(this);
            this.shadowRoot = root;
            return root;
        }
    };
    Object.defineProperty(el, 'id', { get() { return this._attrs.id || ''; } });
    return el;
}

function makeShadowRoot(host) {
    const root = makeElement('#SHADOW');
    root.host = host;
    // shadow root 内元素的 getRootNode 返回此 root
    const origAppend = root.appendChild;
    root.appendChild = function (child) {
        child._rootNode = root;
        const ret = origAppend.call(this, child);
        // 真实 DOM 里 shadow 子节点的 parentElement 为 null，父链经 getRootNode().host 跨越
        child.parentElement = null;
        return ret;
    };
    // 全局 ShadowRoot 构造器判定用
    Object.setPrototypeOf(root, ShadowRootProto);
    return root;
}

// vm 沙盒内需要一个 ShadowRoot 全局构造器
const ShadowRootProto = {};

const documentStub = makeElement('#DOCUMENT');
documentStub.title = 'shadow test';
documentStub.body = makeElement('BODY');
documentStub.appendChild(documentStub.body);
// document.querySelectorAll 代理到 body
const origDocQSA = documentStub.querySelectorAll.bind(documentStub);

function buildSandbox() {
    const code = loadContentCode();
    const sandbox = {
        console: { ...console, log: () => {}, warn: () => {} },
        window: {
            GeoFillSelectors: { fullNames: [] },
            getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
            location: { href: 'https://example.com' }
        },
        document: documentStub,
        ShadowRoot: function ShadowRoot() {},
        Event: class Event { constructor(type) { this.type = type; } },
        KeyboardEvent: class KeyboardEvent { constructor(type) { this.type = type; } },
        chrome: { runtime: { onMessage: { addListener: () => {} } } }
    };
    // 让 instanceof ShadowRoot 能识别 fake shadow root
    sandbox.ShadowRoot.prototype = ShadowRootProto;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

test('querySelectorAllDeep 穿透 open shadow root', () => {
    const sandbox = buildSandbox();
    const { querySelectorAllDeep } = sandbox;

    const host = makeElement('my-input', { id: 'email-field' });
    documentStub.body.appendChild(host);
    const shadow = host.attachShadow();
    const inner = makeElement('input', { id: 'inner-email', type: 'text' });
    shadow.appendChild(inner);
    const outside = makeElement('input', { id: 'outside', type: 'text' });
    documentStub.body.appendChild(outside);

    const found = querySelectorAllDeep('input', documentStub);
    const ids = found.map((el) => el.getAttribute('id'));
    assert.ok(ids.includes('inner-email'), '应找到 shadow root 内的 input');
    assert.ok(ids.includes('outside'), '应找到普通 input');

    // 清理，避免影响其他测试
    documentStub.body.children.length = 0;
});

test('getComposedParent 跨 shadow 边界返回宿主', () => {
    const sandbox = buildSandbox();
    const { getComposedParent } = sandbox;

    const host = makeElement('my-input', { id: 'host1' });
    documentStub.body.appendChild(host);
    const shadow = host.attachShadow();
    const inner = makeElement('input', { id: 'inner1' });
    shadow.appendChild(inner);

    assert.strictEqual(getComposedParent(inner), host, 'shadow 内元素的 composed parent 应为宿主');
    assert.strictEqual(getComposedParent(host), documentStub.body, '宿主的 parent 保持普通逻辑');

    documentStub.body.children.length = 0;
});

test('isInsideShadowDom 判定正确', () => {
    const sandbox = buildSandbox();
    const { isInsideShadowDom } = sandbox;

    const host = makeElement('my-input');
    documentStub.body.appendChild(host);
    const inner = makeElement('input');
    host.attachShadow().appendChild(inner);
    const outside = makeElement('input');
    documentStub.body.appendChild(outside);

    assert.strictEqual(isInsideShadowDom(inner), true);
    assert.strictEqual(isInsideShadowDom(outside), false);

    documentStub.body.children.length = 0;
});

test('getShadowHostContextText 收集宿主 id/class', () => {
    const sandbox = buildSandbox();
    const { getShadowHostContextText } = sandbox;

    const host = makeElement('user-email', { id: 'emailHost', class: 'email-wrapper' });
    documentStub.body.appendChild(host);
    const inner = makeElement('input');
    host.attachShadow().appendChild(inner);

    const text = getShadowHostContextText(inner);
    assert.ok(text.includes('emailHost'), '应包含宿主 id: ' + text);
    assert.ok(text.includes('email-wrapper'), '应包含宿主 class: ' + text);

    documentStub.body.children.length = 0;
});

test('highlightFieldElement 按 id 找到字段并标记', () => {
    const sandbox = buildSandbox();
    const { highlightFieldElement } = sandbox;

    let scrolled = false;
    const el = makeElement('input', { id: 'email', type: 'text' });
    el.scrollIntoView = () => { scrolled = true; };
    el.style = {};
    documentStub.body.appendChild(el);

    const ret = highlightFieldElement({ id: 'email', name: 'email' });
    assert.equal(ret.ok, true);
    assert.equal(scrolled, true);
    assert.equal(el.style.outline, '3px solid #ff453a');

    documentStub.body.children.length = 0;
});

test('highlightFieldElement 找不到时返回 ok:false', () => {
    const sandbox = buildSandbox();
    const { highlightFieldElement } = sandbox;

    const ret = highlightFieldElement({ id: 'no-such-field', name: 'nope' });
    assert.equal(ret.ok, false);
});

test('highlightFieldElement 跳过 field_N 占位 id，用 name 兜底', () => {
    const sandbox = buildSandbox();
    const { highlightFieldElement } = sandbox;

    let scrolled = false;
    const el = makeElement('input', { name: 'coupon', type: 'text' });
    el.scrollIntoView = () => { scrolled = true; };
    el.style = {};
    documentStub.body.appendChild(el);

    const ret = highlightFieldElement({ id: 'field_3', name: 'coupon' });
    assert.equal(ret.ok, true);
    assert.equal(scrolled, true);

    documentStub.body.children.length = 0;
});
