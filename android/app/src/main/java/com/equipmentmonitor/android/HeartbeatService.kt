package com.equipmentmonitor.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import java.util.concurrent.Executors

class HeartbeatService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var config: AppConfig
    private lateinit var secretStore: SecureSecretStore
    private lateinit var provider: DeviceInfoProvider
    private val client = HeartbeatClient()

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            sendHeartbeat()
            handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        config = AppConfig(this)
        secretStore = SecureSecretStore(this)
        provider = DeviceInfoProvider(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!config.isConfigured() || secretStore.read().isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = buildNotification("Monitoramento ativo")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        handler.removeCallbacks(heartbeatRunnable)
        handler.post(heartbeatRunnable)
        return START_STICKY
    }

    private fun sendHeartbeat() {
        executor.execute {
            val result = client.send(config, secretStore, provider)
            result.onSuccess { status ->
                Log.i(TAG, "Heartbeat enviado: HTTP $status")
            }
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.channel_description)
            },
        )
    }

    private fun buildNotification(text: String): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .build()
        } else {
            Notification.Builder(this)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .build()
        }
    }

    private companion object {
        const val TAG = "EquipmentMonitor"
        const val CHANNEL_ID = "equipment_monitor_heartbeat"
        const val NOTIFICATION_ID = 7001
        const val HEARTBEAT_INTERVAL_MS = 30_000L
    }
}
