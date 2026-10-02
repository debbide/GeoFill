/**
 * Background Script - shortcut and data cleanup support.
 */

const STORAGE_KEY = 'geoFillCachedData';
const AUTO_CLEAR_KEY = 'geoFillAutoClear';

// 与 popup/js/utils.js 中的 CONTENT_SCRIPT_FILES 保持同步
const CONTENT_SCRIPT_FILES = [
  'scripts/selectors/common.js',
  'scripts/country-extensions.js',
  'scripts/selectors/japan.js',
  'scripts/content/10-dom.js',
  'scripts/content/20-intent.js',
  'scripts/content/30-format.js',
  'scripts/content/40-controls.js',
  'scripts/content/50-diagnostics.js',
  'scripts/content/60-fill.js',
  'scripts/content/70-scan.js',
  'scripts/content/80-smart.js',
  'scripts/content/90-main.js'
];

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'geofill-fill',
      title: 'GeoFill - 打开面板',
      contexts: ['page', 'editable']
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
createContextMenu();

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'geofill-fill') {
    try {
      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
      } else if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
        await browser.action.openPopup();
      }
    } catch (error) {
      console.error('[GeoFill] 打开面板失败:', error);
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fill-form') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const cached = result[STORAGE_KEY];
        if (cached && cached.currentData) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'fillForm',
              data: cached.currentData
            });
          } catch (sendErr) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: CONTENT_SCRIPT_FILES
            });
            // 子 frame 尽力注入（iframe 内表单），跨域或特殊页面失败则跳过
            try {
              const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
              for (const frame of frames || []) {
                if (frame.frameId === 0) continue;
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id, frameIds: [frame.frameId] },
                    files: CONTENT_SCRIPT_FILES
                  });
                } catch (e) { /* 跨域 frame 跳过 */ }
              }
            } catch (e) { /* webNavigation 不可用则只填主 frame */ }
            await chrome.tabs.sendMessage(tab.id, {
              action: 'fillForm',
              data: cached.currentData
            });
          }
        }
      } catch (error) {
        console.error('[GeoFill] 填写表单失败:', error);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message) return;
    // popup 发来的消息没有 sender.tab，用消息里带的 tabId
    const tabId = Number(message.tabId) || (sender.tab && sender.tab.id);
    if (!tabId) return;

    // 多步骤表单：content script 发现新步骤字段，badge 提示 + 存待办
    if (message.action === 'multistepFieldsDetected') {
        const count = Math.max(1, Math.min(99, Number(message.newFieldCount) || 1));
        try {
            chrome.action.setBadgeText({ text: String(count), tabId }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ color: '#ff453a', tabId }).catch(() => {});
            chrome.storage.local.set({
                geoFillStepPending: { tabId, count, ts: Date.now() }
            }).catch(() => {});
        } catch (e) { /* 忽略 */ }
    } else if (message.action === 'clearStepBadge') {
        try {
            chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
            chrome.storage.local.remove('geoFillStepPending').catch(() => {});
        } catch (e) { /* 忽略 */ }
    }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.local.get(AUTO_CLEAR_KEY);
    if (result[AUTO_CLEAR_KEY]) {
      await chrome.storage.local.remove([STORAGE_KEY, 'geoFillLockedFields']);
    }
  } catch (error) {
    console.error('[GeoFill] 清除数据失败:', error);
  }
});
