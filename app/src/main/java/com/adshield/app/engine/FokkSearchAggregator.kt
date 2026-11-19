package com.adshield.app.engine

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
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
 * Verified visual context card (real editorial/encyclopedic photo of a key person,
 * organization, place, or concept referenced in the active page).
 */
data class VisualEvidenceItem(
    val title: String,
    val caption: String,
    val imageUrl: String,
    val sourceUrl: String
)

/**
 * High-reliability multi-source web intelligence aggregator for Fokk AI.
 * Fetches, filters, ranks, and cross-corroborates information from Google News RSS,
 * DuckDuckGo HTML search, Wikipedia encyclopedic archives, and Wikidata entities.
 */
object FokkSearchAggregator {

    private const val USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    private const val CONNECT_TIMEOUT_MS = 3500
    private const val READ_TIMEOUT_MS = 4500

    private val BLOCKED_DOMAINS = setOf(
        "wn.com", "article.wn.com", "powerpopradio.com", "whopostedwhat.com",
        "pressreader.com", "pinterest.com", "quora.com", "brainly.com",
        "brainly.in", "chegg.com", "scribd.com", "slideshare.net",
        "ebay.com", "amazon.com", "aliexpress.com", "walmart.com",
        "etsy.com", "tiktok.com", "facebook.com", "instagram.com",
        "linkedin.com", "youtube.com", "youtu.be", "fixthecourt.com",
        "duckduckgo.com", "bing.com", "google.com", "msn.com"
    )

    private val REPUTABLE_DOMAINS = setOf(
        "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com",
        "nytimes.com", "washingtonpost.com", "ft.com", "economist.com",
        "bloomberg.com", "wsj.com", "sky.com", "news.sky.com", "skysports.com",
        "thetimes.com", "thetimes.co.uk", "independent.co.uk", "telegraph.co.uk",
        "npr.org", "pbs.org", "cnn.com", "abcnews.go.com", "cbsnews.com",
        "nbcnews.com", "politico.com", "politico.eu", "axios.com", "forbes.com",
        "theverge.com", "techcrunch.com", "arstechnica.com", "wired.com",
        "nature.com", "science.org", "thelancet.com", "who.int", "un.org",
        "theathletic.com", "espn.com", "aljazeeera.com", "aljazeera.com",
        "dw.com", "france24.com", "thestandard.co.uk", "lbc.co.uk",
        "thehindu.com", "indianexpress.com", "ndtv.com", "en.wikipedia.org"
    )

    private val QUERY_STOP_WORDS = setOf(
        "what", "this", "that", "about", "news", "page", "article", "post",
        "posted", "who", "where", "when", "why", "how", "tell", "explain",
        "summary", "summarize", "latest", "video", "from", "with", "into",
        "does", "have", "been", "were", "they", "their", "there", "here",
        "just", "more", "some", "also", "very", "much", "make", "made",
        "said", "says", "over", "after", "before", "under", "between"
    )

    fun isBlockedDomain(domain: String): Boolean {
        val d = domain.lowercase(Locale.ROOT).removePrefix("www.")
        if (d.isBlank()) return true
        return BLOCKED_DOMAINS.any { blocked -> d == blocked || d.endsWith(".$blocked") }
    }

    fun isReputableDomain(domain: String): Boolean {
        val d = domain.lowercase(Locale.ROOT).removePrefix("www.")
        if (d.endsWith(".gov") || d.endsWith(".gov.uk") || d.endsWith(".edu") || d.endsWith(".ac.uk")) return true
        return REPUTABLE_DOMAINS.any { rep -> d == rep || d.endsWith(".$rep") }
    }

    fun cleanPublisherName(domain: String): String {
        val d = domain.lowercase(Locale.ROOT).removePrefix("www.")
        return when {
            d.contains("independent.co.uk") -> "The Independent"
            d.contains("thetimes.com") || d.contains("thetimes.co.uk") -> "The Times"
            d.contains("thestandard.co.uk") -> "The Standard"
            d.contains("theguardian.com") -> "The Guardian"
            d.contains("skysports.com") -> "Sky Sports"
            d.contains("sky.com") -> "Sky News"
            d.contains("bbc.com") || d.contains("bbc.co.uk") -> "BBC News"
            d.contains("nytimes.com") -> "NY Times"
            d.contains("washingtonpost.com") -> "Washington Post"
            d.contains("reuters.com") -> "Reuters"
            d.contains("apnews.com") -> "AP News"
            d.contains("bloomberg.com") -> "Bloomberg"
            d.contains("ft.com") -> "Financial Times"
            d.contains("economist.com") -> "The Economist"
            d.contains("wsj.com") -> "Wall Street Journal"
            d.contains("theathletic.com") -> "The Athletic"
            d.contains("telegraph.co.uk") -> "The Telegraph"
            d.contains("lbc.co.uk") -> "LBC"
            d.contains("npr.org") -> "NPR"
            d.contains("cnn.com") -> "CNN"
            d.contains("politico.") -> "Politico"
            d.contains("theverge.com") -> "The Verge"
            d.contains("techcrunch.com") -> "TechCrunch"
            d.contains("arstechnica.com") -> "Ars Technica"
            d.contains("wikipedia.org") -> "Wikipedia"
            d.contains("wikidata.org") -> "Wikidata"
            d.contains("yahoo.com") -> "Yahoo News"
            else -> {
                val parts = d.split(".")
                val secondLevel = setOf("co", "com", "org", "gov", "net", "ac", "edu")
                val root = if (parts.size >= 3 && secondLevel.contains(parts[parts.size - 2])) {
                    parts[parts.size - 3]
                } else if (parts.size >= 2) {
                    parts[parts.size - 2]
                } else {
                    d
                }
                root.replaceFirstChar { it.uppercase() }
            }
        }
    }

    /**
     * Aggregates intelligence across all sources in parallel, filtering out spam
     * and irrelevant hits while ranking reputable sources first.
     */
    suspend fun aggregate(
        query: String,
        pageTitle: String = "",
        pageHost: String = "",
        maxResults: Int = 6
    ): List<CorroboratedSource> = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) return@withContext emptyList()

        val isInternalPage = pageTitle.equals("Fokk", ignoreCase = true) ||
                pageTitle.equals("Fokk AI", ignoreCase = true) ||
                pageHost.contains("localhost") ||
                pageHost.contains("fokk") ||
                pageTitle.startsWith("New Tab", ignoreCase = true)

        // Extract meaningful topic keywords for relevance filtering (allow 3+ letter terms like gta, ai, war)
        val anchorText = if (pageTitle.isNotBlank() && !isInternalPage) "$pageTitle $cleanQuery" else cleanQuery
        val topicKeywords = anchorText.lowercase(Locale.ROOT)
            .split(Regex("[^a-z0-9]+"))
            .filter { it.length >= 3 && !QUERY_STOP_WORDS.contains(it) }
            .distinct()
            .take(12)

        coroutineScope {
            val newsDeferred = async { fetchGoogleNews(cleanQuery, max = 5) }
            val ddgDeferred = async { fetchDuckDuckGoHtml(cleanQuery, max = 6) }
            val wikiDeferred = async { fetchWikipedia(cleanQuery, max = 3) }
            val wikidataDeferred = async { fetchWikidata(cleanQuery, max = 1) }

            val newsResults = runCatching { newsDeferred.await() }.getOrDefault(emptyList())
            val ddgResults = runCatching { ddgDeferred.await() }.getOrDefault(emptyList())
            val wikiResults = runCatching { wikiDeferred.await() }.getOrDefault(emptyList())
            val wikidataResults = runCatching { wikidataDeferred.await() }.getOrDefault(emptyList())

            val candidates = mutableListOf<Pair<CorroboratedSource, Int>>()
            val seenUrls = mutableSetOf<String>()
            val seenDomains = mutableSetOf<String>()
            val normalizedPageHost = if (isInternalPage) "" else pageHost.lowercase(Locale.ROOT).removePrefix("www.")

            fun evaluateAndAdd(src: CorroboratedSource, baseScore: Int, strictRelevance: Boolean) {
                val normUrl = src.url.trim().lowercase(Locale.ROOT)
                val normDomain = src.domain.trim().lowercase(Locale.ROOT).removePrefix("www.")
                if (normUrl.isBlank() || seenUrls.contains(normUrl)) return
                if (normDomain == normalizedPageHost && normalizedPageHost.isNotBlank()) return
                if (isBlockedDomain(normDomain)) return
                if (seenDomains.contains(normDomain)) return

                val haystack = "${src.title} ${src.snippet}".lowercase(Locale.ROOT)
                val keywordHits = topicKeywords.count { kw -> haystack.contains(kw) }

                // Google News results are already query-targeted; don't discard if exact acronym didn't hit full text
                if (strictRelevance && topicKeywords.isNotEmpty() && src.sourceType != "NEWS") {
                    val hasHit = topicKeywords.any { kw -> haystack.contains(kw) }
                    if (!hasHit) return
                }

                var score = baseScore + (keywordHits * 10)
                if (isReputableDomain(normDomain)) score += 35
                if (src.sourceType == "NEWS") score += 20

                seenUrls.add(normUrl)
                seenDomains.add(normDomain)
                candidates.add(Pair(src, score))
            }

            newsResults.forEach { evaluateAndAdd(it, baseScore = 40, strictRelevance = true) }
            ddgResults.forEach { evaluateAndAdd(it, baseScore = 20, strictRelevance = true) }

            // Include Wikipedia/Wikidata when query matches topic
            wikiResults.forEach { w ->
                val haystack = "${w.title} ${w.snippet}".lowercase(Locale.ROOT)
                val hasHit = topicKeywords.isEmpty() || topicKeywords.any { kw -> haystack.contains(kw) }
                if (hasHit) {
                    evaluateAndAdd(w, baseScore = 30, strictRelevance = false)
                }
            }
            wikidataResults.forEach { wd ->
                val haystack = "${wd.title} ${wd.snippet}".lowercase(Locale.ROOT)
                val hasHit = topicKeywords.isEmpty() || topicKeywords.any { kw -> haystack.contains(kw) }
                if (hasHit) {
                    evaluateAndAdd(wd, baseScore = 15, strictRelevance = false)
                }
            }

            candidates
                .sortedByDescending { it.second }
                .map { it.first }
                .take(maxResults)
        }
    }

    /**
     * Fetches real-time headlines from Google News RSS feed.
     */
    fun fetchGoogleNews(query: String, max: Int = 4): List<CorroboratedSource> {
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

                    val domain = runCatching {
                        sourceMatch?.groupValues?.get(1)?.let { Uri.parse(it).host }
                    }.getOrNull()?.ifBlank { null }
                        ?: runCatching { Uri.parse(rawLink).host }.getOrNull()
                        ?: "news.google.com"

                    val cleanDomain = domain.removePrefix("www.")
                    if (isBlockedDomain(cleanDomain)) continue

                    val sourceName = cleanHtmlText(sourceMatch?.groupValues?.get(2).orEmpty()).ifBlank {
                        cleanPublisherName(cleanDomain)
                    }

                    val cleanTitle = cleanHtmlText(rawTitle)
                    if (cleanTitle.isNotBlank() && rawLink.isNotBlank()) {
                        val formattedDate = pubDate.take(16).trim()
                        val snippet = if (formattedDate.isNotBlank()) {
                            "$sourceName ($formattedDate)"
                        } else {
                            sourceName
                        }

                        results.add(
                            CorroboratedSource(
                                title = cleanTitle,
                                url = rawLink,
                                domain = cleanDomain,
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
     * Scrapes web results from DuckDuckGo HTML version with spam filtering.
     */
    fun fetchDuckDuckGoHtml(query: String, max: Int = 5): List<CorroboratedSource> {
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

                    if (cleanTitle.isNotBlank() && targetUrl.startsWith("http") && domain.isNotBlank() && !isBlockedDomain(domain)) {
                        val sourceType = if (isReputableDomain(domain) && !domain.contains("wikipedia")) "NEWS" else "WEB"
                        results.add(
                            CorroboratedSource(
                                title = cleanTitle,
                                url = targetUrl,
                                domain = domain,
                                snippet = cleanSnippet,
                                sourceType = sourceType
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
     * Fetches relevant, high-resolution verified photographs for key entities/topics
     * in the story via the free Wikipedia PageImages API (zero API key, zero cost).
     */
    suspend fun fetchVisualEvidence(
        entities: List<String>,
        fallbackTitle: String = "",
        max: Int = 5
    ): List<VisualEvidenceItem> = withContext(Dispatchers.IO) {
        val queries = entities
            .map { it.trim() }
            .filter { it.length in 3..60 }
            .distinctBy { it.lowercase(Locale.ROOT) }
            .take(5)
            .ifEmpty {
                val cleaned = fallbackTitle
                    .replace(Regex("""[^a-zA-Z0-9\s\-']"""), " ")
                    .split(Regex("\\s+"))
                    .filter { it.length >= 4 && !QUERY_STOP_WORDS.contains(it.lowercase(Locale.ROOT)) }
                    .take(4)
                    .joinToString(" ")
                if (cleaned.isNotBlank()) listOf(cleaned) else emptyList()
            }

        if (queries.isEmpty()) return@withContext emptyList()

        coroutineScope {
            val deferreds = queries.map { q ->
                async { fetchSingleWikipediaVisual(q) }
            }
            val seenImages = mutableSetOf<String>()
            val seenTitles = mutableSetOf<String>()
            val out = mutableListOf<VisualEvidenceItem>()
            for (d in deferreds) {
                val items = runCatching { d.await() }.getOrDefault(emptyList())
                for (item in items) {
                    val keyTitle = item.title.lowercase(Locale.ROOT)
                    if (seenImages.add(item.imageUrl) && seenTitles.add(keyTitle)) {
                        out.add(item)
                        if (out.size >= max) break
                    }
                }
                if (out.size >= max) break
            }
            out
        }
    }

    private fun fetchSingleWikipediaVisual(query: String): List<VisualEvidenceItem> {
        val results = mutableListOf<VisualEvidenceItem>()
        try {
            val encoded = Uri.encode(query)
            val apiUrl = "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=$encoded&gsrlimit=2&prop=pageimages|description&piprop=thumbnail&pithumbsize=480&format=json"
            val conn = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
                setRequestProperty("User-Agent", "FokkBrowser/2.8 (Android; Mobile)")
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
            }
            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val text = conn.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
                val pages = JSONObject(text).optJSONObject("query")?.optJSONObject("pages") ?: return results
                val keys = pages.keys()
                while (keys.hasNext()) {
                    val page = pages.optJSONObject(keys.next()) ?: continue
                    val title = page.optString("title", "").trim()
                    val desc = page.optString("description", "").trim()
                    val thumb = page.optJSONObject("thumbnail")?.optString("source", "").orEmpty().trim()
                    val lowerThumb = thumb.lowercase(Locale.ROOT)
                    if (title.isNotBlank() && thumb.startsWith("http") &&
                        !lowerThumb.endsWith(".svg") &&
                        !lowerThumb.contains("flag_of_") &&
                        !lowerThumb.contains("commons-logo") &&
                        !lowerThumb.contains("question_book") &&
                        !lowerThumb.contains("ambox")
                    ) {
                        val pageUrl = "https://en.wikipedia.org/wiki/" + Uri.encode(title.replace(' ', '_'))
                        results.add(
                            VisualEvidenceItem(
                                title = title,
                                caption = desc.ifBlank { "Verified encyclopedic context" },
                                imageUrl = thumb,
                                sourceUrl = pageUrl
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
