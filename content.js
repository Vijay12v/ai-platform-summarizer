let currentVideoId = null;
let sidebarInstance = null;
let floatingToggle = null;
let checkInterval = null;
let sidebarVisible = false;

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

function clearExistingSidebar() {
  if (sidebarInstance) {
    sidebarInstance.remove();
    sidebarInstance = null;
  }
}

function createFloatingToggle() {
  if (floatingToggle) return;
  
  floatingToggle = document.createElement('div');
  floatingToggle.id = 'yt-transcript-toggle';
  floatingToggle.innerHTML = `
    <div class="yt-toggle-icon">📄</div>
    <div class="yt-toggle-tooltip">Transcript</div>
  `;
  document.body.appendChild(floatingToggle);
  
  floatingToggle.addEventListener('click', toggleSidebar);
}

function toggleSidebar() {
  if (sidebarVisible && sidebarInstance) {
    // Hide sidebar
    sidebarInstance.style.transform = 'translateX(100%)';
    sidebarVisible = false;
    floatingToggle.classList.remove('active');
  } else {
    // Show sidebar (create if doesn't exist)
    if (!sidebarInstance) {
      initializeSidebar();
    } else {
      sidebarInstance.style.transform = 'translateX(0)';
    }
    sidebarVisible = true;
    floatingToggle.classList.add('active');
  }
}

function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substring(11, 19);
}

async function fetchCaptionTracks() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const scripts = Array.from(document.getElementsByTagName('script'));
    const playerScript = scripts.find(s => s.textContent.includes('ytInitialPlayerResponse'));
    if (playerScript) {
      const match = playerScript.textContent.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
      if (match) {
        try {
          const playerResponse = JSON.parse(match[1]);
          const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          if (captionTracks.length > 0) return captionTracks;
        } catch {}
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return [];
}

async function loadTranscript(captionTracks, languageCode = 'en') {
  const targetTrack = captionTracks.find(track =>
    track.languageCode.startsWith(languageCode) ||
    track.name.simpleText.toLowerCase().includes('english')
  ) || captionTracks[0];
  if (!targetTrack) return null;
  try {
    const response = await fetch(`${targetTrack.baseUrl}&fmt=json3`);
    const data = await response.json();
    return {
      events: data.events?.filter(e => e.segs) || [],
      language: targetTrack.languageCode
    };
  } catch {
    return null;
  }
}

function createLanguageSelector(captionTracks, currentLanguage) {
  const selector = document.createElement('select');
  selector.className = 'yt-transcript-lang-selector';
  captionTracks.forEach(track => {
    const option = document.createElement('option');
    option.value = track.languageCode;
    option.textContent = track.name.simpleText;
    option.selected = track.languageCode === currentLanguage;
    selector.appendChild(option);
  });
  return selector;
}

function updateTranscriptContent(events) {
  if (!sidebarInstance) return;
  const content = sidebarInstance.querySelector('.yt-transcript-content');
  if (!content) return;
  content.innerHTML = '';
  if (!events || events.length === 0) {
    content.innerHTML = `
      <div class="yt-transcript-no-content">
        <div class="yt-transcript-icon">📄</div>
        <div class="yt-transcript-message">No transcript available</div>
        <div class="yt-transcript-submessage">This video doesn't have a transcript</div>
      </div>
    `;
    return;
  }
  events.forEach(event => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'yt-transcript-entry';
    entryDiv.innerHTML = `
      <div class="yt-transcript-time">${formatTime(event.tStartMs / 1000)}</div>
      <div class="yt-transcript-text" dir="${event.segs.some(seg => seg.utf8.match(/[\u0600-\u06FF]/)) ? 'rtl' : 'ltr'}">
        ${event.segs.map(seg => seg.utf8).join(' ')}
      </div>
    `;
    content.appendChild(entryDiv);
  });
}

function copyTranscript() {
  if (!sidebarInstance) return;
  const content = sidebarInstance.querySelector('.yt-transcript-content');
  if (!content) return;

  const texts = Array.from(content.querySelectorAll('.yt-transcript-text')).map(el => el.textContent.trim());
  if (texts.length === 0) {
    showCopyToast('No transcript available to copy', false);
    return;
  }

  const transcriptText = texts.join('\n');
  navigator.clipboard.writeText(transcriptText).then(() => showCopyToast('Transcript copied to clipboard', true)).catch(() => {
    showCopyToast('Failed to copy transcript', false);
  });
}

function showCopyToast(message, success) {
  let toast = document.getElementById('yt-transcript-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'yt-transcript-toast';
    document.body.appendChild(toast);
  }
  
  toast.className = `yt-transcript-toast ${success ? 'success' : 'error'}`;
  toast.innerHTML = `
    <div class="yt-transcript-toast-icon">${success ? '✓' : '⚠'}</div>
    <div class="yt-transcript-toast-message">${message}</div>
  `;
  
  toast.style.display = 'flex';
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, 3000);
}

async function initializeSidebar() {
  const videoId = getVideoId();
  if (!videoId) {
    clearExistingSidebar();
    currentVideoId = null;
    return;
  }

  if (currentVideoId === videoId && sidebarInstance) return;

  clearExistingSidebar();
  currentVideoId = videoId;

  // Create floating toggle if it doesn't exist
  createFloatingToggle();

  // Add YouTube-specific styles to the page
  if (!document.getElementById('yt-transcript-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'yt-transcript-styles';
    styleSheet.textContent = `
      /* Floating Toggle Button */
      #yt-transcript-toggle {
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        width: 56px;
        height: 56px;
        background: #212121;
        border: 2px solid #3f3f3f;
        border-radius: 50%;
        cursor: pointer;
        z-index: 2150;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #f1f1f1;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }
      
      #yt-transcript-toggle:hover {
        background: #3f3f3f;
        border-color: #3ea6ff;
        transform: translateY(-50%) scale(1.1);
        box-shadow: 0 6px 20px rgba(62, 166, 255, 0.3);
      }
      
      #yt-transcript-toggle.active {
        background: #3ea6ff;
        border-color: #65b7ff;
        box-shadow: 0 4px 20px rgba(62, 166, 255, 0.4);
      }
      
      #yt-transcript-toggle.active:hover {
        background: #65b7ff;
        transform: translateY(-50%) scale(1.1);
      }
      
      .yt-toggle-icon {
        transition: transform 0.3s ease;
      }
      
      #yt-transcript-toggle:hover .yt-toggle-icon {
        transform: scale(1.1);
      }
      
      .yt-toggle-tooltip {
        position: absolute;
        right: 70px;
        top: 50%;
        transform: translateY(-50%);
        background: #212121;
        color: #f1f1f1;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        border: 1px solid #3f3f3f;
        font-family: "Roboto", "Arial", sans-serif;
      }
      
      .yt-toggle-tooltip::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: #212121;
      }
      
      #yt-transcript-toggle:hover .yt-toggle-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(-50%) translateX(-8px);
      }
      
      /* Sidebar Styles */
      #yt-transcript-sidebar {
        position: fixed;
        top: 56px;
        right: 0;
        width: 400px;
        height: calc(100vh - 56px);
        background: #0f0f0f;
        border-left: 1px solid #3f3f3f;
        box-shadow: -2px 0 8px rgba(0,0,0,0.3);
        overflow: hidden;
        z-index: 2100;
        font-family: "Roboto", "Arial", sans-serif;
        color: #f1f1f1;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      #yt-transcript-sidebar.visible {
        transform: translateX(0);
      }
      
      .yt-transcript-header {
        padding: 16px;
        border-bottom: 1px solid #3f3f3f;
        background: #0f0f0f;
        flex-shrink: 0;
      }
      
      .yt-transcript-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      
      .yt-transcript-title {
        font-size: 16px;
        font-weight: 500;
        color: #f1f1f1;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .yt-transcript-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .yt-transcript-btn {
        background: none;
        border: none;
        color: #aaa;
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        font-size: 18px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .yt-transcript-btn:hover {
        background: #3f3f3f;
        color: #fff;
      }
      
      .yt-transcript-minimize-btn {
        background: #3ea6ff;
        color: #fff;
      }
      
      .yt-transcript-minimize-btn:hover {
        background: #65b7ff;
      }
      
      .yt-transcript-lang-selector {
        background: #212121;
        border: 1px solid #3f3f3f;
        color: #f1f1f1;
        padding: 8px 12px;
        border-radius: 2px;
        font-size: 14px;
        width: 100%;
        cursor: pointer;
        outline: none;
        transition: border-color 0.2s ease;
      }
      
      .yt-transcript-lang-selector:hover {
        border-color: #717171;
      }
      
      .yt-transcript-lang-selector:focus {
        border-color: #3ea6ff;
      }
      
      .yt-transcript-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }
      
      .yt-transcript-content::-webkit-scrollbar {
        width: 8px;
      }
      
      .yt-transcript-content::-webkit-scrollbar-track {
        background: #0f0f0f;
      }
      
      .yt-transcript-content::-webkit-scrollbar-thumb {
        background: #3f3f3f;
        border-radius: 4px;
      }
      
      .yt-transcript-content::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      
      .yt-transcript-entry {
        padding: 8px 16px;
        border-bottom: 1px solid #272727;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .yt-transcript-entry:hover {
        background: #1a1a1a;
      }
      
      .yt-transcript-entry:last-child {
        border-bottom: none;
      }
      
      .yt-transcript-time {
        font-size: 12px;
        color: #3ea6ff;
        font-weight: 500;
        margin-bottom: 4px;
        font-family: "Roboto Mono", monospace;
      }
      
      .yt-transcript-text {
        font-size: 14px;
        line-height: 1.4;
        color: #f1f1f1;
      }
      
      .yt-transcript-no-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        color: #aaa;
        height: 100%;
      }
      
      .yt-transcript-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .yt-transcript-message {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 8px;
        color: #f1f1f1;
      }
      
      .yt-transcript-submessage {
        font-size: 14px;
        color: #aaa;
      }
      
      .yt-transcript-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #aaa;
        flex-direction: column;
        gap: 16px;
      }
      
      .yt-transcript-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #3f3f3f;
        border-top: 2px solid #3ea6ff;
        border-radius: 50%;
        animation: yt-transcript-spin 1s linear infinite;
      }
      
      @keyframes yt-transcript-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .yt-transcript-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #212121;
        color: #f1f1f1;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        z-index: 10000;
        display: none;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        max-width: 300px;
        transition: all 0.3s ease;
        transform: translateY(20px);
        opacity: 0;
      }
      
      .yt-transcript-toast.success {
        border-left: 4px solid #00d562;
      }
      
      .yt-transcript-toast.error {
        border-left: 4px solid #ff4444;
      }
      
      .yt-transcript-toast-icon {
        font-weight: bold;
        font-size: 16px;
      }
      
      .yt-transcript-toast.success .yt-transcript-toast-icon {
        color: #00d562;
      }
      
      .yt-transcript-toast.error .yt-transcript-toast-icon {
        color: #ff4444;
      }
      
      #yt-summarize-btn {
        background: #3ea6ff;
        border: none;
        color: #fff;
        padding: 0 16px;
        border-radius: 18px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        margin: 0 8px;
        transition: all 0.2s ease;
        font-family: "Roboto", "Arial", sans-serif;
        height: 32px;
        line-height: 32px;
        position: relative;
        top: 0;
        vertical-align: top;
        display: inline-block;
      }
      
      #yt-summarize-btn:hover {
        background: #65b7ff;
        transform: translateY(-1px);
      }
      
      #yt-summarize-btn:active {
        transform: translateY(0);
      }
      
      /* Responsive adjustments */
      @media (max-width: 1024px) {
        #yt-transcript-sidebar {
          width: 350px;
        }
        
        #yt-transcript-toggle {
          right: 15px;
        }
      }
      
      @media (max-width: 768px) {
        #yt-transcript-sidebar {
          width: 100%;
          top: 0;
        }
        
        #yt-transcript-toggle {
          right: 10px;
          width: 48px;
          height: 48px;
          font-size: 18px;
        }
        
        .yt-toggle-tooltip {
          right: 60px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  sidebarInstance = document.createElement('div');
  sidebarInstance.id = 'yt-transcript-sidebar';
  sidebarInstance.innerHTML = `
    <div class="yt-transcript-header">
      <div class="yt-transcript-header-top">
        <h2 class="yt-transcript-title">
          <span>📄</span>
          <span>Transcript</span>
        </h2>
        <div class="yt-transcript-controls">
          <button class="yt-transcript-btn yt-transcript-copy-btn" title="Copy Transcript">📋</button>
          <button class="yt-transcript-btn yt-transcript-minimize-btn" title="Minimize">−</button>
        </div>
      </div>
      <select class="yt-transcript-lang-selector">
        <option>Loading languages...</option>
      </select>
    </div>
    <div class="yt-transcript-content">
      <div class="yt-transcript-loading">
        <div class="yt-transcript-spinner"></div>
        <div>Loading transcript...</div>
      </div>
    </div>
  `;
  document.body.appendChild(sidebarInstance);

  // Show sidebar with animation
  setTimeout(() => {
    sidebarInstance.style.transform = 'translateX(0)';
    sidebarVisible = true;
    floatingToggle.classList.add('active');
  }, 100);

  // Replace close button with minimize button
  sidebarInstance.querySelector('.yt-transcript-minimize-btn').addEventListener('click', () => {
    toggleSidebar();
  });

  sidebarInstance.querySelector('.yt-transcript-copy-btn').addEventListener('click', copyTranscript);

  const captionTracks = await fetchCaptionTracks();

  if (!captionTracks || captionTracks.length === 0) {
    updateTranscriptContent([]);
    sidebarInstance.querySelector('.yt-transcript-lang-selector').innerHTML = '<option>No captions available</option>';
    sidebarInstance.querySelector('.yt-transcript-title span:last-child').textContent = 'No Transcript';
    return;
  }

  const initialTranscript = await loadTranscript(captionTracks, 'en');

  if (initialTranscript) {
    updateTranscriptContent(initialTranscript.events);
    const selector = createLanguageSelector(captionTracks, initialTranscript.language);
    sidebarInstance.querySelector('.yt-transcript-lang-selector').replaceWith(selector);
    sidebarInstance.querySelector('.yt-transcript-title span:last-child').textContent = 'Transcript';

    selector.addEventListener('change', async (e) => {
      const content = sidebarInstance.querySelector('.yt-transcript-content');
      content.innerHTML = `
        <div class="yt-transcript-loading">
          <div class="yt-transcript-spinner"></div>
          <div>Loading transcript...</div>
        </div>
      `;
      const newTranscript = await loadTranscript(captionTracks, e.target.value);
      updateTranscriptContent(newTranscript ? newTranscript.events : []);
    });
  } else {
    updateTranscriptContent([]);
    sidebarInstance.querySelector('.yt-transcript-title span:last-child').textContent = 'Transcript Error';
  }
}

function startVideoChangeDetection() {
  if (checkInterval) clearInterval(checkInterval);

  let lastVideoId = getVideoId();
  let lastUrl = window.location.href;

  checkInterval = setInterval(() => {
    const currentUrl = window.location.href;
    const newVideoId = getVideoId();

    if (currentUrl !== lastUrl || newVideoId !== lastVideoId) {
      lastUrl = currentUrl;
      lastVideoId = newVideoId;
      location.reload();
    }
  }, 1000);
}

function insertSummarizeButton() {
  if (document.getElementById('yt-summarize-btn')) return;

  const playerContainer = document.querySelector('.ytp-right-controls');
  if (!playerContainer) return;

  const btn = document.createElement('button');
  btn.id = 'yt-summarize-btn';
  btn.textContent = 'Summarize';
  btn.title = 'Summarize this video transcript';
  
  // Insert before the last element to move it upwards/leftwards in the controls
  const firstChild = playerContainer.firstChild;
  if (firstChild) {
    playerContainer.insertBefore(btn, firstChild);
  } else {
    playerContainer.appendChild(btn);
  }

  btn.addEventListener('click', async () => {
    if (!sidebarInstance) {
      showCopyToast('Transcript sidebar is not loaded yet', false);
      return;
    }

    const texts = Array.from(sidebarInstance.querySelectorAll('.yt-transcript-text')).map(el => el.textContent.trim());
    if (texts.length === 0) {
      showCopyToast('No transcript available to summarize', false);
      return;
    }

    const transcriptText = texts.join('\n');

    chrome.runtime.sendMessage({
      type: "summarize",
      transcript: transcriptText
    });
  });
}

function addNavigationListeners() {
  window.addEventListener('popstate', () => location.reload());

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    location.reload();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    location.reload();
  };
}

function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSidebar();
      startVideoChangeDetection();
      insertSummarizeButton();
      addNavigationListeners();
    });
  } else {
    initializeSidebar();
    startVideoChangeDetection();
    insertSummarizeButton();
    addNavigationListeners();
  }
}

initialize();

window.addEventListener('beforeunload', () => {
  if (checkInterval) clearInterval(checkInterval);
  clearExistingSidebar();
  if (floatingToggle) {
    floatingToggle.remove();
    floatingToggle = null;
  }
});

