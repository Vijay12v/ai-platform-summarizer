// manifest.json requirements:
/*
{
  "manifest_version": 3,
  "name": "AI Platform Summarizer",
  "version": "1.0",
  "permissions": ["scripting", "activeTab", "storage", "tabs"],
  "host_permissions": [
    "*://*.openai.com/*",
    "*://*.google.com/*",
    "*://*.claude.ai/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
*/

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "summarize") {
    chrome.storage.local.get(["selectedPlatform", "customPrompt"], (data) => {
      const platform = data.selectedPlatform || "chatgpt";
      const prompt = data.customPrompt || "Summarize this video clearly and concisely.";
      const transcript = message.transcript;
      const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;

      const platformConfig = {
        chatgpt: {
          url: "https://chat.openai.com/",
          waitTime: 6000,
          submitDelay: 1500,
          maxAttempts: 25
        },
        gemini: {
          url: "https://gemini.google.com/app",
          waitTime: 4000,
          submitDelay: 1500,
          maxAttempts: 12
        },
        claude: {
          url: "https://claude.ai/chat",
          waitTime: 4000,
          submitDelay: 800,
          maxAttempts: 18
        }
      };

      const config = platformConfig[platform];
      
      chrome.tabs.create({ url: config.url }, (tab) => {
        const onTabUpdate = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(onTabUpdate);
            
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: injectPrompt,
                args: [platform, fullPrompt, config],
              }).catch(err => {
                console.error(`Failed to inject script: ${err}`);
                // Retry with longer delay
                setTimeout(() => {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: injectPrompt,
                    args: [platform, fullPrompt, config],
                  }).catch(e => console.error('Final retry failed:', e));
                }, 4000);
              });
            }, config.waitTime);
          }
        };

        chrome.tabs.onUpdated.addListener(onTabUpdate);
      });
    });
  }
  return true;
});

function injectPrompt(platform, promptText, config) {
  let attempts = 0;
  let hasSubmitted = false;
  const MAX_ATTEMPTS = config.maxAttempts;

  const tryInjection = () => {
    attempts++;
    console.log(`${platform} - Attempt ${attempts}/${MAX_ATTEMPTS}`);
    
    let input = null;
    let submit = null;
    
    // Platform-specific element detection with improved methods
    switch(platform) {
      case 'chatgpt':
        input = findChatGPTInput();
        submit = findChatGPTSubmit();
        break;
      case 'claude':
        input = findClaudeInput(); 
        submit = findClaudeSubmit();
        break;
      case 'gemini':
        input = findGeminiInput();
        submit = findGeminiSubmit();
        break;
    }

    console.log(`${platform} - Input found: ${!!input}, Submit found: ${!!submit}`);

    if (input && submit && !hasSubmitted) {
      console.log(`${platform} - Processing injection...`);
      
      try {
        // Inject content based on platform
        let injectionSuccess = false;
        
        switch(platform) {
          case 'chatgpt':
            injectionSuccess = handleChatGPTInput(input, promptText);
            break;
          case 'claude':
            injectionSuccess = handleClaudeInput(input, promptText);
            break;
          case 'gemini':
            injectionSuccess = handleGeminiInput(input, promptText);
            break;
        }

        if (injectionSuccess) {
          console.log(`${platform} - Content injected, submitting...`);
          
          // Submit with platform-specific timing
          setTimeout(() => {
            if (!hasSubmitted) {
              hasSubmitted = true;
              
              // Special handling for each platform's submit
              switch(platform) {
                case 'chatgpt':
                  submitChatGPT(submit);
                  break;
                case 'claude':
                  submitClaude(submit);
                  break;
                case 'gemini':
                  submitGemini(submit);
                  break;
              }
              
              console.log(`${platform} - Submit attempted`);
            }
          }, config.submitDelay);
        } else if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryInjection, 1200);
        }
        
      } catch (error) {
        console.error(`${platform} - Error:`, error);
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryInjection, 1500);
        }
      }
      
    } else if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryInjection, 1000);
    } else {
      console.error(`${platform} - Failed after ${MAX_ATTEMPTS} attempts`);
    }
  };

  // ENHANCED CHATGPT FUNCTIONS
  function findChatGPTInput() {
    console.log('Searching for ChatGPT input...');
    
    // Updated selectors for ChatGPT 2025
    const selectors = [
      'textarea[data-id="root"]',
      'textarea[placeholder*="Message ChatGPT"]',
      'textarea[placeholder*="Message"]',
      'textarea[id*="prompt-textarea"]',
      '#prompt-textarea',
      'div[contenteditable="true"][data-id="root"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea.m-0.resize-none',
      'textarea[rows]',
      'main textarea',
      'form textarea',
      '[data-testid="composer-text-input"] textarea',
      '.ProseMirror-focused',
      'div[contenteditable="true"]'
    ];
    
    // Try each selector
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const rect = element.getBoundingClientRect();
          const isVisible = rect.height > 10 && rect.width > 10 && 
                           window.getComputedStyle(element).display !== 'none' &&
                           window.getComputedStyle(element).visibility !== 'hidden';
          
          if (isVisible && !element.disabled && !element.readOnly) {
            console.log(`ChatGPT input found with selector: ${selector}`);
            return element;
          }
        }
      } catch (e) {
        console.log(`Selector failed: ${selector} - ${e.message}`);
      }
    }
    
    // Advanced fallback: Find by DOM traversal
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      const textareas = form.querySelectorAll('textarea');
      for (const textarea of textareas) {
        const rect = textarea.getBoundingClientRect();
        if (rect.height > 30 && rect.width > 200 && !textarea.disabled) {
          console.log('ChatGPT input found via form traversal');
          return textarea;
        }
      }
    }
    
    // Final fallback: Any large visible textarea
    const allTextareas = document.querySelectorAll('textarea');
    for (const textarea of allTextareas) {
      const rect = textarea.getBoundingClientRect();
      if (rect.height > 50 && rect.width > 300 && !textarea.disabled) {
        console.log('ChatGPT input found via size fallback');
        return textarea;
      }
    }
    
    console.log('No ChatGPT input found');
    return null;
  }

  function findChatGPTSubmit() {
    console.log('Searching for ChatGPT submit button...');
    
    const selectors = [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button:has(svg[data-icon="paper-airplane"])',
      'button:has(svg[data-icon="arrow-up"])',
      'button:has(svg[data-icon="send"])',
      'button.absolute.p-1.rounded-md',
      'form button[type="submit"]',
      'button[disabled="false"]',
      '[data-testid="composer-send-button"]'
    ];
    
    // Try specific selectors first
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetHeight > 0 && element.offsetWidth > 0) {
          const style = window.getComputedStyle(element);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            console.log(`ChatGPT submit found with selector: ${selector}`);
            return element;
          }
        }
      } catch (e) {
        console.log(`Submit selector failed: ${selector} - ${e.message}`);
      }
    }
    
    // Find by SVG content (ChatGPT uses arrow/send icons)
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const svg = button.querySelector('svg');
      if (svg) {
        const svgContent = svg.outerHTML.toLowerCase();
        const hasArrow = svgContent.includes('arrow') || svgContent.includes('paper-airplane') || 
                        svgContent.includes('send') || svgContent.includes('m2 2l');
        
        if (hasArrow && !button.disabled && button.offsetHeight > 0) {
          console.log('ChatGPT submit found via SVG analysis');
          return button;
        }
      }
    }
    
    // Find button near textarea
    const textarea = findChatGPTInput();
    if (textarea) {
      const container = textarea.closest('form') || textarea.parentElement?.parentElement;
      if (container) {
        const nearbyButtons = container.querySelectorAll('button');
        for (const button of nearbyButtons) {
          if (!button.disabled && button.type !== 'button' && button.offsetHeight > 0) {
            console.log('ChatGPT submit found near textarea');
            return button;
          }
        }
      }
    }
    
    console.log('No ChatGPT submit button found');
    return null;
  }

  function handleChatGPTInput(element, text) {
    console.log('Handling ChatGPT input injection...');
    
    try {
      // Focus the element first
      element.focus();
      element.click();
      
      // Wait a moment for focus to settle
      setTimeout(() => {
        // Clear existing content multiple ways
        element.value = '';
        element.textContent = '';
        
        if (element.tagName.toLowerCase() === 'textarea') {
          // For textarea elements
          element.value = text;
          
          // Comprehensive event triggering for React
          const events = [
            new Event('focus', { bubbles: true }),
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true }),
            new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }),
            new KeyboardEvent('keyup', { key: 'a', ctrlKey: true, bubbles: true }),
            new Event('input', { bubbles: true }),
            new Event('propertychange', { bubbles: true })
          ];
          
          events.forEach(event => {
            try {
              element.dispatchEvent(event);
            } catch (e) {
              console.log('Event dispatch failed:', e);
            }
          });
          
          // Alternative method: simulate typing
          setTimeout(() => {
            if (element.value !== text) {
              element.value = text;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Trigger React's internal updater
              const descriptor = Object.getOwnPropertyDescriptor(element, 'value') || 
                               Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
              if (descriptor && descriptor.set) {
                descriptor.set.call(element, text);
                element.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          }, 300);
          
        } else {
          // For contenteditable divs
          element.innerHTML = '';
          element.textContent = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Verify injection after a delay
        setTimeout(() => {
          const currentValue = element.value || element.textContent || '';
          const success = currentValue.includes(text.substring(0, 50));
          console.log(`ChatGPT injection result: ${success ? 'SUCCESS' : 'FAILED'}`);
          console.log(`Expected length: ${text.length}, Actual length: ${currentValue.length}`);
          
          if (!success) {
            // Last resort: direct property manipulation
            try {
              Object.defineProperty(element, 'value', {
                value: text,
                writable: true,
                configurable: true
              });
              element.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {
              console.log('Direct property manipulation failed:', e);
            }
          }
        }, 500);
        
      }, 100);
      
      return true;
      
    } catch (error) {
      console.error('ChatGPT input error:', error);
      return false;
    }
  }

  function submitChatGPT(button) {
    console.log('Attempting ChatGPT submission...');
    
    try {
      // Method 1: Standard click
      button.focus();
      button.click();
      
      // Method 2: Mouse events simulation
      setTimeout(() => {
        const mouseEvents = [
          new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
          new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
          new MouseEvent('click', { bubbles: true, cancelable: true })
        ];
        
        mouseEvents.forEach(event => {
          try {
            button.dispatchEvent(event);
          } catch (e) {
            console.log('Mouse event failed:', e);
          }
        });
      }, 200);
      
      // Method 3: Form submission
      setTimeout(() => {
        const form = button.closest('form');
        if (form) {
          try {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          } catch (e) {
            console.log('Form submit failed:', e);
          }
        }
      }, 400);
      
      // Method 4: Enter key on textarea
      setTimeout(() => {
        const textarea = findChatGPTInput();
        if (textarea) {
          textarea.focus();
          
          const enterEvents = [
            new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            }),
            new KeyboardEvent('keypress', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            }),
            new KeyboardEvent('keyup', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            })
          ];
          
          enterEvents.forEach(event => {
            try {
              textarea.dispatchEvent(event);
            } catch (e) {
              console.log('Enter key event failed:', e);
            }
          });
        }
      }, 600);
      
      // Method 5: Ctrl+Enter (ChatGPT shortcut)
      setTimeout(() => {
        const textarea = findChatGPTInput();
        if (textarea) {
          textarea.focus();
          textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
          }));
        }
      }, 800);
      
      console.log('ChatGPT submit attempted with multiple methods');
      return true;
      
    } catch (error) {
      console.error('ChatGPT submit error:', error);
      return false;
    }
  }

  // CLAUDE FUNCTIONS (Keeping your working version)
  function findClaudeInput() {
    const selectors = [
      '.ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'fieldset div[contenteditable="true"]',
      '[data-testid="chat-input"]',
      '.claude-input'
    ];
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetHeight > 10 && element.offsetWidth > 10) {
          console.log(`Claude input found: ${selector}`);
          return element;
        }
      } catch (e) {
        console.log(`Claude selector failed: ${selector}`);
      }
    }
    
    return null;
  }

  function findClaudeSubmit() {
    const selectors = [
      'button[aria-label="Send Message"]',
      'button[aria-label*="Send"]',
      'button:has(svg[aria-label*="Send"])',
      'button[data-testid="send-button"]',
      'button[type="submit"]',
      'form button'
    ];
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && !element.disabled && element.offsetHeight > 0) {
          console.log(`Claude submit found: ${selector}`);
          return element;
        }
      } catch (e) {
        console.log(`Claude submit selector failed: ${selector}`);
      }
    }
    
    // Fallback: find any button with send-like characteristics
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
      const hasIcon = button.querySelector('svg');
      
      if ((ariaLabel.includes('send') || hasIcon) && !button.disabled && button.offsetHeight > 0) {
        console.log('Claude submit found via fallback');
        return button;
      }
    }
    
    return null;
  }

  function handleClaudeInput(element, text) {
    try {
      // Prevent duplicate injection
      if (element.dataset.injected === 'true') {
        console.log('Claude already injected, skipping');
        return true;
      }
      
      element.focus();
      
      // Clear content
      element.innerHTML = '';
      element.textContent = '';
      
      // Set content
      element.textContent = text;
      
      // Trigger events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Mark as injected
      element.dataset.injected = 'true';
      
      // Verify content
      const success = element.textContent.includes(text.substring(0, 50));
      console.log(`Claude content injection: ${success ? 'SUCCESS' : 'FAILED'}`);
      return success;
      
    } catch (error) {
      console.error('Claude input error:', error);
      return false;
    }
  }

  function submitClaude(button) {
    try {
      console.log('Attempting Claude submission...');
      
      // Method 1: Direct click
      button.focus();
      button.click();
      
      // Method 2: Mouse events
      setTimeout(() => {
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, 100);
      
      // Method 3: Keyboard enter on input
      setTimeout(() => {
        const input = document.querySelector('.ProseMirror, div[contenteditable="true"]');
        if (input) {
          input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true
          }));
        }
      }, 200);
      
      console.log('Claude submit attempted with multiple methods');
      return true;
      
    } catch (error) {
      console.error('Claude submit error:', error);
      return false;
    }
  }

  // GEMINI FUNCTIONS (Keeping your working version)
  function findGeminiInput() {
    const selectors = [
      'div[contenteditable="true"][data-initial-value]',
      'div[contenteditable="true"][role="textbox"]', 
      '.ql-editor',
      'div[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetHeight > 0) {
        return element;
      }
    }
    return null;
  }

  function findGeminiSubmit() {
    const selectors = [
      'button[aria-label*="Send"]',
      'button.send-button',
      'button:has(svg[aria-label*="Send"])'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && !element.disabled) {
        return element;
      }
    }
    return null;
  }

  function handleGeminiInput(element, text) {
    try {
      element.focus();
      element.textContent = '';
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      setTimeout(() => {
        if (element.textContent !== text) {
          element.textContent = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 200);
      
      return element.textContent.includes(text.substring(0, 50));
    } catch (error) {
      console.error('Gemini input error:', error);
      return false;
    }
  }

  function submitGemini(button) {
    try {
      button.click();
      return true;
    } catch (error) {
      console.error('Gemini submit error:', error);
      return false;
    }
  }

  // Start the injection process
  console.log(`Starting ${platform} injection process`);
  tryInjection();
}
