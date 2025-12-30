/**
 * 存档管理模块
 */

/**
 * 保存存档
 */
async function saveArchive() {
    const name = elements.archiveName?.value?.trim();
    if (!name) {
        showToast('请输入存档名称');
        return;
    }

    updateCurrentDataFromInputs();

    try {
        const result = await chrome.storage.local.get(ARCHIVES_KEY);
        const archives = result[ARCHIVES_KEY] || [];

        const existingIndex = archives.findIndex(a => a.name === name);
        const archiveData = {
            name,
            data: { ...currentData },
            timestamp: Date.now()
        };

        if (existingIndex >= 0) {
            archives[existingIndex] = archiveData;
            showToast(`存档 "${name}" 已更新`);
        } else {
            archives.push(archiveData);
            showToast(`存档 "${name}" 已保存`);
        }

        await chrome.storage.local.set({ [ARCHIVES_KEY]: archives });
        if (elements.archiveName) elements.archiveName.value = '';
        await loadArchiveList();
    } catch (e) {
        log.info('保存存档失败:', e);
        showToast('保存失败');
    }
}

/**
 * 加载存档列表
 */
async function loadArchiveList() {
    try {
        const result = await chrome.storage.local.get(ARCHIVES_KEY);
        const archives = result[ARCHIVES_KEY] || [];
        renderArchiveList(archives);
    } catch (e) {
        log.info('加载存档列表失败:', e);
    }
}

/**
 * 加载存档
 */
async function loadArchive(index) {
    try {
        const result = await chrome.storage.local.get(ARCHIVES_KEY);
        const archives = result[ARCHIVES_KEY] || [];

        if (archives[index]) {
            // 保存锁定字段的当前值
            const lockedValues = {};
            lockedFields.forEach(field => {
                lockedValues[field] = currentData[field];
            });

            // 加载存档数据
            currentData = { ...archives[index].data };

            // 恢复锁定字段的值
            lockedFields.forEach(field => {
                if (lockedValues[field] !== undefined) {
                    currentData[field] = lockedValues[field];
                }
            });

            updateUI();
            saveDataToStorage();
            closeSettingsModal();

            const lockedCount = lockedFields.size;
            if (lockedCount > 0) {
                showToast(`已加载存档（${lockedCount}个锁定字段已保留）`);
            } else {
                showToast(`已加载存档 "${archives[index].name}"`);
            }
        } else {
            showToast('存档不存在');
        }
    } catch (e) {
        log.info('加载存档失败:', e);
        showToast('加载存档失败');
    }
}

/**
 * 删除存档
 */
async function deleteArchive(index) {
    try {
        const result = await chrome.storage.local.get(ARCHIVES_KEY);
        const archives = result[ARCHIVES_KEY] || [];

        if (archives[index]) {
            const name = archives[index].name;
            archives.splice(index, 1);
            await chrome.storage.local.set({ [ARCHIVES_KEY]: archives });
            await loadArchiveList();
            showToast(`存档 "${name}" 已删除`);
        }
    } catch (e) {
        log.info('删除存档失败:', e);
        showToast('删除存档失败');
    }
}

/**
 * 打开设置模态框
 */
function openSettingsModal() {
    if (elements.settingsModal) {
        elements.settingsModal.classList.add('show');
        updateSettingsUI();
        loadArchiveList();
    }
}

/**
 * 关闭设置模态框
 */
function closeSettingsModal() {
    if (elements.settingsModal) {
        elements.settingsModal.classList.remove('show');
    }
}
