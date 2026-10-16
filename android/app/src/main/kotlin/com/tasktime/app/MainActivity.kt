package com.tasktime.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: SaveFileRequest? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val io = Executors.newSingleThreadExecutor()

    /** System file picker for "Import backup" (<input type=file>). Always answers the WebView callback exactly once. */
    private val pickFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    /** System "save as" dialog; destination is chosen by the user, so no storage permission is needed. */
    private val createDoc = registerForActivityResult(object : ActivityResultContract<SaveFileRequest, Uri?>() {
        override fun createIntent(context: Context, input: SaveFileRequest) =
            Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(input.mime)
                .putExtra(Intent.EXTRA_TITLE, input.name)
        override fun parseResult(resultCode: Int, intent: Intent?): Uri? =
            if (resultCode == android.app.Activity.RESULT_OK) intent?.data else null
    }) { uri ->
        val req = pendingSave
        pendingSave = null
        if (uri != null && req != null) writeFile(uri, req)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = WebView(this).also { setContentView(it) }
        configureWebView()
        installBackHandler()
        if (savedInstanceState == null) webView.loadUrl(UrlPolicy.START_URL) else webView.restoreState(savedInstanceState)
    }

    private fun configureWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain(UrlPolicy.HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.setBackgroundColor(0xFF1C1C22.toInt())
        webView.settings.apply {
            javaScriptEnabled = true            // required by the bundled app only (all navigation is locked to it)
            domStorageEnabled = true            // required for IndexedDB / localStorage
            allowFileAccess = false             // never serve file:// content
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val resp = assetLoader.shouldInterceptRequest(request.url) ?: return null
                val headers = HashMap(resp.responseHeaders ?: emptyMap())
                headers["Content-Security-Policy"] = UrlPolicy.CSP
                resp.responseHeaders = headers
                return resp
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (UrlPolicy.isInternal(url)) return false
                if (UrlPolicy.isExternalAllowed(url)) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: ActivityNotFoundException) { /* no browser */ }
                }
                return true // block everything else (file:, content:, http:, intent: ...)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                if (request.isForMainFrame) Toast.makeText(this@MainActivity, R.string.load_failed, Toast.LENGTH_LONG).show()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView, filePathCallback: ValueCallback<Array<Uri>>, params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                return try {
                    pickFile.launch(arrayOf("application/json", "text/plain", "application/octet-stream"))
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }

        // The single narrow native bridge, restricted to our own origin and main frame. See SaveFileRequest.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "TTNative", setOf(UrlPolicy.ORIGIN)) { _, message: WebMessageCompat, sourceOrigin, isMainFrame, _ ->
                if (!isMainFrame || !UrlPolicy.isAppOrigin(sourceOrigin.scheme, sourceOrigin.host, sourceOrigin.port)) return@addWebMessageListener
                val req = SaveFileRequest.parse(message.data) ?: return@addWebMessageListener
                runOnUiThread { pendingSave = req; createDoc.launch(req) }
            }
        }
    }

    private fun writeFile(uri: Uri, req: SaveFileRequest) {
        io.execute {
            val ok = try {
                contentResolver.openOutputStream(uri, "wt")?.use { it.write(req.content.toByteArray(Charsets.UTF_8)) } != null
            } catch (e: Exception) { false }
            runOnUiThread { Toast.makeText(this, if (ok) R.string.saved else R.string.save_failed, Toast.LENGTH_SHORT).show() }
        }
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Constant script (no user data): close an open dialog first, otherwise leave the app.
                webView.evaluateJavascript(
                    "(function(){var d=document.getElementById('dlg');if(d&&d.open){d.close();return 'closed'}return 'none'})()"
                ) { result ->
                    if (result?.contains("closed") == true) return@evaluateJavascript
                    if (webView.canGoBack()) webView.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
                }
            }
        })
    }

    private fun dispatchToPage(script: String) {
        webView.post { webView.evaluateJavascript(script, null) }
    }

    override fun onStart() {
        super.onStart()
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                dispatchToPage("window.dispatchEvent(new CustomEvent('tt:native-network',{detail:{online:true}}))")
            }
            override fun onLost(network: Network) {
                dispatchToPage("window.dispatchEvent(new CustomEvent('tt:native-network',{detail:{online:false}}))")
            }
        }
        try { cm.registerDefaultNetworkCallback(cb); networkCallback = cb } catch (e: Exception) { /* best effort */ }
    }

    override fun onStop() {
        networkCallback?.let {
            try { (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(it) } catch (e: Exception) { }
        }
        networkCallback = null
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        // Timer recovery: the timer is derived from persisted timestamps; this just makes the UI re-read them.
        dispatchToPage("window.dispatchEvent(new Event('tt:resume'))")
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        webView.destroy()
        io.shutdown()
        super.onDestroy()
    }
}
