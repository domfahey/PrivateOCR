import { init } from "./popup-logic.js";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    statusEl: document.getElementById("status"),
    outputEl: document.getElementById("output"),
    screenshotBtn: document.getElementById("screenshotBtn"),
    regionBtn: document.getElementById("regionBtn"),
    pasteBtn: document.getElementById("pasteBtn"),
    dropZone: document.getElementById("dropZone"),
    fileInput: document.getElementById("fileInput"),
    copyBtn: document.getElementById("copyBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    progressTrack: document.getElementById("progressTrack"),
    progressIndicator: document.getElementById("progressIndicator"),
    // Confidence indicator
    confidenceBadge: document.getElementById("confidenceBadge"),
    confidenceValue: document.getElementById("confidenceValue"),
    // New elements for split view
    previewImage: document.getElementById("previewImage"),
    emptyImageState: document.getElementById("emptyImageState"),
    contentArea: document.getElementById("contentArea"),
    settingsBtn: document.getElementById("settingsBtn"),
    // Toolbar elements
    toggleImageBtn: document.getElementById("toggleImageBtn"),
    imgZoomInBtn: document.getElementById("imgZoomInBtn"),
    imgZoomOutBtn: document.getElementById("imgZoomOutBtn"),
    imgZoomFitBtn: document.getElementById("imgZoomFitBtn"),
    textZoomInBtn: document.getElementById("textZoomInBtn"),
    textZoomOutBtn: document.getElementById("textZoomOutBtn"),
  };

  init(elements);
});
