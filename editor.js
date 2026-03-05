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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeEditor();
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
    
    editorCtx = editorCanvas.getContext('2d');
    
    // Initialize the background color picker
    BackgroundColorPicker.init(editorCanvas, imageElement);
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
            
            // Draw image on canvas
            editorCtx.drawImage(uploadedImage, 0, 0);
            
            // Display in preview
            const editorImage = document.getElementById('editorImage');
            if (editorImage) {
                editorImage.src = editorCanvas.toDataURL();
                imageElement = editorImage;
                
                // Re-initialize background picker with new image
                BackgroundColorPicker.init(editorCanvas, imageElement);
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
    BackgroundColorPicker.createColorPicker(container, function(color) {
        // Update the preview background to show checkerboard or solid color
        updatePreviewBackground(color);
        
        if (color === null) {
            console.log('Background set to transparent');
        } else {
            console.log('Background color set to:', color);
        }
    });
    
    // Add apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'pill-btn';
    applyBtn.textContent = 'Apply Background';
    applyBtn.onclick = function() {
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
        // Show checkerboard for transparent
        imagePreview.classList.add('transparent-bg');
        imagePreview.style.backgroundColor = 'transparent';
    } else {
        // Show solid color background
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
            editorCtx.drawImage(uploadedImage, 0, 0);
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
    
    editorImage.style.cursor = 'crosshair';
    
    let isDrawing = false;
    
    editorImage.addEventListener('mousedown', function(e) {
        isDrawing = true;
        erase(e, brushSize);
    });
    
    editorImage.addEventListener('mousemove', function(e) {
        if (isDrawing) {
            erase(e, brushSize);
        }
    });
    
    editorImage.addEventListener('mouseup', function() {
        isDrawing = false;
    });
    
    editorImage.addEventListener('mouseleave', function() {
        isDrawing = false;
    });
}

/**
 * Erase at position
 */
function erase(event, brushSize) {
    const rect = editorImage.getBoundingClientRect();
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
        editorImage.src = editorCanvas.toDataURL();
    }
}

/**
 * Download the final edited image
 */
function downloadFinalImage() {
    // Use the BackgroundColorPicker's download function
    if (BackgroundColorPicker) {
        BackgroundColorPicker.downloadImage('ai-photo-studio-edited.png');
    } else if (editorCanvas) {
        // Fallback to direct canvas download
        const link = document.createElement('a');
        link.download = 'ai-photo-studio-edited.png';
        link.href = editorCanvas.toDataURL('image/png');
        link.click();
    }
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

