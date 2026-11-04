package com.equipmentmonitor.android

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class HeartbeatService : Service(), LocationListener {
    private var scheduler: ScheduledExecutorService? = null
    private lateinit var config: AppConfig
    private lateinit var secretStore: SecureSecretStore
    private lateinit var provider: DeviceInfoProvider
    private val client = HeartbeatClient()
    private var locationManager: LocationManager? = null

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
        locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        createNotificationChannel()
        startActiveLocationUpdates()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!config.isConfigured() || secretStore.read().isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = buildNotification("Monitoramento ativo")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Compatível com Android 14+ em qualquer fabricante
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            }
            startForeground(NOTIFICATION_ID, notification, type)
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

    // Mantém a antena de GPS ativa mesmo em segundo plano
    private fun startActiveLocationUpdates() {
        val hasPermission = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission || locationManager == null) return

        try {
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    15000L, // 15 segundos
                    5f,     // 5 metros
                    this
                )
            }
            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    15000L,
                    5f,
                    this
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao iniciar updates de GPS: ${e.message}")
        }
    }

    override fun onLocationChanged(location: Location) {
        // Alimenta a coordenada mais recente no provider
        provider.cachedRealLocation = location
        Log.i(TAG, "GPS Atualizado: Lat ${location.latitude}, Lng ${location.longitude}")
    }

    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

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
        try {
            locationManager?.removeUpdates(this)
        } catch (_: Exception) {}
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