/**
 * 历史记录管理模块
 */

/**
 * 保存当前数据到历史记录
 */
async function saveToHistory() {
    if (!currentData || !currentData.firstName) return;

    try {
        const result = await chrome.storage.local.get(HISTORY_KEY);
        let history = result[HISTORY_KEY] || [];

        // 创建历史记录项
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            data: { ...currentData },
            country: ipData.country || 'Unknown'
        };

        // 检查是否已存在相同邮箱的记录，避免重复
        const existingIndex = history.findIndex(item => item.data.email === currentData.email);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // 添加到开头
        history.unshift(historyItem);

        // 限制数量
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS);
        }

        await chrome.storage.local.set({ [HISTORY_KEY]: history });
        log.info(' 已保存到历史记录');
    } catch (e) {
        log.info('保存历史记录失败:', e);
    }
}

/**
 * 加载历史记录列表
 */
async function loadHistoryList() {
    try {
        const result = await chrome.storage.local.get(HISTORY_KEY);
        const history = result[HISTORY_KEY] || [];
        renderHistoryList(history);
    } catch (e) {
        log.info('加载历史记录失败:', e);
    }
}

/**
 * 加载历史记录项
 */
async function loadHistoryItem(id) {
    try {
        const result = await chrome.storage.local.get(HISTORY_KEY);
        const history = result[HISTORY_KEY] || [];
        const item = history.find(h => h.id === id);

        if (item && item.data) {
            // 保存锁定字段的当前值
            const lockedValues = {};
            lockedFields.forEach(field => {
                lockedValues[field] = currentData[field];
            });

            // 加载历史数据
            currentData = { ...item.data };
            ipData.country = item.country || currentData.country || 'United States';

            // 恢复锁定字段的值
            lockedFields.forEach(field => {
                if (lockedValues[field] !== undefined) {
                    currentData[field] = lockedValues[field];
                }
            });

            updateUI();
            saveDataToStorage();

            // 关闭模态框
            if (elements.historyModal) {
                elements.historyModal.classList.remove('show');
            }

            const lockedCount = lockedFields.size;
            if (lockedCount > 0) {
                showToast(`已加载历史记录（${lockedCount}个锁定字段已保留）`);
            } else {
                showToast('已加载历史记录');
            }
        } else {
            showToast('历史记录不存在');
        }
    } catch (e) {
        log.info('加载历史记录项失败:', e);
        showToast('加载历史记录失败');
    }
}

/**
 * 删除历史记录项
 */
async function deleteHistoryItem(id) {
    try {
        const result = await chrome.storage.local.get(HISTORY_KEY);
        let history = result[HISTORY_KEY] || [];
        history = history.filter(h => h.id !== id);

        await chrome.storage.local.set({ [HISTORY_KEY]: history });
        renderHistoryList(history);
        showToast('已删除');
    } catch (e) {
        log.info('删除历史记录项失败:', e);
        showToast('删除失败');
    }
}

/**
 * 清空所有历史记录
 */
async function clearAllHistory() {
    try {
        await chrome.storage.local.remove(HISTORY_KEY);
        renderHistoryList([]);
        showToast('历史记录已清空');
    } catch (e) {
        log.info('清空历史记录失败:', e);
        showToast('清空失败');
    }
}
