# TODO: Hide Payment Buttons on Android App

## Task
Hide payment/subscription buttons when using the Android app (WebView) while keeping them visible on the web version.

## Completed Steps
- [x] Analyzed codebase and identified payment button locations
- [x] Updated settings.html - Added Android app detection and hidden subscription button
- [x] Payment buttons already hidden in index.html (pricing-row)

## Summary
The following changes were made:

### settings.html
- Added Android app detection JavaScript (same as index.html)
- Added CSS to hide `.subscription-section` on Android app
- Added `subscription-section` class to the subscription content div

### How it works:
1. The JavaScript detects Android WebView using:
   - URL parameter `?app=1` (can be passed from Android app)
   - UserAgent detection for Android + WebView
   - `window.Android` bridge detection
2. When detected, adds `android-app` class to `<html>` element
3. CSS hides `.subscription-section` when this class is present

### Files with payment buttons:
- ✅ index.html (pricing-row) - Already handled
- ✅ settings.html (Manage Subscription) - Now updated


