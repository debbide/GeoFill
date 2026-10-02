const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGeneratorsWithFetch(fetchImpl) {
    const poolCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'address-pool.js'), 'utf8');
    const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'generators.js'), 'utf8');
    const sandbox = {
        console,
        Math,
        URLSearchParams,
        fetch: fetchImpl,
        window: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(poolCode, sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.generators;
}

const EN_COMPONENTS = {
    houseNumber: '4019',
    street: 'Aikins Avenue Southwest',
    locality: 'Seattle',
    admin1: 'Washington',
    admin1Code: 'WA',
    postcode: '98116'
};

function generateResponse(overrides = {}) {
    return {
        data: {
            country: 'US',
            filterMatchLevel: 'exact',
            result: {
                address: {
                    id: 'pool-v2-addr-0172',
                    countryCode: 'US',
                    formattedAddress: '4019 Aikins Avenue Southwest, Seattle, WA, 98116',
                    matchLevel: 'premise',
                    propertyType: 'residential',
                    componentVariants: { en: { ...EN_COMPONENTS }, native: { ...EN_COMPONENTS } },
                    components: { ...EN_COMPONENTS },
                    ...overrides
                }
            }
        }
    };
}

function okFetch(response, capture) {
    return async (url, options) => {
        if (capture) capture.push({ url, options });
        return {
            ok: true,
            status: 200,
            json: async () => response
        };
    };
}

test('fetchAddressFromSelfHosted maps /generate response to GeoFill fields', async () => {
    const calls = [];
    const g = loadGeneratorsWithFetch(okFetch(generateResponse(), calls));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787/', 'test-token');

    const result = await g.fetchAddressFromSelfHosted('United States', 'Seattle');

    assert.equal(result.address, '4019 Aikins Avenue Southwest');
    assert.equal(result.city, 'Seattle');
    assert.equal(result.state, 'WA');
    assert.equal(result.zipCode, '98116');
    assert.equal(result.country, 'United States');
    assert.equal(result.source, 'selfhosted');
    assert.equal(result.confidence, 'high');

    // 请求打到 /api/v1/generate，带国家代码、城市筛选和 Bearer token
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith('http://192.168.1.10:8787/api/v1/generate?'));
    assert.ok(calls[0].url.includes('country=US'));
    assert.ok(calls[0].url.includes('city=Seattle'));
    assert.equal(calls[0].options.headers['Authorization'], 'Bearer test-token');
});

test('fetchAddressFromSelfHosted returns null when not configured', async () => {
    let called = false;
    const g = loadGeneratorsWithFetch(async () => { called = true; return { ok: true, json: async () => ({}) }; });

    assert.equal(await g.fetchAddressFromSelfHosted('United States', 'Seattle'), null);
    assert.equal(called, false);
});

test('fetchAddressFromSelfHosted returns null on NO_POOL_COVERAGE', async () => {
    const g = loadGeneratorsWithFetch(async () => ({ ok: false, status: 404 }));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    assert.equal(await g.fetchAddressFromSelfHosted('United States', 'NoSuchCity'), null);
});

test('fetchAddressFromSelfHosted falls back to formattedAddress when components are empty', async () => {
    const g = loadGeneratorsWithFetch(okFetch(generateResponse({
        componentVariants: { en: {}, native: {} },
        components: {}
    })));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    const result = await g.fetchAddressFromSelfHosted('United States', 'Seattle');
    assert.equal(result.address, '4019 Aikins Avenue Southwest, Seattle, WA, 98116');
});

test('street-level matchLevel maps to medium confidence', async () => {
    const g = loadGeneratorsWithFetch(okFetch(generateResponse({ matchLevel: 'street' })));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    const result = await g.fetchAddressFromSelfHosted('Germany', 'Berlin');
    assert.equal(result.confidence, 'medium');
    assert.equal(result.country, 'Germany');
});

test('generateAddressAsync prefers self-hosted over the local pool when configured', async () => {
    const g = loadGeneratorsWithFetch(okFetch(generateResponse()));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    const result = await g.generateAddressAsync('United States', 'Seattle', { allowApi: true });
    assert.equal(result.source, 'selfhosted');
    assert.equal(result.address, '4019 Aikins Avenue Southwest');
});

test('generateAddressAsync falls back to local pool when self-hosted is not configured', async () => {
    const g = loadGeneratorsWithFetch(okFetch(generateResponse()));

    const result = await g.generateAddressAsync('United States', '', { allowApi: true });
    assert.equal(result.source, 'local_verified');
});

test('generateAddressAsync retries country-wide when city filter has no coverage', async () => {
    const calls = [];
    const g = loadGeneratorsWithFetch(async (url, options) => {
        calls.push(url);
        if (url.includes('city=')) return { ok: false, status: 404 };
        return { ok: true, status: 200, json: async () => generateResponse() };
    });
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    const result = await g.generateAddressAsync('United States', 'NoSuchCity', { allowApi: true });
    assert.equal(result.source, 'selfhosted');
    assert.equal(calls.length, 2);
    assert.ok(!calls[1].includes('city='));
});

test('generateAddressAsync drops mismatched city result when requireCityMatch', async () => {
    const g = loadGeneratorsWithFetch(okFetch(generateResponse()));
    g.setSelfHostedAddressConfig('http://192.168.1.10:8787', 'test-token');

    // 请求 Los Angeles，但服务返回 Seattle：requireCityMatch 时不采用
    const result = await g.generateAddressAsync('United States', 'Los Angeles', {
        allowApi: true,
        requireCityMatch: true
    });
    assert.notEqual(result.source, 'selfhosted');
});
