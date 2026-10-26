package com.equipmentmonitor.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class HeartbeatService : Service() {
    private var scheduler: ScheduledExecutorService? = null
    private lateinit var config: AppConfig
    private lateinit var secretStore: SecureSecretStore
    private lateinit var provider: DeviceInfoProvider
    private val client = HeartbeatClient()

    companion object {
        const val TAG = "EquipmentMonitor"
        const val CHANNEL_ID = "equipment_monitor_heartbeat"
        const val NOTIFICATION_ID = 7001
        const val HEARTBEAT_INTERVAL_SECONDS = 30L

        @Volatile
        var isRunning: Boolean = false
            private set
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

        isRunning = true

        if (scheduler == null || scheduler?.isShutdown == true) {
            scheduler = Executors.newSingleThreadScheduledExecutor()
            scheduler?.scheduleWithFixedDelay(
                { sendHeartbeat() },
                0,
                HEARTBEAT_INTERVAL_SECONDS,
                TimeUnit.SECONDS,
            )
        }

        return START_STICKY
    }

    private fun sendHeartbeat() {
        try {
            val result = client.send(config, secretStore, provider)
            result.onSuccess { status ->
                Log.i(TAG, "Heartbeat enviado com sucesso: HTTP $status")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro inesperado ao disparar heartbeat: ${e.message}")
        }
    }

    override fun onDestroy() {
        isRunning = false
        scheduler?.shutdownNow()
        scheduler = null
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
                .setSmallIcon(R.drawable.asaph_track)
                .setOngoing(true)
                .build()
        } else {
            Notification.Builder(this)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(text)
                .setSmallIcon(R.drawable.asaph_track)
                .setOngoing(true)
                .build()
        }
    }
}