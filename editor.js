/**
 * AI Photo Studio - Editor JavaScript
 * Handles image editing operations including background removal,
 * background change, background color selection, and more
 */

// Global state
let currentMode = null;
let uploadedImage = null;
let editorCanvas = null;
let editorCtx = null;
let imageElement = null;

// --- Pro / Subscription flag ---
window.proEnabled = false;

/**
 * Web app: reads pro status from Firestore users/{uid}
 * Android app: stays watermark-free (your current product choice)
 */
async function refreshProFlag(user) {
  try {
    // Keep Android always watermark-free
    if (window.__AIPS_IS_ANDROID_APP__) {
      window.proEnabled = true;
      return;
    }

    // Expect Firestore db to exist (defined in your firebase init)
    if (typeof db === "undefined") {
      console.warn("Firestore 'db' not found. proEnabled forced false.");
      window.proEnabled = false;
      return;
    }

    // Load Firestore helpers (no build tools needed)
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    const now = Math.floor(Date.now() / 1000);

    if (!snap.exists()) {
      window.proEnabled = false;
      return;
    }

    const data = snap.data();
    window.proEnabled = !!data.pro && (data.currentPeriodEnd || 0) > now;

    console.log("✅ proEnabled:", window.proEnabled, data);
  } catch (e) {
    console.error("refreshProFlag failed:", e);
    window.proEnabled = false;
  }
}

/**
 * ✅ TRANSPARENCY / EXPORT SAFETY
 * The checkerboard must NEVER be baked into the exported PNG.
 * The checkerboard is UI-only (CSS). Export must use real alpha pixels.
 *
 * Problem this fixes:
 * - If user applies a solid background color, then switches back to "Transparent",
 *   your preview <img> (editorImage) may already be a flattened snapshot (no alpha),
 *   so "transparent" would still export with a baked background.
 *
 * Fix:
 * - Keep a snapshot of the canvas BEFORE any background color is applied
 *   (transparentSnapshot).
 * - When user selects Transparent, restore that snapshot.
 * - When exporting, always export from a fresh transparent offscreen canvas.
 */
let transparentSnapshot = null;     // ImageData snapshot of the true transparent version
let snapshotW = 0;
let snapshotH = 0;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEditor();

  // Hook into auth state so proEnabled updates after login (web)
  (async () => {
    try {
      // Android stays watermark-free
      if (window.__AIPS_IS_ANDROID_APP__) {
        window.proEnabled = true;
        return;
      }

      if (typeof auth === "undefined") {
        console.warn("Firebase 'auth' not found. proEnabled default false.");
        window.proEnabled = false;
        return;
      }

      const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");

      onAuthStateChanged(auth, async (user) => {
        if (user) {
          await refreshProFlag(user);
        } else {
          window.proEnabled = false;
        }
      });
    } catch (e) {
      console.warn("Auth listener setup failed:", e);
      window.proEnabled = false;
    }
  })();
});

/**
 * Initialize the editor
 */
function initializeEditor() {
    const imageInput = document.getElementById('imageInput');
    const editorImage = document.getElementById('editorImage');
    
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }
    
    // Keep reference if present
    if (editorImage) {
        imageElement = editorImage;
    }
    
    // Create hidden canvas for editing
    createEditorCanvas();
    
    // Update active tool label
    updateActiveToolLabel('Select a tool');
}

/**
 * Create a hidden canvas for image editing
 */
function createEditorCanvas() {
    editorCanvas = document.createElement('canvas');
    editorCanvas.id = 'editorCanvas';
    editorCanvas.style.display = 'none';
    document.body.appendChild(editorCanvas);
    
    editorCtx = editorCanvas.getContext('2d', { willReadFrequently: true });
    
    // Initialize the background color picker
    // (imageElement may be null until upload; init() safely stores refs)
    if (typeof BackgroundColorPicker !== 'undefined' && BackgroundColorPicker) {
        BackgroundColorPicker.init(editorCanvas, imageElement);
    }
}

/**
 * Capture a transparent snapshot of the current canvas state.
 * This becomes our "true transparent" baseline before applying solid backgrounds.
 */
function captureTransparentSnapshot() {
    if (!editorCanvas || !editorCtx) return;
    try {
        transparentSnapshot = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
        snapshotW = editorCanvas.width;
        snapshotH = editorCanvas.height;
    } catch (e) {
        console.warn('Could not capture transparent snapshot:', e);
        transparentSnapshot = null;
        snapshotW = snapshotH = 0;
    }
}

/**
 * Restore the canvas from the previously captured transparent snapshot.
 */
function restoreTransparentSnapshot() {
    if (!editorCanvas || !editorCtx) return false;
    if (!transparentSnapshot || snapshotW !== editorCanvas.width || snapshotH !== editorCanvas.height) return false;

    try {
        // ✅ This restores true alpha pixels (transparent background)
        editorCtx.putImageData(transparentSnapshot, 0, 0);
        updatePreview();

        // Re-init background picker so it points at the latest image
        const editorImage = document.getElementById('editorImage');
        if (editorImage) {
            imageElement = editorImage;
            if (typeof BackgroundColorPicker !== 'undefined' && BackgroundColorPicker) {
                BackgroundColorPicker.init(editorCanvas, imageElement);
            }
        }
        return true;
    } catch (e) {
        console.warn('Could not restore transparent snapshot:', e);
        return false;
    }
}

/**
 * Handle image upload
 */
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedImage = new Image();
        uploadedImage.onload = function() {
            // Set canvas dimensions to match image
            editorCanvas.width = uploadedImage.width;
            editorCanvas.height = uploadedImage.height;

            // ✅ Clear canvas so it starts with alpha (transparent)
            editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
            
            // Draw image on canvas
            editorCtx.drawImage(uploadedImage, 0, 0);

            // ✅ Capture baseline snapshot (this is our "true" base image)
            captureTransparentSnapshot();
            
            // Display in preview
            const editorImage = document.getElementById('editorImage');
            if (editorImage) {
                editorImage.src = editorCanvas.toDataURL('image/png');
                imageElement = editorImage;
                
                // Re-initialize background picker with new image
                if (typeof BackgroundColorPicker !== 'undefined' && BackgroundColorPicker) {
                    BackgroundColorPicker.init(editorCanvas, imageElement);
                    // Ensure picker default is transparent
                    if (BackgroundColorPicker.setColor) BackgroundColorPicker.setColor(null);
                }
            }
        };
        uploadedImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Set the editing mode
 * @param {string} mode - The mode to set
 */
function setMode(mode) {
    currentMode = mode;
    const toolControls = document.getElementById('toolControls');
    
    // Clear previous controls
    toolControls.innerHTML = '';
    
    // Update active tool label
    const modeLabels = {
        'remove': 'Remove Background',
        'change': 'Change Background',
        'choose': 'Choose Background Color',
        'eraser': 'Magic Eraser',
        'person': 'Remove Person'
    };
    updateActiveToolLabel(modeLabels[mode] || 'Unknown Tool');
    
    // Handle mode-specific controls
    switch(mode) {
        case 'choose':
            showChooseBackgroundControls(toolControls);
            break;
        case 'remove':
            showRemoveBackgroundControls(toolControls);
            break;
        case 'change':
            showChangeBackgroundControls(toolControls);
            break;
        case 'eraser':
            showEraserControls(toolControls);
            break;
        case 'person':
            showRemovePersonControls(toolControls);
            break;
    }
}

/**
 * Show controls for Choose Background mode
 */
function showChooseBackgroundControls(container) {
    // Use the BackgroundColorPicker module
    if (typeof BackgroundColorPicker === 'undefined' || !BackgroundColorPicker) {
        console.warn('BackgroundColorPicker module not found');
        return;
    }

    // Use a local var so we can remember the last selection
    let lastPicked = BackgroundColorPicker.getSelectedColor ? BackgroundColorPicker.getSelectedColor() : null;

    BackgroundColorPicker.createColorPicker(container, function(color) {
        // Update the preview background to show checkerboard or solid color
        updatePreviewBackground(color);

        // ✅ If user chooses a SOLID color and we haven't captured baseline yet, capture it now
        // (This protects cases where baseline snapshot wasn't captured for some reason)
        if (color !== null && !transparentSnapshot) {
            captureTransparentSnapshot();
        }

        // ✅ If user chooses TRANSPARENT, restore the true-alpha pixels
        if (color === null) {
            const restored = restoreTransparentSnapshot();
            if (!restored) {
                // Fallback: at least ensure canvas is clear + redraw uploaded image
                if (editorCtx && uploadedImage) {
                    editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
                    editorCtx.drawImage(uploadedImage, 0, 0);
                    captureTransparentSnapshot();
                    updatePreview();
                }
            }
            // Keep picker state consistent
            if (BackgroundColorPicker.setColor) BackgroundColorPicker.setColor(null);
            console.log('Background set to transparent');
            lastPicked = null;
        } else {
            console.log('Background color set to:', color);
            lastPicked = color;
        }
    });
    
    // Add apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'pill-btn';
    applyBtn.textContent = 'Apply Background';
    applyBtn.onclick = function() {
        // ✅ If transparent, restore snapshot rather than redrawing from preview <img> (which may be flattened)
        const selected = BackgroundColorPicker.getSelectedColor ? BackgroundColorPicker.getSelectedColor() : lastPicked;

        if (selected === null) {
            restoreTransparentSnapshot();
            updatePreview();
            return;
        }

        // ✅ Before applying a solid bg, ensure baseline exists
        if (!transparentSnapshot) captureTransparentSnapshot();

        BackgroundColorPicker.applyBackground();
        updatePreview();
    };
    container.appendChild(applyBtn);
}

/**
 * Update the preview background based on selected color
 * @param {string|null} color - Selected color or null for transparent
 */
function updatePreviewBackground(color) {
    const imagePreview = document.querySelector('.image-preview');
    if (!imagePreview) return;
    
    // Remove existing background classes
    imagePreview.classList.remove('transparent-bg', 'color-bg');
    
    if (color === null) {
        // Show checkerboard for transparent (UI only)
        imagePreview.classList.add('transparent-bg');
        imagePreview.style.backgroundColor = 'transparent';
    } else {
        // Show solid color background (UI only)
        imagePreview.classList.add('color-bg');
        imagePreview.style.backgroundColor = color;
    }
}

/**
 * Show controls for Remove Background mode
 */
function showRemoveBackgroundControls(container) {
    const label = document.createElement('p');
    label.textContent = 'Click the button below to remove the background from your image.';
    label.style.cssText = 'text-align: center; margin: 10px 0;';
    container.appendChild(label);
    
    const processBtn = document.createElement('button');
    processBtn.className = 'pill-btn';
    processBtn.textContent = 'Remove Background';
    processBtn.onclick = function() {
        processImage('remove-bg');
    };
    container.appendChild(processBtn);
}

/**
 * Show controls for Change Background mode
 */
function showChangeBackgroundControls(container) {
    const label = document.createElement('p');
    label.textContent = 'Upload a new background image or choose a preset.';
    label.style.cssText = 'text-align: center; margin: 10px 0;';
    container.appendChild(label);
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'bgImageInput';
    input.style.display = 'none';
    
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'pill-btn';
    uploadBtn.textContent = 'Upload Background';
    uploadBtn.onclick = function() {
        input.click();
    };
    
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            processImage('change-bg', file);
        }
    });
    
    container.appendChild(input);
    container.appendChild(uploadBtn);
}

/**
 * Show controls for Magic Eraser mode
 */
function showEraserControls(container) {
    const label = document.createElement('p');
    label.textContent = 'Click on areas you want to erase from the image.';
    label.style.cssText = 'text-align: center; margin: 10px 0;';
    container.appendChild(label);
    
    const brushSizeLabel = document.createElement('label');
    brushSizeLabel.textContent = 'Brush Size: ';
    brushSizeLabel.style.cssText = 'display: block; margin: 10px 0;';
    
    const brushSize = document.createElement('input');
    brushSize.type = 'range';
    brushSize.min = '5';
    brushSize.max = '100';
    brushSize.value = '30';
    
    brushSizeLabel.appendChild(brushSize);
    container.appendChild(brushSizeLabel);
    
    const eraseBtn = document.createElement('button');
    eraseBtn.className = 'pill-btn';
    eraseBtn.textContent = 'Start Erasing';
    eraseBtn.onclick = function() {
        enableEraserMode(brushSize.value);
    };
    container.appendChild(eraseBtn);
}

/**
 * Show controls for Remove Person mode
 */
function showRemovePersonControls(container) {
    const label = document.createElement('p');
    label.textContent = 'AI will detect and remove people from your image.';
    label.style.cssText = 'text-align: center; margin: 10px 0;';
    container.appendChild(label);
    
    const processBtn = document.createElement('button');
    processBtn.className = 'pill-btn';
    processBtn.textContent = 'Remove Person';
    processBtn.onclick = function() {
        processImage('remove-person');
    };
    container.appendChild(processBtn);
}

/**
 * Process image with selected operation
 */
function processImage(operation, file = null) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    
    // Simulate processing (actual implementation would use ONNX models)
    setTimeout(function() {
        loadingOverlay.style.display = 'none';
        
        // For demo, just update the preview
        if (editorCanvas && editorCtx && uploadedImage) {
            // ✅ Preserve alpha baseline before any background effects
            editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
            editorCtx.drawImage(uploadedImage, 0, 0);
            captureTransparentSnapshot();
            updatePreview();
        }
    }, 2000);
}

/**
 * Enable eraser mode on canvas
 */
function enableEraserMode(brushSize) {
    const editorImage = document.getElementById('editorImage');
    if (!editorImage) return;
    
    // Remove existing eraser listeners to prevent accumulation
    disableEraserMode();
    
    editorImage.style.cursor = 'crosshair';
    
    let isDrawing = false;
    
    // Store handlers for later removal
    const handlers = {
        mousedown: function(e) {
            isDrawing = true;
            erase(e, brushSize);
        },
        mousemove: function(e) {
            if (isDrawing) {
                erase(e, brushSize);
            }
        },
        mouseup: function() {
            isDrawing = false;
            // ✅ update snapshot after edits so transparency remains true
            captureTransparentSnapshot();
        },
        mouseleave: function() {
            isDrawing = false;
            captureTransparentSnapshot();
        }
    };
    
    // Attach handlers
    editorImage.addEventListener('mousedown', handlers.mousedown);
    editorImage.addEventListener('mousemove', handlers.mousemove);
    editorImage.addEventListener('mouseup', handlers.mouseup);
    editorImage.addEventListener('mouseleave', handlers.mouseleave);
    
    // Store reference for cleanup
    editorImage._eraserHandlers = handlers;
}

/**
 * Disable eraser mode and remove event listeners
 */
function disableEraserMode() {
    const editorImage = document.getElementById('editorImage');
    if (!editorImage || !editorImage._eraserHandlers) return;
    
    const handlers = editorImage._eraserHandlers;
    editorImage.removeEventListener('mousedown', handlers.mousedown);
    editorImage.removeEventListener('mousemove', handlers.mousemove);
    editorImage.removeEventListener('mouseup', handlers.mouseup);
    editorImage.removeEventListener('mouseleave', handlers.mouseleave);
    
    editorImage._eraserHandlers = null;
    editorImage.style.cursor = 'default';
}

/**
 * Erase at position
 */
function erase(event, brushSize) {
    if (!imageElement) return;
    
    const rect = imageElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create erasing effect (make transparent)
    if (editorCtx && uploadedImage) {
        editorCtx.globalCompositeOperation = 'destination-out';
        editorCtx.beginPath();
        editorCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        editorCtx.fill();
        editorCtx.globalCompositeOperation = 'source-over';
        
        updatePreview();
    }
}

/**
 * Update the preview image with current canvas state
 */
function updatePreview() {
    const editorImage = document.getElementById('editorImage');
    if (editorImage && editorCanvas) {
        editorImage.src = editorCanvas.toDataURL('image/png');
    }
}

/**
 * ✅ Download the final edited image (TRUE transparent PNG)
 * - Never bakes the checkerboard
 * - Keeps alpha when transparent selected
 */
function downloadFinalImage() {
    if (!editorCanvas) return;

    // If the picker exists and is currently "transparent", prefer exporting from snapshot
    let wantTransparent = false;
    try {
        if (typeof BackgroundColorPicker !== 'undefined' && BackgroundColorPicker && BackgroundColorPicker.getSelectedColor) {
            wantTransparent = (BackgroundColorPicker.getSelectedColor() === null);
        }
    } catch (_) {}

    // Build export canvas (fresh, transparent)
    const out = document.createElement('canvas');
    out.width = editorCanvas.width;
    out.height = editorCanvas.height;
    const octx = out.getContext('2d');

    // Always clear first => alpha guaranteed
    octx.clearRect(0, 0, out.width, out.height);

    if (wantTransparent && transparentSnapshot && snapshotW === out.width && snapshotH === out.height) {
        // ✅ Export the true-alpha pixels (not the possibly flattened preview)
        octx.putImageData(transparentSnapshot, 0, 0);
    } else {
        // Export what user sees on canvas (color bg etc.)
        octx.drawImage(editorCanvas, 0, 0);
    }

    out.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.download = 'ai-photo-studio-edited.png';
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 500);
    }, 'image/png', 0.95);
}

/**
 * Update the active tool label
 */
function updateActiveToolLabel(text) {
    const label = document.getElementById('activeToolLabel');
    if (label) {
        label.textContent = text;
    }
}
