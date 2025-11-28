import { init } from "./popup-logic.js";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    statusEl: document.getElementById("status"),
    outputEl: document.getElementById("output"),
    screenshotBtn: document.getElementById("screenshotBtn"),
    regionBtn: document.getElementById("regionBtn"),
    copyBtn: document.getElementById("copyBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    progressTrack: document.getElementById("progressTrack"),
    progressIndicator: document.getElementById("progressIndicator"),
  };

  init(elements);
});