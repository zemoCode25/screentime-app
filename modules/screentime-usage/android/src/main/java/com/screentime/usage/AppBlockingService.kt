package com.screentime.usage

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import org.json.JSONObject

class AppBlockingService : AccessibilityService() {
    private lateinit var sharedPrefs: SharedPreferences
    private val blockedPackages = mutableSetOf<String>()
    private var lastBlockedPackage: String? = null
    private var lastBlockTime: Long = 0

    companion object {
        private const val TAG = "AppBlockingService"
        private const val PREFS_NAME = "app_blocking_prefs"
        private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
        private const val KEY_BLOCK_REASONS = "block_reasons"
        private const val BLOCK_DEBOUNCE_MS = 1000L // Prevent rapid re-blocking

        fun updateBlockedPackages(context: Context, packages: Set<String>) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putStringSet(KEY_BLOCKED_PACKAGES, packages).apply()
            Log.d(TAG, "Updated blocked packages: ${packages.size} apps")
        }

        fun updateBlockedPackagesWithReasons(context: Context, packages: List<Map<String, String>>) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // Extract package names as a set
            val packageSet = packages.mapNotNull { it["packageName"] }.toSet()

            // Create JSON object with package -> reason mapping
            val reasonsJson = JSONObject()
            for (pkg in packages) {
                val packageName = pkg["packageName"]
                val reason = pkg["reason"]
                if (packageName != null && reason != null) {
                    reasonsJson.put(packageName, reason)
                }
            }

            prefs.edit()
                .putStringSet(KEY_BLOCKED_PACKAGES, packageSet)
                .putString(KEY_BLOCK_REASONS, reasonsJson.toString())
                .apply()

            Log.d(TAG, "Updated blocked packages with reasons: ${packageSet.size} apps")
        }

        fun getBlockedPackages(context: Context): Set<String> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()
        }

        fun getBlockReason(context: Context, packageName: String): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val reasonsJsonStr = prefs.getString(KEY_BLOCK_REASONS, null) ?: return null

            return try {
                val reasonsJson = JSONObject(reasonsJsonStr)
                if (reasonsJson.has(packageName)) {
                    reasonsJson.getString(packageName)
                } else {
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse block reasons JSON", e)
                null
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        sharedPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadBlockedPackages()
        Log.d(TAG, "Accessibility service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return
        }

        val packageName = event.packageName?.toString() ?: return

        // Ignore our own app
        if (packageName == packageName) {
            return
        }

        // Reload blocked packages in case they changed
        loadBlockedPackages()

        // Check if package is blocked
        if (packageName in blockedPackages) {
            // Debounce: prevent showing blocking screen multiple times in quick succession
            val now = System.currentTimeMillis()
            if (packageName == lastBlockedPackage && (now - lastBlockTime) < BLOCK_DEBOUNCE_MS) {
                return
            }

            lastBlockedPackage = packageName
            lastBlockTime = now

            Log.d(TAG, "Blocking app: $packageName")
            showBlockingScreen(packageName)
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
    }

    private fun loadBlockedPackages() {
        val packages = sharedPrefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()
        blockedPackages.clear()
        blockedPackages.addAll(packages)
    }

    private fun showBlockingScreen(packageName: String) {
        val intent = Intent(this, BlockingActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("blocked_package", packageName)
        }
        startActivity(intent)
    }
}
