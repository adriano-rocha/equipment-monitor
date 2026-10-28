package com.equipmentmonitor.android

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject

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

        // --- CLIQUE NO BOTÃO DE ESCANEAR QR CODE ---
        findViewById<Button>(R.id.scanButton).setOnClickListener {
            val options = GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .enableAutoZoom()
                .build()

            val scanner = GmsBarcodeScanning.getClient(this, options)

            scanner.startScan()
                .addOnSuccessListener { barcode ->
                    val rawValue = barcode.rawValue ?: return@addOnSuccessListener
                    try {
                        // 1. Tenta ler se o QR Code estiver em formato JSON
                        if (rawValue.trim().startsWith("{")) {
                            val json = JSONObject(rawValue)
                            val url = json.optString("server_url", json.optString("url", ""))
                            val key = json.optString("key_id", json.optString("key", ""))
                            val sec = json.optString("secret", "")

                            if (url.isNotBlank()) backendUrl.setText(url)
                            if (key.isNotBlank()) keyId.setText(key)
                            if (sec.isNotBlank()) secret.setText(sec)
                        }
                        // 2. Tenta ler se o QR Code for link URI (asaph:// ou http)
                        else if (rawValue.contains("://")) {
                            val uri = Uri.parse(rawValue)
                            val url = uri.getQueryParameter("url")
                            val key = uri.getQueryParameter("key")
                            val sec = uri.getQueryParameter("secret")

                            if (!url.isNullOrBlank()) backendUrl.setText(url)
                            if (!key.isNullOrBlank()) keyId.setText(key)
                            if (!sec.isNullOrBlank()) secret.setText(sec)
                        }

                        Toast.makeText(this, "Campos preenchidos pelo QR Code!", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(this, "Erro ao processar dados do QR Code.", Toast.LENGTH_SHORT).show()
                    }
                }
                .addOnFailureListener {
                    Toast.makeText(this, "Leitura cancelada ou não reconhecida.", Toast.LENGTH_SHORT).show()
                }
        }

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

        // --- BOTÃO PARAR PROTEGIDO POR PIN DO COORDENADOR ---
        findViewById<Button>(R.id.stopButton).setOnClickListener {
            showCoordinatorPinDialog()
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

    /**
     * Exibe o diálogo protegido por PIN para impedir desligamento indevido ou acidental em campo.
     */
    private fun showCoordinatorPinDialog() {
        val pinInput = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "PIN de 4 dígitos"
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }

        val container = FrameLayout(this).apply {
            val paddingH = (24 * resources.displayMetrics.density).toInt()
            val paddingV = (8 * resources.displayMetrics.density).toInt()
            setPadding(paddingH, paddingV, paddingH, 0)
            addView(pinInput)
        }

        AlertDialog.Builder(this)
            .setTitle("🔒 Acesso do Coordenador")
            .setMessage("Digite o PIN para interromper o monitoramento:")
            .setView(container)
            .setPositiveButton("Confirmar") { dialog, _ ->
                val enteredPin = pinInput.text.toString().trim()
                if (enteredPin == COORDINATOR_PIN) {
                    stopService(Intent(this, HeartbeatService::class.java))
                    updateStatusDisplay("Parado")
                    Toast.makeText(this, "Monitoramento interrompido.", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "PIN incorreto. Monitoramento permanece ativo.", Toast.LENGTH_LONG).show()
                }
                dialog.dismiss()
            }
            .setNegativeButton("Cancelar") { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }

    companion object {
        private const val COORDINATOR_PIN = "3011"
    }
}