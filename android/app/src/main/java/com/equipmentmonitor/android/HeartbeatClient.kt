package com.equipmentmonitor.android

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

class HeartbeatClient {
    fun send(config: AppConfig, secretStore: SecureSecretStore, provider: DeviceInfoProvider): Result<Int> {
        val secret = secretStore.read()
            ?: return Result.failure(IllegalStateException("Device secret não configurado"))
        val baseUrl = config.backendUrl.trimEnd('/')
        if (baseUrl.isBlank()) return Result.failure(IllegalArgumentException("Backend URL não configurada"))

        val url = URL("$baseUrl/api/v1/heartbeats")
        val payload = JSONObject().apply {
            put("hostname", provider.hostname())
            provider.reportedIp()?.let { put("reported_ip", it) }
            provider.batteryLevel()?.let { put("battery_level", it) }
            put("metadata", JSONObject(provider.metadata()))
            put("device_timestamp", provider.deviceTimestamp())
        }.toString()

        return runCatching {
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "DeviceKey ${config.keyId}:$secret")
            }

            try {
                connection.outputStream.use { it.write(payload.toByteArray(StandardCharsets.UTF_8)) }
                val status = connection.responseCode
                if (status !in 200..299) {
                    throw HeartbeatHttpException(status)
                }
                status
            } finally {
                connection.disconnect()
            }
        }.onFailure { Log.w(TAG, "Falha no heartbeat: ${it.message}") }
    }

    class HeartbeatHttpException(val statusCode: Int) : Exception("HTTP $statusCode")

    private companion object {
        const val TAG = "EquipmentMonitor"
        const val CONNECT_TIMEOUT_MS = 8_000
        const val READ_TIMEOUT_MS = 8_000
    }
}
