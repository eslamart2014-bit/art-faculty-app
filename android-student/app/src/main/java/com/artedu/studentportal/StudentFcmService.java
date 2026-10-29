package com.artedu.studentportal;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Receives FCM data messages from the server. Works even when the app is closed/swiped away,
 * because Android itself wakes this service for high-priority messages.
 */
public class StudentFcmService extends FirebaseMessagingService {

    public static final String KEY_FCM_TOKEN = "fcm_token";

    @Override
    public void onNewToken(@NonNull String token) {
        getSharedPreferences(StudentNotificationWorker.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_FCM_TOKEN, token).apply();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        String title = data.get("title");
        String body = data.get("body");
        if (title == null && message.getNotification() != null) {
            title = message.getNotification().getTitle();
            body = message.getNotification().getBody();
        }
        if (body == null || body.isEmpty()) return;
        if (title == null || title.isEmpty()) title = "بوابة التربية الفنية 🎓";

        String id = data.get("id");
        int notificationId = (id != null ? id : String.valueOf(System.currentTimeMillis())).hashCode();

        // Mark as shown so the polling worker does not duplicate it.
        if (id != null) {
            SharedPreferences prefs = getSharedPreferences(StudentNotificationWorker.PREFS_NAME, Context.MODE_PRIVATE);
            java.util.Set<String> shown = new java.util.HashSet<>(
                    prefs.getStringSet(StudentNotificationWorker.KEY_SHOWN_NOTIFS, new java.util.HashSet<>()));
            shown.add(id);
            prefs.edit().putStringSet(StudentNotificationWorker.KEY_SHOWN_NOTIFS, shown).apply();
        }

        StudentNotificationWorker.createNotificationChannel(this);

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, StudentNotificationWorker.CHANNEL_ID)
                .setSmallIcon(R.drawable.app_icon)
                .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.drawable.app_icon))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL);
        try {
            NotificationManagerCompat.from(this).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
        }
    }
}
