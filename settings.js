document.addEventListener("DOMContentLoaded", async () => {
  const platformSelect = document.getElementById("platformSelect");
  const promptInput = document.getElementById("promptInput");
  const saveBtn = document.getElementById("saveBtn");

  // Load saved settings
  const { selectedPlatform, customPrompt } = await chrome.storage.local.get(["selectedPlatform", "customPrompt"]);
  platformSelect.value = selectedPlatform || "chatgpt";
  promptInput.value = customPrompt || "Summarize this video.";

  saveBtn.addEventListener("click", () => {
    const newPlatform = platformSelect.value;
    const newPrompt = promptInput.value;

    chrome.storage.local.set({
      selectedPlatform: newPlatform,
      customPrompt: newPrompt
    }, () => {
      alert("Settings saved successfully!");
      window.close();
    });
  });
});
