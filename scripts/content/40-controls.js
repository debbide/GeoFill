/**
 * GeoFill content script - 40-controls.js
 * 控件填充：select、radio、性别、密码字段
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
function fillSelect(element, value) {
    const options = getSelectableOptions(element);
    const searchValue = normalizeIntentText(value).trim();

    // 首先尝试精确匹配
    for (const { option, index } of options) {
        const optionText = normalizeIntentText(option.text).trim();
        const optionValue = normalizeIntentText(option.value).trim();

        if (optionText === searchValue || optionValue === searchValue) {
            setSelectIndex(element, index);
            return true;
        }
    }

    // 然后尝试较安全的包含匹配，避免短代码误撞长文本。
    for (const { option, index } of options) {
        const tokens = optionTextTokens(option);
        if (tokens.some((token) => optionTokenMatchesCandidate(token, searchValue))) {
            setSelectIndex(element, index);
            return true;
        }
    }

    return false;
}

function setSelectIndex(element, index) {
    element.selectedIndex = index;
    const selected = getSelectOptions(element)[index];
    if (selected) {
        element.value = selected.value;
    }
    dispatchValueChangeEvents(element);
}

function getRadioGroup(element) {
    const name = element.name || '';
    return name
            ? Array.from(document.getElementsByName(name)).filter((radio) => String(radio.type || '').toLowerCase() === 'radio' && isFillableElement(radio))
            : [element];
}

function isOptionDisabled(option) {
    return Boolean(option.disabled || option.getAttribute?.('disabled') !== '' && option.getAttribute?.('disabled') != null);
}

function isPlaceholderOption(option) {
    const value = String(option.value || '').trim();
    const text = normalizeIntentText(option.text || option.getAttribute?.('label') || '').trim();
    if (value) return false;
    if (!text) return true;
    return /^(select|choose|please select|--|---|none|请选择|請選擇|選択|選んで|선택)/.test(text);
}

function getSelectableOptions(element) {
    return getSelectOptions(element)
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => !isOptionDisabled(option) && !isPlaceholderOption(option));
}

function isShortSelectCode(value) {
    return /^[a-z0-9]{1,3}$/i.test(String(value || '').trim());
}

function optionTokenMatchesCandidate(token, candidate) {
    if (!token || !candidate) return false;
    if (token === candidate) return true;

    const tokenCompact = compactIntentText(token);
    const candidateCompact = compactIntentText(candidate);
    if (!tokenCompact || !candidateCompact) return false;
    if (tokenCompact === candidateCompact) return true;

    if (isShortSelectCode(candidateCompact)) {
        const tokenWords = normalizeIntentWords(token);
        return hasIntentWord(tokenWords, [candidateCompact]) || tokenCompact === candidateCompact;
    }

    return tokenCompact.includes(candidateCompact) || candidateCompact.includes(tokenCompact);
}

const GENDER_ALIASES_FOR_SELECT = {
    male: ['male', 'm', 'man', 'masculine', 'masculino', 'hombre', 'homme', 'herr', '男', '男性', '男士', '남성'],
    female: ['female', 'f', 'woman', 'feminine', 'femenino', 'mujer', 'femme', 'frau', '女', '女性', '女士', '여성']
};

function normalizeGenderValue(value) {
    const compact = compactIntentText(value);
    const words = normalizeIntentWords(value);

    if (hasIntentWord(words, ['female', 'woman', 'feminine', 'femenino', 'mujer', 'femme', 'frau', 'f'])
        || hasAnyIntent(compact, ['女性', '女士', '여성'])) {
        return 'female';
    }

    if (hasIntentWord(words, ['male', 'man', 'masculine', 'masculino', 'hombre', 'homme', 'herr', 'm'])
        || hasAnyIntent(compact, ['男性', '男士', '남성'])) {
        return 'male';
    }

    return '';
}

function optionMatchesGender(option, candidates) {
    const texts = [
        option.text,
        option.value,
        option.getAttribute?.('label'),
        option.getAttribute?.('data-value')
    ].filter(Boolean);

    return texts.some((text) => {
        const words = normalizeIntentWords(text);
        const compact = compactIntentText(text);
        return candidates.some((candidate) => {
            const candidateWords = normalizeIntentWords(candidate);
            const candidateCompact = compactIntentText(candidate);
            return (candidateWords && hasIntentWord(words, [candidateWords]))
                || (candidateCompact && compact === candidateCompact);
        });
    });
}

function fillGenderSelect(element, value) {
    const gender = normalizeGenderValue(value);
    if (!gender) return fillSelect(element, value);

    const candidates = GENDER_ALIASES_FOR_SELECT[gender];
    const options = getSelectableOptions(element);

    for (const { option, index } of options) {
        if (optionMatchesGender(option, candidates)) {
            setSelectIndex(element, index);
            return true;
        }
    }

    return false;
}

function getRadioLabelText(radio) {
    const labels = Array.from(radio.labels || []).map((label) => label.textContent || label.innerText || '');
    return labels.join(' ');
}

function radioMatchesGender(radio, candidates) {
    const text = [
        radio.value,
        radio.id,
        radio.name,
        radio.getAttribute?.('aria-label'),
        radio.getAttribute?.('title'),
        getRadioLabelText(radio),
        getLabelText(radio)
    ].filter(Boolean).join(' ');

    return optionMatchesGender({
        text,
        value: radio.value || '',
        getAttribute: (name) => radio.getAttribute?.(name) || ''
    }, candidates);
}

function groupLooksLikeGenderRadios(radios) {
    const text = radios.map((radio) => [
        radio.name,
        radio.id,
        radio.getAttribute?.('aria-label'),
        getRadioLabelText(radio),
        getLabelText(radio)
    ].filter(Boolean).join(' ')).join(' ');
    const signature = compactIntentText(text);
    if (hasAnyIntent(signature, ['gender', 'sex', '性别', '性別', 'genderidentity'])) return true;

    const hasMale = radios.some((radio) => radioMatchesGender(radio, GENDER_ALIASES_FOR_SELECT.male));
    const hasFemale = radios.some((radio) => radioMatchesGender(radio, GENDER_ALIASES_FOR_SELECT.female));
    return hasMale && hasFemale;
}

function setRadioChecked(target, group) {
    const targetName = target.name || '';
    for (const radio of group) {
        if (targetName && radio.name === targetName) {
            radio.checked = radio === target;
        }
    }
    target.checked = true;
    dispatchValueChangeEvents(target);
    return true;
}

function fillGenderRadio(value) {
    const gender = normalizeGenderValue(value);
    if (!gender) return false;

    const candidates = GENDER_ALIASES_FOR_SELECT[gender];
    const radios = getFillableElements().filter((element) => String(element.type || '').toLowerCase() === 'radio');
    const groups = new Map();

    for (const radio of radios) {
        const key = radio.name || radio.id || `radio-${groups.size}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(radio);
    }

    for (const group of groups.values()) {
        if (!groupLooksLikeGenderRadios(group)) continue;
        const target = group.find((radio) => radioMatchesGender(radio, candidates));
        if (target) return setRadioChecked(target, group);
    }

    return false;
}

function hasPasswordIntent(signature, intentWords, autocomplete = '') {
    return autocomplete === 'newpassword'
        || autocomplete === 'currentpassword'
        || hasAnyIntent(signature, [
            'password',
            'passwd',
            'pwd',
            'newpassword',
            'confirmpassword',
            'passwordconfirmation',
            'repeatpassword',
            'reenterpassword',
            '密码',
            '確認用',
            'パスワード'
        ])
        || hasIntentWord(intentWords, ['password', 'pass', 'pwd']);
}

function hasConfirmPasswordIntent(signature, intentWords) {
    return hasAnyIntent(signature, [
        'confirmpassword',
        'passwordconfirmation',
        'repeatpassword',
        'reenterpassword',
        'retypepassword',
        'verifypassword',
        'confirmarcontrasena',
        '確認用'
    ])
        || hasIntentWord(intentWords, [
            'confirm password',
            'password confirmation',
            'repeat password',
            'reenter password',
            're-enter password',
            'retype password',
            'verify password'
        ])
        || (hasPasswordIntent(signature, intentWords) && hasIntentWord(intentWords, ['confirm', 'confirmation', 'repeat', 'reenter', 'retype', 'verify']));
}

function hasCurrentPasswordIntent(signature, intentWords, autocomplete = '') {
    return autocomplete === 'currentpassword'
        || hasAnyIntent(signature, ['currentpassword', 'oldpassword', 'existingpassword'])
        || (hasPasswordIntent(signature, intentWords, autocomplete) && hasIntentWord(intentWords, ['current', 'old', 'existing']));
}

function isTokenOrOptionalCodeField(element) {
    if (!element) return false;
    if (hasOptionalTokenIntent(element)) return true;

    const signature = getElementSignature(element);
    const intentWords = getElementIntentWords(element);

    return hasAnyIntent(signature, [
        'vpnbypass',
        'bypasstoken',
        'bypasscode',
        'token',
        'invite',
        'invitation',
        'referral',
        'refercode',
        'coupon',
        'promo',
        'promotioncode',
        'discountcode',
        'voucher',
        'giftcard',
        'accesscode',
        'activationcode',
        'licensekey',
        'apikey',
        'secretkey',
        'verificationcode',
        'authcode',
        'otp',
        '2fa',
        'mfa',
        'captcha'
    ])
        || hasIntentWord(intentWords, [
            'vpn',
            'bypass',
            'token',
            'invite',
            'invitation',
            'referral',
            'coupon',
            'promo',
            'promotion',
            'discount',
            'voucher',
            'gift card',
            'access code',
            'activation code',
            'license key',
            'api key',
            'secret key',
            'verification code',
            'auth code',
            'otp',
            'captcha'
        ]);
}

function getPasswordFieldRole(element) {
    if (!element) return '';

    const type = String(element.type || '').toLowerCase();
    const autocomplete = compactIntentText(element.autocomplete || '');
    const signature = getElementSignature(element);
    const intentWords = getElementIntentWords(element);

    // bypass/token/invite/coupon/code 类字段不是注册密码，即使 id/name 里包含 pass/code 也不自动填写。
    if (isTokenOrOptionalCodeField(element) && !hasPasswordIntent(signature, intentWords, autocomplete)) {
        return '';
    }

    if (!hasPasswordIntent(signature, intentWords, autocomplete) && type !== 'password') {
        return '';
    }

    if (hasCurrentPasswordIntent(signature, intentWords, autocomplete)) return 'current';
    if (hasConfirmPasswordIntent(signature, intentWords)) return 'confirm';
    return 'primary';
}

function isPasswordLikeField(element) {
    return Boolean(getPasswordFieldRole(element));
}

function findPasswordFields() {
    const fromSelectors = findAllFields('password');
    const fromDom = getFillableElements().filter(isPasswordLikeField);
    const fields = [];

    [...fromSelectors, ...fromDom].forEach((element) => {
        if (!fields.includes(element)) fields.push(element);
    });

    const eligible = fields.filter((element) => {
        const role = getPasswordFieldRole(element);
        return role && role !== 'current';
    });
    const primary = eligible.find((element) => getPasswordFieldRole(element) === 'primary') || eligible[0];
    if (!primary) return [];

    const result = [primary];
    const explicitConfirm = eligible.find((element) => element !== primary && getPasswordFieldRole(element) === 'confirm');
    if (explicitConfirm) result.push(explicitConfirm);

    return result;
}

/**
 * 处理 radio 按钮
 */