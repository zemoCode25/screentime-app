package com.screentime.usage

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

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

    Function("isAccessibilityEnabled") {
      val context = appContext.reactContext ?: return@Function false
      val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
      val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      val packageName = context.packageName

      enabledServices.any { service ->
        service.id.contains(packageName)
      }
    }

    Function("requestAccessibilityPermission") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("updateBlockedPackages") { packages: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      AppBlockingService.updateBlockedPackages(context, packages.toSet())
    }

    AsyncFunction("updateBlockedPackagesWithReasons") { packages: List<Map<String, String>> ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      AppBlockingService.updateBlockedPackagesWithReasons(context, packages)
    }

    AsyncFunction("getBlockedPackages") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<String>()
      AppBlockingService.getBlockedPackages(context).toList()
    }

    AsyncFunction("getBlockReason") { packageName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      AppBlockingService.getBlockReason(context, packageName)
    }

    AsyncFunction("getAppIconBase64") { packageName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      try {
        val pm = context.packageManager
        val drawable = pm.getApplicationIcon(packageName)
        val bitmap = drawableToBitmap(drawable, 64)
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 80, outputStream)
        val bytes = outputStream.toByteArray()
        Base64.encodeToString(bytes, Base64.NO_WRAP)
      } catch (e: Exception) {
        null
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

  private fun drawableToBitmap(drawable: Drawable, size: Int): Bitmap {
    if (drawable is BitmapDrawable && drawable.bitmap != null) {
      return Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
    }

    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(canvas)
    return bitmap
  }
}
