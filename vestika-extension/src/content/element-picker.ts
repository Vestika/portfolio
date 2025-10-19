/**
 * Element Picker Content Script
 *
 * Allows users to hover over elements and click to select them.
 * Generates a CSS selector for the selected element.
 */

// State management
let isPickerActive = false;
let hoveredElement: HTMLElement | null = null;
let pickerOverlay: HTMLDivElement | null = null;

// Injected styles for highlighting
const PICKER_STYLES = `
  .vestika-picker-highlight {
    outline: 2px solid #4CAF50 !important;
    outline-offset: 2px !important;
    cursor: crosshair !important;
    position: relative !important;
  }

  .vestika-picker-highlight::before {
    content: attr(data-vestika-selector) !important;
    position: absolute !important;
    top: -24px !important;
    left: 0 !important;
    background: #4CAF50 !important;
    color: white !important;
    padding: 2px 6px !important;
    font-size: 11px !important;
    font-family: monospace !important;
    border-radius: 3px !important;
    z-index: 999999 !important;
    white-space: nowrap !important;
    max-width: 300px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .vestika-picker-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 999998 !important;
    cursor: crosshair !important;
  }
`;

/**
 * Generate a unique CSS selector for an element
 */
function generateSelector(element: HTMLElement): string {
  // Try ID first (most specific)
  if (element.id) {
    return `#${element.id}`;
  }

  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c);
    if (classes.length > 0) {
      const classSelector = '.' + classes.join('.');
      // Check if this selector is unique
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

  // Build path from element to root
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add ID if available
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break; // ID is unique, we can stop here
    }

    // Add classes
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    // Add nth-child if needed for uniqueness
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Inject picker styles into the page
 */
function injectStyles(): void {
  const existingStyle = document.getElementById('vestika-picker-styles');
  if (existingStyle) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'vestika-picker-styles';
  style.textContent = PICKER_STYLES;
  document.head.appendChild(style);
}

/**
 * Remove picker styles from the page
 */
function removeStyles(): void {
  const style = document.getElementById('vestika-picker-styles');
  if (style) {
    style.remove();
  }
}

/**
 * Handle mouse move event to highlight hovered element
 */
function handleMouseMove(event: MouseEvent): void {
  if (!isPickerActive) return;

  event.preventDefault();
  event.stopPropagation();

  const target = event.target as HTMLElement;

  // Don't highlight the overlay itself
  if (target === pickerOverlay) return;

  // Remove highlight from previous element
  if (hoveredElement && hoveredElement !== target) {
    hoveredElement.classList.remove('vestika-picker-highlight');
    hoveredElement.removeAttribute('data-vestika-selector');
  }

  // Highlight new element
  hoveredElement = target;
  const selector = generateSelector(target);
  hoveredElement.classList.add('vestika-picker-highlight');
  hoveredElement.setAttribute('data-vestika-selector', selector);
}

/**
 * Handle click event to select element
 */
function handleClick(event: MouseEvent): void {
  if (!isPickerActive) return;

  event.preventDefault();
  event.stopPropagation();

  const target = event.target as HTMLElement;

  // Don't select the overlay itself
  if (target === pickerOverlay) return;

  const selector = generateSelector(target);

  console.log('[Element Picker] Selected element:', selector);

  // Stop the picker
  stopPicker();

  // Save selector to storage so popup can retrieve it
  chrome.storage.local.set({
    lastSelector: selector,
    pickerActive: false,
    selectedElement: {
      selector,
      tagName: target.tagName.toLowerCase(),
      id: target.id || undefined,
      className: target.className || undefined,
    }
  });

  // Also send message to popup (in case it's still open)
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    payload: {
      selector,
      tagName: target.tagName.toLowerCase(),
      id: target.id || undefined,
      className: target.className || undefined,
    }
  }).catch(() => {
    // Popup might be closed, that's OK - we saved to storage
    console.log('[Element Picker] Popup closed, selector saved to storage');
  });
}

/**
 * Handle escape key to cancel picker
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!isPickerActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    stopPicker();

    // Save cancelled state to storage
    chrome.storage.local.set({
      pickerActive: false
    });

    // Notify popup that picker was cancelled
    chrome.runtime.sendMessage({
      type: 'ELEMENT_PICKER_CANCELLED'
    }).catch(() => {
      console.log('[Element Picker] Picker cancelled, popup closed');
    });
  }
}

/**
 * Start the element picker
 */
export function startPicker(): void {
  if (isPickerActive) {
    console.log('[Element Picker] Already active');
    return;
  }

  console.log('[Element Picker] Starting...');
  isPickerActive = true;

  // Inject styles
  injectStyles();

  // Create overlay to capture all events
  pickerOverlay = document.createElement('div');
  pickerOverlay.className = 'vestika-picker-overlay';
  document.body.appendChild(pickerOverlay);

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  console.log('[Element Picker] Started');
}

/**
 * Stop the element picker
 */
export function stopPicker(): void {
  if (!isPickerActive) {
    return;
  }

  console.log('[Element Picker] Stopping...');
  isPickerActive = false;

  // Remove highlight from current element
  if (hoveredElement) {
    hoveredElement.classList.remove('vestika-picker-highlight');
    hoveredElement.removeAttribute('data-vestika-selector');
    hoveredElement = null;
  }

  // Remove overlay
  if (pickerOverlay) {
    pickerOverlay.remove();
    pickerOverlay = null;
  }

  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  // Remove styles
  removeStyles();

  console.log('[Element Picker] Stopped');
}

/**
 * Check if picker is currently active
 */
export function isPickerRunning(): boolean {
  return isPickerActive;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Element Picker] Received message:', message);

  if (message.type === 'START_ELEMENT_PICKER') {
    startPicker();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_ELEMENT_PICKER') {
    stopPicker();
    sendResponse({ success: true });
  } else if (message.type === 'IS_PICKER_ACTIVE') {
    sendResponse({ active: isPickerActive });
  }

  return true; // Keep message channel open for async response
});

console.log('[Element Picker] Content script loaded');
