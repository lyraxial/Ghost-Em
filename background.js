chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'togglePanel' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not loaded, injecting...');
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            }, () => {
              if (!chrome.runtime.lastError) {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabs[0].id, { action: 'showPanel' });
                }, 1000);
              }
            });
          }
        });
      }
    });
  }
});
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
    chrome.tabs.sendMessage(tab.id, { action: 'showPanel' }, (response) => {
      if (chrome.runtime.lastError) {
        chrome.tabs.reload(tab.id);
      }
    });
  }
});