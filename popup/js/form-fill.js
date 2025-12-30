/**
 * 表单填写功能
 */

/**
 * 在页面中填写表单
 */
async function fillFormInPage() {
    updateCurrentDataFromInputs();
    const btn = elements.fillForm;
    const originalText = btn.textContent;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 检查 AI 开关是否开启（主界面开关）
        const useAI = elements.useAIToggle?.checked && userSettings.openaiKey;
        if (useAI) {
            btn.textContent = '🤖 分析中...';
            btn.disabled = true;

            // 1. 扫描页面表单
            const scanResult = await sendMessageToTab(tab.id, { action: 'scanForm' });

            if (!scanResult || !scanResult.fields || scanResult.fields.length === 0) {
                throw new Error('未找到可见的表单字段');
            }

            btn.textContent = '🧠 思考中...';

            // 2. 构建 AI Prompt
            const prompt = buildAIFormPrompt(scanResult);

            // 3. 调用 AI
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
                        { role: 'system', content: 'You are a helpful assistant that fills forms based on user profiles.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3
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
                throw new Error(`API 返回了非 JSON 数据(可能是 HTML)。请检查 API 地址是否正确。预览: ${text.slice(0, 50)}...`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            let jsonStr = content.replace(/```json\n ?|\n ? ```/g, '').trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];

            const mapping = JSON.parse(jsonStr);

            // 清洗数据
            sanitizeFormMapping(mapping, scanResult);

            log.info(' Sanitized & Overridden Mapping:', mapping);

            btn.textContent = '✍️ 填写中...';

            // 4. 发送填表指令
            await sendMessageToTab(tab.id, { action: 'fillFormSmart', data: mapping });

            showToast('AI 智能填写完成');
            saveToHistory();
            window.close();

        } else {
            // 传统逻辑
            await sendMessageToTab(tab.id, { action: 'fillForm', data: currentData });
            saveToHistory();
            window.close();
        }

    } catch (error) {
        log.error('填写表单失败:', error);
        showToast('填写失败: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * 构建 AI 表单填写 Prompt
 */
function buildAIFormPrompt(scanResult) {
    return `
You are an advanced AI Form Assistant. Your goal is to fill a web form intelligently, acting as the Persona defined below.

Current User Profile: ${JSON.stringify(currentData)}
Persona Description: ${userSettings.aiPersona || 'None'}

Page Context:
Title: ${scanResult.pageContext.title}
Description: ${scanResult.pageContext.description}
URL: ${scanResult.pageContext.url}

Form Fields Found:
${JSON.stringify(scanResult.fields)}

Instructions:
1. **Analyze Context**: Determine the purpose of this form (e.g., "Job Application", "E-commerce Checkout", "Casual Survey", "Government Registration").
2. **Analyze Fields**: For each field, evaluate:
   - **Necessity**: Is it required? (Check 'required' attribute and context).
   - **Privacy/Risk**: Is this sensitive info (e.g., Income, ID, Phone)?
3. **Decide Strategy**:
   - **Real Format**: For standard required fields, use the Persona's data.
   - **Obfuscate/Blur**: For sensitive but optional fields (like exact income), provide a general range or a realistic but safe estimate if appropriate for the context.
   - **Leave Empty**: If a field is optional, sensitive, and not relevant to the form's core purpose, you may choose to leave it empty (return null or empty string).
   - **Refuse/N/A**: If a field is intrusive and allows text input, you may fill "N/A" or "Prefer not to say".
4. **Cultural & Language Adaptation** (CRITICAL):
   - **GLOBAL RULE**: ALWAYS use **Half-width (ASCII)** characters for: **Password**, **Email**, **Phone**, **Postal Code**, **Numbers**. NEVER use Full-width (e.g., １２３, ａｂｃ) for these fields.
   - **Address Logic**: If the form expects a **Local Address** (e.g., has "Prefecture" dropdown, or specific local Zip format) and the Current User Profile has a foreign address, **IGNORE the Profile address and INVENT a valid local address** for the page's target country.
   - **Detect Language**: The page language is '${scanResult.pageContext.language}'. Adapt formats accordingly.
   - **Japan (JP)**:
     - **Name**: Use Surname First order. Use Kanji for Name fields, Katakana for "Furigana/Reading" fields.
     - **Postal Code**: Check placeholder. If unknown, try "NNN-NNNN" (ASCII).
     - **Phone**: Check placeholder. If unknown, generate a **RANDOM** valid mobile number (starts with 090, 080, or 070). **DO NOT** use "1234" or "0000" sequences. Example: "080-3928-4719".
   - **Germany (DE)**: Ensure addresses are precise (Street + Number, Zip City). Use formal tone.
   - **China (CN)**: Generate valid-looking Resident ID numbers (18 digits) if requested. Use +86 phone format.
   - **Tone**: Match the questionnaire tone (Conservative/Formal for Gov/Bank; Open/Casual for Social/Gaming).
5. **Invent Missing Data**: If the Persona lacks specific data (e.g., Company Name), invent it consistently with the Persona's background.

Output Format:
Return ONLY a valid JSON object where keys are the field 'id' and values are the string to fill.
Example:
{
  "field_1": "John",
  "income_field": "50,000 - 60,000 USD",
  "optional_intrusive_field": ""
}
`;
}

/**
 * 清洗 AI 返回的表单映射数据
 */
function sanitizeFormMapping(mapping, scanResult) {
    Object.keys(mapping).forEach(key => {
        let val = mapping[key];
        if (typeof val === 'string') {
            // 1. 全角转半角 (通用处理)
            val = val.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
                .replace(/\u3000/g, ' ');

            // 2. 查找字段元数据
            const fieldMeta = scanResult.fields.find(f => f.id === key);
            const label = fieldMeta ? (fieldMeta.label || '').toLowerCase() : '';
            const type = fieldMeta ? (fieldMeta.type || '').toLowerCase() : '';
            const name = fieldMeta ? (fieldMeta.name || '').toLowerCase() : '';
            const lowerKey = key.toLowerCase();

            // 3. 智能判断字段类型并清洗
            const isPassword = type === 'password' || lowerKey.includes('password') || name.includes('password') || label.includes('密码') || label.includes('パスワード');
            const isEmail = type === 'email' || lowerKey.includes('email') || name.includes('email') || label.includes('邮箱') || label.includes('メール');
            const isPhone = type === 'tel' || lowerKey.includes('phone') || lowerKey.includes('mobile') || label.includes('电话') || label.includes('電話') || label.includes('携帯');
            const isZip = lowerKey.includes('zip') || lowerKey.includes('postal') || label.includes('邮编') || label.includes('郵便');

            if (isPassword) {
                // 密码：强制使用当前 Profile 的密码
                if (currentData.password) {
                    val = currentData.password;
                } else if (window.generators && window.generators.generatePasswordWithSettings) {
                    val = window.generators.generatePasswordWithSettings(userSettings);
                } else {
                    val = val.replace(/[^\x00-\x7F]/g, '');
                }
            } else if (isEmail) {
                // 邮箱：只保留 ASCII
                val = val.replace(/[^\x00-\x7F]/g, '');
            } else if (isPhone) {
                // 电话：强制使用当前 Profile 的电话
                if (currentData.phone) {
                    val = currentData.phone;
                } else if (window.generators && window.generators.generatePhone) {
                    const country = ipData.country || 'United States';
                    val = window.generators.generatePhone(country);
                } else {
                    val = val.replace(/[^\d-]/g, '');
                }
            } else if (isZip) {
                // 邮编：只保留数字和横杠
                val = val.replace(/[^\d-]/g, '');
            }

            mapping[key] = val;
        }
    });
}

/**
 * 普通填表（不使用 AI，传统方式）
 */
async function fillFormNormalInPage() {
    updateCurrentDataFromInputs();
    const btn = elements.fillFormNormal;
    const originalText = btn.textContent;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        await sendMessageToTab(tab.id, { action: 'fillForm', data: currentData });
        saveToHistory();
        showToast('普通填表完成');
        window.close();

    } catch (error) {
        log.error('普通填表失败:', error);
        showToast('填写失败: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// copyAllToClipboard 已在 utils.js 中定义
