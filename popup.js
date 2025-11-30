// popup.js

const profileTextarea = document.getElementById("profile");
const saveButton = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load stored profile when popup opens
chrome.storage.sync.get(["profileText"], (result) => {
  if (result.profileText) {
    profileTextarea.value = result.profileText;
  } else {
    profileTextarea.value = `Ich bin Abdallah, Softwareentwickler in Heilbronn.
Nichtraucher, keine Haustiere, ruhiger Mieter.
Stabile Einkünfte, Interesse an längerfristigem Mietverhältnis.`;
  }
});

// Save on click
saveButton.addEventListener("click", () => {
  const text = profileTextarea.value;
  chrome.storage.sync.set({ profileText: text }, () => {
    statusEl.textContent = "Profiltext gespeichert.";
    setTimeout(() => {
      statusEl.textContent = "(v0) Profiltext lokal gespeichert.";
    }, 1500);
  });
});
