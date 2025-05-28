===================================================
AI Platform Summarizer Chrome Extension - README
===================================================

Overview:
---------
AI Platform Summarizer is a Chrome extension that allows users to summarize YouTube transcripts using their favorite AI platforms: ChatGPT, Gemini (Google), or Claude (Anthropic). With a click of a button, the extension opens the selected AI platform, injects the transcript with a custom prompt, and submits it automatically.

Features:
---------
✅ Fetches YouTube video transcripts  
✅ Sidebar display of transcripts  
✅ “Summarize” button with custom prompt option  
✅ Supports ChatGPT, Gemini, and Claude  
✅ Automatically injects and submits prompt + transcript  
✅ Persistent platform and prompt settings via chrome.storage  
✅ Robust element detection across platforms  

Project Structure:
------------------
- manifest.json          → Chrome extension configuration  
- background.js          → Background service worker that handles tab creation and script injection  
- content.js             → Injected into YouTube to extract transcripts and display UI  
- injectPrompt()         → Platform-specific injection logic (within background.js or content script)  
- README.txt             → This documentation  

Permissions Required:
---------------------
- "scripting", "activeTab", "storage", "tabs"
- Host permissions:
  * https://*.openai.com/*
  * https://*.google.com/*
  * https://*.claude.ai/*

Installation:
-------------
1. Download or clone the project folder.
2. Go to Chrome → Extensions → Enable "Developer Mode".
3. Click "Load unpacked" and select the folder.
4. Open any YouTube video.
5. Click the extension icon → Set your platform and custom prompt (optional).
6. Click "Summarize" near the video or in the popup.
7. The selected AI platform will open and auto-submit the transcript with the prompt.

Usage Tips:
-----------
- Make sure you're logged into the selected AI platform.
- Wait a few seconds after the tab loads for the injection to complete.
- Some platforms may update their UI; if injection fails, try refreshing the tab or update selectors in `background.js`.

Troubleshooting:
----------------
• Injection not working?
   - Check if the AI platform has changed its layout.
   - Open DevTools (F12) on the new tab to view logs.

• Multiple tabs open?
   - Extension opens a new tab for every summarization request. Close unused tabs manually.

• Not submitting?
   - Ensure the input field is found and writable.
   - Manually paste the content as a fallback.

Contributions:
--------------
Feel free to fork, improve, and submit pull requests.
Make sure to test across all platforms before committing changes.

License:
--------
MIT License – free to use, modify, and distribute.

Created by: Vijayakumar M
Version: 1.0
