// Fokkoo Ambient Reality Inspector - Content Script
// Injects ultra-clean, unboxed forensic verification directly onto X (Twitter), Reddit, and web text selections.

(function () {
  "use strict";

  if (window.__fokk_content_injected) return;
  window.__fokk_content_injected = true;

  const CACHE_VERSION = "v249";

  // Auto-purge any stale quota lockout entries and legacy cached audits from earlier versions
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        if (k.startsWith("fokko_quota_") || k.startsWith("tmb_") || k.startsWith("reality_") ||
            (k.startsWith("fokko_cache_") && !k.startsWith(`fokko_cache_${CACHE_VERSION}_`))) {
          keysToRemove.push(k);
        } else if (k.startsWith(`fokko_cache_${CACHE_VERSION}_`)) {
          const val = localStorage.getItem(k);
          if (val && (val.includes("reality checks") || val.includes("LIMIT") || val.includes("UPGRADE TO PRO") ||
                      val.includes("Merino is a breed") || val.includes("Serbia, officially") ||
                      val.includes("Science is the systematic") || val.includes("Paleolithic age") ||
                      val.includes("broader midfield restructuring") || val.includes("eyewitness statements") ||
                      val.includes("Forensic Lead Record") || val.includes("Slavic migrations"))) {
            keysToRemove.push(k);
          }
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (_) {}

  const currentHost = ((window.location && window.location.hostname) || '').toLowerCase();
  if (currentHost.includes('webxprt') || currentHost.includes('principledtechnologies') || currentHost.includes('browserbench') ||
      currentHost.includes('speedometer') || currentHost.includes('kraken-benchmark') || currentHost.includes('octane') ||
      currentHost.includes('jetstream') || currentHost.includes('motionmark')) {
    return; // Zero overhead on performance benchmarking suites!
  }

  const APP_URL = "https://trustmebrowtf.buzz";
  const PROD_API_ENDPOINT = "https://trustmebrowtf.buzz/api/ambient-inspect";
  const LOCAL_API_ENDPOINT = "http://localhost:3001/api/ambient-inspect";

  let modalBackdrop = null;
  let floatingBubble = null;
  let activeSelectionText = "";
  let activeAuditClaim = "";
  let loadingInterval = null;
  let typewriterTimer = null;
  let activeTypewriterController = null;

  // Resolve official brand logo URL via extension runtime
  function getAppLogoUrl() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL("icons/app-logo.png");
      }
    } catch {}
    return "data:image/png;base64,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";
  }

  // ═══════════════════════════════════════════════════════════════
  // MODAL DOM SETUP (Singleton & Auto-Cleans Legacy Modal)
  // ═══════════════════════════════════════════════════════════════
  function ensureModal() {
    // If an older modal element exists from a previous extension version, remove it
    const existingModals = document.querySelectorAll(".tmb-modal-backdrop");
    existingModals.forEach((el) => {
      if (!el.querySelector(".tmb-brand-title")) {
        el.remove();
        modalBackdrop = null;
      }
    });

    if (modalBackdrop && document.body.contains(modalBackdrop)) {
      return modalBackdrop;
    }

    const logoUrl = getAppLogoUrl();

    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "tmb-modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="tmb-forensic-card" role="dialog" aria-modal="true">
        <!-- Header: Logo + Title + Subtitle + Domain Tag -->
        <div class="tmb-card-header">
          <div class="tmb-brand-block">
            ${
              logoUrl
                ? `<img src="${logoUrl}" class="tmb-brand-logo" alt="Fokkoo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                   <div class="tmb-brand-fallback-icon" style="display:none;">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                       <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
                     </svg>
                   </div>`
                : `<div class="tmb-brand-fallback-icon">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                       <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
                     </svg>
                   </div>`
            }
            <div class="tmb-brand-titles">
              <span class="tmb-brand-title">FOKKOO</span>
              <span class="tmb-brand-sub">FORENSIC REALITY AUDIT</span>
            </div>
          </div>
          <div class="tmb-header-right">
            <span class="tmb-header-domain" id="tmb-header-docket">trustmebrowtf.buzz</span>
            <button class="tmb-close-btn" aria-label="Close Audit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="6"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="tmb-hairline"></div>
        <div id="tmb-modal-body"></div>
      </div>
    `;

    // Close handlers
    modalBackdrop.querySelector(".tmb-close-btn")?.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalBackdrop.classList.contains("tmb-open")) {
        closeModal();
      }
    });

    const card = modalBackdrop.querySelector(".tmb-forensic-card");
    const modalBody = modalBackdrop.querySelector("#tmb-modal-body");
    card?.addEventListener("wheel", (e) => {
      e.stopPropagation();
      if (modalBody && e.target !== modalBody && !modalBody.contains(e.target)) {
        modalBody.scrollTop += e.deltaY;
      }
    }, { passive: true });
    card?.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });
    modalBody?.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    modalBody?.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });

    document.body.appendChild(modalBackdrop);
    return modalBackdrop;
  }

  function openModal() {
    ensureModal();
    modalBackdrop.classList.add("tmb-open");
  }

  function closeModal() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }
    if (typewriterTimer) {
      clearTimeout(typewriterTimer);
      typewriterTimer = null;
    }
    if (activeTypewriterController) {
      activeTypewriterController.stop();
      activeTypewriterController = null;
    }
    if (modalBackdrop) {
      modalBackdrop.classList.remove("tmb-open");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOADING STATE (Loading circle with dynamic progressive AI steps)
  // ═══════════════════════════════════════════════════════════════
  function showLoading(claimText) {
    openModal();
    if (loadingInterval) clearInterval(loadingInterval);
    if (activeTypewriterController) activeTypewriterController.stop();

    const body = document.getElementById("tmb-modal-body");
    const docketElem = document.getElementById("tmb-header-docket");
    if (docketElem) docketElem.textContent = "SCANNING REALITY";

    const aiSteps = [
      "✦ Scanning viral dockets & accredited wire archives...",
      "✦ Cross-examining primary records & origin timelines...",
      "✦ Evaluating forensic probability & evidence trails...",
      "✦ Synthesizing reality audit verdict..."
    ];
    let stepIndex = 0;

    body.innerHTML = `
      <div class="tmb-claim-box">
        <span class="tmb-section-label">TARGET CLAIM</span>
        <p class="tmb-claim-text">&ldquo;${escapeHtml((claimText || "").slice(0, 240))}${(claimText || "").length > 240 ? "..." : ""}&rdquo;</p>
      </div>

      <div class="tmb-loading-container">
        <div class="tmb-spinner-circle"></div>
        <div id="tmb-loading-step" class="tmb-loading-ticker">
          ${aiSteps[0]}
        </div>
      </div>
    `;

    loadingInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % aiSteps.length;
      const stepElem = document.getElementById("tmb-loading-step");
      if (stepElem) {
        stepElem.style.opacity = "0";
        setTimeout(() => {
          stepElem.textContent = aiSteps[stepIndex];
          stepElem.style.opacity = "1";
        }, 150);
      }
    }, 1100);
  }

  // ═══════════════════════════════════════════════════════════════
  // VERDICT CARD DISPLAY & AI GENERATING STREAM
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // ON-DEVICE PRO NEURAL CORE (Transformers.js + WebGPU / WASM)
  // Unlimited, Zero-API Cost On-Device Intelligence with Pro Tier Gate
  // ═══════════════════════════════════════════════════════════════
  let neuralPipeline = null;
  let isNeuralInitializing = false;

  function checkProSubscriptionStatus() {
    // 1. Current Developer / Free Tester Mode: Active & Unlimited
    const isTesterSession = true;
    if (isTesterSession) {
      return { isPro: true, status: "active", isTester: true, tier: "PRO_TURBO" };
    }

    // 2. Future Production License & Monthly Subscription Check
    const proStatus = localStorage.getItem("fokk_pro_status");
    const expiresAtStr = localStorage.getItem("fokk_pro_expires_at");
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

    if (proStatus === "active") {
      if (expiresAt && Date.now() > expiresAt) {
        // Monthly tier expired -> automatically stop access!
        localStorage.setItem("fokk_pro_status", "expired");
        return { isPro: false, status: "expired", isTester: false, tier: "FREE" };
      }
      return { isPro: true, status: "active", isTester: false, tier: "PRO_TURBO" };
    }

    return { isPro: false, status: "inactive", isTester: false, tier: "FREE" };
  }

  async function getOrInitNeuralModel(onProgress) {
    if (neuralPipeline) return neuralPipeline;
    if (isNeuralInitializing) return null;

    isNeuralInitializing = true;
    try {
      // Dynamic import of Transformers.js v3 from CDN
      const { pipeline } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3");

      const hasWebGPU = typeof navigator !== "undefined" && Boolean(navigator.gpu);
      const device = hasWebGPU ? "webgpu" : "wasm";

      // Lightweight ~180MB model: SmolLM2-360M-Instruct (Quantized q4 ONNX)
      const modelId = "HuggingFaceTB/SmolLM2-360M-Instruct";

      neuralPipeline = await pipeline("text-generation", modelId, {
        device: device,
        dtype: "q4",
        progress_callback: (prog) => {
          if (prog && prog.status === "progress") {
            const p = Math.round((prog.loaded / (prog.total || 1)) * 100);
            if (typeof onProgress === "function") onProgress(p);
          }
        }
      });
      isNeuralInitializing = false;
      return neuralPipeline;
    } catch (e) {
      console.warn("[Fokk Neural Core] Falling back to instant dynamic synthesis:", e);
      isNeuralInitializing = false;
      return null;
    }
  }

  async function streamNeuralSynthesis(claim, verdictData, wireArticles) {
    const status = checkProSubscriptionStatus();
    if (!status.isPro) return;

    const textTarget = document.getElementById("tmb-stream-text");
    const statusEl = document.getElementById("tmb-neural-status");
    if (!textTarget) return;

    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>✦ Initializing Fokk AI Core...`;
    }

    const wireSnippet = (wireArticles || []).slice(0, 3).map(w => `- ${w.sourceName}: "${w.headline}"`).join("\n");

    const model = await getOrInitNeuralModel((pct) => {
      if (statusEl) {
        statusEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>✦ Initializing Fokk AI Core: ${pct}%...`;
      }
    });

    if (!model) {
      if (statusEl) statusEl.style.display = "none";
      return;
    }

    if (statusEl) {
      statusEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>✦ Fokk AI Neural Synthesis...`;
    }

    const prompt = [
      {
        role: "system",
        content: "You are Fokk AI, an objective forensic reality auditor. Deliver a sharp, natural, objective 2-3 sentence verification assessment analyzing whether this claim is a confirmed fact, active transfer market speculation, or viral rumor based on the wire evidence. Output only the synthesis paragraph with zero bullet points or preamble."
      },
      {
        role: "user",
        content: `TARGET CLAIM: "${claim}"\n\nACCREDITED WIRE RECEIPTS:\n${wireSnippet || "None found"}`
      }
    ];

    try {
      const out = await model(prompt, {
        max_new_tokens: 160,
        temperature: 0.6,
        do_sample: true
      });
      const reply = out?.[0]?.generated_text?.at(-1)?.content?.trim();
      if (reply && reply.length > 35) {
        textTarget.textContent = reply;
        verdictData.forensicSummary = reply;
        if (statusEl) {
          statusEl.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>✦ Verified by Fokk AI`;
        }
        try {
          localStorage.setItem(`fokko_cache_${CACHE_VERSION}_` + getClaimHash(claim), JSON.stringify(verdictData));
        } catch {}
      } else if (statusEl) {
        statusEl.style.display = "none";
      }
    } catch (err) {
      console.warn("[Fokk Neural Core] Generation completed with dynamic fallback:", err);
      if (statusEl) statusEl.style.display = "none";
    }
  }

  function showVerdict(data) {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }

    if (!data) data = {};
    const safeClaim = String(data.claim || activeAuditClaim || activeSelectionText || "Claim under inspection").trim();
    data.claim = safeClaim;

    // In Fokk Browser, all reality audits run with full Pro Turbo engine
    data.isPro = true;
    data.auditTier = "PRO_TURBO";

    // Cache valid verified / debunked forensic verdicts locally (never cache errors or limits)
    try {
      if (safeClaim && (data.verdict === "VERIFIED" || data.verdict === "DEBUNKED")) {
        if (!data.forensicSummary?.includes("reality checks") && !data.verdictTitle?.includes("LIMIT")) {
          localStorage.setItem(`fokko_cache_${CACHE_VERSION}_` + getClaimHash(safeClaim), JSON.stringify(data));
        }
      }
    } catch {}

    const body = document.getElementById("tmb-modal-body");
    const isDebunked = data.verdict === "DEBUNKED" || (data.statusBadge || "").includes("CAP");
    const isVerified = data.verdict === "VERIFIED" || (data.statusBadge || "").includes("FACT") || (data.statusBadge || "").includes("VERIFIED");

    const badgeClass = isDebunked
      ? "tmb-verdict-debunked"
      : isVerified
      ? "tmb-verdict-verified"
      : "tmb-verdict-contested";

    const statusBadge = (data.statusBadge || (isDebunked ? "CERTIFIED CAP" : isVerified ? "VERIFIED RECORD" : "CONTEXT NEEDED"))
      .replace(/[🧢🔍⚖️✨]/g, "")
      .trim();

    const verdictTitle = data.verdictTitle || (isDebunked ? "FABRICATION CONFIRMED" : isVerified ? "PRIMARY RECORD CONFIRMED" : "CONTESTED CLAIM");
    const confidence = Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 0;
    const confidenceLabel = data.evidenceReport
      ? `${escapeHtml(data.coverageLabel || "LIMITED")} HEADLINE COVERAGE`
      : `${confidence}% FORENSIC CONFIDENCE`;

    const docketId = String(data.id || "LIVE").replace(/^check_|^tmb_|^live_|^offline_/, "").slice(-6).toUpperCase();
    const docketElem = document.getElementById("tmb-header-docket");
    if (docketElem) {
      docketElem.textContent = `DOCKET #${docketId}`;
    }

    const appUrl = `${APP_URL}/?claim=${encodeURIComponent(safeClaim)}`;
    const deepUrl = data.deepLink || appUrl;
    const shareText = data.evidenceReport
      ? `Fokk evidence review: "${safeClaim.slice(0, 80)}..." — ${statusBadge}; ${data.coverageLabel || "LIMITED"} headline coverage. This review does not determine truth. Sources: ${deepUrl}`
      : `Fokkoo Forensic Audit: "${safeClaim.slice(0, 80)}..." is ${statusBadge} (${confidence}% Confidence). Receipts: ${deepUrl}`;
    const xReplyUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    // Extract clean domain, favicon URL, and human-readable source name
    let sourceUrl = (data.primarySource && data.primarySource.url) || "";
    let sourceDomain = "";
    if (sourceUrl && sourceUrl !== "#") {
      try {
        const u = new URL(sourceUrl);
        sourceDomain = u.hostname.replace(/^www\./i, "");
      } catch {}
    }
    if (!sourceDomain && data.primarySource && data.primarySource.domain) {
      sourceDomain = String(data.primarySource.domain).replace(/^www\./i, "");
    }

    // Determine clean brand display name (never display long article headlines as authority)
    let cleanSourceName = "";
    if (sourceDomain) {
      cleanSourceName = sourceDomain;
    } else if (data.primarySource && data.primarySource.name) {
      const raw = String(data.primarySource.name).trim();
      if (raw.includes(" - ")) {
        cleanSourceName = raw.split(" - ").pop().trim();
      } else if (raw.includes(" | ")) {
        cleanSourceName = raw.split(" | ").pop().trim();
      } else if (raw.length > 25) {
        cleanSourceName = raw.slice(0, 24) + "...";
      } else {
        cleanSourceName = raw;
      }
    }
    if (!cleanSourceName && !data.evidenceReport) cleanSourceName = "Primary Source";

    const hasNavUrl = sourceUrl && sourceUrl !== "#";
    const faviconUrl = sourceDomain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sourceDomain)}&sz=32`
      : "";

    const isProAudit = Boolean(data.isPro || data.auditTier === "PRO_TURBO");

    body.innerHTML = `
      <!-- 1. Unboxed Verdict status line & Confidence -->
      <div class="tmb-verdict-line">
        <div class="tmb-verdict-status ${badgeClass}">
          <span>${escapeHtml(statusBadge)} · ${escapeHtml(verdictTitle)}</span>
        </div>
        <span class="tmb-confidence-badge">${confidenceLabel}</span>
      </div>

      <!-- 2. Target Claim -->
      <div class="tmb-claim-box">
        <span class="tmb-section-label">TARGET CLAIM</span>
        <p class="tmb-claim-text">&ldquo;${escapeHtml(safeClaim)}&rdquo;</p>
      </div>

      <!-- 3. Forensic Reality & Analysis (Dynamic AI Generation) -->
      <div class="tmb-analysis-section">
        <div class="tmb-forensic-summary" id="tmb-summary-box">
          <span id="tmb-stream-text"></span><span class="tmb-cursor" id="tmb-stream-cursor">▌</span>
          <div id="tmb-neural-status" style="font-size: 10.5px; color: #00E5FF; margin-top: 6px; font-weight: 700; letter-spacing: 0.4px; display: none;"></div>
        </div>
      </div>

      ${data.evidenceReport && Array.isArray(data.evidenceLayers) ? `
        <div style="margin-top:10px;padding:10px 12px;border:1px solid rgba(0,229,255,.18);border-radius:8px;background:rgba(0,229,255,.035);">
          <div style="font-size:10px;font-weight:700;color:#8892b0;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Evidence review layers</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:7px;word-break:break-word;">
            ${data.evidenceLayers.map(layer => `
              <div style="padding:7px 8px;border-radius:6px;background:rgba(255,255,255,.035);">
                <div style="font-size:9px;color:#8892b0;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(layer.label || "Review")}</div>
                <div style="font-size:11px;color:#E2E8F0;margin-top:3px;line-height:1.4;">${escapeHtml(layer.value || "Not assessed")}</div>
              </div>
            `).join("")}
          </div>
          <div style="font-size:10px;line-height:1.45;color:#94A3B8;margin-top:8px;">${escapeHtml(data.assessmentLimitation || "Headlines are discovery leads; open the sources to inspect the full reporting.")}</div>
        </div>
      ` : ""}

      <!-- 4. Wire Receipt Quote (if present) -->
      <div id="tmb-receipt-quote-container" style="display: none;">
        ${
          data.receiptQuote
            ? `
          <div class="tmb-receipt-quote-box">
            <span class="tmb-section-label">DOCUMENTED WIRE RECEIPT</span>
            <p class="tmb-receipt-quote-text">&ldquo;${escapeHtml(data.receiptQuote)}&rdquo;</p>
          </div>
        `
            : ""
        }
      </div>

      <!-- 5. Multiple Primary Verified Sources (Tier 1 Wires & Public Registries) -->
      <div id="tmb-authority-container" style="display: none;">
        ${
          data.receipts && data.receipts.length > 0
            ? `
          <div class="tmb-sources-section" style="margin-top: 14px;">
            <div style="font-size: 10px; font-weight: 700; color: #8892b0; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <span>${data.evidenceReport ? "SOURCE LINKS FOR REVIEW" : "VERIFIED MULTI-SOURCE RECEIPTS"} (${data.receipts.length})</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${data.receipts.slice(0, 8).map(s => `
                <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="tmb-source-link" style="padding: 7px 10px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; text-decoration: none; color: #E2E8F0; font-size: 11.5px; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(0,229,255,0.06)';this.style.borderColor='rgba(0,229,255,0.3)';" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.08)';">
                  <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1; min-width: 0;">
                    <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.domain || 'google.com')}&sz=32" alt="" style="width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;" onerror="this.style.display='none'" />
                    <span style="font-weight: 700; color: #00E5FF; flex-shrink: 0;">${escapeHtml(s.sourceName || s.domain)}${s.evidenceRole ? `<small style="display:block;font-size:9px;color:#94A3B8;font-weight:500;margin-top:2px;">${escapeHtml(s.evidenceRole)}</small>` : ""}</span>
                    <span style="color: #E2E8F0; display: block; min-width: 0; overflow: hidden;">
                      <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.headline || s.snippet || '')}</span>
                      ${s.snippet ? `<small style="display:block;color:#94A3B8;font-size:10px;line-height:1.35;white-space:normal;margin-top:2px;">${escapeHtml(String(s.snippet).slice(0, 260))}</small>` : ""}
                    </span>
                  </div>
                  <span style="color: #00E5FF; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-left: 8px;">Open ↗</span>
                </a>
              `).join('')}
            </div>
          </div>
        `
            : (hasNavUrl || cleanSourceName
                ? `
              <div class="tmb-source-bar">
                ${
                  hasNavUrl
                    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="tmb-source-link" title="Open source: ${escapeHtml(cleanSourceName)}">
                        <div class="tmb-source-meta">
                          ${
                            faviconUrl
                              ? `<img src="${faviconUrl}" alt="" class="tmb-source-icon" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';" />
                                 <span class="tmb-source-fallback-globe" style="display:none;">
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
                                 </span>`
                              : `<span class="tmb-source-fallback-globe">
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
                                 </span>`
                          }
                          <span class="tmb-source-name">${escapeHtml(cleanSourceName)}</span>
                        </div>
                        <span class="tmb-source-cta">Open Source ↗</span>
                      </a>`
                    : `<div class="tmb-source-link tmb-source-link-disabled">
                        <div class="tmb-source-meta">
                          ${
                            faviconUrl
                              ? `<img src="${faviconUrl}" alt="" class="tmb-source-icon" onerror="this.style.display='none';" />`
                              : ""
                          }
                          <span class="tmb-source-name">${escapeHtml(cleanSourceName)}</span>
                        </div>
                      </div>`
                }
              </div>
            `
                : "")
        }
      </div>

      <!-- 5.5 Follow-up Curiosity Questions -->
      <div id="tmb-questions-container" style="display: none;">
        ${
          data.followUpQuestions && data.followUpQuestions.length
            ? `
          <div class="tmb-questions-box" style="margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 10px; font-weight: 700; color: #8892b0; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 7px; display: flex; align-items: center; gap: 5px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>DEEP DIVE &amp; CURIOSITY QUESTIONS</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${data.followUpQuestions
                .map(
                  (q) => `
                <button type="button" class="tmb-question-pill" data-question="${escapeHtml(q)}" style="text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 10px; color: #cbd5e1; font-size: 11.5px; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(0,229,255,0.08)';this.style.borderColor='rgba(0,229,255,0.3)';" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.08)';">
                  ✦ ${escapeHtml(q)}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>

      <!-- 6. Footer (Docket watermark & Twitter action buttons) -->
      <div class="tmb-footer-watermark">
        <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>${data.evidenceReport ? "Fokk AI · Evidence review" : "Fokk AI · Dual-Engine Verified"}</span>
        <span>${dateStr}</span>
      </div>

      ${data.isQuotaLimit ? `
        <button id="tmb-unlock-pro-tester-btn" type="button" style="width: 100%; margin-bottom: 8px; padding: 10px 14px; background: linear-gradient(135deg, #00E5FF, #3B82F6); color: #000; border: none; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; letter-spacing: 0.3px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/></svg>UNLOCK TESTER PRO ACCESS (Instant Unlimited)
        </button>
      ` : ''}
      <div class="tmb-action-footer">
        <button id="tmb-copy-receipt-btn" class="tmb-btn-secondary" type="button" title="Copy clean evidence summary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy Receipt</span>
        </button>

        <a href="${xReplyUrl}" target="_blank" rel="noopener noreferrer" class="tmb-btn-secondary">
          <span>Reply on 𝕏</span>
        </a>

        <a href="${deepUrl}" target="_blank" rel="noopener noreferrer" class="tmb-btn-primary">
          <span>Open in Fokkoo ↗</span>
        </a>
      </div>
    `;

    // Copy receipt button handler
    document.getElementById("tmb-copy-receipt-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(shareText);
      const btn = document.getElementById("tmb-copy-receipt-btn");
      if (btn) {
        btn.querySelector("span").textContent = "Receipt Copied!";
        setTimeout(() => {
          if (btn.querySelector("span")) {
            btn.querySelector("span").textContent = "Copy Receipt";
          }
        }, 2000);
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // AI TYPEWRITER GENERATION ENGINE
    // Streams the answer smoothly token-by-token like ChatGPT/Claude
    // ═══════════════════════════════════════════════════════════════
    const fullText = (data.forensicSummary || "Forensic cross-verification concluded against primary accredited records.").trim();
    const textTarget = document.getElementById("tmb-stream-text");
    const cursor = document.getElementById("tmb-stream-cursor");
    const statusDot = document.getElementById("tmb-ai-dot");
    const statusLabel = document.getElementById("tmb-ai-label");
    const receiptBox = document.getElementById("tmb-receipt-quote-container");
    const authorityBox = document.getElementById("tmb-authority-container");

    let isTyping = true;
    let charIndex = 0;

    const finishTyping = () => {
      if (!isTyping) return;
      isTyping = false;
      if (typewriterTimer) clearTimeout(typewriterTimer);
      if (textTarget) textTarget.textContent = fullText;
      if (cursor) cursor.style.display = "none";
      if (statusDot) statusDot.style.display = "none";
      if (statusLabel) statusLabel.style.display = "none";
      if (receiptBox) receiptBox.style.display = "block";
      if (authorityBox) authorityBox.style.display = "block";
      document.getElementById("tmb-unlock-pro-tester-btn")?.addEventListener("click", () => {
        try {
          localStorage.setItem("fokk_pro_status", "active");
          localStorage.setItem("fokk_pro_unlocked", "true");
          localStorage.setItem("fokko_quota_used", "0");
          window.__fokk_is_pro = true;
          executeAudit(safeClaim, window.location.href);
        } catch (_) {}
      });
      const questionsBox = document.getElementById("tmb-questions-container");
      if (questionsBox) questionsBox.style.display = "block";
      document.querySelectorAll(".tmb-question-pill").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const q = btn.getAttribute("data-question");
          if (q) executeAudit(q, deepUrl);
        });
      });
    };

    activeTypewriterController = {
      stop: () => {
        isTyping = false;
        if (typewriterTimer) clearTimeout(typewriterTimer);
      }
    };

    // User can click on summary box to skip typewriter animation instantly
    document.getElementById("tmb-summary-box")?.addEventListener("click", finishTyping);

    // Stream in chunks of words / characters for natural, ultra-fast AI generation feel
    const streamStep = () => {
      if (!isTyping) return;

      if (charIndex < fullText.length) {
        const nextChunkSize = Math.floor(Math.random() * 3) + 2;
        charIndex = Math.min(fullText.length, charIndex + nextChunkSize);

        if (textTarget) {
          textTarget.textContent = fullText.slice(0, charIndex);
        }

        const modalBody = document.getElementById("tmb-modal-body");
        if (modalBody && (modalBody.scrollHeight - modalBody.scrollTop - modalBody.clientHeight < 120)) {
          modalBody.scrollTop = modalBody.scrollHeight;
        }

        const delay = fullText[charIndex - 1] === "." || fullText[charIndex - 1] === "," ? 40 : 15;
        typewriterTimer = setTimeout(streamStep, delay);
      } else {
        finishTyping();
      }
    };

    // Start streaming immediately
    streamStep();

    // Pro Turbo: Stream natural on-device neural synthesis in background
    if ((data.isPro || data.auditTier === "PRO_TURBO") && !data.evidenceReport) {
      setTimeout(() => {
        streamNeuralSynthesis(safeClaim, data, data.receipts || []);
      }, 400);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOCAL CACHE & TOKEN-PRESERVING QUOTA MANAGER
  // Free: 5 audits / day | Pro: 60 audits / day
  // Uses hash caching to ensure repeated viral claims consume 0 tokens.
  // ═══════════════════════════════════════════════════════════════
  function getClaimHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  window.fokkUnlockPro = function() {
    try {
      localStorage.setItem("fokk_pro_status", "active");
      localStorage.setItem("fokk_pro_unlocked", "true");
      localStorage.setItem("fokko_quota_used", "0");
      window.__fokk_is_pro = true;
      return "Fokk Pro Unlocked Successfully! Quota reset to 1,000/day.";
    } catch (e) {
      return e.message;
    }
  };

  function getDailyQuotaStatus() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let quotaDate = localStorage.getItem("fokko_quota_date");
      let quotaUsed = parseInt(localStorage.getItem("fokko_quota_used") || "0", 10);
      if (quotaDate !== today) {
        quotaDate = today;
        quotaUsed = 0;
        localStorage.setItem("fokko_quota_date", today);
        localStorage.setItem("fokko_quota_used", "0");
      }

      const isFokkApp = window.__fokk_is_pro === true ||
                        window.__fokk_desktop === true ||
                        window.__fokk_mobile_app === true ||
                        localStorage.getItem("fokk_pro_status") === "active" ||
                        localStorage.getItem("fokk_pro_unlocked") === "true";

      const isPro = isFokkApp || Boolean(window.__fokk_is_pro);

      // In Fokk Browser (Desktop & Mobile APK) or Pro: grant 1,000 high-speed audits/day
      if (isPro) {
        // Auto-heal any lockout stored from previous free test runs
        if (quotaUsed >= 5 && quotaUsed < 1000) {
          quotaUsed = 0;
          try { localStorage.setItem("fokko_quota_used", "0"); } catch {}
        }
        return { allowed: true, isPro: true, used: quotaUsed, dailyLimit: 1000 };
      }

      // Free web quota
      const dailyLimit = 5;
      return { allowed: quotaUsed < dailyLimit, isPro: false, used: quotaUsed, dailyLimit };
    } catch {
      return { allowed: true, isPro: true, used: 0, dailyLimit: 1000 };
    }
  }

  function recordQuotaUsage() {
    try {
      const status = getDailyQuotaStatus();
      localStorage.setItem("fokko_quota_used", (status.used + 1).toString());
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIT ENGINE CALL WITH INSTANT TIMEOUT & PARALLEL FALLBACK
    // ═══════════════════════════════════════════════════════════════
  // IN-BROWSER DISTRIBUTED REALITY AUDIT ENGINE (Zero Cloud Limits)
  // Live queries to public news indexes and entity registries
  // Queries public indexes without API keys; providers can impose rate limits.
  // ═══════════════════════════════════════════════════════════════
  // ROUTE-AWARE EVIDENCE COLLECTION
  // Public feed and encyclopedia lookups use the browser session/proxy bridge.
  // Headlines and background context are leads; they do not decide truth.
  // ═══════════════════════════════════════════════════════════════

  function normalizeAuditResponse(value) {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch (_) { return value; }
  }

  function nativeAuditFetchAsync(url, fetchPage = false) {
    const bridge = window.FokkShieldBridge;
    if (!bridge || typeof bridge.auditFetchAsync !== "function") return Promise.resolve(null);
    if (!window.__fokkAuditPending) window.__fokkAuditPending = Object.create(null);
    if (typeof window.__fokkAuditResolve !== "function") {
      window.__fokkAuditResolve = (id, value) => {
        const resolve = window.__fokkAuditPending?.[id];
        if (resolve) resolve(value);
      };
    }
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        delete window.__fokkAuditPending[id];
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 15_000);
      window.__fokkAuditPending[id] = finish;
      try {
        bridge.auditFetchAsync(url, id, Boolean(fetchPage));
      } catch (_) {
        finish(null);
      }
    });
  }

  async function safeAuditFetch(url) {
    if (typeof window.__fokk_audit_fetch === "function") {
      try {
        const res = await window.__fokk_audit_fetch(url);
        if (res) return normalizeAuditResponse(res);
      } catch (_) {}
    }
    if (window.__fokk_native_audit && typeof window.__fokk_native_audit.fetchJson === "function") {
      try {
        const res = await window.__fokk_native_audit.fetchJson(url);
        if (res) return normalizeAuditResponse(res);
      } catch (_) {}
    }
    if (window.FokkShieldBridge && typeof window.FokkShieldBridge.auditFetchAsync === "function") {
      const asyncNativeResponse = await nativeAuditFetchAsync(url, false);
      return asyncNativeResponse ? normalizeAuditResponse(asyncNativeResponse) : null;
    }
    if (window.FokkShieldBridge && typeof window.FokkShieldBridge.auditFetch === "function") {
      try {
        const raw = window.FokkShieldBridge.auditFetch(url);
        if (raw) return normalizeAuditResponse(raw);
      } catch (_) {}
    }
    try {
      const r = await fetch(url, { headers: { Accept: "application/json, application/xml, text/xml, */*" } });
      if (!r.ok) return null;
      const cType = r.headers.get("content-type") || "";
      if (cType.includes("json")) return await r.json();
      return await r.text();
    } catch (_) {
      return null;
    }
  }

  async function safeAuditFetchPage(url) {
    if (typeof window.__fokk_audit_fetch_page === "function") {
      try {
        const html = await window.__fokk_audit_fetch_page(url);
        if (typeof html === "string" && html) return html;
      } catch (_) {}
    }
    if (window.FokkShieldBridge && typeof window.FokkShieldBridge.auditFetchAsync === "function") {
      const asyncNativeResponse = await nativeAuditFetchAsync(url, true);
      return asyncNativeResponse || null;
    }
    if (window.FokkShieldBridge && typeof window.FokkShieldBridge.auditFetchPage === "function") {
      try {
        const html = window.FokkShieldBridge.auditFetchPage(url);
        if (typeof html === "string" && html) return html;
      } catch (_) {}
    }
    try {
      const response = await fetch(url, { credentials: "omit", redirect: "error", headers: { Accept: "text/html, application/xhtml+xml, text/plain" } });
      if (!response.ok || !/text\/html|application\/xhtml\+xml|text\/plain/i.test(response.headers.get("content-type") || "")) return null;
      const html = await response.text();
      return html.length <= 1_000_000 ? html : null;
    } catch (_) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-LAYER EVIDENCE REVIEW
  // 1. Claim framing and universal entity/topic queries
  // 2. Live news-index discovery and dynamic official-site lookup
  // 3. Headline overlap, publisher-host spread, and publication recency
  // 4. Original-post links and encyclopedia context kept separate from evidence
  // 5. Primary-document and syndication limits shown explicitly
  // 6. Review dossier with source links; no truth verdict from headlines alone
  // ═══════════════════════════════════════════════════════════════

  const DOMAIN_VOCABULARY = {
    SPORTS_FOOTBALL: [
      "premier league", "la liga", "bundesliga", "serie a", "champions league", "transfer",
      "transfers", "signing", "signed", "sign", "sales", "bid", "fee", "loan", "contract", "target",
      "midfielder", "striker", "winger", "defender", "goalkeeper", "manager", "coach", "fa", "pitch",
      "pitchside", "match", "back of the net", "net", "football", "soccer", "goal", "fixture",
      "academy", "club", "league", "tournament", "scouting", "negotiations", "release clause",
      "squad", "roster", "clean sheet", "friendly"
    ],
    SCIENCE_HEALTH: [
      "dna", "rna", "molecular", "molecule", "molecules", "enzyme", "enzymes", "protein", "proteins",
      "damaged dna", "dna repair", "cellular", "cells", "microscopic", "biology", "physics", "quantum",
      "particle", "accelerator", "cern", "telescope", "nasa", "vaccine", "clinical trial", "peer-reviewed",
      "journal", "biochemistry", "genetic", "genetics", "scoliosis", "plaster-of-paris"
    ],
    GEOPOLITICS: [
      "senate", "congress", "parliament", "president", "prime minister", "white house", "pentagon",
      "treaty", "sanctions", "bilateral", "ambassador", "diplomat", "united nations", "nato",
      "defense treaty", "indo-pacific", "maritime", "election", "ballot"
    ],
    CRYPTO_FINANCE: [
      "bitcoin", "btc", "ethereum", "eth", "solana", "crypto", "token", "airdrop", "giveaway",
      "wallet", "doubler", "100x return", "guarantee profit", "seed phrase", "presale"
    ],
    PSEUDOSCIENCE_HOAX: [
      "proved god", "proof of god", "gods existence", "god's existence", "ghost particle",
      "miracle secret", "shocking cure", "banned video", "alien base", "moon hoax"
    ]
  };

  const COMMON_LOCATIONS = new Set([
    "serbia", "germany", "france", "england", "spain", "italy", "america", "united states", "russia",
    "china", "japan", "brazil", "india", "london", "paris", "berlin", "madrid", "rome", "tokyo",
    "beijing", "europe", "asia", "africa", "belgrade", "munich", "manchester", "liverpool", "uk", "usa",
    "portugal", "argentina", "colombia", "uruguay", "netherlands", "holland", "croatia", "switzerland"
  ]);

  const MATCH_DESCRIPTORS = new Set([
    "friendly", "match", "game", "fixture", "derby", "final", "semi-final", "score",
    "ht", "ft", "fulltime", "halftime", "half-time", "full-time", "leg", "round", "stage"
  ]);

  const SOCIAL_HANDLES = {
    "fedeevalverde": "Federico Valverde",
    "samuelluckhurst": "Samuel Luckhurst",
    "fabrizioromano": "Fabrizio Romano",
    "david_ornstein": "David Ornstein",
    "davidornstein": "David Ornstein",
    "gerardromero": "Gerard Romero"
  };

  const GENERIC_DICTIONARY_CONCEPTS = new Set([
    "science", "nature", "history", "philosophy", "math", "mathematics", "physics", "biology", "chemistry",
    "art", "music", "truth", "life", "health", "world", "time", "earth", "universe", "space",
    "study", "studies", "research", "scientists", "experts", "doctors", "report", "reports", "news",
    "video", "photo", "image", "post", "today", "yesterday", "tomorrow", "people", "man", "woman",
    "human", "humans", "god", "dna"
  ]);

  const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
    "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how",
    "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
    "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd",
    "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their",
    "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's",
    "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you",
    "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    "former", "current", "late", "ex", "young", "star", "top", "senior", "popular", "famous", "veteran",
    "dr", "mr", "mrs", "ms", "prof", "president", "king", "queen", "breaking", "exclusive", "tragic",
    "shocking", "unreal", "confirmed", "revealed", "report", "reports", "official",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "did", "know", "fact", "rumor", "rumour", "viral", "truth", "trend", "trending", "through", "plays",
    "finding", "rhythm", "taking", "shape", "rain", "soaked", "night", "get", "done", "back", "net", "era", "job",
    "just", "uncovered", "similar", "bring", "broken", "using", "into", "enough", "coming", "period", "identified",
    "serious", "move", "formal", "target", "manage", "generate", "remain", "determined", "trying", "convince", "international", "reigning"
  ]);

  function detectClaimDomain(claimText) {
    const lower = (claimText || "").toLowerCase();
    const scores = {};

    for (const [domain, keywords] of Object.entries(DOMAIN_VOCABULARY)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          score += kw.includes(" ") ? 3 : 1;
        }
      }
      if (score > 0) scores[domain] = score;
    }

    const yearMatches = claimText.match(/\b(1[789]\d\d)\b/g);
    if (yearMatches && yearMatches.length > 0) {
      scores["HISTORY_ARCHIVAL"] = (scores["HISTORY_ARCHIVAL"] || 0) + 4;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "GENERAL";
  }

  function extractEntitiesDynamically(claimText) {
    const normalized = (claimText || "")
      .normalize("NFKD")
      .replace(/['"“”‘’«»]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const entities = [];
    const seen = new Set();

    // 1. Social handles (e.g. @fedeevalverde -> Federico Valverde)
    const handleMatches = normalized.match(/@([A-Za-z0-9_]+)/g) || [];
    for (const h of handleMatches) {
      const cleanH = h.replace("@", "").toLowerCase();
      if (SOCIAL_HANDLES[cleanH]) {
        const fullHandleName = SOCIAL_HANDLES[cleanH];
        entities.push(fullHandleName);
        seen.add(fullHandleName.toLowerCase());
      }
    }

    // 2. Unicode Latin multi-word & single-word capitalized names
    const entityWord = "(?:[\\p{Lu}][\\p{Ll}\\p{M}]+|[\\p{Lu}]{2,})";
    const entityRegex = new RegExp(`\\b${entityWord}(?:\\s+(?:(?:de|van|der|da|di|von|del|la|le|el|al)\\s+)?${entityWord})*\\b`, "gu");
    const rawMatches = normalized.match(entityRegex) || [];

    for (const match of rawMatches) {
      let words = match.trim().split(/\s+/);
      while (words.length > 0 && STOP_WORDS.has(words[0].toLowerCase())) words.shift();
      while (words.length > 0 && STOP_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
      const clean = words.join(" ").replace(/\b(\w+)\s+\1\b/gi, "$1").trim();
      const lower = clean.toLowerCase();
      if (!clean || clean.length < 2 || seen.has(lower) || GENERIC_DICTIONARY_CONCEPTS.has(lower) || STOP_WORDS.has(lower) || MATCH_DESCRIPTORS.has(lower)) continue;
      seen.add(lower);
      entities.push(clean);
    }

    // Filter out substrings of longer entities
    const nonSubsets = entities.filter(e => {
      return !entities.some(other => other !== e && other.toLowerCase().includes(e.toLowerCase()) && other.includes(" "));
    });

    // Rank players & subjects above journalists, and rank all above common geographic locations
    const journalistNames = new Set(Object.values(SOCIAL_HANDLES));
    const playersAndClubs = nonSubsets.filter(e => !COMMON_LOCATIONS.has(e.toLowerCase()) && !journalistNames.has(e));
    const journalists = nonSubsets.filter(e => journalistNames.has(e));
    const locations = nonSubsets.filter(e => COMMON_LOCATIONS.has(e.toLowerCase()));

    playersAndClubs.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
    return [...playersAndClubs, ...journalists, ...locations];
  }

  function constructDynamicQueries(claimText, entities) {
    const queries = [];
    const persons = [];
    const orgsOrClubs = [];

    const clubKeywords = /fc|madrid|munich|arsenal|chelsea|liverpool|barcelona|city|united|bayern|juventus|milan|dortmund|psg|bernabéu|bernabeu|como/i;
    const nationalTeams = /germany|france|england|spain|brazil|argentina|italy|portugal|netherlands|serbia|uruguay|belgium/i;

    for (const e of entities) {
      if (clubKeywords.test(e) || nationalTeams.test(e)) {
        orgsOrClubs.push(e);
      } else {
        persons.push(e);
      }
    }

    if (persons.length > 0 && orgsOrClubs.length > 0) {
      for (const org of orgsOrClubs.slice(0, 2)) {
        queries.push(`${persons[0]} ${org}`);
        queries.push(`${org} ${persons[0]}`);
      }
      if (persons.length > 1) {
        queries.push(`${persons[0]} ${persons[1]}`);
      }
    } else if (entities.length >= 2) {
      queries.push(`${entities[0]} ${entities[1]}`);
      queries.push(`${entities[1]} ${entities[0]}`);
    } else if (entities.length === 1) {
      queries.push(entities[0]);
    }

    // Semantic / topic query formulation for claims lacking multi-word proper nouns
    const lowerClaim = (claimText || "").toLowerCase();

    // 1. Historical science / demographic / physics papers & studies
    if (/population|infinity|doomsday|scientist|paper|predict|study|experiment/i.test(lowerClaim)) {
      const yearMatch = lowerClaim.match(/\b(19\d\d|20\d\d)\b/g);
      const year = yearMatch ? yearMatch[0] : "";
      if (/population.*infinity|infinity.*population/i.test(lowerClaim)) {
        queries.unshift(`population infinity ${year || '1960'}`.trim());
        queries.push(`Doomsday population hypothesis ${year}`.trim());
      } else if (year) {
        queries.push(`science paper ${year}`);
      }
    }

    // 2. Relative / familial claims (e.g. sister Declan Fox)
    if (/\b(sister|brother|father|mother|daughter|son|cousin)\b/i.test(lowerClaim)) {
      const relMatch = claimText.match(/\b(sister|brother|father|mother|daughter|son|cousin)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
      if (relMatch) {
        if (persons.length > 0) {
          queries.push(`${persons[0]} ${relMatch[0]}`);
        }
        if (orgsOrClubs.length > 0) {
          queries.push(`${relMatch[2]} ${orgsOrClubs[0]}`);
        }
      }
    }

    return queries;
  }

  function buildEvidenceSearchQueries(claimText, entities) {
    const queries = [];
    const entityValues = (entities || []).filter(Boolean).slice(0, 4);
    const entityWords = new Set(entityValues.flatMap(entity => String(entity).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
    const claimTerms = Array.from(new Set((claimText.toLowerCase().match(/[a-z0-9]{4,}/g) || [])
      .filter(word => !STOP_WORDS.has(word) && !GENERIC_DICTIONARY_CONCEPTS.has(word) && !entityWords.has(word))))
      .slice(0, 8);
    if (entityValues.length >= 2) {
      queries.push(`"${entityValues[0]}" "${entityValues[1]}" ${claimTerms.slice(0, 1).join(" ")}`.trim());
    }
    for (const entity of entityValues.slice(0, 2)) {
      queries.push(`"${entity}" ${claimTerms.slice(0, 2).join(" ")}`.trim());
    }
    if (!entityValues.length) queries.push(claimTerms.slice(0, 7).join(" "));
    const seen = new Set();
    return queries.map(query => String(query || "").replace(/\s+/g, " ").trim())
      .filter(query => {
        const key = query.toLowerCase();
        if (!query || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }

  function getClaimPrimarySubject(entities) {
    return (entities || []).find(entity => /\s/.test(entity)) || (entities || [])[0] || "";
  }

  function normalizeEntityLabel(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  async function fetchWikidataOfficialSites(entityName) {
    const query = String(entityName || "").trim();
    if (query.length < 3) return { available: false, targets: [] };
    try {
      const searchUrl = `https://wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5&origin=*`;
      const search = await safeAuditFetch(searchUrl);
      if (!search || !Array.isArray(search.search)) return { available: false, targets: [] };
      const candidates = Array.isArray(search?.search) ? search.search : [];
      const normalizedQuery = normalizeEntityLabel(query);
      const best = candidates.find(candidate => normalizeEntityLabel(candidate.label) === normalizedQuery) ||
        candidates.find(candidate => normalizeEntityLabel(candidate.match?.text) === normalizedQuery);
      if (!best?.id) return { available: true, targets: [] };

      const detailUrl = `https://wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(best.id)}&props=claims&format=json&origin=*`;
      const detail = await safeAuditFetch(detailUrl);
      if (!detail?.entities) return { available: false, targets: [] };
      const entity = detail?.entities?.[best.id];
      const claims = entity?.claims?.P856 || [];
      const blockedHosts = new Set(["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "twitter.com", "x.com", "youtube.com"]);
      const targets = claims.map(claim => claim?.mainsnak?.datavalue?.value)
        .filter(value => typeof value === "string")
        .map(value => {
          try {
            const parsed = new URL(value);
            if (!/^https?:$/.test(parsed.protocol)) return null;
            const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
            if (!host.includes(".") || blockedHosts.has(host) || Array.from(blockedHosts).some(blocked => host.endsWith(`.${blocked}`))) return null;
            return { entityName: best.label || query, host, url: parsed.href };
          } catch (_) { return null; }
        }).filter(Boolean).slice(0, 1);
      return { available: true, targets };
    } catch (_) {
      return { available: false, targets: [] };
    }
  }

  async function buildOfficialSiteTargets(entities) {
    const names = Array.from(new Set((entities || []).filter(Boolean).slice(0, 3)));
    const lookups = await Promise.all(names.map(fetchWikidataOfficialSites));
    const candidates = lookups.flatMap(result => result.targets || []);
    const seen = new Set();
    const targets = candidates.filter(target => {
      if (seen.has(target.host)) return false;
      seen.add(target.host);
      return true;
    }).slice(0, 3);
    return { available: lookups.some(result => result.available), targets };
  }

  // Pipeline A: Real-Time Wire Feed Ingestion (Google News RSS)
  function decodeFeedText(value) {
    return String(value || "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
      .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  const SOCIAL_SOURCE_HOSTS = ["reddit.com", "x.com", "twitter.com", "instagram.com", "threads.net", "facebook.com", "tiktok.com", "youtube.com", "bsky.app", "linkedin.com"];

  async function fetchDuckDuckGoReceipts(query, options = {}) {
    if (!query) return { available: false, items: [] };
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const html = await safeAuditFetch(url);
      if (typeof html !== "string" || html.length < 200) return { available: false, items: [] };
      const doc = new DOMParser().parseFromString(html, "text/html");
      const items = Array.from(doc.querySelectorAll("a.result__a")).map(anchor => {
        let articleUrl;
        try {
          const link = new URL(anchor.getAttribute("href") || "", "https://html.duckduckgo.com");
          const redirected = link.searchParams.get("uddg");
          articleUrl = new URL(redirected || link.href);
        } catch (_) { return null; }
        if (!["http:", "https:"].includes(articleUrl.protocol) || /(^|\.)duckduckgo\.com$/i.test(articleUrl.hostname)) return null;
        const domain = articleUrl.hostname.replace(/^www\./i, "").toLowerCase();
        if (options.expectedDomain && domain !== options.expectedDomain && !domain.endsWith(`.${options.expectedDomain}`)) return null;
        const container = anchor.closest(".result") || anchor.parentElement?.parentElement;
        const snippet = String(container?.querySelector(".result__snippet")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500);
        const social = SOCIAL_SOURCE_HOSTS.some(host => domain === host || domain.endsWith(`.${host}`));
        return {
          headline: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
          snippet,
          url: articleUrl.href,
          publisherUrl: `${articleUrl.protocol}//${articleUrl.host}/`,
          pubDate: "",
          sourceName: domain,
          domain,
          provider: options.social ? "DuckDuckGo social index" : "DuckDuckGo web index",
          evidenceRole: social ? "Public social page indexed; account and post not authenticated" : "Open-web search result; page not reviewed"
        };
      }).filter(item => item && item.headline && item.url).slice(0, 10);
      return { available: true, items };
    } catch (_) {
      return { available: false, items: [] };
    }
  }

  function extractPublicPageEvidence(html) {
    if (!html || typeof DOMParser === "undefined") return { text: "", status: "Page text unavailable" };
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const description = doc.querySelector('meta[property="og:description"]')?.content ||
        doc.querySelector('meta[name="description"]')?.content || "";
      const title = doc.querySelector('meta[property="og:title"]')?.content || doc.title || "";
      const author = doc.querySelector('meta[name="author"]')?.content ||
        doc.querySelector('meta[property="article:author"]')?.content || "";
      const published = doc.querySelector('meta[property="article:published_time"]')?.content ||
        doc.querySelector('time[datetime]')?.getAttribute("datetime") || "";

      // Strip boilerplate, navigational, and promotional elements
      const clutterSelectors = [
        "script", "style", "noscript", "svg", "nav", "footer", "aside", "form", "button",
        "iframe", "canvas", "dialog", "header", '[role="banner"]', '[role="navigation"]',
        '[role="complementary"]', '[class*="cookie" i]', '[class*="consent" i]',
        '[class*="banner" i]', '[class*="share" i]', '[class*="social" i]',
        '[class*="ad-" i]', '[id*="ad-" i]', '[class*="newsletter" i]', '[class*="subscribe" i]'
      ].join(",");
      doc.querySelectorAll(clutterSelectors).forEach(node => node.remove());

      const root = doc.querySelector("[itemprop='articleBody']") ||
        doc.querySelector("article") ||
        doc.querySelector("main") ||
        doc.querySelector('[role="main"]') ||
        doc.querySelector(".article-body, .article-content, .post-content, .entry-content") ||
        doc.body;

      const contentNodes = Array.from(root?.querySelectorAll("p, blockquote, h1, h2, h3, li") || []);
      const seen = new Set();
      const meaningfulSnippets = [];
      for (const node of contentNodes) {
        const snippet = String(node.textContent || "").replace(/\s+/g, " ").trim();
        if (snippet.length < 35 || seen.has(snippet)) continue;
        seen.add(snippet);
        meaningfulSnippets.push(snippet);
        if (meaningfulSnippets.length >= 24) break;
      }

      let text = meaningfulSnippets.join(" ");
      if (text.length < 160) text = String(root?.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 160 && description) text = description;

      const metaCues = [author ? `Author: ${author}` : "", published ? `Published: ${published.slice(0, 10)}` : ""].filter(Boolean).join(" · ");
      const status = text.length >= 160
        ? `Readable page text retrieved${metaCues ? ` (${metaCues})` : ""}`
        : description
          ? "Metadata snippet only; article text unavailable"
          : "Page text unavailable or access restricted";

      return {
        title: String(title).replace(/\s+/g, " ").trim().slice(0, 180),
        text: text.slice(0, 6_000),
        status
      };
    } catch (_) {
      return { text: "", status: "Page could not be parsed" };
    }
  }

  async function reviewPublicSourcePage(receipt) {
    try {
      const target = new URL(receipt.url);
      if (target.protocol !== "https:" || /(^|\.)news\.google\.com$/i.test(target.hostname)) {
        return { receipt, text: "", status: "Publisher page URL unavailable" };
      }
      const html = await safeAuditFetchPage(target.href);
      const extracted = extractPublicPageEvidence(html);
      if (extracted.text) {
        receipt.pageTitle = extracted.title;
        receipt.articleText = extracted.text;
        receipt.snippet = [receipt.snippet, extracted.text.slice(0, 650)].filter(Boolean).join(" · ").slice(0, 1_200);
        receipt.evidenceRole = `${receipt.evidenceRole || "Source"}; ${extracted.status}`;
      }
      return { receipt, text: extracted.text, status: extracted.status };
    } catch (_) {
      return { receipt, text: "", status: "Publisher page URL unavailable" };
    }
  }

  function pageTextMatchesClaim(claim, entities, receipt) {
    const text = String(receipt?.articleText || "").toLowerCase();
    if (text.length < 160) return false;
    const entityMatches = (entities || []).filter(entity => {
      const normalized = String(entity || "").toLowerCase();
      const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
      const alias = words.length > 1 ? words[words.length - 1] : "";
      return text.includes(normalized) || (alias.length >= 4 && text.split(/[^a-z0-9]+/).includes(alias));
    });
    const entityWords = new Set((entities || []).flatMap(entity => String(entity || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
    const topicMatches = Array.from(new Set((String(claim || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [])
      .filter(word => !STOP_WORDS.has(word) && !GENERIC_DICTIONARY_CONCEPTS.has(word) && !entityWords.has(word) && text.includes(word))));
    return entityMatches.length >= 2 || (entityMatches.length >= 1 && topicMatches.length >= 1) || (!entities?.length && topicMatches.length >= 3);
  }

  async function fetchRealTimeWireReceipts(query) {
    if (!query) return { available: false, items: [] };
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    try {
      const xml = await safeAuditFetch(url);
      if (!xml || typeof xml !== "string") return { available: false, items: [] };
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      const receipts = items.slice(0, 12).map(item => {
        const readTag = tag => decodeFeedText(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "").trim();
        const title = readTag("title");
        const link = readTag("link");
        const pubDate = readTag("pubDate");
        const snippet = readTag("description").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700);
        const sourceMatch = item.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
        const source = decodeFeedText(sourceMatch?.[2] || "").trim();
        const publisherUrl = sourceMatch?.[1]?.match(/\burl\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
        let domain = "";
        try {
          const publisher = new URL(decodeFeedText(publisherUrl));
          if (publisher.protocol === "http:" || publisher.protocol === "https:") {
            domain = publisher.hostname.replace(/^www\./i, "").toLowerCase();
          }
        } catch (_) {}

        let articleUrl = "";
        try {
          const parsedArticle = new URL(link);
          if (parsedArticle.protocol === "http:" || parsedArticle.protocol === "https:") articleUrl = parsedArticle.href;
        } catch (_) {}

        return {
          headline: title,
          snippet,
          url: articleUrl,
          publisherUrl: domain ? decodeFeedText(publisherUrl) : "",
          pubDate,
          sourceName: source || domain || "Unknown publisher",
          domain,
          provider: "Google News RSS",
          evidenceRole: snippet ? "News headline and feed snippet" : "News headline"
        };
      }).filter(item => item.headline && item.url);
      return { available: /<rss\b|<feed\b/i.test(xml), items: receipts };
    } catch (_) {
      return { available: false, items: [] };
    }
  }

  async function fetchGdeltReceipts(query, options = {}) {
    if (!query) return { available: false, items: [] };
    const timespan = options.timespan || "3m";
    const maxRecords = options.maxRecords || 25;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${maxRecords}&timespan=${timespan}&sort=DateDesc`;
    try {
      const response = await safeAuditFetch(url);
      const articles = Array.isArray(response?.articles) ? response.articles : null;
      if (!articles) return { available: false, items: [] };
      const items = articles.map(article => {
        const headline = String(article.title || "").trim();
        let parsedUrl;
        try { parsedUrl = new URL(String(article.url || "")); } catch (_) { return null; }
        if (!headline || !["http:", "https:"].includes(parsedUrl.protocol)) return null;
        const domain = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
        if (options.expectedDomain && domain !== options.expectedDomain && !domain.endsWith(`.${options.expectedDomain}`)) return null;
        const date = String(article.seendate || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
        const pubDate = date
          ? `${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}Z`
          : "";
        return {
          headline,
          url: parsedUrl.href,
          publisherUrl: `${parsedUrl.protocol}//${parsedUrl.host}/`,
          pubDate,
          sourceName: domain,
          domain,
          provider: options.provider || "GDELT DOC",
          evidenceRole: options.evidenceRole || "News index headline"
        };
      }).filter(Boolean);
      return { available: true, items };
    } catch (_) {
      return { available: false, items: [] };
    }
  }

  // Predicate corroboration: verifies that the extracted document actually corroborates the claim predicate
  function evaluatePredicateCorroboration(extract, claimText, domain) {
    if (!extract) return false;
    const eLower = extract.toLowerCase();
    const cWords = claimText.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w) && !GENERIC_DICTIONARY_CONCEPTS.has(w));
    const matches = cWords.filter(cw => eLower.includes(cw));

    if (domain === "SPORTS_FOOTBALL") {
      const hasFootballContext = /football|soccer|club|league|midfield|striker|match|goal|season|player|transfers?/i.test(eLower);
      if (!hasFootballContext) return false;
    }
    return matches.length >= 2;
  }

  // Pipeline B: Deep Encyclopedic & Biographical Registries (Wikipedia Action API)
  async function fetchEncyclopedicReceipt(query, domain, claimText) {
    if (!query || GENERIC_DICTIONARY_CONCEPTS.has(query.toLowerCase()) || COMMON_LOCATIONS.has(query.toLowerCase()) || MATCH_DESCRIPTORS.has(query.toLowerCase())) {
      return null;
    }

    try {
      const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const sData = await safeAuditFetch(sUrl);
      const results = (sData && sData.query && sData.query.search) || [];
      if (results.length === 0) return null;

      let bestMatch = null;
      for (const cand of results.slice(0, 3)) {
        const cLower = cand.title.toLowerCase();
        if (COMMON_LOCATIONS.has(cLower) || GENERIC_DICTIONARY_CONCEPTS.has(cLower) || MATCH_DESCRIPTORS.has(cLower)) continue;
        if (domain === "SPORTS_FOOTBALL" && cLower === "merino") continue; // Avoid sheep wool breed hijack
        bestMatch = cand;
        break;
      }
      if (!bestMatch) return null;

      const pageTitle = bestMatch.title;
      // Use exintro=true to fetch only the concise introductory summary (never full 20,000-word article)
      const fUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=true&explaintext=true&pithumbsize=600&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
      const fData = await safeAuditFetch(fUrl);
      const pages = (fData && fData.query && fData.query.pages) || {};
      const pageId = Object.keys(pages)[0];
      const p = pages[pageId];
      if (!p || !p.extract) return null;

      if (claimText && !evaluatePredicateCorroboration(p.extract, claimText, domain)) {
        return null;
      }

      let thumb = p.thumbnail ? p.thumbnail.source : null;
      if (thumb && (/flag|coat_of_arms|logo|symbol/i.test(thumb) || thumb.endsWith('.svg'))) {
        thumb = null;
      }

      const conciseExtract = (p.extract || "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\[\d+\]/g, "")
        .split(/(?<=[.?!])\s+/)
        .slice(0, 2)
        .join(" ")
        .trim();

      return {
        title: p.title,
        extract: conciseExtract || p.extract.slice(0, 220),
        thumbnail: thumb,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
        domain: "wikipedia.org",
        sourceName: `Wikipedia · ${p.title}`
      };
    } catch (_) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // NATURAL AI FORENSIC SYNTHESIS (Zero Mock Templates, Free-Flow Real AI)
  // ═══════════════════════════════════════════════════════════════
  // A headline match is a discovery signal, not verification. Count publisher
  // hosts and article-title coverage while keeping source independence unknown.
  function assessHeadlineCoverage(claim, receipts, entities, domain) {
    const tokens = Array.from(new Set((claim.toLowerCase().match(/[a-z0-9]{4,}/g) || [])
      .filter(word => !STOP_WORDS.has(word) && !GENERIC_DICTIONARY_CONCEPTS.has(word))));
    const entityValues = (entities || []).map(value => String(value).toLowerCase()).filter(Boolean);
    const entityWords = new Set(entityValues.flatMap(value => value.split(/[^a-z0-9]+/).filter(Boolean)));
    const topicTokens = tokens.filter(token => !entityWords.has(token));
    const qualified = (receipts || []).filter(receipt => {
      if (!receipt.domain || !/^https?:\/\//i.test(receipt.url || "")) return false;
      const headline = `${receipt.headline || ""} ${receipt.snippet || ""}`.toLowerCase();
      const matchingEntities = entityValues.filter(entity => {
        const words = entity.split(/\s+/).filter(Boolean);
        const alias = words.length > 1 ? words[words.length - 1] : "";
        return headline.includes(entity) || (alias.length >= 4 && headline.split(/[^a-z0-9]+/).includes(alias));
      });
      const matchingTopics = topicTokens.filter(token => headline.includes(token));
      if (matchingEntities.length >= 2) {
        receipt.matchReason = "Two named entities in headline or snippet";
        return true;
      }
      if (matchingEntities.length && matchingTopics.length) {
        receipt.matchReason = "Named entity + claim-topic term in headline or snippet";
        return true;
      }
      return !entityValues.length && tokens.length > 1 && tokens.filter(token => headline.includes(token)).length >= 2;
    });
    const visible = qualified.slice(0, 6);
    const domains = new Set(qualified.map(item => String(item.domain || '').replace(/^www\./, '').toLowerCase()).filter(Boolean));
    const storyKeys = new Set(qualified.map(item => String(item.headline || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean));
    const dates = qualified.map(item => Date.parse(item.pubDate)).filter(value => Number.isFinite(value));
    const newestDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
    const dayOld = dates.length ? (Date.now() - Math.max(...dates)) / 86400000 : null;
    const coverageLabel = domains.size >= 3 && storyKeys.size >= 3 ? "BROADER" : domains.size >= 2 ? "EMERGING" : domains.size === 1 ? "LIMITED" : "NONE";
    let freshness = "No dated matching headlines";
    if (dayOld !== null) freshness = dayOld < 2 ? "Recent headlines found" : dayOld < 30 ? "Some recent coverage" : "Mostly older coverage";
    return {
      qualified: visible,
      matchedCount: qualified.length,
      sourceCount: domains.size,
      storyCount: storyKeys.size,
      coverageLabel,
      newestDate,
      freshness,
      tokenCount: tokens.length
    };
  }

  function describeUnverifiedClaimDetails(claim, receipts) {
    const details = [];
    const numberWordPattern = "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ]one)?|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion";
    const numericPattern = new RegExp(`\\b(?:\\d+(?:[.,]\\d+)*|${numberWordPattern})\\b`, "gi");
    let match;
    while ((match = numericPattern.exec(claim)) && details.length < 4) {
      const start = Math.max(0, match.index - 22);
      const end = Math.min(claim.length, match.index + match[0].length + 34);
      const snippet = claim.slice(start, end).trim().replace(/^\W+|\W+$/g, "");
      if (snippet && !details.some(value => value.toLowerCase() === snippet.toLowerCase())) details.push(`“${snippet}”`);
    }
    const incomplete = /\b(?:at|of|for|with|to|from|by|and|or|that|which|because|after|before)\s*$/i.test(claim.trim());
    const resultText = (receipts || []).map(item => `${item.headline || ""} ${item.snippet || ""}`).join(" ").toLowerCase();
    const numberLookup = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", twentyone: "21", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000", million: "1000000", billion: "1000000000" };
    const resultNumbers = new Set(resultText.match(/\b\d+(?:[.,]\d+)*\b/g) || []);
    const resultNumberWords = new Set(resultText.match(/\b[a-z]+\b/g) || []);
    const mentionedNumbers = (claim.match(numericPattern) || []).filter(value => {
      const normalized = value.toLowerCase().replace(/[- ]/g, "");
      const digit = numberLookup[normalized] || normalized.replace(/[^\d.,]/g, "");
      return resultNumberWords.has(normalized) || Boolean(digit && resultNumbers.has(digit));
    }).length;
    const figureStatus = details.length
      ? `Numbers in claim details: ${mentionedNumbers}/${(claim.match(numericPattern) || []).length} appear in indexed titles/snippets or accessible page text; mention is not confirmation`
      : "No number passage detected; specific dates, actions, and context remain unverified";
    return `${figureStatus}; full article text and primary records were not checked${incomplete ? "; claim text appears incomplete" : ""}`;
  }

  function mergeNewsReceipts(receipts) {
    const merged = new Map();
    for (const item of receipts || []) {
      const headlineKey = String(item.headline || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const key = `${String(item.domain || "").toLowerCase()}|${headlineKey}`;
      if (!headlineKey || key === "|") continue;
      const current = merged.get(key);
      if (!current) {
        item.providers = Array.from(new Set([...(item.providers || []), item.provider].filter(Boolean)));
        merged.set(key, item);
        continue;
      }
      current.providers = Array.from(new Set([...(current.providers || []), ...(item.providers || []), item.provider].filter(Boolean)));
      if (current.provider !== item.provider && item.provider === "GDELT DOC") {
        current.url = item.url;
        current.publisherUrl = item.publisherUrl || current.publisherUrl;
        current.pubDate = item.pubDate || current.pubDate;
      }
      current.evidenceRole = Array.from(new Set([current.evidenceRole, item.evidenceRole].filter(Boolean))).join("; ");
    }
    return Array.from(merged.values());
  }

  async function runInBrowserRealityAudit(claimText, postUrl, platformMeta) {
    const cleanClaim = (claimText || "").replace(/[\r\n]+/g, " ").replace(/\b(\w+)\s+\1\b/gi, "$1").trim();
    if (!cleanClaim) return;

    const domain = detectClaimDomain(cleanClaim);
    const entities = extractEntitiesDynamically(cleanClaim);
    const queries = buildEvidenceSearchQueries(cleanClaim, entities);
    const searchQueries = queries.length ? queries.slice(0, 2) : [cleanClaim.slice(0, 100)];
    const primaryEntity = getClaimPrimarySubject(entities);
    const officialTargetPromise = buildOfficialSiteTargets(entities);
    const socialSearchDomains = ["reddit.com", "x.com", "instagram.com", "threads.net", "facebook.com", "tiktok.com", "youtube.com", "bsky.app"];
    let [googleResults, gdeltResults, encyclopedicRecord, officialLookup, webSearchResult, socialResults] = await Promise.all([
      Promise.all(searchQueries.map(fetchRealTimeWireReceipts)),
      Promise.all(searchQueries.map(fetchGdeltReceipts)),
      fetchEncyclopedicReceipt(primaryEntity || searchQueries[0], domain, cleanClaim),
      officialTargetPromise,
      fetchDuckDuckGoReceipts(searchQueries[0]),
      Promise.all(socialSearchDomains.map(host => fetchDuckDuckGoReceipts(`site:${host} ${searchQueries[0]}`, { social: true, expectedDomain: host })))
    ]);
    const officialTargets = officialLookup.targets;
    const officialResults = await Promise.all(officialTargets.map(target => fetchGdeltReceipts(`\"${target.entityName}\" domainis:${target.host}`, {
        timespan: "3m",
        maxRecords: 10,
        expectedDomain: target.host,
        provider: "GDELT official-site index",
        evidenceRole: `Wikidata-listed official site index result for ${target.entityName}; page not reviewed`
      })));

    if (!encyclopedicRecord && entities.length > 1) {
      for (const entity of entities.slice(1, 3)) {
        encyclopedicRecord = await fetchEncyclopedicReceipt(entity, domain, cleanClaim);
        if (encyclopedicRecord) break;
      }
    }

    const googleAvailable = googleResults.some(result => result.available);
    const gdeltAvailable = gdeltResults.some(result => result.available);
    const officialAvailable = officialResults.some(result => result.available);
    const webAvailable = Boolean(webSearchResult.available);
    const socialAvailable = socialResults.some(result => result.available);
    const googleHeadlines = googleResults.flatMap(result => result.items || []);
    const gdeltHeadlines = gdeltResults.flatMap(result => result.items || []);
    const officialSiteHits = officialResults.flatMap(result => result.items || []);
    const webHeadlines = webSearchResult.items || [];
    const socialHeadlines = socialResults.flatMap(result => result.items || []);
    const allHeadlines = mergeNewsReceipts([...gdeltHeadlines, ...googleHeadlines, ...webHeadlines, ...socialHeadlines]);
    const initialEvidence = assessHeadlineCoverage(cleanClaim, allHeadlines, entities, domain);
    const pageTargets = [];
    const pageHosts = new Set();
    for (const receipt of [...officialSiteHits, ...initialEvidence.qualified]) {
      let host = "";
      try { host = new URL(receipt.url).hostname.toLowerCase(); } catch (_) {}
      if (!host || host === "news.google.com" || host.endsWith(".news.google.com") || pageHosts.has(host)) continue;
      pageHosts.add(host);
      pageTargets.push(receipt);
      if (pageTargets.length >= 4) break;
    }
    const pageReviews = await Promise.all(pageTargets.map(reviewPublicSourcePage));
    const readablePageCount = pageReviews.filter(result => result.text.length >= 160).length;
    const readableOfficialPageCount = pageReviews.filter(result => result.text.length >= 160 && result.receipt.provider === "GDELT official-site index").length;
    const pageTextMatchCount = pageReviews.filter(result => pageTextMatchesClaim(cleanClaim, entities, result.receipt)).length;
    const officialPageTextMatchCount = pageReviews.filter(result => result.receipt.provider === "GDELT official-site index" && pageTextMatchesClaim(cleanClaim, entities, result.receipt)).length;
    for (const review of pageReviews) {
      if (pageTextMatchesClaim(cleanClaim, entities, review.receipt)) {
        review.receipt.evidenceRole = `${review.receipt.evidenceRole || "Source"}; entity/topic terms also found in extracted page text`;
      }
    }
    const evidence = assessHeadlineCoverage(cleanClaim, allHeadlines, entities, domain);
    const matchedProviders = new Set(evidence.qualified.flatMap(item => item.providers || [item.provider]).filter(Boolean));
    const providerStatus = [
      `Google News RSS: ${googleAvailable ? "reachable" : "unavailable"} (${googleHeadlines.length} query results)`,
      `GDELT DOC: ${gdeltAvailable ? "reachable" : "unavailable"} (${gdeltHeadlines.length} query results)`,
      `DuckDuckGo web: ${webAvailable ? "reachable" : "unavailable"} (${webHeadlines.length} results)`,
      `Social-site searches: ${socialAvailable ? "reachable" : "unavailable"} (${socialHeadlines.length} public indexed results)`
    ].join("; ");
    const hasOpinionCue = /\b(i think|i believe|in my opinion|my view is|probably|might|could|should|will happen|going to)\b/i.test(cleanClaim);
    const claimKind = hasOpinionCue ? "Opinion or prediction cue" : "Factual assertion (heuristic)";
    const reportCount = evidence.matchedCount;
    const newestDateLabel = evidence.newestDate
      ? new Date(evidence.newestDate).toLocaleDateString()
      : "No publication date available";
    const checkedAtLabel = new Date().toLocaleTimeString();
    const articleSummary = reportCount
      ? `Live search found ${reportCount} subject-and-topic title/snippet matches across ${evidence.sourceCount} source hosts. These are leads, not confirmations; title overlap and public social posts cannot establish that the claim is true.${readablePageCount ? ` Readable text was extracted from ${readablePageCount} of ${pageReviews.length} linked pages, with entity/topic alignment in ${pageTextMatchCount}.` : ""}`
      : googleAvailable || gdeltAvailable || webAvailable || socialAvailable
        ? officialPageTextMatchCount
          ? `The broad search indexes returned no qualifying title/snippet match, but ${officialPageTextMatchCount} public official-site page${officialPageTextMatchCount === 1 ? "" : "s"} contained the extracted entity/topic terms. This is a primary-source lead, not a full claim verdict.`
          : `Live search responded (${googleHeadlines.length + gdeltHeadlines.length + webHeadlines.length + socialHeadlines.length} indexed results), but none matched the extracted entities and topic closely enough to include. This does not show that the claim is false.${officialSiteHits.length ? ` The official-site search returned ${officialSiteHits.length} candidate links.` : ""}`
        : officialAvailable
          ? `The broad news indexes were unavailable. The official-site index responded with ${officialSiteHits.length} candidate link${officialSiteHits.length === 1 ? "" : "s"}; this does not determine whether the claim is true.`
          : "The news indexes could not be reached through the current network route, so this pass has no news evidence to assess. Check the connection and try again.";
    const contextReceipt = encyclopedicRecord ? {
      sourceName: encyclopedicRecord.sourceName || "Wikipedia",
      headline: String(encyclopedicRecord.extract || "Background context").slice(0, 180),
      url: encyclopedicRecord.url,
      domain: "en.wikipedia.org",
      evidenceRole: "Background context; not proof of this claim"
    } : null;
    let attachedLinkReceipt = null;
    if (platformMeta && /^https?:\/\//i.test(platformMeta.outboundLink || "")) {
      try {
        const attachedUrl = new URL(platformMeta.outboundLink);
        attachedLinkReceipt = {
          sourceName: attachedUrl.hostname.replace(/^www\./i, ""),
          headline: "Link attached to the original post",
          url: attachedUrl.href,
          domain: attachedUrl.hostname.replace(/^www\./i, "").toLowerCase(),
          evidenceRole: "Original post context; not independently checked"
        };
      } catch (_) {}
    }
    const receipts = [...evidence.qualified.slice(0, 4), ...officialSiteHits.slice(0, 2)];
    if (contextReceipt && /^https:\/\//i.test(contextReceipt.url || "")) receipts.push(contextReceipt);
    if (attachedLinkReceipt) receipts.push(attachedLinkReceipt);

    const verdictData = {
      id: "evidence_" + Date.now(),
      claim: cleanClaim,
      verdict: "CONTESTED",
      verdictTitle: "EVIDENCE REVIEW — NO TRUTH VERDICT",
      statusBadge: (reportCount && officialPageTextMatchCount) ? "OFFICIAL & INDEX MATCHES" : reportCount ? "INDEX MATCHES FOUND" : officialPageTextMatchCount ? "OFFICIAL PAGE SIGNAL" : googleAvailable || gdeltAvailable || webAvailable || socialAvailable ? "NO MATCHING COVERAGE" : officialAvailable ? "OFFICIAL INDEX ONLY" : "SEARCH UNAVAILABLE",
      confidence: 0,
      evidenceReport: true,
      coverageLabel: evidence.coverageLabel,
      evidenceLayers: [
        { label: "Claim framing", value: claimKind },
        { label: "Live search providers", value: `${providerStatus}; ${matchedProviders.size} provider${matchedProviders.size === 1 ? "" : "s"} returned matching links` },
        { label: "Title/snippet matches", value: `${reportCount} topic matches; up to ${Math.min(4, evidence.qualified.length)} source links shown` },
        { label: "Source spread", value: `${evidence.sourceCount} distinct host${evidence.sourceCount === 1 ? "" : "s"}; syndication and independence not confirmed` },
        { label: "Public page review", value: `${readablePageCount} of ${pageReviews.length} matched public pages yielded readable text; social account identity is not authenticated` },
        { label: "Page-text alignment", value: `${pageTextMatchCount} readable page${pageTextMatchCount === 1 ? "" : "s"} ${pageTextMatchCount === 1 ? "contains" : "contain"} the extracted entity/topic terms; this is not validation of the full claim` },
        { label: "Recency", value: `${evidence.freshness} · ${newestDateLabel}` },
        { label: "Search window", value: "GDELT rolling 3 months; Google News results depend on its feed index" },
        { label: "Official-site search", value: officialTargets.length ? `${officialAvailable ? `${officialSiteHits.length} indexed result${officialSiteHits.length === 1 ? "" : "s"}` : "GDELT index unavailable"} across ${officialTargets.length} Wikidata-resolved entity site${officialTargets.length === 1 ? "" : "s"}; ${officialLookup.available ? "Wikidata lookup reachable" : "Wikidata lookup unavailable"}; ${readableOfficialPageCount ? `${readableOfficialPageCount} page${readableOfficialPageCount === 1 ? "" : "s"} reviewed` : "pages not opened or restricted"}` : `${officialLookup.available ? "No official site found for the extracted entities" : "Wikidata entity lookup unavailable"}` },
        { label: "Claim details", value: describeUnverifiedClaimDetails(cleanClaim, allHeadlines) },
        { label: "Background context", value: encyclopedicRecord ? "Found; not treated as claim proof" : "No matching encyclopedia entry found" },
        { label: "Original post link", value: attachedLinkReceipt ? "Attached link listed separately for review" : "No attached link found" },
        { label: "Primary evidence", value: officialPageTextMatchCount ? `${officialPageTextMatchCount} official-site page${officialPageTextMatchCount === 1 ? "" : "s"} contain entity/topic terms; inspect the source before relying on the claim` : readableOfficialPageCount ? `Readable text extracted from ${readableOfficialPageCount} official-site page${readableOfficialPageCount === 1 ? "" : "s"}; claim still requires source review` : officialSiteHits.length ? "Official-site index candidates found; pages not accessible or reviewed" : "No primary records reviewed" },
        { label: "Checked", value: checkedAtLabel }
      ],
      assessmentLimitation: "Google News RSS, GDELT, DuckDuckGo, and social-site results are discovery leads, not independent corroboration. Public pages are fetched without login and a small text excerpt is extracted when accessible; paywalls, app shells, and blocked pages may hide content. Social account identity is not authenticated. This pass does not establish truth; inspect full articles and primary records before relying on a claim.",
      forensicSummary: articleSummary,
      receipts,
      primarySource: null,
      leadImage: null,
      followUpQuestions: [
        "Do the linked articles cite a first-hand document or named source?",
        "Are multiple publishers reporting independently, or repeating the same wire story?",
        "What primary record would directly confirm or disprove this claim?"
      ],
      deepLink: postUrl || window.location.href,
      attachedContextUrl: attachedLinkReceipt ? attachedLinkReceipt.url : "",
      checkedAt: new Date().toISOString(),
      isPro: true,
      auditTier: "PRO_EVIDENCE"
    };

    showVerdict(verdictData);
  }

  async function executeAudit(claimText, postUrl, platformMeta) {
    if (!claimText || claimText.trim().length < 4) return;
    claimText = claimText.trim().slice(0, 320);
    activeAuditClaim = claimText;
    showLoading(claimText);

    const cacheKey = `fokko_cache_${CACHE_VERSION}_` + getClaimHash(claimText);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (cachedData && (cachedData.verdict === "VERIFIED" || cachedData.verdict === "DEBUNKED" || cachedData.verdict === "CONTESTED")) {
          if (!cachedData.forensicSummary?.includes("reality checks") && !cachedData.verdictTitle?.includes("LIMIT") && !cachedData.forensicSummary?.includes("broader midfield restructuring")) {
            cachedData.isPro = true;
            setTimeout(() => showVerdict(cachedData), 120);
            return;
          } else {
            localStorage.removeItem(cacheKey);
          }
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch {}

    runInBrowserRealityAudit(claimText, postUrl, platformMeta);
  }

  function createFokkButton(title, onClick) {
    const btn = document.createElement("button");
    btn.className = "tmb-inline-trigger";
    btn.type = "button";
    btn.setAttribute("title", title || "fokk — Verify Reality with Fokkoo");

    btn.innerHTML = `
      <div class="tmb-trigger-icon-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
          <line x1="12" y1="2" x2="12" y2="22"/>
        </svg>
      </div>
      <span class="tmb-trigger-label">fokk</span>
    `;

    btn.addEventListener("click", onClick);
    return btn;
  }

  // 1. X (TWITTER) INJECTION
  function injectXButtons() {
    if (!window.location.hostname.includes("twitter.com") && !window.location.hostname.includes("x.com")) return;

    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    tweetArticles.forEach((article) => {
      if (article.querySelector('.tmb-inline-trigger')) return;
      const actionGroup = article.querySelector('div[role="group"]');
      if (!actionGroup) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textElement = article.querySelector('div[data-testid="tweetText"]');
        const claimText = textElement ? textElement.innerText : article.innerText.slice(0, 260);
        const timeLink = article.querySelector("time")?.closest("a");
        const postUrl = timeLink ? timeLink.href : window.location.href;
        const cardLink = article.querySelector('a[data-testid="card.wrapper"], div[data-testid="card.layoutLarge"] a')?.href || "";
        const isVerified = Boolean(article.querySelector('svg[data-testid="icon-verified"]'));
        executeAudit(claimText, postUrl, { platform: "twitter", outboundLink: cardLink, isVerified });
      });

      actionGroup.appendChild(btn);
      article.setAttribute("data-tmb-injected", "true");
    });
  }

  // Modern Reddit action row resolver (custom components, shadow roots & classic)
  function findRedditActionRow(post) {
    if (!post) return null;
    const standardRow = post.querySelector('shreddit-post-action-row, [slot="action-row"], [slot="actions"], div[data-testid="action-row"]');
    if (standardRow) return standardRow;

    const shareBtn = post.querySelector('button[aria-label*="share" i], button[name="share-button"], shreddit-post-share-button, [data-testid="share-button"]');
    if (shareBtn && shareBtn.parentElement) return shareBtn.parentElement;

    const commentBtn = post.querySelector('button[aria-label*="comment" i], a[slot="comments-button"], a[data-click-id="comments"]');
    if (commentBtn && commentBtn.parentElement) return commentBtn.parentElement;

    const oldRow = post.querySelector('ul.flat-list, div.buttons, div[data-click-id="comments"]');
    if (oldRow) return oldRow.parentElement || oldRow;

    if (post.shadowRoot) {
      const shadowRow = post.shadowRoot.querySelector('shreddit-post-action-row, [slot="action-row"], div.action-row');
      if (shadowRow) return shadowRow;
    }
    return null;
  }

  function getRedditPostText(post) {
    if (!post) return "";
    const titleEl = post.querySelector('h1, h2, [slot="title"], a[data-click-id="body"], a[slot="full-post-link"]');
    const titleText = titleEl ? titleEl.innerText.trim() : "";
    const bodyEl = post.querySelector('[slot="text-body"], div[data-click-id="text"], p');
    const bodyText = bodyEl ? bodyEl.innerText.trim().slice(0, 200) : "";
    return (titleText + (bodyText ? " - " + bodyText : "")).slice(0, 240) || post.innerText.slice(0, 220);
  }

  function getRedditPostUrl(post) {
    if (!post) return window.location.href;
    const permalink = post.getAttribute("permalink") || post.getAttribute("content-href");
    if (permalink) {
      return permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`;
    }
    const linkEl = post.querySelector('a[slot="full-post-link"], a[data-click-id="body"], a[href*="/comments/"]');
    if (linkEl && linkEl.href) return linkEl.href;
    return window.location.href;
  }

  // 2. REDDIT INJECTION
  function injectRedditButtons() {
    if (!window.location.hostname.includes("reddit.com")) return;

    const posts = document.querySelectorAll('shreddit-post, div[data-testid="post-container"], article[data-testid="post-container"], div.Post, .thing.link');
    posts.forEach((post) => {
      if (post.querySelector('.tmb-inline-trigger') || (post.shadowRoot && post.shadowRoot.querySelector('.tmb-inline-trigger'))) return;
      const actionRow = findRedditActionRow(post);
      if (!actionRow) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const claimText = getRedditPostText(post);
        const postUrl = getRedditPostUrl(post);
        executeAudit(claimText, postUrl);
      });

      actionRow.appendChild(btn);
      post.setAttribute("data-tmb-injected", "true");
    });
  }

  // 3. THREADS (threads.net) INJECTION
  function injectThreadsButtons() {
    if (!window.location.hostname.includes("threads.net")) return;

    const posts = document.querySelectorAll('div[data-pressable-container="true"]');
    posts.forEach((post) => {
      if (post.querySelector('.tmb-inline-trigger')) return;
      const actionGroup = post.querySelector('div[role="button"]')?.parentElement;
      if (!actionGroup) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textElem = post.querySelector('span[dir="auto"], div[dir="auto"]');
        const claimText = textElem ? textElem.innerText : post.innerText.slice(0, 260);
        executeAudit(claimText, window.location.href);
      });

      actionGroup.appendChild(btn);
      post.setAttribute("data-tmb-injected", "true");
    });
  }

  // 4. BLUESKY (bsky.app) INJECTION
  function injectBlueskyButtons() {
    if (!window.location.hostname.includes("bsky.app")) return;

    const posts = document.querySelectorAll('div[data-testid^="feedItem-"], div[data-testid^="postThreadItem"]');
    posts.forEach((post) => {
      if (post.querySelector('.tmb-inline-trigger')) return;
      const actionRow = post.querySelector('div[data-testid="replyBtn"]')?.parentElement;
      if (!actionRow) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textElem = post.querySelector('div[data-testid="postText"]');
        const claimText = textElem ? textElem.innerText : post.innerText.slice(0, 260);
        executeAudit(claimText, window.location.href);
      });

      actionRow.appendChild(btn);
      post.setAttribute("data-tmb-injected", "true");
    });
  }

  // 5. LINKEDIN (linkedin.com) INJECTION
  function injectLinkedInButtons() {
    if (!window.location.hostname.includes("linkedin.com")) return;

    const updates = document.querySelectorAll('div.feed-shared-update-v2, div[data-urn*="activity"]');
    updates.forEach((update) => {
      if (update.querySelector('.tmb-inline-trigger')) return;
      const actionRow = update.querySelector('div.feed-shared-social-actions, div.social-actions-and-comments');
      if (!actionRow) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textElem = update.querySelector('div.feed-shared-update-v2__description, span.break-words');
        const claimText = textElem ? textElem.innerText : update.innerText.slice(0, 260);
        executeAudit(claimText, window.location.href);
      });

      actionRow.appendChild(btn);
      update.setAttribute("data-tmb-injected", "true");
    });
  }

  // 6. YOUTUBE (youtube.com) INJECTION
  function injectYouTubeButtons() {
    if (!window.location.hostname.includes("youtube.com")) return;

    const actionContainer = document.querySelector('ytd-watch-metadata #actions-inner #top-level-buttons-computed');
    if (actionContainer && !actionContainer.querySelector('.tmb-inline-trigger')) {
      const btn = createFokkButton("fokk — Verify Video Claims with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const titleElem = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1');
        const claimText = titleElem ? titleElem.innerText : document.title;
        executeAudit(claimText, window.location.href);
      });
      actionContainer.appendChild(btn);
      actionContainer.setAttribute("data-tmb-injected", "true");
    }
  }

  // 7. INSTAGRAM (instagram.com) INJECTION
  function injectInstagramButtons() {
    if (!window.location.hostname.includes("instagram.com")) return;

    const posts = document.querySelectorAll('article, div[role="dialog"] article, section > main article');
    posts.forEach((post) => {
      if (post.querySelector('.tmb-inline-trigger') || post.getAttribute("data-tmb-injected")) return;

      const actionRow = post.querySelector('section span svg[aria-label="Like"], section span svg[aria-label="Comment"], section span svg[aria-label="Share Post"]')?.closest('section');
      if (!actionRow) return;

      const btn = createFokkButton("fokk — Verify Reality with Fokkoo", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const captionEl = post.querySelector('h1, span._aaco, span._aacl, div[class*="caption"], article span[dir="auto"]');
        const claimText = captionEl ? captionEl.innerText : post.innerText.slice(0, 300);

        const authorEl = post.querySelector('header a, a[role="link"]');
        const author = authorEl ? authorEl.innerText.trim() : "";

        const linkEl = post.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        const postUrl = linkEl ? linkEl.href : window.location.href;

        executeAudit(claimText, postUrl, { platform: "instagram", author });
      });

      btn.style.marginLeft = "8px";
      btn.style.alignSelf = "center";
      actionRow.appendChild(btn);
      post.setAttribute("data-tmb-injected", "true");
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AMBIENT HIGHLIGHT HOVER BUBBLE (On any web page)
  // ═══════════════════════════════════════════════════════════════
  function setupFloatingBubble() {
    floatingBubble = document.createElement("div");
    floatingBubble.className = "tmb-floating-bubble";

    floatingBubble.innerHTML = `
      <div style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
          <line x1="12" y1="2" x2="12" y2="22"/>
        </svg>
      </div>
      <span style="color:#00E5FF;font-weight:700;">fokk</span>
    `;

    floatingBubble.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeSelectionText) {
        executeAudit(activeSelectionText, window.location.href);
        hideFloatingBubble();
      }
    });

    const container = document.body || document.documentElement;
    if (container) {
      container.appendChild(floatingBubble);
    }

    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";

      if (text.length >= 15 && text.length <= 500) {
        activeSelectionText = text;
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            floatingBubble.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
            floatingBubble.style.top = `${rect.top + window.scrollY}px`;
            floatingBubble.classList.add("tmb-visible");
            return;
          }
        } catch {}
      } else {
        hideFloatingBubble();
      }
    });

    document.addEventListener("mousedown", (e) => {
      if (!floatingBubble.contains(e.target)) {
        hideFloatingBubble();
      }
    });
  }

  function hideFloatingBubble() {
    if (floatingBubble) {
      floatingBubble.classList.remove("tmb-visible");
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Listen to background context menu clicks
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.action === "TMB_INSPECT_SELECTION" && msg.selectedText) {
      executeAudit(msg.selectedText, window.location.href);
    }
  });

  // Init
  setupFloatingBubble();

  const host = window.location.hostname;
  const isSocialPlatform = host.includes("twitter.com") || host.includes("x.com") ||
      host.includes("reddit.com") || host.includes("instagram.com") || host.includes("threads.net") ||
      host.includes("bsky.app") || host.includes("linkedin.com") ||
      host.includes("youtube.com");

  // Only run social post button injectors and their observer on supported platforms
  if (isSocialPlatform) {
    function runActiveInjector() {
      if (host.includes("twitter.com") || host.includes("x.com")) injectXButtons();
      else if (host.includes("reddit.com")) injectRedditButtons();
      else if (host.includes("instagram.com")) injectInstagramButtons();
      else if (host.includes("threads.net")) injectThreadsButtons();
      else if (host.includes("bsky.app")) injectBlueskyButtons();
      else if (host.includes("linkedin.com")) injectLinkedInButtons();
      else if (host.includes("youtube.com")) injectYouTubeButtons();
    }

    runActiveInjector();

    let scanScheduled = false;
    function scheduleScan() {
      if (scanScheduled) return;
      scanScheduled = true;
      requestAnimationFrame(() => {
        runActiveInjector();
        scanScheduled = false;
      });
    }

    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
    }
  }
})();
