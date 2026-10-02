const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFormFillSandbox() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'popup', 'js', 'form-fill.js'), 'utf8');

    const sandbox = {
        console,
        FIELD_NAMES: [
            'firstName', 'lastName', 'gender', 'birthday',
            'username', 'email', 'password', 'phone',
            'address', 'city', 'state', 'zipCode', 'country'
        ],
        currentData: {
            password: 'StrongP@ss1',
            email: 'john@example.com',
            phone: '+1 (212) 555-1212',
            zipCode: '10001'
        },
        ipData: { country: 'United States' },
        userSettings: {},
        window: {
            generators: {
                generatePasswordWithSettings: () => 'FallbackP@ss2',
                generatePhone: () => '+1 (310) 555-0101'
            }
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

test('sanitizeAiFormMapping filters unknown keys and normalizes values', () => {
    const s = loadFormFillSandbox();
    const scanResult = {
        fields: [
            { id: 'email_field', name: 'email', type: 'email', label: 'Email' },
            { id: 'zip_field', name: 'zip', type: 'text', label: 'Zip Code' }
        ]
    };

    const raw = {
        email_field: ' USER@EXAMPLE.COM ',
        unknown_field: 'bad',
        zip_field: 90210,
        obj_field: { x: 1 },
        field_3: 'ok'
    };

    const out = s.sanitizeAiFormMapping(raw, scanResult);
    assert.equal(out.email_field, 'USER@EXAMPLE.COM');
    assert.equal(out.zip_field, '90210');
    assert.equal(out.field_3, 'ok');
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'unknown_field'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'obj_field'), false);
});

test('sanitizeFormMapping enforces password/email/phone/zip normalization', () => {
    const s = loadFormFillSandbox();
    const scanResult = {
        fields: [
            { id: 'pwd', name: 'password', type: 'password', label: 'Password' },
            { id: 'mail', name: 'email', type: 'email', label: 'Email' },
            { id: 'tel', name: 'phone', type: 'tel', label: 'Phone' },
            { id: 'zip', name: 'zip', type: 'text', label: 'Zip Code' }
        ]
    };

    const mapping = {
        pwd: 'aaa',
        mail: 'not-an-email',
        tel: 'abc',
        zip: '***'
    };

    s.sanitizeFormMapping(mapping, scanResult);
    assert.equal(mapping.pwd, 'StrongP@ss1');
    assert.equal(mapping.mail, 'john@example.com');
    assert.equal(mapping.tel, '+1 (212) 555-1212');
    assert.equal(mapping.zip, '10001');
});

test('sanitizeFormMapping skips optional token and bypass fields', () => {
    const s = loadFormFillSandbox();
    const scanResult = {
        fields: [
            { id: 'pwd', name: 'password', type: 'password', label: 'Password' },
            { id: 'confirm', name: 'password_confirmation', type: 'password', label: 'Confirm Password' },
            { id: 'vpn', name: 'vpn_bypass_token', type: 'text', label: 'VPN Bypass Token (Optional)' },
            { id: 'invite', name: 'invite_code', type: 'text', label: 'Invite Code (Optional)' }
        ]
    };

    const mapping = {
        pwd: 'aaa',
        confirm: 'bbb',
        vpn: 'should-not-fill',
        invite: 'also-skip'
    };

    s.sanitizeFormMapping(mapping, scanResult);
    assert.equal(mapping.pwd, 'StrongP@ss1');
    assert.equal(mapping.confirm, 'StrongP@ss1');
    assert.equal(Object.prototype.hasOwnProperty.call(mapping, 'vpn'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(mapping, 'invite'), false);
});

test('sanitizeAiFormMapping filters optional token mappings', () => {
    const s = loadFormFillSandbox();
    const scanResult = {
        fields: [
            { id: 'pwd', name: 'password', type: 'password', label: 'Password' },
            { id: 'vpn', name: 'vpn_bypass_token', type: 'text', label: 'VPN Bypass Token (Optional)' }
        ]
    };

    const out = s.sanitizeAiFormMapping({
        pwd: 'StrongP@ss1',
        vpn: 'token-value'
    }, scanResult);

    assert.equal(out.pwd, 'StrongP@ss1');
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'vpn'), false);
});

test('buildFillResultMessage summarizes validation issues', () => {
    const s = loadFormFillSandbox();

    const ok = s.buildFillResultMessage({
        filledCount: 8,
        validation: {
            isComplete: true,
            missingRequiredFields: [],
            unfilledRequestedFields: []
        }
    });
    assert.equal(ok, '填表完成，已填 8 个字段');

    const withIssues = s.buildFillResultMessage({
        filledCount: 5,
        validation: {
            isComplete: false,
            missingRequiredFields: [{ id: 'password' }],
            unfilledRequestedFields: [{ field: 'state' }, { field: 'phone' }]
        }
    }, '普通填表完成');
    assert.equal(withIssues, '普通填表完成，已填 5 个字段，仍有 1 个必填项未填、2 个字段未匹配');
});

test('buildFillResultMessage includes diagnostics details', () => {
    const s = loadFormFillSandbox();

    const message = s.buildFillResultMessage({
        filledCount: 4,
        validation: {
            isComplete: false,
            missingRequiredFields: [],
            unfilledRequestedFields: [{ field: 'state' }]
        },
        diagnostics: {
            fieldIssues: [{ reason: 'select_option_not_matched' }],
            pageErrors: [{ text: 'Postal code is invalid' }]
        }
    }, '普通填表完成');

    assert.equal(message, '普通填表完成，已填 4 个字段，仍有 1 个字段未匹配，其中 1 个下拉无匹配项、页面提示 1 条错误');
});

test('buildFillReport translates diagnostics into readable items', () => {
    const s = loadFormFillSandbox();

    const report = s.buildFillReport({
        filledCount: 4,
        validation: {
            isComplete: false,
            missingRequiredFields: [{ id: 'password', label: 'Password' }],
            unfilledRequestedFields: [{ field: 'state' }]
        },
        diagnostics: {
            isClean: false,
            fieldIssues: [
                {
                    kind: 'requested_unfilled',
                    field: 'state',
                    label: 'State',
                    reason: 'select_option_not_matched',
                    requestedValue: 'California',
                    candidates: [{
                        label: 'State / Province',
                        type: 'select-one',
                        options: [
                            { text: 'Ontario', value: 'ON' },
                            { text: 'Quebec', value: 'QC' }
                        ]
                    }]
                },
                {
                    kind: 'required_missing',
                    field: 'password',
                    label: 'Password',
                    reason: 'required_field_empty'
                }
            ],
            pageErrors: [{ text: 'Postal code is invalid', source: 'alert' }]
        }
    }, '普通填表完成');

    assert.equal(report.hasIssues, true);
    assert.equal(report.title, '填写报告：有需检查的项');
    assert.equal(report.summary, '普通填表完成，已填 4 个字段，1 个必填未填，1 个字段未匹配，1 条页面错误');
    assert.equal(JSON.stringify(report.items.map((item) => item.title)), JSON.stringify(['State', 'Password', '页面错误提示']));
    assert.equal(report.items[0].detail, '下拉没有匹配项 | 想填: California | 页面可选: Ontario, Quebec | 候选字段: State / Province');
    assert.equal(report.items[1].detail, '必填项未填');
    assert.equal(report.items[2].detail, 'Postal code is invalid');
});

test('buildFillReport marks clean result as closeable', () => {
    const s = loadFormFillSandbox();

    const report = s.buildFillReport({
        filledCount: 8,
        validation: {
            isComplete: true,
            missingRequiredFields: [],
            unfilledRequestedFields: []
        },
        diagnostics: {
            isClean: true,
            fieldIssues: [],
            pageErrors: []
        }
    });

    assert.equal(report.hasIssues, false);
    assert.equal(report.title, '填写报告：未发现问题');
    assert.equal(report.summary, '填表完成，已填 8 个字段，未发现明显问题');
    assert.equal(report.items.length, 0);
});

test('mergeScanResults 合并多 frame 的字段列表', () => {
    const s = loadFormFillSandbox();
    const merged = s.mergeScanResults([
        { fields: [{ id: 'a' }], pageContext: { title: 'T' } },
        { fields: [{ id: 'b' }, { id: 'c' }] },
        null
    ]);
    assert.equal(merged.fields.length, 3);
    assert.equal(merged.pageContext.title, 'T');
});

test('mergeFillResults 累加 filledCount 并拼接问题列表', () => {
    const s = loadFormFillSandbox();
    const merged = s.mergeFillResults([
        {
            filledCount: 5,
            validation: { missingRequiredFields: ['email'], unfilledRequestedFields: [] },
            diagnostics: { pageErrors: [], fieldIssues: [{ reason: 'x' }] }
        },
        {
            filledCount: 3,
            validation: { missingRequiredFields: [], unfilledRequestedFields: ['phone'] },
            diagnostics: { pageErrors: ['err'], fieldIssues: [] }
        }
    ]);
    assert.equal(merged.filledCount, 8);
    // vm 沙盒内创建的数组与外部 realm 原型不同，先展开再比较
    assert.deepEqual([...merged.validation.missingRequiredFields], ['email']);
    assert.deepEqual([...merged.validation.unfilledRequestedFields], ['phone']);
    assert.deepEqual([...merged.diagnostics.pageErrors], ['err']);
    assert.equal(merged.diagnostics.fieldIssues.length, 1);
});

test('mergeFillResults 兼容单结果（非广播）输入', () => {
    const s = loadFormFillSandbox();
    const single = { filledCount: 4, validation: {}, diagnostics: {} };
    const merged = s.mergeFillResults(single);
    assert.equal(merged.filledCount, 4);
});
