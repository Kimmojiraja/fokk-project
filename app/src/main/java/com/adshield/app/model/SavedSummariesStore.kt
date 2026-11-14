package com.adshield.app.model

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class SavedSummary(
    val id: String = UUID.randomUUID().toString(),
    val url: String,
    val title: String,
    val source: String,
    val sourceHost: String,
    val favicon: String,
    val readingTime: String,
    val wordCount: Int,
    val executiveSummary: String,
    val bullets: List<String>,
    val metrics: List<String>,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("url", url)
            put("title", title)
            put("source", source)
            put("sourceHost", sourceHost)
            put("favicon", favicon)
            put("readingTime", readingTime)
            put("wordCount", wordCount)
            put("executiveSummary", executiveSummary)
            put("summary", executiveSummary)
            put("bullets", JSONArray(bullets))
            put("metrics", JSONArray(metrics))
            put("timestamp", timestamp)
        }
    }

    companion object {
        fun fromJson(json: JSONObject): SavedSummary {
            val bulletsList = mutableListOf<String>()
            val bulletsArr = json.optJSONArray("bullets")
            if (bulletsArr != null) {
                for (i in 0 until bulletsArr.length()) {
                    bulletsList.add(bulletsArr.optString(i))
                }
            }
            val metricsList = mutableListOf<String>()
            val metricsArr = json.optJSONArray("metrics")
            if (metricsArr != null) {
                for (i in 0 until metricsArr.length()) {
                    metricsList.add(metricsArr.optString(i))
                }
            }
            return SavedSummary(
                id = json.optString("id", UUID.randomUUID().toString()),
                url = json.optString("url", ""),
                title = json.optString("title", "Article Summary"),
                source = json.optString("source", ""),
                sourceHost = json.optString("sourceHost", ""),
                favicon = json.optString("favicon", ""),
                readingTime = json.optString("readingTime", "3 min read"),
                wordCount = json.optInt("wordCount", 0),
                executiveSummary = json.optString("executiveSummary", json.optString("summary", "")),
                bullets = bulletsList,
                metrics = metricsList,
                timestamp = json.optLong("timestamp", System.currentTimeMillis())
            )
        }
    }
}

class SavedSummariesStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("fokk_saved_summaries_store", Context.MODE_PRIVATE)

    @Synchronized
    fun list(): List<SavedSummary> {
        val raw = prefs.getString("saved_summaries_json", "[]") ?: "[]"
        val list = mutableListOf<SavedSummary>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(SavedSummary.fromJson(obj))
            }
        } catch (e: Exception) {}
        return list.sortedByDescending { it.timestamp }
    }

    @Synchronized
    fun save(summary: SavedSummary) {
        val current = list().toMutableList()
        current.removeAll { (it.url.isNotBlank() && it.url == summary.url) || it.id == summary.id }
        current.add(0, summary)
        persist(current)
    }

    @Synchronized
    fun delete(id: String) {
        val current = list().toMutableList()
        current.removeAll { it.id == id }
        persist(current)
    }

    @Synchronized
    fun isSaved(url: String): Boolean {
        if (url.isBlank()) return false
        return list().any { it.url == url }
    }

    private fun persist(summaries: List<SavedSummary>) {
        val arr = JSONArray()
        summaries.forEach { arr.put(it.toJson()) }
        prefs.edit().putString("saved_summaries_json", arr.toString()).apply()
    }
}
