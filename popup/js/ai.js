/**
 * AI-related logic.
 */

const AI_PROFILE_ALLOWED_FIELDS = new Set(FIELD_NAMES);
const AI_GENDER_ALLOWED = new Set(['male', 'female']);
// AI 接口请求超时（毫秒），避免自定义端点 hang 住时界面卡死
const AI_REQUEST_TIMEOUT_MS = 30000;

/**
 * 带超时的 fetch：超时后主动 abort，并抛出可读错误。
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
        if (e && e.name === 'AbortError') {
            throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒无响应）`);
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

function safeString(value, maxLen = 120) {
    if (value === null || value === undefined) return '';
    return String(value).trim().slice(0, maxLen);
}

function sanitizeAiProfile(rawProfile, fallbackCountry) {
    if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) {
        return {};
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(rawProfile)) {
        if (!AI_PROFILE_ALLOWED_FIELDS.has(key)) continue;
        if (typeof value !== 'string' && typeof value !== 'number') continue;

        const text = safeString(value, 160);
        if (!text) continue;

        switch (key) {
            case 'gender': {
                const gender = text.toLowerCase();
                if (AI_GENDER_ALLOWED.has(gender)) {
                    sanitized.gender = gender;
                }
                break;
            }
            case 'birthday': {
                const normalized = text.replace(/\//g, '-');
                if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
                    sanitized.birthday = normalized;
                }
                break;
            }
            case 'email': {
                const email = text.replace(/\s+/g, '').toLowerCase();
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    sanitized.email = email.slice(0, 120);
                }
                break;
            }
            case 'country': {
                if (window.generators?.normalizeCountry) {
                    sanitized.country = window.generators.normalizeCountry(text || fallbackCountry || 'United States');
                } else {
                    sanitized.country = text;
                }
                break;
            }
            case 'username': {
                sanitized.username = text
                    .replace(/\s+/g, '')
                    .replace(/[^\w.-]/g, '')
                    .slice(0, 28);
                break;
            }
            case 'zipCode': {
                sanitized.zipCode = text.replace(/[^\dA-Za-z -]/g, '').slice(0, 16);
                break;
            }
            case 'phone': {
                sanitized.phone = text.replace(/[^\d+\-() ]/g, '').slice(0, 24);
                break;
            }
            case 'password': {
                sanitized.password = text.replace(/\s+/g, '').slice(0, 64);
                break;
            }
            default: {
                sanitized[key] = text;
                break;
            }
        }
    }

    return sanitized;
}

function parseAiJsonContent(content) {
    const raw = String(content || '{}');
    let jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    return JSON.parse(jsonStr);
}

function normalizeAgeSettings(minAge, maxAge) {
    let min = Number.parseInt(minAge, 10);
    let max = Number.parseInt(maxAge, 10);

    if (!Number.isFinite(min)) min = 18;
    if (!Number.isFinite(max)) max = 55;

    min = Math.min(Math.max(min, 1), 100);
    max = Math.min(Math.max(max, 1), 100);

    if (min > max) {
        const t = min;
        min = max;
        max = t;
    }

    return { min, max };
}

function applyStrongFallbacksForAiProfile(profile, country) {
    const merged = { ...profile };
    const age = normalizeAgeSettings(userSettings.minAge, userSettings.maxAge);

    if (!merged.gender || !AI_GENDER_ALLOWED.has(merged.gender)) {
        merged.gender = window.generators?.generateGender ? window.generators.generateGender() : 'male';
    }

    if ((!merged.firstName || !merged.lastName) && window.generators) {
        if (!merged.firstName && window.generators.generateFirstName) {
            merged.firstName = window.generators.generateFirstName(country, merged.gender);
        }
        if (!merged.lastName && window.generators.generateLastName) {
            merged.lastName = window.generators.generateLastName(country);
        }
    }

    if (!merged.birthday && window.generators?.generateBirthday) {
        merged.birthday = window.generators.generateBirthday(age.min, age.max);
    }

    if ((!merged.username || merged.username.length < 3) && window.generators?.generateUsername) {
        merged.username = window.generators.generateUsername(merged.firstName || 'user', merged.lastName || '');
    }

    if (!merged.address && window.generators?.generateAddress) {
        merged.address = window.generators.generateAddress(country);
    }

    if (!merged.city && window.generators?.generateCity) {
        merged.city = window.generators.generateCity(country);
    }

    if (!merged.state && window.generators?.generateState) {
        merged.state = window.generators.generateState(country);
    }

    if (!merged.zipCode && window.generators?.generateZipCode) {
        merged.zipCode = window.generators.generateZipCode(country);
    }

    if (!merged.country) {
        merged.country = country;
    }

    return merged;
}

async function generateWithAI() {
    const btn = elements.regenerateAll;
    const originalText = btn.textContent;
    btn.textContent = '🤖 生成中...';
    btn.disabled = true;

    try {
        const country = ipData.country || 'United States';

        const lockedValues = {};
        lockedFields.forEach(field => {
            lockedValues[field] = currentData[field];
        });

        let prompt = `Generate a realistic user profile for a person in ${country}.`;

        if (Object.keys(lockedValues).length > 0) {
            prompt += `\n\nLOCKED ATTRIBUTES (You MUST respect these): ${JSON.stringify(lockedValues)}`;
        }

        if (userSettings.aiPersona) {
            prompt += `\n\nPersona Description: ${userSettings.aiPersona}\n\nEnsure the generated profile matches this persona perfectly.`;
        }

        const countryExt = typeof GeoFillCountryExtensions !== 'undefined'
            ? GeoFillCountryExtensions.get(country) : null;
        if (countryExt && countryExt.aiPromptExtra) {
            prompt += `\n\n${countryExt.aiPromptExtra}`;
        }

        prompt += ' Return ONLY a valid JSON object with keys: firstName, lastName, gender (male/female), birthday (YYYY-MM-DD), username, email, password, phone, address, city, state, zipCode.';

        const apiUrl = normalizeApiUrl(userSettings.openaiBaseUrl);
        const granted = await ensureHostPermission(apiUrl);
        if (!granted) {
            throw new Error('未授予 AI 接口站点权限，无法请求。');
        }

        const response = await fetchWithTimeout(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userSettings.openaiKey}`
            },
            body: JSON.stringify({
                model: userSettings.openaiModel,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that generates realistic user data in JSON format.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error (${response.status}): ${text.slice(0, 100)}...`);
        }

        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`API 返回了非 JSON 数据。预览: ${text.slice(0, 80)}...`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';

        let profile = parseAiJsonContent(content);
        profile = sanitizeAiProfile(profile, country);
        profile = applyStrongFallbacksForAiProfile(profile, country);

        currentData = { ...currentData, ...profile };

        if (!lockedFields.has('password') && window.generators?.generatePasswordWithSettings) {
            currentData.password = window.generators.generatePasswordWithSettings(userSettings);
        }

        if (!lockedFields.has('phone') && window.generators?.generatePhone) {
            currentData.phone = window.generators.generatePhone(country);
        }

        if (!lockedFields.has('email')) {
            const domainType = elements.emailDomainType?.value;
            if (domainType && domainType !== 'custom') {
                const username = currentData.username || 'user';
                currentData.email = `${username}@${domainType}`;
            } else if (window.generators?.generateEmail) {
                currentData.email = window.generators.generateEmail(currentData.username || 'user');
            }
        }

        lockedFields.forEach(field => {
            if (lockedValues[field] !== undefined) {
                currentData[field] = lockedValues[field];
            }
        });

        updateUI();
        saveDataToStorage();
        showToast('AI 生成成功');
    } catch (e) {
        log.error('AI generation failed:', e);
        showToast('AI 生成失败: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function normalizeApiUrl(baseUrl) {
    let url = (baseUrl || '').trim();
    if (url.endsWith('/')) url = url.slice(0, -1);

    if (url.endsWith('/chat/completions')) return url;
    if (url.endsWith('/v1')) return url + '/chat/completions';
    return url + '/v1/chat/completions';
}

async function testAIConnection() {
    const btn = elements.testAI;
    const originalText = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled = true;

    try {
        const apiKey = elements.openaiKey.value.trim();
        const baseUrl = elements.openaiBaseUrl.value.trim();
        const model = elements.openaiModel.value.trim();

        if (!apiKey) {
            throw new Error('请输入 API Key');
        }

        const apiUrl = normalizeApiUrl(baseUrl);
        const granted = await ensureHostPermission(apiUrl);
        if (!granted) {
            throw new Error('未授予 AI 接口站点权限，无法请求。');
        }

        const response = await fetchWithTimeout(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5
            })
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
        }

        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`返回了非 JSON 数据。预览: ${text.slice(0, 80)}`);
        }

        await response.json();
        showToast('✅ 连接成功');
    } catch (e) {
        log.error('AI test failed:', e);
        showToast('❌ 连接失败: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

