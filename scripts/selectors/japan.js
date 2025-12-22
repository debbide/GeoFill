/**
 * GeoFill - Japan Selectors
 * 日本专用表单字段选择器
 */

window.GeoFillSelectors = window.GeoFillSelectors || {};

window.GeoFillSelectors.japan = {
    // 日本漢字姓（姓）
    lastNameKanji: [
        'input[name*="sei" i]:not([name*="seimei" i])',
        'input[name*="family_name_kanji" i]',
        'input[name*="last_name_kanji" i]',
        'input[placeholder*="姓" i]:not([placeholder*="姓名" i])',
        'input[placeholder*="山田" i]',
        'input[aria-label*="姓（漢字）" i]',
        'input[aria-label*="姓 漢字" i]'
    ],
    // 日本漢字名（名）
    firstNameKanji: [
        'input[name*="mei" i]:not([name*="seimei" i])',
        'input[name*="given_name_kanji" i]',
        'input[name*="first_name_kanji" i]',
        'input[placeholder*="名" i]:not([placeholder*="姓名" i]):not([placeholder*="名前" i])',
        'input[placeholder*="太郎" i]',
        'input[aria-label*="名（漢字）" i]',
        'input[aria-label*="名 漢字" i]'
    ],
    // 日本片假名姓（セイ）
    lastNameKana: [
        'input[name="name_kana1"]',
        'input[name*="kana_sei" i]',
        'input[name*="sei_kana" i]',
        'input[name*="family_name_kana" i]',
        'input[name*="last_name_kana" i]',
        'input[name*="furigana_sei" i]',
        'input[placeholder*="セイ" i]',
        'input[placeholder*="ヤマダ" i]',
        'input[aria-label*="姓（カナ）" i]',
        'input[aria-label*="姓 カナ" i]',
        'input[aria-label*="フリガナ" i]:not([aria-label*="名" i])'
    ],
    // 日本片假名名（メイ）
    firstNameKana: [
        'input[name="name_kana2"]',
        'input[name*="kana_mei" i]',
        'input[name*="mei_kana" i]',
        'input[name*="given_name_kana" i]',
        'input[name*="first_name_kana" i]',
        'input[name*="furigana_mei" i]',
        'input[placeholder*="メイ" i]',
        'input[placeholder*="タロウ" i]',
        'input[aria-label*="名（カナ）" i]',
        'input[aria-label*="名 カナ" i]'
    ],
    // 日本都道府県
    prefectureJp: [
        'input[name*="prefecture" i]',
        'input[name*="todofuken" i]',
        'select[name*="prefecture" i]',
        'select[name*="todofuken" i]',
        'input[placeholder*="都道府県" i]',
        'input[placeholder*="東京都" i]',
        'select[aria-label*="都道府県" i]'
    ],
    // 日本市区町村
    cityJp: [
        'input[name*="shikuchoson" i]',
        'input[name*="city_jp" i]',
        'input[placeholder*="市区町村" i]',
        'input[placeholder*="千代田区" i]',
        'input[aria-label*="市区町村" i]'
    ],
    // 日本町域・番地
    chomeJp: [
        'input[name*="choiki" i]',
        'input[name*="banchi" i]',
        'input[name*="chome" i]',
        'input[name*="address1_jp" i]',
        'input[placeholder*="町域" i]',
        'input[placeholder*="丁目" i]',
        'input[placeholder*="番地" i]',
        'input[aria-label*="町域" i]',
        'input[aria-label*="丁目・番地" i]'
    ],
    // 日本建物名
    buildingJp: [
        'input[name*="tatemono" i]',
        'input[name*="building_jp" i]',
        'input[name*="address2_jp" i]',
        'input[placeholder*="建物名" i]',
        'input[placeholder*="マンション" i]',
        'input[placeholder*="ビル" i]',
        'input[aria-label*="建物名" i]'
    ],
    // 日本電話番号（無国番）
    phoneJp: [
        'input[name*="tel_jp" i]',
        'input[placeholder*="090" i]',
        'input[placeholder*="080" i]',
        'input[placeholder*="070" i]',
        'input[aria-label*="電話番号" i]'
    ],
    // XServer 登録区分
    id_usertype: [
        'input[name="id_usertype"][type="radio"]',
    ]
};

window.GeoFillSelectors.japanLabels = {
    lastNameKanji: ['姓', '氏名（姓）', 'お名前（姓）'],
    firstNameKanji: ['名', '氏名（名）', 'お名前（名）'],
    lastNameKana: ['セイ', 'フリガナ（姓）', 'ふりがな（姓）', 'カナ（姓）'],
    firstNameKana: ['メイ', 'フリガナ（名）', 'ふりがな（名）', 'カナ（名）'],
    prefectureJp: ['都道府県'],
    cityJp: ['市区町村'],
    chomeJp: ['町域', '番地', '丁目', '住所1'],
    buildingJp: ['建物名', 'マンション', 'ビル', '住所2'],
    phoneJp: ['電話番号', '携帯電話']
};
