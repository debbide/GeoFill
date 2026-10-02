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

// 自托管地址服务（daimon3332/address）：用户在设置中配置服务地址 + API Token
let selfHostedAddressBaseUrl = null;
let selfHostedAddressToken = null;

/**
 * 设置自托管地址服务配置（地址或 Token 为空即视为未配置）
 */
function setSelfHostedAddressConfig(baseUrl, token) {
  const normalized = baseUrl && baseUrl.trim() ? baseUrl.trim().replace(/\/+$/, '') : null;
  selfHostedAddressBaseUrl = normalized;
  selfHostedAddressToken = token && token.trim() ? token.trim() : null;
  console.log('[GeoFill] 自托管地址服务已' + (selfHostedAddressBaseUrl ? '设置' : '清除'));
}

/**
 * GeoFill 国家名 -> 地址服务的 ISO 国家代码
 */
const SELFHOSTED_COUNTRY_CODES = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Mexico': 'MX',
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Netherlands': 'NL',
  'Russia': 'RU',
  'China': 'CN',
  'Hong Kong': 'HK',
  'Taiwan': 'TW',
  'Japan': 'JP',
  'South Korea': 'KR',
  'Singapore': 'SG',
  'India': 'IN',
  'Australia': 'AU',
  'Brazil': 'BR'
};

/**
 * 调用自托管地址服务生成真实地址（GET /api/v1/generate）
 * 服务返回官方注册库的真实地址；无覆盖/失败返回 null 交给下一个地址源
 */
async function fetchAddressFromSelfHosted(country, cityName) {
  if (!selfHostedAddressBaseUrl) return null;
  if (typeof fetch !== 'function') return null;

  const normalizedCountry = normalizeCountry(country || 'United States');
  const countryCode = SELFHOSTED_COUNTRY_CODES[normalizedCountry];
  if (!countryCode) return null;

  const params = new URLSearchParams({ country: countryCode });
  const city = String(cityName || '').trim();
  if (city) params.set('city', city);

  const headers = {};
  if (selfHostedAddressToken) {
    headers['Authorization'] = 'Bearer ' + selfHostedAddressToken;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const response = await fetch(
      selfHostedAddressBaseUrl + '/api/v1/generate?' + params.toString(),
      Object.assign({ headers }, controller ? { signal: controller.signal } : {})
    );
    if (!response.ok) {
      // 404 NO_POOL_COVERAGE：该区域暂无同步数据，正常降级
      console.log('[GeoFill] 自托管地址请求失败:', response.status);
      return null;
    }

    const data = await response.json();
    const addr = data && data.data && data.data.result && data.data.result.address;
    if (!addr) return null;

    // 优先英文组件（与本地地址池的英文惯例一致），缺失时回退原生组件
    const variants = addr.componentVariants || {};
    const comp = variants.en || variants.native || addr.components || {};

    const houseNumber = String(comp.houseNumber || '').trim();
    const street = String(comp.street || '').trim();
    let streetLine = [houseNumber, street].filter(Boolean).join(' ');
    if (!streetLine) {
      streetLine = String(addr.formattedAddress || '').trim();
    }
    if (!streetLine) return null;

    return {
      address: streetLine,
      city: String(comp.locality || comp.postalLocality || city || ''),
      state: String(comp.admin1Code || comp.admin1 || ''),
      zipCode: String(comp.postcode || ''),
      country: normalizedCountry,
      source: 'selfhosted',
      confidence: addr.matchLevel === 'street' ? 'medium' : 'high'
    };
  } catch (e) {
    console.log('[GeoFill] 自托管地址调用失败:', e && e.message ? e.message : e);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
  if (typeof fetch !== 'function') return null;

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
        source: 'geoapify',
        confidence: 'high'
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
  if (typeof fetch !== 'function') return null;

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
        source: 'openstreetmap',
        confidence: 'medium'
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

// P0 国家本地真实地址池（优先使用，保障离线可用和稳定性）
const LOCAL_VERIFIED_ADDRESS_POOL = (typeof globalThis !== 'undefined' && globalThis.LOCAL_VERIFIED_ADDRESS_POOL) ? globalThis.LOCAL_VERIFIED_ADDRESS_POOL : {};
const LOCAL_VERIFIED_ADDRESS_POOL_RUNTIME_META = (typeof globalThis !== 'undefined' && globalThis.LOCAL_VERIFIED_ADDRESS_POOL_META) ? globalThis.LOCAL_VERIFIED_ADDRESS_POOL_META : {};

const ADDRESS_PICK_STATE = {
  recentByCountry: Object.create(null)
};
const ADDRESS_RECENT_LIMIT = 80;

function normalizeAddressToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function buildAddressEntryKey(entry) {
  return [entry.address, entry.city, entry.state, entry.zipCode].join('|').toLowerCase();
}

function isSameAddressCity(entryCity, cityName) {
  const normalizedEntryCity = normalizeAddressToken(entryCity);
  const normalizedCityName = normalizeAddressToken(cityName);
  return Boolean(normalizedEntryCity && normalizedCityName && normalizedEntryCity === normalizedCityName);
}

function getRecentAddressQueue(country) {
  const normalizedCountry = normalizeCountry(country);
  if (!ADDRESS_PICK_STATE.recentByCountry[normalizedCountry]) {
    ADDRESS_PICK_STATE.recentByCountry[normalizedCountry] = [];
  }
  return ADDRESS_PICK_STATE.recentByCountry[normalizedCountry];
}

function pickLocalVerifiedAddress(country, cityName = '', options = {}) {
  const normalizedCountry = normalizeCountry(country);
  if (!Object.prototype.hasOwnProperty.call(LOCAL_VERIFIED_ADDRESS_POOL, normalizedCountry)) {
    return null;
  }
  const pool = LOCAL_VERIFIED_ADDRESS_POOL[normalizedCountry];
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

  const preferredCity = normalizeAddressToken(cityName);
  const cityMatches = preferredCity
    ? pool.filter((entry) => isSameAddressCity(entry.city, preferredCity))
    : [];
  if (options.requireCityMatch && preferredCity && cityMatches.length === 0) {
    return null;
  }
  const candidatePool = cityMatches.length > 0 ? cityMatches : pool;

  const recentQueue = getRecentAddressQueue(normalizedCountry);
  let freshCandidates = candidatePool.filter((entry) => !recentQueue.includes(buildAddressEntryKey(entry)));
  if (freshCandidates.length === 0) {
    recentQueue.length = 0;
    freshCandidates = candidatePool.slice();
  }

  const picked = randomChoice(freshCandidates);
  if (!picked) return null;

  const pickedKey = buildAddressEntryKey(picked);
  recentQueue.push(pickedKey);
  const maxRecent = Math.min(ADDRESS_RECENT_LIMIT, Math.max(10, pool.length * 3));
  while (recentQueue.length > maxRecent) {
    recentQueue.shift();
  }

  return {
    address: picked.address,
    city: picked.city,
    state: picked.state || '',
    zipCode: picked.zipCode || '',
    country: normalizedCountry,
    source: 'local_verified',
    confidence: 'high'
  };
}

function buildSyntheticAddress(country, locationContext = {}) {
  const normalizedCountry = normalizeCountry(country || 'United States');
  return {
    address: generateAddress(normalizedCountry),
    city: locationContext.city || generateCity(normalizedCountry),
    state: locationContext.state || generateState(normalizedCountry),
    zipCode: locationContext.zipCode || generateZipCode(normalizedCountry),
    country: normalizedCountry,
    source: 'synthetic',
    confidence: 'low'
  };
}

function pickInitialAddress(country, cityName = '', regionName = '') {
  const normalizedCountry = normalizeCountry(country || 'United States');
  const hasSpecificCity = Boolean(cityName && cityName !== 'Unknown');
  const localVerified = pickLocalVerifiedAddress(normalizedCountry, cityName, {
    requireCityMatch: hasSpecificCity
  });
  if (localVerified) {
    return localVerified;
  }

  return buildSyntheticAddress(normalizedCountry, {
    city: hasSpecificCity ? cityName : generateCity(normalizedCountry),
    state: regionName || generateState(normalizedCountry),
    zipCode: generateZipCode(normalizedCountry)
  });
}

// 各国常见名字库
const NAME_DATABASE = {
  // 英语国家
  en: {
    firstNames: [
      "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
      "Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn",
      "Daniel", "Matthew", "Christopher", "Andrew", "Joshua", "Nicholas", "Ethan", "Benjamin", "Samuel", "Henry",
      "Liam", "Noah", "Mason", "Logan", "Lucas", "Ella", "Scarlett", "Grace", "Chloe", "Lily",
      "Aria", "Zoey", "Natalie", "Hannah", "Layla", "Nora", "Riley", "Aubrey", "Addison", "Penelope",
      "Aaron", "Adam", "Albert", "Alexander", "Allan", "Alvin", "Angelo", "Armando", "Bert", "Bob",
      "Bradford", "Brendan", "Bruce", "Caleb", "Carlos", "Casey", "Chad", "Chester", "Clarence", "Clayton",
      "Clinton", "Conrad", "Courtney", "Dallas", "Dana", "Darnell", "Darrin", "Derek", "Dexter", "Dominick",
      "Doug", "Duane", "Earl", "Edgar", "Edward", "Elijah", "Emanuel", "Eric", "Ernesto", "Everett",
      "Floyd", "Frank", "Fred", "Gabriel", "Gene", "Gerard", "Glen", "Grant", "Guadalupe", "Guy",
      "Hector", "Homer", "Hugh", "Ira", "Ismael", "Jack", "Jake", "Jared", "Jean", "Jerald",
      "Jerome", "Jesus", "Jimmy", "Joey", "Johnny", "Jordan", "Josh", "Julio", "Karl", "Ken",
      "Kerry", "Kristopher", "Lance", "Lee", "Leonard", "Lester", "Lloyd", "Louis", "Luke", "Mack",
      "Marco", "Mario", "Marshall", "Mathew", "Max", "Micheal", "Mitchell", "Nathan", "Neil", "Nicolas",
      "Oliver", "Oscar", "Pat", "Percy", "Peter", "Preston", "Ramon", "Randy", "Reginald", "Roderick",
      "Roger", "Ron", "Ross", "Rudy", "Salvador", "Sammy", "Saul", "Seth", "Shawn", "Simon",
      "Steve", "Sylvester", "Terence", "Terry", "Timmy", "Tom", "Tony", "Troy", "Van", "Virgil",
      "Warren", "Wilbert", "Winston", "Ada", "Alberta", "Alicia", "Alyssa", "Amy", "Angela", "Anita",
      "Anne", "Antonia", "Audrey", "Belinda", "Bessie", "Betty", "Blanca", "Bonnie", "Bridget", "Candace",
      "Carol", "Carrie", "Cathy", "Celia", "Cheryl", "Christy", "Claudia", "Cora", "Cynthia", "Darla",
      "Deanna", "Delia", "Desiree", "Dianne", "Dora", "Ebony", "Eileen", "Elisa", "Eloise", "Emily",
      "Erin", "Estelle", "Eunice", "Faith", "Flora", "Freda", "Genevieve", "Gina", "Gloria", "Harriet",
      "Heidi", "Holly", "Irene", "Jackie", "Jamie", "Jane", "Janis", "Jeanne", "Jennie", "Jessie",
      "Joann", "Jodi", "Josefina", "Juana", "Julia", "Karen", "Katherine", "Katie", "Kayla", "Kelly",
      "Kimberly", "Kristie", "Kristy", "Laura", "Laverne", "Lela", "Leticia", "Linda", "Lois", "Lorene",
      "Louise", "Lucy", "Lynda", "Mabel", "Maggie", "Marcia", "Marguerite", "Marianne", "Marjorie", "Martha"
    ],
    lastNames: [
      "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
      "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris",
      "Clark", "Lewis", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green",
      "Baker", "Adams", "Nelson", "Carter", "Mitchell", "Perez", "Turner", "Phillips", "Campbell", "Parker",
      "Abbott", "Abshire", "Altenwerth", "Ankunding", "Auer", "Bahringer", "Balistreri", "Bartoletti", "Bashirian", "Bauch",
      "Bayer", "Beatty", "Becker", "Beer", "Bergnaum", "Bernhard", "Bins", "Blick", "Bode", "Bogan",
      "Bosco", "Boyer", "Bradtke", "Braun", "Brekke", "Bruen", "Carroll", "Casper", "Champlin", "Cole",
      "Collins", "Connelly", "Considine", "Cormier", "Crist", "Cronin", "Cruickshank", "Cummings", "Dach", "Dare",
      "Deckow", "Dibbert", "Dicki", "Dietrich", "Dooley", "Doyle", "Durgan", "Emard", "Erdman", "Fadel",
      "Farrell", "Feeney", "Feil", "Fisher", "Franecki", "Friesen", "Funk", "Gerlach", "Gislason", "Gleichner",
      "Goodwin", "Gottlieb", "Grady", "Grant", "Greenfelder", "Grimes", "Gusikowski", "Haag", "Hagenes", "Haley",
      "Hamill", "Hand", "Hansen", "Hauck", "Heaney", "Hegmann", "Heller", "Hermann", "Herzog", "Hickle",
      "Hills", "Hintz", "Hodkiewicz", "Homenick", "Howe", "Hudson", "Hyatt", "Jacobs", "Jakubowski", "Jast",
      "Jerde", "Keebler", "Kemmer", "Kertzmann", "Kiehn", "Kilback", "Kirlin", "Klocko", "Koelpin", "Kohler",
      "Koss", "Kozey", "Kreiger", "Kshlerin", "Kuhlman", "Kulas", "Kunze", "Kutch", "Labadie", "Lang",
      "Langworth", "Leannon", "Ledner", "Legros", "Lemke", "Leuschke", "Lindgren", "Lockman", "Lubowitz", "Luettgen",
      "MacGyver", "Maggio", "Mante", "Marquardt", "Mayert", "McCullough", "McGlynn", "McLaughlin", "Mertz", "Monahan",
      "Morar", "Mosciski", "Mueller", "Murazik", "Murray", "Nienow", "Nitzsche", "O'Connell", "O'Hara", "O'Kon",
      "Oberbrunner", "Olson", "Ortiz", "Pacocha", "Pagac", "Pfannerstill", "Pollich", "Powlowski", "Prohaska", "Purdy",
      "Quitzon", "Ratke", "Raynor", "Reichert", "Rempel", "Reynolds", "Rippin", "Robel", "Rohan", "Romaguera",
      "Rowe", "Runolfsdottir", "Runte", "Rutherford", "Sanford", "Sauer", "Schaden", "Schiller", "Schinner", "Schmidt",
      "Schneider", "Schowalter", "Schulist", "Schuppe", "Senger", "Shields", "Sipes", "Spencer", "Sporer", "Stark"
    ]
  },
  // 中文名（拼音）
  zh: {
    firstNames: [
      "Wei", "Fang", "Lei", "Yang", "Jing", "Ming", "Hua", "Xin", "Jun", "Yan",
      "Lin", "Chen", "Hao", "Tao", "Peng", "Yun", "Feng", "Qiang", "Bo", "Kai",
      "Ting", "Xuan", "Yu", "Jia", "Shan", "Rui", "Tian", "Yue", "Ning", "Xiao",
      "Bin", "Chao", "Dong", "Guang", "Jie", "Ke", "Nan", "Qin", "Ran", "Zhe",
      "Sheng", "Yong", "Xiang", "Guo", "Zhong", "Cheng", "Long", "Song", "Tong", "Zhi",
      "Zhuo", "Sen", "Liang", "Xing", "An", "Ping", "Wen", "Shuo", "Run", "Han",
      "Mao", "Shen", "Tang", "Xu", "Ye", "Duan", "Lu", "Lan", "Na", "Mei",
      "Yi", "Qian", "Xue", "Zhen", "Man", "Juan", "Ying", "Hong", "Meng", "Shu",
      "Ai", "Rong", "Dan", "Xia", "Yao", "Chun", "Fen", "Hui", "Lian", "Shuang",
      "Wan", "Ya"
    ],
    lastNames: [
      "Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou",
      "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo", "He", "Lin", "Luo", "Gao",
      "Peng", "Tang", "Deng", "Cao", "Jiang", "Fang", "Xie", "Song", "Duan", "Yao",
      "Shen", "Han", "Lu", "Wei", "Qian", "Hou", "Xiong", "Liao", "Zeng", "Pan",
      "Liang", "Zheng", "Feng", "Yu", "Dong", "Xiao", "Cheng", "Yuan", "Fu", "Su",
      "Cai", "Jia", "Ding", "Xue", "Ye", "Yan", "Tian", "Du", "Ren", "Fan",
      "Shi", "Bai", "Jin", "Tao", "Qin", "Chu", "Gu", "Shao", "Meng", "Long",
      "Wan", "Lei", "Yin", "Chang", "Mo", "Kong"
    ]
  },
  // 日语（罗马字）
  ja: {
    firstNames: [
      "Yuki", "Haruto", "Sota", "Yuto", "Riku", "Sakura", "Hina", "Yui", "Mio", "Aoi",
      "Ren", "Takumi", "Kaito", "Hinata", "Yuna", "Akari", "Mei", "Rin", "Koharu", "Sora",
      "Shota", "Daiki", "Kenta", "Ryota", "Sho", "Ayaka", "Haruka", "Nanami", "Misaki", "Kana",
      "Yuma", "Itsuki", "Kazuki", "Nao", "Mao", "Riko", "Noa", "Momoka", "Asahi", "Kokoro",
      "Haruki", "Taichi", "Yuji", "Kazuya", "Tomoya", "Satoshi", "Daisuke", "Kenji", "Takuya", "Hiroshi",
      "Takeshi", "Takashi", "Yosuke", "Shun", "Sosuke", "Minato", "Yamato", "Taiyo", "Kakeru", "Shoma",
      "Hikaru", "Keisuke", "Shinichi", "Masato", "Akira", "Kohei", "Yusei", "Yuzuki", "Sana", "Tsumugi",
      "Himari", "Yua", "Niko", "Keiko", "Yoko", "Naomi", "Sayaka", "Aya", "Mai", "Asuka",
      "Eri", "Mari", "Natsuki", "Hikari", "Chihiro", "Akane", "Rie", "Saori", "Mayu", "Kazuko",
      "Atsuko", "Emiko", "Yume", "Otoha"
    ],
    lastNames: [
      "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato",
      "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Yamazaki",
      "Mori", "Abe", "Ikeda", "Hashimoto", "Ishikawa", "Nakajima", "Maeda", "Fujita", "Ogawa", "Goto",
      "Okada", "Hasegawa", "Murakami", "Ishii", "Saito", "Kondo", "Imai", "Miura", "Fujii", "Honda",
      "Yamashita", "Sakamoto", "Endo", "Aoki", "Nishimura", "Fukuda", "Fujiwara", "Okamoto", "Matsuda", "Nakagawa",
      "Harada", "Koike", "Iwata", "Nakano", "Hara", "Tamura", "Takeuchi", "Kaneko", "Wada", "Morita",
      "Fujimoto", "Kinoshita", "Sugimoto", "Miyazaki", "Shibata", "Nomura", "Hattori", "Takagi"
    ]
  },
  // 韩语（罗马字）
  ko: {
    firstNames: [
      "Minho", "Jinho", "Junho", "Seungmin", "Jaemin", "Yuna", "Jiyeon", "Soojin", "Minjung", "Hana",
      "Jihoon", "Dongwoo", "Sunwoo", "Yoojin", "Minji", "Soyeon", "Daeun", "Yerin", "Chaewon", "Jiwon",
      "Hyunwoo", "Taeyang", "Seojun", "Eunwoo", "Yejun", "Jisoo", "Seoyeon", "Hayoon", "Jiwoo", "Sujin",
      "Wonho", "Minseok", "Seungwoo", "Hyejin", "Ara", "Bora", "Nari", "Somin", "Yeji", "Sanghoon",
      "Jongho", "Byungjun", "Kyungmin", "Minjun", "Hajun", "Doyun", "Jihu", "Yeonwoo", "Woojin", "Sangmin",
      "Jaehyun", "Jungwoo", "Seokwoo", "Taehyung", "Myungsoo", "Joonho", "Junyoung", "Sungmin", "Donghyun", "Haneul",
      "Kihoon", "Juwon", "Seoa", "Soeun", "Hajin", "Yeseo", "Seohyun", "Hyewon", "Dasom", "Nahyun",
      "Yebin", "Sohee", "Jisu", "Eunbi", "Seyeon", "Yoonseo", "Jua", "Seoin", "Chaeyun", "Jihyun",
      "Somyi", "Dayeon", "Jungyeon", "Mijoo", "Haerin"
    ],
    lastNames: [
      "Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim",
      "Han", "Oh", "Seo", "Shin", "Kwon", "Hwang", "Ahn", "Song", "Yoo", "Hong",
      "Moon", "Baek", "Nam", "Sim", "Jeon", "Ryu", "No", "Bae", "Ko", "Heo",
      "Ha", "Jin", "Gu", "Son", "Cha", "Woo", "Byun", "Do", "Yum", "An",
      "Seok"
    ]
  },
  // 德语
  de: {
    firstNames: [
      "Maximilian", "Alexander", "Paul", "Leon", "Lukas", "Emma", "Mia", "Hannah", "Sofia", "Anna",
      "Felix", "Jonas", "Tim", "David", "Finn", "Lena", "Laura", "Marie", "Lea", "Julia",
      "Noah", "Elias", "Ben", "Julian", "Anton", "Clara", "Luisa", "Johanna", "Frieda", "Ella",
      "Moritz", "Niklas", "Simon", "Tobias", "Matteo", "Emilia", "Paula", "Mila", "Nele", "Lina",
      "Aaron", "Adrian", "Ahmet", "Alex", "Amar", "Andrew", "Arne", "Arved", "Baris", "Benedikt",
      "Benno", "Bilal", "Boris", "Burak", "Carlo", "Cem", "Christiano", "Clemens", "Constantin", "Damien",
      "Dario", "Davide", "Denny", "Domenic", "Dustin", "Eddy", "Ege", "Emanuel", "Emir", "Enrico",
      "Etienne", "Falk", "Filip", "Florian", "Frederick", "Furkan", "Gian", "Giuseppe", "Hannes", "Hassan",
      "Henri", "Hugo", "Ilja", "Ismail", "Jacob", "Jamie", "Janne", "Jano", "Jarne", "Jay",
      "Jens", "Jerome", "Jimmy", "Johann", "Jona", "Jonte", "Joschua", "Joshua", "Julius", "Kaan",
      "Karl", "Kenny", "Kevin", "Kjell", "Konstantin", "Lasse", "Laurin", "Len", "Lennert", "Leo",
      "Leonidas", "Levi", "Lian", "Lio", "Lorenzo", "Luc", "Ludwig", "Luka", "Maddox", "Malik",
      "Marcel", "Mario", "Markus", "Marvin", "Matis", "Matthis", "Max", "Meik", "Michel", "Mikail",
      "Mirac", "Mohammad", "Murat", "Nelson", "Nico", "Nikita", "Nikolas", "Norman", "Oliver", "Pascal",
      "Peer", "Philipp", "Pius", "Ramon", "Rayan", "Richard", "Rocco", "Ruben", "Sami", "Santino",
      "Semih", "Steffen", "Sönke", "Tammo", "Theo", "Thomas", "Til", "Timm", "Titus", "Tom",
      "Torben", "Umut", "Victor", "Vitus", "Willy", "Yannis", "Yusuf", "Abby", "Adriana", "Alea",
      "Alexandra", "Alia", "Alisa", "Aliyah", "Amanda", "Amira", "Andrea", "Anja", "Annabell", "Annelie",
      "Annika", "Ariana", "Asya", "Aylin", "Bianca", "Carla", "Carolina", "Catrin", "Celine", "Charleen",
      "Chiara", "Claire", "Cora", "Daniela", "Denise", "Dorothea", "Ela", "Eleni", "Elina", "Elli",
      "Emely", "Emmely", "Enna", "Esther", "Evelyn", "Felicia", "Fine", "Fiona", "Franziska", "Giuliana",
      "Hanna", "Helena", "Hermine", "Ina", "Isa", "Isabelle", "Jana", "Janine", "Jasmina", "Jennifer",
      "Jette", "Joelina", "Joleen", "Joline", "Josefin", "Josy", "Judy", "Julie", "Juna", "Karla",
      "Katarina", "Katrin", "Kim", "Klara", "Lana", "Laureen", "Leandra", "Lenja", "Leonora", "Leyla",
      "Lilia", "Lilli", "Linda", "Linnea", "Livia", "Lorena", "Louise", "Lucienne", "Lyn", "Madleen",
      "Maira", "Malin", "Marah", "Marina", "Marleen", "Marta", "Mathilde", "Maxine", "Meike", "Melina"
    ],
    lastNames: [
      "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
      "Koch", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Hofmann",
      "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier", "Lehmann", "Schmid", "Schulze",
      "Maier", "Köhler", "Herrmann", "König", "Walter", "Mayr", "Huber", "Kaiser", "Fuchs", "Peters",
      "Abel", "Ackermann", "Aigner", "Amberg", "Aryee", "Badane", "Balnuweit", "Baseda", "Bayer", "Beer",
      "Benecke", "Bertenbreiter", "Bichler", "Biesenbach", "Blochwitz", "Bohge", "Borsch", "Bozsik", "Breitenstein", "Briesenick",
      "Bruhns", "Buder", "Burmeister", "Bäcker", "Büker", "Carlowitz", "Cleem", "Crews", "Damaske", "Dauth",
      "Delonge", "Dethloff", "Dietz", "Dittmer", "Dombrowski", "Dreissigacker", "Döbel", "Ecker", "Eich", "Emert",
      "Erdmann", "Esser", "Fassbender", "Fenske", "Fink", "Flore", "Franta", "Freimann", "Friedenberg", "Gadschiew",
      "Gast", "Gehrig", "Gerbennow", "Ghosh", "Goedicke", "Gollnow", "Graf", "Greithanner", "Grosser", "Grundmann",
      "Gunkel", "Göhler", "Gürbig", "Hadwich", "Hannecker", "Harting", "Hassfeld", "Hecht", "Heinke", "Helpling",
      "Hentel", "Hermecke", "Herzenberg", "Heydemüller", "Hingst", "Holinski", "Hooss", "Huke", "Höft", "Hüttcher",
      "Itt", "Jambor", "Jasinski", "John", "Jürgens", "Kalinowski", "Karhoff", "Katzinski", "Keiner", "Kern",
      "Kinadeter", "Klapper", "Kleininger", "Klopsch", "Knies", "Knut", "Koehler", "Kohrt", "Konig", "Koubaa",
      "Kramer", "Kreissig", "Kron", "Kröger", "Kulma", "Kurrat", "Kwadwo", "Köpernick", "Kühnert", "Lammert",
      "Lauckner", "Leberer", "Leiter", "Leo", "Leyckes", "Liebold", "Linnenbaum", "Lohmann", "Lott", "Löser",
      "Mai", "Manz", "Marschek", "Mathies", "Mauroff", "Mensah", "Mewes", "Mintzlaff", "Mohrhard", "Morgenstern",
      "Mues", "Möhsner", "Münch", "Naumann", "Neumair", "Niedermeier", "Norris", "Oberem", "Oppong", "Otte",
      "Patzwahl", "Pfersich", "Pingpank", "Plauk", "Pohland", "Porth", "Pressler", "Pöge", "Ranz", "Rehwagen",
      "Reinberg", "Reppin", "Reuss", "Rieger", "Ringel", "Rittweg", "Rohländer", "Rose", "Roth", "Ryzih",
      "Rüter", "Sailer", "Sattelmaier", "Schaffarzik", "Schenk", "Scheytt", "Schirmer", "Schlitzer", "Schmuhl", "Schonberg",
      "Schreck", "Schuff", "Schwanbeck", "Schwarzkopf", "Schwuchow", "Schönberg", "Schüler", "Seidel", "Siebel", "Siewert"
    ]
  },
  // 法语
  fr: {
    firstNames: [
      "Jean", "Pierre", "Michel", "André", "Philippe", "Marie", "Jeanne", "Françoise", "Monique", "Catherine",
      "Lucas", "Hugo", "Louis", "Gabriel", "Emma", "Léa", "Chloé", "Manon", "Camille", "Jade",
      "Arthur", "Nathan", "Jules", "Antoine", "Tom", "Louise", "Sarah", "Inès", "Juliette", "Zoé",
      "Raphaël", "Noah", "Théo", "Baptiste", "Pauline", "Lucie", "Eva", "Margaux", "Anaïs", "Clara",
      "Aaron", "Abelin", "Abélard", "Achille", "Adalbéron", "Adel", "Adenet", "Adonis", "Agathange", "Agnan",
      "Alain", "Alcibiade", "Aldonce", "Alexis", "Almine", "Alphée", "Amandin", "Amiel", "Anastase", "Andoche",
      "Ange", "Anicet", "Anselme", "Arcade", "Arian", "Aristide", "Arnaud", "Arsinoé", "Arthème", "Audebert",
      "Auguste", "Axel", "Balthazar", "Barthélemy", "Baudouin", "Bertrand", "Bon", "Brice", "Béranger", "Caribert",
      "Cassien", "Chilpéric", "Chrysole", "Clarence", "Clovis", "Colin", "Constantin", "Cyrille", "Célien", "Côme",
      "Delphin", "Dimitri", "Désiré", "Enguerrand", "Eudes", "Eusèbe", "Fantin", "Fidèle", "Florent", "Foulques",
      "Frédéric", "Félicité", "Garnier", "Gaston", "Gaël", "Germain", "Gilbert", "Gondebaud", "Gonzague", "Gustave",
      "Gédéon", "Hardouin", "Herluin", "Hincmar", "Hubert", "Innocent", "Japhet", "Jeannel", "Job", "Jonathan",
      "Josselin", "Judicaël", "Juste", "Lambert", "Leu", "Lionel", "Lothaire", "Luc", "Ludolphe", "Léonard",
      "Mamert", "Marceau", "Martial", "Matthieu", "Maxence", "Melchior", "Michaël", "Médéric", "Nathanaël", "Nicolas",
      "Noé", "Odilon", "Olivier", "Parfait", "Paul", "Quentin", "Reybaud", "Roch", "Roland", "Ronan",
      "Réjean", "Sauveur", "Serge", "Sigismond", "Stanislas", "Sébastien", "Tancrède", "Thibert", "Théodose", "Tim",
      "Tonnin", "Tristan", "Valentin", "Venceslas", "Victorien", "Vital", "Xavier", "Yves", "Édouard", "Élzéar",
      "Épiphane", "Évrard", "Abigaelle", "Adalbaude", "Adeltrude", "Adrastée", "Adélaïde", "Aglaé", "Agnès", "Alaïs",
      "Alcidie", "Aldegonde", "Alexine", "Alix", "Aloyse", "Amaliane", "Amandine", "Amaryllis", "Aminte", "Améthyste",
      "Angeline", "Angélina", "Annabelle", "Ansberte", "Antigone", "Aphélie", "Arcadie", "Ariane", "Arlette", "Armandine",
      "Armine", "Arthurine", "Ascension", "Astrée", "Athina", "Aubertine", "Augustine", "Aurore", "Auxane", "Axeline",
      "Azalée", "Barbe", "Berthe", "Beuve", "Brunehaut", "Bérangère", "Carine", "Chantal", "Christine", "Claude",
      "Clélie", "Coline", "Coraline", "Cécile", "Céline", "Denise", "Dominique", "Douce", "Elsa", "Emmelie",
      "Eudoxie", "Eusébie", "Fantine", "Flore", "France", "Francine", "Gabrielle", "Georgette", "Gertrude", "Guillemette",
      "Henriette", "Hortense", "Irène", "Ismérie", "Janine", "Jehanne", "Judith", "Justine", "Laure", "Laurine",
      "Lucienne", "Lydie", "Léonne", "Magali", "Marianne", "Marion", "Mathilde", "Maxellende", "Mireille", "Moïsette"
    ],
    lastNames: [
      "Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent",
      "Simon", "Michel", "Lefebvre", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard",
      "Andre", "Mercier", "Dupont", "Lambert", "Bonnet", "Francois", "Martinez", "Legrand", "Garnier", "Faure",
      "Rousseau", "Blanc", "Henry", "Chevalier", "Muller", "Perrin", "Morin", "Mathieu", "Clement", "Gauthier",
      "Adam", "Arnaud", "Aubert", "Aubry", "Barbier", "Baron", "Barre", "Benoit", "Berger", "Blanchard",
      "Bourgeois", "Boyer", "Breton", "Brun", "Brunet", "Caron", "Carpentier", "Carre", "Charles", "Charpentier",
      "Colin", "Collet", "Cousin", "Da silva", "Denis", "Deschamps", "Dufour", "Dumas", "Dumont", "Dupuis",
      "Dupuy", "Duval", "Fabre", "Fernandez", "Fleury", "Fontaine", "Gaillard", "Garcia", "Gautier", "Gerard",
      "Giraud", "Gonzalez", "Guerin", "Guillaume", "Guillot", "Guyot", "Hubert", "Huet", "Jacquet", "Jean",
      "Joly", "Julien", "Lacroix", "Laine", "Le gall", "Le roux", "Leclerc", "Leclercq", "Lecomte", "Lefevre",
      "Lemaire", "Lemoine", "Leroux", "Lopez", "Louis", "Lucas", "Maillard", "Marchal", "Marchand", "Marie",
      "Marty", "Masson", "Menard", "Meunier", "Meyer", "Moulin", "Nguyen", "Nicolas", "Noel", "Olivier",
      "Paris", "Paul", "Perez", "Perrot", "Philippe", "Picard", "Pierre", "Poirier", "Pons", "Prevost",
      "Remy", "Renard", "Renaud", "Renault", "Rey", "Riviere", "Robin", "Roche", "Rodriguez", "Roger",
      "Rolland", "Roussel", "Roy", "Royer", "Sanchez", "Schmitt", "Schneider", "Vasseur", "Vidal", "Vincent"
    ]
  },
  // 俄语（转写）
  ru: {
    firstNames: [
      "Alexander", "Dmitri", "Maxim", "Artem", "Ivan", "Anastasia", "Maria", "Daria", "Anna", "Sophia",
      "Mikhail", "Nikita", "Andrei", "Sergei", "Alexei", "Ekaterina", "Olga", "Natalia", "Elena", "Irina",
      "Vladimir", "Kirill", "Pavel", "Roman", "Denis", "Tatiana", "Veronika", "Polina", "Alina", "Yulia",
      "Fedor", "Ilya", "Konstantin", "Oleg", "Stepan", "Ksenia", "Vera", "Ludmila", "Galina", "Svetlana",
      "Aleksandr", "Nikolai", "Anton", "Maksim", "Igor", "Evgeni", "Egor", "Daniil", "Boris", "Yuri",
      "Grigori", "Timofei", "Gleb", "Matvei", "Fyodor", "Pyotr", "Vasili", "Leonid", "Stanislav", "Vladislav",
      "Yaroslav", "Georgi", "Anatoli", "Valeri", "Vyacheslav", "Arkadi", "Semyon", "Ruslan", "Sofia", "Marina",
      "Varvara", "Elizaveta", "Viktoria", "Margarita", "Nadezhda", "Lyudmila", "Nina", "Larisa", "Tamara", "Valentina",
      "Antonina", "Lidia", "Zhanna", "Inna", "Karina", "Diana", "Oksana", "Regina", "Yana", "Kristina",
      "Alla", "Zoya", "Raisa", "Vasilisa", "Milana", "Eva"
    ],
    lastNames: [
      "Ivanov", "Smirnov", "Kuznetsov", "Popov", "Vasiliev", "Petrov", "Sokolov", "Mikhailov", "Novikov", "Fedorov",
      "Morozov", "Volkov", "Alexeev", "Lebedev", "Semenov", "Egorov", "Pavlov", "Kozlov", "Stepanov", "Nikolaev",
      "Orlov", "Andreev", "Makarov", "Nikitin", "Zakharov", "Soloviev", "Borisov", "Yakovlev", "Grigoriev", "Romanov",
      "Vorobyev", "Danilov", "Tarasov", "Belov", "Komarov", "Kiselev", "Mironov", "Bogdanov", "Vinogradov", "Gerasimov",
      "Abramov", "Avdeev", "Agafonov", "Aksenov", "Aleksandrov", "Alekseev", "Anisimov", "Artemev", "Arkhipov", "Afanasev",
      "Baranov", "Belozerov", "Belousov", "Belyakov", "Bespalov", "Biryukov", "Blinov", "Blokhin", "Bobrov", "Bobylev",
      "Bolshakov", "Bragin", "Burov", "Bykov", "Vasilev", "Veselov", "Vladimirov", "Vlasov", "Vorobev", "Voronov",
      "Vorontsov", "Gavrilov", "Golubev", "Gorbachev", "Gorbunov", "Gordeev", "Gorshkov", "Grigorev", "Gromov", "Gulyaev",
      "Gurev", "Gusev", "Gushchin", "Davydov", "Dementev", "Dmitriev", "Doronin", "Dorofeev", "Drozdov", "Dyachkov",
      "Evdokimov", "Evseev", "Eliseev", "Emelyanov", "Ermakov", "Ershov", "Efimov", "Efremov", "Zhdanov", "Zhuravlev",
      "Zaytsev", "Zimin", "Zinovev", "Zuev", "Zykov", "Ignatev", "Ilin", "Isaev", "Isakov", "Kabanov",
      "Kazakov", "Kalashnikov", "Kapustin", "Karpov", "Kirillov", "Knyazev", "Kovalev", "Kolobov", "Komissarov", "Kondratev",
      "Konovalov", "Kononov", "Konstantinov", "Kopylov", "Korolev", "Kostin", "Kotov", "Koshelev", "Krasilnikov", "Krylov",
      "Kryukov", "Kudryashov", "Kuzmin", "Kulagin", "Kulakov", "Kulikov", "Lavrentev", "Lapin", "Larionov", "Likhachev",
      "Lobanov", "Loginov", "Lukin", "Lytkin", "Maksimov", "Mamontov", "Markov", "Martynov", "Maslov", "Matveev",
      "Medvedev", "Merkushev", "Mikhaylov", "Mikheev", "Mishin", "Moiseev", "Molchanov", "Muravev", "Mukhin", "Myasnikov",
      "Nazarov", "Naumov", "Nekrasov", "Nesterov", "Nikonov", "Noskov", "Nosov", "Ovchinnikov", "Odintsov", "Osipov",
      "Panov", "Panfilov", "Pakhomov", "Pestov", "Petukhov", "Polyakov", "Ponomarev", "Potapov", "Prokhorov", "Rogov",
      "Rodionov", "Rusakov", "Rybakov", "Ryabov", "Savelev", "Savin", "Sazonov", "Samsonov", "Safonov", "Seleznev",
      "Seliverstov", "Sergeev", "Sidorov", "Simonov", "Sitnikov", "Sobolev", "Solovev", "Sorokin", "Subbotin", "Suvorov",
      "Sukhanov", "Sysoev", "Terentev", "Teterin", "Titov", "Tikhonov", "Tretyakov", "Trofimov", "Turov", "Uvarov",
      "Ustinov", "Fedoseev", "Fedotov", "Filatov", "Filippov", "Fokin", "Fomin", "Fomichev", "Kharitonov", "Khokhlov"
    ]
  },
  // 西班牙语
  es: {
    firstNames: [
      "Antonio", "José", "Manuel", "Francisco", "David", "María", "Carmen", "Ana", "Isabel", "Laura",
      "Pablo", "Daniel", "Alejandro", "Carlos", "Javier", "Lucia", "Marta", "Paula", "Sara", "Elena",
      "Diego", "Adrián", "Sergio", "Raúl", "Álvaro", "Sofía", "Valeria", "Julia", "Claudia", "Andrea",
      "Mateo", "Hugo", "Iker", "Marcos", "Nicolás", "Noa", "Alba", "Aitana", "Emma", "Vega",
      "Adán", "Agustín", "Alberto", "Alfonso", "Alfredo", "Andrés", "Armando", "Arturo", "Benito", "Benjamín",
      "Bernardo", "Carles", "Claudio", "Clemente", "Cristián", "Cristóbal", "César", "Eduardo", "Emilio", "Enrique",
      "Ernesto", "Esteban", "Federico", "Felipe", "Fernando", "Gabriel", "Gerardo", "Germán", "Gilberto", "Gonzalo",
      "Gregorio", "Guillermo", "Gustavo", "Hermenegildo", "Hernán", "Homero", "Horacio", "Ignacio", "Iván", "Jacobo",
      "Jaime", "Jerónimo", "Jesús", "Joaquín", "Jordi", "Jorge", "Jorge Luis", "Josep", "José Eduardo", "José Emilio",
      "José Luis", "José María", "Juan", "Juan Carlos", "Juan Ramón", "Julio", "Julio César", "Lorenzo", "Lucas", "Luis",
      "Luis Miguel", "Marco Antonio", "Mariano", "Mario", "Martín", "Miguel", "Miguel Ángel", "Octavio", "Patricio", "Pedro",
      "Pío", "Rafael", "Ramiro", "Ramón", "Ricardo", "Roberto", "Rodrigo", "Rubén", "Salvador", "Samuel",
      "Sancho", "Santiago", "Sergi", "Teodoro", "Timoteo", "Tomás", "Vicente", "Víctor", "Ángel", "Óscar",
      "Adela", "Adriana", "Alejandra", "Alicia", "Amalia", "Ana Luisa", "Ana María", "Anita", "Anni", "Antonia",
      "Ariadna", "Barbara", "Beatriz", "Berta", "Blanca", "Caridad", "Carla", "Carlota", "Carolina", "Catalina",
      "Cecilia", "Clara", "Concepción", "Conchita", "Cristina", "Daniela", "Diana", "Dolores", "Dorotea", "Débora",
      "Elisa", "Eloisa", "Elsa", "Elvira", "Emilia", "Esperanza", "Estela", "Ester", "Eva", "Florencia",
      "Francisca", "Gabriela", "Gloria", "Graciela", "Guadalupe", "Guillermina", "Inés", "Irene", "Isabela", "Jennifer",
      "Josefina", "Juana", "Leonor", "Leticia", "Lilia", "Lola", "Lorena", "Lourdes", "Lucía", "Luisa",
      "Luz", "Magdalena", "Maica", "Manuela", "Marcela", "Margarita", "Mariana", "Maricarmen", "Marilú", "Marisol",
      "María Cristina", "María Elena", "María Eugenia", "María José", "María Luisa", "María Soledad", "María Teresa", "María de los Ángeles", "María del Carmen", "Matilde",
      "Mayte", "Mercedes", "Micaela", "Mónica", "Natalia", "Norma", "Olivia", "Patricia", "Pilar", "Ramona",
      "Raquel", "Rebeca", "Reina", "Rocío", "Rosa", "Rosalia", "Rosario", "Roser", "Silvia", "Soledad",
      "Sonia", "Susana", "Teresa", "Verónica", "Victoria", "Virginia", "Yolanda", "Ángela"
    ],
    lastNames: [
      "García", "Fernandez", "Gonzalez", "Rodriguez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin",
      "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Alvarez", "Muñoz", "Romero", "Alonso", "Gutierrez",
      "Navarro", "Torres", "Dominguez", "Vazquez", "Ramos", "Gil", "Ramirez", "Serrano", "Blanco", "Molina",
      "Morales", "Suarez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marin", "Sanz", "Iglesias",
      "Abeyta", "Abreu", "Acuña", "Agosto", "Aguilera", "Alaníz", "Alcalá", "Alcántar", "Alfaro", "Almaráz",
      "Alonzo", "Alvarado", "Anaya", "Angulo", "Aponte", "Araña", "Arellano", "Argüello", "Armendáriz", "Armijo",
      "Arriaga", "Atencio", "Baca", "Bahena", "Banda", "Barragán", "Barrera", "Barrios", "Becerra", "Benavídez",
      "Bernal", "Borrego", "Briones", "Bueno", "Bustos", "Cabrera", "Caldera", "Calvillo", "Campos", "Cano",
      "Carbajal", "Carranza", "Carrera", "Carrillo", "Carvajal", "Casarez", "Castañeda", "Ceballos", "Centeno", "Cerda",
      "Chacón", "Chávez", "Collado", "Colón", "Cordero", "Corona", "Corrales", "Cortéz", "Crespo", "Curiel",
      "Delacrúz", "Delagarza", "Delarosa", "Delgadillo", "Delvalle", "Dueñas", "Díaz", "Enríquez", "Escamilla", "Esparza",
      "Espinosa", "Esquibel", "Estévez", "Feliciano", "Ferrer", "Flores", "Frías", "Galarza", "Gallegos", "Gaona",
      "Garrido", "Gaytán", "Godoy", "Gracia", "Griego", "Guardado", "Guerrero", "Gurule", "Gálvez", "Haro",
      "Hernández", "Hinojosa", "Huerta", "Jaimes", "Jiménez", "Jáquez", "Laureano", "Lebrón", "Lemus", "León",
      "Lira", "Lomeli", "Loya", "Lozano", "Luevano", "López", "Madrid", "Magaña", "Manzanares", "Marroquín",
      "Marín", "Mateo", "Maya", "Medrano", "Meléndez", "Mendoza", "Meraz", "Mesa", "Miranda", "Montalvo",
      "Montemayor", "Montero", "Montéz", "Munguía", "Muñiz", "Méndez", "Nava", "Negrón", "Nieves", "Nájera",
      "Ocasio", "Olivares", "Olivera", "Olmos", "Oquendo", "Ornelas", "Orta", "Osorio", "Ozuna", "Padilla",
      "Palacios", "Pantoja", "Partida", "Pedraza", "Pelayo", "Perea", "Pineda", "Polanco", "Portillo", "Preciado",
      "Puga", "Páez", "Quezada", "Quintero", "Quiñónez", "Ramírez", "Raya", "Regalado", "Reséndez", "Reynoso",
      "Riojas", "Rivero", "Rocha", "Rodríguez", "Roldán", "Romo", "Rosales", "Roybal", "Ruíz", "Saiz",
      "Salazar", "Saldaña", "Salinas", "Sandoval", "Santiago", "Sauceda", "Sedillo", "Sepúlveda", "Serrato", "Sisneros"
    ]
  },
  // 意大利语
  it: {
    firstNames: [
      "Luca", "Marco", "Matteo", "Francesco", "Giovanni", "Andrea", "Alessandro", "Gabriele", "Davide", "Riccardo",
      "Giulia", "Sofia", "Aurora", "Ginevra", "Alice", "Emma", "Martina", "Chiara", "Francesca", "Elena",
      "Tommaso", "Leonardo", "Samuele", "Federico", "Pietro", "Beatrice", "Noemi", "Vittoria", "Camilla", "Irene",
      "Abaco", "Abenzio", "Achille", "Adalfredo", "Adelchi", "Adone", "Agazio", "Aidano", "Alberico", "Alceste",
      "Aleardo", "Alfredo", "Alviero", "Amato", "Amelio", "Amore", "Aniceto", "Antero", "Apollinare", "Archimede",
      "Argimiro", "Aristarco", "Aristotele", "Ascanio", "Ataleo", "Audace", "Azeglio", "Baldomero", "Barsimeo", "Bastiano",
      "Benigno", "Beronico", "Birino", "Bonito", "Caino", "Camillo", "Caronte", "Cataldo", "Cherubino", "Cirino",
      "Cleonico", "Colombano", "Coriolano", "Costantino", "Crispino", "Daciano", "Damocle", "Davino", "Deodato", "Diodoro",
      "Divo", "Doriano", "Edgardo", "Egeo", "Elifio", "Elmo", "Emiliano", "Enecone", "Erasmo", "Erico",
      "Ernesto", "Euclide", "Eustorgio", "Evasio", "Fabiano", "Fermo", "Filippo", "Fleano", "Frido", "Furseo",
      "Galdino", "Gaspare", "Geminiano", "Gerardo", "Geronzio", "Giacomo", "Gianluca", "Gianpiero", "Gillo", "Gioele",
      "Giosuè", "Girolamo", "Giusto", "Gonzaga", "Graziano", "Guglielmo", "Iacopo", "Igino", "Illidio", "Ippocrate",
      "Ismaele", "Ivone", "Laurentino", "Leo", "Leopoldo", "Liberto", "Livio", "Luciano", "Maffeo", "Mancio",
      "Marcello", "Marolo", "Mattia", "Melchiade", "Mennone", "Minervino", "Monaldo", "Narciso", "Nazzaro", "Nicea",
      "Nicola", "Nunzio", "Olindo", "Onorio", "Orlando", "Osvaldo", "Pacifico", "Pancrazio", "Parmenio", "Peleo",
      "Pierluigi", "Pippo", "Pollione", "Porziano", "Procopio", "Pupolo", "Quintino", "Raide", "Regolo", "Ricario",
      "Roberto", "Romano", "Rosario", "Sabato", "Saladino", "Sandro", "Saturniano", "Secondo", "Serapione", "Severiano",
      "Sigfrido", "Simone", "Siro", "Sosteneo", "Stiliano", "Tammaro", "Telemaco", "Teogene", "Tiburzio", "Tizio",
      "Tristano", "Ubaldo", "Ulderico", "Ultimo", "Ursicio", "Valerio", "Vasco", "Ventura", "Verulo", "Vincenzo",
      "Virginio", "Vittoriano", "Volfango", "Zanobi", "Zenobio", "Ada", "Adele", "Agnese", "Alda", "Alida",
      "Amata", "Ancilla", "Annagrazia", "Antonia", "Armida", "Atanasia", "Azelia", "Basilia", "Beniamina", "Bianca",
      "Calogera", "Carla", "Casilda", "Celeste", "Claudia", "Clorinda", "Cordelia", "Cristina", "Dalida", "Degna",
      "Deodata", "Diletta", "Domenica", "Dulina", "Egle", "Eliana", "Eloisa", "Emiliana", "Ermenegilda", "Ester",
      "Eusebia", "Fabiola", "Fernanda", "Fiorella", "Floridia", "Geltrude", "Ghita", "Giuditta", "Giusta", "Graziella",
      "Ianira", "Ildegonda", "Immacolata", "Ione", "Irmina", "Ivetta", "Lelia", "Liana", "Linda", "Lorella",
      "Lucia", "Luisa", "Maida", "Margherita", "Marinella", "Maruta", "Melitina", "Milena", "Miriam", "Nadia"
    ],
    lastNames: [
      "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco",
      "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti",
      "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
      "Abate", "Acquaviva", "Agostini", "Alfano", "Ambrosino", "Andreoli", "Anselmo", "Aquino", "Ascione", "Baiocco",
      "Ballarin", "Barbera", "Baroni", "Basile", "Bellini", "Benatti", "Berardi", "Bertelli", "Biagi", "Biggi",
      "Bocchi", "Bonelli", "Bordoni", "Boschetti", "Braia", "Brogi", "Bulgarelli", "Cacciatore", "Calandro", "Campana",
      "Cancelliere", "Cannone", "Capizzi", "Cappiello", "Carbone", "Caretti", "Carminati", "Carrozza", "Casale", "Casolaro",
      "Castiglioni", "Caterino", "Cavriani", "Celi", "Cerutti", "Chiavacci", "Ciavarella", "Cingolani", "Cipriano", "Cocco",
      "Como", "Contu", "Corrao", "Cosentino", "Coviello", "Crevatin", "Critelli", "Cusimano", "D'Amore", "D'Incà",
      "Damiano", "De Bonis", "De Feo", "De Marco", "De Sanctis", "Del Gaudio", "Denaro", "Di Benedetto", "Di Donato", "Di Giovanni",
      "Di Luca", "Di Mauro", "Di Rocco", "Diana", "Donato", "Durante", "Errichiello", "Fabiano", "Falzone", "Farina",
      "Fedele", "Ferracuti", "Ferraro", "Festa", "Finotti", "Fiorillo", "Fois", "Fortugno", "Franchini", "Frigerio",
      "Gabriele", "Gargiulo", "Gazzola", "Germani", "Giannetti", "Gigli", "Giovannelli", "Giuliani", "Granato", "Gruppuso",
      "Guerrini", "Gurrieri", "Iannello", "Indelicato", "Ippolito", "La Porta", "Lamberti", "Lavecchia", "Lenzi", "Lezzi",
      "Lipari", "Lo Iacono", "Loiacono", "Lorenzini", "Lucarini", "Lugli", "Luzzi", "Maggiore", "Malagoli", "Mancino",
      "Mannino", "Marangoni", "Marchetto", "Marega", "Marrone", "Martorana", "Masi", "Mastropietro", "Maugeri", "Mazzeo",
      "Mazzotti", "Melis", "Mercuri", "Miceli", "Milano", "Moccia", "Montagna", "Monterosso", "Morello", "Morreale",
      "Mulas", "Musso", "Natale", "Nicoletti", "Nobili", "Nucera", "Orefice", "Ottonello", "Pagano", "Palla",
      "Palumbo", "Paolella", "Paonessa", "Paris", "Pasini", "Pastorino", "Peaquin", "Pellegrini", "Perego", "Perrini",
      "Petrarca", "Piana", "Piccione", "Pilato", "Pircher", "Piscopo", "Pizzo", "Politi", "Porcu", "Preziosi",
      "Puddu", "Quinto", "Rampazzo", "Ravaioli", "Renzi", "Riggio", "Romani", "Ross", "Rotundo", "Saba",
      "Sacchi", "Salerno", "Salzano", "Santarossa", "Sartor", "Scaglione", "Scarpa", "Schirru", "Secchi", "Sergi"
    ]
  },
  // 葡萄牙语
  pt: {
    firstNames: [
      "Joao", "Gabriel", "Lucas", "Mateus", "Pedro", "Guilherme", "Rafael", "Bruno", "Diego", "Caio",
      "Maria", "Ana", "Julia", "Beatriz", "Larissa", "Camila", "Mariana", "Isabela", "Luiza", "Helena",
      "Thiago", "Vinicius", "Felipe", "Eduardo", "Arthur", "Yasmin", "Bianca", "Aline", "Patricia", "Renata",
      "Alessandro", "Alexandre", "Anthony", "Antônio", "Benjamin", "Benício", "Bernardo", "Breno", "Bryan", "Calebe",
      "Carlos", "Cauã", "César", "Daniel", "Danilo", "Davi", "Davi Lucca", "Deneval", "Elísio", "Emanuel",
      "Enzo", "Enzo Gabriel", "Fabiano", "Fabrício", "Feliciano", "Frederico", "Fábio", "Félix", "Gael", "Gustavo",
      "Gúbio", "Heitor", "Henrique", "Hugo", "Hélio", "Isaac", "Joaquim", "João", "João Lucas", "João Miguel",
      "João Pedro", "Júlio", "Júlio César", "Kléber", "Ladislau", "Leonardo", "Lorenzo", "Lucca", "Marcelo", "Marcos",
      "Matheus", "Miguel", "Murilo", "Nataniel", "Nicolas", "Noah", "Norberto", "Pablo", "Paulo", "Pedro Henrique",
      "Pietro", "Raul", "Ricardo", "Roberto", "Salvador", "Samuel", "Silas", "Sirineu", "Tertuliano", "Théo",
      "Vicente", "Vitor", "Víctor", "Warley", "Washington", "Yago", "Yango", "Yuri", "Ígor", "Alessandra",
      "Alice", "Alícia", "Ana Clara", "Ana Júlia", "Ana Laura", "Ana Luiza", "Antonella", "Bruna", "Carla", "Cecília",
      "Clara", "Célia", "Dalila", "Eduarda", "Elisa", "Eloá", "Emanuelly", "Esther", "Fabrícia", "Felícia",
      "Giovanna", "Heloísa", "Isabel", "Isabella", "Isabelly", "Isadora", "Isis", "Janaína", "Joana", "Júlia",
      "Karla", "Lara", "Laura", "Lavínia", "Liz", "Lorena", "Lorraine", "Lívia", "Maitê", "Manuela",
      "Marcela", "Margarida", "Maria Alice", "Maria Cecília", "Maria Clara", "Maria Eduarda", "Maria Helena", "Maria Júlia", "Maria Luiza", "Marina",
      "Marli", "Meire", "Melissa", "Morgana", "Márcia", "Mércia", "Natália", "Núbia", "Ofélia", "Paula",
      "Rafaela", "Rebeca", "Roberta", "Sara", "Sarah", "Sophia", "Suélen", "Sílvia", "Talita", "Valentina",
      "Vitória"
    ],
    lastNames: [
      "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira", "Rodrigues", "Almeida",
      "Nascimento", "Araujo", "Carvalho", "Gomes", "Martins", "Rocha", "Dias", "Ribeiro", "Barbosa", "Mendes",
      "Cardoso", "Teixeira", "Correia", "Monteiro", "Moreira", "Nunes", "Moura", "Freitas", "Machado", "Batista",
      "Albuquerque", "Barros", "Braga", "Franco", "Macedo", "Melo", "Moraes", "Nogueira", "Reis", "Saraiva",
      "Xavier", "Abreu", "Alves", "Amado", "Amaral", "Amorim", "Andrade", "Anjos", "Antunes", "Araújo",
      "Assunção", "Azevedo", "Baptista", "Borges", "Branco", "Brito", "Camacho", "Campos", "Carneiro", "Castro",
      "Coelho", "Cruz", "Cunha", "Domingues", "Esteves", "Falcão", "Faria", "Fernandes", "Fidélis", "Figueiredo",
      "Fonseca", "Fraga", "Furtado", "Garcia", "Gaspar", "Gonçalves", "Guerreiro", "Henriques", "Jesus", "Lacerda",
      "Leal", "Leite", "Lopes", "Loureiro", "Lourenço", "Lourinho", "Magalhães", "Maia", "Mariz", "Marques",
      "Matias", "Matos", "Medeiros", "Meireles", "Mesquita", "Miranda", "Morais", "Mota", "Neto", "Neves",
      "Nobre", "Oliva", "Pacheco", "Paiva", "Peixoto", "Pimentel", "Pinheiro", "Pinho", "Pinto", "Pires",
      "Queiroz", "Ramos", "Raposo", "Serra", "Simões", "Soares", "Sousa", "Sá", "Tavares", "Torres",
      "Valente", "Vaz", "Veiga", "Vicente", "Vieira"
    ]
  },
  // 荷兰语
  nl: {
    firstNames: [
      "Daan", "Sem", "Liam", "Noah", "Lucas", "Milan", "Levi", "Finn", "Bram", "Jesse",
      "Emma", "Sophie", "Julia", "Tess", "Mila", "Sara", "Nina", "Lotte", "Evi", "Anna",
      "Thijs", "Ruben", "Julian", "Max", "Pieter", "Maud", "Fleur", "Yara", "Roos", "Iris",
      "Aaron", "Abraham", "Adrian", "Aiden", "Alex", "Amir", "Antoni", "Armin", "Ayaz", "Bart",
      "Ben", "Benyamin", "Bo", "Bodhi", "Bowie", "Brenn", "Bruno", "Casper", "Christian", "Collin",
      "Damian", "Danilo", "Davi", "Dean", "Dex", "Dion", "Donny", "Duuk", "Eli", "Emir",
      "Evan", "Fabian", "Ferre", "Finnley", "Flynn", "Frenkie", "George", "Gijs", "Hamza", "Hugo",
      "Idris", "Ilyas", "Isaiah", "Jace", "Jacobus", "Jake", "Jamie", "Javi", "Jay", "Jaylen",
      "Jelle", "Jeppe", "Jim", "Joah", "Joep", "Johannes", "Jonathan", "Jordy", "Jort", "Joël",
      "Julius", "Justin", "Kaj", "Kayden", "Kenzo", "Kick", "Krijn", "Lasse", "Lenn", "Leonardo",
      "Lewis", "Liyam", "Lorenzo", "Luc", "Luka", "Lux", "Mace", "Malik", "Marcel", "Marius",
      "Martin", "Mats", "Matthijs", "Maxim", "Mehmet", "Merijn", "Michael", "Mik", "Milano", "Miran",
      "Mohammed", "Mozes", "Mustafa", "Naoufal", "Nick", "Nikodem", "Noam", "Nouri", "Noël", "Olivier",
      "Oskar", "Owen", "Philip", "Quinten", "Raff", "Ravi", "Rens", "Riff", "Robert", "Rowan",
      "Safouan", "Samuël", "Seb", "Sef", "Senn", "Sepp", "Siebe", "Silas", "Sjors", "Sten",
      "Sverre", "Teunis", "Thijmen", "Thomas", "Tijn", "Tobias", "Tomas", "Tuur", "Tymon", "Vic",
      "Vik", "Vinz", "William", "Xavi", "Yannick", "Yassir", "Youssef", "Zayd", "Zeyd", "Aaltje",
      "Adriana", "Alice", "Aliya", "Alyssa", "Amber", "Amy", "Annabel", "Ariana", "Asiya", "Aya",
      "Babette", "Benthe", "Bobbie", "Carmen", "Charlie", "Claire", "Daantje", "Danique", "Dewi", "Dina",
      "Doris", "Ela", "Elif", "Elisa", "Elizabeth", "Elodie", "Emily", "Esmée", "Evelien", "Evy",
      "Fardau", "Fayen", "Fem", "Fenne", "Fiep", "Flore", "Féline", "Giulia", "Hafsa", "Hanne",
      "Hira", "Inara", "Isabella", "Ivy", "Jacky", "Jaelynn", "Jana", "Jasmijn", "Jazz", "Jente",
      "Jesslynn", "Jinthe", "Jolie", "Josephine", "Jula", "Juliette", "Juul", "Kaylee", "Kenza", "Kim",
      "Lana", "Lauren", "Leah", "Lexie", "Liene", "Lilly", "Linde", "Lisanne", "Livia", "Liza",
      "Loa", "Lorena", "Lou", "Lucie", "Luus", "Maan", "Mae", "Mare", "Marit", "Marrit",
      "Medina", "Melina", "Merel", "Meyra", "Milana", "Milou", "Mirte", "Myrthe", "Neeltje", "Nika"
    ],
    lastNames: [
      "de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Janssen", "Visser", "Smit", "Meijer",
      "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer",
      "van der Meer", "Kok", "Jacobs", "Schouten", "de Wit", "Kuiper", "Postma", "Willems", "de Graaf", "van Beek",
      "Aalbers", "Bijl", "Blom", "Boer", "Bosch", "Bosman", "Cornelissen", "Corsten", "Dijkstra", "Driessen",
      "Evers", "Freriks", "Gerritsen", "Groen", "Groothuizen", "Hartman", "Hazes", "Hermans", "Hofman", "Huisman",
      "Jonker", "Klein", "Koning", "Kramer", "Kuijpers", "Kuypers", "Lubbers", "Maas", "Martens", "Meeuwis",
      "Meyer", "Mol", "Molenaar", "Moors", "Nijland", "Oosterhuis", "Peeters", "Poels", "Post", "Prinsen",
      "Rietman", "Ritsma", "Sanders", "Schipper", "Scholten", "Smeets", "Terlouw", "Timmermans", "Veenstra", "Verbeek",
      "Verhoeven", "Vermeulen", "Vink", "Wagenaar", "Willemsen", "Wolters", "Zijlstra", "Zuiderveld", "de Bruijn", "de Bruyn",
      "de Corte", "de Haan", "de Jonge", "de Koning", "de Lange", "de Leeuw", "de Nijs", "de Ruiter", "de Vos", "den Adel",
      "van Dam", "van Dongen", "van Doorn", "van Ginneken", "van Iersel", "van Loon", "van Veen", "van Vliet", "van Wijk", "van de Berg",
      "van de Brink", "van de Meer", "van de Pol", "van de Veen", "van de Velden", "van de Ven", "van de Wal", "van den Bosch", "van den Broek", "van den Heuvel",
      "van den Pol", "van den Velde", "van der Berg", "van der Heijden", "van der Heyden", "van der Horst", "van der Laan", "van der Linden", "van der Meulen", "van der Pol",
      "van der Velde", "van der Velden", "van der Ven", "van der Wal"
    ]
  },
};;

// 国家到语言映射
const COUNTRY_LANG_MAP = {
  'United States': 'en', 'United Kingdom': 'en', 'Canada': 'en', 'Australia': 'en', 'New Zealand': 'en',
  'India': 'en',
  'China': 'zh', 'Taiwan': 'zh', 'Hong Kong': 'zh', 'Singapore': 'zh',
  'Japan': 'ja',
  'South Korea': 'ko', 'Korea': 'ko',
  'Germany': 'de', 'Austria': 'de', 'Switzerland': 'de',
  'France': 'fr', 'Belgium': 'fr',
  'Russia': 'ru',
  'Spain': 'es', 'Mexico': 'es', 'Argentina': 'es', 'Colombia': 'es', 'Peru': 'es', 'Chile': 'es',
  'Italy': 'it',
  'Brazil': 'pt', 'Portugal': 'pt',
  'Netherlands': 'nl'
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

function generateUnitSuffix(country) {
  if (Math.random() <= 0.7) return '';

  switch (country) {
    case 'United States':
    case 'Canada':
      return `, Apt ${Math.floor(Math.random() * 900) + 100}`;
    case 'United Kingdom':
    case 'Australia':
      return `, Flat ${Math.floor(Math.random() * 80) + 1}`;
    case 'Singapore':
      return `, #${String(Math.floor(Math.random() * 30) + 2).padStart(2, '0')}-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
    case 'Hong Kong':
      return `, Flat ${randomChoice(['A', 'B', 'C', 'D'])}, ${Math.floor(Math.random() * 30) + 2}/F`;
    case 'China':
    case 'Taiwan':
      return `, Unit ${Math.floor(Math.random() * 20) + 1}`;
    case 'Japan':
      return `-${Math.floor(Math.random() * 20) + 1}`;
    case 'Germany':
    case 'France':
    case 'Spain':
    case 'Italy':
    case 'Netherlands':
      return `, ${Math.floor(Math.random() * 5) + 1}${randomChoice(['A', 'B', 'C', ''])}`;
    default:
      return `, Unit ${Math.floor(Math.random() * 200) + 1}`;
  }
}

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

// 姓名生成状态（用于避免短时间内重复）
const NAME_PICK_STATE = {
  first: Object.create(null),
  last: Object.create(null),
  recentFullNames: Object.create(null)
};
const NAME_FULLNAME_RECENT_LIMIT = 240;

// 姓名组合风格（按语言）
const NAME_STYLE_CONFIG = {
  en: {
    compoundFirstProbability: 0.07,
    hyphenFirstProbability: 0.06,
    middleInitialProbability: 0.15,
    compoundLastProbability: 0.08,
    hyphenLastProbability: 0.04,
    multiPartLastPrefixes: []
  },
  zh: {
    compoundFirstProbability: 0.22,
    twoCharGivenNameProbability: 0.62,
    compoundLastProbability: 0.0,
    hyphenFirstProbability: 0.0,
    hyphenLastProbability: 0.0
  },
  ja: {
    compoundFirstProbability: 0.0,
    compoundLastProbability: 0.0,
    hyphenFirstProbability: 0.0,
    hyphenLastProbability: 0.0
  },
  ko: {
    compoundFirstProbability: 0.14,
    compoundLastProbability: 0.0,
    hyphenFirstProbability: 0.0,
    hyphenLastProbability: 0.0
  },
  de: {
    compoundFirstProbability: 0.12,
    hyphenFirstProbability: 0.04,
    middleInitialProbability: 0.07,
    compoundLastProbability: 0.13,
    hyphenLastProbability: 0.05,
    multiPartLastPrefixes: ['von']
  },
  fr: {
    compoundFirstProbability: 0.18,
    hyphenFirstProbability: 0.12,
    middleInitialProbability: 0.06,
    compoundLastProbability: 0.14,
    hyphenLastProbability: 0.08,
    multiPartLastPrefixes: ['de', 'du']
  },
  ru: {
    compoundFirstProbability: 0.08,
    hyphenFirstProbability: 0.0,
    middleInitialProbability: 0.0,
    compoundLastProbability: 0.04,
    hyphenLastProbability: 0.02
  },
  es: {
    compoundFirstProbability: 0.05,
    hyphenFirstProbability: 0.04,
    middleInitialProbability: 0.04,
    compoundLastProbability: 0.52,
    hyphenLastProbability: 0.02,
    multiPartLastPrefixes: ['de', 'del']
  },
  it: {
    compoundFirstProbability: 0.06,
    hyphenFirstProbability: 0.05,
    middleInitialProbability: 0.06,
    compoundLastProbability: 0.28,
    hyphenLastProbability: 0.03,
    multiPartLastPrefixes: ['Di', 'De']
  },
  pt: {
    compoundFirstProbability: 0.05,
    hyphenFirstProbability: 0.04,
    middleInitialProbability: 0.05,
    compoundLastProbability: 0.64,
    hyphenLastProbability: 0.03,
    multiPartLastPrefixes: ['de', 'da', 'dos']
  },
  nl: {
    compoundFirstProbability: 0.10,
    hyphenFirstProbability: 0.03,
    middleInitialProbability: 0.05,
    compoundLastProbability: 0.20,
    hyphenLastProbability: 0.03,
    multiPartLastPrefixes: ['van', 'van der', 'de']
  }
};

// 按性别划分的常见名（用于提升真实度）
const NAME_GENDERED_FIRST_NAMES = {
  en: {
    male: [
      "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
      "Daniel", "Matthew", "Christopher", "Andrew", "Joshua", "Nicholas", "Ethan", "Benjamin", "Samuel", "Henry",
      "Liam", "Noah", "Logan", "Lucas", "Mason", "Jackson", "Aiden", "Owen", "Wyatt", "Caleb",
      "Aaron", "Adam", "Alan", "Alex", "Alfred", "Allen", "Amos", "Angelo", "Armando", "Arturo",
      "Barry", "Benny", "Bill", "Bob", "Bradford", "Brendan", "Brian", "Byron", "Cameron", "Carlton",
      "Cecil", "Chad", "Chester", "Clarence", "Clay", "Clifton", "Cody", "Corey", "Courtney", "Dallas",
      "Dana", "Darin", "Darren", "Daryl", "Dean", "Derrick", "Dexter", "Dominick", "Doug", "Drew",
      "Dwayne", "Ed", "Edmond", "Edward", "Elijah", "Emanuel", "Enrique", "Ernest", "Eugene", "Felipe",
      "Forrest", "Frank", "Fred", "Gabriel", "Gary", "George", "Gilbert", "Glenn", "Grant", "Guadalupe",
      "Guy", "Harvey", "Herman", "Howard", "Hugo", "Irvin", "Ismael", "Jack", "Jake", "Jan",
      "Javier", "Jeffery", "Jeremiah", "Jerome", "Jesus", "Jimmy", "Joel", "Johnnie", "Jonathan", "Jorge",
      "Julio", "Karl", "Ken", "Kent", "Kim", "Kyle", "Larry", "Lee", "Leonard", "Lester",
      "Lionel", "Lorenzo", "Luther", "Malcolm", "Marco", "Mario", "Marshall", "Marvin", "Merle", "Miguel",
      "Mitchell", "Nathan", "Neil", "Nick", "Norman", "Orlando", "Otis", "Patrick", "Percy", "Peter",
      "Preston", "Ramiro", "Randall", "Ray", "Rene", "Roderick", "Rogelio", "Roman", "Ronnie", "Roy"
    ],
    female: [
      "Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn",
      "Ella", "Scarlett", "Grace", "Chloe", "Lily", "Aria", "Zoey", "Natalie", "Hannah", "Layla",
      "Nora", "Riley", "Aubrey", "Addison", "Penelope", "Madison", "Victoria", "Stella", "Lucy", "Claire",
      "Ada", "Alberta", "Alice", "Alma", "Amber", "Ana", "Angelica", "Anita", "Anne", "Antonia",
      "Ashley", "Beatrice", "Bernice", "Beth", "Betty", "Blanca", "Bonnie", "Brenda", "Camille", "Carla",
      "Carole", "Casey", "Cathy", "Celia", "Cheryl", "Christine", "Connie", "Cynthia", "Darla", "Deanna",
      "Debra", "Denise", "Diane", "Dixie", "Doreen", "Ebony", "Eileen", "Elisa", "Ellen", "Elsie",
      "Erica", "Erma", "Estelle", "Eunice", "Faith", "Felicia", "Francis", "Gayle", "Georgia", "Ginger",
      "Gloria", "Harriet", "Heather", "Henrietta", "Ida", "Iris", "Jackie", "Jamie", "Jane", "Janie",
      "Jeanette", "Jeannie", "Jennifer", "Jill", "Joann", "Jodi", "Josefina", "Joyce", "Judith", "June",
      "Kari", "Katherine", "Katie", "Kayla", "Kellie", "Kristen", "Kristin", "Krystal", "Laura", "Laverne",
      "Lela", "Leslie", "Lillian", "Lindsey", "Lola", "Lorene", "Louise", "Lydia", "Lynne", "Madeline",
      "Mamie", "Margaret", "Marguerite", "Marianne", "Marjorie", "Marta", "Maryann", "May", "Melanie", "Melissa",
      "Michele", "Mindy", "Miriam", "Monica", "Myra", "Nancy", "Nellie", "Nicole", "Norma", "Ollie",
      "Pam", "Patricia", "Paula", "Pearl", "Phyllis", "Ramona", "Regina"
    ]
  },
  zh: {
    male: [
      "Wei", "Lei", "Ming", "Jun", "Hao", "Tao", "Peng", "Feng", "Qiang", "Bo",
      "Kai", "Bin", "Chao", "Dong", "Guang", "Jie", "Ke", "Ran", "Zhe", "Sheng",
      "Yong", "Xiang", "Guo", "Tian", "Zhong", "Yang", "Cheng", "Long", "Song", "Tong",
      "Zhi", "Zhuo", "Sen", "Liang", "Xing", "An", "Ping", "Wen", "Shuo", "Run",
      "Han", "Mao", "Shen", "Tang", "Xu", "Ye", "Duan", "Lu"
    ],
    female: [
      "Fang", "Jing", "Hua", "Xin", "Yan", "Lin", "Yun", "Ting", "Xuan", "Yu",
      "Jia", "Shan", "Rui", "Yue", "Ning", "Xiao", "Qin", "Lan", "Na", "Mei",
      "Yi", "Qian", "Xue", "Zhen", "Man", "Juan", "Ying", "Hong", "Meng", "Shu",
      "Ai", "Rong", "Dan", "Xia", "Yao", "Chun", "Fen", "Hui", "Lian", "Shuang",
      "Wan", "Ya"
    ]
  },
  ja: {
    male: [
      "Haruto", "Sota", "Yuto", "Riku", "Ren", "Takumi", "Kaito", "Hinata", "Sora", "Shota",
      "Daiki", "Kenta", "Ryota", "Sho", "Yuma", "Itsuki", "Kazuki", "Asahi", "Haruki", "Taichi",
      "Yuki", "Yuji", "Kazuya", "Tomoya", "Satoshi", "Daisuke", "Kenji", "Takuya", "Hiroshi", "Takeshi",
      "Takashi", "Yosuke", "Shun", "Sosuke", "Minato", "Yamato", "Taiyo", "Kakeru", "Shoma", "Hikaru",
      "Keisuke", "Shinichi", "Masato", "Akira", "Kohei", "Yusei"
    ],
    female: [
      "Sakura", "Hina", "Yui", "Mio", "Aoi", "Yuna", "Akari", "Mei", "Rin", "Koharu",
      "Ayaka", "Haruka", "Nanami", "Misaki", "Kana", "Mao", "Riko", "Noa", "Momoka", "Kokoro",
      "Yuzuki", "Sana", "Tsumugi", "Himari", "Yua", "Niko", "Keiko", "Yoko", "Naomi", "Sayaka",
      "Aya", "Mai", "Asuka", "Eri", "Mari", "Natsuki", "Hikari", "Chihiro", "Akane", "Rie",
      "Saori", "Mayu", "Kazuko", "Atsuko", "Emiko", "Yume", "Otoha"
    ]
  },
  ko: {
    male: [
      "Minho", "Jinho", "Junho", "Seungmin", "Jaemin", "Jihoon", "Dongwoo", "Sunwoo", "Hyunwoo", "Taeyang",
      "Seojun", "Eunwoo", "Yejun", "Wonho", "Minseok", "Seungwoo", "Sanghoon", "Jongho", "Byungjun", "Kyungmin",
      "Minjun", "Hajun", "Doyun", "Jihu", "Yeonwoo", "Woojin", "Sangmin", "Jaehyun", "Jungwoo", "Seokwoo",
      "Taehyung", "Myungsoo", "Joonho", "Junyoung", "Sungmin", "Donghyun", "Haneul", "Kihoon", "Juwon"
    ],
    female: [
      "Yuna", "Jiyeon", "Soojin", "Minjung", "Hana", "Yoojin", "Minji", "Soyeon", "Daeun", "Yerin",
      "Chaewon", "Jiwon", "Jisoo", "Seoyeon", "Hayoon", "Jiwoo", "Sujin", "Hyejin", "Ara", "Yeji",
      "Seoa", "Soeun", "Hajin", "Yeseo", "Seohyun", "Hyewon", "Dasom", "Nahyun", "Yebin", "Sohee",
      "Jisu", "Eunbi", "Seyeon", "Yoonseo", "Jua", "Seoin", "Chaeyun", "Jihyun", "Somyi", "Dayeon",
      "Jungyeon", "Mijoo", "Haerin"
    ]
  },
  de: {
    male: [
      "Maximilian", "Alexander", "Paul", "Leon", "Lukas", "Felix", "Jonas", "Tim", "David", "Finn",
      "Noah", "Elias", "Ben", "Julian", "Anton", "Moritz", "Niklas", "Simon", "Tobias", "Matteo",
      "Johannes", "Karl", "Aaron", "Adam", "Ahmed", "Alessandro", "Alfred", "Amon", "Andrew", "Armin",
      "Artur", "Baran", "Batuhan", "Benjamin", "Bent", "Bilal", "Boris", "Bryan", "Can", "Caspar",
      "Charlie", "Christoph", "Colin", "Connor", "Damian", "Danny", "Darren", "Dean", "Denny", "Domenic",
      "Dorian", "Eddi", "Efe", "Emil", "Emirhan", "Enrico", "Etienne", "Fabrice", "Ferdinand", "Finley",
      "Francesco", "Frederik", "Fynn", "Gerrit", "Giuliano", "Hagen", "Hans", "Hendrik", "Henrick", "Hugo",
      "Ilias", "Ismael", "Jack", "Jamal", "Jan", "Jannek", "Jano", "Jarne", "Jasper", "Jayson",
      "Jeremie", "Jesper", "Joe", "Jona", "Jonathan", "Joris", "Joseph", "Juan", "Juri", "Kaan",
      "Kenan", "Kerim", "Kim", "Klemens", "Koray", "Lasse", "Laurin", "Leif", "Lennart", "Lennox",
      "Leonard", "Leopold", "Levin", "Lian", "Linus", "Logan", "Louis", "Lucas", "Luis", "Maddox",
      "Maksim", "Marc", "Marek", "Mark", "Marlo", "Marvin", "Matis", "Matthias", "Maurice", "Merlin",
      "Mick", "Mike", "Mirac", "Mohammad", "Morten", "Nathan", "Nevio", "Nicolai", "Nikolas", "Noel",
      "Ole", "Oscar", "Patrick", "Pepe", "Philipp", "Pius", "Raik", "Raul", "Riccardo", "Rico",
      "Roman", "Ryan", "Sami", "Santino", "Sebastian", "Silas", "Sky", "Steve", "Sören", "Tammo"
    ],
    female: [
      "Emma", "Mia", "Hannah", "Sofia", "Anna", "Lena", "Laura", "Marie", "Lea", "Julia",
      "Clara", "Luisa", "Johanna", "Frieda", "Ella", "Emilia", "Paula", "Mila", "Nele", "Lina",
      "Katharina", "Theresa", "Aaliyah", "Ada", "Aimee", "Alessa", "Alexia", "Alica", "Alisa", "Aliyah",
      "Amalia", "Amelie", "Ana", "Angela", "Ann", "Annabelle", "Annelie", "Annika", "Arda", "Ashley",
      "Aurora", "Ayse", "Bianka", "Carla", "Carolina", "Catrin", "Celina", "Chantal", "Chayenne", "Christin",
      "Cora", "Daniela", "Delia", "Dina", "Eileen", "Elea", "Eliana", "Elisa", "Elli", "Emely",
      "Enie", "Estelle", "Evelina", "Fatima", "Felina", "Fine", "Fiona", "Franka", "Frida", "Gina",
      "Hailey", "Heidi", "Helin", "Hermine", "Ina", "Irem", "Isabella", "Jamie", "Janin", "Janne",
      "Jasmine", "Jenny", "Jette", "Joanna", "Jolin", "Jonah", "Josephin", "Joy", "Jule", "Julie",
      "Julina", "Karina", "Karoline", "Kathrin", "Kayra", "Kimberley", "Korinna", "Lana", "Laureen", "Leah",
      "Lee", "Leni", "Leona", "Leticia", "Lia", "Lilia", "Lilli", "Line", "Lisann", "Liz",
      "Lotta", "Luana", "Lucienne", "Luka", "Lydia", "Madita", "Magdalena", "Maja", "Malina", "Mareike",
      "Marina", "Marla", "Marlene", "Mary", "Matilda", "Maya", "Meike", "Melina", "Melissa", "Mette",
      "Mieke", "Milla", "Miray", "Monique", "Nancy", "Nathalie", "Nelli", "Nika", "Nina", "Olivia",
      "Paulina", "Philine", "Rania", "Rieke", "Ronja", "Sabrina", "Samantha", "Sandy", "Sarah", "Selma"
    ]
  },
  fr: {
    male: [
      "Jean", "Pierre", "Michel", "Andre", "Philippe", "Lucas", "Hugo", "Louis", "Gabriel", "Arthur",
      "Nathan", "Jules", "Antoine", "Tom", "Raphael", "Noah", "Theo", "Baptiste", "Mathis", "Maxime",
      "Adrien", "Aaron", "Abelin", "Absalon", "Achaire", "Adalbert", "Adam", "Adelin", "Adjutor", "Agathange",
      "Agrippin", "Alain", "Albéric", "Alcime", "Alexandre", "Alliaume", "Aloïs", "Alverède", "Amant", "Amour",
      "Anatole", "Andoche", "Ange", "Anicet", "Ansbert", "Antide", "Apollinaire", "Archange", "Ariel", "Armand",
      "Arnould", "Arsène", "Arthème", "Audebert", "Auguste", "Auxence", "Aymon", "Barnabé", "Basile", "Benjamin",
      "Blaise", "Boniface", "Brice", "Béranger", "Candide", "Cassien", "Childebert", "Christodule", "Chrétien", "Claudien",
      "Cléandre", "Colin", "Corentin", "Cyrille", "Célestin", "Côme", "David", "Didier", "Dorian", "Edmond",
      "Ernest", "Eugène", "Fabien", "Fantin", "Fidèle", "Florent", "Fortuné", "François", "Fulgence", "Gabin",
      "Gaspar", "Gaud", "Geoffroy", "Germain", "Gilles", "Gondebaud", "Gonzague", "Guillaume", "Guérin", "Géraud",
      "Henri", "Hilaire", "Hippolyte", "Hugues", "Isabeau", "Japhet", "Jeannel", "Joanny", "Jonas", "Josse",
      "Joël", "Julien", "Jérémie", "Landry", "Leufroy", "Liétald", "Lothaire", "Luc", "Ludolphe", "Léon",
      "Macaire", "Marc", "Marcelin", "Martin", "Maugis", "Melchior", "Médéric", "Nicolas", "Normand", "Néhémie",
      "Odon", "Pacôme", "Pascal", "Paul", "Philothée", "Pépin", "Raphaël", "René", "Robert", "Roger",
      "Romuald", "Roselin", "Rémi", "Savin", "Serge", "Sigismond", "Stanislas", "Sylvestre", "Séverin"
    ],
    female: [
      "Marie", "Jeanne", "Francoise", "Monique", "Catherine", "Emma", "Lea", "Chloe", "Manon", "Camille",
      "Jade", "Louise", "Sarah", "Ines", "Juliette", "Zoe", "Pauline", "Lucie", "Eva", "Margaux",
      "Anais", "Clara", "Abdonie", "Abigaïl", "Adalbaude", "Adeline", "Adonise", "Adrienne", "Adélie", "Aglaé",
      "Agnès", "Alaine", "Alberte", "Alcine", "Aleth", "Alexine", "Aline", "Aliénor", "Alphonsine", "Amalthée",
      "Amante", "Amaryllis", "Ameline", "Amélie", "Anatolie", "Anceline", "Angeline", "Angélina", "Anicée", "Annette",
      "Anstrudie", "Antoinette", "Aphélie", "Arabelle", "Argine", "Armance", "Armeline", "Armine", "Arsènie", "Asceline",
      "Astarté", "Astérie", "Athina", "Aubertine", "Audrey", "Aurelle", "Aurélie", "Aveline", "Axeline", "Aymonde",
      "Azélie", "Bathilde", "Bertille", "Blanche", "Brunehaut", "Bénédicte", "Capucine", "Cassandre", "Charlaine", "Chloé",
      "Christine", "Clarisse", "Clio", "Clémence", "Conception", "Coraline", "Cyrielle", "Célestine", "Daphné", "Diane",
      "Doriane", "Douce", "Ella", "Emmanuelle", "Estelle", "Eugénie", "Eusébie", "Fantine", "Fleur", "Florie",
      "Francette", "Françoise", "Gabrielle", "Geneviève", "Germaine", "Guenièvre", "Gustavine", "Hermine", "Hortense", "Hélène",
      "Iris", "Isabelle", "Jacinthe", "Janine", "Jehanne", "Joëlle", "Julie", "Laura", "Laureline", "Laurine",
      "Ludivine", "Léna", "Léopoldine", "Maguelone", "Marguerite", "Marine", "Marthe", "Maud", "Maxellende", "Mireille",
      "Morgane", "Mylène", "Mélisande", "Mélodie", "Nathalie", "Noémie", "Odette", "Olympe", "Oriande", "Ozanne",
      "Paulette", "Philippine", "Primerose", "Pulchérie", "Pénélope", "Quintia", "Raphaëlle", "Reine", "Rolande"
    ]
  },
  ru: {
    male: [
      "Alexander", "Dmitri", "Maxim", "Artem", "Ivan", "Mikhail", "Nikita", "Andrei", "Sergei", "Alexei",
      "Vladimir", "Kirill", "Pavel", "Roman", "Denis", "Fedor", "Ilya", "Konstantin", "Oleg", "Stepan",
      "Aleksandr", "Nikolai", "Anton", "Maksim", "Igor", "Evgeni", "Egor", "Daniil", "Boris", "Yuri",
      "Grigori", "Timofei", "Gleb", "Matvei", "Fyodor", "Pyotr", "Vasili", "Leonid", "Stanislav", "Vladislav",
      "Yaroslav", "Georgi", "Anatoli", "Valeri", "Vyacheslav", "Arkadi", "Semyon", "Ruslan"
    ],
    female: [
      "Anastasia", "Maria", "Daria", "Anna", "Sofia", "Ekaterina", "Olga", "Natalia", "Elena", "Irina",
      "Tatiana", "Veronika", "Polina", "Alina", "Yulia", "Ksenia", "Vera", "Ludmila", "Galina", "Svetlana",
      "Marina", "Varvara", "Elizaveta", "Viktoria", "Margarita", "Nadezhda", "Lyudmila", "Nina", "Larisa", "Tamara",
      "Valentina", "Antonina", "Lidia", "Zhanna", "Inna", "Karina", "Diana", "Oksana", "Regina", "Yana",
      "Kristina", "Alla", "Zoya", "Raisa", "Vasilisa", "Milana", "Eva"
    ]
  },
  es: {
    male: [
      "Antonio", "Jose", "Manuel", "Francisco", "David", "Pablo", "Daniel", "Alejandro", "Carlos", "Javier",
      "Diego", "Adrian", "Sergio", "Raul", "Alvaro", "Mateo", "Hugo", "Iker", "Marcos", "Nicolas",
      "Adán", "Agustín", "Alberto", "Alfonso", "Alfredo", "Andrés", "Armando", "Arturo", "Benito", "Benjamín",
      "Bernardo", "Carles", "Claudio", "Clemente", "Cristián", "Cristóbal", "César", "Eduardo", "Emilio", "Enrique",
      "Ernesto", "Esteban", "Federico", "Felipe", "Fernando", "Gabriel", "Gerardo", "Germán", "Gilberto", "Gonzalo",
      "Gregorio", "Guillermo", "Gustavo", "Hermenegildo", "Hernán", "Homero", "Horacio", "Ignacio", "Iván", "Jacobo",
      "Jaime", "Jerónimo", "Jesús", "Joaquín", "Jordi", "Jorge", "Jorge Luis", "Josep", "José", "José Eduardo",
      "José Emilio", "José Luis", "José María", "Juan", "Juan Carlos", "Juan Ramón", "Julio", "Julio César", "Lorenzo", "Lucas",
      "Luis", "Luis Miguel", "Marco Antonio", "Mariano", "Mario", "Martín", "Miguel", "Miguel Ángel", "Nicolás", "Octavio",
      "Patricio", "Pedro", "Pío", "Rafael", "Ramiro", "Ramón", "Raúl", "Ricardo", "Roberto", "Rodrigo",
      "Rubén", "Salvador", "Samuel", "Sancho", "Santiago", "Sergi", "Teodoro", "Timoteo", "Tomás", "Vicente",
      "Víctor", "Ángel", "Óscar"
    ],
    female: [
      "Maria", "Carmen", "Ana", "Isabel", "Laura", "Lucia", "Marta", "Paula", "Sara", "Elena",
      "Sofia", "Valeria", "Julia", "Claudia", "Andrea", "Noa", "Alba", "Aitana", "Emma", "Vega",
      "Adela", "Adriana", "Alejandra", "Alicia", "Amalia", "Ana Luisa", "Ana María", "Anita", "Anni", "Antonia",
      "Ariadna", "Barbara", "Beatriz", "Berta", "Blanca", "Caridad", "Carla", "Carlota", "Carolina", "Catalina",
      "Cecilia", "Clara", "Concepción", "Conchita", "Cristina", "Daniela", "Diana", "Dolores", "Dorotea", "Débora",
      "Elisa", "Eloisa", "Elsa", "Elvira", "Emilia", "Esperanza", "Estela", "Ester", "Eva", "Florencia",
      "Francisca", "Gabriela", "Gloria", "Graciela", "Guadalupe", "Guillermina", "Inés", "Irene", "Isabela", "Jennifer",
      "Josefina", "Juana", "Leonor", "Leticia", "Lilia", "Lola", "Lorena", "Lourdes", "Lucía", "Luisa",
      "Luz", "Magdalena", "Maica", "Manuela", "Marcela", "Margarita", "Mariana", "Maricarmen", "Marilú", "Marisol",
      "María", "María Cristina", "María Elena", "María Eugenia", "María José", "María Luisa", "María Soledad", "María Teresa", "María de los Ángeles", "María del Carmen",
      "Matilde", "Mayte", "Mercedes", "Micaela", "Mónica", "Natalia", "Norma", "Olivia", "Patricia", "Pilar",
      "Ramona", "Raquel", "Rebeca", "Reina", "Rocío", "Rosa", "Rosalia", "Rosario", "Roser", "Silvia",
      "Sofía", "Soledad", "Sonia", "Susana", "Teresa", "Verónica", "Victoria", "Virginia", "Yolanda", "Ángela"
    ]
  },
  it: {
    male: [
      "Luca", "Marco", "Matteo", "Francesco", "Giovanni", "Andrea", "Alessandro", "Gabriele", "Davide", "Riccardo",
      "Tommaso", "Leonardo", "Samuele", "Federico", "Pietro", "Giuseppe", "Nicolo", "Stefano", "Daniele", "Cristiano",
      "Abaco", "Abibo", "Acilio", "Adalrico", "Adelgardo", "Agabio", "Agrippa", "Alarico", "Alceo", "Aleandro",
      "Algiso", "Alvise", "Amatore", "Amico", "Anacleto", "Anselmo", "Antonello", "Aratone", "Aresio", "Aristarco",
      "Armando", "Asdrubale", "Athos", "Aurelio", "Baldassarre", "Bardomiano", "Basilio", "Benedetto", "Beronico", "Birino",
      "Boris", "Caio", "Canziano", "Cassiano", "Celso", "Cirano", "Cleandro", "Colmazio", "Coriolano", "Costantino",
      "Cristaldo", "Dagoberto", "Danio", "Demetrio", "Diego", "Dionigi", "Donato", "Ecclesio", "Egeo", "Elifio",
      "Elpidio", "Emmerico", "Enzo", "Ercole", "Ermete", "Ettore", "Euseo", "Evasio", "Fabiano", "Ferruccio",
      "Fiorenziano", "Fortunato", "Fulgenzio", "Gaglioffo", "Garimberto", "Gedeone", "Gerardo", "Geronzio", "Giambattista", "Gianmarco",
      "Gianuario", "Gioacchino", "Giorgio", "Giovenzio", "Giustiniano", "Gonerio", "Graziano", "Guiberto", "Iago", "Igor",
      "Indro", "Isaia", "Ivanoe", "Lanfranco", "Leandro", "Leopardo", "Liborio", "Lodovico", "Ludano", "Magno",
      "Manlio", "Marino", "Matroniano", "Medoro", "Meneo", "Minervino", "Monitore", "Narseo", "Neoterio", "Nicezio",
      "Norberto", "Odorico", "Onofrio", "Orio", "Osvaldo", "Pacifico", "Panfilo", "Pasquale", "Pericle", "Piersilvio",
      "Plutarco", "Ponzio", "Prisco", "Pupolo", "Quintino", "Raimondo", "Remigio", "Rodolfo", "Romoaldo", "Ruggero",
      "Saffiro", "Saturniano", "Secondo", "Sergio", "Severino", "Silverio", "Sireno", "Socrate", "Speranzio", "Taide"
    ],
    female: [
      "Giulia", "Sofia", "Aurora", "Ginevra", "Alice", "Emma", "Martina", "Chiara", "Francesca", "Elena",
      "Beatrice", "Noemi", "Vittoria", "Camilla", "Irene", "Valentina", "Greta", "Anna", "Marta", "Serena",
      "Abbondanza", "Adalgisa", "Adele", "Adriana", "Agostina", "Albina", "Alessia", "Alida", "Altea", "Amelia",
      "Ancilla", "Anita", "Annamaria", "Antonella", "Appia", "Armida", "Assunta", "Azelia", "Barbara", "Batilda",
      "Benedetta", "Berenice", "Bibiana", "Bruna", "Camelia", "Carina", "Carola", "Cassandra", "Cecilia", "Cinzia",
      "Clelia", "Cleopatra", "Colomba", "Cordelia", "Costanza", "Cronida", "Dalida", "Daria", "Delfina", "Demetria",
      "Devota", "Diletta", "Doda", "Donatella", "Dulina", "Editta", "Elaide", "Elettra", "Elisa", "Eloisa",
      "Emanuela", "Enimia", "Ermenegilda", "Esmeralda", "Eufemia", "Euridice", "Evangelina", "Fatima", "Felicia", "Filippa",
      "Fiorella", "Flora", "Foca", "Galatea", "Gemma", "Germana", "Giada", "Giorgia", "Giuliana", "Giusta",
      "Godiva", "Gundelinda", "Iginia", "Ildegonda", "Ilva", "Ines", "Ione", "Iris", "Isabella", "Italia",
      "Lavinia", "Lena", "Letizia", "Liboria", "Liliana", "Lodovica", "Lorenza", "Luce", "Lucrezia", "Luminosa",
      "Mafalda", "Mara", "Margherita", "Mariella", "Marisa", "Maruta", "Maura", "Menodora", "Michela", "Minerva",
      "Miriam", "Morena", "Neiva", "Nilde", "Nuccia", "Ofelia", "Olivia", "Onesta", "Oriana", "Orsolina",
      "Palladia", "Paola", "Perla", "Placida", "Priscilla", "Quartilla", "Raffaella", "Renata", "Roberta", "Rosa",
      "Rosanna", "Rossella", "Sabrina", "Santina", "Sebastiana", "Selene", "Silvana", "Smeralda", "Solange", "Stella"
    ]
  },
  pt: {
    male: [
      "Joao", "Gabriel", "Lucas", "Mateus", "Pedro", "Guilherme", "Rafael", "Bruno", "Diego", "Caio",
      "Thiago", "Vinicius", "Felipe", "Eduardo", "Arthur", "Henrique", "Vitor", "Rodrigo", "Leonardo", "André",
      "Alessandro", "Alexandre", "Anthony", "Antônio", "Benjamin", "Benício", "Bernardo", "Breno", "Bryan", "Calebe",
      "Carlos", "Cauã", "César", "Daniel", "Danilo", "Davi", "Davi Lucca", "Deneval", "Elísio", "Emanuel",
      "Enzo", "Enzo Gabriel", "Fabiano", "Fabrício", "Feliciano", "Frederico", "Fábio", "Félix", "Gael", "Gustavo",
      "Gúbio", "Heitor", "Hugo", "Hélio", "Isaac", "Joaquim", "João", "João Lucas", "João Miguel", "João Pedro",
      "Júlio", "Júlio César", "Kléber", "Ladislau", "Lorenzo", "Lucca", "Marcelo", "Marcos", "Matheus", "Miguel",
      "Murilo", "Nataniel", "Nicolas", "Noah", "Norberto", "Pablo", "Paulo", "Pedro Henrique", "Pietro", "Raul",
      "Ricardo", "Roberto", "Salvador", "Samuel", "Silas", "Sirineu", "Tertuliano", "Théo", "Vicente", "Víctor",
      "Warley", "Washington", "Yago", "Yango", "Yuri", "Ígor"
    ],
    female: [
      "Maria", "Ana", "Julia", "Beatriz", "Larissa", "Camila", "Mariana", "Isabela", "Luiza", "Helena",
      "Yasmin", "Bianca", "Aline", "Patricia", "Renata", "Carolina", "Gabriela", "Daniela", "Fernanda", "Amanda",
      "Alessandra", "Alice", "Alícia", "Ana Clara", "Ana Júlia", "Ana Laura", "Ana Luiza", "Antonella", "Bruna", "Carla",
      "Cecília", "Clara", "Célia", "Dalila", "Eduarda", "Elisa", "Eloá", "Emanuelly", "Esther", "Fabrícia",
      "Felícia", "Giovanna", "Heloísa", "Isabel", "Isabella", "Isabelly", "Isadora", "Isis", "Janaína", "Joana",
      "Júlia", "Karla", "Lara", "Laura", "Lavínia", "Liz", "Lorena", "Lorraine", "Lívia", "Maitê",
      "Manuela", "Marcela", "Margarida", "Maria Alice", "Maria Cecília", "Maria Clara", "Maria Eduarda", "Maria Helena", "Maria Júlia", "Maria Luiza",
      "Marina", "Marli", "Meire", "Melissa", "Morgana", "Márcia", "Mércia", "Natália", "Núbia", "Ofélia",
      "Paula", "Rafaela", "Rebeca", "Roberta", "Sara", "Sarah", "Sophia", "Suélen", "Sílvia", "Talita",
      "Valentina", "Vitória"
    ]
  },
  nl: {
    male: [
      "Daan", "Sem", "Liam", "Noah", "Lucas", "Milan", "Levi", "Finn", "Bram", "Jesse",
      "Thijs", "Ruben", "Julian", "Max", "Pieter", "Sven", "Jeroen", "Koen", "Niels", "Maarten",
      "Aaron", "Abel", "Adriaan", "Ahmet", "Aleksander", "Alparslan", "Anthony", "Arda", "Arthur", "Ayman",
      "Bas", "Benja", "Benyamin", "Bo", "Bobby", "Boris", "Brandon", "Bruce", "Cas", "Chris",
      "Coen", "Dani", "Dante", "Davi", "Dean", "Dex", "Dion", "Don", "Duco", "Eden",
      "Emin", "Eray", "Ezra", "Felix", "Filip", "Flip", "Fos", "Frenkie", "George", "Gijs",
      "Hamza", "Hidde", "Ibrahim", "Ilias", "Isaac", "Ivar", "Jack", "Jaimy", "Jakob", "Jan",
      "Javi", "Jay", "Jaylen", "Jelle", "Jeppe", "Jidde", "Jip", "Job", "Joey", "Jona",
      "Joost", "Joris", "Joseph", "Juda", "Julius", "Justin", "Kaj", "Kayden", "Kenji", "Kevin",
      "Klaas", "Kyano", "Leendert", "Lennox", "Lev", "Lex", "Loek", "Lou", "Luc", "Luka",
      "Luuk", "Maas", "Maher", "Manu", "Marijn", "Marley", "Mason", "Matteo", "Matz", "Maximilian",
      "Melle", "Mert", "Micha", "Miguel", "Mink", "Mohamed", "Morris", "Muhammed", "Mylo", "Natan",
      "Nico", "Nils", "Noam", "Nouri", "Noël", "Oliver", "Oscar", "Otto", "Peter", "Quin",
      "Rafael", "Raphael", "Rayen", "Reza", "Riff", "Robert", "Rowan", "Safouan", "Samuel", "Scott",
      "Sebastian", "Semih", "Sep", "Sev", "Siep", "Silvan", "Stan", "Steven", "Sverre", "Teunis"
    ],
    female: [
      "Emma", "Sophie", "Julia", "Tess", "Mila", "Sara", "Nina", "Lotte", "Evi", "Anna",
      "Maud", "Fleur", "Yara", "Roos", "Iris", "Noor", "Esmee", "Femke", "Ilse", "Anouk",
      "Aaliyah", "Abigail", "Aimée", "Alice", "Alisa", "Alya", "Amara", "Amelia", "Amy", "Asel",
      "Aurora", "Ayana", "Azra", "Bente", "Britt", "Cataleya", "Charlie", "Chloe", "Cornelia", "Dana",
      "Daphne", "Dewi", "Dieke", "Donna", "Eef", "Eleanor", "Elif", "Eline", "Eliza", "Ella",
      "Emilia", "Eva", "Famke", "Fatima", "Fayen", "Feline", "Femm", "Fien", "Filou", "Flore",
      "Freya", "Gioia", "Guusje", "Hailey", "Hayley", "Hidaya", "Imke", "Indy", "Isabeau", "Isabelle",
      "Iva", "Jackie", "Jada", "Jane", "Jasmijn", "Jaylinn", "Jazzlynn", "Jessie", "Jet", "Jinthe",
      "Johanna", "Josefien", "Joya", "Jule", "Juliëtte", "Juno", "Kato", "Keet", "Kiara", "Kira",
      "Laila", "Laure", "Layla", "Lenne", "Leyla", "Lien", "Liliana", "Lily", "Linne", "Lise",
      "Livia", "Liz", "Lizz", "Lois", "Lot", "Loua", "Loïs", "Lune", "Lynn", "Maartje",
      "Maeve", "Mara", "Marie", "Marlie", "Maryam", "Maxime", "Maysa", "Meike", "Melissa", "Meryem",
      "Mia", "Milana", "Milly", "Mira", "Myla", "Nadia", "Nela", "Nienke", "Nila", "Ninthe",
      "Noami", "Noortje", "Nore", "Nowi", "Noëlle", "Oumayra", "Pien", "Pleun", "Quinn", "Rana",
      "Romee", "Rosa", "Roxy", "Safa", "Salomë", "Sanne", "Sare", "Selma"
    ]
  },
};;

/**
 * 获取指定国家对应的语言
 */
function getLanguageForCountry(country) {
  const normalizedCountry = normalizeCountry(country);
  return COUNTRY_LANG_MAP[normalizedCountry] || 'en';
}

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 概率判断
 */
function chance(probability) {
  return Math.random() < probability;
}

/**
 * 归一化性别输入
 */
function normalizeGender(gender) {
  const value = String(gender || '').trim().toLowerCase();
  if (value === 'male' || value === 'female') return value;
  return null;
}

/**
 * 规范化用户名片段：转小写、去重音、去非字母数字
 */
function normalizeNameToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * 从姓名生成适合用户名/邮箱本地部分的 token
 */
function nameToUsernameToken(value) {
  const normalized = normalizeNameToken(value);
  return normalized || 'user';
}

/**
 * 获取语言对应姓名组合风格
 */
function getNameStyleConfig(lang) {
  return NAME_STYLE_CONFIG[lang] || NAME_STYLE_CONFIG.en;
}

/**
 * 获取指定语言+性别的名字池
 */
function getFirstNamePool(lang, gender, fallbackNames) {
  const langPool = NAME_GENDERED_FIRST_NAMES[lang];
  const normalizedGender = normalizeGender(gender);

  if (!langPool || !normalizedGender) {
    return fallbackNames;
  }

  const list = langPool[normalizedGender];
  if (Array.isArray(list) && list.length > 0) {
    return list;
  }

  return fallbackNames;
}

/**
 * 生成更自然的名字（双名、连字符、中间名首字母等）
 */
function composeFirstName(country, lang, firstNames, gender) {
  const style = getNameStyleConfig(lang);
  const normalizedCountry = normalizeCountry(country);
  const firstNamePool = getFirstNamePool(lang, gender, firstNames);
  const genderKey = normalizeGender(gender) || 'any';
  const base = pickNameFromBag('first', normalizedCountry, lang, firstNamePool, genderKey) || randomChoice(firstNamePool);
  if (!base) return 'Alex';

  // 中文：更常见双字名（以拼音方式展示）
  if (lang === 'zh') {
    if (chance(style.twoCharGivenNameProbability || 0)) {
      let second = pickNameFromBag('first', normalizedCountry, lang, firstNamePool, genderKey) || randomChoice(firstNamePool);
      if (second === base) {
        second = randomChoice(firstNamePool);
      }
      const merged = `${base}${second}`;
      return merged.length > 12 ? base : merged;
    }
    return base;
  }

  // 其他语言：复合名
  if (chance(style.compoundFirstProbability || 0)) {
    let second = pickNameFromBag('first', normalizedCountry, lang, firstNamePool, genderKey) || randomChoice(firstNamePool);
    if (!second) second = base;
    if (second === base) second = randomChoice(firstNamePool) || second;

    // 西语/意语/葡语/荷兰语更常见双姓而非双名，减少双名占比
    if (['es', 'it', 'pt', 'nl'].includes(lang) && chance(0.7)) {
      return base;
    }

    if (chance(style.hyphenFirstProbability || 0)) {
      return `${base}-${second}`;
    }
    return `${base} ${second}`;
  }

  // 可选中间首字母
  if (chance(style.middleInitialProbability || 0)) {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${base} ${letter}.`;
  }

  return base;
}

/**
 * 生成更自然的姓氏（双姓、前缀姓、连字符姓）
 */
function composeLastName(country, lang, lastNames) {
  const style = getNameStyleConfig(lang);
  const normalizedCountry = normalizeCountry(country);
  const base = pickNameFromBag('last', normalizedCountry, lang, lastNames) || randomChoice(lastNames);
  if (!base) return 'Smith';

  if (!chance(style.compoundLastProbability || 0)) {
    return base;
  }

  let second = pickNameFromBag('last', normalizedCountry, lang, lastNames) || randomChoice(lastNames);
  if (!second) second = base;
  if (second === base) second = randomChoice(lastNames) || second;

  if (chance(style.hyphenLastProbability || 0)) {
    return `${base}-${second}`;
  }

  const prefixes = style.multiPartLastPrefixes || [];
  if (prefixes.length > 0 && chance(0.52)) {
    const prefix = randomChoice(prefixes);
    return `${prefix} ${second}`;
  }

  // 西语/葡语地区：更常见双姓（父姓 + 母姓）
  if (lang === 'es' || lang === 'pt') {
    return `${base} ${second}`;
  }

  return `${base} ${second}`;
}

/**
 * 原地洗牌（Fisher-Yates）
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 从“洗牌池”中取姓名，确保池子用完前不重复
 */
function pickNameFromBag(type, country, lang, sourceNames, variantKey = '') {
  const normalizedCountry = normalizeCountry(country);
  const key = variantKey ? `${normalizedCountry}:${lang}:${variantKey}` : `${normalizedCountry}:${lang}`;
  const state = NAME_PICK_STATE[type];

  if (!state[key] || state[key].length === 0) {
    const uniqueNames = Array.from(new Set((sourceNames || []).filter(Boolean)));
    state[key] = shuffleArray(uniqueNames.slice());
  }

  if (!state[key] || state[key].length === 0) {
    return '';
  }

  return state[key].pop();
}

/**
 * 获取最近使用的全名队列
 */
function getRecentFullNameQueue(country) {
  const normalizedCountry = normalizeCountry(country);
  if (!NAME_PICK_STATE.recentFullNames[normalizedCountry]) {
    NAME_PICK_STATE.recentFullNames[normalizedCountry] = [];
  }
  return NAME_PICK_STATE.recentFullNames[normalizedCountry];
}

/**
 * 判断全名是否最近已使用
 */
function isRecentFullName(country, firstName, lastName) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim().toLowerCase();
  if (!fullName) return false;
  const queue = getRecentFullNameQueue(country);
  return queue.includes(fullName);
}

/**
 * 记录最近使用的全名
 */
function rememberFullName(country, firstName, lastName) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim().toLowerCase();
  if (!fullName) return;
  const queue = getRecentFullNameQueue(country);
  queue.push(fullName);
  if (queue.length > NAME_FULLNAME_RECENT_LIMIT) {
    queue.splice(0, queue.length - NAME_FULLNAME_RECENT_LIMIT);
  }
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

function randomDigitFrom(digits) {
  return digits[Math.floor(Math.random() * digits.length)];
}

/**
 * 生成随机名字
 */
function generateFirstName(country, gender = null) {
  const normalizedCountry = normalizeCountry(country);
  const lang = getLanguageForCountry(normalizedCountry);
  const names = NAME_DATABASE[lang] || NAME_DATABASE.en;
  return composeFirstName(normalizedCountry, lang, names.firstNames, gender);
}

/**
 * 生成随机姓氏
 */
function generateLastName(country) {
  const normalizedCountry = normalizeCountry(country);
  const lang = getLanguageForCountry(normalizedCountry);
  const names = NAME_DATABASE[lang] || NAME_DATABASE.en;
  return composeLastName(normalizedCountry, lang, names.lastNames);
}

/**
 * 生成姓名组合（带全名去重）
 */
function generateNamePair(country, gender = null) {
  const normalizedCountry = normalizeCountry(country);
  const maxAttempts = 8;

  for (let i = 0; i < maxAttempts; i++) {
    const firstName = generateFirstName(normalizedCountry, gender);
    const lastName = generateLastName(normalizedCountry);
    if (!isRecentFullName(normalizedCountry, firstName, lastName)) {
      rememberFullName(normalizedCountry, firstName, lastName);
      return { firstName, lastName };
    }
  }

  const firstName = generateFirstName(normalizedCountry, gender);
  const lastName = generateLastName(normalizedCountry);
  rememberFullName(normalizedCountry, firstName, lastName);
  return { firstName, lastName };
}

/**
 * 生成用户名
 */
function generateUsername(firstName, lastName) {
  const first = nameToUsernameToken(firstName);
  const last = nameToUsernameToken(lastName);
  const compactLast = last.replace(/[^a-z0-9]/g, '');
  const compactFirst = first.replace(/[^a-z0-9]/g, '');
  const styles = [
    () => `${first}${last}${randomDigits(2)}`,
    () => `${first}_${last}`,
    () => `${first}${randomDigits(4)}`,
    () => `${last}.${first}`,
    () => `${first[0] || 'u'}${last}${randomDigits(3)}`,
    () => `${compactFirst}.${compactLast}${randomDigits(2)}`,
    () => `${compactLast}${compactFirst[0] || 'u'}${randomDigits(3)}`,
    () => `${compactFirst}${compactLast}${randomDigits(3)}`
  ];
  const username = randomChoice(styles)();
  return username.length > 28 ? username.slice(0, 28) : username;
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

function normalizeCountryIfKnown(country) {
  if (!country) return null;
  if (COUNTRY_ALIASES[country]) {
    return COUNTRY_ALIASES[country];
  }
  if (COUNTRY_LANG_MAP[country]) {
    return country;
  }

  const lowerCountry = String(country).toLowerCase();
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
  return null;
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
function isLowQualityPhoneNumber(number, protectedPrefixLength = 0) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return true;

  const checkDigits = digits.slice(Math.max(0, protectedPrefixLength));
  if (!checkDigits) return true;

  if (/^(\d)\1+$/.test(checkDigits)) return true;
  if (/(?:1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999)/.test(checkDigits)) {
    return true;
  }
  if (/(\d)\1{3,}/.test(checkDigits)) return true;
  if (/^(\d{2,3})\1{2,}$/.test(checkDigits)) return true;

  let ascRun = 1;
  let descRun = 1;
  for (let i = 1; i < checkDigits.length; i++) {
    const prev = Number(checkDigits[i - 1]);
    const curr = Number(checkDigits[i]);

    ascRun = curr === prev + 1 ? ascRun + 1 : 1;
    descRun = curr === prev - 1 ? descRun + 1 : 1;

    if (ascRun >= 4 || descRun >= 4) {
      return true;
    }
  }

  return false;
}

function randomPhoneTail(length, options = {}) {
  const {
    protectedPrefix = '',
    firstDigits = '0123456789',
    avoidStartingWith = []
  } = options;
  const maxAttempts = 80;
  const prefix = String(protectedPrefix || '');
  const protectedPrefixLength = prefix.length;
  const blockedStarts = avoidStartingWith.map((value) => String(value));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const first = randomDigitFrom(firstDigits);
    const tail = first + randomDigits(Math.max(0, length - 1));
    const candidate = prefix + tail;
    if (blockedStarts.some((blocked) => tail.startsWith(blocked))) continue;
    if (!isLowQualityPhoneNumber(candidate, protectedPrefixLength)) {
      return tail;
    }
  }

  return randomDigitFrom(firstDigits) + randomDigits(Math.max(0, length - 1));
}

function buildPhoneNumber(config, country) {
  if (config.areaCodePrefixes) {
    const areaCode = randomChoice(config.areaCodePrefixes);

    if (config.mobileFirstDigit) {
      const fixedPrefix = areaCode + config.mobileFirstDigit;
      return {
        number: fixedPrefix + randomPhoneTail(config.length - fixedPrefix.length, {
          protectedPrefix: fixedPrefix
        }),
        protectedPrefixLength: fixedPrefix.length
      };
    }

    const tailLength = config.length - areaCode.length;
    const firstDigits = country === 'United States' || country === 'Canada' ? '23456789' : '0123456789';
    const avoidStartingWith = country === 'United States' || country === 'Canada'
      ? ['555', '211', '311', '411', '511', '611', '711', '811', '911', '000']
      : ['000'];
    return {
      number: areaCode + randomPhoneTail(tailLength, {
        protectedPrefix: areaCode,
        firstDigits,
        avoidStartingWith
      }),
      protectedPrefixLength: areaCode.length
    };
  }

  if (config.mobilePrefixes) {
    const prefix = randomChoice(config.mobilePrefixes);
    return {
      number: prefix + randomPhoneTail(config.length - prefix.length, {
        protectedPrefix: prefix
      }),
      protectedPrefixLength: prefix.length
    };
  }

  return {
    number: randomPhoneTail(config.length),
    protectedPrefixLength: 0
  };
}

function generatePhone(country) {
  const normalizedCountry = normalizeCountry(country);
  const config = PHONE_FORMATS[normalizedCountry];

  // 如果没有配置，使用默认美国格式
  if (!config) {
    const defaultConfig = PHONE_FORMATS['United States'];
    const { number: phoneNumber } = buildPhoneNumber(defaultConfig, 'United States');
    return `${defaultConfig.code} ${defaultConfig.format(phoneNumber)}`;
  }

  let phoneNumber = '';
  let protectedPrefixLength = 0;
  let attempts = 0;

  // 循环生成，直到满足质量要求 (避免 1234, 0000 等)
  do {
    attempts++;
    const built = buildPhoneNumber(config, normalizedCountry);
    phoneNumber = built.number;
    protectedPrefixLength = built.protectedPrefixLength;

    // 全部国家都过滤明显测试号/顺子/重复号，降低前端校验直接拒绝概率。
    if (isLowQualityPhoneNumber(phoneNumber, protectedPrefixLength)) {
      continue;
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
  const normalizedCountry = normalizeCountry(country);
  const streets = STREET_NAMES[normalizedCountry] || STREET_NAMES['default'];
  const streetNum = Math.floor(Math.random() * 9999) + 1;
  const street = randomChoice(streets);
  const unitSuffix = generateUnitSuffix(normalizedCountry);

  if (normalizedCountry === 'Japan') {
    return `${street} ${Math.floor(Math.random() * 6) + 1}-${Math.floor(Math.random() * 30) + 1}${unitSuffix}`;
  }
  if (normalizedCountry === 'Germany') {
    return `${street} ${streetNum}${unitSuffix}`;
  }
  if (['France', 'Spain', 'Italy', 'Brazil', 'Mexico'].includes(normalizedCountry)) {
    return `${street} ${streetNum}${unitSuffix}`;
  }
  if (normalizedCountry === 'Taiwan') {
    return `No. ${streetNum}, ${street}${unitSuffix}`;
  }
  if (normalizedCountry === 'Hong Kong' || normalizedCountry === 'Singapore') {
    return `${streetNum} ${street}${unitSuffix}`;
  }

  return `${streetNum} ${street}${unitSuffix}`;
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
    // 加拿大: A1A 1A1 格式（字母不含 D/F/I/O/Q/U）
    const letters = 'ABCEGHJKLMNPRSTVXY';
    const pickLetter = () => randomChoice(letters.split(''));
    const prefix = String(zipPrefix || '').trim().toUpperCase();
    // 已是完整邮编：规范化后直接沿用
    const fullMatch = prefix.match(/^([ABCEGHJKLMNPRSTVXY]\d[ABCEGHJKLMNPRSTVXY])\s?(\d[ABCEGHJKLMNPRSTVXY]\d)$/);
    if (fullMatch) {
      return `${fullMatch[1]} ${fullMatch[2]}`;
    }
    // CITY_STATE_MAP 给的是前两位（如 M5），补齐剩余 L D L D
    const head = prefix.replace(/[^A-Z0-9]/g, '').slice(0, 2);
    if (/^[A-Z]\d$/.test(head)) {
      return `${head}${pickLetter()} ${randomDigits(1)}${pickLetter()}${randomDigits(1)}`;
    }
    // 无可用前缀：完整随机生成
    return `${pickLetter()}${randomDigits(1)}${pickLetter()} ${randomDigits(1)}${pickLetter()}${randomDigits(1)}`;
  } else if (country === 'United Kingdom') {
    // 英国: 外码 + 内码（示例: SW1A 1AA）
    const inwardLetters = 'ABDEFGHJLNPQRSTUWXYZ';
    const fallbackOutward = randomChoice(['W1', 'M1', 'B1', 'LS1', 'G1', 'NE1', 'BS1', 'EH1']);
    const outwardBase = (zipPrefix || fallbackOutward).toUpperCase();
    const outward = /\d$/.test(outwardBase) ? outwardBase : `${outwardBase}${randomDigits(1)}`;
    return `${outward} ${randomDigits(1)}${randomChoice(inwardLetters.split(''))}${randomChoice(inwardLetters.split(''))}`;
  } else if (country === 'Germany' || country === 'France' || country === 'Spain' || country === 'Italy') {
    // 欧洲: 5位数字（德国等）
    const prefix = (zipPrefix || '').replace(/\D/g, '').slice(0, 5);
    return (prefix + randomDigits(Math.max(0, 5 - prefix.length))).slice(0, 5);
  } else if (country === 'China') {
    // 中国: 6位数字
    return zipPrefix || randomDigits(6);
  } else if (country === 'Japan') {
    // 日本: xxx-xxxx 格式
    const jpPrefix = (zipPrefix || '').replace(/\D/g, '').slice(0, 3);
    let first = (jpPrefix + randomDigits(Math.max(0, 3 - jpPrefix.length))).slice(0, 3);
    if (first === '000') first = '100';
    return `${first}-${randomDigits(4)}`;
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
  } else if (country === 'Netherlands') {
    // 荷兰: 1234 AB 格式
    const nlLetters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const pickNl = () => randomChoice(nlLetters.split(''));
    return `${randomDigits(4)} ${pickNl()}${pickNl()}`;
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
  const country = normalizeCountry(ipData.country || 'United States');
  const ipCity = ipData.city || '';
  const ipRegion = ipData.region || '';

  const gender = generateGender();
  const namePair = generateNamePair(country, gender);
  const firstName = namePair.firstName;
  const lastName = namePair.lastName;
  const username = generateUsername(firstName, lastName);

  // 优先根据 IP 检测到的城市匹配位置，确保城市、州、邮编关联
  selectLocationByCity(country, ipCity, ipRegion);
  const addressInfo = pickInitialAddress(country, ipCity, ipRegion);

  return {
    firstName,
    lastName,
    gender,
    birthday: generateBirthday(),
    username,
    email: generateEmail(username),
    password: generatePassword(),
    phone: generatePhone(country),
    address: addressInfo.address,
    city: addressInfo.city,
    state: addressInfo.state,
    zipCode: addressInfo.zipCode,
    country,
    addressSource: addressInfo.source,
    addressConfidence: addressInfo.confidence,
    addressLastUpdatedAt: new Date().toISOString()
  };
}

/**
 * 重新生成单个字段
 */
function regenerateField(fieldName, currentData, ipData) {
  const country = normalizeCountry(currentData.country || ipData.country || 'United States');

  switch (fieldName) {
    case 'firstName':
      return generateFirstName(country, currentData.gender);
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
  function generatePasswordWithSettings(settings = {}) {
    const length = settings.passwordLength || 12;
    const useUppercase = settings.pwdUppercase !== false;
    const useLowercase = settings.pwdLowercase !== false;
    const useNumbers = settings.pwdNumbers !== false;
    const useSymbols = settings.pwdSymbols !== false;
    let chars = '';
    let password = '';
    if (useUppercase) { chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; }
    if (useLowercase) { chars += 'abcdefghijklmnopqrstuvwxyz'; password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; }
    if (useNumbers) { chars += '0123456789'; password += '0123456789'[Math.floor(Math.random() * 10)]; }
    if (useSymbols) { chars += '!@#$%^&*'; password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; }
    if (!chars) { chars = 'abcdefghijklmnopqrstuvwxyz'; password = 'a'; }
    for (let i = password.length; i < length; i++) { password += chars[Math.floor(Math.random() * chars.length)]; }
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // 扩展信息生成函数（支持自定义设置）
  function generateAllInfoWithSettings(ipData, settings = {}) {
    const country = normalizeCountry(ipData.country || 'United States');
    const ipCity = ipData.city || '';
    const ipRegion = ipData.region || '';
    const gender = generateGender();

    // 日本专用处理：使用汉字姓名和日本地址
    // 国家扩展优先：注册了 generateProfile 的国家走扩展逻辑；
    // 新增国家只需注册扩展，无需改动这里
    const countryExt = typeof GeoFillCountryExtensions !== 'undefined'
      ? GeoFillCountryExtensions.get(country) : null;
    if (countryExt && typeof countryExt.generateProfile === 'function') {
      const extProfile = countryExt.generateProfile(gender, settings, {
        generatePhone, generateBirthday, generateUsername, generateEmail, generatePasswordWithSettings
      });
      if (extProfile) return extProfile;
    }

    const namePair = generateNamePair(country, gender);
    const firstName = namePair.firstName;
    const lastName = namePair.lastName;
    const username = generateUsername(firstName, lastName);
    selectLocationByCity(country, ipCity, ipRegion);
    const addressInfo = pickInitialAddress(country, ipCity, ipRegion);
    return {
      firstName: firstName, lastName: lastName, gender: gender,
      birthday: generateBirthday(settings.minAge || 18, settings.maxAge || 55),
      username: username,
      email: generateEmail(username),
      password: generatePasswordWithSettings(settings),
      phone: generatePhone(country),
      address: addressInfo.address,
      city: addressInfo.city,
      state: addressInfo.state,
      zipCode: addressInfo.zipCode,
      country: country,
      addressSource: addressInfo.source,
      addressConfidence: addressInfo.confidence,
      addressLastUpdatedAt: new Date().toISOString()
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
    setSelfHostedAddressConfig: setSelfHostedAddressConfig,
    fetchAddressFromSelfHosted: fetchAddressFromSelfHosted,
    fetchRealAddressFromApi: fetchRealAddressFromApi,
    fetchAddressFromOSM: fetchAddressFromOSM,
    fetchRealAddressSmart: fetchRealAddressSmart,
    pickLocalVerifiedAddress: pickLocalVerifiedAddress,
    buildSyntheticAddress: buildSyntheticAddress,
    pickInitialAddress: pickInitialAddress,
    getAddressPoolSummary: function () {
      const summary = {};
      for (const country of Object.keys(LOCAL_VERIFIED_ADDRESS_POOL)) {
        summary[country] = LOCAL_VERIFIED_ADDRESS_POOL[country].length;
      }
      return summary;
    },
    getAddressPoolMeta: function () {
      return { ...LOCAL_VERIFIED_ADDRESS_POOL_RUNTIME_META };
    },
    getAddressPoolStats: function (country) {
      const normalizedCountry = normalizeCountryIfKnown(country || '');
      if (!normalizedCountry) return null;
      const stats = LOCAL_VERIFIED_ADDRESS_POOL_RUNTIME_META.countryStats?.[normalizedCountry];
      return stats ? { ...stats } : null;
    },
    CITY_COORDINATES: CITY_COORDINATES,
    /**
     * 异步生成地址（本地真实池优先 -> API补充 -> 合成兜底）
     */
    generateAddressAsync: async function (country, cityName, options = {}) {
      const normalizedCountry = normalizeCountry(country || 'United States');
      const requestedCity = String(cityName || '').trim();

      // 0) 自托管地址服务（用户在设置里配了服务地址才走）：官方注册库的真实地址，无限量
      if (options.allowApi !== false) {
        try {
          let selfHosted = await fetchAddressFromSelfHosted(normalizedCountry, requestedCity);
          if (!selfHosted && requestedCity) {
            // 城市精确筛选无覆盖时退为全国随机，城市字段随返回结果更新
            selfHosted = await fetchAddressFromSelfHosted(normalizedCountry, '');
          }
          if (selfHosted && selfHosted.address) {
            if (options.requireCityMatch === true && requestedCity && !isSameAddressCity(selfHosted.city, requestedCity)) {
              console.log('[GeoFill] 自托管地址城市不匹配，降级:', selfHosted.city, requestedCity);
            } else {
              console.log('[GeoFill] 使用自托管地址服务:', selfHosted.address);
              return selfHosted;
            }
          }
        } catch (e) {
          console.log('[GeoFill] 自托管地址服务失败，降级:', e && e.message ? e.message : e);
        }
      }

      // 1) 本地真实池优先：稳定、快、可离线
      const localVerified = pickLocalVerifiedAddress(normalizedCountry, cityName, {
        requireCityMatch: options.requireCityMatch === true
      });
      if (localVerified && localVerified.address) {
        return localVerified;
      }

      const locationContext = options.locationContext || {};

      // 2) API 补充（有坐标才调用）
      // 尝试获取城市坐标
      const coords = CITY_COORDINATES[cityName] || CITY_COORDINATES[currentLocation?.city];

      if (coords && options.allowApi !== false) {
        try {
          // 使用智能切换函数（优先 Geoapify，备用 OSM）
          const realAddr = await fetchRealAddressSmart(coords.lat, coords.lon);
          if (realAddr && realAddr.address) {
            const returnedCity = realAddr.city || requestedCity || generateCity(normalizedCountry);
            if (options.requireCityMatch === true && requestedCity && !isSameAddressCity(returnedCity, requestedCity)) {
              console.log('[GeoFill] 地址 API 返回城市不匹配，使用同城兜底地址:', returnedCity, requestedCity);
              return buildSyntheticAddress(normalizedCountry, {
                city: requestedCity,
                state: locationContext.state,
                zipCode: locationContext.zipCode
              });
            }
            console.log('[GeoFill] 获取真实地址成功:', realAddr.address, '来源:', realAddr.source);
            return {
              address: realAddr.address,
              city: returnedCity,
              state: realAddr.state || generateState(normalizedCountry),
              zipCode: realAddr.zipCode || generateZipCode(normalizedCountry),
              country: normalizeCountry(realAddr.country || normalizedCountry),
              source: realAddr.source || 'openstreetmap',
              confidence: realAddr.confidence || (realAddr.source === 'geoapify' ? 'high' : 'medium')
            };
          }
        } catch (e) {
          console.log('[GeoFill] 地址 API 失败，降级到本地合成地址');
        }
      }

      // 3) 最后兜底：本地合成
      if (options.requireCityMatch === true && requestedCity) {
        return buildSyntheticAddress(normalizedCountry, {
          city: requestedCity,
          state: locationContext.state,
          zipCode: locationContext.zipCode
        });
      }
      return buildSyntheticAddress(normalizedCountry);
    }
  };
}
