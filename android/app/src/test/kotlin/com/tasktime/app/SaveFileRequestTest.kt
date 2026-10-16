package com.tasktime.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SaveFileRequestTest {
    private fun msg(name: String, mime: String, content: String = "{}", type: String = "saveFile") =
        """{"type":"$type","name":"$name","mime":"$mime","content":${org.json.JSONObject.quote(content)}}"""

    @Test fun acceptsJsonAndCsv() {
        assertNotNull(SaveFileRequest.parse(msg("task-time-backup.json", "application/json")))
        assertEquals("text/csv", SaveFileRequest.parse(msg("task-time.csv", "text/csv"))!!.mime)
    }
    @Test fun rejectsPathTraversalAndOddNames() {
        for (n in listOf("../x.json", "a/b.json", "..json", "a..b.json", ".hidden.json", "x.json/", "", "a b.json"))
            assertNull(n, SaveFileRequest.parse(msg(n, "application/json")))
    }
    @Test fun rejectsWrongExtensionOrMimeOrType() {
        assertNull(SaveFileRequest.parse(msg("x.apk", "application/json")))
        assertNull(SaveFileRequest.parse(msg("x.json", "text/csv")))
        assertNull(SaveFileRequest.parse(msg("x.json", "application/json", type = "other")))
    }
    @Test fun rejectsMalformedAndOversized() {
        assertNull(SaveFileRequest.parse(null))
        assertNull(SaveFileRequest.parse("not json"))
        assertNull(SaveFileRequest.parse("""{"type":"saveFile","name":"x.json","mime":"application/json"}"""))
        assertNull(SaveFileRequest.parse(msg("x.json", "application/json", "a".repeat(SaveFileRequest.MAX_BYTES + 1))))
    }
}
