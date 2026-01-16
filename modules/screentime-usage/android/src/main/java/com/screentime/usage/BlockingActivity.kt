package com.screentime.usage

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class BlockingActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "BlockedAppScreen"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flag [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Get the blocked package name from intent
        val blockedPackage = intent.getStringExtra("blocked_package") ?: ""

        // Store it so React Native can access it via NativeModules
        val props = Arguments.createMap()
        props.putString("blockedPackage", blockedPackage)

        // Note: props will be passed via getLaunchOptions()
    }

    override fun getLaunchOptions(): Bundle? {
        val blockedPackage = intent.getStringExtra("blocked_package") ?: ""
        val bundle = Bundle()
        bundle.putString("blockedPackage", blockedPackage)
        return bundle
    }

    /**
     * Override back button to go to home instead of closing the blocking screen
     */
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
