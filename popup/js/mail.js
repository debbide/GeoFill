/**
 * 临时邮箱模块
 */

/**
 * 重新生成邮箱
 */
async function regenerateEmail() {
    if (!window.generators) return;

    // 如果邮箱被锁定，不进行任何操作
    if (lockedFields.has('email')) {
        showToast('邮箱已锁定，跳过生成');
        return;
    }

    updateCurrentDataFromInputs();

    const domainType = elements.emailDomainType?.value;

    if (domainType === 'temp' && window.mailTM) {
        try {
            showToast('正在注册临时邮箱...');
            // 使用当前密码作为邮箱密码
            const account = await window.mailTM.register(currentData.username, currentData.password);
            currentData.email = account.address;
            if (elements.inboxGroup) elements.inboxGroup.style.display = 'block';
            refreshInbox();
        } catch (e) {
            log.error('Temp mail registration failed:', e);
            showToast('临时邮箱注册失败，使用默认邮箱');
            currentData.email = window.generators.generateEmail(currentData.username);
            if (elements.inboxGroup) elements.inboxGroup.style.display = 'none';
        }
    } else {
        currentData.email = window.generators.generateEmail(currentData.username);
        if (elements.inboxGroup) elements.inboxGroup.style.display = 'none';
    }

    if (elements.fields.email) {
        elements.fields.email.value = currentData.email;
    }
}

/**
 * 刷新收件箱
 */
async function refreshInbox() {
    if (!window.mailTM || !window.mailTM.token) return;

    if (elements.refreshInbox) {
        elements.refreshInbox.classList.add('rotating');
    }

    try {
        const messages = await window.mailTM.getMessages();
        renderInbox(messages);
        showToast('收件箱已更新');
    } catch (e) {
        log.error('Fetch messages failed:', e);
    } finally {
        if (elements.refreshInbox) {
            elements.refreshInbox.classList.remove('rotating');
        }
    }
}
