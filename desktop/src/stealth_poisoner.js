/**
 * Fokk Shield - Next-Gen Anti-Fingerprinting Stealth Poisoner
 * Injects mathematically imperceptible noise into Canvas, AudioContext, and WebGL
 * to defeat cross-site tracking without breaking legitimate web applications.
 */

(function() {
    if (window.__fokk_stealth_poisoned) return;
    window.__fokk_stealth_poisoned = true;

    // Generate origin-specific deterministic seed
    let seed = 0;
    try {
        const origin = window.location.origin || window.location.hostname || 'fokk';
        for (let i = 0; i < origin.length; i++) {
            seed = ((seed << 5) - seed) + origin.charCodeAt(i);
            seed |= 0;
        }
    } catch (_) {
        seed = 42;
    }

    function pseudoRandom(offset = 0) {
        const x = Math.sin(seed + offset) * 10000;
        return x - Math.floor(x);
    }

    // 1. Canvas Fingerprint Poisoner (Protects toDataURL & getImageData)
    try {
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
            const imageData = origGetImageData.apply(this, arguments);
            try {
                const data = imageData.data;
                const len = data.length;
                if (len >= 4) {
                    // Poison 2 non-destructive pixels imperceptibly
                    const idx1 = Math.floor(pseudoRandom(1) * (len / 4)) * 4;
                    const idx2 = Math.floor(pseudoRandom(2) * (len / 4)) * 4;
                    if (data[idx1] > 0 && data[idx1] < 255) {
                        data[idx1] += (pseudoRandom(3) > 0.5 ? 1 : -1);
                    }
                    if (data[idx2 + 1] > 0 && data[idx2 + 1] < 255) {
                        data[idx2 + 1] += (pseudoRandom(4) > 0.5 ? 1 : -1);
                    }
                }
            } catch (_) {}
            return imageData;
        };

        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
            try {
                const ctx = this.getContext('2d');
                if (ctx && this.width > 0 && this.height > 0) {
                    const imgData = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
                    ctx.putImageData(imgData, 0, 0);
                }
            } catch (_) {}
            return origToDataURL.apply(this, arguments);
        };
    } catch (_) {}

    // 2. Audio Context Fingerprint Poisoner
    try {
        if (window.AudioBuffer) {
            const origGetChannelData = AudioBuffer.prototype.getChannelData;
            AudioBuffer.prototype.getChannelData = function(channel) {
                const channelData = origGetChannelData.apply(this, arguments);
                try {
                    const noise = (pseudoRandom(5) - 0.5) * 0.0000001;
                    if (channelData && channelData.length > 0) {
                        channelData[0] += noise;
                    }
                } catch (_) {}
                return channelData;
            };
        }

        if (window.AnalyserNode) {
            const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
            AnalyserNode.prototype.getFloatFrequencyData = function(array) {
                origGetFloatFrequencyData.apply(this, arguments);
                try {
                    if (array && array.length > 0) {
                        array[0] += (pseudoRandom(6) - 0.5) * 0.0001;
                    }
                } catch (_) {}
            };
        }
    } catch (_) {}

    // 3. WebGL Fingerprint Shield
    try {
        const protectWebGL = (proto) => {
            if (!proto || !proto.getParameter) return;
            const origGetParam = proto.getParameter;
            proto.getParameter = function(param) {
                // UNMASKED_VENDOR_WEBGL
                if (param === 0x9245) return 'Intel Inc.';
                // UNMASKED_RENDERER_WEBGL
                if (param === 0x9246) return 'Intel Iris OpenGL Engine';
                return origGetParam.apply(this, arguments);
            };
        };

        if (window.WebGLRenderingContext) protectWebGL(WebGLRenderingContext.prototype);
        if (window.WebGL2RenderingContext) protectWebGL(WebGL2RenderingContext.prototype);
    } catch (_) {}
})();
