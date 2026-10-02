/**
 * GeoFill content script - 80-smart.js
 * AI 智能填表：映射清洗、分段填充
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
function sanitizeSmartFillMapping(mapping) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
        return {};
    }

    const sanitized = {};
    const entries = Object.entries(mapping).slice(0, 300);

    for (const [rawKey, rawValue] of entries) {
        const key = String(rawKey || '').trim().slice(0, 120);
        if (!key) continue;

        const valueType = typeof rawValue;
        if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
            continue;
        }

        let normalized = rawValue;
        if (valueType === 'string') {
            normalized = rawValue
                .replace(/[\u0000-\u001F\u007F]/g, '')
                .replace(/\u3000/g, ' ')
                .trim()
                .slice(0, 300);
            if (!normalized) continue;
        } else if (valueType === 'number') {
            normalized = String(rawValue);
        }

        sanitized[key] = normalized;
    }

    return sanitized;
}

function getVisibleInputs() {
    // 穿透 open shadow root，覆盖 Web Components 内的字段
    return querySelectorAllDeep(FILLABLE_ELEMENTS_SELECTOR).filter(isFillableElement);
}

function resolveSmartTargetElement(key, visibleInputs) {
    let element = document.getElementById(key);
    if (element && !isFillableElement(element)) {
        element = null;
    }

    if (!element) {
        const byName = Array.from(document.getElementsByName(key))
            .find(isFillableElement);
        if (byName) {
            element = byName;
        }
    }

    if (!element && /^field_\d+$/.test(key)) {
        const index = Number.parseInt(key.split('_')[1], 10);
        if (Number.isFinite(index) && index >= 0 && index < visibleInputs.length) {
            element = visibleInputs[index];
        }
    }

    return element || null;
}

function toBooleanLike(value) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'on', 'checked', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'unchecked', 'n'].includes(normalized)) return false;
    return null;
}

function fillSmartCheckOrRadio(element, value) {
    const boolValue = toBooleanLike(value);
    const normalizedValue = String(value || '').trim().toLowerCase();

    if (element.type === 'checkbox') {
        if (boolValue !== null) {
            element.checked = boolValue;
        } else {
            element.checked = normalizedValue === String(element.value || '').trim().toLowerCase();
        }
        dispatchValueChangeEvents(element);
        return true;
    }

    if (element.type === 'radio') {
        const group = getRadioGroup(element).filter(isFillableElement);

        let target = null;
        if (boolValue === true && group.length > 0) {
            target = group[0];
        } else {
            target = group.find((radio) => String(radio.value || '').trim().toLowerCase() === normalizedValue);
            if (!target) {
                target = group.find((radio) => String(radio.value || '').trim().toLowerCase().includes(normalizedValue));
            }
        }

        if (!target) return false;

        target.checked = true;
        dispatchValueChangeEvents(target);
        return true;
    }

    return false;
}

function optionTextTokens(option) {
    return [
        option.text,
        option.value,
        option.getAttribute?.('label'),
        option.getAttribute?.('data-country-code'),
        option.getAttribute?.('data-code')
    ].filter(Boolean).map((value) => normalizeIntentText(value));
}

function fillSelectByCandidates(element, candidates) {
    const normalizedCandidates = candidates
        .filter(Boolean)
        .map((candidate) => normalizeIntentText(candidate).trim())
        .filter(Boolean);

    if (normalizedCandidates.length === 0) return false;

    const options = getSelectableOptions(element);

    for (const candidate of normalizedCandidates) {
        for (const { option, index } of options) {
            const tokens = optionTextTokens(option);
            if (tokens.some((token) => token === candidate)) {
                setSelectIndex(element, index);
                return true;
            }
        }
    }

    for (const candidate of normalizedCandidates) {
        for (const { option, index } of options) {
            const tokens = optionTextTokens(option);
            if (tokens.some((token) => optionTokenMatchesCandidate(token, candidate))) {
                setSelectIndex(element, index);
                return true;
            }
        }
    }

    return false;
}

function fillCountrySelect(element, country) {
    const candidates = COUNTRY_ALIASES_FOR_SELECT[country] || [country];
    return fillSelectByCandidates(element, candidates);
}

function fillPhoneCodeSelect(element, country, phone) {
    const fromCountry = COUNTRY_DIAL_CODES[country];
    const fromPhone = String(phone || '').match(/^\+\d{1,4}/)?.[0];
    const dialCode = fromCountry || fromPhone;
    if (!dialCode) return false;
    const numeric = dialCode.replace(/\D/g, '');
    return fillSelectByCandidates(element, [dialCode, numeric, `+${numeric}`]);
}

function fillRegionSelect(element, value) {
    const candidates = REGION_ALIASES_FOR_SELECT[value] || [value];
    return fillSelectByCandidates(element, candidates);
}

function fillCitySelect(element, value) {
    const candidates = CITY_ALIASES_FOR_SELECT[value] || [value];
    return fillSelectByCandidates(element, candidates);
}

const MONTH_SELECT_CANDIDATES = [
    [],
    ['1', '01', 'Jan', 'January'],
    ['2', '02', 'Feb', 'February'],
    ['3', '03', 'Mar', 'March'],
    ['4', '04', 'Apr', 'April'],
    ['5', '05', 'May'],
    ['6', '06', 'Jun', 'June'],
    ['7', '07', 'Jul', 'July'],
    ['8', '08', 'Aug', 'August'],
    ['9', '09', 'Sep', 'Sept', 'September'],
    ['10', 'Oct', 'October'],
    ['11', 'Nov', 'November'],
    ['12', 'Dec', 'December']
];

function splitPhoneParts(phone) {
    const raw = String(phone || '').trim();
    const countryCode = raw.match(/^\+(\d{1,4})/)?.[1] || '';
    let national = raw.replace(/^\+\d{1,4}\s*/, '').trim();
    national = national.replace(/[^\d]/g, '');
    return {
        countryCode: countryCode ? `+${countryCode}` : '',
        national
    };
}

function splitPhoneSegments(phone, country = '') {
    const { national } = splitPhoneParts(phone);
    if (!national) return [];

    if ((country === 'United States' || country === 'Canada') && national.length === 10) {
        return [national.slice(0, 3), national.slice(3, 6), national.slice(6)];
    }

    if (country === 'Japan' && /^0[789]0\d{8}$/.test(national)) {
        return [national.slice(0, 3), national.slice(3, 7), national.slice(7)];
    }

    if (national.length >= 10) {
        return [national.slice(0, 3), national.slice(3, 7), national.slice(7)];
    }

    if (national.length >= 7) {
        return [national.slice(0, 3), national.slice(3, 6), national.slice(6)];
    }

    const first = Math.ceil(national.length / 3);
    const second = Math.ceil((national.length - first) / 2);
    return [
        national.slice(0, first),
        national.slice(first, first + second),
        national.slice(first + second)
    ].filter(Boolean);
}

function splitBirthdayParts(birthday) {
    const match = String(birthday || '').trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!match) return { year: '', month: '', day: '' };

    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return {
        year: match[1],
        month,
        day
    };
}

function splitAddressForLines(address) {
    const raw = String(address || '').trim();
    if (!raw) return { line1: '', line2: '' };

    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 1) {
        return { line1: raw, line2: '' };
    }

    return {
        line1: parts[0],
        line2: parts.slice(1).join(', ')
    };
}

function setCheckbox(element, checked) {
    if (element.checked === checked) return true;
    element.checked = checked;
    dispatchValueChangeEvents(element);
    return true;
}

function fillConsentCheckboxes(usedElements) {
    let filled = 0;

    for (const element of findAllFieldsByIntent('requiredConsentCheckbox', usedElements)) {
        if (!element.checked) {
            setCheckbox(element, true);
            filled++;
        }
        usedElements.add(element);
    }

    for (const element of findAllFieldsByIntent('newsletterCheckbox', usedElements)) {
        if (element.checked) {
            setCheckbox(element, false);
            filled++;
        }
        usedElements.add(element);
    }

    return filled;
}

function fillAddressParts(data, usedElements) {
    let filled = 0;
    const addressParts = splitAddressForLines(data.address);
    const fields = [
        ['addressLine1', addressParts.line1 || data.address],
        ['addressLine2', addressParts.line2],
        ['city', data.city],
        ['state', data.state],
        ['zipCode', data.zipCode]
    ];

    for (const [intent, value] of fields) {
        if (!value) continue;
        const element = findFieldByIntent(intent, usedElements);
        if (!element) continue;

        if (element.tagName.toLowerCase() === 'select') {
            const didFill = intent === 'state'
                ? fillRegionSelect(element, String(value))
                : intent === 'city'
                    ? fillCitySelect(element, String(value))
                    : fillSelect(element, String(value));
            if (didFill) {
                filled++;
                usedElements.add(element);
            }
        } else {
            simulateFieldInput(element, value, intent);
            filled++;
            usedElements.add(element);
        }
    }

    return filled;
}

function fillBirthdayElement(element, value, candidates = [value]) {
    if (!element || !value) return false;
    if (element.tagName.toLowerCase() === 'select') {
        return fillSelectByCandidates(element, candidates);
    }
    simulateFieldInput(element, value, 'birthday');
    return true;
}

function findLikelyBirthdayPartFields(usedElements) {
    const unused = getFillableElements().filter((element) => !usedElements.has(element));
    const hasExplicitBirthContext = unused.some((element) => {
        const signature = getElementSignature(element);
        const intentWords = getElementIntentWords(element);
        return hasBirthdayIntent(signature, intentWords);
    });

    const findByIntentOrWord = (expectedIntent, keywords) => unused.find((element) => {
        const intent = classifyFieldIntent(element);
        if (intent === expectedIntent) return true;
        if (!hasExplicitBirthContext) return false;
        return hasIntentWord(getElementIntentWords(element), keywords);
    }) || null;

    return {
        year: findByIntentOrWord('birthYear', ['year', 'yyyy', 'yy', '年']),
        month: findByIntentOrWord('birthMonth', ['month', 'mon', 'mm', '月']),
        day: findByIntentOrWord('birthDay', ['day', 'dd', '日'])
    };
}

function fillBirthdayParts(data, usedElements) {
    const birthday = FIELD_INTENTS.birthdayInputKeys.map((key) => data[key]).find(Boolean) || '';
    const parts = splitBirthdayParts(birthday);
    if (!parts.year || !parts.month || !parts.day) return 0;

    let filled = 0;

    const single = findFieldByIntent('birthday', usedElements);
    if (single) {
        const ok = fillBirthdayElement(single, birthday, [birthday, `${parts.month}/${parts.day}/${parts.year}`, `${parts.day}/${parts.month}/${parts.year}`]);
        if (ok) {
            filled++;
            usedElements.add(single);
        }
    }

    const fields = findLikelyBirthdayPartFields(usedElements);
    const monthNumber = Number.parseInt(parts.month, 10);
    const dayNumber = Number.parseInt(parts.day, 10);
    const partConfigs = [
        ['year', fields.year, parts.year, [parts.year]],
        ['month', fields.month, parts.month, MONTH_SELECT_CANDIDATES[monthNumber] || [parts.month, String(monthNumber)]],
        ['day', fields.day, parts.day, [parts.day, String(dayNumber)]]
    ];

    for (const [, element, value, candidates] of partConfigs) {
        if (!element || usedElements.has(element)) continue;
        const ok = fillBirthdayElement(element, value, candidates);
        if (ok) {
            filled++;
            usedElements.add(element);
        }
    }

    return filled;
}

function fillIdentityParts(data, usedElements) {
    let filled = 0;

    const firstNameField = data.firstName ? findFieldSmart('firstName', usedElements) : null;
    if (firstNameField) {
        simulateInput(firstNameField, String(data.firstName));
        usedElements.add(firstNameField);
        filled++;
    }

    const lastNameField = data.lastName ? findFieldSmart('lastName', usedElements) : null;
    if (lastNameField) {
        simulateInput(lastNameField, String(data.lastName));
        usedElements.add(lastNameField);
        filled++;
    }

    if (filled === 0 && data.firstName && data.lastName) {
        const fullNameField = findFullNameField();
        if (fullNameField && !usedElements.has(fullNameField)) {
            simulateInput(fullNameField, `${data.firstName} ${data.lastName}`);
            usedElements.add(fullNameField);
            filled++;
        }
    }

    const emailField = data.email ? findFieldSmart('email', usedElements) : null;
    if (emailField) {
        simulateInput(emailField, String(data.email));
        usedElements.add(emailField);
        filled++;
    }

    const usernameField = data.username ? findFieldSmart('username', usedElements) : null;
    if (usernameField) {
        simulateInput(usernameField, String(data.username));
        usedElements.add(usernameField);
        filled++;
    }

    return filled;
}

function fillPasswordParts(data, usedElements) {
    const password = String(data.password || '');
    if (!password) return 0;

    const elements = findPasswordFields().filter((element) => !usedElements.has(element));
    if (elements.length === 0) return 0;

    let filled = 0;
    elements.forEach((element) => {
        simulateInput(element, password);
        usedElements.add(element);
        filled++;
    });

    return filled;
}

function fillCountryAndPhoneParts(data, usedElements) {
    let filled = 0;
    const country = data.country || '';
    const phone = data.phone || '';
    const phoneParts = splitPhoneParts(phone);
    const dialCode = phoneParts.countryCode || COUNTRY_DIAL_CODES[country] || '';

    const countryElement = findFieldByIntent('country', usedElements);
    if (countryElement && country) {
        const ok = countryElement.tagName.toLowerCase() === 'select'
            ? fillCountrySelect(countryElement, country)
            : (simulateInput(countryElement, country), true);
        if (ok) {
            filled++;
            usedElements.add(countryElement);
        }
    }

    const phoneCodeElement = findFieldByIntent('phoneCountryCode', usedElements);
    if (phoneCodeElement) {
        const ok = phoneCodeElement.tagName.toLowerCase() === 'select'
            ? fillPhoneCodeSelect(phoneCodeElement, country, phone)
            : (simulateFieldInput(phoneCodeElement, dialCode, 'phoneCountryCode'), Boolean(dialCode));
        if (ok) {
            filled++;
            usedElements.add(phoneCodeElement);
        }
    }

    const phoneSegmentFields = FIELD_INTENTS.phoneSegments.map((intent) => findFieldByIntent(intent, usedElements));
    const availableSegmentFields = phoneSegmentFields.filter(Boolean);
    if (availableSegmentFields.length >= 2 && phone) {
        const segments = splitPhoneSegments(phone, country);
        availableSegmentFields.forEach((element, index) => {
            const segment = segments[index];
            if (!segment) return;
            simulateFieldInput(element, segment, classifyFieldIntent(element) || 'phone');
            filled++;
            usedElements.add(element);
        });
    }

    const phoneElement = findFieldByIntent('phone', usedElements);
    if (phoneElement && phone) {
        const mainPhoneValue = phoneCodeElement
            ? (phoneParts.national || phone.replace(/^\+\d+\s*/, ''))
            : phone;
        simulateFieldInput(phoneElement, mainPhoneValue, 'phone');
        filled++;
        usedElements.add(phoneElement);
    }

    return filled;
}

async function fillFormSmart(mapping, options = {}) {
    let filledCount = 0;
    const results = {};
    const safeMapping = sanitizeSmartFillMapping(mapping);
    const visibleInputs = getVisibleInputs();

    for (const [key, value] of Object.entries(safeMapping)) {
        const element = resolveSmartTargetElement(key, visibleInputs);

        if (element && isFillableElement(element)) {
            if (element.tagName.toLowerCase() === 'select') {
                if (fillSelect(element, String(value))) {
                    filledCount++;
                    results[key] = 'filled';
                } else {
                    results[key] = 'no matching option';
                }
            } else if (element.type === 'radio' || element.type === 'checkbox') {
                if (fillSmartCheckOrRadio(element, value)) {
                    filledCount++;
                    results[key] = 'filled';
                } else {
                    results[key] = 'not matched';
                }
            } else {
                simulateInput(element, String(value));
                filledCount++;
                results[key] = 'filled';
            }
        } else {
            results[key] = element ? 'not fillable' : 'not found';
        }
    }

    const missingRequiredFields = getMissingRequiredFields();
    const validation = {
        isComplete: missingRequiredFields.length === 0,
        missingRequiredFields,
        unfilledRequestedFields: []
    };
    const diagnostics = buildFillDiagnostics(safeMapping, results, validation, filledCount);
    const result = await finalizeFillResult(safeMapping, { filledCount, results, validation, diagnostics }, options);
    logFillSummary(result.filledCount, result.results, result.validation, result.diagnostics);

    // 多步骤表单跟随：有实际填写才启动观察者
    if (result.filledCount > 0) {
        armStepWatcher();
    }
    return result;
}
