// Popup script - UI logic for the extension

// State
let images = [];
let selectedImages = new Set();
let settings = {
  format: 'image/webp',
  quality: 80,
  minSize: 100
};

// Presets
const presets = {
  web: { format: 'image/webp', quality: 70 },
  balanced: { format: 'image/webp', quality: 80 },
  quality: { format: 'image/jpeg', quality: 95 }
};

// DOM elements
const elements = {
  loading: document.getElementById('loading'),
  mainContent: document.getElementById('main-content'),
  imageCount: document.getElementById('image-count'),
  refreshBtn: document.getElementById('refresh-btn'),
  formatSelect: document.getElementById('format-select'),
  qualitySlider: document.getElementById('quality-slider'),
  qualityValue: document.getElementById('quality-value'),
  qualityRow: document.getElementById('quality-row'),
  minSize: document.getElementById('min-size'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  selectAllBtn: document.getElementById('select-all-btn'),
  deselectAllBtn: document.getElementById('deselect-all-btn'),
  imagesGrid: document.getElementById('images-grid'),
  selectedCount: document.getElementById('selected-count'),
  copyBtn: document.getElementById('copy-btn'),
  downloadBtn: document.getElementById('download-btn'),
  progressOverlay: document.getElementById('progress-overlay'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  cancelBtn: document.getElementById('cancel-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadSettings();
  setupEventListeners();
  await scanForImages();
}

function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      settings = { ...settings, ...result.settings };
      updateSettingsUI();
    }
  });
}

function saveSettings() {
  chrome.storage.local.set({ settings });
}

function updateSettingsUI() {
  elements.formatSelect.value = settings.format;
  elements.qualitySlider.value = settings.quality;
  elements.qualityValue.textContent = settings.quality;
  elements.minSize.value = settings.minSize;

  // Show/hide quality slider based on format
  const showQuality = settings.format !== 'image/png' && settings.format !== 'original';
  elements.qualityRow.style.display = showQuality ? 'block' : 'none';

  // Update preset buttons
  elements.presetBtns.forEach((btn) => {
    const preset = presets[btn.dataset.preset];
    const isActive = preset && preset.format === settings.format && preset.quality === settings.quality;
    btn.classList.toggle('active', isActive);
  });
}

function setupEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', scanForImages);

  // Format select
  elements.formatSelect.addEventListener('change', (e) => {
    settings.format = e.target.value;
    updateSettingsUI();
    saveSettings();
  });

  // Quality slider
  elements.qualitySlider.addEventListener('input', (e) => {
    settings.quality = parseInt(e.target.value);
    elements.qualityValue.textContent = settings.quality;
    updateSettingsUI();
    saveSettings();
  });

  // Min size
  elements.minSize.addEventListener('change', (e) => {
    settings.minSize = parseInt(e.target.value) || 0;
    saveSettings();
    filterImages();
  });

  // Preset buttons
  elements.presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = presets[btn.dataset.preset];
      if (preset) {
        settings.format = preset.format;
        settings.quality = preset.quality;
        updateSettingsUI();
        saveSettings();
      }
    });
  });

  // Selection controls
  elements.selectAllBtn.addEventListener('click', selectAll);
  elements.deselectAllBtn.addEventListener('click', deselectAll);

  // Copy URLs button
  elements.copyBtn.addEventListener('click', copyUrls);

  // Download button
  elements.downloadBtn.addEventListener('click', startDownload);

  // Cancel button
  elements.cancelBtn.addEventListener('click', cancelDownload);

  // Listen for progress updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'downloadProgress') {
      updateProgress(message.completed, message.total);
    }
  });
}

async function scanForImages() {
  elements.loading.classList.remove('hidden');
  elements.mainContent.style.opacity = '0.5';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showError('No active tab found');
      return;
    }

    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content.js']
      });
    } catch (e) {
      // Script may already be injected
    }

    // Request images from content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractImages',
      minSize: settings.minSize
    });

    if (response && response.images) {
      images = response.images;
      selectedImages.clear();
      renderImages();
    } else {
      showError('Could not extract images from this page');
    }
  } catch (error) {
    console.error('Scan error:', error);
    showError('Cannot scan this page. Try refreshing the page first.');
  } finally {
    elements.loading.classList.add('hidden');
    elements.mainContent.style.opacity = '1';
  }
}

function filterImages() {
  const filtered = images.filter((img) => {
    if (img.width === 0 && img.height === 0) return true;
    return img.width >= settings.minSize || img.height >= settings.minSize;
  });
  renderImages(filtered);
}

function renderImages(imageList = images) {
  const filtered = imageList.filter((img) => {
    if (img.width === 0 && img.height === 0) return true;
    return img.width >= settings.minSize || img.height >= settings.minSize;
  });

  elements.imageCount.textContent = `${filtered.length} images found`;

  if (filtered.length === 0) {
    elements.imagesGrid.innerHTML = '<p class="empty-state">No images found on this page</p>';
    updateSelectionUI();
    return;
  }

  elements.imagesGrid.innerHTML = filtered
    .map((img, index) => {
      const isSelected = selectedImages.has(img.url);
      const sizeText = img.width && img.height ? `${img.width}×${img.height}` : '';

      return `
        <div class="image-item ${isSelected ? 'selected' : ''}" data-index="${index}" data-url="${escapeHtml(img.url)}">
          <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text fill=%22%23666%22 x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22>?</text></svg>'">
          <div class="check-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          ${sizeText ? `<div class="size-badge">${sizeText}</div>` : ''}
        </div>
      `;
    })
    .join('');

  // Add click handlers
  elements.imagesGrid.querySelectorAll('.image-item').forEach((item) => {
    item.addEventListener('click', () => toggleImageSelection(item));
  });

  updateSelectionUI();
}

function toggleImageSelection(item) {
  const url = item.dataset.url;

  if (selectedImages.has(url)) {
    selectedImages.delete(url);
    item.classList.remove('selected');
  } else {
    selectedImages.add(url);
    item.classList.add('selected');
  }

  updateSelectionUI();
}

function selectAll() {
  const filtered = images.filter((img) => {
    if (img.width === 0 && img.height === 0) return true;
    return img.width >= settings.minSize || img.height >= settings.minSize;
  });

  filtered.forEach((img) => selectedImages.add(img.url));

  elements.imagesGrid.querySelectorAll('.image-item').forEach((item) => {
    item.classList.add('selected');
  });

  updateSelectionUI();
}

function deselectAll() {
  selectedImages.clear();

  elements.imagesGrid.querySelectorAll('.image-item').forEach((item) => {
    item.classList.remove('selected');
  });

  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedImages.size;
  elements.selectedCount.textContent = `${count} selected`;
  elements.downloadBtn.disabled = count === 0;
  elements.copyBtn.disabled = count === 0;
}

async function copyUrls() {
  if (selectedImages.size === 0) return;

  const urls = Array.from(selectedImages).join('\n');

  try {
    await navigator.clipboard.writeText(urls);

    // Show copied feedback
    const originalText = elements.copyBtn.innerHTML;
    elements.copyBtn.classList.add('copied');
    elements.copyBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;

    setTimeout(() => {
      elements.copyBtn.classList.remove('copied');
      elements.copyBtn.innerHTML = originalText;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

async function startDownload() {
  if (selectedImages.size === 0) return;

  const selectedList = images.filter((img) => selectedImages.has(img.url));

  elements.progressOverlay.classList.remove('hidden');
  elements.progressFill.style.width = '0%';
  elements.progressText.textContent = `0 / ${selectedList.length}`;

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'downloadImages',
      images: selectedList,
      format: settings.format,
      quality: settings.quality
    });

    if (result.success) {
      elements.progressFill.style.width = '100%';
      elements.progressText.textContent = `Downloaded ${result.downloaded} images`;

      if (result.failed > 0) {
        console.warn('Failed downloads:', result.failedItems);
      }

      setTimeout(() => {
        elements.progressOverlay.classList.add('hidden');
      }, 1500);
    } else {
      showError(result.error || 'Download failed');
      elements.progressOverlay.classList.add('hidden');
    }
  } catch (error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
    elements.progressOverlay.classList.add('hidden');
  }
}

function updateProgress(completed, total) {
  const percent = (completed / total) * 100;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = `${completed} / ${total}`;
}

async function cancelDownload() {
  await chrome.runtime.sendMessage({ action: 'cancelDownload' });
  elements.progressOverlay.classList.add('hidden');
}

function showError(message) {
  elements.imagesGrid.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
