package com.equipmentmonitor.android

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import android.app.Activity

class MainActivity : Activity() {
    private lateinit var config: AppConfig
    private lateinit var secretStore: SecureSecretStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        config = AppConfig(this)
        secretStore = SecureSecretStore(this)

        val backendUrl = findViewById<EditText>(R.id.backendUrlInput)
        val keyId = findViewById<EditText>(R.id.keyIdInput)
        val secret = findViewById<EditText>(R.id.secretInput)
        val status = findViewById<TextView>(R.id.statusText)

        backendUrl.setText(config.backendUrl)
        keyId.setText(config.keyId)

        findViewById<Button>(R.id.saveButton).setOnClickListener {
            val url = backendUrl.text.toString().trim()
            val id = keyId.text.toString().trim()
            val secretValue = secret.text.toString()

            if (url.isBlank() || id.isBlank() || secretValue.isBlank()) {
                Toast.makeText(this, "Preencha URL, key_id e secret.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            config.backendUrl = url
            config.keyId = id
            secretStore.save(secretValue)
            secret.text?.clear()
            status.text = "Status: configuração salva"
            Toast.makeText(this, "Configuração salva.", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.startButton).setOnClickListener {
            if (!config.isConfigured() || secretStore.read().isNullOrBlank()) {
                Toast.makeText(this, "Salve uma configuração válida primeiro.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val intent = Intent(this, HeartbeatService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            status.text = "Status: monitoramento iniciado"
        }

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            stopService(Intent(this, HeartbeatService::class.java))
            status.text = "Status: parado"
        }
    }
}
