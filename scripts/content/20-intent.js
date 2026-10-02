/**
 * GeoFill content script - 20-intent.js
 * 意图分类：国家/地区/城市别名、字段意图识别与查找
 *
 * 按文件名顺序注入（10 → 90），共享同一全局作用域；
 * 90-main.js 必须是最后注入的文件（设置就绪标记）。
 */
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
    // 穿透 open shadow root，覆盖 Web Components 内的字段
    return querySelectorAllDeep(FILLABLE_ELEMENTS_SELECTOR).filter(isFillableElement);
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
