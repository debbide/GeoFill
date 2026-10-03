const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAiHelpers() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'popup', 'js', 'ai.js'), 'utf8');
    const sandbox = {
        console,
        FIELD_NAMES: [
            'firstName', 'lastName', 'gender', 'birthday',
            'username', 'email', 'password', 'phone',
            'address', 'city', 'state', 'zipCode', 'country'
        ]
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

const LOCKED_SAMPLE = {
    firstName: 'Real', lastName: 'Person', gender: 'female',
    birthday: '1990-01-01', username: 'realuser', email: 'real@example.com',
    password: 'secret', phone: '+1 555 0100', address: '1 Real Street',
    city: 'Realville', state: 'Realstate', zipCode: '00000', country: 'United States'
};

test('AI prompt drops sensitive locked fields but keeps generation context', () => {
    const { omitSensitiveLockedFields } = loadAiHelpers();

    const safe = omitSensitiveLockedFields(LOCKED_SAMPLE);

    assert.deepEqual(JSON.parse(JSON.stringify(safe)), { gender: 'female', country: 'United States' });
    const serialized = JSON.stringify(safe);
    for (const leaked of ['Real', 'Person', 'real@example.com', 'secret', 'Realville', '1990-01-01']) {
        assert.ok(!serialized.includes(leaked), `prompt leaked locked value: ${leaked}`);
    }
});

test('AI prompt helper tolerates empty input', () => {
    const { omitSensitiveLockedFields } = loadAiHelpers();

    assert.deepEqual(JSON.parse(JSON.stringify(omitSensitiveLockedFields({}))), {});
    assert.deepEqual(JSON.parse(JSON.stringify(omitSensitiveLockedFields(null))), {});
    assert.deepEqual(JSON.parse(JSON.stringify(omitSensitiveLockedFields(undefined))), {});
});
