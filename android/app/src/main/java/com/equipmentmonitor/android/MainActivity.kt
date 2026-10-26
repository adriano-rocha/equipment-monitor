package com.equipmentmonitor.android

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var config: AppConfig
    private lateinit var secretStore: SecureSecretStore
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        config = AppConfig(this)
        secretStore = SecureSecretStore(this)

        val backendUrl = findViewById<EditText>(R.id.backendUrlInput)
        val keyId = findViewById<EditText>(R.id.keyIdInput)
        val secret = findViewById<EditText>(R.id.secretInput)
        statusText = findViewById(R.id.statusText)

        backendUrl.setText(config.backendUrl)
        keyId.setText(config.keyId)

        requestNotificationPermission()

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
            updateStatusDisplay("Configuração salva")
            Toast.makeText(this, "Configuração salva com sucesso.", Toast.LENGTH_SHORT).show()
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
            updateStatusDisplay("Monitoramento ativo")
        }

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            stopService(Intent(this, HeartbeatService::class.java))
            updateStatusDisplay("Parado")
        }
    }

    override fun onResume() {
        super.onResume()
        updateStatusOnResume()
    }

    private fun updateStatusOnResume() {
        if (HeartbeatService.isRunning) {
            updateStatusDisplay("Monitoramento ativo")
        } else if (config.isConfigured() && !secretStore.read().isNullOrBlank()) {
            updateStatusDisplay("Configurado (Parado)")
        } else {
            updateStatusDisplay("Aguardando configuração")
        }
    }

    private fun updateStatusDisplay(status: String) {
        statusText.text = "Status: $status"
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }
}