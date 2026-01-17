package com.screentime.usage

import android.accessibilityservice.AccessibilityService
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AppBlockingService : AccessibilityService() {
    private lateinit var sharedPrefs: SharedPreferences
    private val blockedPackages = mutableSetOf<String>()
    private var lastBlockedPackage: String? = null
    private var lastBlockTime: Long = 0

    // Handler for scheduling delayed blocks
    private val handler = Handler(Looper.getMainLooper())
    private var pendingBlockRunnable: Runnable? = null
    private var pendingBlockPackage: String? = null
    private var currentForegroundPackage: String? = null

    companion object {
        private const val TAG = "AppBlockingService"
        private const val PREFS_NAME = "app_blocking_prefs"
        private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
        private const val KEY_BLOCK_REASONS = "block_reasons"
        private const val KEY_APP_LIMITS = "app_limits" // JSON: packageName -> limitSeconds (total daily limit)
        private const val KEY_TIME_RULES = "time_rules" // JSON array of time rules
        private const val KEY_DAILY_LIMIT = "daily_limit" // JSON: { limitSeconds, weekendBonusSeconds }
        private const val BLOCK_DEBOUNCE_MS = 1000L // Prevent rapid re-blocking

        // System apps that should never be blocked
        private val SYSTEM_ALLOWLIST = setOf(
            "com.android.settings",
            "com.android.dialer",
            "com.android.phone",
            "com.android.systemui",
            "com.android.emergency",
            "com.google.android.dialer",
            "com.samsung.android.dialer"
        )

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

        /**
         * Update remaining time for apps with limits.
         * This allows the service to schedule precise timers for blocking.
         * @param limits JSON string: { "com.package.name": remainingSeconds, ... }
         */
        fun updateAppLimits(context: Context, limitsJson: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_APP_LIMITS, limitsJson).apply()
            Log.d(TAG, "Updated app limits: $limitsJson")
        }

        /**
         * Update time rules (bedtime and focus time).
         * @param rulesJson JSON array: [{ "ruleType": "bedtime"|"focus", "startSeconds": int, "endSeconds": int, "days": [0-6] }, ...]
         */
        fun updateTimeRules(context: Context, rulesJson: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_TIME_RULES, rulesJson).apply()
            Log.d(TAG, "Updated time rules: $rulesJson")
        }

        /**
         * Update daily limit settings.
         * @param settingsJson JSON: { "limitSeconds": int, "weekendBonusSeconds": int }
         */
        fun updateDailyLimit(context: Context, settingsJson: String) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_DAILY_LIMIT, settingsJson).apply()
            Log.d(TAG, "Updated daily limit: $settingsJson")
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

        fun getRemainingSeconds(context: Context, packageName: String): Long? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val limitsJsonStr = prefs.getString(KEY_APP_LIMITS, null) ?: return null

            return try {
                val limitsJson = JSONObject(limitsJsonStr)
                if (limitsJson.has(packageName)) {
                    limitsJson.getLong(packageName)
                } else {
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse app limits JSON", e)
                null
            }
        }

        fun isInSystemAllowlist(packageName: String): Boolean {
            return SYSTEM_ALLOWLIST.contains(packageName)
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

        // Ignore our own app and system UI
        if (packageName == applicationContext.packageName ||
            packageName == "com.android.systemui" ||
            packageName == "com.android.launcher" ||
            packageName.startsWith("com.android.launcher")) {
            return
        }

        // Never block system allowlist apps
        if (isInSystemAllowlist(packageName)) {
            return
        }

        // Track current foreground app
        val previousForegroundPackage = currentForegroundPackage
        currentForegroundPackage = packageName

        Log.d(TAG, "Window changed to: $packageName")

        // If foreground app changed, cancel any pending block timer
        if (previousForegroundPackage != packageName) {
            cancelPendingBlock()
        }

        // Reload blocked packages in case they changed
        loadBlockedPackages()

        // Check if package is already blocked
        val isBlocked = packageName in blockedPackages
        Log.d(TAG, "Checking if $packageName is blocked: $isBlocked (blockedPackages contains: ${blockedPackages.take(5)})")
        
        if (isBlocked) {
            blockApp(packageName)
            return
        }

        // Check global constraints (bedtime, focus, daily limit)
        // These are checked in real-time so they work even when TS side hasn't pushed updates
        val globalBlockReason = checkGlobalConstraints()
        if (globalBlockReason != null) {
            Log.d(TAG, "Blocking $packageName due to global constraint: $globalBlockReason")
            blockApp(packageName, globalBlockReason)
            return
        }

        // Check if this app has a time limit and schedule a timer
        checkAndScheduleTimerBlock(packageName)
    }

    /**
     * Check global constraints (bedtime, focus time, daily limit).
     * Returns the block reason if any constraint is active, null otherwise.
     */
    private fun checkGlobalConstraints(): String? {
        val calendar = Calendar.getInstance()
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK) - 1 // Convert to 0=Sunday format
        val nowSeconds = calendar.get(Calendar.HOUR_OF_DAY) * 3600 +
                calendar.get(Calendar.MINUTE) * 60 +
                calendar.get(Calendar.SECOND)

        // Check bedtime rules first (highest priority)
        if (isWithinBedtime(dayOfWeek, nowSeconds)) {
            return "bedtime"
        }

        // Check focus time rules
        if (isWithinFocusTime(dayOfWeek, nowSeconds)) {
            return "focus"
        }

        // Check daily limit
        if (isDailyLimitExceeded(dayOfWeek)) {
            return "daily_limit"
        }

        return null
    }

    /**
     * Check if current time is within any bedtime rule.
     * Handles midnight crossover (e.g., 22:00-07:00).
     */
    private fun isWithinBedtime(dayOfWeek: Int, nowSeconds: Int): Boolean {
        val rulesJsonStr = sharedPrefs.getString(KEY_TIME_RULES, null) ?: return false

        return try {
            val rulesArray = JSONArray(rulesJsonStr)
            for (i in 0 until rulesArray.length()) {
                val rule = rulesArray.getJSONObject(i)
                if (rule.getString("ruleType") != "bedtime") continue

                val startSeconds = rule.getInt("startSeconds")
                val endSeconds = rule.getInt("endSeconds")
                val daysArray = rule.getJSONArray("days")
                val days = (0 until daysArray.length()).map { daysArray.getInt(it) }

                val crossesMidnight = endSeconds < startSeconds

                if (crossesMidnight) {
                    // Check if we're in the "before midnight" portion (same day as rule start)
                    if (nowSeconds >= startSeconds && days.contains(dayOfWeek)) {
                        Log.d(TAG, "Bedtime active: before midnight portion (day $dayOfWeek, time $nowSeconds >= $startSeconds)")
                        return true
                    }
                    // Check if we're in the "after midnight" portion (day after rule start)
                    val yesterdayDow = (dayOfWeek + 6) % 7
                    if (nowSeconds < endSeconds && days.contains(yesterdayDow)) {
                        Log.d(TAG, "Bedtime active: after midnight portion (yesterday $yesterdayDow, time $nowSeconds < $endSeconds)")
                        return true
                    }
                } else {
                    // Same-day window (doesn't cross midnight)
                    if (days.contains(dayOfWeek) && nowSeconds >= startSeconds && nowSeconds < endSeconds) {
                        Log.d(TAG, "Bedtime active: same-day (day $dayOfWeek, time $nowSeconds in $startSeconds-$endSeconds)")
                        return true
                    }
                }
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse time rules for bedtime check", e)
            false
        }
    }

    /**
     * Check if current time is within any focus time rule.
     * Focus time only applies to weekdays (Mon-Fri).
     */
    private fun isWithinFocusTime(dayOfWeek: Int, nowSeconds: Int): Boolean {
        // Focus time only applies to weekdays (1-5 = Mon-Fri)
        if (dayOfWeek == 0 || dayOfWeek == 6) {
            return false
        }

        val rulesJsonStr = sharedPrefs.getString(KEY_TIME_RULES, null) ?: return false

        return try {
            val rulesArray = JSONArray(rulesJsonStr)
            for (i in 0 until rulesArray.length()) {
                val rule = rulesArray.getJSONObject(i)
                if (rule.getString("ruleType") != "focus") continue

                val startSeconds = rule.getInt("startSeconds")
                val endSeconds = rule.getInt("endSeconds")
                val daysArray = rule.getJSONArray("days")
                val days = (0 until daysArray.length()).map { daysArray.getInt(it) }

                if (days.contains(dayOfWeek) && nowSeconds >= startSeconds && nowSeconds < endSeconds) {
                    Log.d(TAG, "Focus time active: day $dayOfWeek, time $nowSeconds in $startSeconds-$endSeconds")
                    return true
                }
            }
            false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse time rules for focus check", e)
            false
        }
    }

    /**
     * Check if daily limit is exceeded.
     * Uses real-time usage data from UsageStatsManager.
     */
    private fun isDailyLimitExceeded(dayOfWeek: Int): Boolean {
        val settingsJsonStr = sharedPrefs.getString(KEY_DAILY_LIMIT, null) ?: return false

        return try {
            val settings = JSONObject(settingsJsonStr)
            val limitSeconds = settings.optLong("limitSeconds", 0)
            if (limitSeconds <= 0) {
                return false // No limit configured
            }

            val weekendBonusSeconds = settings.optLong("weekendBonusSeconds", 0)
            val isWeekend = dayOfWeek == 0 || dayOfWeek == 6
            val effectiveLimit = limitSeconds + (if (isWeekend) weekendBonusSeconds else 0)

            // Get total usage for today
            val totalUsageSeconds = getTodayTotalUsageSeconds()

            Log.d(TAG, "Daily limit check: used=$totalUsageSeconds, limit=$effectiveLimit, isWeekend=$isWeekend")

            totalUsageSeconds >= effectiveLimit
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check daily limit", e)
            false
        }
    }

    /**
     * Get total usage for today across all apps (excluding system allowlist).
     */
    private fun getTodayTotalUsageSeconds(): Long {
        return try {
            val usageManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            // Get start of today (midnight)
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startOfDay = calendar.timeInMillis
            val now = System.currentTimeMillis()

            val stats = usageManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startOfDay,
                now
            )

            var totalMs = 0L
            for (stat in stats) {
                // Exclude system allowlist apps from total
                if (!isInSystemAllowlist(stat.packageName)) {
                    totalMs += stat.totalTimeInForeground
                }
            }

            totalMs / 1000 // Convert to seconds
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get total usage", e)
            0L
        }
    }

    /**
     * Check if the app has remaining time and schedule a block timer if needed.
     * Queries UsageStatsManager for real-time usage data to calculate accurate remaining time.
     */
    private fun checkAndScheduleTimerBlock(packageName: String) {
        // Re-read limits from SharedPreferences to get fresh data
        val freshPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val limitsJsonStr = freshPrefs.getString(KEY_APP_LIMITS, null)

        if (limitsJsonStr == null) {
            Log.d(TAG, "No app limits configured (limitsJson is null)")
            return
        }

        val limitSeconds = try {
            val limitsJson = JSONObject(limitsJsonStr)
            if (limitsJson.has(packageName)) {
                limitsJson.getLong(packageName)
            } else {
                Log.d(TAG, "No limit for $packageName (not in limits: ${limitsJson.keys().asSequence().toList()})")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse app limits JSON: $limitsJsonStr", e)
            null
        }

        if (limitSeconds == null) {
            return
        }

        // Query real-time usage from UsageStatsManager
        val usedSeconds = getTodayUsageSeconds(packageName)
        val remainingSeconds = limitSeconds - usedSeconds

        Log.d(TAG, "App $packageName: limit=${limitSeconds}s, used=${usedSeconds}s, remaining=${remainingSeconds}s")

        if (remainingSeconds <= 0) {
            // Limit already exceeded, block now
            Log.d(TAG, "App $packageName has no remaining time, blocking now")
            blockApp(packageName, "app_limit")
            return
        }

        // Schedule a timer to block when time runs out
        Log.d(TAG, "Scheduling block for $packageName in ${remainingSeconds}s")

        pendingBlockPackage = packageName
        pendingBlockRunnable = Runnable {
            if (currentForegroundPackage == packageName) {
                Log.d(TAG, "Timer expired, blocking $packageName")

                // Add to blocked packages
                blockedPackages.add(packageName)

                // Update shared prefs
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val currentBlocked = prefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet())?.toMutableSet() ?: mutableSetOf()
                currentBlocked.add(packageName)

                // Also update the reason
                val reasonsJsonStr = prefs.getString(KEY_BLOCK_REASONS, "{}")
                val reasonsJson = try {
                    JSONObject(reasonsJsonStr ?: "{}")
                } catch (e: Exception) {
                    JSONObject()
                }
                reasonsJson.put(packageName, "app_limit")

                prefs.edit()
                    .putStringSet(KEY_BLOCKED_PACKAGES, currentBlocked)
                    .putString(KEY_BLOCK_REASONS, reasonsJson.toString())
                    .apply()

                blockApp(packageName, "app_limit")
            }
            pendingBlockRunnable = null
            pendingBlockPackage = null
        }

        handler.postDelayed(pendingBlockRunnable!!, remainingSeconds * 1000)
    }

    /**
     * Query UsageStatsManager for today's actual usage of a package.
     * Returns usage in seconds.
     */
    private fun getTodayUsageSeconds(packageName: String): Long {
        return try {
            val usageManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            // Get start of today (midnight)
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startOfDay = calendar.timeInMillis
            val now = System.currentTimeMillis()

            val stats = usageManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startOfDay,
                now
            )

            // Find the stats for our package
            val appStats = stats.find { it.packageName == packageName }
            val usageMs = appStats?.totalTimeInForeground ?: 0L

            // Convert milliseconds to seconds
            usageMs / 1000
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query usage stats for $packageName", e)
            0L
        }
    }

    /**
     * Cancel any pending block timer
     */
    private fun cancelPendingBlock() {
        pendingBlockRunnable?.let {
            handler.removeCallbacks(it)
            Log.d(TAG, "Cancelled pending block for $pendingBlockPackage")
        }
        pendingBlockRunnable = null
        pendingBlockPackage = null
    }

    /**
     * Block an app by showing the blocking screen
     */
    private fun blockApp(packageName: String, reason: String? = null) {
        // Debounce: prevent showing blocking screen multiple times in quick succession
        val now = System.currentTimeMillis()
        if (packageName == lastBlockedPackage && (now - lastBlockTime) < BLOCK_DEBOUNCE_MS) {
            return
        }

        lastBlockedPackage = packageName
        lastBlockTime = now

        Log.d(TAG, "Blocking app: $packageName (reason: ${reason ?: "from blocked list"})")
        showBlockingScreen(packageName)
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
        cancelPendingBlock()
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelPendingBlock()
    }

    private fun loadBlockedPackages() {
        val packages = sharedPrefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()) ?: emptySet()
        blockedPackages.clear()
        blockedPackages.addAll(packages)
        Log.d(TAG, "Loaded ${blockedPackages.size} blocked packages from prefs: ${blockedPackages.take(10)}")
    }

    private fun showBlockingScreen(packageName: String) {
        val intent = Intent(this, BlockingActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("blocked_package", packageName)
        }
        startActivity(intent)
    }
}
