const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGenerators() {
    const poolCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'address-pool.js'), 'utf8');
    const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'generators.js'), 'utf8');
    const sandbox = {
        console,
        Math,
        window: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(poolCode, sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.generators;
}

test('generateAllInfoWithSettings returns required fields', () => {
    const g = loadGenerators();
    const data = g.generateAllInfoWithSettings({ country: 'United States', city: '', region: '' }, { minAge: 20, maxAge: 40 });

    const required = ['firstName', 'lastName', 'gender', 'birthday', 'username', 'email', 'password', 'phone', 'address', 'city', 'state', 'zipCode', 'country', 'addressSource', 'addressConfidence', 'addressLastUpdatedAt'];
    required.forEach((key) => {
        assert.ok(Object.prototype.hasOwnProperty.call(data, key), `missing field: ${key}`);
        assert.notEqual(String(data[key] || '').trim(), '', `empty field: ${key}`);
    });
});

test('initial profile generation uses local verified address pool when possible', () => {
    const g = loadGenerators();
    const data = g.generateAllInfoWithSettings({ country: 'United States', city: '', region: '' }, {});

    assert.equal(data.addressSource, 'local_verified');
    assert.equal(data.addressConfidence, 'high');
    assert.notEqual(String(data.addressLastUpdatedAt || '').trim(), '');
});

test('initial profile keeps unmatched IP city instead of jumping to another pooled city', () => {
    const g = loadGenerators();
    const data = g.generateAllInfoWithSettings({
        country: 'United States',
        city: 'Not A Real Pool City',
        region: 'Example State'
    }, {});

    assert.equal(data.addressSource, 'synthetic');
    assert.equal(data.addressConfidence, 'low');
    assert.equal(data.city, 'Not A Real Pool City');
    assert.equal(data.state, 'Example State');
});

test('birthday and email formats are valid', () => {
    const g = loadGenerators();

    for (let i = 0; i < 120; i++) {
        const d = g.generateAllInfoWithSettings({ country: 'Germany', city: '', region: '' }, { minAge: 18, maxAge: 55 });
        assert.match(d.birthday, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(d.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
});

test('gendered names stay consistent for US profiles', () => {
    const g = loadGenerators();

    const maleNames = new Set();
    const femaleNames = new Set();

    for (let i = 0; i < 800; i++) {
        const d = g.generateAllInfoWithSettings({ country: 'United States', city: '', region: '' }, {});
        if (d.gender === 'male') maleNames.add(d.firstName);
        if (d.gender === 'female') femaleNames.add(d.firstName);
    }

    const overlap = [...maleNames].filter((name) => femaleNames.has(name));
    assert.equal(overlap.length, 0, `overlap names found: ${overlap.slice(0, 10).join(', ')}`);
});

test('name diversity remains high across major countries', () => {
    const g = loadGenerators();
    const countries = ['United States', 'China', 'Spain', 'Germany', 'Brazil'];

    countries.forEach((country) => {
        const full = new Set();
        for (let i = 0; i < 500; i++) {
            const d = g.generateAllInfoWithSettings({ country, city: '', region: '' }, {});
            full.add(`${d.firstName} ${d.lastName}`);
        }
        assert.ok(full.size >= 420, `${country} diversity too low: ${full.size}`);
    });
});

test('phone format follows country-specific rules', () => {
    const g = loadGenerators();

    const patterns = {
        'United States': /^\+1 \(\d{3}\) \d{3}-\d{4}$/,
        Canada: /^\+1 \(\d{3}\) \d{3}-\d{4}$/,
        'United Kingdom': /^\+44 7\d{3} \d{3} \d{3}$/,
        Australia: /^\+61 4\d{2} \d{3} \d{3}$/,
        China: /^\+86 1\d{2} \d{4} \d{4}$/,
        Japan: /^0(70|80|90)-\d{4}-\d{4}$/,
        'South Korea': /^\+82 10-\d{4}-\d{4}$/,
        Germany: /^\+49 1\d{2} \d{4} \d{4}$/,
        France: /^\+33 [67] \d{2} \d{2} \d{2} \d{2}$/,
        Russia: /^\+7 9\d{2} \d{3}-\d{2}-\d{2}$/,
        Spain: /^\+34 [67]\d{2} \d{3} \d{3}$/,
        Italy: /^\+39 3\d{2} \d{3} \d{4}$/,
        Brazil: /^\+55 \(\d{2}\) 9\d{4}-\d{4}$/,
        India: /^\+91 [6-9]\d{4} \d{5}$/,
        Singapore: /^\+65 [89]\d{3} \d{4}$/,
        Taiwan: /^\+886 9\d{2} \d{3} \d{3}$/,
        'Hong Kong': /^\+852 [569]\d{3} \d{4}$/,
        Mexico: /^\+52 \d{3} \d{3} \d{4}$/,
        Netherlands: /^\+31 6 \d{2} \d{2} \d{2} \d{2}$/
    };
    const countryCodeDigits = {
        'United States': '1',
        Canada: '1',
        'United Kingdom': '44',
        Australia: '61',
        China: '86',
        'South Korea': '82',
        Germany: '49',
        France: '33',
        Russia: '7',
        Spain: '34',
        Italy: '39',
        Brazil: '55',
        India: '91',
        Singapore: '65',
        Taiwan: '886',
        'Hong Kong': '852',
        Mexico: '52',
        Netherlands: '31'
    };
    const protectedNationalPrefixLength = {
        'United States': 3,
        Canada: 3,
        'United Kingdom': 2,
        Australia: 1,
        China: 3,
        Japan: 3,
        'South Korea': 2,
        Germany: 3,
        France: 1,
        Russia: 3,
        Spain: 1,
        Italy: 3,
        Brazil: 3,
        India: 1,
        Singapore: 1,
        Taiwan: 1,
        'Hong Kong': 1,
        Mexico: 3,
        Netherlands: 1
    };

    const qualityBody = (country, phone) => {
        let digits = phone.replace(/\D/g, '');
        const code = countryCodeDigits[country];
        if (code && digits.startsWith(code)) {
            digits = digits.slice(code.length);
        }
        return digits.slice(protectedNationalPrefixLength[country] || 0);
    };

    for (const [country, pattern] of Object.entries(patterns)) {
        for (let i = 0; i < 25; i++) {
            const sample = g.generateAllInfoWithSettings({ country, city: '', region: '' }, {});
            assert.match(sample.phone, pattern, `${country}: ${sample.phone}`);
            assert.equal(/(?:1234|2345|3456|4567|5678|6789|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999)/.test(qualityBody(country, sample.phone)), false, `${country} low quality: ${sample.phone}`);
            if (country === 'United States' || country === 'Canada') {
                const national = sample.phone.replace(/\D/g, '').slice(1);
                assert.doesNotMatch(national.slice(3, 6), /^(?:555|[2-9]11|000)$/, `${country} fake exchange: ${sample.phone}`);
            }
        }
    }
});

test('zip code format follows country-specific rules', () => {
    const g = loadGenerators();

    const us = g.generateAllInfoWithSettings({ country: 'United States', city: '', region: '' }, {});
    assert.match(us.zipCode, /^\d{5}$/);

    const jp = g.generateAllInfoWithSettings({ country: 'Japan', city: '', region: '' }, {});
    assert.match(jp.zipCode, /^\d{3}-\d{4}$/);

    const uk = g.generateAllInfoWithSettings({ country: 'United Kingdom', city: '', region: '' }, {});
    assert.match(uk.zipCode, /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/);
});

test('P0 countries prioritize local verified address pool', async () => {
    const g = loadGenerators();
    const poolSummary = g.getAddressPoolSummary();

    assert.ok(poolSummary['United States'] >= 5);
    assert.ok(poolSummary['Canada'] >= 5);
    assert.ok(poolSummary['Australia'] >= 5);
    assert.ok(poolSummary['France'] >= 5);
    assert.ok(poolSummary['Netherlands'] >= 5);
    assert.ok(poolSummary['Spain'] >= 5);
    assert.ok(poolSummary['Hong Kong'] >= 5);
    assert.ok(poolSummary['Mexico'] >= 5);
    assert.ok(poolSummary['Brazil'] >= 5);
    assert.ok(poolSummary['Italy'] >= 5);
    assert.ok(poolSummary['Germany'] >= 5);
    assert.ok(poolSummary['Japan'] >= 5);
    assert.ok(poolSummary['South Korea'] >= 5);
    assert.ok(poolSummary['Singapore'] >= 5);
    assert.ok(poolSummary['Taiwan'] >= 5);

    const sample = await g.generateAddressAsync('United States', 'New York');
    assert.equal(sample.source, 'local_verified');
    assert.equal(sample.confidence, 'high');
    assert.equal(sample.country, 'United States');
    assert.notEqual(String(sample.address || '').trim(), '');
});

test('non-P0 countries fall back safely without throwing', async () => {
    const g = loadGenerators();
    const sample = await g.generateAddressAsync('India', 'Mumbai');

    assert.ok(sample);
    assert.notEqual(String(sample.address || '').trim(), '');
    assert.notEqual(String(sample.city || '').trim(), '');
    assert.notEqual(String(sample.country || '').trim(), '');
    assert.ok(['geoapify', 'openstreetmap', 'synthetic', 'local_verified'].includes(sample.source));
    assert.ok(['high', 'medium', 'low'].includes(sample.confidence));
});

test('P1 countries now also use local verified pool', async () => {
    const g = loadGenerators();
    const p1Countries = ['Mexico', 'Brazil', 'Italy', 'Germany', 'Japan', 'South Korea', 'Singapore', 'Taiwan'];

    for (const country of p1Countries) {
        const sample = await g.generateAddressAsync(country, '');
        assert.equal(sample.source, 'local_verified', `${country} should use local_verified`);
        assert.equal(sample.confidence, 'high', `${country} confidence should be high`);
        assert.equal(sample.country, country, `${country} country should stay normalized`);
        assert.notEqual(String(sample.address || '').trim(), '', `${country} address empty`);
    }
});

test('all plugin countries are now covered by local verified pool', async () => {
    const g = loadGenerators();
    const poolSummary = g.getAddressPoolSummary();
    const poolMeta = g.getAddressPoolMeta();
    const pluginCountries = [
        'United States', 'United Kingdom', 'Canada', 'Australia', 'China',
        'Japan', 'South Korea', 'Germany', 'France', 'Russia', 'Spain', 'Italy',
        'Brazil', 'India', 'Singapore', 'Taiwan', 'Hong Kong', 'Mexico', 'Netherlands'
    ];

    pluginCountries.forEach((country) => {
        assert.ok(poolSummary[country] >= 5, `${country} local pool missing or too small`);
        assert.ok(poolMeta.countryStats[country].cities >= 5, `${country} city coverage too small`);
    });
});

test('address pool stats are available per country', () => {
    const g = loadGenerators();
    const stats = g.getAddressPoolStats('United States');
    const summary = g.getAddressPoolSummary();

    assert.equal(stats.entries, summary['United States']);
    assert.ok(stats.entries >= 10, 'US pool too small');
    assert.ok(stats.cities >= 5, 'US city coverage too small');
    assert.equal(g.getAddressPoolStats('Atlantis'), null);
});

test('required city matches use same-city local verified addresses', async () => {
    const g = loadGenerators();
    const sample = await g.generateAddressAsync('United States', 'New York', {
        requireCityMatch: true,
        allowApi: false
    });

    assert.equal(sample.source, 'local_verified');
    assert.equal(sample.confidence, 'high');
    assert.equal(sample.city, 'New York');
    assert.equal(sample.state, 'New York');
    assert.match(sample.zipCode, /^101/);
});

test('required city matching falls back without changing unknown city', async () => {
    const g = loadGenerators();
    const sample = await g.generateAddressAsync('United States', 'Not A Real Pool City', {
        requireCityMatch: true,
        allowApi: false,
        locationContext: {
            state: 'Example State',
            zipCode: '12345'
        }
    });

    assert.equal(sample.source, 'synthetic');
    assert.equal(sample.confidence, 'low');
    assert.equal(sample.city, 'Not A Real Pool City');
    assert.equal(sample.state, 'Example State');
    assert.equal(sample.zipCode, '12345');
    assert.notEqual(String(sample.address || '').trim(), '');
});

test('city matching tolerates accent differences in local verified pool', async () => {
    const g = loadGenerators();
    const sample = await g.generateAddressAsync('Brazil', 'São Paulo', {
        requireCityMatch: true,
        allowApi: false
    });

    assert.equal(sample.source, 'local_verified');
    assert.equal(sample.confidence, 'high');
    assert.equal(sample.city, 'Sao Paulo');
});

test('synthetic fallback avoids US apartment suffixes for localized countries', async () => {
    const g = loadGenerators();
    const countries = ['Japan', 'Germany', 'France', 'Taiwan', 'Singapore', 'Hong Kong'];

    for (const country of countries) {
        for (let i = 0; i < 40; i++) {
            const sample = await g.generateAddressAsync(country, 'Unmatched City', {
                requireCityMatch: true,
                allowApi: false
            });
            assert.equal(sample.source, 'synthetic');
            assert.ok(!sample.address.includes(', Apt '), `${country} used US apt suffix: ${sample.address}`);
        }
    }
});
