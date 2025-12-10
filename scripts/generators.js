/**
 * 信息生成器 - 根据IP地理位置生成随机注册信息
 */

// 各国常见名字库
const NAME_DATABASE = {
  // 英语国家
  en: {
    firstNames: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
      'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn'],
    lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris']
  },
  // 中文名（拼音）
  zh: {
    firstNames: ['Wei', 'Fang', 'Lei', 'Yang', 'Jing', 'Ming', 'Hua', 'Xin', 'Jun', 'Yan',
      'Lin', 'Chen', 'Hao', 'Tao', 'Peng', 'Yun', 'Feng', 'Qiang', 'Bo', 'Kai'],
    lastNames: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
      'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'He', 'Lin', 'Luo', 'Gao']
  },
  // 日语名
  ja: {
    firstNames: ['Yuki', 'Haruto', 'Sota', 'Yuto', 'Riku', 'Sakura', 'Hina', 'Yui', 'Mio', 'Aoi',
      'Ren', 'Takumi', 'Kaito', 'Hinata', 'Yuna', 'Akari', 'Mei', 'Rin', 'Koharu', 'Sora'],
    lastNames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
      'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki']
  },
  // 韩语名
  ko: {
    firstNames: ['Minho', 'Jinho', 'Junho', 'Seungmin', 'Jaemin', 'Yuna', 'Jiyeon', 'Soojin', 'Minjung', 'Hana',
      'Jihoon', 'Dongwoo', 'Sunwoo', 'Yoojin', 'Minji', 'Soyeon', 'Daeun', 'Yerin', 'Chaewon', 'Jiwon'],
    lastNames: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
      'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Yoo', 'Hong']
  },
  // 德语名
  de: {
    firstNames: ['Maximilian', 'Alexander', 'Paul', 'Leon', 'Lukas', 'Emma', 'Mia', 'Hannah', 'Sofia', 'Anna',
      'Felix', 'Jonas', 'Tim', 'David', 'Finn', 'Lena', 'Laura', 'Marie', 'Lea', 'Julia'],
    lastNames: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
      'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Hofmann']
  },
  // 法语名
  fr: {
    firstNames: ['Jean', 'Pierre', 'Michel', 'André', 'Philippe', 'Marie', 'Jeanne', 'Françoise', 'Monique', 'Catherine',
      'Lucas', 'Hugo', 'Louis', 'Gabriel', 'Emma', 'Léa', 'Chloé', 'Manon', 'Camille', 'Jade'],
    lastNames: ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
      'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard']
  },
  // 俄语名
  ru: {
    firstNames: ['Alexander', 'Dmitri', 'Maxim', 'Artem', 'Ivan', 'Anastasia', 'Maria', 'Daria', 'Anna', 'Sophia',
      'Mikhail', 'Nikita', 'Andrei', 'Sergei', 'Alexei', 'Ekaterina', 'Olga', 'Natalia', 'Elena', 'Irina'],
    lastNames: ['Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Vasiliev', 'Petrov', 'Sokolov', 'Mikhailov', 'Novikov', 'Fedorov',
      'Morozov', 'Volkov', 'Alexeev', 'Lebedev', 'Semenov', 'Egorov', 'Pavlov', 'Kozlov', 'Stepanov', 'Nikolaev']
  },
  // 西班牙语名
  es: {
    firstNames: ['Antonio', 'José', 'Manuel', 'Francisco', 'David', 'María', 'Carmen', 'Ana', 'Isabel', 'Laura',
      'Pablo', 'Daniel', 'Alejandro', 'Carlos', 'Javier', 'Lucia', 'Marta', 'Paula', 'Sara', 'Elena'],
    lastNames: ['García', 'Fernandez', 'Gonzalez', 'Rodriguez', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Martin',
      'Jimenez', 'Ruiz', 'Hernandez', 'Diaz', 'Moreno', 'Alvarez', 'Muñoz', 'Romero', 'Alonso', 'Gutierrez']
  }
};

// 国家到语言映射
const COUNTRY_LANG_MAP = {
  'United States': 'en', 'United Kingdom': 'en', 'Canada': 'en', 'Australia': 'en', 'New Zealand': 'en',
  'China': 'zh', 'Taiwan': 'zh', 'Hong Kong': 'zh', 'Singapore': 'zh',
  'Japan': 'ja',
  'South Korea': 'ko', 'Korea': 'ko',
  'Germany': 'de', 'Austria': 'de', 'Switzerland': 'de',
  'France': 'fr', 'Belgium': 'fr',
  'Russia': 'ru',
  'Spain': 'es', 'Mexico': 'es', 'Argentina': 'es', 'Colombia': 'es', 'Peru': 'es', 'Chile': 'es'
};

// 国家电话区号
const COUNTRY_PHONE_CODES = {
  'United States': '+1', 'United Kingdom': '+44', 'Canada': '+1', 'Australia': '+61',
  'China': '+86', 'Taiwan': '+886', 'Hong Kong': '+852', 'Japan': '+81',
  'South Korea': '+82', 'Germany': '+49', 'France': '+33', 'Russia': '+7',
  'Spain': '+34', 'Mexico': '+52', 'Brazil': '+55', 'India': '+91',
  'Italy': '+39', 'Netherlands': '+31', 'Singapore': '+65'
};

// 常见邮箱域名（分类）
const EMAIL_DOMAINS = {
  // 通用邮箱
  common: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'live.com', 'msn.com', 'aol.com'],
  // 安全/隐私邮箱
  secure: ['protonmail.com', 'tutanota.com', 'mailfence.com', 'zoho.com', 'fastmail.com'],
  // 临时/一次性邮箱
  temp: ['guerrillamail.com', 'tempmail.com', '10minutemail.com', 'mailinator.com'],
  // 地区性邮箱
  regional: ['qq.com', '163.com', 'sina.com', 'yandex.com', 'mail.ru', 'gmx.com', 'web.de']
};

// 自定义邮箱后缀（用户可设置）
let customEmailDomain = null;

// 国家名称别名映射（用于匹配 IP API 返回的不同格式）
const COUNTRY_ALIASES = {
  'US': 'United States',
  'USA': 'United States',
  'America': 'United States',
  'UK': 'United Kingdom',
  'Britain': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'England': 'United Kingdom',
  '中国': 'China',
  '日本': 'Japan',
  '韩国': 'South Korea',
  'Republic of Korea': 'South Korea',
  '台湾': 'Taiwan',
  '香港': 'Hong Kong',
  '新加坡': 'Singapore',
  '德国': 'Germany',
  '法国': 'France',
  '俄罗斯': 'Russia',
  'Russian Federation': 'Russia',
  '西班牙': 'Spain',
  '意大利': 'Italy',
  '巴西': 'Brazil',
  '印度': 'India',
  '墨西哥': 'Mexico',
  '加拿大': 'Canada',
  '澳大利亚': 'Australia',
  '荷兰': 'Netherlands',
  'Holland': 'Netherlands'
};

// 街道名称
const STREET_NAMES = ['Main St', 'Oak Ave', 'Park Rd', 'Cedar Ln', 'Maple Dr', 'Pine St', 'Elm Ave', 'Washington Blvd',
  'Lake View Dr', 'Sunset Blvd', 'River Rd', 'Forest Ave', 'Hill St', 'Valley Rd', 'Spring Ln'];

// 各国主要城市
const COUNTRY_CITIES = {
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'],
  'United Kingdom': ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Sheffield', 'Edinburgh', 'Bristol', 'Leicester'],
  'Canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Wollongong', 'Hobart'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Palmerston North', 'Napier', 'Nelson', 'Rotorua'],
  'China': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xian', 'Nanjing', 'Chongqing'],
  'Taiwan': ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan', 'Hsinchu', 'Keelung', 'Taoyuan', 'Changhua', 'Pingtung', 'Yilan'],
  'Hong Kong': ['Central', 'Kowloon', 'Tsim Sha Tsui', 'Mong Kok', 'Causeway Bay', 'Wan Chai', 'Sha Tin', 'Tuen Mun', 'Yuen Long', 'Tai Po'],
  'Singapore': ['Singapore', 'Jurong East', 'Tampines', 'Woodlands', 'Bedok', 'Ang Mo Kio', 'Clementi', 'Bishan', 'Toa Payoh', 'Serangoon'],
  'Japan': ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto', 'Kawasaki', 'Sendai'],
  'South Korea': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Suwon', 'Ulsan', 'Changwon', 'Seongnam'],
  'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen'],
  'Austria': ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'St. Pölten', 'Dornbirn'],
  'Switzerland': ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Lucerne', 'St. Gallen', 'Lugano', 'Biel'],
  'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'],
  'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Mechelen'],
  'Russia': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Omsk', 'Rostov-on-Don'],
  'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao'],
  'Mexico': ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida', 'Cancún'],
  'Argentina': ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucumán', 'Mar del Plata', 'Salta', 'Santa Fe', 'Neuquén'],
  'Colombia': ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué'],
  'Peru': ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Iquitos', 'Cusco', 'Huancayo', 'Tacna', 'Pucallpa'],
  'Chile': ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Rancagua', 'Talca', 'Arica', 'Iquique'],
  'Brazil': ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre'],
  'India': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Pune', 'Jaipur', 'Surat'],
  'Italy': ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Venice', 'Verona'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen']
};

/**
 * 获取指定国家对应的语言
 */
function getLanguageForCountry(country) {
  return COUNTRY_LANG_MAP[country] || 'en';
}

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成随机数字字符串
 */
function randomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

/**
 * 生成随机名字
 */
function generateFirstName(country) {
  const lang = getLanguageForCountry(country);
  const names = NAME_DATABASE[lang] || NAME_DATABASE.en;
  return randomChoice(names.firstNames);
}

/**
 * 生成随机姓氏
 */
function generateLastName(country) {
  const lang = getLanguageForCountry(country);
  const names = NAME_DATABASE[lang] || NAME_DATABASE.en;
  return randomChoice(names.lastNames);
}

/**
 * 生成用户名
 */
function generateUsername(firstName, lastName) {
  const styles = [
    () => `${firstName.toLowerCase()}${lastName.toLowerCase()}${randomDigits(2)}`,
    () => `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    () => `${firstName.toLowerCase()}${randomDigits(4)}`,
    () => `${lastName.toLowerCase()}.${firstName.toLowerCase()}`,
    () => `${firstName.toLowerCase()[0]}${lastName.toLowerCase()}${randomDigits(3)}`
  ];
  return randomChoice(styles)();
}

/**
 * 标准化国家名称
 */
function normalizeCountry(country) {
  if (!country) return 'United States';
  // 检查是否有别名
  if (COUNTRY_ALIASES[country]) {
    return COUNTRY_ALIASES[country];
  }
  // 检查是否直接匹配
  if (COUNTRY_LANG_MAP[country]) {
    return country;
  }
  // 尝试模糊匹配
  const lowerCountry = country.toLowerCase();
  for (const [alias, normalized] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.toLowerCase() === lowerCountry) {
      return normalized;
    }
  }
  for (const countryName of Object.keys(COUNTRY_LANG_MAP)) {
    if (countryName.toLowerCase() === lowerCountry) {
      return countryName;
    }
  }
  return 'United States'; // 默认
}

/**
 * 设置自定义邮箱后缀
 */
function setCustomEmailDomain(domain) {
  customEmailDomain = domain && domain.trim() ? domain.trim() : null;
}

/**
 * 获取当前自定义邮箱后缀
 */
function getCustomEmailDomain() {
  return customEmailDomain;
}

/**
 * 获取所有邮箱域名（扁平化）
 */
function getAllEmailDomains() {
  return [
    ...EMAIL_DOMAINS.common,
    ...EMAIL_DOMAINS.secure,
    ...EMAIL_DOMAINS.temp,
    ...EMAIL_DOMAINS.regional
  ];
}

/**
 * 生成邮箱
 */
function generateEmail(username, category = null) {
  // 如果设置了自定义后缀，优先使用
  if (customEmailDomain) {
    return `${username}@${customEmailDomain}`;
  }
  // 如果指定了类别
  if (category && EMAIL_DOMAINS[category]) {
    return `${username}@${randomChoice(EMAIL_DOMAINS[category])}`;
  }
  // 默认从通用邮箱中选择
  return `${username}@${randomChoice(EMAIL_DOMAINS.common)}`;
}

/**
 * 生成密码
 */
function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  // 确保包含大小写和数字
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%'[Math.floor(Math.random() * 5)];
  // 填充到 12 位
  for (let i = password.length; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 生成电话号码
 */
function generatePhone(country) {
  const code = COUNTRY_PHONE_CODES[country] || '+1';
  const number = randomDigits(10);
  return `${code} ${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`;
}

/**
 * 生成地址
 */
function generateAddress() {
  const streetNum = Math.floor(Math.random() * 9999) + 1;
  const street = randomChoice(STREET_NAMES);
  const aptNum = Math.random() > 0.5 ? `, Apt ${Math.floor(Math.random() * 999) + 1}` : '';
  return `${streetNum} ${street}${aptNum}`;
}

/**
 * 生成邮编
 */
function generateZipCode(country) {
  if (country === 'United States' || country === 'Canada') {
    return randomDigits(5);
  } else if (country === 'United Kingdom') {
    return `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${randomDigits(1)} ${randomDigits(1)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  } else if (country === 'Germany') {
    return randomDigits(5);
  } else if (country === 'China') {
    return randomDigits(6);
  } else if (country === 'Japan') {
    return `${randomDigits(3)}-${randomDigits(4)}`;
  }
  return randomDigits(5);
}

/**
 * 生成城市
 */
function generateCity(country) {
  const cities = COUNTRY_CITIES[country] || COUNTRY_CITIES['United States'];
  return randomChoice(cities);
}

/**
 * 生成完整的用户信息
 */
function generateAllInfo(ipData) {
  const country = ipData.country || 'United States';

  const firstName = generateFirstName(country);
  const lastName = generateLastName(country);
  const username = generateUsername(firstName, lastName);

  return {
    firstName,
    lastName,
    username,
    email: generateEmail(username),
    password: generatePassword(),
    phone: generatePhone(country),
    address: generateAddress(),
    city: generateCity(country),
    zipCode: generateZipCode(country),
    country
  };
}

/**
 * 重新生成单个字段
 */
function regenerateField(fieldName, currentData, ipData) {
  const country = ipData.country || 'United States';

  switch (fieldName) {
    case 'firstName':
      return generateFirstName(country);
    case 'lastName':
      return generateLastName(country);
    case 'username':
      return generateUsername(currentData.firstName, currentData.lastName);
    case 'email':
      return generateEmail(currentData.username);
    case 'password':
      return generatePassword();
    case 'phone':
      return generatePhone(country);
    case 'address':
      return generateAddress();
    case 'city':
      return generateCity(country);
    case 'zipCode':
      return generateZipCode(country);
    case 'country':
      return country;
    default:
      return '';
  }
}

// 导出函数供 popup.js 使用
if (typeof window !== 'undefined') {
  window.generators = {
    generateAllInfo,
    regenerateField,
    generateFirstName,
    generateLastName,
    generateUsername,
    generateEmail,
    generatePassword,
    generatePhone,
    generateAddress,
    generateZipCode,
    generateCity,
    normalizeCountry,
    setCustomEmailDomain,
    getCustomEmailDomain,
    getAllEmailDomains
  };
}
