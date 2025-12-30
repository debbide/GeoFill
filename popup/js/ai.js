/**
 * AI 相关逻辑模块
 */

/**
 * 使用 AI 生成数据
 */
async function generateWithAI() {
    const btn = elements.regenerateAll;
    const originalText = btn.textContent;
    btn.textContent = '🤖 生成中...';
    btn.disabled = true;

    try {
        const country = ipData.country || 'United States';

        // 1. 收集锁定字段，告知 AI
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

        if (country === 'Japan') {
            prompt += `\n\nIMPORTANT for Japan:
            - ZipCode: "NNN-NNNN" (e.g. 100-0001)
            - Phone: Generate a **RANDOM** mobile number "090-XXXX-XXXX" (or 080/070). **DO NOT** use "1234" or "0000".
            - Name: Kanji for First/Last name, and Katakana for reading if applicable (but return standard keys).`;
        }

        prompt += ` Return ONLY a valid JSON object with the following keys: firstName, lastName, gender (male/female), birthday (YYYY-MM-DD), username, email, password, phone, address, city, state, zipCode. Ensure the data is culturally appropriate for the country.`;

        // 构建 API URL
        const apiUrl = normalizeApiUrl(userSettings.openaiBaseUrl);
        log.info(' AI Request URL:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userSettings.openaiKey}`
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
            log.error('API Error Response:', text);
            throw new Error(`API Error (${response.status}): ${text.slice(0, 100)}...`);
        }
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            log.error('API Invalid Content-Type:', contentType, text);
            throw new Error(`API 返回了非 JSON 数据 (可能是 HTML)。请检查 API 地址是否正确。预览: ${text.slice(0, 50)}...`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // 尝试解析 JSON
        let jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const profile = JSON.parse(jsonStr);

        // 更新数据
        currentData = { ...currentData, ...profile };

        // 2. 强制应用本地规则 (如果未锁定)

        // 密码：使用本地生成器以符合长度/复杂度规则
        if (!lockedFields.has('password') && window.generators && window.generators.generatePasswordWithSettings) {
            currentData.password = window.generators.generatePasswordWithSettings(userSettings);
        }

        // 电话：使用本地生成器以保证随机性和格式正确 (AI 容易生成 1234 等假号)
        if (!lockedFields.has('phone') && window.generators && window.generators.generatePhone) {
            currentData.phone = window.generators.generatePhone(country);
        }

        // 邮箱：如果用户指定了后缀，强制应用
        if (!lockedFields.has('email')) {
            const domainType = elements.emailDomainType.value;
            if (domainType !== 'custom' && domainType !== 'temp') {
                // 使用 AI 生成的用户名 + 指定后缀
                const username = currentData.username || 'user';
                currentData.email = `${username}@${domainType}`;
            }
        }

        // 3. 再次恢复锁定字段 (双重保险)
        lockedFields.forEach(field => {
            if (lockedValues[field] !== undefined) {
                currentData[field] = lockedValues[field];
            }
        });

        updateUI();
        saveDataToStorage();
        showToast('AI 生成成功');

    } catch (e) {
        log.error('AI Generation failed:', e);
        showToast('AI 生成失败: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * 构建标准化的 API URL
 */
function normalizeApiUrl(baseUrl) {
    let url = baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);

    if (url.endsWith('/chat/completions')) {
        return url;
    }

    if (url.endsWith('/v1')) {
        return url + '/chat/completions';
    }

    // 如果既没有 v1 也没有 chat/completions，尝试添加 /v1/chat/completions
    // 这是一个猜测，但能覆盖大多数漏写 /v1 的情况
    return url + '/v1/chat/completions';
}

/**
 * 测试 AI 连接
 */
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
        log.info(' Test API URL:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Hi' }
                ],
                max_tokens: 5
            })
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
        }

        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`返回了非 JSON 数据 (HTML?)。请检查 API 地址。预览: ${text.slice(0, 50)}`);
        }

        await response.json(); // 尝试解析
        showToast('✅ 连接成功');
    } catch (e) {
        log.error('AI Test Failed:', e);
        showToast('❌ 连接失败: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
