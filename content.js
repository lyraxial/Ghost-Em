class XPostDeleter {
  constructor() {
    this.isRunning = false;
    this.deletedCount = 0;
    this.currentUser = null;
    this.init();
  }

  init() {
    this.getCurrentUser();
    this.createControlPanel();
    this.observePageChanges();
    this.checkAutoStart();
  }

  checkAutoStart() {
    const storedAction = sessionStorage.getItem('xDeleterAction');
    if (storedAction) {
      try {
        const action = JSON.parse(storedAction);
        if (action.autoStart) {
          console.log('Auto-starting deletion:', action.type);
          sessionStorage.removeItem('xDeleterAction');
          setTimeout(() => {
            const delayInput = document.getElementById('delay-ms');
            const confirmInput = document.getElementById('confirm-each');
            
            if (delayInput) delayInput.value = action.delay;
            if (confirmInput) confirmInput.checked = action.confirmEach;
            const confirmed = confirm(`Auto-continuing deletion of your ${action.type}. This action cannot be undone.`);
            if (confirmed) {
              this.executeDeletion(action.type);
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Error parsing stored action:', error);
        sessionStorage.removeItem('xDeleterAction');
      }
    }
  }

  getCurrentUser() {
    setTimeout(() => {
      this.detectUser();
    }, 2000);
    
    this.detectUser();
  }

  detectUser() {
    const detectionMethods = [
      () => {
        const profileLinks = document.querySelectorAll('a[href^="/"]');
        for (const link of profileLinks) {
          const href = link.getAttribute('href');
          if (href && href.match(/^\/[a-zA-Z0-9_]+$/)) {
            const text = link.textContent.toLowerCase();
            if (text.includes('profile') || link.getAttribute('aria-label')?.toLowerCase().includes('profile')) {
              return href.substring(1);
            }
          }
        }
        return null;
      },
      () => {
        const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
        if (switcher) {
          const img = switcher.querySelector('img');
          if (img && img.src) {
            const match = img.src.match(/\/profile_images\/\d+\/[^\/]+\/(.+)_/);
            if (match) return match[1];
          }
        }
        return null;
      },
      () => {
        const navLinks = document.querySelectorAll('nav a, [role="navigation"] a');
        for (const link of navLinks) {
          const href = link.getAttribute('href');
          if (href && href.match(/^\/[a-zA-Z0-9_]{1,15}$/)) {
            const ariaLabel = link.getAttribute('aria-label') || '';
            if (ariaLabel.toLowerCase().includes('profile')) {
              return href.substring(1);
            }
          }
        }
        return null;
      },
      () => {
        const editBtn = document.querySelector('[data-testid="editProfileButton"]');
        if (editBtn) {
          const url = window.location.pathname;
          const match = url.match(/^\/([a-zA-Z0-9_]+)/);
          if (match) return match[1];
        }
        return null;
      },
      () => {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';
          const match = content.match(/"screen_name":"([^"]+)"/);
          if (match) return match[1];
        }
        return null;
      },
      () => {
        const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (tweetBox) {
          const container = tweetBox.closest('[data-testid="tweet-composer"]') || tweetBox.closest('[role="main"]');
          if (container) {
            const userLinks = container.querySelectorAll('a[href^="/"]');
            for (const link of userLinks) {
              const href = link.getAttribute('href');
              if (href && href.match(/^\/[a-zA-Z0-9_]{1,15}$/)) {
                return href.substring(1);
              }
            }
          }
        }
        return null;
      }
    ];

    for (let i = 0; i < detectionMethods.length; i++) {
      try {
        const result = detectionMethods[i]();
        if (result && result !== 'home' && result !== 'explore' && result !== 'notifications') {
          this.currentUser = result;
          const userSpan = document.getElementById('current-user');
          if (userSpan) {
            userSpan.textContent = this.currentUser;
          }
          return;
        }
      } catch (error) {
        console.log(`Detection method ${i + 1} failed:`, error);
      }
    }

    console.log('Could not detect current user');
  }

  createControlPanel() {
    const existing = document.getElementById('x-post-deleter-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'x-post-deleter-panel';
    panel.className = 'x-deleter-panel';
    panel.innerHTML = `
      <div class="x-deleter-header">
        <h3>Ghost Em</h3>
        <button id="x-deleter-close">×</button>
      </div>
      <div class="x-deleter-content">
        <div class="x-deleter-stats">
          <p>User: <span id="current-user">${this.currentUser || 'Unknown'}</span></p>
          <p>Deleted: <span id="deleted-count">0</span></p>
          <p>Mode: <span id="current-mode">All</span></p>
        </div>
        
        <div class="x-deleter-filters">
          <h4>Filters</h4>
          <div class="filter-row">
            <label>Content contains:</label>
            <input type="text" id="keyword-filter" placeholder="keyword, phrase, etc.">
          </div>
          <div class="filter-row">
            <label>Hashtag:</label>
            <input type="text" id="hashtag-filter" placeholder="#hashtag">
          </div>
          <div class="filter-row">
            <label>Platform:</label>
            <select id="platform-filter">
              <option value="all">All Sources</option>
              <option value="web">Twitter Web App</option>
              <option value="iphone">Twitter for iPhone</option>
              <option value="android">Twitter for Android</option>
              <option value="tweetdeck">TweetDeck</option>
            </select>
          </div>
          <div class="filter-row">
            <label>Engagement:</label>
            <select id="engagement-filter">
              <option value="all">All Posts</option>
              <option value="no-likes">0 Likes</option>
              <option value="no-retweets">0 Retweets</option>
              <option value="no-engagement">No Engagement</option>
              <option value="low-engagement">< 5 Engagements</option>
            </select>
          </div>
          <div class="filter-row">
            <label>Date Range:</label>
            <select id="date-filter">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="year">This Year</option>
              <option value="old">Older than 1 year</option>
            </select>
          </div>
          <div class="filter-row">
            <label>Reply Type:</label>
            <select id="reply-filter">
              <option value="all">All</option>
              <option value="mentions">@ Mentions</option>
              <option value="threads">Thread Replies</option>
              <option value="conversations">Conversations</option>
            </select>
          </div>
          <div class="filter-row">
            <label>Content Type:</label>
            <div class="checkbox-group">
              <label><input type="checkbox" id="has-links"> Has Links</label>
              <label><input type="checkbox" id="has-images"> Has Images</label>
              <label><input type="checkbox" id="has-videos"> Has Videos</label>
              <label><input type="checkbox" id="has-gifs"> Has GIFs</label>
            </div>
          </div>
        </div>

        <div class="x-deleter-controls">
          <button id="delete-posts-btn" class="x-deleter-btn">Delete Posts</button>
          <button id="delete-replies-btn" class="x-deleter-btn">Delete Replies</button>
          <button id="delete-filtered-btn" class="x-deleter-btn">Delete Filtered</button>
          <button id="delete-all-btn" class="x-deleter-btn danger">Delete All</button>
          <button id="stop-deletion-btn" class="x-deleter-btn" style="display:none;">Stop</button>
        </div>
        
        <div class="x-deleter-options">
          <label>
            <input type="checkbox" id="confirm-each"> Confirm each deletion
          </label>
          <label>
            <input type="checkbox" id="dry-run"> Dry run (preview only)
          </label>
          <label>
            <input type="number" id="delay-ms" min="100" max="5000" value="500" placeholder="Delay (ms)">
            Delay between deletions (ms)
          </label>
          <label>
            <input type="number" id="batch-size" min="1" max="50" value="10" placeholder="Batch size">
            Process in batches of
          </label>
        </div>
        
        <div class="x-deleter-actions">
          <button id="preview-btn" class="x-deleter-btn secondary">Preview Matches</button>
          <button id="export-btn" class="x-deleter-btn secondary">Export List</button>
          <button id="clear-filters-btn" class="x-deleter-btn secondary">Clear Filters</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.attachEventListeners();
  }

  attachEventListeners() {
    document.getElementById('x-deleter-close').addEventListener('click', () => {
      document.getElementById('x-post-deleter-panel').style.display = 'none';
    });

    document.getElementById('delete-posts-btn').addEventListener('click', () => {
      this.startDeletion('posts');
    });

    document.getElementById('delete-replies-btn').addEventListener('click', () => {
      this.startDeletion('replies');
    });

    document.getElementById('delete-filtered-btn').addEventListener('click', () => {
      this.startDeletion('filtered');
    });

    document.getElementById('delete-all-btn').addEventListener('click', () => {
      this.startDeletion('all');
    });

    document.getElementById('stop-deletion-btn').addEventListener('click', () => {
      this.stopDeletion();
    });

    document.getElementById('preview-btn').addEventListener('click', () => {
      this.previewMatches();
    });

    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportMatches();
    });

    document.getElementById('clear-filters-btn').addEventListener('click', () => {
      this.clearFilters();
    });
    const filterElements = [
      'keyword-filter', 'hashtag-filter', 'platform-filter', 
      'engagement-filter', 'date-filter', 'reply-filter',
      'has-links', 'has-images', 'has-videos', 'has-gifs'
    ];

    filterElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.updateModeDisplay());
        element.addEventListener('input', () => this.updateModeDisplay());
      }
    });
  }

  async startDeletion(type) {
    if (this.isRunning) return;
    const currentUrl = window.location.href;
    const username = this.currentUser;
    
    if (!username) {
      alert('Could not detect current user. Please make sure you are logged in.');
      return;
    }

    let targetUrl;
    let needsNavigation = false;
    
    if (type === 'replies') {
      targetUrl = `https://x.com/${username}/with_replies`;
      if (!currentUrl.includes('/with_replies')) {
        needsNavigation = true;
      }
    } else if (type === 'posts') {
      targetUrl = `https://x.com/${username}`;
      const isOnPostsPage = currentUrl.includes(`x.com/${username}`) && 
                           !currentUrl.includes('/with_replies') && 
                           !currentUrl.includes('/media') && 
                           !currentUrl.includes('/likes') &&
                           !currentUrl.includes('/following') &&
                           !currentUrl.includes('/followers');
      
      if (!isOnPostsPage) {
        needsNavigation = true;
      }
    }

    if (needsNavigation) {
      console.log(`Navigating to ${type} page and starting deletion...`);
      sessionStorage.setItem('xDeleterAction', JSON.stringify({
        type: type,
        delay: parseInt(document.getElementById('delay-ms').value) || 500,
        confirmEach: document.getElementById('confirm-each').checked,
        autoStart: true
      }));
      window.location.href = targetUrl;
      return;
    }

    const confirmation = confirm(`Are you sure you want to delete your ${type}? This action cannot be undone.`);
    if (!confirmation) return;

    this.executeDeletion(type);
  }

  async executeDeletion(type) {
    this.isRunning = true;
    this.deletedCount = 0;
    this.updateUI();

    const delay = parseInt(document.getElementById('delay-ms')?.value) || 500;
    const confirmEach = document.getElementById('confirm-each')?.checked || false;

    try {
      await this.deleteUserContent(type, delay, confirmEach);
    } catch (error) {
      console.error('Deletion error:', error);
      alert('An error occurred during deletion. Check console for details.');
    }

    this.isRunning = false;
    this.updateUI();
  }

  stopDeletion() {
    this.isRunning = false;
    this.updateUI();
  }

  updateUI() {
    document.getElementById('deleted-count').textContent = this.deletedCount;
    document.getElementById('stop-deletion-btn').style.display = this.isRunning ? 'block' : 'none';
    
    const buttons = document.querySelectorAll('.x-deleter-btn:not(#stop-deletion-btn)');
    buttons.forEach(btn => btn.disabled = this.isRunning);
  }

  async deleteUserContent(type, delay, confirmEach) {
    let totalProcessed = 0;
    let maxIterations = 200;
    let consecutiveEmptyRounds = 0;
    let lastPageHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 3;
    
    console.log(`Starting deletion process for ${type}`);
    
    while (this.isRunning && totalProcessed < maxIterations) {
      await this.sleep(800);
      
      const posts = this.findUserPosts(type);
      console.log(`Iteration ${totalProcessed + 1}: Found ${posts.length} posts`);
      
      if (posts.length === 0) {
        consecutiveEmptyRounds++;
        console.log(`No posts found (attempt ${consecutiveEmptyRounds}/${maxScrollAttempts})`);
        
        if (consecutiveEmptyRounds >= maxScrollAttempts) {
          console.log('No more posts found - deletion complete');
          break;
        }
        await this.performSmallScroll();
        await this.sleep(1200);
        continue;
      }
    
      consecutiveEmptyRounds = 0;
      scrollAttempts = 0;
      
      let deletedThisRound = 0;
      
      for (const post of posts) {
        if (!this.isRunning) break;

        if (confirmEach) {
          const shouldDelete = confirm(`Delete this ${type === 'replies' ? 'reply' : 'post'}?`);
          if (!shouldDelete) continue;
        }

        const deleted = await this.deletePost(post);
        if (deleted) {
          this.deletedCount++;
          deletedThisRound++;
          this.updateUI();
          console.log(`Deleted post ${this.deletedCount}`);
          await this.sleep(300);
          window.scrollBy(0, 200);
          await this.sleep(200);
        }
        await this.sleep(Math.max(150, delay / 10));
      }
      
      if (deletedThisRound > 0) {
        await this.performSmallScroll();
        await this.sleep(800);
      }
      
      totalProcessed++;
    }
    
    console.log(`Deletion complete! Total deleted: ${this.deletedCount}`);
    if (this.isRunning) {
      console.log('Performing final verification sweep...');
      await this.finalVerificationSweep(type);
    }
  }

  async performSmallScroll() {
    console.log('Performing small scroll...');
    const currentScroll = window.pageYOffset;
    window.scrollBy(0, 800);
    await this.sleep(300);
    window.dispatchEvent(new Event('scroll'));
    
    console.log(`Scrolled from ${currentScroll} to ${window.pageYOffset}`);
  }

  async performAggressiveScroll() {
    console.log('Performing aggressive scroll...');
    const currentHeight = document.body.scrollHeight;
    
    window.scrollTo(0, document.body.scrollHeight);
    await this.sleep(500);
    window.scrollTo(0, document.body.scrollHeight - 1000);
    await this.sleep(300);
    window.scrollTo(0, document.body.scrollHeight);
    await this.sleep(500);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await this.sleep(800);
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
  }

  async alternativeScrollStrategy() {
    const scrollStep = 500;
    let currentScroll = 0;
    const maxScroll = document.body.scrollHeight;
    
    while (currentScroll < maxScroll) {
      window.scrollTo(0, currentScroll);
      await this.sleep(200);
      currentScroll += scrollStep;
    }
    window.scrollTo(0, 0);
    await this.sleep(1000);
    window.scrollTo(0, document.body.scrollHeight);
    await this.sleep(1000);
    
    window.dispatchEvent(new Event('resize'));
    await this.sleep(500);
  }

  async deepPageScan() {
    console.log('Performing deep page scan...');
    
    const loadMoreSelectors = [
      '[data-testid="loadMore"]',
      '[aria-label*="Load more"]',
      '[aria-label*="Show more"]',
      'button:contains("Show more")',
      'button:contains("Load more")',
      '[role="button"]:contains("more")'
    ];
    
    for (const selector of loadMoreSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent) {
        console.log('Found and clicking load more button');
        button.click();
        await this.sleep(2000);
      }
    }
    
    console.log('Refreshing timeline...');
    const currentUrl = window.location.href;
    window.location.href = currentUrl + (currentUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    await this.sleep(3000);
  }

  async forceContentLoad() {
    console.log('Forcing content load...');
    
    for (let i = 0; i < 3; i++) {
      window.scrollTo(0, 0);
      await this.sleep(300);
      window.scrollTo(0, document.body.scrollHeight);
      await this.sleep(300);
    }
    const observer = new IntersectionObserver(() => {});
    const elements = document.querySelectorAll('article, div[data-testid="tweet"]');
    elements.forEach(el => {
      observer.observe(el);
      observer.unobserve(el);
    });
    document.body.click();
    await this.sleep(200);
    window.focus();
    document.body.focus();
  }

  async finalVerificationSweep(type) {
    console.log('Final verification sweep...');
    
    await this.performAggressiveScroll();
    await this.sleep(3000);
    
    const remainingPosts = this.findUserPosts(type);
    if (remainingPosts.length > 0) {
      console.log(`Found ${remainingPosts.length} remaining posts - attempting cleanup`);
      
      for (const post of remainingPosts.slice(0, 5)) {
        if (!this.isRunning) break;
        const deleted = await this.deletePost(post);
        if (deleted) {
          this.deletedCount++;
          this.updateUI();
          console.log(`Final cleanup deleted post ${this.deletedCount}`);
        }
        await this.sleep(1000);
      }
    }
    
    console.log(`Final count: ${this.deletedCount} posts deleted`);
  }

  findUserPosts(type) {
    const posts = [];
    const processedElements = new Set();
    
    console.log('Looking for posts with type:', type);
    console.log('Current user:', this.currentUser);
    console.log('Current URL:', window.location.href);

    const elements = document.querySelectorAll('article[data-testid="tweet"]');
    console.log(`Found ${elements.length} tweet articles`);
      
    for (const element of elements) {
      if (processedElements.has(element)) continue;
      processedElements.add(element);
      
      const isUser = this.isUserAuthorOnly(element);
      const passesTypeFilter = this.passesTypeFilter(element, type);
      
      console.log(`Post - User: ${isUser}, Type filter (${type}): ${passesTypeFilter}`);
      
      if (this.isUserPost(element, type)) {
        posts.push(element);
        console.log('Added user post to deletion list');
      }
    }

    console.log(`Found ${posts.length} unique posts to delete`);
    return posts;
  }

  isUserAuthorOnly(element) {
    if (!this.currentUser) return false;
    
    const authorLink = element.querySelector(`a[href="/${this.currentUser}"]:not([aria-label*="@${this.currentUser}"])`);
    const authorArea = element.querySelector('[data-testid*="User-Name"], [data-testid*="user"]');
    
    let isUserAuthor = false;
    if (authorArea) {
      const userLink = authorArea.querySelector(`a[href="/${this.currentUser}"]`);
      isUserAuthor = !!userLink;
    }
    
    if (!isUserAuthor && authorLink) {
      const postHeader = authorLink.closest('[data-testid*="tweet"], [role="article"]')?.querySelector('[data-testid*="User"], [data-testid="tweet"] > div:first-child');
      if (postHeader && postHeader.contains(authorLink)) {
        isUserAuthor = true;
      }
    }
    
    return isUserAuthor;
  }

  passesTypeFilter(element, type) {
    if (type === 'posts') {
      const replyingToText = element.textContent.toLowerCase().includes('replying to @');
      const replyContext = element.querySelector('[data-testid="reply-context"]');
      
      const isReply = replyingToText || 
                      (replyContext && replyContext.textContent.toLowerCase().includes('replying to')) ||
                      element.querySelector('[aria-label*="Replying to"]');
      
      return !isReply;
    } else if (type === 'replies') {
      const replyingTo = element.querySelector('[data-testid*="reply"], [aria-label*="reply"], [aria-label*="Reply"]');
      const replyingToText = element.textContent.toLowerCase().includes('replying to');
      const hasReplyIndicator = replyingTo || replyingToText;
      
      return !!hasReplyIndicator;
    }
    
    return true;
  }

  isUserPost(element, type) {
    if (!this.currentUser) {
      console.log('No current user detected');
      return false;
    }

    const authorLink = element.querySelector(`a[href="/${this.currentUser}"]:not([aria-label*="@${this.currentUser}"])`);
    const authorArea = element.querySelector('[data-testid*="User-Name"], [data-testid*="user"]');
    
    let isUserAuthor = false;
    if (authorArea) {
      const userLink = authorArea.querySelector(`a[href="/${this.currentUser}"]`);
      isUserAuthor = !!userLink;
    }
    
    if (!isUserAuthor && authorLink) {
      const postHeader = authorLink.closest('[data-testid*="tweet"], [role="article"]')?.querySelector('[data-testid*="User"], [data-testid="tweet"] > div:first-child');
      if (postHeader && postHeader.contains(authorLink)) {
        isUserAuthor = true;
      }
    }

    if (!isUserAuthor) {
      return false;
    }

    if (type === 'posts') {
      const replyingToText = element.textContent.toLowerCase().includes('replying to @');
      const replyContext = element.querySelector('[data-testid="reply-context"]');
      
      const isReply = replyingToText || 
                      (replyContext && replyContext.textContent.toLowerCase().includes('replying to')) ||
                      element.querySelector('[aria-label*="Replying to"]');
      
      if (isReply) {
        console.log('Excluding reply from posts filter');
        return false;
      }
    } else if (type === 'replies') {
      const replyingTo = element.querySelector('[data-testid*="reply"], [aria-label*="reply"], [aria-label*="Reply"]');
      const replyingToText = element.textContent.toLowerCase().includes('replying to');
      const hasReplyIndicator = replyingTo || replyingToText;
      
      if (!hasReplyIndicator) {
        console.log('Not a reply - no reply indicators found');
        return false;
      }
    }

    if (type === 'filtered' || this.hasActiveFilters()) {
      return this.matchesFilters(element);
    }

    return true;
  }

  hasActiveFilters() {
    const keyword = document.getElementById('keyword-filter')?.value?.trim();
    const hashtag = document.getElementById('hashtag-filter')?.value?.trim();
    const platform = document.getElementById('platform-filter')?.value;
    const engagement = document.getElementById('engagement-filter')?.value;
    const dateFilter = document.getElementById('date-filter')?.value;
    const replyFilter = document.getElementById('reply-filter')?.value;
    const hasLinks = document.getElementById('has-links')?.checked;
    const hasImages = document.getElementById('has-images')?.checked;
    const hasVideos = document.getElementById('has-videos')?.checked;
    const hasGifs = document.getElementById('has-gifs')?.checked;

    return keyword || hashtag || platform !== 'all' || engagement !== 'all' || 
           dateFilter !== 'all' || replyFilter !== 'all' || 
           hasLinks || hasImages || hasVideos || hasGifs;
  }

  matchesFilters(element) {
    const text = element.textContent || '';
    const textLower = text.toLowerCase();
    
    const keyword = document.getElementById('keyword-filter')?.value?.trim();
    if (keyword && !textLower.includes(keyword.toLowerCase())) {
      return false;
    }

    const hashtag = document.getElementById('hashtag-filter')?.value?.trim();
    if (hashtag) {
      const hashtagToFind = hashtag.startsWith('#') ? hashtag : '#' + hashtag;
      if (!textLower.includes(hashtagToFind.toLowerCase())) {
        return false;
      }
    }

    const platform = document.getElementById('platform-filter')?.value;
    if (platform !== 'all') {
      const sourceElement = element.querySelector('[data-testid="tweet"] a[href*="twitter.com"]');
      const sourceText = sourceElement ? sourceElement.textContent.toLowerCase() : '';
      
      switch (platform) {
        case 'web':
          if (!sourceText.includes('twitter web app')) return false;
          break;
        case 'iphone':
          if (!sourceText.includes('twitter for iphone')) return false;
          break;
        case 'android':
          if (!sourceText.includes('twitter for android')) return false;
          break;
        case 'tweetdeck':
          if (!sourceText.includes('tweetdeck')) return false;
          break;
      }
    }

    const engagement = document.getElementById('engagement-filter')?.value;
    if (engagement !== 'all') {
      const likesElement = element.querySelector('[data-testid="like"]');
      const retweetsElement = element.querySelector('[data-testid="retweet"]');
      const repliesElement = element.querySelector('[data-testid="reply"]');
      
      const likes = this.extractNumber(likesElement?.textContent) || 0;
      const retweets = this.extractNumber(retweetsElement?.textContent) || 0;
      const replies = this.extractNumber(repliesElement?.textContent) || 0;
      
      switch (engagement) {
        case 'no-likes':
          if (likes > 0) return false;
          break;
        case 'no-retweets':
          if (retweets > 0) return false;
          break;
        case 'no-engagement':
          if (likes > 0 || retweets > 0 || replies > 0) return false;
          break;
        case 'low-engagement':
          if (likes + retweets + replies >= 5) return false;
          break;
      }
    }

    const dateFilter = document.getElementById('date-filter')?.value;
    if (dateFilter !== 'all') {
      const timeElement = element.querySelector('time');
      if (timeElement) {
        const postDate = new Date(timeElement.dateTime);
        const now = new Date();
        
        switch (dateFilter) {
          case 'today':
            if (now.toDateString() !== postDate.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (postDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (postDate < monthAgo) return false;
            break;
          case '3months':
            const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            if (postDate < threeMonthsAgo) return false;
            break;
          case 'year':
            const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            if (postDate < yearAgo) return false;
            break;
          case 'old':
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            if (postDate > oneYearAgo) return false;
            break;
        }
      }
    }

    if (document.getElementById('has-links')?.checked) {
      if (!element.querySelector('a[href*="http"]')) return false;
    }
    if (document.getElementById('has-images')?.checked) {
      if (!element.querySelector('img[src*="media"]')) return false;
    }
    if (document.getElementById('has-videos')?.checked) {
      if (!element.querySelector('[data-testid="videoComponent"]')) return false;
    }
    if (document.getElementById('has-gifs')?.checked) {
      if (!element.querySelector('[data-testid="gif"]')) return false;
    }

    return true;
  }

  extractNumber(text) {
    if (!text) return 0;
    const match = text.match(/[\d,]+/);
    if (!match) return 0;
    return parseInt(match[0].replace(/,/g, ''));
  }

  updateModeDisplay() {
    const modeElement = document.getElementById('current-mode');
    if (!modeElement) return;

    if (this.hasActiveFilters()) {
      modeElement.textContent = 'Filtered';
      modeElement.style.color = '#1d9bf0';
    } else {
      modeElement.textContent = 'All';
      modeElement.style.color = '#fff';
    }
  }

  clearFilters() {
    document.getElementById('keyword-filter').value = '';
    document.getElementById('hashtag-filter').value = '';
    document.getElementById('platform-filter').value = 'all';
    document.getElementById('engagement-filter').value = 'all';
    document.getElementById('date-filter').value = 'all';
    document.getElementById('reply-filter').value = 'all';
    document.getElementById('has-links').checked = false;
    document.getElementById('has-images').checked = false;
    document.getElementById('has-videos').checked = false;
    document.getElementById('has-gifs').checked = false;
    this.updateModeDisplay();
  }

  previewMatches() {
    const posts = this.findUserPosts('filtered');
    alert(`Found ${posts.length} posts matching your filters.\n\nClick "Delete Filtered" to remove them.`);
  }

  exportMatches() {
    const posts = this.findUserPosts('filtered');
    const data = posts.map(post => ({
      text: post.textContent.trim(),
      url: window.location.href,
      timestamp: new Date().toISOString()
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-em-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async deletePost(postElement) {
    try {
      console.log('Attempting to delete post:', postElement);
      
      const moreButtonSelectors = [
        '[data-testid="caret"]',
        '[aria-label*="More"]',
        '[aria-label*="more"]',
        'button[aria-haspopup="menu"]',
        '[role="button"][aria-haspopup="menu"]',
        'div[role="button"][aria-label*="More"]',
        'button[aria-label="More"]'
      ];

      let moreButton = null;
      for (const selector of moreButtonSelectors) {
        moreButton = postElement.querySelector(selector);
        if (moreButton) {
          console.log('Found more button with selector:', selector);
          break;
        }
      }

      if (!moreButton) {
        console.log('No more button found');
        return false;
      }

      moreButton.click();
      await this.sleep(200);

      let deleteButton = null;
      
      const menuItemSelectors = [
        '[data-testid="Dropdown"] [role="menuitem"]',
        '[role="menu"] [role="menuitem"]',
        'div[role="menuitem"]',
        '[data-testid="Dropdown"] div',
        '[role="menu"] div',
        '[role="menuitem"]'
      ];

      for (const selector of menuItemSelectors) {
        deleteButton = findElementByText(selector, 'delete');
        if (deleteButton) {
          console.log('Found delete button with selector:', selector);
          break;
        }
      }

      if (!deleteButton) {
        const deleteSelectors = [
          '[data-testid="delete"]',
          '[data-testid="deletePost"]',
          '[data-testid="deleteTweet"]',
          '[aria-label*="Delete"]'
        ];

        for (const selector of deleteSelectors) {
          deleteButton = document.querySelector(selector);
          if (deleteButton) {
            console.log('Found delete button with test ID:', selector);
            break;
          }
        }
      }

      if (!deleteButton) {
        const allMenuItems = document.querySelectorAll('[role="menuitem"], [data-testid="Dropdown"] *, [role="menu"] *');
        for (const item of allMenuItems) {
          if (item.textContent && item.textContent.toLowerCase().includes('delete')) {
            deleteButton = item;
            console.log('Found delete button via text search:', item);
            break;
          }
        }
      }

      if (!deleteButton) {
        console.log('No delete button found. Available menu items:');
        const menuItems = document.querySelectorAll('[role="menuitem"], [data-testid="Dropdown"] *');
        menuItems.forEach((item, index) => {
          console.log(`  ${index}: "${item.textContent?.trim()}" - ${item.tagName}`);
        });
      }

      if (deleteButton) {
        console.log('Clicking delete button');
        deleteButton.click();
        await this.sleep(150);

        const confirmSelectors = [
          '[data-testid="confirmationSheetConfirm"]',
          '[data-testid="confirm"]',
          'button[data-testid="confirmationSheetConfirm"]',
          '[role="button"]:contains("Delete")',
          'button:contains("Delete")'
        ];

        let confirmButton = null;
        for (const selector of confirmSelectors) {
          if (selector.includes(':contains(')) {
            confirmButton = findElementByText('button', 'delete');
          } else {
            confirmButton = document.querySelector(selector);
          }
          
          if (confirmButton) {
            console.log('Found confirm button with selector:', selector);
            break;
          }
        }

        if (confirmButton) {
          console.log('Clicking confirm button');
          confirmButton.click();
          await this.sleep(200);
          return true;
        } else {
          console.log('No confirmation button found');
        }
      } else {
        console.log('No delete button found in menu');
      }

      document.body.click();
      await this.sleep(50);
      
    } catch (error) {
      console.error('Error deleting post:', error);
    }

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  observePageChanges() {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('x-post-deleter-panel')) {
        setTimeout(() => this.createControlPanel(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

function findElementByText(baseSelector, text) {
  const elements = document.querySelectorAll(baseSelector);
  for (const element of elements) {
    if (element.textContent.toLowerCase().includes(text.toLowerCase())) {
      return element;
    }
  }
  return null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new XPostDeleter());
} else {
  new XPostDeleter();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showPanel' || request.action === 'togglePanel') {
    const panel = document.getElementById('x-post-deleter-panel');
    if (panel) {
      if (request.action === 'togglePanel') {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      } else {
        panel.style.display = 'block';
      }
    }
    sendResponse({ success: true });
  }
});