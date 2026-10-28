-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep JavascriptInterface for WebView native bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WorkManager Worker classes
-keep class * extends androidx.work.Worker {
    <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep class * extends androidx.work.ListenableWorker {
    <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Keep ArtEdu student portal application classes
-keep class com.artedu.studentportal.** { *; }

# Keep AndroidX WebKit
-keep class androidx.webkit.** { *; }
