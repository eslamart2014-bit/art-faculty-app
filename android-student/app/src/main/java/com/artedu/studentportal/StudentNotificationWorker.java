package com.artedu.studentportal;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class StudentNotificationWorker extends Worker {

    public static final String CHANNEL_ID = "art_edu_student_alerts";
    public static final String CHANNEL_NAME = "تنبيهات بوابة الطلاب";
    public static final String PREFS_NAME = "ArtEduStudentPrefs";
    public static final String KEY_STUDENT_CODE = "saved_student_code";
    public static final String KEY_SHOWN_NOTIFS = "shown_notification_ids";

    private static final String NOTIF_API_ENDPOINT = "https://art-faculty-app.vercel.app/api/students/notifications";

    public StudentNotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();

        try {
            createNotificationChannel(context);

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String studentCode = prefs.getString(KEY_STUDENT_CODE, "");

            String requestUrl = NOTIF_API_ENDPOINT;
            if (studentCode != null && !studentCode.trim().isEmpty()) {
                requestUrl += "?code=" + studentCode.trim();
            }

            // Fetch notifications from server
            URL url = new URL(requestUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("User-Agent", "ArtEduStudentApp/1.0.2");

            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONObject data = new JSONObject(response.toString());
                if (data.has("notifications")) {
                    JSONArray notifs = data.getJSONArray("notifications");
                    Set<String> shownIds = new HashSet<>(prefs.getStringSet(KEY_SHOWN_NOTIFS, new HashSet<>()));

                    for (int i = 0; i < notifs.length(); i++) {
                        JSONObject item = notifs.getJSONObject(i);
                        String id = item.optString("id", "notif_" + System.currentTimeMillis() + "_" + i);
                        String title = item.optString("title", "تنبيه من بوابة التربية الفنية 🎓");
                        String message = item.optString("message", "");

                        if (!shownIds.contains(id) && !message.isEmpty()) {
                            showNotification(context, id.hashCode(), title, message);
                            shownIds.add(id);
                        }
                    }

                    // Save updated shown set
                    prefs.edit().putStringSet(KEY_SHOWN_NOTIFS, shownIds).apply();
                }
            }

            conn.disconnect();
            return Result.success();
        } catch (Exception e) {
            // Silently retry on next scheduled interval
            return Result.retry();
        }
    }

    @SuppressLint("MissingPermission")
    private void showNotification(Context context, int notificationId, String title, String message) {
        try {
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    notificationId,
                    intent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                            : PendingIntent.FLAG_UPDATE_CURRENT
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.app_icon)
                    .setLargeIcon(BitmapFactory.decodeResource(context.getResources(), R.drawable.app_icon))
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat manager = NotificationManagerCompat.from(context);
            manager.notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission might be denied on Android 13
        } catch (Exception ignored) {}
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("إشعارات بمواعيد تسليم المشاريع، رصد الدرجات، وتنبيهات الحضور والغياب");
            channel.enableVibration(true);
            channel.enableLights(true);

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
