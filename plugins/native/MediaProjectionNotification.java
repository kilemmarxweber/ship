package com.oney.WebRTCModule;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Meet / WhatsApp style sticky notification while screen sharing:
 * - keeps FGS valid (required icon)
 * - tap → return to ShipShop live
 */
class MediaProjectionNotification {
    private static final String TAG = MediaProjectionNotification.class.getSimpleName();

    static final String ONGOING_CONFERENCE_CHANNEL_ID = "OngoingConferenceChannel";

    static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        if (context == null) {
            Log.d(TAG, " Cannot create notification channel: no current context");
            return;
        }

        NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Service.NOTIFICATION_SERVICE);

        NotificationChannel channel =
                notificationManager.getNotificationChannel(ONGOING_CONFERENCE_CHANNEL_ID);

        if (channel != null) {
            return;
        }

        channel = new NotificationChannel(
                ONGOING_CONFERENCE_CHANNEL_ID,
                "Partage d’écran ShipShop",
                NotificationManager.IMPORTANCE_LOW);
        channel.enableLights(false);
        channel.enableVibration(false);
        channel.setShowBadge(false);
        channel.setDescription("Reste connecté au live pendant le partage d’écran");

        notificationManager.createNotificationChannel(channel);
    }

    static Notification buildMediaProjectionNotification(Context context) {
        int icon = context.getResources()
                .getIdentifier("ic_notification", "drawable", context.getPackageName());
        if (icon == 0) {
            icon = context.getApplicationInfo().icon;
        }
        if (icon == 0) {
            icon = android.R.drawable.ic_menu_share;
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) {
            launch = new Intent(Intent.ACTION_VIEW, Uri.parse("shipshop://live"));
            launch.setPackage(context.getPackageName());
        }
        launch.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // Prefer restoring the current live route when possible.
        launch.setData(Uri.parse("shipshop://live/current-share"));

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent contentIntent =
                PendingIntent.getActivity(context, 7701, launch, pendingFlags);

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, ONGOING_CONFERENCE_CHANNEL_ID);

        builder.setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentTitle("Vous partagez votre écran")
                .setContentText("Touchez pour revenir au live ShipShop")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(
                                "Partage d’écran en cours. Touchez cette notif pour revenir au live et arrêter le partage."))
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setUsesChronometer(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSmallIcon(icon)
                .setContentIntent(contentIntent)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);

        return builder.build();
    }
}
