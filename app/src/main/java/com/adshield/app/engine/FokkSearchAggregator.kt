package com.adshield.app.engine

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Locale

/**
 * Data class representing an externally corroborated intelligence source.
 */
data class CorroboratedSource(
    val title: String,
    val url: String,
    val domain: String,
    val snippet: String,
    val sourceType: String = "WEB", // NEWS, WEB, ENCYCLOPEDIA, FACT_DB
    val timestamp: String = "",
    val stance: String = "SUPPORTS" // SUPPORTS, PARTIAL, CONTRADICTS
)

/**
 * High-reliability multi-source web intelligence aggregator for Fokk AI.
 * Fetches and cross-corroborates information from Google News RSS,
 * DuckDuckGo HTML search, Wikipedia encyclopedic archives, and Wikidata factual entities.
 */
object FokkSearchAggregator {

    private const val USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    private const val CONNECT_TIMEOUT_MS = 3500
    private const val READ_TIMEOUT_MS = 4000

    /**
     * Aggregates intelligence across all sources in parallel.
     */
    suspend fun aggregate(
        query: String,
        pageTitle: String = "",
        pageHost: String = "",
        maxResults: Int = 8
    ): List<CorroboratedSource> = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) return@withContext emptyList()

        coroutineScope {
            val newsDeferred = async { fetchGoogleNews(cleanQuery, max = 3) }
            val ddgDeferred = async { fetchDuckDuckGoHtml(cleanQuery, max = 4) }
            val wikiDeferred = async { fetchWikipedia(cleanQuery, max = 2) }
            val wikidataDeferred = async { fetchWikidata(cleanQuery, max = 1) }

            val newsResults = runCatching { newsDeferred.await() }.getOrDefault(emptyList())
            val ddgResults = runCatching { ddgDeferred.await() }.getOrDefault(emptyList())
            val wikiResults = runCatching { wikiDeferred.await() }.getOrDefault(emptyList())
            val wikidataResults = runCatching { wikidataDeferred.await() }.getOrDefault(emptyList())

            val combined = mutableListOf<CorroboratedSource>()
            val seenUrls = mutableSetOf<String>()
            val seenDomains = mutableSetOf<String>()

            // Normalize page host
            val normalizedPageHost = pageHost.lowercase(Locale.ROOT).removePrefix("www.")

            fun addSource(src: CorroboratedSource) {
                val normUrl = src.url.trim().lowercase(Locale.ROOT)
                val normDomain = src.domain.trim().lowercase(Locale.ROOT).removePrefix("www.")
                if (normUrl.isBlank() || seenUrls.contains(normUrl)) return
                if (normDomain == normalizedPageHost && normalizedPageHost.isNotBlank()) return

                seenUrls.add(normUrl)
                seenDomains.add(normDomain)
                combined.add(src)
            }

            // Prioritize fresh news reports and live web journalism over encyclopedic entries
            newsResults.forEach { addSource(it) }
            ddgResults.forEach { addSource(it) }

            // Only include encyclopedic results if their title directly matches key named entities from the query
            val queryKeywords = cleanQuery.lowercase(Locale.ROOT)
                .split(Regex("\\W+"))
                .filter { it.length >= 4 && !it.matches(Regex("^(what|this|about|news|page|article|transfer|latest|video)$")) }

            wikiResults.filter { w ->
                val titleLower = w.title.lowercase(Locale.ROOT)
                queryKeywords.any { kw -> titleLower.contains(kw) }
            }.forEach { addSource(it) }

            wikidataResults.filter { wd ->
                val titleLower = wd.title.lowercase(Locale.ROOT)
                queryKeywords.any { kw -> titleLower.contains(kw) }
            }.forEach { addSource(it) }

            combined.take(maxResults)
        }
    }

    /**
     * Fetches real-time headlines from Google News RSS feed.
     */
    fun fetchGoogleNews(query: String, max: Int = 3): List<CorroboratedSource> {
        val results = mutableListOf<CorroboratedSource>()
        try {
            val encodedQuery = Uri.encode(query)
            val rssUrl = "https://news.google.com/rss/search?q=$encodedQuery&hl=en-US&gl=US&ceid=US:en"
            val conn = (URL(rssUrl).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", USER_AGENT)
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
            }

            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val xml = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
                val itemRegex = Regex("<item>(.*?)</item>", RegexOption.DOT_MATCHES_ALL)
                val titleRegex = Regex("<title>(.*?)</title>", RegexOption.DOT_MATCHES_ALL)
                val linkRegex = Regex("<link>(.*?)</link>", RegexOption.DOT_MATCHES_ALL)
                val pubDateRegex = Regex("<pubDate>(.*?)</pubDate>", RegexOption.DOT_MATCHES_ALL)
                val sourceRegex = Regex("<source[^>]*url=\"([^\"]*)\"[^>]*>(.*?)</source>", RegexOption.DOT_MATCHES_ALL)

                for (match in itemRegex.findAll(xml)) {
                    val itemContent = match.groupValues[1]
                    val rawTitle = titleRegex.find(itemContent)?.groupValues?.get(1).orEmpty()
                    val rawLink = linkRegex.find(itemContent)?.groupValues?.get(1).orEmpty()
                    val pubDate = pubDateRegex.find(itemContent)?.groupValues?.get(1).orEmpty()
                    val sourceMatch = sourceRegex.find(itemContent)
                    val sourceName = sourceMatch?.groupValues?.get(2).orEmpty().ifBlank {
                        val host = runCatching { Uri.parse(rawLink).host }.getOrNull().orEmpty()
                        host.removePrefix("www.")
                    }

                    val cleanTitle = cleanHtmlText(rawTitle)
                    if (cleanTitle.isNotBlank() && rawLink.isNotBlank()) {
                        // Extract publisher domain
                        val domain = runCatching {
                            sourceMatch?.groupValues?.get(1)?.let { Uri.parse(it).host }
                        }.getOrNull()?.ifBlank { null }
                            ?: runCatching { Uri.parse(rawLink).host }.getOrNull()
                            ?: "news.google.com"

                        val formattedDate = pubDate.take(16).trim()
                        val snippet = if (sourceName.isNotBlank()) "Reported by $sourceName" else "Google News dispatch"

                        results.add(
                            CorroboratedSource(
                                title = cleanTitle,
                                url = rawLink,
                                domain = domain.removePrefix("www."),
                                snippet = snippet,
                                sourceType = "NEWS",
                                timestamp = formattedDate
                            )
                        )
                        if (results.size >= max) break
                    }
                }
            }
        } catch (_: Exception) {}
        return results
    }

    /**
     * Scrapes web results from DuckDuckGo HTML version.
     */
    fun fetchDuckDuckGoHtml(query: String, max: Int = 4): List<CorroboratedSource> {
        val results = mutableListOf<CorroboratedSource>()
        try {
            val encodedQuery = Uri.encode(query)
            val searchUrl = "https://html.duckduckgo.com/html/?q=$encodedQuery"
            val conn = (URL(searchUrl).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", USER_AGENT)
                setRequestProperty("Accept", "text/html,application/xhtml+xml")
                setRequestProperty("Accept-Language", "en-US,en;q=0.9")
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
            }

            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val html = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }

                // Parse result blocks
                val resultBlockRegex = Regex("""<div[^>]*class="[^"]*web-result[^"]*"[^>]*>(.*?)</div>\s*</div>""", RegexOption.DOT_MATCHES_ALL)
                val titleLinkRegex = Regex("""<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>""", RegexOption.DOT_MATCHES_ALL)
                val snippetRegex = Regex("""<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>""", RegexOption.DOT_MATCHES_ALL)

                val blocks = resultBlockRegex.findAll(html).toList()
                for (block in blocks) {
                    val blockHtml = block.groupValues[1]
                    val titleLinkMatch = titleLinkRegex.find(blockHtml) ?: continue
                    val rawHref = titleLinkMatch.groupValues[1]
                    val rawTitle = titleLinkMatch.groupValues[2]
                    val rawSnippet = snippetRegex.find(blockHtml)?.groupValues?.get(1).orEmpty()

                    // Extract actual destination URL from DDG redirect wrapper: /l/?uddg=https%3A%2F%2F...
                    val targetUrl = if (rawHref.contains("uddg=")) {
                        val parsed = Uri.parse(if (rawHref.startsWith("http")) rawHref else "https:$rawHref")
                        parsed.getQueryParameter("uddg") ?: rawHref
                    } else if (rawHref.startsWith("//")) {
                        "https:$rawHref"
                    } else {
                        rawHref
                    }

                    val cleanTitle = cleanHtmlText(rawTitle)
                    val cleanSnippet = cleanHtmlText(rawSnippet)
                    val domain = runCatching { Uri.parse(targetUrl).host }.getOrNull().orEmpty().removePrefix("www.")

                        val publisherName = when {
                            domain.contains("independent.co.uk", ignoreCase = true) -> "The Independent"
                            domain.contains("thetimes.com", ignoreCase = true) || domain.contains("thetimes.co.uk", ignoreCase = true) -> "The Times"
                            domain.contains("thestandard.co.uk", ignoreCase = true) -> "The Standard"
                            domain.contains("theguardian.com", ignoreCase = true) -> "The Guardian"
                            domain.contains("skysports.com", ignoreCase = true) -> "Sky Sports"
                            domain.contains("sky.com", ignoreCase = true) || domain.contains("news.sky.com", ignoreCase = true) -> "Sky News"
                            domain.contains("bbc.com", ignoreCase = true) || domain.contains("bbc.co.uk", ignoreCase = true) -> "BBC News"
                            domain.contains("yahoo.com", ignoreCase = true) -> "Yahoo"
                            domain.contains("theathletic.com", ignoreCase = true) -> "The Athletic"
                            domain.contains("reuters.com", ignoreCase = true) -> "Reuters"
                            domain.contains("lbc.co.uk", ignoreCase = true) -> "LBC"
                            domain.contains("telegraph.co.uk", ignoreCase = true) -> "The Telegraph"
                            else -> domain.split(".").firstOrNull()?.replaceFirstChar { it.uppercase() } ?: domain
                        }
                        val formattedSnippet = if (cleanSnippet.isNotBlank()) {
                            "Reported by $publisherName: $cleanSnippet"
                        } else {
                            "Reported by $publisherName"
                        }

                        results.add(
                            CorroboratedSource(
                                title = cleanTitle,
                                url = targetUrl,
                                domain = domain,
                                snippet = formattedSnippet,
                                sourceType = "WEB"
                            )
                        )
                        if (results.size >= max) break
                    }
                }
            }
        } catch (_: Exception) {}
        return results
    }

    /**
     * Fetches encyclopedic summaries from Wikipedia search API.
     */
    fun fetchWikipedia(query: String, max: Int = 2): List<CorroboratedSource> {
        val results = mutableListOf<CorroboratedSource>()
        try {
            val encodedQuery = Uri.encode(query)
            val apiUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=$encodedQuery&format=json&utf8=&srlimit=$max"
            val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", "FokkBrowser/2.8 (Android; Mobile)")
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
            }

            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val jsonText = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
                val root = JSONObject(jsonText)
                val searchArr = root.optJSONObject("query")?.optJSONArray("search") ?: return results

                for (i in 0 until searchArr.length()) {
                    val item = searchArr.getJSONObject(i)
                    val title = item.optString("title", "").trim()
                    val snippet = cleanHtmlText(item.optString("snippet", ""))
                    val pageUrl = "https://en.wikipedia.org/wiki/" + Uri.encode(title.replace(' ', '_'))

                    if (title.isNotBlank()) {
                        results.add(
                            CorroboratedSource(
                                title = "$title - Wikipedia",
                                url = pageUrl,
                                domain = "en.wikipedia.org",
                                snippet = snippet,
                                sourceType = "ENCYCLOPEDIA"
                            )
                        )
                    }
                }
            }
        } catch (_: Exception) {}
        return results
    }

    /**
     * Fetches structured entity data from Wikidata.
     */
    fun fetchWikidata(query: String, max: Int = 1): List<CorroboratedSource> {
        val results = mutableListOf<CorroboratedSource>()
        try {
            val encodedQuery = Uri.encode(query)
            val apiUrl = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=$encodedQuery&language=en&format=json&limit=$max"
            val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", "FokkBrowser/2.8 (Android; Mobile)")
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
            }

            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val jsonText = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
                val root = JSONObject(jsonText)
                val searchArr = root.optJSONArray("search") ?: return results

                for (i in 0 until searchArr.length()) {
                    val item = searchArr.getJSONObject(i)
                    val id = item.optString("id", "")
                    val label = item.optString("label", "").trim()
                    val desc = item.optString("description", "").trim()
                    val conceptUri = item.optString("concepturi", "https://www.wikidata.org/wiki/$id")

                    if (label.isNotBlank() && desc.isNotBlank()) {
                        results.add(
                            CorroboratedSource(
                                title = "$label (Entity Record)",
                                url = conceptUri,
                                domain = "wikidata.org",
                                snippet = desc,
                                sourceType = "FACT_DB"
                            )
                        )
                    }
                }
            }
        } catch (_: Exception) {}
        return results
    }

    /**
     * Strips HTML tags, entities, and excessive whitespace.
     */
    fun cleanHtmlText(raw: String): String {
        if (raw.isBlank()) return ""
        val withoutTags = raw.replace(Regex("<[^>]+?>"), " ")
        return try {
            androidx.core.text.HtmlCompat.fromHtml(withoutTags, androidx.core.text.HtmlCompat.FROM_HTML_MODE_LEGACY)
                .toString()
                .replace(Regex("\\s+"), " ")
                .trim()
        } catch (_: Exception) {
            withoutTags
                .replace("&quot;", "\"")
                .replace("&amp;", "&")
                .replace("&#39;", "'")
                .replace("&#x27;", "'")
                .replace("&apos;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&nbsp;", " ")
                .replace(Regex("\\s+"), " ")
                .trim()
        }
    }
}
