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

