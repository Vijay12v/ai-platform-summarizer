(async () => {
  const { autoPrompt } = await chrome.storage.local.get("autoPrompt");

  const inputSelector = 'textarea';
  const buttonSelector = 'button';

  const waitForElement = async (selector) => {
    for (let i = 0; i < 30; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  };

  const input = await waitForElement(inputSelector);
  const button = await waitForElement(buttonSelector);

  if (input && button) {
    input.value = autoPrompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
  }
})();
