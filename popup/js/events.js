/**
 * 事件绑定模块
 */

// ============ 核心处理函数 ============

/**
 * 处理重新生成全部数据
 */
async function handleRegenerateAll() {
    if (!window.generators) return;

    const btn = elements.regenerateAll;
    const loading = showLoading(btn, '🔄 生成中...');

    try {
        // 检查 AI 开关是否开启
        const useAI = elements.useAIToggle?.checked && userSettings.openaiKey;
        if (useAI) {
            loading.restore();
            await generateWithAI();
            return;
        }

        // 保存锁定字段的值
        const lockedValues = {};
        lockedFields.forEach(field => {
            lockedValues[field] = currentData[field];
        });

        // 生成新数据
        currentData = window.generators.generateAllInfoWithSettings(ipData, userSettings);

        // 尝试获取真实地址
        await tryFetchRealAddress(lockedValues);

        // 恢复锁定字段的值
        lockedFields.forEach(field => {
            if (lockedValues[field] !== undefined) {
                currentData[field] = lockedValues[field];
            }
        });

        updateUI();
        saveDataToStorage();
        showToast('数据已生成');

    } catch (error) {
        handleError(error, '生成数据');
    } finally {
        loading.restore();
    }
}

/**
 * 尝试获取真实地址
 */
async function tryFetchRealAddress(lockedValues) {
    if (!await shouldUseAddressApi({ allowApi: true, requestPermission: true }) || !window.generators.generateAddressAsync || lockedFields.has('address')) {
        return;
    }

    try {
        const realAddress = await generateAddressForCurrentContext(lockedValues, {
            allowApi: true
        });

        if (applyGeneratedAddress(realAddress, { forceAddress: true })) {
            showAddressUpdatedToast(realAddress);
        }
    } catch (e) {
        log.info('地址 API 调用失败:', e);
    }
}

/**
 * 处理国家切换
 */
async function handleCountryChange() {
    if (!window.generators) return;

    const newCountry = elements.fields.country.value;
    ipData.country = newCountry;
    ipData.city = '';
    ipData.region = '';
    currentData.addressSource = '';
    currentData.addressConfidence = '';
    currentData.addressLastUpdatedAt = '';

    // 保存锁定字段的值
    const lockedValues = {};
    lockedFields.forEach(field => {
        lockedValues[field] = currentData[field];
    });

    currentData = window.generators.generateAllInfoWithSettings(ipData, userSettings);

    // 恢复锁定字段的值
    lockedFields.forEach(field => {
        if (lockedValues[field] !== undefined) {
            currentData[field] = lockedValues[field];
        }
    });

    if (!lockedFields.has('address') && window.generators.generateAddressAsync) {
        try {
            const syncedAddress = await generateAddressForCurrentContext(lockedValues, {
                forceRefresh: true,
                allowApi: false
            });
            applyGeneratedAddress(syncedAddress, { forceAddress: true });
        } catch (e) {
            log.info('切换国家后同步地址失败:', e);
        }
    }

    updateUI();
    saveDataToStorage();
    showToast(`已切换到 ${newCountry}`);
}

/**
 * 处理单字段刷新
 */
async function handleFieldRefresh(fieldName) {
    if (!window.generators) return;

    // 如果字段被锁定，不进行刷新
    if (lockedFields.has(fieldName)) {
        showToast(`${fieldName} 已锁定，无法刷新`);
        return;
    }

    updateCurrentDataFromInputs();
    if (fieldName === 'address' && window.generators.generateAddressAsync) {
        try {
            showToast('正在刷新地址...');
            const realAddress = await generateAddressForCurrentContext({}, {
                forceRefresh: true,
                allowApi: await shouldUseAddressApi({ allowApi: true, requestPermission: true })
            });
            if (applyGeneratedAddress(realAddress, { forceAddress: true })) {
                updateUI();
                saveDataToStorage();
                showAddressUpdatedToast(realAddress);
                return;
            }
        } catch (e) {
            log.info('刷新地址失败，使用普通生成:', e);
        }
    }

    const result = window.generators.regenerateField(fieldName, currentData, ipData);

    if (result && result._isLocationUpdate) {
        // 位置更新时也要检查锁定状态
        if (!lockedFields.has('city')) {
            currentData.city = result.city;
            if (elements.fields.city) elements.fields.city.value = result.city;
        }
        if (!lockedFields.has('state')) {
            currentData.state = result.state;
            if (elements.fields.state) elements.fields.state.value = result.state;
        }
        if (!lockedFields.has('zipCode')) {
            currentData.zipCode = result.zipCode;
            if (elements.fields.zipCode) elements.fields.zipCode.value = result.zipCode;
        }

        if (!lockedFields.has('address') && window.generators.generateAddressAsync) {
            try {
                const syncedAddress = await generateAddressForCurrentContext({}, {
                    forceRefresh: true,
                    allowApi: false
                });
                if (applyGeneratedAddress(syncedAddress, { forceAddress: true })) {
                    showAddressUpdatedToast(syncedAddress);
                }
            } catch (e) {
                log.info('同步同城地址失败:', e);
            }
        }

        updateUI();
    } else {
        currentData[fieldName] = result;
        if (elements.fields[fieldName]) {
            elements.fields[fieldName].value = currentData[fieldName];
        }
    }
    saveDataToStorage();
}

/**
 * 处理邮箱域名类型切换
 */
function handleEmailDomainChange() {
    const domain = elements.emailDomainType.value;

    if (domain === 'custom') {
        if (elements.customDomain) elements.customDomain.style.display = 'block';
        if (elements.customDomain?.value?.trim() && window.generators) {
            window.generators.setCustomEmailDomain(elements.customDomain.value.trim());
            regenerateEmail();
        }
    } else {
        if (elements.customDomain) elements.customDomain.style.display = 'none';
        if (window.generators) {
            window.generators.setCustomEmailDomain(domain);
            regenerateEmail();
        }
    }
    saveDataToStorage();
}

/**
 * 处理 IP 刷新
 */
async function handleIPRefresh() {
    const btn = elements.ipRefresh;
    const loading = showLoading(btn, '🔄');

    try {
        await fetchIPInfo();
        showToast('已更新位置信息');
    } catch (error) {
        handleError(error, 'IP 检测');
    } finally {
        loading.restore();
    }
}

// ============ 事件绑定 ============

/**
 * 绑定所有事件处理器
 */
function bindEvents() {
    // 主题切换
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // IP 刷新
    if (elements.ipRefresh) {
        elements.ipRefresh.addEventListener('click', handleIPRefresh);
    }

    // 重新生成全部
    if (elements.regenerateAll) {
        elements.regenerateAll.addEventListener('click', handleRegenerateAll);
    }

    // 填表
    if (elements.fillForm) {
        elements.fillForm.addEventListener('click', fillFormInPage);
    }

    // 填写报告关闭
    if (elements.fillReportDismiss) {
        elements.fillReportDismiss.addEventListener('click', hideFillReport);
    }

    // AI 开关
    if (elements.useAIToggle) {
        elements.useAIToggle.addEventListener('change', () => {
            chrome.storage.local.set({ 'geoFillUseAI': elements.useAIToggle.checked });
        });
    }

    // 地址 API 默认关闭；开启时再申请外部地址接口权限。
    if (elements.useAddressApiToggle) {
        elements.useAddressApiToggle.addEventListener('change', async () => {
            if (elements.useAddressApiToggle.checked) {
                const granted = await ensureAddressApiPermission({ requestIfMissing: true });
                if (granted) {
                    await saveAddressApiToggle(true);
                    showToast('地址 API 已开启');
                }
                return;
            }

            await saveAddressApiToggle(false);
            showToast('地址 API 已关闭，使用本地地址池');
        });
    }

    // 锁定按钮
    document.querySelectorAll('.lock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldName = e.currentTarget.dataset.field;
            toggleLock(fieldName, e.currentTarget);
        });
    });

    // 复制按钮
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldName = e.currentTarget.dataset.field;
            const value = currentData[fieldName] || elements.fields[fieldName]?.value;
            if (value) {
                copyToClipboard(value, e.currentTarget);
            }
        });
    });

    // 单字段刷新按钮
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            await handleFieldRefresh(e.currentTarget.dataset.field);
        });
    });

    // 地址质量徽章详情
    if (elements.addressQualityBadge) {
        elements.addressQualityBadge.addEventListener('click', showAddressQualityDetail);
    }

    // 字段输入事件
    FIELD_NAMES.forEach(name => {
        if (elements.fields[name]) {
            const handler = () => {
                currentData[name] = elements.fields[name].value;
                saveDataToStorage();
            };
            elements.fields[name].addEventListener('input', handler);
            elements.fields[name].addEventListener('change', handler);
        }
    });

    // 国家切换
    if (elements.fields.country) {
        elements.fields.country.addEventListener('change', handleCountryChange);
    }

    // 邮箱域名类型切换
    if (elements.emailDomainType) {
        elements.emailDomainType.addEventListener('change', handleEmailDomainChange);
    }

    // 自定义域名输入
    if (elements.customDomain) {
        elements.customDomain.addEventListener('input', () => {
            const domain = elements.customDomain.value.trim();
            if (domain && window.generators) {
                window.generators.setCustomEmailDomain(domain);
                regenerateEmail();
            }
            saveDataToStorage();
        });
    }

    // 绑定设置相关事件
    bindSettingsEvents();
}

/**
 * 绑定设置相关事件
 */
function bindSettingsEvents() {
    // 设置模态框
    if (elements.openSettings) {
        elements.openSettings.addEventListener('click', openSettingsModal);
    }
    if (elements.closeSettings) {
        elements.closeSettings.addEventListener('click', closeSettingsModal);
    }
    if (elements.settingsModal) {
        elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // 复制全部
    if (elements.copyAll) {
        elements.copyAll.addEventListener('click', copyAllToClipboard);
    }

    // 存档
    if (elements.saveArchive) {
        elements.saveArchive.addEventListener('click', saveArchive);
    }

    // AI 测试
    if (elements.testAI) {
        elements.testAI.addEventListener('click', testAIConnection);
    }

    // 存档列表
    if (elements.archiveList) {
        elements.archiveList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);

            if (action === 'load') {
                loadArchive(index);
            } else if (action === 'delete') {
                deleteArchive(index);
            }
        });
    }

    // 设置输入项自动保存
    const settingInputs = [
        'enableAI', 'openaiBaseUrl', 'openaiKey', 'openaiModel', 'aiPersona',
        'passwordLength', 'pwdUppercase', 'pwdLowercase', 'pwdNumbers', 'pwdSymbols',
        'minAge', 'maxAge', 'autoClearData'
    ];
    settingInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveSettings);
        }
    });

    // Geoapify API Key
    if (elements.geoapifyKey) {
        elements.geoapifyKey.addEventListener('change', saveGeoapifyKey);
        elements.geoapifyKey.addEventListener('blur', saveGeoapifyKey);
    }

    // 自托管地址服务配置
    if (elements.selfHostedAddrUrl) {
        elements.selfHostedAddrUrl.addEventListener('change', saveSelfHostedAddressConfig);
        elements.selfHostedAddrUrl.addEventListener('blur', saveSelfHostedAddressConfig);
    }
    if (elements.selfHostedAddrToken) {
        elements.selfHostedAddrToken.addEventListener('change', saveSelfHostedAddressConfig);
        elements.selfHostedAddrToken.addEventListener('blur', saveSelfHostedAddressConfig);
    }

    // 历史记录
    bindHistoryEvents();
}

/**
 * 绑定历史记录相关事件
 */
function bindHistoryEvents() {
    if (elements.openHistory) {
        elements.openHistory.addEventListener('click', () => {
            if (elements.historyModal) {
                elements.historyModal.classList.add('show');
                loadHistoryList();
            }
        });
    }

    if (elements.closeHistory) {
        elements.closeHistory.addEventListener('click', () => {
            if (elements.historyModal) {
                elements.historyModal.classList.remove('show');
            }
        });
    }

    if (elements.historyModal) {
        elements.historyModal.addEventListener('click', (e) => {
            if (e.target === elements.historyModal) {
                elements.historyModal.classList.remove('show');
            }
        });
    }

    if (elements.clearHistory) {
        elements.clearHistory.addEventListener('click', () => {
            if (confirm('确定要清空所有历史记录吗？')) {
                clearAllHistory();
            }
        });
    }
}

