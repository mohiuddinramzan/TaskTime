package com.tasktime.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlPolicyTest {
    @Test fun bundledPagesAreInternal() {
        assertTrue(UrlPolicy.isInternal(UrlPolicy.START_URL))
        assertTrue(UrlPolicy.isInternal("https://appassets.androidplatform.net/assets/www/js/app.js"))
    }
    @Test fun everythingElseIsNotInternal() {
        assertFalse(UrlPolicy.isInternal("http://appassets.androidplatform.net/assets/www/index.html"))
        assertFalse(UrlPolicy.isInternal("https://appassets.androidplatform.net.evil.com/assets/www/index.html"))
        assertFalse(UrlPolicy.isInternal("https://appassets.androidplatform.net:8443/assets/www/index.html"))
        assertFalse(UrlPolicy.isInternal("https://appassets.androidplatform.net/other/x"))
        assertFalse(UrlPolicy.isInternal("file:///sdcard/index.html"))
        assertFalse(UrlPolicy.isInternal("content://x/y"))
        assertFalse(UrlPolicy.isInternal(null))
        assertFalse(UrlPolicy.isInternal("not a url"))
    }
    @Test fun externalLinksMustBeHttps() {
        assertTrue(UrlPolicy.isExternalAllowed("https://example.com/page"))
        assertFalse(UrlPolicy.isExternalAllowed("http://example.com"))
        assertFalse(UrlPolicy.isExternalAllowed("intent://scan/#Intent;end"))
        assertFalse(UrlPolicy.isExternalAllowed("javascript:alert(1)"))
        assertFalse(UrlPolicy.isExternalAllowed(UrlPolicy.START_URL))
    }
    @Test fun bridgeOriginIsExact() {
        assertTrue(UrlPolicy.isAppOrigin("https", "appassets.androidplatform.net", -1))
        assertFalse(UrlPolicy.isAppOrigin("https", "evil.com", -1))
        assertFalse(UrlPolicy.isAppOrigin("http", "appassets.androidplatform.net", -1))
    }
    @Test fun cspOnlyAllowsFirebaseNetwork() {
        assertTrue(UrlPolicy.CSP.contains("script-src 'self'"))
        assertFalse(UrlPolicy.CSP.contains("unsafe-eval"))
        assertTrue(UrlPolicy.CSP.contains("https://firestore.googleapis.com"))
    }
}
