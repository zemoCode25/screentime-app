package com.screentime.usage

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class BlockingActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "BlockedAppScreen"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use a custom delegate
     * that passes the blocked package info as initial props.
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            override fun getLaunchOptions(): Bundle {
                val blockedPackage = intent?.getStringExtra("blocked_package") ?: ""
                val blockReason = AppBlockingService.getBlockReason(this@BlockingActivity, blockedPackage) ?: "app_limit"
                
                return Bundle().apply {
                    putString("blockedPackage", blockedPackage)
                    putString("blockReason", blockReason)
                }
            }
        }
    }

    /**
     * Override back button to go to home instead of closing the blocking screen
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        goToHome()
    }

    /**
     * Override hardware back button
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            goToHome()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /**
     * Navigate to home launcher instead of closing
     */
    private fun goToHome() {
        val intent = Intent(Intent.ACTION_MAIN)
        intent.addCategory(Intent.CATEGORY_HOME)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)
        finish()
    }
}
