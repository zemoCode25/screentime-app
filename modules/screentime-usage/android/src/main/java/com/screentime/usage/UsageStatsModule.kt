package com.screentime.usage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UsageStatsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UsageStatsModule")

    Function("isUsageAccessGranted") {
      val context = appContext.reactContext ?: return@Function false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
      mode == AppOpsManager.MODE_ALLOWED
    }

    Function("openUsageAccessSettings") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("getInstalledApps") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      val pm = context.packageManager
      val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)

      apps.map { info ->
        val label = pm.getApplicationLabel(info).toString()
        mapOf(
          "packageName" to info.packageName,
          "appName" to label,
          "category" to mapCategory(info),
          "isSystemApp" to ((info.flags and ApplicationInfo.FLAG_SYSTEM) != 0)
        )
      }
    }

    AsyncFunction("getUsageStats") { startTimeMs: Double, endTimeMs: Double ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      val usageManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = usageManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTimeMs.toLong(),
        endTimeMs.toLong()
      )

      stats.map { stat ->
        mapOf(
          "packageName" to stat.packageName,
          "totalTimeMs" to stat.totalTimeInForeground,
          "lastTimeUsed" to stat.lastTimeUsed
        )
      }
    }
  }

  private fun mapCategory(info: ApplicationInfo): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return "other"
    }
    return when (info.category) {
      ApplicationInfo.CATEGORY_GAME -> "games"
      ApplicationInfo.CATEGORY_SOCIAL -> "social"
      ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
      ApplicationInfo.CATEGORY_VIDEO -> "video"
      ApplicationInfo.CATEGORY_AUDIO -> "other"
      ApplicationInfo.CATEGORY_IMAGE -> "creativity"
      ApplicationInfo.CATEGORY_MAPS -> "utilities"
      ApplicationInfo.CATEGORY_NEWS -> "other"
      ApplicationInfo.CATEGORY_UNDEFINED -> "other"
      else -> "other"
    }
  }
}
