package com.artedu.studentportal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebBackForwardList;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TARGET_URL = "https://art-faculty-app.vercel.app/system";

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout offlineLayout;
    private Button btnRetry;

    // File upload callback & camera uri
    private ValueCallback<Uri[]> mFilePathCallback;
    private Uri mCameraPhotoUri;

    // Double-tap to exit back handler
    private long backPressedTime = 0;

    // Modern ActivityResultLauncher for Camera & File Picker
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (mFilePathCallback != null) {
                    Uri[] results = null;
                    if (result.getResultCode() == RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null && data.getData() != null) {
                            // User picked a photo from Gallery/Files
                            results = new Uri[]{data.getData()};
                        } else if (data != null && data.getClipData() != null) {
                            // Multiple files selected
                            int count = data.getClipData().getItemCount();
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (mCameraPhotoUri != null) {
                            // User took photo with Camera
                            results = new Uri[]{mCameraPhotoUri};
                        }
                    }
                    mFilePathCallback.onReceiveValue(results);
                    mFilePathCallback = null;
                }
            });

    // Permission launcher for Camera
    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (!isGranted) {
                    Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_LONG).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupWebView();
        setupBackNavigation();
        checkPermissions();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(TARGET_URL);
        }
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        offlineLayout = findViewById(R.id.offlineLayout);
        btnRetry = findViewById(R.id.btnRetry);

        btnRetry.setOnClickListener(v -> {
            offlineLayout.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(TARGET_URL);
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // 1. Storage & JavaScript
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // 2. Viewport & 100% Native Touch Scrolling
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Enable smooth scrolling and scrollbars
        webView.setVerticalScrollBarEnabled(true);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        // 3. Media & Audio/Video
        settings.setMediaPlaybackRequiresUserGesture(false);

        // 4. Custom User-Agent tag
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " ArtEduStudentApp/1.0.0 (Android; Mobile)");

        // 5. Caching Strategy
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 6. Cookies
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        // WebChromeClient (Progress, File upload, Camera permission)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                launchPhotoChooserIntent();
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            return;
                        }
                    }
                    request.grant(request.getResources());
                }
            }
        });

        // WebViewClient (Navigation security, external apps, offline fallback)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return handleUrlScheme(uri);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                return handleUrlScheme(uri);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                offlineLayout.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    webView.setVisibility(View.GONE);
                    offlineLayout.setVisibility(View.VISIBLE);
                }
            }
        });

        // Download Listener (saving QR cards, PDFs, and artwork images)
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(filename);
                    request.setDescription("تحميل ملف من بوابة الطالب...");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "بدأ تحميل الملف: " + filename, Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ex) {
                        Toast.makeText(MainActivity.this, "تعذر تحميل الملف", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    /**
     * Handles opening external schemes like WhatsApp, Telegram, tel:, mailto:
     */
    private boolean handleUrlScheme(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (scheme == null) return false;

        // External protocols: WhatsApp, Telegram, Phone, Email
        if (scheme.equalsIgnoreCase("whatsapp") || scheme.equalsIgnoreCase("tg") ||
                scheme.equalsIgnoreCase("tel") || scheme.equalsIgnoreCase("mailto")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                Toast.makeText(this, "التطبيق المطلوب غير مثبت على الهاتف", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // External URLs: wa.me, t.me
        if (host != null && (host.contains("wa.me") || host.contains("t.me") || host.contains("telegram.me"))) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // Restrict navigation: Keep within our domain and student portal
        if (host != null && host.contains("art-faculty-app.vercel.app")) {
            return false; // Load in WebView
        }

        // Open unknown external domains in external Chrome/browser
        if (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
        }

        return false;
    }

    /**
     * Launches a native Android chooser allowing student to either capture a new photo with Camera
     * or select an existing photo from the Gallery.
     */
    private void launchPhotoChooserIntent() {
        Intent takePictureIntent = null;

        try {
            File photoFile = createImageFile();
            if (photoFile != null) {
                mCameraPhotoUri = FileProvider.getUriForFile(
                        this,
                        getApplicationContext().getPackageName() + ".fileprovider",
                        photoFile
                );
                takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, mCameraPhotoUri);
                takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            }
        } catch (Exception e) {
            mCameraPhotoUri = null;
        }

        Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
        contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
        contentSelectionIntent.setType("image/*");

        Intent[] intentArray;
        if (takePictureIntent != null) {
            intentArray = new Intent[]{takePictureIntent};
        } else {
            intentArray = new Intent[0];
        }

        Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
        chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
        chooserIntent.putExtra(Intent.EXTRA_TITLE, getString(R.string.choose_photo_title));
        chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

        fileChooserLauncher.launch(chooserIntent);
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "ART_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (storageDir == null) {
            storageDir = getCacheDir();
        }
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    /**
     * Complete, robust Android Back Navigation:
     * Supports Gesture Navigation (swiping from edges on Android 10-15),
     * Soft Navigation bar buttons, and Physical hardware back buttons.
     */
    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackPressAction();
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            handleBackPressAction();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void handleBackPressAction() {
        if (webView == null) {
            finish();
            return;
        }

        // 1. Evaluate web handler: closes any open modal, dialog, or switches back to home tab
        webView.evaluateJavascript(
            "(function() { " +
            "  try { " +
            "    if (typeof window.handleAndroidBack === 'function') { " +
            "      return window.handleAndroidBack() === true; " +
            "    } " +
            "    var closeBtn = document.querySelector('.close-modal, [data-modal-close], .preview-close'); " +
            "    if (closeBtn) { closeBtn.click(); return true; } " +
            "  } catch(e) {} " +
            "  return false; " +
            "})()",
            value -> {
                if ("true".equalsIgnoreCase(value)) {
                    // Handled inside the webapp (modal or tab closed smoothly)!
                    return;
                }

                // 2. Check if WebView has internal page history inside the portal
                if (webView.canGoBack()) {
                    WebBackForwardList list = webView.copyBackForwardList();
                    int cur = list.getCurrentIndex();
                    if (cur > 0) {
                        String prevUrl = list.getItemAtIndex(cur - 1).getUrl();
                        if (prevUrl != null && prevUrl.contains("art-faculty-app.vercel.app")) {
                            webView.goBack();
                            return;
                        }
                    }
                }

                // 3. At root screen: double-tap to exit
                long now = System.currentTimeMillis();
                if (now - backPressedTime < 2000) {
                    finish();
                } else {
                    backPressedTime = now;
                    Toast.makeText(MainActivity.this, R.string.exit_prompt, Toast.LENGTH_SHORT).show();
                }
            }
        );
    }

    private void checkPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }
}
