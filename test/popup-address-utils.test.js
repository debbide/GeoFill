const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUtilsSandbox(overrides = {}) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'popup', 'js', 'utils.js'), 'utf8');
    const generatedCalls = [];
    const sandbox = {
        console,
        URL,
        setTimeout: () => {},
        document: {
            createElement: () => ({ textContent: '', innerHTML: '' })
        },
        elements: {
            useAddressApiToggle: { checked: overrides.addressApiEnabled === true },
            toast: {
                textContent: '',
                classList: {
                    add: () => {},
                    remove: () => {}
                }
            }
        },
        chrome: {
            permissions: {
                contains: async () => overrides.hasAddressApiPermission === true,
                request: async () => overrides.grantAddressApiPermission === true
            },
            storage: {
                local: {
                    set: async () => {}
                }
            }
        },
        lockedFields: new Set(overrides.lockedFields || []),
        userSettings: {
            geoapifyKey: overrides.geoapifyKey || ''
        },
        selfHostedAddrUrl: overrides.selfHostedAddrUrl || '',
        currentData: {
            address: '350 5th Ave',
            city: 'New York',
            state: 'New York',
            zipCode: '10118',
            country: 'United States',
            addressSource: 'local_verified',
            addressConfidence: 'high',
            addressLastUpdatedAt: '2026-05-10T00:00:00.000Z',
            ...(overrides.currentData || {})
        },
        window: {
            generators: {
                normalizeCountry: (country) => country === 'USA' ? 'United States' : country,
                generateAddressAsync: async (...args) => {
                    generatedCalls.push(args);
                    return {
                        address: '1 Market St',
                        city: args[1],
                        state: args[2].locationContext.state,
                        zipCode: args[2].locationContext.zipCode,
                        country: args[0],
                        source: 'local_verified',
                        confidence: 'high'
                    };
                }
            }
        },
        navigator: {
            clipboard: {
                writeText: async () => {}
            }
        },
        log: {
            error: () => {},
            info: () => {}
        },
        saveAddressApiToggle: async () => {}
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { sandbox, generatedCalls };
}

test('applyGeneratedAddress respects locked country and location fields', () => {
    const { sandbox } = loadUtilsSandbox({
        lockedFields: ['country', 'city', 'state', 'zipCode'],
        currentData: {
            country: 'Canada',
            city: 'Toronto',
            state: 'Ontario',
            zipCode: 'M5B 2L7'
        }
    });

    const changed = sandbox.applyGeneratedAddress({
        address: '1 Market St',
        city: 'San Francisco',
        state: 'California',
        zipCode: '94105',
        country: 'United States',
        source: 'local_verified',
        confidence: 'high'
    }, { forceAddress: true });

    assert.equal(changed, true);
    assert.equal(sandbox.currentData.address, '1 Market St');
    assert.equal(sandbox.currentData.country, 'Canada');
    assert.equal(sandbox.currentData.city, 'Toronto');
    assert.equal(sandbox.currentData.state, 'Ontario');
    assert.equal(sandbox.currentData.zipCode, 'M5B 2L7');
});

test('generateAddressForCurrentContext skips existing high-confidence matching address', async () => {
    const { sandbox, generatedCalls } = loadUtilsSandbox();

    const result = await sandbox.generateAddressForCurrentContext({}, { allowApi: true });

    assert.equal(result, null);
    assert.equal(generatedCalls.length, 0);
});

test('generateAddressForCurrentContext uses locked location values', async () => {
    const { sandbox, generatedCalls } = loadUtilsSandbox({
        lockedFields: ['city', 'state', 'zipCode'],
        currentData: {
            city: 'Random City',
            state: 'Random State',
            zipCode: '99999',
            addressSource: 'synthetic',
            addressConfidence: 'low'
        }
    });

    const result = await sandbox.generateAddressForCurrentContext({
        city: 'Toronto',
        state: 'Ontario',
        zipCode: 'M5B 2L7'
    }, {
        allowApi: false
    });

    assert.equal(result.city, 'Toronto');
    assert.equal(generatedCalls.length, 1);
    assert.equal(generatedCalls[0][1], 'Toronto');
    assert.equal(generatedCalls[0][2].allowApi, false);
    assert.equal(generatedCalls[0][2].requireCityMatch, true);
    assert.equal(generatedCalls[0][2].locationContext.state, 'Ontario');
    assert.equal(generatedCalls[0][2].locationContext.zipCode, 'M5B 2L7');
});

test('generateAddressForCurrentContext disables external address API by default', async () => {
    const { sandbox, generatedCalls } = loadUtilsSandbox({
        currentData: {
            addressSource: 'synthetic',
            addressConfidence: 'low'
        }
    });

    await sandbox.generateAddressForCurrentContext({}, { forceRefresh: true });

    assert.equal(generatedCalls.length, 1);
    assert.equal(generatedCalls[0][2].allowApi, false);
});

test('shouldUseAddressApi requires enabled toggle and host permissions', async () => {
    let loaded = loadUtilsSandbox({
        addressApiEnabled: false,
        grantAddressApiPermission: true
    });

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true }), false);

    loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        hasAddressApiPermission: true
    });

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true }), true);

    loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        grantAddressApiPermission: false
    });

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true }), false);
    assert.equal(loaded.sandbox.elements.useAddressApiToggle.checked, false);
});

test('shouldUseAddressApi does not request permissions during passive checks', async () => {
    let requestCount = 0;
    const loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        geoapifyKey: 'demo-key',
        grantAddressApiPermission: true
    });

    loaded.sandbox.chrome.permissions.contains = async () => false;
    loaded.sandbox.chrome.permissions.request = async () => {
        requestCount++;
        return true;
    };

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true }), false);
    assert.equal(requestCount, 0);
});

test('shouldUseAddressApi requests Geoapify permission only when explicitly asked', async () => {
    const permissionTargets = [];
    const loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        geoapifyKey: 'demo-key',
        grantAddressApiPermission: true
    });

    loaded.sandbox.chrome.permissions.contains = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return false;
    };
    loaded.sandbox.chrome.permissions.request = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return true;
    };

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true, requestPermission: true }), true);
    assert.equal(permissionTargets.some((origin) => origin.includes('api.geoapify.com')), true);
    assert.equal(permissionTargets.some((origin) => origin.includes('nominatim.openstreetmap.org')), true);
});

test('shouldUseAddressApi requests self-hosted origin when configured', async () => {
    const permissionTargets = [];
    const loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        selfHostedAddrUrl: 'http://192.168.1.10:8787',
        grantAddressApiPermission: true
    });

    loaded.sandbox.chrome.permissions.contains = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return false;
    };
    loaded.sandbox.chrome.permissions.request = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return true;
    };

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true, requestPermission: true }), true);
    assert.equal(permissionTargets.some((origin) => origin.includes('192.168.1.10:8787')), true);
    assert.equal(permissionTargets.some((origin) => origin.includes('nominatim.openstreetmap.org')), true);
});

test('shouldUseAddressApi skips self-hosted origin when not configured', async () => {
    const permissionTargets = [];
    const loaded = loadUtilsSandbox({
        addressApiEnabled: true,
        grantAddressApiPermission: true
    });

    loaded.sandbox.chrome.permissions.contains = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return false;
    };
    loaded.sandbox.chrome.permissions.request = async ({ origins }) => {
        permissionTargets.push(origins[0]);
        return true;
    };

    assert.equal(await loaded.sandbox.shouldUseAddressApi({ allowApi: true, requestPermission: true }), true);
    assert.equal(permissionTargets.some((origin) => origin.includes('192.168')), false);
});
