package com.englishpracticing.android.data

import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.englishpracticing.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URI
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.util.UUID
import javax.net.ssl.HttpsURLConnection

class ApiFailure(val status: Int) : Exception()

class TutorApi {
    data class Connection(val url: String, val token: String)

    suspend fun connection(mode: String, startStep: Int = 0): Connection {
        val json = request("/api/token", JSONObject().put("practiceMode", mode).put("avatar", "boy").put("startStep", startStep))
        val url = json.getString("serverUrl")
        require(URI(url).scheme == "wss" && !URI(url).host.isNullOrBlank())
        return Connection(url, json.getString("participantToken").also { require(it.isNotBlank()) })
    }

    suspend fun progress(window: String): JSONObject {
        require(window in listOf("all", "last-5", "last-10", "week", "month"))
        return request("/api/mobile-progress?window=$window")
    }

    suspend fun preferences(): PracticePreferences = parsePreferences(request("/api/profile"))

    suspend fun savePreferences(language: String): PracticePreferences {
        require(language in listOf("es", "en"))
        val body = JSONObject().put("nativeLanguage", language).put("targetLanguage", "en")
        return parsePreferences(execute("/api/profile", "application/json",
            { output -> output.write(body.toString().toByteArray(Charsets.UTF_8)) }, "PATCH"))
    }

    private fun parsePreferences(data: JSONObject): PracticePreferences {
        val language = data.getString("nativeLanguage")
        require(language in listOf("es", "en") && data.getString("targetLanguage") == "en")
        return PracticePreferences(language)
    }

    suspend fun recentCorrections(): List<JSONObject> {
        val entries = request("/api/practice-journal").optJSONArray("entries") ?: return emptyList()
        return (0 until entries.length()).mapNotNull { entries.optJSONObject(it) }
    }

    suspend fun review(exercise: String, step: Int, routine: String, text: String, previous: String, audio: File?): JSONObject {
        require(routine.isNotBlank() && routine.length <= 500)
        require(text.length <= 8000 && (text.isNotBlank() || audio != null))
        require(audio == null || audio.length() in 1..8_000_000)
        val boundary = "Android" + UUID.randomUUID().toString().replace("-", "")
        return execute("/api/time-shifting", "multipart/form-data; boundary=$boundary", writeBody = { output ->
            fun write(value: String) { output.write(value.toByteArray(Charsets.UTF_8)) }
            for ((name, value) in mapOf("exercise" to exercise, "step" to step.toString(), "routine" to routine,
                "text" to text, "previousPresent" to previous)) {
                write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n")
            }
            if (audio != null) {
                write("--$boundary\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"practice.m4a\"\r\nContent-Type: audio/mp4\r\n\r\n")
                audio.inputStream().use { it.copyTo(output) }
                write("\r\n")
            }
            write("--$boundary--\r\n")
        })
    }

    private suspend fun request(path: String, body: JSONObject? = null): JSONObject =
        execute(path, if (body != null) "application/json" else null,
            if (body != null) { output: OutputStream -> output.write(body.toString().toByteArray(Charsets.UTF_8)) } else null)

    private suspend fun execute(path: String, contentType: String?, writeBody: ((OutputStream) -> Unit)?, method: String = if (writeBody == null) "GET" else "POST"): JSONObject {
        val token = when (val result = Clerk.auth.getToken()) {
            is ClerkResult.Success -> result.value
            is ClerkResult.Failure -> throw ApiFailure(401)
        }
        return withContext(Dispatchers.IO) {
            val connection = URI(BuildConfig.API_BASE_URL + path).toURL().openConnection() as HttpsURLConnection
            try {
                connection.connectTimeout = 12_000
                connection.readTimeout = if (path == "/api/time-shifting") 90_000 else 25_000
                // Never follow redirects carrying the bearer token to another host.
                connection.instanceFollowRedirects = false
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Accept", "application/json")
                if (writeBody != null) {
                    connection.requestMethod = method
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", contentType)
                    connection.setChunkedStreamingMode(8192)
                    connection.outputStream.use(writeBody)
                }
                if (connection.responseCode !in 200..299) throw ApiFailure(connection.responseCode)
                val bytes = connection.inputStream.use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        require(output.size() + count <= if (path.startsWith("/api/mobile-progress?")) 12 * 1024 * 1024 else 512 * 1024) { "Response is too large" }
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                JSONObject(String(bytes, Charsets.UTF_8))
            } finally {
                connection.disconnect()
            }
        }
    }
}
