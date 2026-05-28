/**
 * Content Script - 表单自动填写（增强版）
 */

// 常见表单字段选择器映射（扩展版）
// 常见表单字段选择器映射（扩展版）
const FIELD_SELECTORS = {
    ...window.GeoFillSelectors.common,
    ...window.GeoFillSelectors.japan
};

// 标签关键字映射
const LABEL_KEYWORDS = {
    ...window.GeoFillSelectors.commonLabels,
    ...window.GeoFillSelectors.japanLabels
};

// 用于检测全名字段（需要拆分）
const FULLNAME_SELECTORS = window.GeoFillSelectors.fullNames || [];

function getTextContent(element) {
    return String(element?.innerText || element?.textContent || '').trim();
}

function getLabelElementsFor(element) {
    const labels = [];

    Array.from(element.labels || []).forEach((label) => {
        if (label && !labels.includes(label)) labels.push(label);
    });

    const id = element.id;
    if (!id) return labels;

    const escapedId = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    try {
        const label = document.querySelector(`label[for="${escapedId}"]`);
        if (label && !labels.includes(label)) labels.push(label);
    } catch (e) {
        // 部分框架生成的 id 可能包含特殊字符，选择器失败时走 label 全量兜底。
    }

    try {
        Array.from(document.querySelectorAll('label')).forEach((label) => {
            if (label?.getAttribute?.('for') === id && !labels.includes(label)) {
                labels.push(label);
            }
        });
    } catch (e) {
        // 忽略不可用的 DOM API。
    }

    return labels;
}

function getTextByElementIds(value) {
    return String(value || '')
        .split(/\s+/)
        .map((id) => getTextContent(document.getElementById(id)))
        .filter(Boolean)
        .join(' ');
}

/**
 * 获取元素的标签文本
 */
function getLabelText(element) {
    let labelText = '';
    const id = element.id;

    // 1. 查找关联 label（支持 input.labels 和特殊 id 的 label[for]）
    labelText += getLabelElementsFor(element).map(getTextContent).join(' ');

    // 2. 查找父级 <label>
    const parentLabel = element.closest('label');
    if (parentLabel) labelText += getTextContent(parentLabel);

    // 3. 查找 aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) labelText += ariaLabel;

    // 4. 查找 aria-labelledby / aria-describedby
    const labelledByText = getTextByElementIds(element.getAttribute('aria-labelledby'));
    if (labelledByText) labelText += labelledByText;

    const describedByText = getTextByElementIds(element.getAttribute('aria-describedby'));
    if (describedByText) labelText += describedByText;

    // 5. title 和 placeholder
    const title = element.getAttribute('title');
    if (title) labelText += title;

    const placeholder = element.getAttribute('placeholder');
    if (placeholder) labelText += placeholder;

    // 6. 查找前置文本节点 (简单的启发式)
    // 很多表格布局中，label 在 input 的前一个 td 或兄弟节点
    let previous = element.previousElementSibling;
    while (previous) {
        if (previous.tagName === 'LABEL' || previous.tagName === 'SPAN' || previous.tagName === 'TD' || previous.tagName === 'TH') {
            labelText += getTextContent(previous);
            break;
        }
        previous = previous.previousElementSibling;
    }

    return labelText.toLowerCase().replace(/\s+/g, '');
}

/**
 * 通过标签文本查找字段
 */
function findFieldByLabel(fieldName) {
    const keywords = LABEL_KEYWORDS[fieldName];
    if (!keywords || keywords.length === 0) return null;

    // 获取所有可见的输入框
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));

    for (const input of inputs) {
        if (!isFillableElement(input) || !isCandidateSafeForField(input, fieldName)) continue;

        const text = getLabelText(input);
        if (!text) continue;

        for (const keyword of keywords) {
            // 简单的包含匹配；命中后仍需通过 intent 复核，避免宽标签误填。
            if (text.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
                return input;
            }
        }
    }
    return null;
}

function getCompatibleIntentsForField(fieldName) {
    const compatible = {
        address: ['addressLine1', 'addressLine2'],
        birthday: ['birthday', 'birthYear', 'birthMonth', 'birthDay'],
        phone: ['phone', 'phoneArea', 'phonePrefix', 'phoneLine', 'phoneCountryCode']
    };
    return compatible[fieldName] || [fieldName];
}

function isCandidateSafeForField(element, fieldName) {
    if (!element || isTokenOrOptionalCodeField(element)) return false;
    const intent = classifyFieldIntent(element);
    if (!intent) return true;
    return getCompatibleIntentsForField(fieldName).includes(intent);
}

/**
 * 查找表单字段（单个）
 */
function findField(fieldName) {
    // 1. 优先尝试 CSS 选择器，但需要 intent 复核，避免宽泛选择器误命中。
    const selectors = FIELD_SELECTORS[fieldName] || [];
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && isFillableElement(element) && isCandidateSafeForField(element, fieldName)) {
                return element;
            }
        } catch (e) {
            // 忽略无效选择器
        }
    }

    // 2. 尝试智能标签匹配
    return findFieldByLabel(fieldName);
}


/**
 * 查找全名字段
 */
function findFullNameField() {
    for (const selector of FULLNAME_SELECTORS) {
        try {
            const element = document.querySelector(selector);
            if (element && isFillableElement(element)) {
                return element;
            }
        } catch (e) {
            console.log('[GeoFill] Selector error:', selector, e);
        }
    }
    return findFieldByIntent('fullName');
}

/**
 * 查找所有匹配的字段（用于密码等需要填写多次的字段）
 */
function findAllFields(fieldName) {
    const selectors = FIELD_SELECTORS[fieldName] || [];
    const elements = [];

    for (const selector of selectors) {
        try {
            const allElements = document.querySelectorAll(selector);
            allElements.forEach(element => {
                if (isFillableElement(element)) {
                    // 避免重复添加
                    if (!elements.includes(element)) {
                        elements.push(element);
                    }
                }
            });
        } catch (e) {
            console.log('[GeoFill] Selector error:', selector, e);
        }
    }

    return elements;
}

/**
 * 检查元素是否可见
 */
function isVisible(element) {
    if (!element) return false;

    if (element.hidden || element.getAttribute?.('hidden') !== '' && element.getAttribute?.('hidden') != null) {
        return false;
    }
    if (element.getAttribute?.('aria-hidden') === 'true') {
        return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0;
}

function isDisabledByContainer(element) {
    return Boolean(
        element.closest?.('[disabled]')
        || element.closest?.('[aria-disabled="true"]')
        || element.closest?.('[inert]')
    );
}

function isReadOnlyLike(element) {
    return Boolean(
        element.readOnly
        || element.getAttribute?.('readonly') !== '' && element.getAttribute?.('readonly') != null
        || element.getAttribute?.('aria-readonly') === 'true'
    );
}

function isDisabledLike(element) {
    return Boolean(
        element.disabled
        || element.getAttribute?.('disabled') !== '' && element.getAttribute?.('disabled') != null
        || element.getAttribute?.('aria-disabled') === 'true'
        || isDisabledByContainer(element)
    );
}

function hasOptionalTokenIntent(element) {
    if (!element) return false;
    const text = [
        element.id,
        element.name,
        element.placeholder,
        element.className,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.getAttribute?.('data-field'),
        element.getAttribute?.('data-testid'),
        element.getAttribute?.('data-test'),
        getLabelText(element)
    ].filter(Boolean).join(' ');
    const signature = compactIntentText(text);
    const intentWords = normalizeIntentWords(text);

    return hasAnyIntent(signature, [
        'vpnbypass',
        'bypasstoken',
        'bypasscode',
        'invitecode',
        'invitationcode',
        'referralcode',
        'couponcode',
        'promocode',
        'promotioncode',
        'discountcode',
        'vouchercode',
        'giftcard',
        'accesscode',
        'activationcode',
        'licensekey',
        'apikey',
        'secretkey',
        'verificationcode',
        'authcode',
        'otpauth',
        'captcha'
    ])
        || hasIntentWord(intentWords, [
            'vpn bypass',
            'bypass token',
            'bypass code',
            'invite code',
            'invitation code',
            'referral code',
            'coupon code',
            'promo code',
            'promotion code',
            'discount code',
            'voucher code',
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

function shouldSkipAutoFillElement(element) {
    return hasOptionalTokenIntent(element);
}

function isFillableElement(element) {
    return Boolean(element && isVisible(element) && !isDisabledLike(element) && !isReadOnlyLike(element) && !shouldSkipAutoFillElement(element));
}

const COUNTRY_ALIASES_FOR_SELECT = {
    'United States': ['United States', 'United States of America', 'USA', 'US', 'America', '840'],
    'United Kingdom': ['United Kingdom', 'UK', 'Great Britain', 'Britain', 'England', 'GB', 'GBR', '826'],
    'Canada': ['Canada', 'CA', 'CAN', '124'],
    'Australia': ['Australia', 'AU', 'AUS', '036'],
    'China': ['China', 'Mainland China', 'People\'s Republic of China', 'PRC', 'CN', 'CHN', '中国', '中國', '156'],
    'Japan': ['Japan', 'JP', 'JPN', '日本', '392'],
    'South Korea': ['South Korea', 'Korea, Republic of', 'Republic of Korea', 'Korea', 'ROK', 'KR', 'KOR', '대한민국', '한국', '410'],
    'Germany': ['Germany', 'DE', 'DEU', 'Deutschland', '276'],
    'France': ['France', 'FR', 'FRA', '250'],
    'Russia': ['Russia', 'Russian Federation', 'RU', 'RUS', '643'],
    'Spain': ['Spain', 'ES', 'ESP', 'España', '724'],
    'Italy': ['Italy', 'IT', 'ITA', '380'],
    'Brazil': ['Brazil', 'BR', 'BRA', 'Brasil', '076'],
    'India': ['India', 'IN', 'IND', '356'],
    'Singapore': ['Singapore', 'SG', 'SGP', '702'],
    'Taiwan': ['Taiwan', 'Taiwan, Province of China', 'TW', 'TWN', '台灣', '台湾', '臺灣', '158'],
    'Hong Kong': ['Hong Kong', 'Hong Kong SAR', 'Hong Kong S.A.R.', 'HK', 'HKG', '香港', '344'],
    'Mexico': ['Mexico', 'MX', 'MEX', 'México', '484'],
    'Netherlands': ['Netherlands', 'The Netherlands', 'NL', 'NLD', 'Holland', 'Nederland', '528']
};

const COUNTRY_DIAL_CODES = {
    'United States': '+1',
    'Canada': '+1',
    'United Kingdom': '+44',
    'Australia': '+61',
    'China': '+86',
    'Japan': '+81',
    'South Korea': '+82',
    'Germany': '+49',
    'France': '+33',
    'Russia': '+7',
    'Spain': '+34',
    'Italy': '+39',
    'Brazil': '+55',
    'India': '+91',
    'Singapore': '+65',
    'Taiwan': '+886',
    'Hong Kong': '+852',
    'Mexico': '+52',
    'Netherlands': '+31'
};

const REGION_ALIASES_FOR_SELECT = {
    'Alabama': ['Alabama', 'AL'],
    'Alaska': ['Alaska', 'AK'],
    'Arizona': ['Arizona', 'AZ'],
    'Arkansas': ['Arkansas', 'AR'],
    'California': ['California', 'CA'],
    'Colorado': ['Colorado', 'CO'],
    'Connecticut': ['Connecticut', 'CT'],
    'Delaware': ['Delaware', 'DE'],
    'Florida': ['Florida', 'FL'],
    'Georgia': ['Georgia', 'GA'],
    'Illinois': ['Illinois', 'IL'],
    'Massachusetts': ['Massachusetts', 'MA'],
    'Michigan': ['Michigan', 'MI'],
    'Minnesota': ['Minnesota', 'MN'],
    'Nevada': ['Nevada', 'NV'],
    'New Jersey': ['New Jersey', 'NJ'],
    'New York': ['New York', 'NY'],
    'North Carolina': ['North Carolina', 'NC'],
    'Ohio': ['Ohio', 'OH'],
    'Oregon': ['Oregon', 'OR'],
    'Pennsylvania': ['Pennsylvania', 'PA'],
    'Texas': ['Texas', 'TX'],
    'Washington': ['Washington', 'WA'],
    'New South Wales': ['New South Wales', 'NSW'],
    'Victoria': ['Victoria', 'VIC'],
    'Queensland': ['Queensland', 'QLD'],
    'Western Australia': ['Western Australia', 'WA'],
    'South Australia': ['South Australia', 'SA'],
    'Australian Capital Territory': ['Australian Capital Territory', 'ACT'],
    'Tasmania': ['Tasmania', 'TAS'],
    'Northern Territory': ['Northern Territory', 'NT'],
    'Ontario': ['Ontario', 'ON'],
    'Quebec': ['Quebec', 'Québec', 'QC'],
    'British Columbia': ['British Columbia', 'BC'],
    'Alberta': ['Alberta', 'AB'],
    'Manitoba': ['Manitoba', 'MB'],
    'Sao Paulo': ['Sao Paulo', 'São Paulo', 'SP'],
    'Rio de Janeiro': ['Rio de Janeiro', 'RJ'],
    'Federal District': ['Federal District', 'Distrito Federal', 'DF'],
    'Bahia': ['Bahia', 'BA'],
    'Ceara': ['Ceara', 'Ceará', 'CE'],
    'Minas Gerais': ['Minas Gerais', 'MG'],
    'Parana': ['Parana', 'Paraná', 'PR'],
    'Pernambuco': ['Pernambuco', 'PE'],
    'Beijing': ['Beijing', '北京市', '北京', 'BJ'],
    'Shanghai': ['Shanghai', '上海市', '上海', 'SH'],
    'Guangdong': ['Guangdong', '广东', '廣東', 'GD'],
    'Zhejiang': ['Zhejiang', '浙江', 'ZJ'],
    'Sichuan': ['Sichuan', '四川', 'SC'],
    'Jiangsu': ['Jiangsu', '江苏', '江蘇', 'JS'],
    'Hubei': ['Hubei', '湖北', 'HB'],
    'Ile-de-France': ['Ile-de-France', 'Île-de-France', 'IDF'],
    'Auvergne-Rhone-Alpes': ['Auvergne-Rhone-Alpes', 'Auvergne-Rhône-Alpes', 'ARA'],
    'Provence-Alpes-Cote d Azur': ['Provence-Alpes-Cote d Azur', 'Provence-Alpes-Côte d\'Azur', 'PACA'],
    'Occitanie': ['Occitanie'],
    'Nouvelle-Aquitaine': ['Nouvelle-Aquitaine'],
    'Hauts-de-France': ['Hauts-de-France'],
    'Grand Est': ['Grand Est'],
    'Berlin': ['Berlin', 'BE'],
    'Hamburg': ['Hamburg', 'HH'],
    'Bavaria': ['Bavaria', 'Bayern', 'BY'],
    'North Rhine-Westphalia': ['North Rhine-Westphalia', 'Nordrhein-Westfalen', 'NRW', 'NW'],
    'Hesse': ['Hesse', 'Hessen', 'HE'],
    'Baden-Wurttemberg': ['Baden-Wurttemberg', 'Baden-Württemberg', 'BW'],
    'Saxony': ['Saxony', 'Sachsen', 'SN'],
    'Tokyo': ['Tokyo', 'Tokyo-to', '東京都', '東京'],
    'Osaka': ['Osaka', 'Osaka-fu', '大阪府', '大阪'],
    'Kyoto': ['Kyoto', 'Kyoto-fu', '京都府', '京都'],
    'Kanagawa': ['Kanagawa', '神奈川県', '神奈川'],
    'Aichi': ['Aichi', '愛知県', '愛知'],
    'Hokkaido': ['Hokkaido', '北海道'],
    'Fukuoka': ['Fukuoka', '福岡県', '福岡'],
    'Hyogo': ['Hyogo', '兵庫県', '兵庫'],
    'Miyagi': ['Miyagi', '宮城県', '宮城'],
    'Lazio': ['Lazio'],
    'Lombardy': ['Lombardy', 'Lombardia'],
    'Campania': ['Campania'],
    'Piedmont': ['Piedmont', 'Piemonte'],
    'Sicily': ['Sicily', 'Sicilia'],
    'Liguria': ['Liguria'],
    'Emilia-Romagna': ['Emilia-Romagna'],
    'Tuscany': ['Tuscany', 'Toscana'],
    'Mexico City': ['Mexico City', 'Ciudad de México', 'CDMX'],
    'Jalisco': ['Jalisco', 'JAL'],
    'Nuevo Leon': ['Nuevo Leon', 'Nuevo León', 'NL'],
    'Puebla': ['Puebla', 'PUE'],
    'Baja California': ['Baja California', 'BC'],
    'Quintana Roo': ['Quintana Roo', 'QR', 'QROO'],
    'North Holland': ['North Holland', 'Noord-Holland', 'NH'],
    'South Holland': ['South Holland', 'Zuid-Holland', 'ZH'],
    'Utrecht': ['Utrecht', 'UT'],
    'Groningen': ['Groningen', 'GR'],
    'North Brabant': ['North Brabant', 'Noord-Brabant', 'NB'],
    'Gelderland': ['Gelderland', 'GE'],
    'Moscow': ['Moscow', 'Москва'],
    'Saint Petersburg': ['Saint Petersburg', 'St Petersburg', 'Санкт-Петербург', 'СПб'],
    'Novosibirsk Oblast': ['Novosibirsk Oblast', 'Novosibirskaya Oblast'],
    'Sverdlovsk Oblast': ['Sverdlovsk Oblast', 'Sverdlovskaya Oblast'],
    'Tatarstan': ['Tatarstan', 'Republic of Tatarstan'],
    'Nizhny Novgorod Oblast': ['Nizhny Novgorod Oblast', 'Nizhegorodskaya Oblast'],
    'Chelyabinsk Oblast': ['Chelyabinsk Oblast'],
    'Samara Oblast': ['Samara Oblast'],
    'Central Region': ['Central Region', 'Central Singapore'],
    'West Region': ['West Region', 'West Singapore'],
    'East Region': ['East Region', 'East Singapore'],
    'North Region': ['North Region', 'North Singapore'],
    'North-East Region': ['North-East Region', 'Northeast Region', 'North East Region'],
    'Seoul': ['Seoul', '서울'],
    'Busan': ['Busan', '부산'],
    'Incheon': ['Incheon', '인천'],
    'Daegu': ['Daegu', '대구'],
    'Daejeon': ['Daejeon', '대전'],
    'Gwangju': ['Gwangju', '광주'],
    'Gyeonggi': ['Gyeonggi', 'Gyeonggi-do', '경기도'],
    'Ulsan': ['Ulsan', '울산'],
    'South Gyeongsang': ['South Gyeongsang', 'Gyeongsangnam-do', '경상남도'],
    'Madrid': ['Madrid', 'Comunidad de Madrid'],
    'Catalonia': ['Catalonia', 'Catalunya', 'Cataluña', 'CAT'],
    'Valencia': ['Valencia', 'Comunitat Valenciana', 'Valencian Community'],
    'Andalusia': ['Andalusia', 'Andalucía'],
    'Aragon': ['Aragon', 'Aragón'],
    'Basque Country': ['Basque Country', 'País Vasco', 'Euskadi'],
    'Murcia': ['Murcia', 'Region of Murcia', 'Región de Murcia'],
    'Taipei City': ['Taipei City', 'Taipei', '台北市', '臺北市'],
    'Kaohsiung City': ['Kaohsiung City', 'Kaohsiung', '高雄市'],
    'Taichung City': ['Taichung City', 'Taichung', '台中市', '臺中市'],
    'Tainan City': ['Tainan City', 'Tainan', '台南市', '臺南市'],
    'Hsinchu City': ['Hsinchu City', 'Hsinchu', '新竹市'],
    'Taoyuan City': ['Taoyuan City', 'Taoyuan', '桃園市'],
    'Hong Kong Island': ['Hong Kong Island', '香港島', '港島'],
    'Kowloon': ['Kowloon', '九龍'],
    'New Territories': ['New Territories', '新界'],
    'Greater London': ['Greater London', 'London'],
    'Greater Manchester': ['Greater Manchester', 'Manchester'],
    'West Midlands': ['West Midlands'],
    'Scotland': ['Scotland', 'SCT'],
    'West Yorkshire': ['West Yorkshire'],
    'South West England': ['South West England', 'South West'],
    'Tyne and Wear': ['Tyne and Wear']
};

const CITY_ALIASES_FOR_SELECT = {
    'New York': ['New York', 'New York City', 'NYC'],
    'Los Angeles': ['Los Angeles', 'LA'],
    'San Francisco': ['San Francisco', 'SF'],
    'Mexico City': ['Mexico City', 'Ciudad de México', 'CDMX'],
    'Sao Paulo': ['Sao Paulo', 'São Paulo'],
    'Tokyo': ['Tokyo', '東京', '東京都'],
    'Osaka': ['Osaka', '大阪'],
    'Kyoto': ['Kyoto', '京都'],
    'Yokohama': ['Yokohama', '横浜'],
    'Seoul': ['Seoul', '서울'],
    'Taipei': ['Taipei', '台北', '臺北', '台北市', '臺北市'],
    'Kaohsiung': ['Kaohsiung', '高雄', '高雄市'],
    'Taichung': ['Taichung', '台中', '臺中', '台中市', '臺中市'],
    'Hong Kong': ['Hong Kong', '香港'],
    'Central': ['Central', '中環'],
    'Kowloon': ['Kowloon', '九龍'],
    'Tsim Sha Tsui': ['Tsim Sha Tsui', '尖沙咀']
};

const FIELD_INTENTS = {
    identity: ['firstName', 'lastName', 'fullName', 'email', 'username'],
    address: ['addressLine1', 'addressLine2', 'city', 'state', 'zipCode'],
    birthday: ['birthday', 'birthYear', 'birthMonth', 'birthDay'],
    birthdayInputKeys: ['birthday', 'birthDate', 'dateOfBirth'],
    phone: ['phone', 'phoneArea', 'phonePrefix', 'phoneLine'],
    phoneSegments: ['phoneArea', 'phonePrefix', 'phoneLine'],
    countryPhone: ['country', 'phoneCountryCode', 'phone', 'phoneArea', 'phonePrefix', 'phoneLine'],
    simpleRequested: ['email', 'username', 'country', 'city', 'state', 'zipCode', 'gender']
};

const SPECIAL_HANDLED_FIELDS = new Set([
    'firstName', 'lastName', 'email', 'username', 'password',
    'address', 'city', 'state', 'zipCode',
    'country', 'phone',
    ...FIELD_INTENTS.birthdayInputKeys
]);

const VALIDATION_REQUESTED_FIELDS = [
    'firstName', 'lastName', 'email', 'username', 'password', 'gender',
    ...FIELD_INTENTS.birthdayInputKeys,
    'address', 'city', 'state', 'zipCode', 'country', 'phone'
];

function isBirthdayInputKey(fieldName) {
    return FIELD_INTENTS.birthdayInputKeys.includes(fieldName);
}

function normalizeIntentText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .toLowerCase();
}

function normalizeIntentWords(value) {
    return normalizeIntentText(String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2'))
        .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af+#]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactIntentText(value) {
    return normalizeIntentText(value).replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af+#]+/g, '');
}

function hasAnyIntent(text, keywords) {
    return keywords.some((keyword) => text.includes(compactIntentText(keyword)));
}

function hasIntentWord(text, keywords) {
    const padded = ` ${normalizeIntentWords(text)} `;
    return keywords.some((keyword) => {
        const normalized = normalizeIntentWords(keyword);
        return normalized && padded.includes(` ${normalized} `);
    });
}

function getElementSignature(element) {
    const parts = [
        element.id,
        element.name,
        element.type,
        element.autocomplete,
        element.placeholder,
        element.className,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.getAttribute?.('data-field'),
        element.getAttribute?.('data-testid'),
        element.getAttribute?.('data-test'),
        getLabelText(element)
    ];

    return compactIntentText(parts.filter(Boolean).join(' '));
}

function getElementIntentWords(element) {
    const parts = [
        element.id,
        element.name,
        element.type,
        element.autocomplete,
        element.placeholder,
        element.className,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.getAttribute?.('data-field'),
        element.getAttribute?.('data-testid'),
        element.getAttribute?.('data-test'),
        getLabelText(element)
    ];

    return normalizeIntentWords(parts.filter(Boolean).join(' '));
}

function hasBirthdayIntent(signature, intentWords) {
    return hasAnyIntent(signature, ['birthday', 'birthdate', 'dateofbirth', 'dob', 'bday', '生年月日', '生日', '出生日期', '誕生日'])
        || hasIntentWord(intentWords, ['birth', 'birthday', 'dob', 'bday']);
}

function hasEmailIntent(signature, intentWords, type, autocomplete) {
    return type === 'email'
        || autocomplete === 'email'
        || hasAnyIntent(signature, ['email', 'emailaddress', 'e-mail', 'mailaddress', 'メールアドレス', '邮箱', '郵箱', '电子邮件', '電子郵件'])
        || hasIntentWord(intentWords, ['email', 'e mail', 'mail address']);
}

function hasUsernameIntent(signature, intentWords, autocomplete, isEmail) {
    if (isEmail) return false;
    return autocomplete === 'username'
        || hasAnyIntent(signature, ['username', 'userid', 'userlogin', 'loginid', 'accountid', 'nickname', 'screenname', 'handle', 'ユーザー名', '账号', '帐号', '账户名'])
        || hasIntentWord(intentWords, ['username', 'user name', 'user id', 'login', 'login id', 'account', 'account id', 'nickname', 'nick', 'screen name', 'handle']);
}

function hasFirstNameIntent(signature, intentWords, autocomplete) {
    return autocomplete === 'givenname'
        || autocomplete === 'firstname'
        || hasAnyIntent(signature, ['firstname', 'givenname', 'forename', '名'])
        || hasIntentWord(intentWords, ['first name', 'given name', 'forename', 'fname']);
}

function hasLastNameIntent(signature, intentWords, autocomplete) {
    return autocomplete === 'familyname'
        || autocomplete === 'lastname'
        || hasAnyIntent(signature, ['lastname', 'familyname', 'surname', '氏', '姓'])
        || hasIntentWord(intentWords, ['last name', 'family name', 'surname', 'lname']);
}

function hasFullNameIntent(signature, intentWords, autocomplete, isUsername, isEmail) {
    if (isUsername || isEmail) return false;
    if (autocomplete === 'name') return true;
    if (hasAnyIntent(signature, ['fullname', 'realname', 'legalname', 'yourname', 'displayname', '姓名', '氏名', 'お名前'])) return true;
    if (hasIntentWord(intentWords, ['full name', 'real name', 'legal name', 'your name', 'display name'])) return true;
    return hasIntentWord(intentWords, ['name']) && !hasIntentWord(intentWords, [
        'first', 'last', 'given', 'family', 'sur', 'user', 'nick',
        'middle', 'maiden', 'company', 'business', 'organization', 'organisation', 'org', 'store', 'shop'
    ]);
}

function getFillableElements() {
    return Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'))
        .filter(isFillableElement);
}

function getSelectOptions(element) {
    return Array.from(element.options || []);
}

function selectLooksLikePhoneCode(element) {
    if (!element || element.tagName?.toLowerCase() !== 'select') return false;
    const options = getSelectOptions(element).slice(0, 20);
    if (options.length === 0) return false;
    return options.some((option) => /^\+?\d{1,4}$/.test(String(option.value || option.text || '').trim()));
}

function optionLooksLikeCountry(option) {
    const tokens = [
        option.text,
        option.value,
        option.getAttribute?.('label'),
        option.getAttribute?.('data-country-code'),
        option.getAttribute?.('data-code')
    ].filter(Boolean).map((value) => compactIntentText(value));

    return tokens.some((token) => {
        if (!token) return false;
        return Object.values(COUNTRY_ALIASES_FOR_SELECT)
            .some((aliases) => aliases.some((alias) => compactIntentText(alias) === token));
    });
}

function selectLooksLikeCountrySelect(element, signature, autocomplete) {
    if (!element || element.tagName?.toLowerCase() !== 'select') return false;

    if (hasAnyIntent(signature, ['phonecountry', 'telcountry', 'dialcode', 'callingcode', 'isdcode'])) {
        return false;
    }

    if (autocomplete === 'country' || autocomplete === 'countryname') return true;
    if (!hasAnyIntent(signature, ['country', 'nation', '国家', '国'])) return false;

    return getSelectOptions(element).slice(0, 40).some(optionLooksLikeCountry);
}

function hasRequiredConsentIntent(signature) {
    return hasAnyIntent(signature, [
        'terms', 'conditions', 'privacy', 'policy', 'agreement', 'agree', 'consent', 'tos',
        '条款', '隐私', '同意', '規約', 'プライバシー'
    ]);
}

function hasServiceNotificationIntent(signature) {
    return hasAnyIntent(signature, [
        'accountnotice', 'accountnotification', 'servicenotice', 'servicenotification',
        'securityalert', 'securitynotice', 'transactional', 'orderupdate', 'shippingupdate',
        'billingnotice', 'importantnotice', 'importantupdate', 'notification', 'notifications',
        '必要', '重要', '通知'
    ]);
}

function hasNewsletterIntent(signature) {
    if (hasServiceNotificationIntent(signature)) return false;
    return hasAnyIntent(signature, [
        'newsletter', 'subscribe', 'subscription', 'marketing', 'promotion', 'promotions',
        'offers', 'mailing', 'campaign', 'advertising'
    ]);
}

function classifyFieldIntent(element) {
    const tag = element.tagName?.toLowerCase() || '';
    const type = String(element.type || '').toLowerCase();
    const autocomplete = compactIntentText(element.autocomplete || '');
    const signature = getElementSignature(element);
    const intentWords = getElementIntentWords(element);
    const hasBirthContext = hasBirthdayIntent(signature, intentWords);
    const isEmail = hasEmailIntent(signature, intentWords, type, autocomplete);
    const isUsername = hasUsernameIntent(signature, intentWords, autocomplete, isEmail);
    const isCountrySelect = selectLooksLikeCountrySelect(element, signature, autocomplete);

    if (type === 'checkbox') {
        if (hasRequiredConsentIntent(signature)) {
            return 'requiredConsentCheckbox';
        }
        if (element.required) return 'requiredConsentCheckbox';
        if (hasNewsletterIntent(signature)) {
            return 'newsletterCheckbox';
        }
        return 'checkbox';
    }

    if (isEmail) return 'email';
    if (isUsername) return 'username';
    if (hasFirstNameIntent(signature, intentWords, autocomplete)) return 'firstName';
    if (hasLastNameIntent(signature, intentWords, autocomplete)) return 'lastName';
    if (hasFullNameIntent(signature, intentWords, autocomplete, isUsername, isEmail)) return 'fullName';

    if ((tag === 'select' || type === 'radio' || type === 'text') && (hasIntentWord(intentWords, ['gender', 'sex']) || hasAnyIntent(signature, ['性别', '性別', '性별']))) {
        return 'gender';
    }

    if (autocomplete === 'bdayyear' || hasAnyIntent(signature, ['birthyear', 'birthdayyear', 'dateofbirthyear', 'dobyear', 'bdayyear', '生年'])) {
        return 'birthYear';
    }
    if (autocomplete === 'bdaymonth' || hasAnyIntent(signature, ['birthmonth', 'birthdaymonth', 'dateofbirthmonth', 'dobmonth', 'bdaymonth', '生月'])) {
        return 'birthMonth';
    }
    if (autocomplete === 'bdayday' || hasAnyIntent(signature, ['birthdayday', 'dateofbirthday', 'dobday', 'bdayday'])) {
        return 'birthDay';
    }
    if (hasBirthContext) {
        if (hasIntentWord(intentWords, ['year', 'yyyy', 'yy', '年'])) return 'birthYear';
        if (hasIntentWord(intentWords, ['month', 'mon', 'mm', '月'])) return 'birthMonth';
        if (hasIntentWord(intentWords, ['day', 'dd', '日'])) return 'birthDay';
    }
    if (type === 'date' || autocomplete === 'bday' || autocomplete === 'birthday' || hasBirthContext) {
        return 'birthday';
    }

    if (autocomplete === 'addressline1' || hasAnyIntent(signature, ['addressline1', 'address1', 'addr1', 'streetaddress1', '住所1'])) {
        return 'addressLine1';
    }
    if (autocomplete === 'addressline2' || hasAnyIntent(signature, ['addressline2', 'address2', 'addr2', 'apartment', 'suite', 'unit', 'apt', 'building', 'flat', '住所2', '建物名'])) {
        return 'addressLine2';
    }
    if (autocomplete === 'addresslevel2' || hasAnyIntent(signature, ['city', 'town', 'locality', 'municipality', 'suburb', '市区町村', '城市'])) {
        return 'city';
    }
    if (autocomplete === 'addresslevel1' || hasAnyIntent(signature, ['state', 'province', 'region', 'prefecture', 'county', '都道府県', '省', '州'])) {
        return 'state';
    }
    if (autocomplete === 'postalcode' || hasAnyIntent(signature, ['zipcode', 'zip', 'postalcode', 'postcode', 'post code', '邮编', '郵便番号'])) {
        return 'zipCode';
    }
    if (autocomplete === 'telcountrycode' || hasAnyIntent(signature, ['phonecountrycode', 'telcountrycode', 'dialcode', 'callingcode', 'isdcode']) || (selectLooksLikePhoneCode(element) && !isCountrySelect)) {
        return 'phoneCountryCode';
    }
    if (autocomplete === 'telareacode' || hasAnyIntent(signature, ['phonearea', 'telarea', 'areacode']) || hasIntentWord(intentWords, ['phone1', 'tel1'])) {
        return 'phoneArea';
    }
    if (autocomplete === 'tellocalprefix' || hasAnyIntent(signature, ['phoneprefix', 'telprefix', 'localprefix']) || hasIntentWord(intentWords, ['phone2', 'tel2'])) {
        return 'phonePrefix';
    }
    if (autocomplete === 'tellocalsuffix' || hasAnyIntent(signature, ['phoneline', 'phonesuffix', 'telsuffix', 'localsuffix']) || hasIntentWord(intentWords, ['phone3', 'tel3'])) {
        return 'phoneLine';
    }
    if (autocomplete === 'telnational' || autocomplete === 'tel' || type === 'tel' || hasAnyIntent(signature, ['phone', 'mobile', 'telephone', 'tel', 'cell', '手机号', '電話', '携帯'])) {
        return 'phone';
    }
    if (autocomplete === 'country' || autocomplete === 'countryname' || isCountrySelect || hasAnyIntent(signature, ['country', 'nation', '国家', '国'])) {
        if (hasAnyIntent(signature, ['phonecountry', 'telcountry', 'dialcode', 'callingcode', 'isdcode']) || (selectLooksLikePhoneCode(element) && !isCountrySelect)) {
            return 'phoneCountryCode';
        }
        return 'country';
    }
    if (tag === 'textarea' && hasAnyIntent(signature, ['address', 'street', 'addr', '住所', '地址'])) {
        return 'addressLine1';
    }
    if (hasAnyIntent(signature, ['address', 'street', 'addr', '住所', '地址'])) {
        return 'addressLine1';
    }

    return '';
}

function findFieldByIntent(intent, usedElements = new Set()) {
    return getFillableElements().find((element) => !usedElements.has(element) && classifyFieldIntent(element) === intent) || null;
}

function findAllFieldsByIntent(intent, usedElements = new Set()) {
    return getFillableElements().filter((element) => !usedElements.has(element) && classifyFieldIntent(element) === intent);
}

function findFieldSmart(fieldName, usedElements = new Set()) {
    const fromIntent = findFieldByIntent(fieldName, usedElements);
    if (fromIntent) return fromIntent;

    const fromSelectors = findField(fieldName);
    if (fromSelectors && !usedElements.has(fromSelectors)) {
        return fromSelectors;
    }
    return null;
}

function getPositiveMaxLength(element) {
    const direct = Number(element.maxLength);
    const attr = Number(element.getAttribute?.('maxlength'));
    const value = Number.isFinite(direct) && direct > 0
        ? direct
        : Number.isFinite(attr) && attr > 0
            ? attr
            : 0;
    return value > 0 ? value : 0;
}

function getElementPatternText(element) {
    return String(element.pattern || element.getAttribute?.('pattern') || '');
}

function getElementInputMode(element) {
    return String(element.inputMode || element.getAttribute?.('inputmode') || '').toLowerCase();
}

function stripNonDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function compactAlphaNumeric(value) {
    return String(value || '').replace(/[^a-zA-Z0-9]/g, '');
}

function elementPrefersDigits(element) {
    const type = String(element.type || '').toLowerCase();
    const inputMode = getElementInputMode(element);
    const pattern = getElementPatternText(element);
    return type === 'number'
        || inputMode === 'numeric'
        || inputMode === 'decimal'
        || /(?:\\d|\[0-9\]|\[\\d\])/.test(pattern);
}

function elementHintsAtPlusPrefix(element) {
    const text = [
        element.placeholder,
        element.getAttribute?.('placeholder'),
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.name,
        element.id,
        getLabelText(element)
    ].filter(Boolean).join(' ');
    return /\+/.test(text) || /\\\+/.test(getElementPatternText(element));
}

function trimToMaxLength(element, value) {
    const maxLength = getPositiveMaxLength(element);
    const text = String(value || '');
    return maxLength && text.length > maxLength ? text.slice(0, maxLength) : text;
}

function formatPostalCodeForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const compact = compactAlphaNumeric(raw);
    const maxLength = getPositiveMaxLength(element);

    if (elementPrefersDigits(element) && digits) {
        return trimToMaxLength(element, digits);
    }

    if (maxLength && compact && compact.length <= maxLength && compact.length < raw.length) {
        return compact;
    }

    return trimToMaxLength(element, raw);
}

function formatBirthdayForInput(element, value) {
    const raw = String(value || '').trim();
    const type = String(element.type || '').toLowerCase();
    if (type === 'date') return raw;

    const parts = splitBirthdayParts(raw);
    if (!parts.year || !parts.month || !parts.day) return trimToMaxLength(element, raw);

    const placeholder = normalizeIntentText(element.placeholder || element.getAttribute?.('placeholder') || '');
    const pattern = getElementPatternText(element);
    const maxLength = getPositiveMaxLength(element);
    const yyyymmdd = `${parts.year}${parts.month}${parts.day}`;

    if (maxLength === 8 || elementPrefersDigits(element) || /(?:\\d|\[0-9\])\{8\}/.test(pattern) || placeholder.includes('yyyymmdd')) {
        return yyyymmdd;
    }

    if (placeholder.includes('mm/dd') || placeholder.includes('mm-dd')) {
        return trimToMaxLength(element, `${parts.month}/${parts.day}/${parts.year}`);
    }

    if (placeholder.includes('dd/mm') || placeholder.includes('dd-mm')) {
        return trimToMaxLength(element, `${parts.day}/${parts.month}/${parts.year}`);
    }

    return trimToMaxLength(element, raw);
}

function formatPhoneForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const national = splitPhoneParts(raw).national || digits;
    const maxLength = getPositiveMaxLength(element);
    const type = String(element.type || '').toLowerCase();
    const autocomplete = compactIntentText(element.autocomplete || '');
    const hintText = normalizeIntentText([
        element.placeholder,
        element.getAttribute?.('placeholder'),
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('title'),
        element.name,
        element.id,
        getLabelText(element)
    ].filter(Boolean).join(' '));

    if (autocomplete === 'telnational' && national) {
        return trimToMaxLength(element, national);
    }

    if (autocomplete === 'telcountrycode') {
        const code = splitPhoneParts(raw).countryCode || raw;
        return formatPhoneCountryCodeForInput(element, code);
    }

    if (maxLength && national && national.length <= maxLength && raw.length > maxLength) {
        return trimToMaxLength(element, national);
    }

    if ((elementPrefersDigits(element) || type === 'number') && digits) {
        if (maxLength && national && national.length <= maxLength) {
            return trimToMaxLength(element, national);
        }
        return trimToMaxLength(element, digits);
    }

    if (hintText.includes('countrycode') || hintText.includes('dialcode') || hintText.includes('callingcode')) {
        return formatPhoneCountryCodeForInput(element, splitPhoneParts(raw).countryCode || raw);
    }

    if ((hintText.includes('national') || hintText.includes('without country') || hintText.includes('no country')) && national) {
        return trimToMaxLength(element, national);
    }

    return trimToMaxLength(element, raw);
}

function formatPhoneCountryCodeForInput(element, value) {
    const raw = String(value || '').trim();
    const digits = stripNonDigits(raw);
    const maxLength = getPositiveMaxLength(element);
    const withPlus = raw.startsWith('+') ? raw : `+${digits || raw}`;

    if (elementPrefersDigits(element) || String(element.type || '').toLowerCase() === 'number') {
        return trimToMaxLength(element, digits);
    }

    if (elementHintsAtPlusPrefix(element) && (!maxLength || withPlus.length <= maxLength)) {
        return trimToMaxLength(element, withPlus);
    }

    if (maxLength && withPlus.length > maxLength && digits.length <= maxLength) {
        return digits;
    }

    return trimToMaxLength(element, withPlus);
}

function formatValueForField(element, value, intent) {
    if (!element || element.tagName?.toLowerCase() === 'select') return String(value || '');

    switch (intent) {
        case 'zipCode':
            return formatPostalCodeForInput(element, value);
        case 'birthday':
            return formatBirthdayForInput(element, value);
        case 'phone':
        case 'phoneArea':
        case 'phonePrefix':
        case 'phoneLine':
            return formatPhoneForInput(element, value);
        case 'phoneCountryCode':
            return formatPhoneCountryCodeForInput(element, value);
        default:
            return String(value || '');
    }
}

function simulateFieldInput(element, value, intent) {
    simulateInput(element, formatValueForField(element, value, intent));
}

function dispatchValueChangeEvents(element) {
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a' }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * 模拟用户输入（增强版，支持 React/Vue 等框架）
 */
function simulateInput(element, value) {
    // 聚焦元素
    element.focus();

    // 对于 React 等框架，需要使用原生 setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    )?.set;

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    // 清空并设置值
    if (element.tagName.toLowerCase() === 'textarea' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value);
    } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
    } else {
        element.value = value;
    }

    // 触发各种事件以确保表单验证和框架状态更新
    dispatchValueChangeEvents(element);

    // 失焦触发验证
    element.blur();
}

/**
 * 处理 select 元素（增强版）
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
function fillRadio(name, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name*="${name}" i]`);
    const searchValue = value.toLowerCase();

    for (const radio of radios) {
        const radioValue = radio.value.toLowerCase();
        const labelText = radio.labels?.[0]?.textContent?.toLowerCase() || '';

        if (radioValue.includes(searchValue) || labelText.includes(searchValue)) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return false;
}

function getElementCurrentValue(element) {
    if (!element) return '';
    const value = element.value;
    if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
    }
    if (element._v !== undefined && element._v !== null) {
        return String(element._v).trim();
    }
    return '';
}

function isElementRequired(element) {
    return Boolean(
        element.required
        || element.getAttribute?.('required') !== '' && element.getAttribute?.('required') != null
        || element.getAttribute?.('aria-required') === 'true'
    );
}

function isRadioGroupFilled(element) {
    return getRadioGroup(element).some((radio) => radio.checked);
}

function isElementFilled(element) {
    if (!element) return false;

    const tag = element.tagName?.toLowerCase() || '';
    const type = String(element.type || '').toLowerCase();

    if (type === 'checkbox') return Boolean(element.checked);
    if (type === 'radio') return isRadioGroupFilled(element);

    if (tag === 'select') {
        const selected = getSelectOptions(element)[element.selectedIndex];
        if (!selected || isPlaceholderOption(selected) || isOptionDisabled(selected)) return false;
        return Boolean(String(selected.value || selected.text || '').trim());
    }

    return getElementCurrentValue(element) !== '';
}

function describeField(element, fallbackIndex = 0) {
    const intent = classifyFieldIntent(element) || '';
    const id = String(element.id || '').trim();
    const name = String(element.name || '').trim();
    const label = String(getLabelText(element) || element.placeholder || element.getAttribute?.('aria-label') || '').trim();

    return {
        id: id || name || `field_${fallbackIndex}`,
        name,
        type: String(element.type || element.tagName?.toLowerCase() || '').trim(),
        intent,
        label
    };
}

function getSelectOptionDiagnostics(element, limit = 8) {
    if (!element || element.tagName?.toLowerCase() !== 'select') return [];

    return getSelectOptions(element)
        .filter((option) => !isOptionDisabled(option) && !isPlaceholderOption(option))
        .map((option) => ({
            text: String(option.text || '').trim(),
            value: String(option.value || '').trim(),
            code: String(option.getAttribute?.('data-code') || option.getAttribute?.('data-country-code') || '').trim()
        }))
        .filter((option) => option.text || option.value || option.code)
        .slice(0, limit);
}

function describeCandidateForDiagnostics(element, fallbackIndex = 0) {
    const description = describeField(element, fallbackIndex);
    const options = getSelectOptionDiagnostics(element);
    if (options.length > 0) {
        description.options = options;
    }
    return description;
}

function getMissingRequiredFields() {
    const missing = [];
    const seenRadioGroups = new Set();

    getFillableElements().forEach((element, index) => {
        if (!isElementRequired(element)) return;

        if (String(element.type || '').toLowerCase() === 'radio') {
            const key = element.name || element.id || `radio_${index}`;
            if (seenRadioGroups.has(key)) return;
            seenRadioGroups.add(key);
        }

        if (!isElementFilled(element)) {
            missing.push(describeField(element, index));
        }
    });

    return missing;
}

function addUniqueElements(target, elements) {
    elements.forEach((element) => {
        if (element && !target.includes(element)) target.push(element);
    });
}

function getElementsByIntents(intents) {
    const normalized = new Set(intents);
    return getFillableElements().filter((element) => normalized.has(classifyFieldIntent(element)));
}

function getRequestedFieldCandidates(fieldName, data) {
    const candidates = [];

    if (FIELD_INTENTS.simpleRequested.includes(fieldName)) {
        addUniqueElements(candidates, getElementsByIntents([fieldName]));
        return candidates;
    }

    switch (fieldName) {
        case 'firstName':
            addUniqueElements(candidates, getElementsByIntents(['firstName']));
            if (data.firstName && data.lastName) addUniqueElements(candidates, getElementsByIntents(['fullName']));
            break;
        case 'lastName':
            addUniqueElements(candidates, getElementsByIntents(['lastName']));
            if (data.firstName && data.lastName) addUniqueElements(candidates, getElementsByIntents(['fullName']));
            break;
        case 'address':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.address.slice(0, 2)));
            break;
        case 'phone':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.phone));
            break;
        case 'birthday':
        case 'birthDate':
        case 'dateOfBirth':
            addUniqueElements(candidates, getElementsByIntents(FIELD_INTENTS.birthday));
            break;
        case 'password':
            addUniqueElements(candidates, findPasswordFields());
            break;
        default: {
            const fallback = findField(fieldName);
            if (fallback) candidates.push(fallback);
        }
    }

    return candidates;
}

function isRequestedFieldSatisfied(fieldName, candidates) {
    if (candidates.length === 0) return true;

    const filledByIntent = (intent) => candidates.some((element) => classifyFieldIntent(element) === intent && isElementFilled(element));

    switch (fieldName) {
        case 'firstName':
            return filledByIntent('firstName') || filledByIntent('fullName');
        case 'lastName':
            return filledByIntent('lastName') || filledByIntent('fullName');
        case 'address':
            return filledByIntent('addressLine1');
        case 'phone':
            return filledByIntent('phone')
                || FIELD_INTENTS.phoneSegments.filter((intent) => filledByIntent(intent)).length >= 2;
        case 'birthday':
        case 'birthDate':
        case 'dateOfBirth':
            return filledByIntent('birthday')
                || FIELD_INTENTS.birthday.filter((intent) => intent !== 'birthday').every((intent) => filledByIntent(intent));
        case 'password':
            return candidates.some(isElementFilled);
        default:
            return candidates.some(isElementFilled);
    }
}

function buildFillValidation(data) {
    const missingRequiredFields = getMissingRequiredFields();
    const unfilledRequestedFields = [];

    VALIDATION_REQUESTED_FIELDS.forEach((fieldName) => {
        if (!data[fieldName]) return;
        const candidates = getRequestedFieldCandidates(fieldName, data);
        if (candidates.length === 0) return;
        if (isRequestedFieldSatisfied(fieldName, candidates)) return;

        unfilledRequestedFields.push({
            field: fieldName,
            requestedValue: String(data[fieldName] || '').slice(0, 120),
            reason: 'empty_after_fill',
            candidates: candidates.map((element, index) => describeCandidateForDiagnostics(element, index))
        });
    });

    return {
        isComplete: missingRequiredFields.length === 0 && unfilledRequestedFields.length === 0,
        missingRequiredFields,
        unfilledRequestedFields
    };
}

const PAGE_ERROR_SELECTORS = [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[aria-live="polite"]',
    '.error',
    '.errors',
    '.field-error',
    '.form-error',
    '.error-message',
    '.invalid-feedback',
    '.validation-error',
    '[class*="error"]',
    '[class*="invalid"]',
    '[id*="error"]',
    '[id*="invalid"]'
];

function normalizeDiagnosticText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
}

function isLikelyErrorText(text) {
    const normalized = normalizeIntentText(text);
    return /(?:error|invalid|required|missing|please|enter|select|choose|failed|wrong|not valid|must|cannot|can't|必填|错误|錯誤|无效|無效|请输入|請輸入|请选择|請選擇|未入力|エラー|無効|필수|오류)/.test(normalized);
}

function isDiagnosticNodeVisible(node) {
    if (!node || node.hidden || node.getAttribute?.('hidden') !== '' && node.getAttribute?.('hidden') != null) {
        return false;
    }
    if (node.getAttribute?.('aria-hidden') === 'true') return false;

    const style = window.getComputedStyle?.(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
        return false;
    }

    const rect = node.getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return false;

    return true;
}

function collectDescribedByText(element) {
    return normalizeDiagnosticText(getTextByElementIds(element.getAttribute?.('aria-describedby')));
}

function collectNativeInvalidFieldErrors() {
    const errors = [];
    const seen = new Set();

    getFillableElements().forEach((element, index) => {
        const ariaInvalid = element.getAttribute?.('aria-invalid') === 'true';
        let nativeInvalid = false;
        try {
            nativeInvalid = Boolean(element.validity && element.validity.valid === false);
        } catch (e) {
            nativeInvalid = false;
        }
        try {
            nativeInvalid = nativeInvalid || Boolean(element.matches?.(':invalid'));
        } catch (e) {
            // Some fake DOMs or browser restrictions can throw on :invalid.
        }

        if (!ariaInvalid && !nativeInvalid) return;

        const description = collectDescribedByText(element);
        const message = normalizeDiagnosticText(element.validationMessage || description || `${describeField(element, index).id} is invalid`);
        if (!message) return;

        const key = `field:${describeField(element, index).id}:${message}`;
        if (seen.has(key)) return;
        seen.add(key);

        errors.push({
            source: ariaInvalid ? 'aria-invalid' : 'native-validation',
            text: message,
            field: describeField(element, index)
        });
    });

    return errors;
}

function collectPageErrorMessages() {
    const errors = [];
    const seen = new Set();

    try {
        Array.from(document.querySelectorAll(PAGE_ERROR_SELECTORS.join(','))).forEach((node) => {
            if (!isDiagnosticNodeVisible(node)) return;
            const text = normalizeDiagnosticText(node.innerText || node.textContent || node.getAttribute?.('aria-label'));
            if (!text) return;
            if (text.length < 3 || text.length > 240) return;
            if (!isLikelyErrorText(text) && node.getAttribute?.('role') !== 'alert') return;

            const key = compactIntentText(text);
            if (seen.has(key)) return;
            seen.add(key);

            errors.push({
                source: node.getAttribute?.('role') === 'alert' ? 'alert' : 'page-error-text',
                text
            });
        });
    } catch (e) {
        // Error scanning is diagnostic-only; never block form filling.
    }

    return [...collectNativeInvalidFieldErrors(), ...errors].slice(0, 12);
}

function inferUnfilledRequestedReason(issue) {
    const candidates = Array.isArray(issue?.candidates) ? issue.candidates : [];
    if (candidates.length === 0) return 'field_not_found';
    if (candidates.some((candidate) => String(candidate.type || '').toLowerCase().includes('select'))) {
        return 'select_option_not_matched';
    }
    if (candidates.some((candidate) => String(candidate.type || '').toLowerCase() === 'radio')) {
        return 'radio_option_not_matched';
    }
    return issue?.reason || 'empty_after_fill';
}

function buildFillDiagnostics(data, results, validation, filledCount = 0) {
    const fieldIssues = [];

    (validation?.missingRequiredFields || []).forEach((field) => {
        fieldIssues.push({
            kind: 'required_missing',
            field: field.intent || field.name || field.id,
            reason: 'required_field_empty',
            label: field.label || field.name || field.id,
            target: field
        });
    });

    (validation?.unfilledRequestedFields || []).forEach((issue) => {
        fieldIssues.push({
            kind: 'requested_unfilled',
            field: issue.field,
            requestedValue: issue.requestedValue || '',
            reason: inferUnfilledRequestedReason(issue),
            label: issue.candidates?.[0]?.label || issue.field,
            candidates: issue.candidates || []
        });
    });

    const pageErrors = collectPageErrorMessages();

    return {
        isClean: fieldIssues.length === 0 && pageErrors.length === 0,
        summary: {
            filledCount: Number(filledCount || 0),
            missingRequiredCount: validation?.missingRequiredFields?.length || 0,
            unfilledRequestedCount: validation?.unfilledRequestedFields?.length || 0,
            pageErrorCount: pageErrors.length,
            fieldIssueCount: fieldIssues.length
        },
        fieldIssues,
        pageErrors
    };
}

function logFillSummary(filledCount, results, validation, diagnostics) {
    if (validation?.isComplete) {
        if (diagnostics?.pageErrors?.length) {
            console.warn('[GeoFill] 填写完成但页面仍显示错误:', {
                filledCount,
                pageErrorCount: diagnostics.pageErrors.length,
                pageErrors: diagnostics.pageErrors
            });
            return;
        }
        console.log('[GeoFill] 填写完成:', filledCount, '个字段');
        return;
    }

    console.warn('[GeoFill] 填写完成但仍有未填项:', {
        filledCount,
        missingRequiredCount: validation?.missingRequiredFields?.length || 0,
        unfilledRequestedCount: validation?.unfilledRequestedFields?.length || 0,
        pageErrorCount: diagnostics?.pageErrors?.length || 0,
        results,
        validation,
        diagnostics
    });
}

function isSuccessfulFillStatus(status) {
    return /^(filled|updated|already filled)/.test(String(status || ''));
}

function parseFillResultCount(value) {
    const match = String(value || '').match(/^(filled|updated)\s+(\d+)\s+field/);
    if (!match) return null;
    return {
        action: match[1],
        count: Number.parseInt(match[2], 10)
    };
}

function mergeFillResultStatus(previous, next) {
    if (!previous) return next;
    if (!next) return previous;

    const previousCount = parseFillResultCount(previous);
    const nextCount = parseFillResultCount(next);
    if (previousCount && nextCount && previousCount.action === nextCount.action) {
        return `${previousCount.action} ${previousCount.count + nextCount.count} field(s)`;
    }

    if (isSuccessfulFillStatus(previous) && !isSuccessfulFillStatus(next)) {
        return previous;
    }

    return next;
}

function mergeFillPassResult(target, source) {
    target.filledCount += Number(source?.filledCount || 0);
    Object.entries(source?.results || {}).forEach(([key, value]) => {
        target.results[key] = mergeFillResultStatus(target.results[key], value);
    });
    target.validation = source?.validation || target.validation;
    target.diagnostics = source?.diagnostics || target.diagnostics;
}

function scheduleDelayedAddressFallback(data, results, usedElements = new Set()) {
    if (!data.address || results.addressParts || isSuccessfulFillStatus(results.address)) return;

    // 最后兜底只允许填写明确识别为地址行的字段。宁可漏填，也不要把地址写入验证码、token、备注等宽匹配字段。
    setTimeout(() => {
        const addressEl = findFieldByIntent('addressLine1', usedElements);
        if (addressEl && classifyFieldIntent(addressEl) === 'addressLine1' && !isTokenOrOptionalCodeField(addressEl)) {
            simulateInput(addressEl, data.address);
            console.log('[GeoFill] 延迟填写 address:', data.address);
        }
    }, 1500);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFillableElementSignature() {
    return getFillableElements().map((element, index) => [
        index,
        element.tagName,
        element.type,
        element.id,
        element.name,
        element.autocomplete,
        element.getAttribute?.('aria-label') || ''
    ].join(':')).join('|');
}

function getSelectStateSignature() {
    return getFillableElements()
        .filter((element) => element.tagName?.toLowerCase() === 'select')
        .map((element, index) => [
            index,
            element.id,
            element.name,
            element.selectedIndex,
            element.value
        ].join(':')).join('|');
}

const DYNAMIC_FILL_RETRY_DELAYS = [200, 500, 900];
const POST_FILL_DIAGNOSTIC_DELAYS = [120, 380];

/**
 * 填写表单（增强版）
 */
function fillForm(data, options = {}) {
    let filledCount = 0;
    const results = {};
    const usedElements = options.usedElements || new Set();

    const identityFilled = fillIdentityParts(data, usedElements);
    if (identityFilled > 0) {
        filledCount += identityFilled;
        results['identityParts'] = `filled ${identityFilled} field(s)`;
    }

    const passwordFilled = fillPasswordParts(data, usedElements);
    if (passwordFilled > 0) {
        filledCount += passwordFilled;
        results['password'] = `filled ${passwordFilled} field(s)`;
    } else if (data.password) {
        results['password'] = 'not found';
    }

    const countryPhoneFilled = fillCountryAndPhoneParts(data, usedElements);
    if (countryPhoneFilled > 0) {
        filledCount += countryPhoneFilled;
        results['countryPhoneParts'] = `filled ${countryPhoneFilled} field(s)`;
    }

    const addressPartsFilled = fillAddressParts(data, usedElements);
    if (addressPartsFilled > 0) {
        filledCount += addressPartsFilled;
        results['addressParts'] = `filled ${addressPartsFilled} field(s)`;
    }

    const birthdayPartsFilled = fillBirthdayParts(data, usedElements);
    if (birthdayPartsFilled > 0) {
        filledCount += birthdayPartsFilled;
        results['birthdayParts'] = `filled ${birthdayPartsFilled} field(s)`;
    }

    const checkboxFilled = fillConsentCheckboxes(usedElements);
    if (checkboxFilled > 0) {
        filledCount += checkboxFilled;
        results['checkboxes'] = `updated ${checkboxFilled} field(s)`;
    }

    for (const [fieldName, value] of Object.entries(data)) {
        if (!value) continue;

        // 这些字段前面已经走专项拆分/匹配逻辑，避免重复覆盖。
        if (SPECIAL_HANDLED_FIELDS.has(fieldName)) {
            continue;
        }

        // 性别字段特殊处理（可能是 radio）
        if (fieldName === 'gender') {
            const element = findField(fieldName) || findFieldByIntent('gender', usedElements);
            if (element) {
                if (element.tagName.toLowerCase() === 'select') {
                    if (fillGenderSelect(element, value)) {
                        filledCount++;
                        usedElements.add(element);
                        results[fieldName] = 'filled (select)';
                    }
                } else if (String(element.type || '').toLowerCase() === 'radio') {
                    if (fillGenderRadio(value)) {
                        filledCount++;
                        usedElements.add(element);
                        results[fieldName] = 'filled (radio)';
                    }
                } else {
                    simulateInput(element, value);
                    usedElements.add(element);
                    filledCount++;
                    results[fieldName] = 'filled';
                }
            } else {
                // 尝试 radio 按钮
                if (fillGenderRadio(value) || fillRadio('gender', value) || fillRadio('sex', value)) {
                    filledCount++;
                    results[fieldName] = 'filled (radio)';
                } else {
                    results[fieldName] = 'not found';
                }
            }
            continue;
        }

        const element = findField(fieldName);

        if (element && usedElements.has(element)) {
            results[fieldName] = 'already filled';
        } else if (element) {
            if (element.tagName.toLowerCase() === 'select') {
                if (fillSelect(element, value)) {
                    filledCount++;
                    usedElements.add(element);
                    results[fieldName] = 'filled';
                } else {
                    results[fieldName] = 'no matching option';
                }
            } else {
                simulateInput(element, value);
                usedElements.add(element);
                filledCount++;
                results[fieldName] = 'filled';
            }
        } else {
            results[fieldName] = 'not found';
        }
    }

    const validation = buildFillValidation(data);
    const diagnostics = buildFillDiagnostics(data, results, validation, filledCount);
    if (options.log !== false) {
        logFillSummary(filledCount, results, validation, diagnostics);
    }

    if (options.scheduleAddressFallback !== false) {
        scheduleDelayedAddressFallback(data, results, usedElements);
    }

    return { filledCount, results, validation, diagnostics };
}

async function finalizeFillResult(data, result, options = {}) {
    const delays = Array.isArray(options.diagnosticDelays) ? options.diagnosticDelays : POST_FILL_DIAGNOSTIC_DELAYS;
    let finalResult = result;
    let diagnosticPasses = 1;

    for (const waitMs of delays) {
        await delay(Number(waitMs) || 0);
        const validation = buildFillValidation(data);
        const diagnostics = buildFillDiagnostics(data, finalResult.results, validation, finalResult.filledCount);
        diagnosticPasses++;

        finalResult = {
            ...finalResult,
            validation,
            diagnostics
        };

        if (!diagnostics.isClean) break;
    }

    finalResult.diagnosticPasses = diagnosticPasses;
    return finalResult;
}

async function fillFormWithDynamicRetry(data, options = {}) {
    const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : DYNAMIC_FILL_RETRY_DELAYS;
    let result = { filledCount: 0, results: {}, validation: buildFillValidation(data) };
    const aggregate = { filledCount: 0, results: {}, validation: result.validation, diagnostics: buildFillDiagnostics(data, {}, result.validation, 0) };
    let pendingSelectFollowups = 0;
    let passes = 0;
    const usedElements = new Set();

    for (let pass = 0; pass <= retryDelays.length; pass++) {
        passes = pass + 1;
        const beforeSelectState = getSelectStateSignature();
        result = fillForm(data, { log: false, scheduleAddressFallback: false, usedElements });
        mergeFillPassResult(aggregate, result);
        const afterSelectState = getSelectStateSignature();
        const afterFieldSignature = getFillableElementSignature();

        if (beforeSelectState !== afterSelectState) {
            // 国家/州等 select 变化后，很多站点会延迟渲染下一级字段，额外等两轮更稳。
            pendingSelectFollowups = Math.max(pendingSelectFollowups, 2);
        }

        if (pass >= retryDelays.length) break;
        if (pass > 0 && result.validation?.isComplete && pendingSelectFollowups === 0) break;

        await delay(Number(retryDelays[pass]) || 0);
        const nextFieldSignature = getFillableElementSignature();
        const shouldRetry = pass === 0
            || !result.validation?.isComplete
            || nextFieldSignature !== afterFieldSignature
            || pendingSelectFollowups > 0;

        if (pendingSelectFollowups > 0) pendingSelectFollowups--;
        if (!shouldRetry) break;
    }

    aggregate.dynamicPasses = passes;
    aggregate.diagnostics = buildFillDiagnostics(data, aggregate.results, aggregate.validation, aggregate.filledCount);
    const finalAggregate = await finalizeFillResult(data, aggregate, options);
    logFillSummary(finalAggregate.filledCount, finalAggregate.results, finalAggregate.validation, finalAggregate.diagnostics);
    scheduleDelayedAddressFallback(data, finalAggregate.results);
    return finalAggregate;
}

/**
 * 扫描页面表单结构（增强版）
 */
function scanForm() {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
    const formStructure = [];

    inputs.forEach((input, index) => {
        if (!isFillableElement(input)) return;

        // 获取标签文本（增强版）
        const labelInfo = getEnhancedLabel(input);

        // 获取扩展上下文（向上遍历3层）
        const context = getExpandedContext(input);

        // 检测所属分组
        const group = detectFieldGroup(input);

        // 检测相邻字段关系
        const siblingInfo = detectSiblingRelation(input, inputs);

        // 获取 ID 或 Name 作为唯一标识
        const id = input.id || input.name || `field_${index}`;

        formStructure.push({
            id: id,
            type: input.type || input.tagName.toLowerCase(),
            label: labelInfo.text,
            labelSource: labelInfo.source,
            placeholder: input.placeholder || '',
            context: context,
            group: group,
            siblings: siblingInfo,
            name: input.name || '',
            className: input.className || '',
            required: input.required || input.getAttribute('aria-required') === 'true',
            min: input.min || '',
            max: input.max || '',
            maxLength: input.maxLength > 0 ? input.maxLength : '',
            pattern: input.pattern || '',
            autocomplete: input.autocomplete || ''
        });
    });

    // 获取页面语义信息（增强版）
    const pageContext = analyzePageContext();

    return {
        fields: formStructure,
        pageContext: pageContext
    };
}

/**
 * 获取增强的标签信息
 */
function getEnhancedLabel(element) {
    let labelText = '';
    let labelSource = '';

    // 1. 查找 <label for="id">
    const labels = getLabelElementsFor(element);
    if (labels.length > 0) {
        labelText = labels.map(getTextContent).filter(Boolean).join(' ');
        labelSource = 'label-for';
    }

    // 2. 查找父级 <label>
    if (!labelText) {
        const parentLabel = element.closest('label');
        if (parentLabel) {
            labelText = getTextContent(parentLabel);
            labelSource = 'parent-label';
        }
    }

    // 3. aria-label
    if (!labelText) {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            labelText = ariaLabel;
            labelSource = 'aria-label';
        }
    }

    // 4. aria-labelledby
    if (!labelText) {
        const labelledBy = element.getAttribute('aria-labelledby');
        const labelledText = getTextByElementIds(labelledBy);
        if (labelledText) {
            labelText = labelledText;
            labelSource = 'aria-labelledby';
        }
    }

    // 5. aria-describedby (作为补充上下文)
    if (!labelText) {
        const describedBy = element.getAttribute('aria-describedby');
        const describedText = getTextByElementIds(describedBy);
        if (describedText) {
            labelText = describedText;
            labelSource = 'aria-describedby';
        }
    }

    // 6. title 属性
    if (!labelText) {
        const title = element.getAttribute('title');
        if (title) {
            labelText = title;
            labelSource = 'title';
        }
    }

    // 7. placeholder
    if (!labelText) {
        const placeholder = element.getAttribute('placeholder');
        if (placeholder) {
            labelText = placeholder;
            labelSource = 'placeholder';
        }
    }

    // 8. 前置兄弟元素（表格布局常见）
    if (!labelText) {
        let previous = element.previousElementSibling;
        let attempts = 0;
        while (previous && attempts < 3) {
            if (['LABEL', 'SPAN', 'TD', 'TH', 'DIV', 'P'].includes(previous.tagName)) {
                const text = getTextContent(previous);
                if (text && text.length < 100) {
                    labelText = text;
                    labelSource = 'sibling-element';
                    break;
                }
            }
            previous = previous.previousElementSibling;
            attempts++;
        }
    }

    // 9. 父级元素中的文本节点（去除子元素文本后）
    if (!labelText) {
        const parent = element.parentElement;
        if (parent) {
            const cloned = parent.cloneNode(true);
            // 移除 input 元素
            cloned.querySelectorAll('input, select, textarea, button').forEach(el => el.remove());
            const text = getTextContent(cloned);
            if (text && text.length < 200) {
                labelText = text;
                labelSource = 'parent-text';
            }
        }
    }

    return {
        text: labelText.replace(/\s+/g, ' ').substring(0, 200),
        source: labelSource
    };
}

/**
 * 获取扩展上下文（向上遍历多层）
 */
function getExpandedContext(element) {
    const contextParts = [];
    let current = element.parentElement;
    let depth = 0;
    const maxDepth = 4;

    while (current && depth < maxDepth) {
        // 检查是否有有意义的语义信息
        const tagName = current.tagName.toLowerCase();

        // 跳过无意义的容器
        if (['body', 'html', 'main', 'article', 'section'].includes(tagName)) {
            break;
        }

        // 检查类名和 ID 中的语义
        const semantic = extractSemanticFromElement(current);
        if (semantic) {
            contextParts.push(semantic);
        }

        // 检查 heading 元素
        const heading = current.querySelector('h1, h2, h3, h4, h5, h6, legend');
        if (heading && !contextParts.includes(heading.innerText.trim())) {
            const headingText = heading.innerText.trim();
            if (headingText.length < 100) {
                contextParts.push(`[section: ${headingText}]`);
            }
        }

        current = current.parentElement;
        depth++;
    }

    return contextParts.join(' | ').substring(0, 300);
}

/**
 * 从元素中提取语义信息（class, id, data-* 属性）
 */
function extractSemanticFromElement(element) {
    const hints = [];

    // 检查 class
    const className = element.className;
    if (className && typeof className === 'string') {
        // 常见语义关键词
        const semanticKeywords = ['personal', 'contact', 'address', 'payment', 'billing', 'shipping',
            'account', 'profile', 'login', 'register', 'signup', 'form', 'info', 'details',
            '个人', '联系', '地址', '支付', '账户', '注册', '登录'];

        for (const keyword of semanticKeywords) {
            if (className.toLowerCase().includes(keyword)) {
                hints.push(`class:${keyword}`);
            }
        }
    }

    // 检查 data-* 属性
    for (const attr of element.attributes) {
        if (attr.name.startsWith('data-') && attr.value) {
            const value = attr.value.toLowerCase();
            if (value.length < 50 && !/^\d+$/.test(value)) {
                hints.push(`${attr.name}:${value}`);
            }
        }
    }

    return hints.length > 0 ? hints.join(', ') : '';
}

/**
 * 检测字段所属分组
 */
function detectFieldGroup(element) {
    // 1. 检查 fieldset
    const fieldset = element.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) {
            return legend.innerText.trim();
        }
    }

    // 2. 检查带有标题的父容器
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 5) {
        // 检查是否有分组标题
        const heading = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
        if (heading) {
            return heading.innerText.trim();
        }

        // 检查常见分组类名
        const className = (current.className || '').toLowerCase();
        if (className.includes('group') || className.includes('section') || className.includes('block') || className.includes('panel')) {
            // 尝试从第一个标题或 label 获取分组名
            const firstHeading = current.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
            if (firstHeading) {
                return firstHeading.innerText.trim();
            }
        }

        current = current.parentElement;
        depth++;
    }

    return '';
}

/**
 * 检测相邻字段关系
 */
function detectSiblingRelation(element, allInputs) {
    const info = {
        prevField: null,
        nextField: null,
        sameNamePrefix: []
    };

    const currentIndex = allInputs.indexOf(element);

    // 前一个字段
    if (currentIndex > 0) {
        const prev = allInputs[currentIndex - 1];
        if (prev.name || prev.id) {
            info.prevField = prev.name || prev.id;
        }
    }

    // 后一个字段
    if (currentIndex < allInputs.length - 1) {
        const next = allInputs[currentIndex + 1];
        if (next.name || next.id) {
            info.nextField = next.name || next.id;
        }
    }

    // 相同 name 前缀的字段（如 address_1, address_2）
    const currentName = element.name || '';
    if (currentName) {
        const prefix = currentName.replace(/[\[\]_-]?\d+[\[\]_-]?$/, '').replace(/[\[\]_-]$/, '');
        if (prefix && prefix !== currentName) {
            allInputs.forEach(input => {
                if (input !== element && input.name && input.name.startsWith(prefix)) {
                    info.sameNamePrefix.push(input.name);
                }
            });
        }
    }

    return info;
}

/**
 * 分析页面上下文（增强版）
 */
function analyzePageContext() {
    const pageTitle = document.title;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    const url = window.location.href;
    const language = document.documentElement.lang || navigator.language || 'en';

    // 检测页面类型
    const pageType = detectPageType(url, pageTitle, metaDesc);

    // 获取表单 action
    const forms = document.querySelectorAll('form');
    const formActions = [];
    forms.forEach(form => {
        if (form.action) {
            formActions.push(form.action);
        }
    });

    // 获取页面主标题
    const h1 = document.querySelector('h1');
    const mainHeading = h1 ? h1.innerText.trim() : '';

    // 检测是否有 CAPTCHA
    const hasCaptcha = !!(
        document.querySelector('[class*="captcha"]') ||
        document.querySelector('[id*="captcha"]') ||
        document.querySelector('[class*="recaptcha"]') ||
        document.querySelector('iframe[src*="recaptcha"]')
    );

    // 检测提交按钮文本
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    const submitText = submitBtn ? (submitBtn.innerText || submitBtn.value || '').trim() : '';

    return {
        title: pageTitle,
        description: metaDesc,
        url: url,
        language: language,
        pageType: pageType,
        mainHeading: mainHeading,
        formActions: formActions,
        hasCaptcha: hasCaptcha,
        submitButtonText: submitText
    };
}

/**
 * 检测页面类型
 */
function detectPageType(url, title, description) {
    const combined = `${url} ${title} ${description}`.toLowerCase();

    // 按优先级检测
    const patterns = [
        { type: 'login', keywords: ['login', 'signin', 'sign in', 'log in', '登录', 'ログイン', '로그인'] },
        { type: 'register', keywords: ['register', 'signup', 'sign up', 'create account', '注册', '新規登録', '会員登録', '가입'] },
        { type: 'checkout', keywords: ['checkout', 'payment', 'order', 'cart', '结账', '支付', '购物车', '決済', 'お支払い'] },
        { type: 'contact', keywords: ['contact', 'inquiry', 'message', '联系', '留言', 'お問い合わせ', '問い合わせ'] },
        { type: 'survey', keywords: ['survey', 'questionnaire', 'feedback', '问卷', '调查', 'アンケート'] },
        { type: 'profile', keywords: ['profile', 'account', 'settings', 'edit', '个人资料', '账户', 'プロフィール', '設定'] },
        { type: 'application', keywords: ['apply', 'application', 'job', 'career', '申请', '应聘', '応募', '申込'] },
        { type: 'subscription', keywords: ['subscribe', 'newsletter', 'mailing', '订阅', '购读'] }
    ];

    for (const { type, keywords } of patterns) {
        for (const keyword of keywords) {
            if (combined.includes(keyword)) {
                return type;
            }
        }
    }

    return 'unknown';
}

/**
 * 智能填写表单 (AI)
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
    return Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'))
        .filter(isFillableElement);
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

    return result;
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        fillFormWithDynamicRetry(request.data)
            .then(sendResponse)
            .catch((error) => {
                console.warn('[GeoFill] Dynamic fill failed:', error);
                sendResponse({
                    filledCount: 0,
                    results: { error: error?.message || 'fill_failed' },
                    validation: {
                        isComplete: false,
                        missingRequiredFields: [],
                        unfilledRequestedFields: []
                    },
                    diagnostics: {
                        isClean: false,
                        summary: {
                            filledCount: 0,
                            missingRequiredCount: 0,
                            unfilledRequestedCount: 0,
                            pageErrorCount: 0,
                            fieldIssueCount: 1
                        },
                        fieldIssues: [{
                            kind: 'runtime_error',
                            field: '',
                            reason: error?.message || 'fill_failed'
                        }],
                        pageErrors: []
                    }
                });
            });
    } else if (request.action === 'scanForm') {
        const result = scanForm();
        sendResponse(result);
    } else if (request.action === 'fillFormSmart') {
        fillFormSmart(request.data)
            .then(sendResponse)
            .catch((error) => {
                console.warn('[GeoFill] Smart fill failed:', error);
                sendResponse({
                    filledCount: 0,
                    results: { error: error?.message || 'smart_fill_failed' },
                    validation: {
                        isComplete: false,
                        missingRequiredFields: [],
                        unfilledRequestedFields: []
                    },
                    diagnostics: {
                        isClean: false,
                        summary: {
                            filledCount: 0,
                            missingRequiredCount: 0,
                            unfilledRequestedCount: 0,
                            pageErrorCount: 0,
                            fieldIssueCount: 1
                        },
                        fieldIssues: [{
                            kind: 'runtime_error',
                            field: '',
                            reason: error?.message || 'smart_fill_failed'
                        }],
                        pageErrors: []
                    }
                });
            });
    }
    return true;
});

// 标记 content script 已加载
console.log('[GeoFill] Content script loaded (Enhanced)');
