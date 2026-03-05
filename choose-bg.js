/**
 * Background Color Picker Module
 * Allows users to pick a background color from predefined colors
 * and apply it to an image/canvas while maintaining transparency
 */

const BackgroundColorPicker = (function() {
    // Predefined set of colors
    const predefinedColors = [
        '#FFFFFF', // White
        '#000000', // Black
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFF00', // Yellow
        '#FFA500', // Orange
        '#800080', // Purple
        '#FFC0CB', // Pink
        '#808080', // Gray
        '#A52A2A', // Brown
        '#00FFFF', // Cyan
    ];

    // State
    let selectedColor = null;
    let canvas = null;
    let ctx = null;
    let originalImage = null;
    let backgroundLayer = null;

    /**
     * Initialize the background color picker
     * @param {HTMLCanvasElement} canvasElement - The canvas element to apply background to
     * @param {HTMLImageElement} imageElement - The original image element
     */
    function init(canvasElement, imageElement) {
        canvas = canvasElement;
        originalImage = imageElement;
        
        if (canvas) {
            ctx = canvas.getContext('2d');
        }
        
        // Create offscreen canvas for background layer
        backgroundLayer = document.createElement('canvas');
        
        selectedColor = null;
    }

    /**
     * Create the color picker UI
     * @param {HTMLElement} container - Container element to append the picker to
     * @param {Function} onColorSelect - Callback when color is selected
     */
    function createColorPicker(container, onColorSelect) {
        if (!container) {
            console.error('Container element not provided');
            return;
        }

        // Create picker wrapper
        const pickerWrapper = document.createElement('div');
        pickerWrapper.className = 'color-picker-wrapper';
        pickerWrapper.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            padding: 15px;
            justify-content: center;
            background: #f5f5f5;
            border-radius: 8px;
            margin: 10px 0;
        `;

        // Create color buttons
        predefinedColors.forEach(color => {
            const colorBtn = document.createElement('button');
            colorBtn.className = 'color-btn';
            colorBtn.setAttribute('data-color', color);
            colorBtn.style.cssText = `
                width: 40px;
                height: 40px;
                border: 2px solid #ddd;
                border-radius: 50%;
                cursor: pointer;
                background-color: ${color};
                transition: transform 0.2s, border-color 0.2s;
            `;
            
            // Add hover effect
            colorBtn.addEventListener('mouseenter', () => {
                colorBtn.style.transform = 'scale(1.1)';
                colorBtn.style.borderColor = '#333';
            });
            
            colorBtn.addEventListener('mouseleave', () => {
                colorBtn.style.transform = 'scale(1)';
                colorBtn.style.borderColor = '#ddd';
            });
            
            // Add click handler
            colorBtn.addEventListener('click', () => {
                selectColor(color, pickerWrapper);
                if (onColorSelect) {
                    onColorSelect(color);
                }
            });
            
            pickerWrapper.appendChild(colorBtn);
        });

        // Create transparent (no background) option
        const transparentBtn = document.createElement('button');
        transparentBtn.className = 'color-btn transparent-btn';
        transparentBtn.innerHTML = '✕';
        transparentBtn.style.cssText = `
            width: 40px;
            height: 40px;
            border: 2px solid #ddd;
            border-radius: 50%;
            cursor: pointer;
            background: linear-gradient(45deg, #ccc 25%, transparent 25%),
                        linear-gradient(-45deg, #ccc 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #ccc 75%),
                        linear-gradient(-45deg, transparent 75%, #ccc 75%);
            background-size: 10px 10px;
            background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
            font-size: 16px;
            color: #333;
            transition: transform 0.2s, border-color 0.2s;
        `;
        
        transparentBtn.addEventListener('mouseenter', () => {
            transparentBtn.style.transform = 'scale(1.1)';
            transparentBtn.style.borderColor = '#333';
        });
        
        transparentBtn.addEventListener('mouseleave', () => {
            transparentBtn.style.transform = 'scale(1)';
            transparentBtn.style.borderColor = '#ddd';
        });
        
        transparentBtn.addEventListener('click', () => {
            selectColor(null, pickerWrapper); // null = transparent
            if (onColorSelect) {
                onColorSelect(null);
            }
        });
        
        pickerWrapper.appendChild(transparentBtn);

        // Add label
        const label = document.createElement('p');
        label.textContent = 'Choose background color (click ✕ for transparent)';
        label.style.cssText = `
            width: 100%;
            text-align: center;
            margin: 5px 0;
            font-size: 14px;
            color: #666;
        `;
        pickerWrapper.appendChild(label);

        container.appendChild(pickerWrapper);
        
        return pickerWrapper;
    }

    /**
     * Handle color selection
     * @param {string|null} color - Selected color hex or null for transparent
     * @param {HTMLElement} wrapper - The picker wrapper element
     */
    function selectColor(color, wrapper) {
        selectedColor = color;
        
        // Update UI - remove selected class from all buttons
        const buttons = wrapper.querySelectorAll('.color-btn');
        buttons.forEach(btn => {
            btn.style.boxShadow = 'none';
        });
        
        // Add selected style to clicked button
        const selectedBtn = wrapper.querySelector(`[data-color="${color}"]`) || 
                          wrapper.querySelector('.transparent-btn');
        if (selectedBtn) {
            selectedBtn.style.boxShadow = '0 0 0 3px #007bff';
        }
        
        // Apply the background
        applyBackground();
    }

    /**
     * Apply the selected background color to the canvas
     * Maintains transparency if no color is selected
     */
    function applyBackground() {
        if (!canvas || !ctx || !originalImage) {
            console.warn('Canvas, context, or image not initialized');
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // If no color selected (transparent), just draw the image without background
        if (selectedColor === null) {
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            return;
        }

        // Draw the colored background
        ctx.fillStyle = selectedColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image on top
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    }

    /**
     * Get the current selected color
     * @returns {string|null} - Selected color hex or null for transparent
     */
    function getSelectedColor() {
        return selectedColor;
    }

    /**
     * Set a specific color programmatically
     * @param {string|null} color - Color hex or null for transparent
     */
    function setColor(color) {
        if (color && !predefinedColors.includes(color) && color !== 'transparent') {
            console.warn('Color not in predefined list, but will still apply');
        }
        
        selectedColor = color === 'transparent' ? null : color;
        applyBackground();
    }

    /**
     * Get the final canvas with applied background
     * @returns {HTMLCanvasElement} - The canvas with background applied
     */
    function getCanvas() {
        return canvas;
    }

    /**
     * Get canvas data URL for saving
     * @param {string} format - Image format (png, jpeg, etc.)
     * @param {number} quality - Image quality (0-1)
     * @returns {string} - Data URL of the image
     */
    function getDataURL(format = 'png', quality = 1.0) {
        if (!canvas) {
            console.error('Canvas not initialized');
            return null;
        }
        return canvas.toDataURL(`image/${format}`, quality);
    }

    /**
     * Download the final image
     * @param {string} filename - Name for the downloaded file
     */
    function downloadImage(filename = 'edited-image.png') {
        const dataURL = getDataURL();
        if (!dataURL) return;

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        link.click();
    }

    /**
     * Reset to no background (transparent)
     */
    function reset() {
        selectedColor = null;
        if (ctx && originalImage) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        }
    }

    // Public API
    return {
        init,
        createColorPicker,
        applyBackground,
        getSelectedColor,
        setColor,
        getCanvas,
        getDataURL,
        downloadImage,
        reset,
        getPredefinedColors: () => predefinedColors
    };
})();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundColorPicker;
}

