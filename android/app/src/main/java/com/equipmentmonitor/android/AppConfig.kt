package com.equipmentmonitor.android

import android.content.Context
import android.content.SharedPreferences

/** Persistência da configuração do agente. O secret é armazenado pelo SecureSecretStore. */
class AppConfig(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("equipment_monitor_config", Context.MODE_PRIVATE)

    var backendUrl: String
        get() = prefs.getString(KEY_BACKEND_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_BACKEND_URL, value.trim()).apply()

    var keyId: String
        get() = prefs.getString(KEY_KEY_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_KEY_ID, value.trim()).apply()

    fun isConfigured(): Boolean = backendUrl.isNotBlank() && keyId.isNotBlank()

    private companion object {
        const val KEY_BACKEND_URL = "backend_url"
        const val KEY_KEY_ID = "key_id"
    }
}
