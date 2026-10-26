package com.equipmentmonitor.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Inicia o HeartbeatService automaticamente quando o aparelho é reiniciado,
 * desde que já tenha uma configuração salva.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        if (action == Intent.ACTION_BOOT_COMPLETED || action == "android.intent.action.QUICKBOOT_POWERON") {
            val config = AppConfig(context)
            val secretStore = SecureSecretStore(context)

            if (config.isConfigured() && !secretStore.read().isNullOrBlank()) {
                Log.i(TAG, "Aparelho reiniciado: iniciando HeartbeatService automaticamente.")
                val serviceIntent = Intent(context, HeartbeatService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } else {
                Log.w(TAG, "Aparelho reiniciado, mas o agente não está configurado.")
            }
        }
    }

    private companion object {
        const val TAG = "EquipmentMonitorBoot"
    }
}