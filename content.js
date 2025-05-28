let currentVideoId = null;
let sidebarInstance = null;
let checkInterval = null;

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
  selector.className = 'lang-selector';
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
  const content = sidebarInstance.querySelector('.transcript-content');
  if (!content) return;
  content.innerHTML = '';
  if (!events || events.length === 0) {
    content.innerHTML = '<div class="no-transcript">❌ No transcript available for this video.</div>';
    return;
  }
  events.forEach(event => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'entry';
    entryDiv.innerHTML = `
      <div class="time">${formatTime(event.tStartMs / 1000)}</div>
      <div class="text" dir="${event.segs.some(seg => seg.utf8.match(/[\u0600-\u06FF]/)) ? 'rtl' : 'ltr'}">
        ${event.segs.map(seg => seg.utf8).join(' ')}
      </div>
    `;
    content.appendChild(entryDiv);
  });
}

function copyTranscript() {
  if (!sidebarInstance) return;
  const content = sidebarInstance.querySelector('.transcript-content');
  if (!content) return;

  const texts = Array.from(content.querySelectorAll('.text')).map(el => el.textContent.trim());
  if (texts.length === 0) {
    alert('No transcript available to copy.');
    return;
  }

  const transcriptText = texts.join('\n');
  navigator.clipboard.writeText(transcriptText).then(showCopyToast).catch(() => {
    alert('Failed to copy transcript.');
  });
}

function showCopyToast() {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.textContent = 'Transcript copied successfully!';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: '#333',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '4px',
      zIndex: '10000',
      fontSize: '14px',
      display: 'none'
    });
    document.body.appendChild(toast);
  }
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2000);
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

  sidebarInstance = document.createElement('div');
  sidebarInstance.id = 'yt-transcript-sidebar';
  sidebarInstance.style.cssText = `
    position: fixed;
    top: 60px;
    right: 0;
    width: 360px;
    height: calc(100vh - 60px);
    background: #f9f9f9;
    border-left: 1px solid #ccc;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
    overflow-y: auto;
    z-index: 9999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #333;
  `;
  sidebarInstance.innerHTML = `
    <div class="header" style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; align-items: center; justify-content: space-between;">
      <select class="lang-selector" style="flex-grow: 1; margin-right: 8px;"><option>Loading...</option></select>
      <h2 style="font-size: 16px; margin: 0; flex-shrink: 0; width: 100px; text-align: center;">🔄 Loading - ${videoId}</h2>
      <button class="copy-btn" title="Copy Transcript" style="margin-left: 8px; cursor: pointer;">📋</button>
      <button class="close-btn" title="Close Sidebar" style="margin-left: 8px; font-size: 20px; cursor: pointer;">×</button>
    </div>
    <div class="transcript-content" style="padding: 10px;">🔍 Fetching transcript...</div>
  `;
  document.body.appendChild(sidebarInstance);

  sidebarInstance.querySelector('.close-btn').addEventListener('click', () => {
    clearExistingSidebar();
    currentVideoId = null;
  });

  sidebarInstance.querySelector('.copy-btn').addEventListener('click', copyTranscript);

  const captionTracks = await fetchCaptionTracks();

  if (!captionTracks || captionTracks.length === 0) {
    updateTranscriptContent([]);
    sidebarInstance.querySelector('.lang-selector').innerHTML = '<option>No captions</option>';
    sidebarInstance.querySelector('h2').textContent = `❌ No Captions - ${videoId}`;
    return;
  }

  const initialTranscript = await loadTranscript(captionTracks, 'en');

  if (initialTranscript) {
    updateTranscriptContent(initialTranscript.events);
    const selector = createLanguageSelector(captionTracks, initialTranscript.language);
    sidebarInstance.querySelector('.lang-selector').replaceWith(selector);
    sidebarInstance.querySelector('h2').textContent = `✅ Transcript - ${videoId}`;

    selector.addEventListener('change', async (e) => {
      const content = sidebarInstance.querySelector('.transcript-content');
      content.innerHTML = '🔄 Loading transcript...';
      const newTranscript = await loadTranscript(captionTracks, e.target.value);
      updateTranscriptContent(newTranscript ? newTranscript.events : []);
    });
  } else {
    updateTranscriptContent([]);
    sidebarInstance.querySelector('h2').textContent = `❌ Failed to load - ${videoId}`;
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
  if (document.getElementById('summarize-btn')) return;

  const playerContainer = document.querySelector('.ytp-right-controls');
  if (!playerContainer) return;

  const btn = document.createElement('button');
  btn.id = 'summarize-btn';
  btn.textContent = 'Summarize';
  btn.title = 'Summarize this video transcript';
  btn.style.marginLeft = '8px';
  btn.style.padding = '4px 8px';
  btn.style.cursor = 'pointer';
  playerContainer.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (!sidebarInstance) {
      alert('Transcript sidebar is not loaded yet.');
      return;
    }

    const texts = Array.from(sidebarInstance.querySelectorAll('.text')).map(el => el.textContent.trim());
    if (texts.length === 0) {
      alert('No transcript available to summarize.');
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
});

