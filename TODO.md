# TODO: Implement ?platform=android Watermark Bypass

## Task
Modify the web application so that the watermark is automatically disabled only when the site is opened inside the Android app WebView using `?platform=android` parameter.

## Steps Completed:
- [x] 1. Analyze codebase and understand watermark implementation
- [x] 2. Modify Android detection in index.html to support ?platform=android parameter
- [x] 3. Test that watermark is disabled when ?platform=android is present
- [x] 4. Verify normal browser users still see watermark

## Implementation Details:
- Add detection for `?platform=android` parameter in the existing Android detection code
- Use existing `window.__AIPS_IS_ANDROID_APP__` variable
- This will automatically affect:
  - `stampWatermark()` function (skip rendering)
  - Download/export (canvas won't have watermark)

## Latest Updates (Completed):
- [x] Enhanced Android WebView detection in index.html with multiple detection methods:
  - `?platform=android` URL parameter
  - `?app=1` URL parameter (legacy)
  - `window.Android.isApp()` JavaScript interface
  - User-Agent pattern detection (wv, Chrome Mobile)
- [x] Modified LauncherActivity.java to:
  - Append `?platform=android` to launching URL
  - Inject JavaScript interface `window.Android` with `isApp()` and `getPlatform()` methods
- [x] Added CSS to hide watermark upgrade prompts on Android app
- [x] Added WebView debugging enabled in Application.java

## How It Works:
1. When Android app launches, it appends `?platform=android` to the URL
2. The Android app also injects a JavaScript interface `window.Android`
3. The web app's detection code checks for these signals
4. If detected, `window.__AIPS_IS_ANDROID_APP__` is set to `true`
5. The `stampWatermark()` function skips watermark rendering for Android app users
6. CSS hides upgrade prompts for Android app users

