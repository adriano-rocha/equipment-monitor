package com.equipmentmonitor.android

import android.content.Context
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.net.Inet4Address
import java.net.NetworkInterface
import java.time.OffsetDateTime
import java.time.ZoneOffset

class DeviceInfoProvider(private val context: Context) {
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
