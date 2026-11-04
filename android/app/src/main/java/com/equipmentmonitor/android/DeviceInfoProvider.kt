package com.equipmentmonitor.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.net.Inet4Address
import java.net.NetworkInterface
import java.time.OffsetDateTime
import java.time.ZoneOffset

data class GpsData(
    val latitude: Double,
    val longitude: Double,
    val speedKmh: Double?
)

class DeviceInfoProvider(private val context: Context) {
    // Guarda a coordenada mais recente recebida pelo listener do serviço
    @Volatile
    var cachedRealLocation: Location? = null

    fun hostname(): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val suffix = androidId?.takeLast(8)?.ifBlank { "unknown" } ?: "unknown"
        return "android-$suffix"
    }

    fun reportedIp(): String? {
        return runCatching {
            NetworkInterface.getNetworkInterfaces().toList()
                .flatMap { it.inetAddresses.toList() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress && !it.isLinkLocalAddress }
                ?.hostAddress
        }.getOrNull()
    }

    fun batteryLevel(): Int? {
        val batteryManager = context.getSystemService(BatteryManager::class.java) ?: return null
        val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return level.takeIf { it in 0..100 }
    }

    // Leitura universal para qualquer fabricante (Samsung, Motorola, Xiaomi...)
    fun lastLocation(): GpsData? {
        val hasFine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) return null

        // 1. Se o serviço já capturou uma coordenada ao vivo, usa ela com prioridade
        var bestLocation = cachedRealLocation

        // 2. Se ainda não capturou, busca nos provedores do hardware
        if (bestLocation == null) {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            if (locationManager != null) {
                val providers = listOf(
                    LocationManager.GPS_PROVIDER,
                    LocationManager.NETWORK_PROVIDER,
                    LocationManager.PASSIVE_PROVIDER
                )

                for (provider in providers) {
                    try {
                        if (!locationManager.isProviderEnabled(provider)) continue
                        val loc = locationManager.getLastKnownLocation(provider) ?: continue
                        if (bestLocation == null || loc.time > bestLocation.time) {
                            bestLocation = loc
                        }
                    } catch (_: SecurityException) {
                    }
                }
            }
        }

        return bestLocation?.let {
            val speed = if (it.hasSpeed() && it.speed > 0) {
                it.speed * 3.6
            } else null

            GpsData(
                latitude = it.latitude,
                longitude = it.longitude,
                speedKmh = speed
            )
        }
    }

    fun deviceTimestamp(): String = OffsetDateTime.now(ZoneOffset.UTC).toString()

    fun metadata(): Map<String, Any?> = mapOf(
        "platform" to "android",
        "android_version" to Build.VERSION.RELEASE,
        "sdk_int" to Build.VERSION.SDK_INT,
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "app_version" to BuildConfig.VERSION_NAME,
    )
}