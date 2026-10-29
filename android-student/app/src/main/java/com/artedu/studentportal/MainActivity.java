package com.artedu.studentportal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebBackForwardList;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private static final String TARGET_URL = "https://art-faculty-app.vercel.app/system";
    private static final String APK_VERSION_ENDPOINT = "https://art-faculty-app.vercel.app/api/public/apk-version";

    private WebView webView;
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
                            results = new Uri[]{data.getData()};
                        } else if (data != null && data.getClipData() != null) {
                            int count = data.getClipData().getItemCount();
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (mCameraPhotoUri != null) {
                            results = new Uri[]{mCameraPhotoUri};
                        }
                    }
                    mFilePathCallback.onReceiveValue(results);
                    mFilePathCallback = null;
                }
            });

    // Multiple permission launcher (Camera & Notifications)
    private final ActivityResultLauncher<String[]> permissionsLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean cameraGranted = result.get(Manifest.permission.CAMERA);
                if (cameraGranted != null && !cameraGranted) {
                    Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_SHORT).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 1. Create Notification Channel & Schedule Background Worker (Runs even when closed!)
        StudentNotificationWorker.createNotificationChannel(this);
        scheduleBackgroundNotificationWorker();

        initViews();
        setupWebView();
        setupBackNavigation();
        checkAndRequestPermissions();
        checkBatteryOptimization();
        fetchFcmToken();

        // 2. Check for APK updates from server
        checkAppUpdates();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(TARGET_URL);
        }
    }

    private void fetchFcmToken() {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                    .addOnSuccessListener(token -> {
                        if (token != null && !token.isEmpty()) {
                            getSharedPreferences(StudentNotificationWorker.PREFS_NAME, MODE_PRIVATE)
                                    .edit().putString(StudentFcmService.KEY_FCM_TOKEN, token).apply();
                        }
                    });
        } catch (Exception ignored) {}
    }

    @SuppressLint("BatteryLife")
    private void checkBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    SharedPreferences prefs = getSharedPreferences(StudentNotificationWorker.PREFS_NAME, MODE_PRIVATE);
                    boolean alreadyPrompted = prefs.getBoolean("battery_prompted", false);
                    if (!alreadyPrompted) {
                        prefs.edit().putBoolean("battery_prompted", true).apply();
                        new AlertDialog.Builder(this)
                                .setTitle("تفعيل الإشعارات الفورية 🔔")
                                .setMessage("لضمان وصول إشعارات المشاريع، الحضور، واعتماد الدواليب حتى والتطبيق مغلق، يرجى استثناء التطبيق من قيود توفير شحن البطارية.")
                                .setPositiveButton("تفعيل الآن", (dialog, which) -> {
                                    try {
                                        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                                        intent.setData(Uri.parse("package:" + getPackageName()));
                                        startActivity(intent);
                                    } catch (Exception e) {
                                        try {
                                            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                                            startActivity(fallback);
                                        } catch (Exception ignored) {}
                                    }
                                })
                                .setNegativeButton("لاحقاً", (dialog, which) -> dialog.dismiss())
                                .show();
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
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

        // Hardware acceleration & seamless background
        webView.setBackgroundColor(0xFF0F172A);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Enable smooth scrolling and scrollbars without accidental browser refresh
        webView.setVerticalScrollBarEnabled(true);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setNestedScrollingEnabled(true);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        // 3. Media & Audio/Video
        settings.setMediaPlaybackRequiresUserGesture(false);

        // 4. Custom User-Agent tag
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " ArtEduStudentApp/1.0.4 (Android; Mobile)");

        // 5. Native Offline-First Caching Strategy
        if (!isNetworkAvailable()) {
            settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        } else {
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        }

        // 6. Cookies
        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        // 7. Native Bridge for Webapp interaction (Session sync & Immediate notification check)
        webView.addJavascriptInterface(new NativeBridge(), "ArtEduNativeBridge");

        // WebChromeClient (File upload, Camera permission - No browser progress bar!)
        webView.setWebChromeClient(new WebChromeClient() {
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

        // WebViewClient (Local-First Asset Interception, Offline Fallback)
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
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                WebResourceResponse cachedStatic = handleResourceCaching(uri);
                if (cachedStatic != null) {
                    return cachedStatic;
                }
                WebResourceResponse cachedHtml = handleHtmlCaching(uri);
                if (cachedHtml != null) {
                    return cachedHtml;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                offlineLayout.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Page ready - seamless native render
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String currentUrl = view.getUrl();
                    if (currentUrl == null || currentUrl.isEmpty() || currentUrl.equals("about:blank")) {
                        webView.setVisibility(View.GONE);
                        offlineLayout.setVisibility(View.VISIBLE);
                    } else {
                        Toast.makeText(MainActivity.this, "أنت تعمل حالياً في وضع عدم الاتصال", Toast.LENGTH_SHORT).show();
                    }
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
     * JavaScript Interface Bridge:
     * Called by src/app/system/page.tsx when student logs in or logs out
     */
    public class NativeBridge {
        @JavascriptInterface
        public void saveStudentSession(String studentCode, String studentName) {
            saveStudentSession(studentCode, studentName, "");
        }

        @JavascriptInterface
        public void saveStudentSession(String studentCode, String studentName, String sessionToken) {
            if (studentCode != null && !studentCode.trim().isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(StudentNotificationWorker.PREFS_NAME, MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit()
                        .putString(StudentNotificationWorker.KEY_STUDENT_CODE, studentCode.trim())
                        .putString(StudentNotificationWorker.KEY_STUDENT_NAME, studentName != null ? studentName.trim() : "");
                if (sessionToken != null && !sessionToken.trim().isEmpty()) {
                    editor.putString(StudentNotificationWorker.KEY_STUDENT_TOKEN, sessionToken.trim());
                }
                editor.apply();

                // Flush cookies to persistent disk storage
                try {
                    CookieManager.getInstance().flush();
                } catch (Exception ignored) {}

                // Instantly trigger an initial background notification check
                OneTimeWorkRequest checkRequest = new OneTimeWorkRequest.Builder(StudentNotificationWorker.class).build();
                WorkManager.getInstance(MainActivity.this).enqueue(checkRequest);
            }
        }

        @JavascriptInterface
        public String getPushToken() {
            return getSharedPreferences(StudentNotificationWorker.PREFS_NAME, MODE_PRIVATE)
                    .getString(StudentFcmService.KEY_FCM_TOKEN, "");
        }

        @JavascriptInterface
        public void clearStudentSession() {
            SharedPreferences prefs = getSharedPreferences(StudentNotificationWorker.PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                    .remove(StudentNotificationWorker.KEY_STUDENT_CODE)
                    .remove(StudentNotificationWorker.KEY_STUDENT_NAME)
                    .remove(StudentNotificationWorker.KEY_STUDENT_TOKEN)
                    .apply();

            try {
                CookieManager.getInstance().flush();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            try {
                String cleanBase64 = base64Data;
                if (cleanBase64 != null && cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                if (cleanBase64 == null || cleanBase64.trim().isEmpty()) return;
                byte[] pdfBytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT);
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                String safeName = (filename != null && !filename.isEmpty()) ? filename : "استمارة_دولاب.pdf";
                File destFile = new File(downloadsDir, safeName);
                FileOutputStream fos = new FileOutputStream(destFile);
                fos.write(pdfBytes);
                fos.flush();
                fos.close();

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.addCompletedDownload(
                            safeName,
                            "استمارة تسجيل الدولاب الرسمية",
                            true,
                            (mimeType != null && !mimeType.isEmpty()) ? mimeType : "application/pdf",
                            destFile.getAbsolutePath(),
                            destFile.length(),
                            true
                    );
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تم تنزيل الاستمارة في مجلد التحميلات: " + safeName, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "تعذر حفظ الملف محلياً", Toast.LENGTH_SHORT).show());
            }
        }
    }

    /**
     * Schedules WorkManager to run periodic notification checks every 15 minutes,
     * EVEN WHEN THE APPLICATION IS COMPLETELY CLOSED OR SWIPED AWAY.
     */
    private void scheduleBackgroundNotificationWorker() {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest periodicRequest = new PeriodicWorkRequest.Builder(
                StudentNotificationWorker.class,
                15, TimeUnit.MINUTES
        ).setConstraints(constraints).build();

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "art_edu_student_periodic_sync",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicRequest
        );
    }

    /**
     * In-App Auto-Updater:
     * Checks server for new APK version. Prompts student with changelog and downloads/installs APK directly.
     */
    private void checkAppUpdates() {
        new Thread(() -> {
            try {
                URL url = new URL(APK_VERSION_ENDPOINT);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject json = new JSONObject(sb.toString());
                    int remoteVersionCode = json.optInt("versionCode", 0);
                    String remoteVersionName = json.optString("versionName", "1.0.0");
                    String downloadUrl = json.optString("downloadUrl", "");
                    String changelog = json.optString("changelog", "تحسينات جديدة في الأداء وسرعة التطبيق.");
                    boolean forceUpdate = json.optBoolean("forceUpdate", false);

                    int currentVersionCode = BuildConfig.VERSION_CODE;

                    if (remoteVersionCode > currentVersionCode && !downloadUrl.isEmpty()) {
                        runOnUiThread(() -> promptUpdateDialog(remoteVersionName, changelog, downloadUrl, forceUpdate));
                    }
                }
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    private void promptUpdateDialog(String versionName, String changelog, String downloadUrl, boolean forceUpdate) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(getString(R.string.update_available_title) + " (v" + versionName + ")");
        builder.setMessage(changelog + "\n\nهل ترغب في التحديث الآن للاستفادة من أحدث الميزات؟");
        builder.setCancelable(!forceUpdate);

        builder.setPositiveButton(R.string.btn_update_now, (dialog, which) -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(this, "تعذر فتح رابط التحديث", Toast.LENGTH_SHORT).show();
            }
        });

        if (!forceUpdate) {
            builder.setNegativeButton(R.string.btn_later, (dialog, which) -> dialog.dismiss());
        }

        builder.show();
    }

    private boolean handleUrlScheme(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (scheme == null) return false;

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

        if (host != null && (host.contains("wa.me") || host.contains("t.me") || host.contains("telegram.me"))) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        if (host != null && host.contains("art-faculty-app.vercel.app")) {
            return false;
        }

        if (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
        }

        return false;
    }

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
                    return;
                }

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

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            boolean hasNotif = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;

            if (!hasCamera || !hasNotif) {
                permissionsLauncher.launch(new String[]{
                        Manifest.permission.CAMERA,
                        Manifest.permission.POST_NOTIFICATIONS
                });
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                permissionsLauncher.launch(new String[]{Manifest.permission.CAMERA});
            }
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    /**
     * Local Offline-First Asset Interceptor:
     * Caches static JS chunks, CSS, fonts, and images in app private storage.
     * Serves directly from flash memory with zero network delay and zero data usage.
     */
    private WebResourceResponse handleResourceCaching(Uri uri) {
        if (uri == null) return null;
        String url = uri.toString();

        if (!url.contains("/_next/static/") && !url.contains("/api/media/") &&
                !url.endsWith(".woff2") && !url.endsWith(".ttf") && !url.endsWith(".svg") &&
                !url.endsWith(".png") && !url.endsWith(".jpg") && !url.endsWith(".jpeg") &&
                !url.endsWith(".css") && !url.endsWith(".js")) {
            return null;
        }

        try {
            File cacheDir = new File(getCacheDir(), "web_assets_cache");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }

            String filename = Integer.toHexString(url.hashCode()) + getExtension(url);
            File localFile = new File(cacheDir, filename);

            if (localFile.exists() && localFile.length() > 0) {
                String mimeType = getMimeTypeFromUrl(url);
                return new WebResourceResponse(mimeType, "UTF-8", new FileInputStream(localFile));
            }

            // Fetch from network and save to local disk cache
            if (isNetworkAvailable()) {
                URL netUrl = new URL(url);
                HttpURLConnection connection = (HttpURLConnection) netUrl.openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("User-Agent", "ArtEduStudentApp/1.0.4 (Android; Mobile)");

                if (connection.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    InputStream in = connection.getInputStream();
                    FileOutputStream out = new FileOutputStream(localFile);
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    out.close();
                    in.close();

                    String mimeType = connection.getContentType();
                    if (mimeType == null || mimeType.isEmpty()) {
                        mimeType = getMimeTypeFromUrl(url);
                    } else if (mimeType.contains(";")) {
                        mimeType = mimeType.split(";")[0].trim();
                    }
                    return new WebResourceResponse(mimeType, "UTF-8", new FileInputStream(localFile));
                }
            }
        } catch (Exception ignored) {}

        return null;
    }

    /**
     * Caches the main /system HTML so the portal UI opens immediately (0ms)
     * even when there is no internet connection or weak signal.
     */
    private WebResourceResponse handleHtmlCaching(Uri uri) {
        if (uri == null) return null;
        String url = uri.toString();
        if (!url.contains("art-faculty-app.vercel.app/system")) {
            return null;
        }

        File cacheDir = new File(getFilesDir(), "html_cache");
        if (!cacheDir.exists()) cacheDir.mkdirs();
        File htmlFile = new File(cacheDir, "system_portal.html");

        boolean isConnected = isNetworkAvailable();

        // If offline and cached version exists, serve it instantly
        if (!isConnected && htmlFile.exists() && htmlFile.length() > 0) {
            try {
                return new WebResourceResponse("text/html", "UTF-8", new FileInputStream(htmlFile));
            } catch (Exception ignored) {}
        }

        // If online, update local copy in background for instant startup next time
        if (isConnected) {
            new Thread(() -> {
                try {
                    URL netUrl = new URL(url);
                    HttpURLConnection conn = (HttpURLConnection) netUrl.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(10000);
                    conn.setRequestProperty("User-Agent", "ArtEduStudentApp/1.0.4 (Android; Mobile)");
                    if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        InputStream in = conn.getInputStream();
                        FileOutputStream out = new FileOutputStream(htmlFile);
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            out.write(buffer, 0, read);
                        }
                        out.close();
                        in.close();
                    }
                    conn.disconnect();
                } catch (Exception ignored) {}
            }).start();
        }

        return null;
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                NetworkInfo info = cm.getActiveNetworkInfo();
                return info != null && info.isConnected();
            }
        } catch (Exception ignored) {}
        return false;
    }

    private String getMimeTypeFromUrl(String url) {
        if (url.endsWith(".js")) return "application/javascript";
        if (url.endsWith(".css")) return "text/css";
        if (url.endsWith(".png")) return "image/png";
        if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
        if (url.endsWith(".svg")) return "image/svg+xml";
        if (url.endsWith(".woff2")) return "font/woff2";
        if (url.endsWith(".woff")) return "font/woff";
        if (url.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private String getExtension(String url) {
        int dot = url.lastIndexOf('.');
        int q = url.indexOf('?');
        if (dot != -1) {
            if (q != -1 && q > dot) {
                return url.substring(dot, q);
            } else if (q == -1) {
                return url.substring(dot);
            }
        }
        return ".bin";
    }
}
