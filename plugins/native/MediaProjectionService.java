package com.oney.WebRTCModule;

import android.app.Notification;
import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Foreground service for MediaProjection.
 * Waits until startForeground completed so createScreenStream does not race (Android 14+ crash).
 */
public class MediaProjectionService extends Service {
    private static final String TAG = MediaProjectionService.class.getSimpleName();

    static final int NOTIFICATION_ID = 77123;

    private static final AtomicBoolean started = new AtomicBoolean(false);
    private static final Object lock = new Object();
    private static CountDownLatch readyLatch = new CountDownLatch(0);

    public static void launch(Context context) {
        if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {
            return;
        }

        MediaProjectionNotification.createNotificationChannel(context);
        Intent intent = new Intent(context, MediaProjectionService.class);

        synchronized (lock) {
            if (!started.get()) {
                readyLatch = new CountDownLatch(1);
            }
        }

        ComponentName componentName;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                componentName = context.startForegroundService(intent);
            } else {
                componentName = context.startService(intent);
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "Media projection service not started", e);
            readyLatch.countDown();
            return;
        }

        if (componentName == null) {
            Log.w(TAG, "Media projection service not started");
            readyLatch.countDown();
            return;
        }

        try {
            // Avoid race: MediaProjection must start after FGS is foregrounded.
            boolean ok = readyLatch.await(2, TimeUnit.SECONDS);
            if (!ok) {
                Log.w(TAG, "Timed out waiting for MediaProjection FGS");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        Log.i(TAG, "Media projection service started");
    }

    public static void abort(Context context) {
        if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {
            return;
        }

        Intent intent = new Intent(context, MediaProjectionService.class);
        context.stopService(intent);
        started.set(false);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = MediaProjectionNotification.buildMediaProjectionNotification(this);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            started.set(true);
        } catch (RuntimeException e) {
            Log.e(TAG, "startForeground failed", e);
            stopSelf();
            readyLatch.countDown();
            return START_NOT_STICKY;
        }

        readyLatch.countDown();
        // Sticky: survive brief process pressure while host switches apps (Meet-like).
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        started.set(false);
        super.onDestroy();
    }
}
