document.addEventListener('DOMContentLoaded', async () => {
    const currentPageElement = document.getElementById('currentPage');
    const currentUserElement = document.getElementById('currentUser');
    const statusElement = document.getElementById('status');
    const openPanelBtn = document.getElementById('openPanel');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
            const url = new URL(tab.url);
            if (url.hostname === 'x.com' || url.hostname === 'twitter.com') {
                currentPageElement.textContent = url.hostname;
                currentPageElement.style.color = '#16a34a';
                
                const pathMatch = url.pathname.match(/^\/([^\/]+)/);
                if (pathMatch && pathMatch[1] !== 'home' && pathMatch[1] !== 'explore') {
                    currentUserElement.textContent = '@' + pathMatch[1];
                } else {
                    currentUserElement.textContent = 'Home/Timeline';
                }
                
                statusElement.textContent = 'Ready';
                statusElement.style.color = '#16a34a';
                openPanelBtn.disabled = false;
            } else {
                currentPageElement.textContent = 'Not on X.com';
                currentPageElement.style.color = '#f4212e';
                currentUserElement.textContent = 'N/A';
                statusElement.textContent = 'Navigate to X.com';
                statusElement.style.color = '#f4212e';
                openPanelBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error getting tab info:', error);
        currentPageElement.textContent = 'Error';
        statusElement.textContent = 'Error loading';
    }
    
    openPanelBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const url = new URL(tab.url);
            if (url.hostname !== 'x.com' && url.hostname !== 'twitter.com') {
                statusElement.textContent = 'Navigate to X.com first';
                statusElement.style.color = '#f4212e';
                return;
            }
            
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'showPanel' });
                window.close();
            } catch (messageError) {
                statusElement.textContent = 'Reloading page...';
                statusElement.style.color = '#1d9bf0';
                
                await chrome.tabs.reload(tab.id);
                
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { action: 'showPanel' });
                        window.close();
                    } catch (retryError) {
                        statusElement.textContent = 'Refresh page manually';
                        statusElement.style.color = '#f4212e';
                    }
                }, 2000);
            }
            
        } catch (error) {
            console.error('Error opening panel:', error);
            statusElement.textContent = 'Error - try refreshing page';
            statusElement.style.color = '#f4212e';
        }
    });
    
    chrome.storage.sync.get(['confirmEach', 'delayMs'], (result) => {
        if (result.confirmEach !== undefined) {
            document.getElementById('confirmEach').checked = result.confirmEach;
        }
        if (result.delayMs !== undefined) {
            document.getElementById('delayMs').value = result.delayMs;
        }
    });
    
    document.getElementById('confirmEach').addEventListener('change', (e) => {
        chrome.storage.sync.set({ confirmEach: e.target.checked });
    });
    
    document.getElementById('delayMs').addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value >= 1000 && value <= 10000) {
            chrome.storage.sync.set({ delayMs: value });
        }
    });
});