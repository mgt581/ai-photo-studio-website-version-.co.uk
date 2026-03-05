/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package uk.co.aiphotostudio.twa;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;


public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    
    // JavaScript interface to expose Android app detection to the web page
    public class AndroidInterface {
        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }
        
        @JavascriptInterface
        public boolean isApp() {
            return true;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        // Append ?platform=android to the URL to signal that we're in the Android app WebView
        // This allows the web app to automatically disable watermarks for app users
        String originalUrl = uri.toString();
        String separator = originalUrl.contains("?") ? "&" : "?";
        String newUrl = originalUrl + separator + "platform=android";
        
        return Uri.parse(newUrl);
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        
        // Inject Android interface into the WebView for reliable detection
        // This runs after the WebView is created
        final WebView webView = findViewById(android.R.id.content);
        if (webView != null) {
            webView.addJavascriptInterface(new AndroidInterface(), "Android");
        }
    }
}
