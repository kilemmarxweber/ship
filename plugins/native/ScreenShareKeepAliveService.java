package com.oney.WebRTCModule;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Keeps the RN process alive while the MediaProjection system picker is open.
 * Without this, Android often kills ShipShop before onActivityResult (share crash).
 * Type: camera|microphone|mediaPlayback (valid during live publish).
 */
public class ScreenShareKeepAliveService extends Service {
    private static final String TAG = ScreenShareKeepAliveService.class.getSimpleName();
    private static final String CHANNEL_ID = "ShipShopLiveKeepAlive";
    private static final int NOTIFICATION_ID = 77124;

    public static void launch(Context context) {
        createChannel(context);
        Intent intent = new Intent(context, ScreenShareKeepAliveService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            Log.i(TAG, "keep-alive started");
        } catch (RuntimeException e) {
            Log.w(TAG, "keep-alive not started", e);
        }
    }

    public static void abort(Context context) {
        try {
            context.stopService(new Intent(context, ScreenShareKeepAliveService.class));
        } catch (RuntimeException e) {
            Log.w(TAG, "keep-alive stop failed", e);
        }
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm =
                (NotificationManager) context.getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel =
                new NotificationChannel(
                        CHANNEL_ID, "Live ShipShop", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Maintient la diffusion écran hors de l’app");
        channel.enableVibration(false);
        channel.setShowBadge(false);
        channel.setLightColor(0xFFDC2626);
        nm.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        int icon =
                getResources()
                        .getIdentifier("ic_notification", "drawable", getPackageName());
        if (icon == 0) icon = getApplicationInfo().icon;
        if (icon == 0) icon = android.R.drawable.ic_menu_camera;

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) {
            launch = new Intent(Intent.ACTION_VIEW, Uri.parse("shipshop://live/current-share"));
            launch.setPackage(getPackageName());
        }
        launch.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        launch.setData(Uri.parse("shipshop://live/current-share"));

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent content =
                PendingIntent.getActivity(this, 7702, launch, pendingFlags);

        Notification notification =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setContentTitle("Vous diffusez votre écran")
                        .setContentText("Bandeau rouge actif — viewers en direct")
                        .setSmallIcon(icon)
                        .setColor(0xFFDC2626)
                        .setColorized(true)
                        .setOngoing(true)
                        .setOnlyAlertOnce(true)
                        .setContentIntent(content)
                        .setCategory(NotificationCompat.CATEGORY_SERVICE)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setForegroundServiceBehavior(
                                NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                        .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
                if (Build.VERSION.SDK_INT >= 30) {
                    type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                }
                if (Build.VERSION.SDK_INT >= 34) {
                    type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
                }
                startForeground(NOTIFICATION_ID, notification, type);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException e) {
            Log.e(TAG, "startForeground failed", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }
}
