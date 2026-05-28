const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quietConsole = {
    ...console,
    log: () => {},
    warn: () => {}
};

function buildSandbox() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'content.js'), 'utf8');

    const events = [];
    const fakeElement = {
        id: 'a',
        type: 'text',
        disabled: false,
        value: '',
        dispatchEvent: (evt) => events.push(evt.type)
    };

    const documentStub = {
        querySelectorAll: () => [],
        querySelector: () => null,
        getElementById: () => null,
        getElementsByName: () => [],
        addEventListener: () => {},
        title: 'x',
        body: { innerText: '' }
    };

    const sandbox = {
        console: quietConsole,
        window: {
            GeoFillSelectors: {
                common: {},
                japan: {},
                commonLabels: {},
                japanLabels: {},
                fullNames: []
            },
            getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
            location: { href: 'https://example.com' },
            HTMLInputElement: function HTMLInputElement() {},
            HTMLTextAreaElement: function HTMLTextAreaElement() {}
        },
        document: documentStub,
        Event: class Event {
            constructor(type) { this.type = type; }
        },
        KeyboardEvent: class KeyboardEvent {
            constructor(type) { this.type = type; }
        },
        chrome: {
            runtime: {
                onMessage: { addListener: () => {} }
            }
        }
    };

    // minimal prototypes for simulateInput helper
    sandbox.window.HTMLInputElement.prototype = { value: '' };
    sandbox.window.HTMLTextAreaElement.prototype = { value: '' };
    Object.defineProperty(sandbox.window.HTMLInputElement.prototype, 'value', {
        set(v) { this._v = v; },
        get() { return this._v; }
    });
    Object.defineProperty(sandbox.window.HTMLTextAreaElement.prototype, 'value', {
        set(v) { this._v = v; },
        get() { return this._v; }
    });

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    return { sandbox, fakeElement, events };
}

function buildFillSandbox(elements) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'content.js'), 'utf8');
    const allElements = elements;
    const getElements = () => typeof allElements === 'function' ? allElements() : allElements;
    const getFormElements = () => getElements().filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
    const getDiagnosticElements = () => getElements().filter((el) => el._diagnosticNode);
    const getById = () => new Map(getElements().filter((el) => el.id).map((el) => [el.id, el]));
    const getLabelElements = () => getElements()
        .flatMap((el) => el._allLabels || el.labels || [])
        .filter(Boolean);
    const getByName = () => {
        const byName = new Map();
        getElements().forEach((el) => {
            if (!el.name) return;
            if (!byName.has(el.name)) byName.set(el.name, []);
            byName.get(el.name).push(el);
        });
        return byName;
    };

    const documentStub = {
        querySelectorAll: (selector) => {
            if (selector === 'label') {
                return getLabelElements();
            }
            if (selector.includes('input') || selector.includes('select') || selector.includes('textarea')) {
                return getFormElements();
            }
            if (selector.includes('role="alert"') || selector.includes('error') || selector.includes('invalid') || selector.includes('aria-live')) {
                return getDiagnosticElements();
            }
            return [];
        },
        querySelector: (selector) => {
            const labelForMatch = String(selector || '').match(/^label\[for="(.+)"\]$/);
            if (labelForMatch) {
                const wanted = labelForMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                return getLabelElements().find((label) => label.getAttribute?.('for') === wanted) || null;
            }
            return null;
        },
        getElementById: (id) => getById().get(id) || getLabelElements().find((label) => label.id === id) || null,
        getElementsByName: (name) => getByName().get(name) || [],
        addEventListener: () => {},
        title: 'x',
        body: { innerText: '' },
        documentElement: { lang: 'en' }
    };

    const sandbox = {
        console: quietConsole,
        navigator: { language: 'en-US' },
        window: {
            GeoFillSelectors: {
                common: {},
                japan: {},
                commonLabels: {},
                japanLabels: {},
                fullNames: []
            },
            getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
            location: { href: 'https://example.com/register' },
            HTMLInputElement: function HTMLInputElement() {},
            HTMLTextAreaElement: function HTMLTextAreaElement() {}
        },
        document: documentStub,
        Event: class Event {
            constructor(type) { this.type = type; }
        },
        KeyboardEvent: class KeyboardEvent {
            constructor(type) { this.type = type; }
        },
        setTimeout,
        chrome: {
            runtime: {
                onMessage: { addListener: () => {} }
            }
        }
    };

    sandbox.window.HTMLInputElement.prototype = { value: '' };
    sandbox.window.HTMLTextAreaElement.prototype = { value: '' };
    Object.defineProperty(sandbox.window.HTMLInputElement.prototype, 'value', {
        set(v) { this._v = v; },
        get() { return this._v; }
    });
    Object.defineProperty(sandbox.window.HTMLTextAreaElement.prototype, 'value', {
        set(v) { this._v = v; },
        get() { return this._v; }
    });

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

function makeInput(attrs = {}) {
    const events = [];
    const attrState = { ...attrs };
    const labels = (attrs.labels || []).map((text) => ({
        tagName: 'LABEL',
        id: '',
        textContent: text,
        innerText: text,
        getAttribute: (name) => name === 'for' ? (attrs.id || '') : ''
    }));
    return {
        tagName: 'INPUT',
        id: attrs.id || '',
        name: attrs.name || '',
        type: attrs.type || 'text',
        value: attrs.value || '',
        validationMessage: attrs.validationMessage || '',
        validity: attrs.validity || { valid: true },
        checked: attrs.checked || false,
        hidden: Boolean(attrs.hidden),
        disabled: Boolean(attrs.disabled),
        readOnly: Boolean(attrs.readOnly || attrs.readonly),
        required: attrs.required || false,
        maxLength: attrs.maxLength ?? attrs.maxlength ?? -1,
        pattern: attrs.pattern || '',
        inputMode: attrs.inputMode || attrs.inputmode || '',
        autocomplete: attrs.autocomplete || '',
        placeholder: attrs.placeholder || '',
        className: attrs.className || '',
        labels,
        closest: (selector) => attrs.closest?.[selector] || null,
        previousElementSibling: null,
        parentElement: null,
        attributes: [],
        getAttribute: (name) => attrState[name] || '',
        setAttribute: (name, value) => {
            attrState[name] = String(value);
        },
        matches: (selector) => attrs.matches?.[selector] || false,
        getBoundingClientRect: () => attrs.rect || { width: 100, height: 20 },
        focus: () => {},
        blur: () => {},
        dispatchEvent: (event) => events.push(event.type),
        _events: events,
        _attrs: attrState
    };
}

function makeSelect(attrs = {}, options = []) {
    const events = [];
    const labels = (attrs.labels || []).map((text) => ({
        tagName: 'LABEL',
        id: '',
        textContent: text,
        innerText: text,
        getAttribute: (name) => name === 'for' ? (attrs.id || '') : ''
    }));
    const optionObjects = options.map((option) => ({
        text: option.text,
        value: option.value,
        disabled: Boolean(option.disabled),
        getAttribute: (name) => option[name] || ''
    }));
    return {
        tagName: 'SELECT',
        id: attrs.id || '',
        name: attrs.name || '',
        type: 'select-one',
        value: '',
        selectedIndex: -1,
        options: optionObjects,
        validationMessage: attrs.validationMessage || '',
        validity: attrs.validity || { valid: true },
        hidden: Boolean(attrs.hidden),
        disabled: Boolean(attrs.disabled),
        readOnly: Boolean(attrs.readOnly || attrs.readonly),
        required: attrs.required || false,
        autocomplete: attrs.autocomplete || '',
        placeholder: '',
        className: attrs.className || '',
        labels,
        closest: (selector) => attrs.closest?.[selector] || null,
        previousElementSibling: null,
        parentElement: null,
        attributes: [],
        getAttribute: (name) => attrs[name] || '',
        matches: (selector) => attrs.matches?.[selector] || false,
        getBoundingClientRect: () => attrs.rect || { width: 100, height: 20 },
        focus: () => {},
        blur: () => {},
        dispatchEvent(event) {
            events.push(event.type);
            if (optionObjects[this.selectedIndex]) this.value = optionObjects[this.selectedIndex].value;
        },
        _events: events
    };
}

function makeLabel(attrs = {}) {
    const text = attrs.text || '';
    return {
        tagName: 'LABEL',
        id: attrs.id || '',
        textContent: text,
        innerText: text,
        getAttribute: (name) => name === 'for' ? (attrs.for || '') : ''
    };
}

function makeErrorNode(text, attrs = {}) {
    return {
        _diagnosticNode: true,
        tagName: 'DIV',
        id: attrs.id || '',
        className: attrs.className || 'error',
        textContent: text,
        innerText: text,
        hidden: Boolean(attrs.hidden),
        getAttribute: (name) => attrs[name] || '',
        getBoundingClientRect: () => attrs.rect || { width: 100, height: 20 }
    };
}

test('sanitizeSmartFillMapping drops invalid types and trims strings', () => {
    const { sandbox } = buildSandbox();
    const out = sandbox.sanitizeSmartFillMapping({
        a: '  hello  ',
        b: 123,
        c: true,
        d: { bad: 1 },
        e: '\u0000x\u0001'
    });

    assert.equal(out.a, 'hello');
    assert.equal(out.b, '123');
    assert.equal(out.c, true);
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'd'), false);
    assert.equal(out.e, 'x');
});

test('toBooleanLike parses common boolean strings', () => {
    const { sandbox } = buildSandbox();
    assert.equal(sandbox.toBooleanLike(true), true);
    assert.equal(sandbox.toBooleanLike('YES'), true);
    assert.equal(sandbox.toBooleanLike('0'), false);
    assert.equal(sandbox.toBooleanLike('unknown'), null);
});

test('fillFormSmart returns validation summary', async () => {
    const email = makeInput({ id: 'email', name: 'email', type: 'email', required: true });
    const password = makeInput({ id: 'password', name: 'password', type: 'password', required: true });

    const sandbox = buildFillSandbox([email, password]);
    const result = await sandbox.fillFormSmart({
        email: 'jane@example.com'
    }, { diagnosticDelays: [] });

    assert.equal(email._v, 'jane@example.com');
    assert.equal(result.filledCount, 1);
    assert.equal(result.validation.isComplete, false);
    assert.equal(result.validation.missingRequiredFields[0].id, 'password');
});

test('fillForm splits address, country select, phone code and consent checkboxes', () => {
    const address1 = makeInput({ id: 'addr1', name: 'address_line_1', autocomplete: 'address-line1' });
    const address2 = makeInput({ id: 'addr2', name: 'address_line_2', autocomplete: 'address-line2' });
    const city = makeInput({ id: 'city', name: 'city', autocomplete: 'address-level2' });
    const state = makeInput({ id: 'state', name: 'state', autocomplete: 'address-level1' });
    const zip = makeInput({ id: 'zip', name: 'postal_code', autocomplete: 'postal-code' });
    const country = makeSelect({ id: 'country', name: 'country', autocomplete: 'country' }, [
        { text: 'Choose', value: '' },
        { text: 'United States of America', value: 'US' },
        { text: 'Canada', value: 'CA' }
    ]);
    const phoneCode = makeSelect({ id: 'dial', name: 'phone_country_code' }, [
        { text: '+44', value: '+44' },
        { text: '+1', value: '+1' }
    ]);
    const phone = makeInput({ id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel-national' });
    const terms = makeInput({ id: 'terms', name: 'terms_and_conditions', type: 'checkbox', required: true });
    const newsletter = makeInput({ id: 'news', name: 'newsletter_signup', type: 'checkbox', checked: true });

    const sandbox = buildFillSandbox([address1, address2, city, state, zip, country, phoneCode, phone, terms, newsletter]);
    const result = sandbox.fillForm({
        address: '350 5th Ave, Apt 1201',
        city: 'New York',
        state: 'New York',
        zipCode: '10118',
        country: 'United States',
        phone: '+1 (212) 555-1212'
    });

    assert.equal(address1._v, '350 5th Ave');
    assert.equal(address2._v, 'Apt 1201');
    assert.equal(city._v, 'New York');
    assert.equal(state._v, 'New York');
    assert.equal(zip._v, '10118');
    assert.equal(country.selectedIndex, 1);
    assert.equal(phoneCode.selectedIndex, 1);
    assert.equal(phone._v, '2125551212');
    assert.ok(country._events.includes('input'));
    assert.ok(country._events.includes('change'));
    assert.equal(country.value, 'US');
    assert.equal(terms.checked, true);
    assert.equal(newsletter.checked, false);
    assert.ok(result.filledCount >= 9);
});

test('fillForm does not uncheck required or service notification checkboxes', () => {
    const requiredNewsletter = makeInput({
        id: 'required_news',
        name: 'newsletter_terms_required',
        type: 'checkbox',
        required: true,
        checked: true
    });
    const serviceNotice = makeInput({
        id: 'service_notice',
        name: 'service_notification',
        type: 'checkbox',
        checked: true
    });
    const marketing = makeInput({
        id: 'marketing',
        name: 'marketing_promotions',
        type: 'checkbox',
        checked: true
    });

    const sandbox = buildFillSandbox([requiredNewsletter, serviceNotice, marketing]);
    const result = sandbox.fillForm({});

    assert.equal(requiredNewsletter.checked, true);
    assert.equal(serviceNotice.checked, true);
    assert.equal(marketing.checked, false);
    assert.equal(result.results.checkboxes, 'updated 1 field(s)');
});

test('fillForm matches state and city select aliases', () => {
    const city = makeSelect({ id: 'city', name: 'city', autocomplete: 'address-level2' }, [
        { text: 'Select city', value: '' },
        { text: 'New York City', value: 'nyc' },
        { text: 'Los Angeles', value: 'la' }
    ]);
    const state = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: 'Select state', value: '' },
        { text: 'CA', value: 'CA' },
        { text: 'NY', value: 'NY' }
    ]);
    const jpPrefecture = makeSelect({ id: 'pref', name: 'prefecture', autocomplete: 'address-level1' }, [
        { text: '都道府県', value: '' },
        { text: '東京都', value: '13' },
        { text: '大阪府', value: '27' }
    ]);

    let sandbox = buildFillSandbox([city, state]);
    sandbox.fillForm({
        city: 'New York',
        state: 'California'
    });

    assert.equal(city.selectedIndex, 1);
    assert.equal(state.selectedIndex, 1);

    sandbox = buildFillSandbox([jpPrefecture]);
    sandbox.fillForm({
        state: 'Tokyo'
    });

    assert.equal(jpPrefecture.selectedIndex, 1);
});

test('fillForm matches international region select aliases', () => {
    const australia = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: 'Select state', value: '' },
        { text: 'NSW', value: 'NSW' },
        { text: 'VIC', value: 'VIC' }
    ]);
    const germany = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: 'Bitte auswählen', value: '' },
        { text: 'Bayern', value: 'BY' },
        { text: 'Hessen', value: 'HE' }
    ]);
    const korea = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: '선택', value: '' },
        { text: '경기도', value: 'GG' },
        { text: '서울', value: '11' }
    ]);

    let sandbox = buildFillSandbox([australia]);
    sandbox.fillForm({ state: 'New South Wales' });
    assert.equal(australia.selectedIndex, 1);

    sandbox = buildFillSandbox([germany]);
    sandbox.fillForm({ state: 'Bavaria' });
    assert.equal(germany.selectedIndex, 1);

    sandbox = buildFillSandbox([korea]);
    sandbox.fillForm({ state: 'Gyeonggi' });
    assert.equal(korea.selectedIndex, 1);
});

test('fillForm splits birthday into year month and day selects', () => {
    const year = makeSelect({ id: 'dob-year', name: 'dob_year', autocomplete: 'bday-year' }, [
        { text: 'Year', value: '' },
        { text: '1989', value: '1989' },
        { text: '1990', value: '1990' }
    ]);
    const month = makeSelect({ id: 'dob-month', name: 'dob_month', autocomplete: 'bday-month' }, [
        { text: 'Month', value: '' },
        { text: 'February', value: '2' },
        { text: 'March', value: '3' }
    ]);
    const day = makeSelect({ id: 'dob-day', name: 'dob_day', autocomplete: 'bday-day' }, [
        { text: 'Day', value: '' },
        { text: '7', value: '7' },
        { text: '8', value: '8' }
    ]);

    const sandbox = buildFillSandbox([year, month, day]);
    const result = sandbox.fillForm({
        birthday: '1990-03-07'
    });

    assert.equal(year.selectedIndex, 2);
    assert.equal(month.selectedIndex, 2);
    assert.equal(day.selectedIndex, 1);
    assert.equal(result.results.birthdayParts, 'filled 3 field(s)');
});

test('fillForm splits US phone into area prefix and line fields', () => {
    const area = makeInput({ id: 'phone_area', name: 'phone_area' });
    const prefix = makeInput({ id: 'phone_prefix', name: 'phone_prefix' });
    const line = makeInput({ id: 'phone_line', name: 'phone_line' });

    const sandbox = buildFillSandbox([area, prefix, line]);
    const result = sandbox.fillForm({
        country: 'United States',
        phone: '+1 (212) 555-1212'
    });

    assert.equal(area._v, '212');
    assert.equal(prefix._v, '555');
    assert.equal(line._v, '1212');
    assert.equal(result.results.countryPhoneParts, 'filled 3 field(s)');
});

test('fillForm splits Japan tel1 tel2 tel3 fields', () => {
    const first = makeInput({ id: 'tel1', name: 'tel1' });
    const second = makeInput({ id: 'tel2', name: 'tel2' });
    const third = makeInput({ id: 'tel3', name: 'tel3' });

    const sandbox = buildFillSandbox([first, second, third]);
    const result = sandbox.fillForm({
        country: 'Japan',
        phone: '090-1234-5678'
    });

    assert.equal(first._v, '090');
    assert.equal(second._v, '1234');
    assert.equal(third._v, '5678');
    assert.equal(result.results.countryPhoneParts, 'filled 3 field(s)');
});

test('fillForm matches gender select aliases without male female substring mistakes', () => {
    const gender = makeSelect({ id: 'gender', name: 'gender' }, [
        { text: 'Select', value: '' },
        { text: 'Male', value: 'M' },
        { text: 'Female', value: 'F' }
    ]);

    const sandbox = buildFillSandbox([gender]);
    const result = sandbox.fillForm({
        gender: 'female'
    });

    assert.equal(gender.selectedIndex, 2);
    assert.equal(result.results.gender, 'filled (select)');
});

test('fillForm matches gender radio groups by labels and values', () => {
    const male = makeInput({ id: 'gender_m', name: 'account_gender', type: 'radio', value: '1', labels: ['Male'] });
    const female = makeInput({ id: 'gender_f', name: 'account_gender', type: 'radio', value: '2', labels: ['Female'] });

    const sandbox = buildFillSandbox([male, female]);
    const result = sandbox.fillForm({
        gender: 'female'
    });

    assert.equal(male.checked, false);
    assert.equal(female.checked, true);
    assert.equal(result.results.gender, 'filled (radio)');
});

test('fillForm fills password and confirmation password fields', () => {
    const password = makeInput({ id: 'password', name: 'user_password', type: 'password' });
    const confirm = makeInput({ id: 'password_confirmation', name: 'password_confirmation', type: 'password' });

    const sandbox = buildFillSandbox([password, confirm]);
    const result = sandbox.fillForm({
        password: 'Aa1!example'
    });

    assert.equal(password._v, 'Aa1!example');
    assert.equal(confirm._v, 'Aa1!example');
    assert.equal(result.results.password, 'filled 2 field(s)');
});

test('fillForm does not treat vpn bypass token as password confirmation', () => {
    const password = makeInput({ id: 'password', name: 'password', type: 'password', labels: ['Password'] });
    const confirm = makeInput({ id: 'confirm_password', name: 'confirm_password', type: 'password', labels: ['Confirm Password'] });
    const token = makeInput({ id: 'vpn_bypass_token', name: 'vpn_bypass_token', type: 'text', labels: ['VPN Bypass Token (Optional)'] });

    const sandbox = buildFillSandbox([password, confirm, token]);
    const result = sandbox.fillForm({
        password: 'Aa1!example'
    });

    assert.equal(password._v, 'Aa1!example');
    assert.equal(confirm._v, 'Aa1!example');
    assert.equal(token._v, undefined);
    assert.equal(result.results.password, 'filled 2 field(s)');
});

test('fillForm never uses vpn bypass token as an address or city fallback', () => {
    const password = makeInput({ id: 'password', name: 'password', type: 'password', labels: ['Password'] });
    const confirm = makeInput({ id: 'confirm_password', name: 'confirm_password', type: 'password', labels: ['Confirm Password'] });
    const token = makeInput({ id: 'vpn_bypass_token', name: 'vpn_bypass_token', type: 'text', labels: ['VPN Bypass Token (Optional)'] });

    const sandbox = buildFillSandbox([password, confirm, token]);
    const result = sandbox.fillForm({
        password: 'SamePass123',
        address: '350 5th Ave',
        city: 'New York',
        state: 'New York'
    });

    assert.equal(password._v, 'SamePass123');
    assert.equal(confirm._v, 'SamePass123');
    assert.equal(token._v, undefined);
    assert.equal(result.results.password, 'filled 2 field(s)');
    assert.equal(result.results.addressParts, undefined);
    assert.equal(result.results.city, undefined);
    assert.equal(result.results.state, undefined);
});

test('fillForm only fills two password fields when optional token also has password type', () => {
    const password = makeInput({ id: 'new_password', name: 'new_password', type: 'password', labels: ['Password'] });
    const confirm = makeInput({ id: 'new_password_confirmation', name: 'new_password_confirmation', type: 'password', labels: ['Confirm Password'] });
    const token = makeInput({ id: 'bypass', name: 'vpn_bypass_token', type: 'password', labels: ['VPN Bypass Token (Optional)'] });

    const sandbox = buildFillSandbox([password, confirm, token]);
    const result = sandbox.fillForm({
        password: 'Aa1!example'
    });

    assert.equal(password._v, 'Aa1!example');
    assert.equal(confirm._v, 'Aa1!example');
    assert.equal(token._v, undefined);
    assert.equal(result.results.password, 'filled 2 field(s)');
});

test('fillForm does not fill a second password-like field unless it is explicitly confirmation', () => {
    const password = makeInput({ id: 'new_password', name: 'new_password', type: 'password', labels: ['Password'] });
    const securityPassword = makeInput({ id: 'security_password', name: 'security_password', type: 'password', labels: ['Security Password'] });

    const sandbox = buildFillSandbox([password, securityPassword]);
    const result = sandbox.fillForm({
        password: 'Aa1!example'
    });

    assert.equal(password._v, 'Aa1!example');
    assert.equal(securityPassword._v, undefined);
    assert.equal(result.results.password, 'filled 1 field(s)');
});

test('fillForm does not use ambiguous address verification code as address fallback', async () => {
    const verificationCode = makeInput({ id: 'address_verification_code', name: 'address_verification_code', labels: ['Address Verification Code'] });

    const sandbox = buildFillSandbox([verificationCode]);
    const result = sandbox.fillForm({
        address: '350 5th Ave'
    });

    await new Promise((resolve) => setTimeout(resolve, 1600));

    assert.equal(verificationCode._v, undefined);
    assert.equal(result.results.address, undefined);
});

test('fillForm fills split name fields before full name fallback', () => {
    const first = makeInput({ id: 'given', name: 'given_name', autocomplete: 'given-name' });
    const last = makeInput({ id: 'family', name: 'family_name', autocomplete: 'family-name' });
    const full = makeInput({ id: 'display', name: 'display_name' });

    const sandbox = buildFillSandbox([first, last, full]);
    const result = sandbox.fillForm({
        firstName: 'Jane',
        lastName: 'Miller'
    });

    assert.equal(first._v, 'Jane');
    assert.equal(last._v, 'Miller');
    assert.equal(full._v, undefined);
    assert.equal(result.results.identityParts, 'filled 2 field(s)');
});

test('fillForm fills full name when split name fields are absent', () => {
    const full = makeInput({ id: 'legal-name', name: 'legal_name', autocomplete: 'name' });

    const sandbox = buildFillSandbox([full]);
    const result = sandbox.fillForm({
        firstName: 'Jane',
        lastName: 'Miller'
    });

    assert.equal(full._v, 'Jane Miller');
    assert.equal(result.results.identityParts, 'filled 1 field(s)');
});

test('fillForm does not treat middle or company name as full name fallback', () => {
    const middle = makeInput({ id: 'middle', name: 'middle_name' });
    const company = makeInput({ id: 'company', name: 'company_name' });

    const sandbox = buildFillSandbox([middle, company]);
    const result = sandbox.fillForm({
        firstName: 'Jane',
        lastName: 'Miller'
    });

    assert.equal(middle._v, undefined);
    assert.equal(company._v, undefined);
    assert.equal(result.results.identityParts, undefined);
});

test('fillForm keeps email and username fields separate', () => {
    const email = makeInput({ id: 'login-email', name: 'email_address', type: 'email', autocomplete: 'email' });
    const username = makeInput({ id: 'account-user', name: 'user_id', autocomplete: 'username' });

    const sandbox = buildFillSandbox([email, username]);
    const result = sandbox.fillForm({
        email: 'jane@example.com',
        username: 'janemiller90'
    });

    assert.equal(email._v, 'jane@example.com');
    assert.equal(username._v, 'janemiller90');
    assert.equal(result.results.identityParts, 'filled 2 field(s)');
});

test('fillForm does not fill account email as username', () => {
    const accountEmail = makeInput({ id: 'account-email', name: 'account_email', type: 'email', labels: ['Account Email'] });

    const sandbox = buildFillSandbox([accountEmail]);
    const result = sandbox.fillForm({
        username: 'janemiller90'
    });

    assert.equal(accountEmail._v, undefined);
    assert.equal(result.results.identityParts, undefined);
});

test('fillForm does not fill contact email as phone', () => {
    const contactEmail = makeInput({ id: 'contact-email', name: 'contact_email', type: 'email', labels: ['Contact Email'] });

    const sandbox = buildFillSandbox([contactEmail]);
    const result = sandbox.fillForm({
        phone: '+1 (212) 555-1212'
    });

    assert.equal(contactEmail._v, undefined);
    assert.equal(result.results.countryPhoneParts, undefined);
});

test('fillForm matches labels for special ids', () => {
    const city = makeInput({ id: ':r1.city[0]', name: 'profile[city]' });
    city._allLabels = [makeLabel({ for: ':r1.city[0]', text: 'City' })];

    const sandbox = buildFillSandbox([city]);
    const result = sandbox.fillForm({
        city: 'New York'
    });

    assert.equal(city._v, 'New York');
    assert.equal(result.results.addressParts, 'filled 1 field(s)');
});

test('scanForm joins multiple aria labelledby elements', () => {
    const firstPart = makeLabel({ id: 'shipping', text: 'Shipping' });
    const secondPart = makeLabel({ id: 'postal', text: 'Postal code' });
    const zip = makeInput({ id: 'zip', name: 'z', 'aria-labelledby': 'shipping postal' });
    zip._allLabels = [firstPart, secondPart];

    const sandbox = buildFillSandbox([zip]);
    const result = sandbox.scanForm();

    assert.equal(result.fields.length, 1);
    assert.equal(result.fields[0].label, 'Shipping Postal code');
});

test('fillForm adapts postal code to numeric maxlength fields', () => {
    const zip = makeInput({ id: 'zip', name: 'postal_code', autocomplete: 'postal-code', maxLength: 7, inputMode: 'numeric' });

    const sandbox = buildFillSandbox([zip]);
    const result = sandbox.fillForm({
        zipCode: '160-0022'
    });

    assert.equal(zip._v, '1600022');
    assert.equal(result.results.addressParts, 'filled 1 field(s)');
});

test('fillForm keeps alphanumeric postal code when field allows it', () => {
    const zip = makeInput({ id: 'zip', name: 'postal_code', autocomplete: 'postal-code', maxLength: 7 });

    const sandbox = buildFillSandbox([zip]);
    const result = sandbox.fillForm({
        zipCode: 'M5V 2T6'
    });

    assert.equal(zip._v, 'M5V2T6');
    assert.equal(result.results.addressParts, 'filled 1 field(s)');
});

test('fillForm adapts birthday to yyyymmdd numeric fields', () => {
    const birthday = makeInput({ id: 'birthday', name: 'birth_date', placeholder: 'YYYYMMDD', maxLength: 8, inputMode: 'numeric' });

    const sandbox = buildFillSandbox([birthday]);
    const result = sandbox.fillForm({
        birthday: '1990-03-07'
    });

    assert.equal(birthday._v, '19900307');
    assert.equal(result.results.birthdayParts, 'filled 1 field(s)');
});

test('fillForm adapts phone country code to numeric fields', () => {
    const phoneCode = makeInput({ id: 'dial', name: 'phone_country_code', maxLength: 1, inputMode: 'numeric' });
    const phone = makeInput({ id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel-national' });

    const sandbox = buildFillSandbox([phoneCode, phone]);
    const result = sandbox.fillForm({
        country: 'United States',
        phone: '+1 (212) 555-1212'
    });

    assert.equal(phoneCode._v, '1');
    assert.equal(phone._v, '2125551212');
    assert.equal(result.results.countryPhoneParts, 'filled 2 field(s)');
});

test('fillForm keeps international phone when no country code field exists', () => {
    const phone = makeInput({ id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel' });

    const sandbox = buildFillSandbox([phone]);
    const result = sandbox.fillForm({
        country: 'United States',
        phone: '+1 (212) 555-1212'
    });

    assert.equal(phone._v, '+1 (212) 555-1212');
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');
});

test('fillForm uses national phone for tel-national fields', () => {
    const phone = makeInput({ id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel-national' });

    const sandbox = buildFillSandbox([phone]);
    const result = sandbox.fillForm({
        country: 'United Kingdom',
        phone: '+44 7123 456 789'
    });

    assert.equal(phone._v, '7123456789');
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');
});

test('fillForm respects plus-prefixed phone country code fields', () => {
    const phoneCode = makeInput({ id: 'dial', name: 'phone_country_code', placeholder: '+Code' });
    const phone = makeInput({ id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel-national' });

    const sandbox = buildFillSandbox([phoneCode, phone]);
    const result = sandbox.fillForm({
        country: 'Japan',
        phone: '090-1234-5678'
    });

    assert.equal(phoneCode._v, '+81');
    assert.equal(phone._v, '09012345678');
    assert.equal(result.results.countryPhoneParts, 'filled 2 field(s)');
});

test('fillForm derives numeric phone country code from local phone format', () => {
    const phoneCode = makeInput({ id: 'countryCode', name: 'country_code', type: 'number', autocomplete: 'tel-country-code' });
    const phone = makeInput({ id: 'mobile', name: 'mobile', type: 'tel', autocomplete: 'tel-national', maxLength: 11 });

    const sandbox = buildFillSandbox([phoneCode, phone]);
    const result = sandbox.fillForm({
        country: 'Japan',
        phone: '080-4829-7315'
    });

    assert.equal(phoneCode._v, '81');
    assert.equal(phone._v, '08048297315');
    assert.equal(result.results.countryPhoneParts, 'filled 2 field(s)');
});

test('fillForm treats country_code with country options as country, not phone code', () => {
    const country = makeSelect({ id: 'countryCode', name: 'country_code' }, [
        { text: 'Choose', value: '' },
        { text: 'United States', value: 'US' },
        { text: 'Japan', value: 'JP' }
    ]);
    const phone = makeInput({ id: 'mobile', name: 'mobile', type: 'tel', autocomplete: 'tel-national' });

    const sandbox = buildFillSandbox([country, phone]);
    const result = sandbox.fillForm({
        country: 'Japan',
        phone: '080-4829-7315'
    });

    assert.equal(country.selectedIndex, 2);
    assert.equal(country.value, 'JP');
    assert.equal(phone._v, '08048297315');
    assert.equal(result.results.countryPhoneParts, 'filled 2 field(s)');
});

test('fillForm preserves plus when phone country code field allows it with maxlength', () => {
    const phoneCode = makeInput({ id: 'dialCode', name: 'dial_code', placeholder: '+Code', maxLength: 3 });
    const phone = makeInput({ id: 'mobile', name: 'mobile', type: 'tel', autocomplete: 'tel-national' });

    const sandbox = buildFillSandbox([phoneCode, phone]);
    const result = sandbox.fillForm({
        country: 'United States',
        phone: '+1 (347) 682-9041'
    });

    assert.equal(phoneCode._v, '+1');
    assert.equal(phone._v, '3476829041');
    assert.equal(result.results.countryPhoneParts, 'filled 2 field(s)');
});

test('fillForm skips disabled and placeholder select options', () => {
    const country = makeSelect({ id: 'country', name: 'country', autocomplete: 'country' }, [
        { text: 'Select country', value: '' },
        { text: 'United States', value: 'US', disabled: true },
        { text: 'United States', value: 'USA' }
    ]);

    const sandbox = buildFillSandbox([country]);
    const result = sandbox.fillForm({
        country: 'United States'
    });

    assert.equal(country.selectedIndex, 2);
    assert.equal(country.value, 'USA');
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');
});

test('fillForm avoids short code substring collisions in select options', () => {
    const state = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: 'Select state', value: '' },
        { text: 'Canada', value: 'CA-COUNTRY' },
        { text: 'California', value: 'CA' }
    ]);

    const sandbox = buildFillSandbox([state]);
    const result = sandbox.fillForm({
        state: 'California'
    });

    assert.equal(state.selectedIndex, 2);
    assert.equal(result.results.addressParts, 'filled 1 field(s)');
});

test('fillForm matches select options by data code attributes', () => {
    const country = makeSelect({ id: 'country', name: 'country', autocomplete: 'country' }, [
        { text: 'Choose', value: '' },
        { text: 'US', value: '840', 'data-country-code': 'US' },
        { text: 'Canada', value: '124', 'data-country-code': 'CA' }
    ]);

    const sandbox = buildFillSandbox([country]);
    const result = sandbox.fillForm({
        country: 'United States'
    });

    assert.equal(country.selectedIndex, 1);
    assert.equal(country.value, '840');
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');
});

test('fillForm matches localized country aliases', () => {
    const korea = makeSelect({ id: 'country', name: 'country', autocomplete: 'country' }, [
        { text: 'Select country', value: '' },
        { text: '대한민국', value: 'KR' },
        { text: 'Japan', value: 'JP' }
    ]);
    const taiwan = makeSelect({ id: 'country2', name: 'country2', autocomplete: 'country' }, [
        { text: 'Choose', value: '' },
        { text: '台灣', value: 'TW' },
        { text: 'Hong Kong SAR', value: 'HK' }
    ]);

    let sandbox = buildFillSandbox([korea]);
    let result = sandbox.fillForm({ country: 'South Korea' });
    assert.equal(korea.selectedIndex, 1);
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');

    sandbox = buildFillSandbox([taiwan]);
    result = sandbox.fillForm({ country: 'Taiwan' });
    assert.equal(taiwan.selectedIndex, 1);
    assert.equal(result.results.countryPhoneParts, 'filled 1 field(s)');
});

test('fillForm validation reports missing required fields', () => {
    const email = makeInput({ id: 'email', name: 'email', type: 'email', autocomplete: 'email', required: true });
    const password = makeInput({ id: 'password', name: 'password', type: 'password', required: true });

    const sandbox = buildFillSandbox([email, password]);
    const result = sandbox.fillForm({
        email: 'jane@example.com'
    });

    assert.equal(email._v, 'jane@example.com');
    assert.equal(result.validation.isComplete, false);
    assert.equal(result.validation.missingRequiredFields.length, 1);
    assert.equal(result.validation.missingRequiredFields[0].id, 'password');
});

test('fillForm validation treats filled requested fields as complete', () => {
    const email = makeInput({ id: 'email', name: 'email', type: 'email', autocomplete: 'email', required: true });
    const password = makeInput({ id: 'password', name: 'password', type: 'password', required: true });

    const sandbox = buildFillSandbox([email, password]);
    const result = sandbox.fillForm({
        email: 'jane@example.com',
        password: 'Aa1!example'
    });

    assert.equal(result.validation.isComplete, true);
    assert.equal(result.validation.missingRequiredFields.length, 0);
    assert.equal(result.validation.unfilledRequestedFields.length, 0);
});

test('fillForm validation reports requested select left on placeholder', () => {
    const state = makeSelect({ id: 'state', name: 'state', autocomplete: 'address-level1' }, [
        { text: 'Select state', value: '' },
        { text: 'Ontario', value: 'ON' }
    ]);

    const sandbox = buildFillSandbox([state]);
    const result = sandbox.fillForm({
        state: 'California'
    });

    assert.equal(state.selectedIndex, -1);
    assert.equal(result.validation.isComplete, false);
    assert.equal(result.validation.unfilledRequestedFields.length, 1);
    assert.equal(result.validation.unfilledRequestedFields[0].field, 'state');
    assert.equal(result.validation.unfilledRequestedFields[0].requestedValue, 'California');
    assert.deepEqual(
        JSON.parse(JSON.stringify(result.validation.unfilledRequestedFields[0].candidates[0].options)),
        [{ text: 'Ontario', value: 'ON', code: '' }]
    );
    assert.equal(result.diagnostics.fieldIssues[0].reason, 'select_option_not_matched');
    assert.equal(result.diagnostics.fieldIssues[0].requestedValue, 'California');
});

test('fillForm diagnostics captures page alert and aria invalid field messages', () => {
    const emailHelp = makeLabel({ id: 'email_error_text', text: 'Email is invalid' });
    const email = makeInput({
        id: 'email',
        name: 'email',
        type: 'email',
        autocomplete: 'email',
        value: 'bad@example',
        'aria-invalid': 'true',
        'aria-describedby': 'email_error_text',
        validationMessage: 'Please enter a valid email address',
        validity: { valid: false },
        matches: { ':invalid': true }
    });
    email._allLabels = [emailHelp];
    const alert = makeErrorNode('Postal code is invalid', { role: 'alert' });

    const sandbox = buildFillSandbox([email, alert]);
    const result = sandbox.fillForm({});

    assert.equal(result.diagnostics.isClean, false);
    assert.equal(result.diagnostics.summary.pageErrorCount, 2);
    assert.equal(result.diagnostics.pageErrors[0].source, 'aria-invalid');
    assert.equal(result.diagnostics.pageErrors.some((error) => error.text === 'Postal code is invalid'), true);
});

test('fillForm validation reports required radio groups once', () => {
    const first = makeInput({ id: 'plan_basic', name: 'plan', type: 'radio', value: 'basic', required: true });
    const second = makeInput({ id: 'plan_pro', name: 'plan', type: 'radio', value: 'pro', required: true });

    let sandbox = buildFillSandbox([first, second]);
    let result = sandbox.fillForm({});

    assert.equal(result.validation.isComplete, false);
    assert.equal(result.validation.missingRequiredFields.length, 1);
    assert.equal(result.validation.missingRequiredFields[0].id, 'plan_basic');

    second.checked = true;
    sandbox = buildFillSandbox([first, second]);
    result = sandbox.fillForm({});

    assert.equal(result.validation.isComplete, true);
    assert.equal(result.validation.missingRequiredFields.length, 0);
});

test('fillForm ignores hidden and aria disabled fields', () => {
    const hiddenEmail = makeInput({ id: 'hidden_email', name: 'email', type: 'email', hidden: true });
    const disabledEmail = makeInput({ id: 'disabled_email', name: 'email', type: 'email', 'aria-disabled': 'true' });
    const visibleEmail = makeInput({ id: 'visible_email', name: 'email', type: 'email', autocomplete: 'email' });

    const sandbox = buildFillSandbox([hiddenEmail, disabledEmail, visibleEmail]);
    const result = sandbox.fillForm({
        email: 'jane@example.com'
    });

    assert.equal(hiddenEmail._v, undefined);
    assert.equal(disabledEmail._v, undefined);
    assert.equal(visibleEmail._v, 'jane@example.com');
    assert.equal(result.validation.isComplete, true);
});

test('fillForm ignores aria hidden, zero size, and disabled container fields', () => {
    const ariaHiddenEmail = makeInput({ id: 'aria_hidden_email', name: 'email', type: 'email', 'aria-hidden': 'true' });
    const zeroWidthEmail = makeInput({ id: 'zero_width_email', name: 'email', type: 'email', rect: { width: 0, height: 20 } });
    const containerDisabledEmail = makeInput({ id: 'container_disabled_email', name: 'email', type: 'email', closest: { '[disabled]': {} } });
    const visibleEmail = makeInput({ id: 'visible_email', name: 'email', type: 'email', autocomplete: 'email' });

    const sandbox = buildFillSandbox([ariaHiddenEmail, zeroWidthEmail, containerDisabledEmail, visibleEmail]);
    const result = sandbox.fillForm({
        email: 'jane@example.com'
    });

    assert.equal(ariaHiddenEmail._v, undefined);
    assert.equal(zeroWidthEmail._v, undefined);
    assert.equal(containerDisabledEmail._v, undefined);
    assert.equal(visibleEmail._v, 'jane@example.com');
    assert.equal(result.validation.isComplete, true);
});

test('fillForm validation ignores readonly required fields', () => {
    const readonlyEmail = makeInput({ id: 'readonly_email', name: 'email', type: 'email', required: true, readOnly: true });

    const sandbox = buildFillSandbox([readonlyEmail]);
    const result = sandbox.fillForm({});

    assert.equal(result.validation.isComplete, true);
    assert.equal(result.validation.missingRequiredFields.length, 0);
});

test('fillForm validation ignores aria readonly required fields', () => {
    const readonlyEmail = makeInput({ id: 'readonly_email', name: 'email', type: 'email', required: true, 'aria-readonly': 'true' });

    const sandbox = buildFillSandbox([readonlyEmail]);
    const result = sandbox.fillForm({});

    assert.equal(result.validation.isComplete, true);
    assert.equal(result.validation.missingRequiredFields.length, 0);
});

test('scanForm skips non fillable fields', () => {
    const hiddenEmail = makeInput({ id: 'hidden_email', name: 'email', type: 'email', hidden: true });
    const inertEmail = makeInput({ id: 'inert_email', name: 'email', type: 'email', closest: { '[inert]': {} } });
    const visibleEmail = makeInput({ id: 'visible_email', name: 'email', type: 'email' });

    const sandbox = buildFillSandbox([hiddenEmail, inertEmail, visibleEmail]);
    const result = sandbox.scanForm();

    assert.equal(result.fields.map((field) => field.id).join(','), 'visible_email');
});

test('scanForm skips vpn bypass token fields', () => {
    const token = makeInput({ id: 'vpn_bypass_token', name: 'vpn_bypass_token', labels: ['VPN Bypass Token (Optional)'] });

    const sandbox = buildFillSandbox([token]);
    const result = sandbox.scanForm();

    assert.equal(result.fields.length, 0);
});

test('fillFormSmart skips readonly and aria disabled mapped fields', async () => {
    const readonlyEmail = makeInput({ id: 'readonly_email', name: 'email', type: 'email', readOnly: true });
    const disabledPhone = makeInput({ id: 'disabled_phone', name: 'phone', type: 'tel', 'aria-disabled': 'true' });

    const sandbox = buildFillSandbox([readonlyEmail, disabledPhone]);
    const result = await sandbox.fillFormSmart({
        readonly_email: 'jane@example.com',
        disabled_phone: '2125551212'
    }, { diagnosticDelays: [] });

    assert.equal(readonlyEmail._v, undefined);
    assert.equal(disabledPhone._v, undefined);
    assert.equal(result.filledCount, 0);
    assert.equal(result.results.readonly_email, 'not found');
    assert.equal(result.results.disabled_phone, 'not found');
});

test('fillFormSmart skips vpn bypass token mappings', async () => {
    const token = makeInput({ id: 'vpn_bypass_token', name: 'vpn_bypass_token', labels: ['VPN Bypass Token (Optional)'] });

    const sandbox = buildFillSandbox([token]);
    const result = await sandbox.fillFormSmart({
        vpn_bypass_token: 'New York'
    }, { diagnosticDelays: [] });

    assert.equal(token._v, undefined);
    assert.equal(result.filledCount, 0);
    assert.equal(result.results.vpn_bypass_token, 'not found');
});

test('fillFormWithDynamicRetry fills fields revealed after country change', async () => {
    const country = makeSelect({ id: 'country', name: 'country', autocomplete: 'country' }, [
        { text: 'Select country', value: '' },
        { text: 'United States', value: 'US' }
    ]);
    const zip = makeInput({ id: 'zip', name: 'postal_code', autocomplete: 'postal-code' });
    let revealed = false;
    const baseDispatch = country.dispatchEvent.bind(country);
    country.dispatchEvent = (event) => {
        baseDispatch(event);
        if (event.type === 'change') {
            setTimeout(() => {
                revealed = true;
            }, 5);
        }
    };

    const sandbox = buildFillSandbox(() => revealed ? [country, zip] : [country]);
    const result = await sandbox.fillFormWithDynamicRetry({
        country: 'United States',
        zipCode: '10118'
    }, { retryDelays: [10, 20], diagnosticDelays: [] });

    assert.equal(country.selectedIndex, 1);
    assert.equal(zip._v, '10118');
    assert.equal(result.validation.isComplete, true);
    assert.equal(country._events.filter((event) => event === 'change').length, 1);
    assert.ok(result.dynamicPasses >= 2);
});

test('fillFormWithDynamicRetry captures delayed page validation errors', async () => {
    const email = makeInput({ id: 'email', name: 'email', type: 'email', autocomplete: 'email' });
    const baseDispatch = email.dispatchEvent.bind(email);

    email.dispatchEvent = (event) => {
        baseDispatch(event);
        if (event.type === 'blur') {
            setTimeout(() => {
                email.setAttribute('aria-invalid', 'true');
                email.validationMessage = 'Email domain is not accepted';
                email.validity = { valid: false };
            }, 5);
        }
    };

    const sandbox = buildFillSandbox([email]);
    const result = await sandbox.fillFormWithDynamicRetry({
        email: 'jane@example.com'
    }, {
        retryDelays: [],
        diagnosticDelays: [10]
    });

    assert.equal(email._v, 'jane@example.com');
    assert.equal(result.diagnostics.isClean, false);
    assert.equal(result.diagnostics.summary.pageErrorCount, 1);
    assert.equal(result.diagnostics.pageErrors[0].text, 'Email domain is not accepted');
    assert.equal(result.diagnostics.pageErrors[0].source, 'aria-invalid');
    assert.equal(result.diagnosticPasses, 2);
});
