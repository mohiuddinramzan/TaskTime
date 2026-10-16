package com.tasktime.app

import java.net.URI

/** Pure (JVM-testable) navigation/origin policy. The UI is served ONLY from the https app-assets origin. */
object UrlPolicy {
    const val HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$HOST"
    const val START_URL = "$ORIGIN/assets/www/index.html"

    /** Content-Security-Policy added to every bundled response: scripts only from the app, network only to Firebase. */
    const val CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
        "font-src 'self'; manifest-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com " +
        "https://securetoken.googleapis.com https://firestore.googleapis.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

    private fun parse(url: String?): URI? = try { if (url == null) null else URI(url) } catch (e: Exception) { null }

    /** True only for our own bundled pages. */
    fun isInternal(url: String?): Boolean {
        val u = parse(url) ?: return false
        return u.scheme == "https" && u.host.equals(HOST, ignoreCase = true) && u.port == -1 &&
            (u.path ?: "").startsWith("/assets/www/")
    }

    /** True for origins allowed to talk to the native bridge (exact app origin, any path). */
    fun isAppOrigin(scheme: String?, host: String?, port: Int): Boolean =
        scheme == "https" && host.equals(HOST, ignoreCase = true) && port == -1

    /** External links may only be https; they open in the system browser, never inside this WebView. */
    fun isExternalAllowed(url: String?): Boolean {
        val u = parse(url) ?: return false
        return u.scheme == "https" && !u.host.isNullOrEmpty() && !isInternal(url)
    }
}
