/**
 * 日本特有数据生成器 - 支持日本网站的特殊字段
 */

// 日本汉字姓名数据库
const JAPAN_NAMES = {
    // 姓（汉字 + 片假名 + 罗马字）
    lastNames: [
        { kanji: '佐藤', kana: 'サトウ', romaji: 'Sato' },
        { kanji: '鈴木', kana: 'スズキ', romaji: 'Suzuki' },
        { kanji: '高橋', kana: 'タカハシ', romaji: 'Takahashi' },
        { kanji: '田中', kana: 'タナカ', romaji: 'Tanaka' },
        { kanji: '渡辺', kana: 'ワタナベ', romaji: 'Watanabe' },
        { kanji: '伊藤', kana: 'イトウ', romaji: 'Ito' },
        { kanji: '山本', kana: 'ヤマモト', romaji: 'Yamamoto' },
        { kanji: '中村', kana: 'ナカムラ', romaji: 'Nakamura' },
        { kanji: '小林', kana: 'コバヤシ', romaji: 'Kobayashi' },
        { kanji: '加藤', kana: 'カトウ', romaji: 'Kato' },
        { kanji: '吉田', kana: 'ヨシダ', romaji: 'Yoshida' },
        { kanji: '山田', kana: 'ヤマダ', romaji: 'Yamada' },
        { kanji: '佐々木', kana: 'ササキ', romaji: 'Sasaki' },
        { kanji: '山口', kana: 'ヤマグチ', romaji: 'Yamaguchi' },
        { kanji: '松本', kana: 'マツモト', romaji: 'Matsumoto' },
        { kanji: '井上', kana: 'イノウエ', romaji: 'Inoue' },
        { kanji: '木村', kana: 'キムラ', romaji: 'Kimura' },
        { kanji: '林', kana: 'ハヤシ', romaji: 'Hayashi' },
        { kanji: '清水', kana: 'シミズ', romaji: 'Shimizu' },
        { kanji: '山崎', kana: 'ヤマザキ', romaji: 'Yamazaki' }
    ],
    // 名（汉字 + 片假名 + 罗马字 + 性别）
    firstNames: [
        { kanji: '太郎', kana: 'タロウ', romaji: 'Taro', gender: 'male' },
        { kanji: '一郎', kana: 'イチロウ', romaji: 'Ichiro', gender: 'male' },
        { kanji: '健二', kana: 'ケンジ', romaji: 'Kenji', gender: 'male' },
        { kanji: '大輝', kana: 'ダイキ', romaji: 'Daiki', gender: 'male' },
        { kanji: '悠真', kana: 'ユウマ', romaji: 'Yuma', gender: 'male' },
        { kanji: '蓮', kana: 'レン', romaji: 'Ren', gender: 'male' },
        { kanji: '翔太', kana: 'ショウタ', romaji: 'Shota', gender: 'male' },
        { kanji: '拓海', kana: 'タクミ', romaji: 'Takumi', gender: 'male' },
        { kanji: '陽向', kana: 'ヒナタ', romaji: 'Hinata', gender: 'male' },
        { kanji: '颯太', kana: 'ソウタ', romaji: 'Sota', gender: 'male' },
        { kanji: '花子', kana: 'ハナコ', romaji: 'Hanako', gender: 'female' },
        { kanji: '陽子', kana: 'ヨウコ', romaji: 'Yoko', gender: 'female' },
        { kanji: '美咲', kana: 'ミサキ', romaji: 'Misaki', gender: 'female' },
        { kanji: '結衣', kana: 'ユイ', romaji: 'Yui', gender: 'female' },
        { kanji: '葵', kana: 'アオイ', romaji: 'Aoi', gender: 'female' },
        { kanji: '陽菜', kana: 'ヒナ', romaji: 'Hina', gender: 'female' },
        { kanji: '凛', kana: 'リン', romaji: 'Rin', gender: 'female' },
        { kanji: '咲良', kana: 'サクラ', romaji: 'Sakura', gender: 'female' },
        { kanji: '芽依', kana: 'メイ', romaji: 'Mei', gender: 'female' },
        { kanji: '心春', kana: 'コハル', romaji: 'Koharu', gender: 'female' }
    ]
};

// 日本详细地址数据库
const JAPAN_ADDRESSES = [
    { prefecture: '東京都', city: '千代田区', chome: '丸の内1-1-1', building: '丸の内ビルディング', zip: '1000005' },
    { prefecture: '東京都', city: '港区', chome: '六本木6-10-1', building: '六本木ヒルズ森タワー', zip: '1066108' },
    { prefecture: '東京都', city: '渋谷区', chome: '神宮前1-14-30', building: 'ウィズ原宿', zip: '1500001' },
    { prefecture: '東京都', city: '新宿区', chome: '西新宿2-8-1', building: '東京都庁', zip: '1638001' },
    { prefecture: '東京都', city: '中央区', chome: '銀座4-6-16', building: '銀座三越', zip: '1040061' },
    { prefecture: '大阪府', city: '大阪市北区', chome: '大深町4-20', building: 'グランフロント大阪 タワーA', zip: '5300011' },
    { prefecture: '大阪府', city: '大阪市中央区', chome: '難波5-1-60', building: 'なんばパークス', zip: '5560011' },
    { prefecture: '大阪府', city: '大阪市天王寺区', chome: '悲田院町10-39', building: '天王寺ミオ', zip: '5430055' },
    { prefecture: '神奈川県', city: '横浜市西区', chome: 'みなとみらい2-3-1', building: 'クイーンズタワーA', zip: '2200012' },
    { prefecture: '神奈川県', city: '川崎市川崎区', chome: '駅前本町11-2', building: '川崎フロンティアビル', zip: '2100007' },
    { prefecture: '愛知県', city: '名古屋市中村区', chome: '名駅3-28-12', building: '大名古屋ビルヂング', zip: '4500002' },
    { prefecture: '愛知県', city: '名古屋市中区', chome: '栄3-6-1', building: 'ラシック', zip: '4600008' },
    { prefecture: '北海道', city: '札幌市中央区', chome: '北三条西4-1-1', building: '日本生命札幌ビル', zip: '0600003' },
    { prefecture: '福岡県', city: '福岡市中央区', chome: '天神2-5-55', building: 'アクロス福岡', zip: '8100001' },
    { prefecture: '兵庫県', city: '神戸市中央区', chome: '三宮町1-9-1', building: 'センタープラザ', zip: '6500021' },
    { prefecture: '京都府', city: '京都市下京区', chome: '烏丸通七条下る東塩小路町', building: '京都駅ビル', zip: '6008216' },
    { prefecture: '宮城県', city: '仙台市青葉区', chome: '中央1-3-1', building: 'AER', zip: '9806116' },
    { prefecture: '広島県', city: '広島市中区', chome: '基町6-78', building: 'リーガロイヤルホテル広島', zip: '7300011' },
    { prefecture: '埼玉県', city: 'さいたま市大宮区', chome: '桜木町1-7-5', building: 'ソニックシティ', zip: '3300854' },
    { prefecture: '千葉県', city: '千葉市美浜区', chome: 'ひび野2-4', building: 'プレナ幕張', zip: '2610021' }
];

/**
 * 从数组中随机选择一个元素
 */
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成日本完整姓名信息
 */
function generateJapanName(gender) {
    const lastName = randomChoice(JAPAN_NAMES.lastNames);
    const genderFilter = gender || (Math.random() > 0.5 ? 'male' : 'female');
    const filteredFirstNames = JAPAN_NAMES.firstNames.filter(n => n.gender === genderFilter);
    const firstName = randomChoice(filteredFirstNames);

    return {
        // 汉字姓名
        lastNameKanji: lastName.kanji,
        firstNameKanji: firstName.kanji,
        fullNameKanji: lastName.kanji + ' ' + firstName.kanji,
        // 片假名姓名
        lastNameKana: lastName.kana,
        firstNameKana: firstName.kana,
        fullNameKana: lastName.kana + ' ' + firstName.kana,
        // 罗马字姓名
        lastNameRomaji: lastName.romaji,
        firstNameRomaji: firstName.romaji,
        fullNameRomaji: firstName.romaji + ' ' + lastName.romaji,
        // 性别
        gender: genderFilter
    };
}

/**
 * 生成日本完整地址信息
 */
function generateJapanAddress() {
    const addr = randomChoice(JAPAN_ADDRESSES);
    const floor = Math.floor(Math.random() * 30) + 1;
    const room = Math.floor(Math.random() * 900) + 100;

    return {
        // 邮便番号（7位数字，日本格式）
        zipCode: addr.zip,
        zipCodeFormatted: addr.zip.slice(0, 3) + '-' + addr.zip.slice(3),
        // 都道府县
        prefecture: addr.prefecture,
        // 市区町村
        city: addr.city,
        // 町域・丁目・番地
        chome: addr.chome,
        // 建物名
        building: addr.building + ' ' + floor + 'F',
        // 完整地址（日本格式：从大到小）
        fullAddress: addr.prefecture + addr.city + addr.chome,
        fullAddressWithBuilding: addr.prefecture + addr.city + addr.chome + ' ' + addr.building + ' ' + floor + 'F ' + room + '号室'
    };
}

/**
 * 生成日本电话号码（无国家代码，适用于日本网站）
 */
function generateJapanPhone() {
    const prefixes = ['070', '080', '090'];
    const prefix = randomChoice(prefixes);
    const middle = Math.floor(Math.random() * 9000) + 1000;
    const last = Math.floor(Math.random() * 9000) + 1000;
    return prefix + middle + last;
}

/**
 * 生成日本电话号码（带格式）
 */
function generateJapanPhoneFormatted() {
    const phone = generateJapanPhone();
    return phone.slice(0, 3) + '-' + phone.slice(3, 7) + '-' + phone.slice(7);
}

// 导出供其他脚本使用
if (typeof window !== 'undefined') {
    window.japanGenerators = {
        generateJapanName,
        generateJapanAddress,
        generateJapanPhone,
        generateJapanPhoneFormatted,
        JAPAN_NAMES,
        JAPAN_ADDRESSES
    };
}

// 注册到国家扩展表：调用方通过 GeoFillCountryExtensions.get('Japan') 获取，
// 不再需要硬编码 if (country === 'Japan') 分支
if (typeof GeoFillCountryExtensions !== 'undefined') {
    GeoFillCountryExtensions.register('Japan', {
        generateProfile: (gender, settings, helpers) => {
            const japanName = generateJapanName(gender);
            const japanAddr = generateJapanAddress();
            const japanPhone = helpers.generatePhone('Japan'); // 统一生成函数（带质量检测）
            const username = helpers.generateUsername(japanName.firstNameRomaji, japanName.lastNameRomaji);
            return {
                firstName: japanName.firstNameKanji,
                lastName: japanName.lastNameKanji,
                firstNameKana: japanName.firstNameKana,
                lastNameKana: japanName.lastNameKana,
                fullName: japanName.lastNameKanji + ' ' + japanName.firstNameKanji,
                fullNameKana: japanName.lastNameKana + ' ' + japanName.firstNameKana,
                gender: gender,
                birthday: helpers.generateBirthday(settings.minAge || 18, settings.maxAge || 55),
                username: username,
                email: helpers.generateEmail(username),
                password: helpers.generatePasswordWithSettings(settings),
                phone: japanPhone,
                address: japanAddr.chome,
                city: japanAddr.prefecture + japanAddr.city,
                state: japanAddr.building,
                zipCode: japanAddr.zipCodeFormatted,
                country: 'Japan',
                id_usertype: '100' // XServer 个人注册
            };
        },
        aiPromptExtra: [
            'IMPORTANT for Japan:',
            '- ZipCode: "NNN-NNNN" (e.g. 100-0001)',
            '- Phone: Generate a RANDOM mobile number "090-XXXX-XXXX" (or 080/070). DO NOT use "1234" or "0000".',
            '- Name: Kanji for First/Last name, and Katakana for reading if applicable (but return standard keys).'
        ].join('\n')
    });
}
