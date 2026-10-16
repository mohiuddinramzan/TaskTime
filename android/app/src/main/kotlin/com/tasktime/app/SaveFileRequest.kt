package com.tasktime.app

import org.json.JSONObject

/**
 * The ONLY message the web app may send to native code: "save this text as a .json/.csv file".
 * Needed because a WebView cannot download blob: URLs, and Phase 1 offers JSON backup + CSV export.
 * The user always picks the destination through the system file picker (no storage permission required).
 */
data class SaveFileRequest(val name: String, val mime: String, val content: String) {
    companion object {
        const val MAX_BYTES = 10 * 1024 * 1024
        private val NAME = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
        private val MIME_BY_EXT = mapOf("json" to "application/json", "csv" to "text/csv")

        fun parse(raw: String?): SaveFileRequest? {
            if (raw == null || raw.length > MAX_BYTES + 4096) return null
            return try {
                val o = JSONObject(raw)
                if (o.optString("type") != "saveFile") return null
                val name = o.optString("name")
                if (!NAME.matches(name) || name.contains("..")) return null
                val expected = MIME_BY_EXT[name.substringAfterLast('.', "").lowercase()] ?: return null
                if (o.optString("mime") != expected) return null
                if (!o.has("content") || o.isNull("content")) return null
                val content = o.getString("content")
                if (content.toByteArray(Charsets.UTF_8).size > MAX_BYTES) return null
                SaveFileRequest(name, expected, content)
            } catch (e: Exception) {
                null
            }
        }
    }
}
