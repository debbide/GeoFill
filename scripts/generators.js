/**
 * 信息生成器 - 根据IP地理位置生成随机注册信息
 */

// Geoapify API Key（由用户在设置中配置）
let geoapifyApiKey = null;

/**
 * 设置 Geoapify API Key
 */
function setGeoapifyApiKey(key) {
  geoapifyApiKey = key && key.trim() ? key.trim() : null;
  console.log('[GeoFill] Geoapify API Key 已' + (geoapifyApiKey ? '设置' : '清除'));
}

/**
 * 城市坐标数据（用于 Geoapify API 调用）
 */
const CITY_COORDINATES = {
  // 美国
  'New York': { lat: 40.7128, lon: -74.0060 },
  'Los Angeles': { lat: 34.0522, lon: -118.2437 },
  'Chicago': { lat: 41.8781, lon: -87.6298 },
  'Houston': { lat: 29.7604, lon: -95.3698 },
  'Phoenix': { lat: 33.4484, lon: -112.0740 },
  'San Francisco': { lat: 37.7749, lon: -122.4194 },
  'Seattle': { lat: 47.6062, lon: -122.3321 },
  'Miami': { lat: 25.7617, lon: -80.1918 },
  'Boston': { lat: 42.3601, lon: -71.0589 },
  'Denver': { lat: 39.7392, lon: -104.9903 },
  // 英国
  'London': { lat: 51.5074, lon: -0.1278 },
  'Manchester': { lat: 53.4808, lon: -2.2426 },
  'Birmingham': { lat: 52.4862, lon: -1.8904 },
  // 加拿大
  'Toronto': { lat: 43.6532, lon: -79.3832 },
  'Vancouver': { lat: 49.2827, lon: -123.1207 },
  'Montreal': { lat: 45.5017, lon: -73.5673 },
  // 澳大利亚
  'Sydney': { lat: -33.8688, lon: 151.2093 },
  'Melbourne': { lat: -37.8136, lon: 144.9631 },
  'Brisbane': { lat: -27.4698, lon: 153.0251 },
  // 中国
  'Beijing': { lat: 39.9042, lon: 116.4074 },
  'Shanghai': { lat: 31.2304, lon: 121.4737 },
  'Guangzhou': { lat: 23.1291, lon: 113.2644 },
  'Shenzhen': { lat: 22.5431, lon: 114.0579 },
  'Hangzhou': { lat: 30.2741, lon: 120.1551 },
  // 日本
  'Tokyo': { lat: 35.6762, lon: 139.6503 },
  'Osaka': { lat: 34.6937, lon: 135.5023 },
  'Yokohama': { lat: 35.4437, lon: 139.6380 },
  'Kyoto': { lat: 35.0116, lon: 135.7681 },
  // 韩国
  'Seoul': { lat: 37.5665, lon: 126.9780 },
  'Busan': { lat: 35.1796, lon: 129.0756 },
  'Incheon': { lat: 37.4563, lon: 126.7052 },
  // 德国
  'Berlin': { lat: 52.5200, lon: 13.4050 },
  'Munich': { lat: 48.1351, lon: 11.5820 },
  'Frankfurt': { lat: 50.1109, lon: 8.6821 },
  // 法国
  'Paris': { lat: 48.8566, lon: 2.3522 },
  'Lyon': { lat: 45.7640, lon: 4.8357 },
  'Marseille': { lat: 43.2965, lon: 5.3698 },
  // 新加坡
  'Singapore': { lat: 1.3521, lon: 103.8198 },
  'Jurong East': { lat: 1.3329, lon: 103.7436 },
  'Tampines': { lat: 1.3496, lon: 103.9568 },
  // 香港
  'Central': { lat: 22.2819, lon: 114.1577 },
  'Kowloon': { lat: 22.3193, lon: 114.1694 },
  'Tsim Sha Tsui': { lat: 22.2988, lon: 114.1722 },
  // 台湾
  'Taipei': { lat: 25.0330, lon: 121.5654 },
  'Kaohsiung': { lat: 22.6273, lon: 120.3014 },
  'Taichung': { lat: 24.1477, lon: 120.6736 },
  // 俄罗斯
  'Moscow': { lat: 55.7558, lon: 37.6173 },
  'Saint Petersburg': { lat: 59.9343, lon: 30.3351 },
  // 西班牙
  'Madrid': { lat: 40.4168, lon: -3.7038 },
  'Barcelona': { lat: 41.3851, lon: 2.1734 },
  // 意大利
  'Rome': { lat: 41.9028, lon: 12.4964 },
  'Milan': { lat: 45.4642, lon: 9.1900 },
  // 巴西
  'São Paulo': { lat: -23.5505, lon: -46.6333 },
  'Rio de Janeiro': { lat: -22.9068, lon: -43.1729 },
  // 印度
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Delhi': { lat: 28.7041, lon: 77.1025 },
  'Bangalore': { lat: 12.9716, lon: 77.5946 },
  // 墨西哥
  'Mexico City': { lat: 19.4326, lon: -99.1332 },
  'Guadalajara': { lat: 20.6597, lon: -103.3496 },
  // 荷兰
  'Amsterdam': { lat: 52.3676, lon: 4.9041 },
  'Rotterdam': { lat: 51.9244, lon: 4.4777 }
};

/**
 * 调用 Geoapify Reverse Geocoding API 获取真实地址
 */
async function fetchRealAddressFromApi(lat, lon) {
  if (!geoapifyApiKey) return null;

  // 在城市中心附近小范围偏移 (约 300-500m)，避免落到其他城市
  const offsetLat = lat + (Math.random() - 0.5) * 0.005;
  const offsetLon = lon + (Math.random() - 0.5) * 0.005;

  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${offsetLat}&lon=${offsetLon}&apiKey=${geoapifyApiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log('[GeoFill] Geoapify API 请求失败:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      return {
        address: props.address_line1 || props.street || props.name,
        city: props.city || props.town || props.municipality,
        state: props.state || props.county,
        zipCode: props.postcode,
        country: props.country,
        source: 'geoapify'
      };
    }
  } catch (e) {
    console.log('[GeoFill] Geoapify API 调用失败:', e);
  }

  return null;
}

/**
 * 调用 OpenStreetMap Nominatim API 获取真实地址（免费，无需 Key）
 */
async function fetchAddressFromOSM(lat, lon) {
  // 在城市中心附近小范围偏移 (约 300-500m)
  const offsetLat = lat + (Math.random() - 0.5) * 0.005;
  const offsetLon = lon + (Math.random() - 0.5) * 0.005;

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${offsetLat}&lon=${offsetLon}&addressdetails=1&accept-language=en`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GeoFill-Extension/1.7.1'
      }
    });

    if (!response.ok) {
      console.log('[GeoFill] OSM Nominatim API 请求失败:', response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;
      // 构建街道地址
      let streetAddress = '';
      if (addr.house_number && addr.road) {
        streetAddress = `${addr.house_number} ${addr.road}`;
      } else if (addr.road) {
        streetAddress = `${Math.floor(Math.random() * 999) + 1} ${addr.road}`;
      } else if (addr.neighbourhood) {
        streetAddress = addr.neighbourhood;
      } else if (addr.suburb) {
        streetAddress = addr.suburb;
      }

      // 对于城市国家（新加坡、香港等），state 可能为空，使用 suburb 等代替
      const stateValue = addr.state || addr.province || addr.region ||
        addr.suburb || addr.neighbourhood || addr.county || '';

      return {
        address: streetAddress || data.display_name?.split(',')[0] || '',
        city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
        state: stateValue,
        zipCode: addr.postcode || '',
        country: addr.country || '',
        source: 'openstreetmap'
      };
    }
  } catch (e) {
    console.log('[GeoFill] OSM Nominatim API 调用失败:', e);
  }

  return null;
}

/**
 * 智能获取真实地址：优先 Geoapify，备用 OSM
 */
async function fetchRealAddressSmart(lat, lon) {
  // 优先使用 Geoapify（如果有 API Key）
  if (geoapifyApiKey) {
    const result = await fetchRealAddressFromApi(lat, lon);
    if (result) {
      console.log('[GeoFill] 使用 Geoapify 地址');
      return result;
    }
  }

  // 降级到 OpenStreetMap
  const osmResult = await fetchAddressFromOSM(lat, lon);
  if (osmResult) {
    console.log('[GeoFill] 使用 OpenStreetMap 地址');
    return osmResult;
  }

  return null;
}

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

// 各国电话号码格式配置
const PHONE_FORMATS = {
  'United States': {
    code: '+1',
    length: 10,
    // 美国区号第一位是2-9，第二位0-8，手机号格式: (xxx) xxx-xxxx
    areaCodePrefixes: ['201', '202', '212', '213', '214', '215', '216', '217', '234', '248', '253', '267', '281', '301', '302', '303', '305', '310', '312', '313', '314', '315', '323', '347', '352', '386', '404', '407', '408', '410', '412', '415', '424', '425', '469', '470', '480', '484', '503', '504', '505', '508', '509', '510', '512', '513', '516', '518', '520', '530', '540', '551', '559', '562', '571', '573', '585', '602', '603', '609', '610', '612', '614', '615', '616', '617', '619', '626', '630', '631', '646', '650', '657', '661', '678', '702', '703', '704', '708', '713', '714', '716', '718', '720', '724', '727', '732', '734', '737', '747', '754', '757', '760', '762', '770', '773', '774', '781', '786', '801', '802', '804', '805', '810', '813', '814', '816', '817', '818', '828', '831', '832', '845', '847', '848', '856', '857', '858', '859', '860', '862', '863', '864', '865', '909', '910', '916', '917', '918', '919', '920', '925', '929', '936', '937', '940', '941', '949', '951', '952', '954', '956', '970', '971', '972', '973', '978', '979', '980'],
    format: (num) => `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`
  },
  'Canada': {
    code: '+1',
    length: 10,
    areaCodePrefixes: ['204', '226', '236', '249', '250', '289', '306', '343', '365', '403', '416', '418', '431', '437', '438', '450', '506', '514', '519', '548', '579', '581', '587', '604', '613', '639', '647', '705', '709', '778', '780', '782', '807', '819', '825', '867', '873', '902', '905'],
    format: (num) => `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`
  },
  'United Kingdom': {
    code: '+44',
    length: 10,
    // 英国手机号以7开头，格式: 7xxx xxx xxx
    mobilePrefixes: ['71', '72', '73', '74', '75', '76', '77', '78', '79'],
    format: (num) => `${num.slice(0, 4)} ${num.slice(4, 7)} ${num.slice(7)}`
  },
  'China': {
    code: '+86',
    length: 11,
    // 中国手机号以1开头，第二位3-9，格式: 1xx xxxx xxxx
    mobilePrefixes: ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '150', '151', '152', '153', '155', '156', '157', '158', '159', '166', '170', '171', '172', '173', '175', '176', '177', '178', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189', '191', '198', '199'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 7)} ${num.slice(7)}`
  },
  'Japan': {
    code: '', // 使用国内格式，不带 +81
    length: 11,
    // 日本手机号以070/080/090开头，格式: 0xx-xxxx-xxxx
    mobilePrefixes: ['070', '080', '090'],
    format: (num) => `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7)}`
  },
  'South Korea': {
    code: '+82',
    length: 10,
    // 韩国手机号以010开头（去掉区号后变成10），格式: 10-xxxx-xxxx
    mobilePrefixes: ['10'],
    format: (num) => `${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6)}`
  },
  'Germany': {
    code: '+49',
    length: 11,
    // 德国手机号以15/16/17开头，格式: 1xx xxxxxxx
    mobilePrefixes: ['151', '152', '155', '157', '159', '160', '162', '163', '170', '171', '172', '173', '174', '175', '176', '177', '178', '179'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 7)} ${num.slice(7)}`
  },
  'France': {
    code: '+33',
    length: 9,
    // 法国手机号以6或7开头，格式: 6 xx xx xx xx
    mobilePrefixes: ['6', '7'],
    format: (num) => `${num.slice(0, 1)} ${num.slice(1, 3)} ${num.slice(3, 5)} ${num.slice(5, 7)} ${num.slice(7)}`
  },
  'Italy': {
    code: '+39',
    length: 10,
    // 意大利手机号以3开头，格式: 3xx xxx xxxx
    mobilePrefixes: ['320', '322', '323', '327', '328', '329', '330', '331', '333', '334', '335', '336', '337', '338', '339', '340', '342', '345', '346', '347', '348', '349', '350', '360', '366', '368', '370', '377', '380', '388', '389', '391', '392', '393'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`
  },
  'Spain': {
    code: '+34',
    length: 9,
    // 西班牙手机号以6或7开头，格式: 6xx xxx xxx
    mobilePrefixes: ['6', '7'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`
  },
  'Russia': {
    code: '+7',
    length: 10,
    // 俄罗斯手机号以9开头，格式: 9xx xxx xx xx
    mobilePrefixes: ['900', '901', '902', '903', '904', '905', '906', '908', '909', '910', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922', '923', '924', '925', '926', '927', '928', '929', '930', '931', '932', '933', '934', '936', '937', '938', '939', '950', '951', '952', '953', '958', '960', '961', '962', '963', '964', '965', '966', '967', '968', '969', '977', '978', '980', '981', '982', '983', '984', '985', '986', '987', '988', '989', '991', '992', '993', '994', '995', '996', '997', '999'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)}-${num.slice(6, 8)}-${num.slice(8)}`
  },
  'Brazil': {
    code: '+55',
    length: 11,
    // 巴西手机号格式: (xx) 9xxxx-xxxx，手机号第一位是9
    areaCodePrefixes: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'],
    mobileFirstDigit: '9',
    format: (num) => `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`
  },
  'India': {
    code: '+91',
    length: 10,
    // 印度手机号以6-9开头，格式: xxxxx xxxxx
    mobilePrefixes: ['6', '7', '8', '9'],
    format: (num) => `${num.slice(0, 5)} ${num.slice(5)}`
  },
  'Australia': {
    code: '+61',
    length: 9,
    // 澳大利亚手机号以4开头，格式: 4xx xxx xxx
    mobilePrefixes: ['4'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`
  },
  'Mexico': {
    code: '+52',
    length: 10,
    // 墨西哥手机号，格式: xxx xxx xxxx
    areaCodePrefixes: ['33', '55', '81', '222', '229', '33', '442', '444', '449', '462', '477', '492', '551', '552', '553', '554', '555', '556', '557', '558', '614', '618', '624', '627', '656', '667', '686', '722', '744', '747', '753', '777', '818', '833', '844', '861', '862', '867', '871', '899', '921', '951', '961', '981', '984', '998', '999'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`
  },
  'Singapore': {
    code: '+65',
    length: 8,
    // 新加坡手机号以8或9开头，格式: xxxx xxxx
    mobilePrefixes: ['8', '9'],
    format: (num) => `${num.slice(0, 4)} ${num.slice(4)}`
  },
  'Hong Kong': {
    code: '+852',
    length: 8,
    // 香港手机号以5/6/9开头，格式: xxxx xxxx
    mobilePrefixes: ['5', '6', '9'],
    format: (num) => `${num.slice(0, 4)} ${num.slice(4)}`
  },
  'Taiwan': {
    code: '+886',
    length: 9,
    // 台湾手机号以9开头，格式: 9xx xxx xxx
    mobilePrefixes: ['9'],
    format: (num) => `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`
  },
  'Netherlands': {
    code: '+31',
    length: 9,
    // 荷兰手机号以6开头，格式: 6 xx xx xx xx
    mobilePrefixes: ['6'],
    format: (num) => `${num.slice(0, 1)} ${num.slice(1, 3)} ${num.slice(3, 5)} ${num.slice(5, 7)} ${num.slice(7)}`
  }
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

// 街道名称 - 扩展更多真实街道类型
const STREET_NAMES = {
  'United States': ['Main St', 'Oak Ave', 'Park Rd', 'Cedar Ln', 'Maple Dr', 'Pine St', 'Elm Ave', 'Washington Blvd',
    'Broadway', 'Market St', 'Highland Ave', 'Lake St', 'Walnut St', 'Chestnut St', 'Spring St', 'Center St',
    'Church St', 'Madison Ave', 'Jefferson Blvd', 'Lincoln Way', 'Franklin St', 'Union St', 'Liberty Ave'],
  'United Kingdom': ['High St', 'Church Rd', 'Station Rd', 'Victoria Rd', 'Manor Rd', 'Park Lane', 'Mill Lane',
    'Queen St', 'King St', 'London Rd', 'Bridge St', 'Green Lane', 'North St', 'South St', 'West St', 'East St'],
  'Canada': ['Main St', 'King St', 'Queen St', 'Yonge St', 'Dundas St', 'Bloor St', 'College St', 'Bay St',
    'Avenue Rd', 'Rue Sainte-Catherine', 'Boulevard Saint-Laurent', 'Rue Sherbrooke'],
  'Australia': ['George St', 'Elizabeth St', 'Collins St', 'Bourke St', 'Flinders St', 'King St', 'Queen St',
    'William St', 'Victoria St', 'Albert St', 'Edward St', 'Adelaide St'],
  'China': ['Nanjing Road', 'Chang\'an Street', 'Wangfujing Street', 'Huaihai Road', 'Beijing Road',
    'Zhongshan Road', 'Jiefang Road', 'Renmin Road', 'Xingfu Road', 'Heping Road'],
  'Japan': ['Ginza', 'Omotesando', 'Shibuya', 'Shinjuku', 'Harajuku', 'Akihabara', 'Aoyama', 'Roppongi'],
  'Germany': ['Hauptstraße', 'Bahnhofstraße', 'Schulstraße', 'Gartenstraße', 'Dorfstraße', 'Kirchstraße',
    'Berliner Straße', 'Münchner Straße', 'Frankfurter Allee'],
  'France': ['Rue de la Paix', 'Avenue des Champs-Élysées', 'Boulevard Saint-Germain', 'Rue de Rivoli',
    'Boulevard Haussmann', 'Rue du Faubourg Saint-Honoré', 'Avenue Montaigne'],
  // 韩国街道
  'South Korea': ['Gangnam-daero', 'Teheran-ro', 'Sejong-daero', 'Itaewon-ro', 'Hongdae-ro', 'Myeongdong-gil',
    'Samseong-ro', 'Apgujeong-ro', 'Sinsa-dong-gil', 'Bukchon-ro', 'Insadong-gil', 'Jongno'],
  // 俄罗斯街道
  'Russia': ['Tverskaya Ulitsa', 'Nevsky Prospekt', 'Arbat Ulitsa', 'Kutuzovsky Prospekt', 'Leninsky Prospekt',
    'Novy Arbat', 'Sadovaya Ulitsa', 'Bolshaya Morskaya', 'Liteyny Prospekt', 'Moskovsky Prospekt'],
  // 西班牙街道
  'Spain': ['Gran Vía', 'Paseo de la Castellana', 'Calle Mayor', 'La Rambla', 'Passeig de Gràcia',
    'Calle Serrano', 'Calle de Alcalá', 'Avenida Diagonal', 'Calle Preciados', 'Calle Fuencarral'],
  // 意大利街道
  'Italy': ['Via del Corso', 'Via Condotti', 'Via Montenapoleone', 'Via Roma', 'Via Veneto',
    'Via della Spiga', 'Corso Buenos Aires', 'Via Toledo', 'Via Tornabuoni', 'Corso Vittorio Emanuele'],
  // 巴西街道
  'Brazil': ['Avenida Paulista', 'Rua Oscar Freire', 'Avenida Atlântica', 'Rua Augusta', 'Avenida Rio Branco',
    'Rua das Laranjeiras', 'Avenida Vieira Souto', 'Rua do Catete', 'Avenida Nossa Senhora de Copacabana'],
  // 印度街道
  'India': ['MG Road', 'Brigade Road', 'Commercial Street', 'Park Street', 'Connaught Place',
    'Marine Drive', 'Linking Road', 'FC Road', 'Residency Road', 'Anna Salai', 'Mount Road'],
  // 新加坡街道
  'Singapore': ['Orchard Road', 'Raffles Boulevard', 'Marina Bay', 'Shenton Way', 'Bukit Timah Road',
    'Changi Road', 'Serangoon Road', 'Tanjong Pagar Road', 'Beach Road', 'Victoria Street', 'Arab Street'],
  // 香港街道
  'Hong Kong': ['Nathan Road', 'Queen\'s Road', 'Des Voeux Road', 'Hennessy Road', 'Canton Road',
    'Lockhart Road', 'Jaffe Road', 'Wellington Street', 'Hollywood Road', 'Tsim Sha Tsui Promenade'],
  // 台湾街道
  'Taiwan': ['Zhongxiao Road', 'Xinyi Road', 'Renai Road', 'Dunhua Road', 'Zhongshan Road',
    'Nanjing Road', 'Minquan Road', 'Minsheng Road', 'Fuxing Road', 'Guangfu Road', 'Zhongzheng Road'],
  // 墨西哥街道
  'Mexico': ['Paseo de la Reforma', 'Avenida Insurgentes', 'Avenida Juárez', 'Calle Madero',
    'Avenida Chapultepec', 'Calle 5 de Mayo', 'Avenida Revolución', 'Calle Hidalgo', 'Avenida Universidad'],
  // 荷兰街道
  'Netherlands': ['Kalverstraat', 'Leidsestraat', 'Damrak', 'Rokin', 'Nieuwendijk',
    'P.C. Hooftstraat', 'Van Baerlestraat', 'Beethovenstraat', 'Utrechtsestraat', 'Haarlemmerstraat'],
  'default': ['Main St', 'Central Ave', 'Park Rd', 'First St', 'Second Ave', 'Third St', 'North Rd', 'South Blvd']
};

// 城市-州/省关联数据（真实对应关系）
const CITY_STATE_MAP = {
  'United States': [
    { city: 'New York', state: 'New York', zip: '100' },
    { city: 'Los Angeles', state: 'California', zip: '900' },
    { city: 'Chicago', state: 'Illinois', zip: '606' },
    { city: 'Houston', state: 'Texas', zip: '770' },
    { city: 'Phoenix', state: 'Arizona', zip: '850' },
    { city: 'Philadelphia', state: 'Pennsylvania', zip: '191' },
    { city: 'San Antonio', state: 'Texas', zip: '782' },
    { city: 'San Diego', state: 'California', zip: '921' },
    { city: 'Dallas', state: 'Texas', zip: '752' },
    { city: 'San Jose', state: 'California', zip: '951' },
    { city: 'Austin', state: 'Texas', zip: '787' },
    { city: 'Seattle', state: 'Washington', zip: '981' },
    { city: 'Denver', state: 'Colorado', zip: '802' },
    { city: 'Boston', state: 'Massachusetts', zip: '021' },
    { city: 'Miami', state: 'Florida', zip: '331' },
    { city: 'Atlanta', state: 'Georgia', zip: '303' },
    { city: 'Las Vegas', state: 'Nevada', zip: '891' },
    { city: 'Portland', state: 'Oregon', zip: '972' },
    { city: 'Detroit', state: 'Michigan', zip: '482' },
    { city: 'Minneapolis', state: 'Minnesota', zip: '554' }
  ],
  'United Kingdom': [
    { city: 'London', state: 'Greater London', zip: 'W1' },
    { city: 'Birmingham', state: 'West Midlands', zip: 'B1' },
    { city: 'Manchester', state: 'Greater Manchester', zip: 'M1' },
    { city: 'Glasgow', state: 'Scotland', zip: 'G1' },
    { city: 'Liverpool', state: 'Merseyside', zip: 'L1' },
    { city: 'Leeds', state: 'West Yorkshire', zip: 'LS1' },
    { city: 'Sheffield', state: 'South Yorkshire', zip: 'S1' },
    { city: 'Edinburgh', state: 'Scotland', zip: 'EH1' },
    { city: 'Bristol', state: 'South West England', zip: 'BS1' },
    { city: 'Leicester', state: 'East Midlands', zip: 'LE1' },
    { city: 'Newcastle', state: 'Tyne and Wear', zip: 'NE1' },
    { city: 'Nottingham', state: 'East Midlands', zip: 'NG1' }
  ],
  'Canada': [
    { city: 'Toronto', state: 'Ontario', zip: 'M5' },
    { city: 'Montreal', state: 'Quebec', zip: 'H2' },
    { city: 'Vancouver', state: 'British Columbia', zip: 'V6' },
    { city: 'Calgary', state: 'Alberta', zip: 'T2' },
    { city: 'Edmonton', state: 'Alberta', zip: 'T5' },
    { city: 'Ottawa', state: 'Ontario', zip: 'K1' },
    { city: 'Winnipeg', state: 'Manitoba', zip: 'R3' },
    { city: 'Quebec City', state: 'Quebec', zip: 'G1' },
    { city: 'Hamilton', state: 'Ontario', zip: 'L8' },
    { city: 'Victoria', state: 'British Columbia', zip: 'V8' }
  ],
  'Australia': [
    { city: 'Sydney', state: 'New South Wales', zip: '2000' },
    { city: 'Melbourne', state: 'Victoria', zip: '3000' },
    { city: 'Brisbane', state: 'Queensland', zip: '4000' },
    { city: 'Perth', state: 'Western Australia', zip: '6000' },
    { city: 'Adelaide', state: 'South Australia', zip: '5000' },
    { city: 'Gold Coast', state: 'Queensland', zip: '4217' },
    { city: 'Canberra', state: 'Australian Capital Territory', zip: '2600' },
    { city: 'Newcastle', state: 'New South Wales', zip: '2300' },
    { city: 'Hobart', state: 'Tasmania', zip: '7000' },
    { city: 'Darwin', state: 'Northern Territory', zip: '0800' }
  ],
  'China': [
    { city: 'Beijing', state: 'Beijing', zip: '100000' },
    { city: 'Shanghai', state: 'Shanghai', zip: '200000' },
    { city: 'Guangzhou', state: 'Guangdong', zip: '510000' },
    { city: 'Shenzhen', state: 'Guangdong', zip: '518000' },
    { city: 'Chengdu', state: 'Sichuan', zip: '610000' },
    { city: 'Hangzhou', state: 'Zhejiang', zip: '310000' },
    { city: 'Wuhan', state: 'Hubei', zip: '430000' },
    { city: 'Xi\'an', state: 'Shaanxi', zip: '710000' },
    { city: 'Nanjing', state: 'Jiangsu', zip: '210000' },
    { city: 'Chongqing', state: 'Chongqing', zip: '400000' },
    { city: 'Tianjin', state: 'Tianjin', zip: '300000' },
    { city: 'Suzhou', state: 'Jiangsu', zip: '215000' },
    { city: 'Dongguan', state: 'Guangdong', zip: '523000' },
    { city: 'Qingdao', state: 'Shandong', zip: '266000' }
  ],
  'Japan': [
    { city: 'Tokyo', state: 'Tokyo', zip: '100' },
    { city: 'Osaka', state: 'Osaka', zip: '530' },
    { city: 'Yokohama', state: 'Kanagawa', zip: '220' },
    { city: 'Nagoya', state: 'Aichi', zip: '450' },
    { city: 'Sapporo', state: 'Hokkaido', zip: '060' },
    { city: 'Fukuoka', state: 'Fukuoka', zip: '810' },
    { city: 'Kobe', state: 'Hyogo', zip: '650' },
    { city: 'Kyoto', state: 'Kyoto', zip: '600' },
    { city: 'Kawasaki', state: 'Kanagawa', zip: '210' },
    { city: 'Sendai', state: 'Miyagi', zip: '980' }
  ],
  'South Korea': [
    { city: 'Seoul', state: 'Seoul', zip: '04' },
    { city: 'Busan', state: 'Busan', zip: '46' },
    { city: 'Incheon', state: 'Incheon', zip: '21' },
    { city: 'Daegu', state: 'Daegu', zip: '41' },
    { city: 'Daejeon', state: 'Daejeon', zip: '34' },
    { city: 'Gwangju', state: 'Gwangju', zip: '61' },
    { city: 'Suwon', state: 'Gyeonggi', zip: '16' },
    { city: 'Ulsan', state: 'Ulsan', zip: '44' },
    { city: 'Changwon', state: 'South Gyeongsang', zip: '51' },
    { city: 'Seongnam', state: 'Gyeonggi', zip: '13' }
  ],
  'Germany': [
    { city: 'Berlin', state: 'Berlin', zip: '10' },
    { city: 'Hamburg', state: 'Hamburg', zip: '20' },
    { city: 'Munich', state: 'Bavaria', zip: '80' },
    { city: 'Cologne', state: 'North Rhine-Westphalia', zip: '50' },
    { city: 'Frankfurt', state: 'Hesse', zip: '60' },
    { city: 'Stuttgart', state: 'Baden-Württemberg', zip: '70' },
    { city: 'Düsseldorf', state: 'North Rhine-Westphalia', zip: '40' },
    { city: 'Leipzig', state: 'Saxony', zip: '04' },
    { city: 'Dortmund', state: 'North Rhine-Westphalia', zip: '44' },
    { city: 'Dresden', state: 'Saxony', zip: '01' }
  ],
  'France': [
    { city: 'Paris', state: 'Île-de-France', zip: '75' },
    { city: 'Marseille', state: 'Provence-Alpes-Côte d\'Azur', zip: '13' },
    { city: 'Lyon', state: 'Auvergne-Rhône-Alpes', zip: '69' },
    { city: 'Toulouse', state: 'Occitanie', zip: '31' },
    { city: 'Nice', state: 'Provence-Alpes-Côte d\'Azur', zip: '06' },
    { city: 'Nantes', state: 'Pays de la Loire', zip: '44' },
    { city: 'Strasbourg', state: 'Grand Est', zip: '67' },
    { city: 'Montpellier', state: 'Occitanie', zip: '34' },
    { city: 'Bordeaux', state: 'Nouvelle-Aquitaine', zip: '33' },
    { city: 'Lille', state: 'Hauts-de-France', zip: '59' }
  ],
  'Russia': [
    { city: 'Moscow', state: 'Moscow', zip: '101' },
    { city: 'Saint Petersburg', state: 'Saint Petersburg', zip: '190' },
    { city: 'Novosibirsk', state: 'Novosibirsk Oblast', zip: '630' },
    { city: 'Yekaterinburg', state: 'Sverdlovsk Oblast', zip: '620' },
    { city: 'Kazan', state: 'Tatarstan', zip: '420' },
    { city: 'Nizhny Novgorod', state: 'Nizhny Novgorod Oblast', zip: '603' },
    { city: 'Chelyabinsk', state: 'Chelyabinsk Oblast', zip: '454' },
    { city: 'Samara', state: 'Samara Oblast', zip: '443' }
  ],
  'Spain': [
    { city: 'Madrid', state: 'Madrid', zip: '28' },
    { city: 'Barcelona', state: 'Catalonia', zip: '08' },
    { city: 'Valencia', state: 'Valencia', zip: '46' },
    { city: 'Seville', state: 'Andalusia', zip: '41' },
    { city: 'Zaragoza', state: 'Aragon', zip: '50' },
    { city: 'Málaga', state: 'Andalusia', zip: '29' },
    { city: 'Murcia', state: 'Murcia', zip: '30' },
    { city: 'Bilbao', state: 'Basque Country', zip: '48' }
  ],
  'Italy': [
    { city: 'Rome', state: 'Lazio', zip: '00' },
    { city: 'Milan', state: 'Lombardy', zip: '20' },
    { city: 'Naples', state: 'Campania', zip: '80' },
    { city: 'Turin', state: 'Piedmont', zip: '10' },
    { city: 'Palermo', state: 'Sicily', zip: '90' },
    { city: 'Genoa', state: 'Liguria', zip: '16' },
    { city: 'Bologna', state: 'Emilia-Romagna', zip: '40' },
    { city: 'Florence', state: 'Tuscany', zip: '50' },
    { city: 'Venice', state: 'Veneto', zip: '30' }
  ],
  'Brazil': [
    { city: 'São Paulo', state: 'São Paulo', zip: '01' },
    { city: 'Rio de Janeiro', state: 'Rio de Janeiro', zip: '20' },
    { city: 'Brasília', state: 'Federal District', zip: '70' },
    { city: 'Salvador', state: 'Bahia', zip: '40' },
    { city: 'Fortaleza', state: 'Ceará', zip: '60' },
    { city: 'Belo Horizonte', state: 'Minas Gerais', zip: '30' },
    { city: 'Curitiba', state: 'Paraná', zip: '80' },
    { city: 'Recife', state: 'Pernambuco', zip: '50' }
  ],
  'India': [
    { city: 'Mumbai', state: 'Maharashtra', zip: '400' },
    { city: 'Delhi', state: 'Delhi', zip: '110' },
    { city: 'Bangalore', state: 'Karnataka', zip: '560' },
    { city: 'Hyderabad', state: 'Telangana', zip: '500' },
    { city: 'Chennai', state: 'Tamil Nadu', zip: '600' },
    { city: 'Kolkata', state: 'West Bengal', zip: '700' },
    { city: 'Ahmedabad', state: 'Gujarat', zip: '380' },
    { city: 'Pune', state: 'Maharashtra', zip: '411' },
    { city: 'Jaipur', state: 'Rajasthan', zip: '302' }
  ],
  'Singapore': [
    { city: 'Singapore', state: 'Central Region', zip: '01' },
    { city: 'Jurong East', state: 'West Region', zip: '60' },
    { city: 'Tampines', state: 'East Region', zip: '52' },
    { city: 'Woodlands', state: 'North Region', zip: '73' },
    { city: 'Bedok', state: 'East Region', zip: '46' },
    { city: 'Ang Mo Kio', state: 'North-East Region', zip: '56' }
  ],
  'Taiwan': [
    { city: 'Taipei', state: 'Taipei City', zip: '100' },
    { city: 'Kaohsiung', state: 'Kaohsiung City', zip: '800' },
    { city: 'Taichung', state: 'Taichung City', zip: '400' },
    { city: 'Tainan', state: 'Tainan City', zip: '700' },
    { city: 'Hsinchu', state: 'Hsinchu City', zip: '300' },
    { city: 'Taoyuan', state: 'Taoyuan City', zip: '330' }
  ],
  'Hong Kong': [
    { city: 'Central', state: 'Hong Kong Island', zip: '' },
    { city: 'Kowloon', state: 'Kowloon', zip: '' },
    { city: 'Tsim Sha Tsui', state: 'Kowloon', zip: '' },
    { city: 'Mong Kok', state: 'Kowloon', zip: '' },
    { city: 'Causeway Bay', state: 'Hong Kong Island', zip: '' },
    { city: 'Sha Tin', state: 'New Territories', zip: '' }
  ],
  'Mexico': [
    { city: 'Mexico City', state: 'Mexico City', zip: '06' },
    { city: 'Guadalajara', state: 'Jalisco', zip: '44' },
    { city: 'Monterrey', state: 'Nuevo León', zip: '64' },
    { city: 'Puebla', state: 'Puebla', zip: '72' },
    { city: 'Tijuana', state: 'Baja California', zip: '22' },
    { city: 'Cancún', state: 'Quintana Roo', zip: '77' }
  ]
};

// 当前选中的城市信息（用于保持城市和州的关联）
let currentLocation = null;

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
 * 生成电话号码（根据国家格式）
 */
function generatePhone(country) {
  const config = PHONE_FORMATS[country];

  // 如果没有配置，使用默认美国格式
  if (!config) {
    const defaultConfig = PHONE_FORMATS['United States'];
    const prefix = randomChoice(defaultConfig.areaCodePrefixes);
    const remaining = randomDigits(defaultConfig.length - prefix.length);
    return `${defaultConfig.code} ${defaultConfig.format(prefix + remaining)}`;
  }

  let phoneNumber = '';
  let attempts = 0;

  // 循环生成，直到满足质量要求 (避免 1234, 0000 等)
  do {
    attempts++;
    phoneNumber = '';

    // 处理有区号前缀的情况（如美国、加拿大、巴西、墨西哥）
    if (config.areaCodePrefixes) {
      const areaCode = randomChoice(config.areaCodePrefixes);

      // 巴西特殊处理：区号 + 9 + 8位
      if (config.mobileFirstDigit) {
        const remaining = randomDigits(config.length - areaCode.length - 1);
        phoneNumber = areaCode + config.mobileFirstDigit + remaining;
      } else {
        const remaining = randomDigits(config.length - areaCode.length);
        phoneNumber = areaCode + remaining;
      }
    }
    // 处理有手机前缀的情况（如中国、日本、英国等）
    else if (config.mobilePrefixes) {
      const prefix = randomChoice(config.mobilePrefixes);
      const remaining = randomDigits(config.length - prefix.length);
      phoneNumber = prefix + remaining;
    }
    // 默认情况
    else {
      phoneNumber = randomDigits(config.length);
    }

    // 质量检查：如果是日本，确保不包含 1234 或 0000
    if (country === 'Japan') {
      if (phoneNumber.includes('1234') || phoneNumber.includes('0000')) {
        continue; // 重新生成
      }
    }

    break; // 成功
  } while (attempts < 5);

  // 应用格式化
  const formattedNumber = config.format(phoneNumber);

  return config.code ? `${config.code} ${formattedNumber}` : formattedNumber;
}

/**
 * 生成地址（使用对应国家的街道名）
 */
function generateAddress(country) {
  const streets = STREET_NAMES[country] || STREET_NAMES['default'];
  const streetNum = Math.floor(Math.random() * 9999) + 1;
  const street = randomChoice(streets);
  const aptNum = Math.random() > 0.7 ? `, Apt ${Math.floor(Math.random() * 999) + 1}` : '';
  return `${streetNum} ${street}${aptNum}`;
}

/**
 * 选择一个城市位置（返回城市、州、邮编前缀）
 */
function selectLocation(country) {
  const locations = CITY_STATE_MAP[country] || CITY_STATE_MAP['United States'];
  currentLocation = randomChoice(locations);
  return currentLocation;
}

/**
 * 根据 IP 检测的城市和州设置位置（直接使用 IP 返回的信息）
 */
function selectLocationByCity(country, cityName, regionName) {
  const locations = CITY_STATE_MAP[country] || CITY_STATE_MAP['United States'];

  // 如果 IP 返回了城市信息，直接使用
  if (cityName && cityName !== 'Unknown') {
    // 尝试在数据库中查找邮编前缀
    let zipPrefix = '';

    // 精确匹配城市获取邮编
    const exactMatch = locations.find(loc =>
      loc.city.toLowerCase() === cityName.toLowerCase()
    );
    if (exactMatch) {
      zipPrefix = exactMatch.zip;
    } else if (regionName) {
      // 匹配同州城市获取邮编
      const stateMatch = locations.find(loc =>
        loc.state.toLowerCase() === regionName.toLowerCase() ||
        loc.state.toLowerCase().includes(regionName.toLowerCase())
      );
      if (stateMatch) {
        zipPrefix = stateMatch.zip;
      }
    }

    // 直接使用 IP 返回的城市和州
    currentLocation = {
      city: cityName,
      state: regionName || '',
      zip: zipPrefix
    };

    return currentLocation;
  }

  // 没有 IP 城市信息，随机选择
  return selectLocation(country);
}

/**
 * 获取当前位置信息
 */
function getCurrentLocation() {
  return currentLocation;
}

/**
 * 生成邮编（基于当前选中的城市）
 */
function generateZipCode(country) {
  const zipPrefix = currentLocation ? currentLocation.zip : '';

  if (country === 'United States') {
    // 美国: 5位数字，使用城市对应的前缀
    return zipPrefix + randomDigits(5 - zipPrefix.length);
  } else if (country === 'Canada') {
    // 加拿大: 字母数字格式 A1A 1A1
    const letters = 'ABCEGHJKLMNPRSTVXY';
    return zipPrefix + randomChoice(letters.split('')) + randomDigits(1) + ' ' + randomDigits(1) + randomChoice(letters.split('')) + randomDigits(1);
  } else if (country === 'United Kingdom') {
    // 英国: 使用城市前缀
    return zipPrefix + randomDigits(1) + ' ' + randomDigits(1) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  } else if (country === 'Germany' || country === 'France' || country === 'Spain' || country === 'Italy') {
    // 欧洲: 5位数字
    return zipPrefix + randomDigits(5 - zipPrefix.length);
  } else if (country === 'China') {
    // 中国: 6位数字
    return zipPrefix || randomDigits(6);
  } else if (country === 'Japan') {
    // 日本: xxx-xxxx 格式
    return zipPrefix + randomDigits(3 - zipPrefix.length) + '-' + randomDigits(4);
  } else if (country === 'South Korea') {
    // 韩国: 5位数字
    return zipPrefix + randomDigits(5 - zipPrefix.length);
  } else if (country === 'Australia') {
    // 澳大利亚: 4位数字
    return zipPrefix || randomDigits(4);
  } else if (country === 'India') {
    // 印度: 6位数字
    return zipPrefix + randomDigits(6 - zipPrefix.length);
  } else if (country === 'Brazil') {
    // 巴西: xxxxx-xxx 格式
    return zipPrefix + randomDigits(5 - zipPrefix.length) + '-' + randomDigits(3);
  } else if (country === 'Russia') {
    // 俄罗斯: 6位数字
    return zipPrefix + randomDigits(6 - zipPrefix.length);
  } else if (country === 'Hong Kong' || country === 'Singapore') {
    // 香港/新加坡: 6位数字或无邮编
    return zipPrefix ? zipPrefix + randomDigits(4) : randomDigits(6);
  } else if (country === 'Taiwan') {
    // 台湾: 3-5位数字
    return zipPrefix || randomDigits(3);
  } else if (country === 'Mexico') {
    // 墨西哥: 5位数字
    return zipPrefix + randomDigits(5 - zipPrefix.length);
  }
  return randomDigits(5);
}

/**
 * 生成城市（使用关联数据）
 */
function generateCity(country) {
  // 如果还没有选择位置，先选择一个
  if (!currentLocation) {
    selectLocation(country);
  }
  return currentLocation ? currentLocation.city : 'New York';
}

/**
 * 生成州/省份（使用关联数据，与城市匹配）
 */
function generateState(country) {
  // 使用当前选中的位置信息
  return currentLocation ? currentLocation.state : 'New York';
}

/**
 * 生成性别
 */
function generateGender() {
  return Math.random() > 0.5 ? 'male' : 'female';
}

/**
 * 生成生日（18-55岁之间的随机日期，确保年份>=1970）
 */
function generateBirthday(minAge = 18, maxAge = 55) {
  const today = new Date();
  const currentYear = today.getFullYear();

  // 计算年份范围，确保不早于1970年
  const maxBirthYear = currentYear - minAge;  // 最大年份（最年轻）
  const minBirthYear = Math.max(1970, currentYear - maxAge);  // 最小年份（最年长），不早于1970

  // 随机年份
  const birthYear = minBirthYear + Math.floor(Math.random() * (maxBirthYear - minBirthYear + 1));

  // 随机月份 (1-12)
  const birthMonth = Math.floor(Math.random() * 12) + 1;

  // 根据月份确定天数
  const daysInMonth = new Date(birthYear, birthMonth, 0).getDate();
  const birthDay = Math.floor(Math.random() * daysInMonth) + 1;

  // 格式化为 YYYY-MM-DD
  const month = birthMonth.toString().padStart(2, '0');
  const day = birthDay.toString().padStart(2, '0');

  return `${birthYear}-${month}-${day}`;
}

/**
 * 生成完整的用户信息
 */
function generateAllInfo(ipData) {
  const country = ipData.country || 'United States';
  const ipCity = ipData.city || '';
  const ipRegion = ipData.region || '';

  const gender = generateGender();
  const firstName = generateFirstName(country);
  const lastName = generateLastName(country);
  const username = generateUsername(firstName, lastName);

  // 优先根据 IP 检测到的城市匹配位置，确保城市、州、邮编关联
  selectLocationByCity(country, ipCity, ipRegion);

  return {
    firstName,
    lastName,
    gender,
    birthday: generateBirthday(),
    username,
    email: generateEmail(username),
    password: generatePassword(),
    phone: generatePhone(country),
    address: generateAddress(country),
    city: generateCity(country),
    state: generateState(country),
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
    case 'gender':
      return generateGender();
    case 'birthday':
      return generateBirthday();
    case 'username':
      return generateUsername(currentData.firstName, currentData.lastName);
    case 'email':
      return generateEmail(currentData.username);
    case 'password':
      return generatePassword();
    case 'phone':
      return generatePhone(country);
    case 'address':
      return generateAddress(country);
    case 'city':
      // 刷新城市时重新选择位置，返回包含城市、州、邮编的对象
      selectLocation(country);
      return {
        city: currentLocation.city,
        state: currentLocation.state,
        zipCode: generateZipCode(country),
        _isLocationUpdate: true  // 标记这是位置更新
      };
    case 'state':
      // 州与城市关联，单独刷新州时也重新选择位置
      selectLocation(country);
      return {
        city: currentLocation.city,
        state: currentLocation.state,
        zipCode: generateZipCode(country),
        _isLocationUpdate: true
      };
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
  // 扩展密码生成函数（支持自定义设置）
  function generatePasswordWithSettings(settings) {
    settings = settings || {};
    var length = settings.passwordLength || 12;
    var useUppercase = settings.pwdUppercase !== false;
    var useLowercase = settings.pwdLowercase !== false;
    var useNumbers = settings.pwdNumbers !== false;
    var useSymbols = settings.pwdSymbols !== false;
    var chars = '';
    var password = '';
    if (useUppercase) { chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; }
    if (useLowercase) { chars += 'abcdefghijklmnopqrstuvwxyz'; password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; }
    if (useNumbers) { chars += '0123456789'; password += '0123456789'[Math.floor(Math.random() * 10)]; }
    if (useSymbols) { chars += '!@#$%^&*'; password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; }
    if (!chars) { chars = 'abcdefghijklmnopqrstuvwxyz'; password = 'a'; }
    for (var i = password.length; i < length; i++) { password += chars[Math.floor(Math.random() * chars.length)]; }
    return password.split('').sort(function () { return Math.random() - 0.5; }).join('');
  }

  // 扩展信息生成函数（支持自定义设置）
  function generateAllInfoWithSettings(ipData, settings) {
    settings = settings || {};
    var country = ipData.country || 'United States';
    var ipCity = ipData.city || '';
    var ipRegion = ipData.region || '';
    var gender = generateGender();

    // 日本专用处理：使用汉字姓名和日本地址
    if (country === 'Japan' && window.japanGenerators) {
      var japanName = window.japanGenerators.generateJapanName(gender);
      var japanAddr = window.japanGenerators.generateJapanAddress();
      var japanPhone = generatePhone('Japan'); // 使用统一的生成函数（带质量检测）
      var username = generateUsername(japanName.firstNameRomaji, japanName.lastNameRomaji);
      return {
        firstName: japanName.firstNameKanji,
        lastName: japanName.lastNameKanji,
        firstNameKana: japanName.firstNameKana,
        lastNameKana: japanName.lastNameKana,
        fullName: japanName.lastNameKanji + ' ' + japanName.firstNameKanji,
        fullNameKana: japanName.lastNameKana + ' ' + japanName.firstNameKana,
        gender: gender,
        birthday: generateBirthday(settings.minAge || 18, settings.maxAge || 55),
        username: username,
        email: generateEmail(username),
        password: generatePasswordWithSettings(settings),
        phone: japanPhone,
        address: japanAddr.chome,
        city: japanAddr.prefecture + japanAddr.city,
        state: japanAddr.building,
        zipCode: japanAddr.zipCode,
        country: country,
        id_usertype: '100' // XServer 个人注册
      };
    }

    var firstName = generateFirstName(country);
    var lastName = generateLastName(country);
    var username = generateUsername(firstName, lastName);
    selectLocationByCity(country, ipCity, ipRegion);
    return {
      firstName: firstName, lastName: lastName, gender: gender,
      birthday: generateBirthday(settings.minAge || 18, settings.maxAge || 55),
      username: username,
      email: generateEmail(username),
      password: generatePasswordWithSettings(settings),
      phone: generatePhone(country),
      address: generateAddress(country),
      city: generateCity(country),
      state: generateState(country),
      zipCode: generateZipCode(country),
      country: country
    };
  }

  window.generators = {
    generateAllInfo: generateAllInfo,
    generateAllInfoWithSettings: generateAllInfoWithSettings,
    regenerateField: regenerateField,
    generateFirstName: generateFirstName,
    generateLastName: generateLastName,
    generateGender: generateGender,
    generateBirthday: generateBirthday,
    generateUsername: generateUsername,
    generateEmail: generateEmail,
    generatePassword: generatePassword,
    generatePasswordWithSettings: generatePasswordWithSettings,
    generatePhone: generatePhone,
    generateAddress: generateAddress,
    generateZipCode: generateZipCode,
    generateCity: generateCity,
    generateState: generateState,
    selectLocationByCity: selectLocationByCity,
    normalizeCountry: normalizeCountry,
    setCustomEmailDomain: setCustomEmailDomain,
    getCustomEmailDomain: getCustomEmailDomain,
    getAllEmailDomains: getAllEmailDomains,
    // 地址 API 相关
    setGeoapifyApiKey: setGeoapifyApiKey,
    fetchRealAddressFromApi: fetchRealAddressFromApi,
    fetchAddressFromOSM: fetchAddressFromOSM,
    fetchRealAddressSmart: fetchRealAddressSmart,
    CITY_COORDINATES: CITY_COORDINATES,
    /**
     * 异步生成地址（智能切换：Geoapify → OSM → 本地生成）
     */
    generateAddressAsync: async function (country, cityName) {
      // 尝试获取城市坐标
      const coords = CITY_COORDINATES[cityName] || CITY_COORDINATES[currentLocation?.city];

      if (coords) {
        try {
          // 使用智能切换函数（优先 Geoapify，备用 OSM）
          const realAddr = await fetchRealAddressSmart(coords.lat, coords.lon);
          if (realAddr && realAddr.address) {
            console.log('[GeoFill] 获取真实地址成功:', realAddr.address, '来源:', realAddr.source);
            return realAddr;
          }
        } catch (e) {
          console.log('[GeoFill] 地址 API 失败，使用本地生成');
        }
      }

      // 降级到默认逻辑
      return {
        address: generateAddress(country),
        city: generateCity(country),
        state: generateState(country),
        zipCode: generateZipCode(country),
        country: country,
        source: 'local'
      };
    }
  };
}
