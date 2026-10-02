/**
 * Email domain helpers.
 */

/**
 * Regenerate email from the current username and selected domain.
 */
async function regenerateEmail() {
    if (!window.generators) return;

    if (lockedFields.has('email')) {
        showToast('邮箱已锁定，跳过生成');
        return;
    }

    updateCurrentDataFromInputs();

    currentData.email = window.generators.generateEmail(currentData.username);

    if (elements.fields.email) {
        elements.fields.email.value = currentData.email;
    }
}
