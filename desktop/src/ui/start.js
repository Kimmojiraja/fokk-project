// Fokk Desktop Start Page Logic (Firefox Desktop Layout)

(function() {
    'use strict';

    // 1. Curated 4K Wallpapers (Pre-installed Sailboat Collection + Landscapes)
    const CURATED_WALLPAPERS = [
        {
            id: 'sailboat',
            name: 'Sunset Coastal Sailboat (Default)',
            url: 'wallpaper_sailboat.jpg',
            thumb: 'wallpaper_sailboat.jpg'
        },
        {
            id: 'sailboat_2',
            name: 'Azure Ocean Yacht',
            url: 'wallpaper_sailboat_2.jpg',
            thumb: 'wallpaper_sailboat_2.jpg'
        },
        {
            id: 'sailboat_3',
            name: 'Golden Hour Sloop',
            url: 'wallpaper_sailboat_3.jpg',
            thumb: 'wallpaper_sailboat_3.jpg'
        },
        {
            id: 'sailboat_4',
            name: 'Open Sea Regatta',
            url: 'wallpaper_sailboat_4.jpg',
            thumb: 'wallpaper_sailboat_4.jpg'
        },
        {
            id: 'sailboat_5',
            name: 'Tropical Lagoon Sailboat',
            url: 'wallpaper_sailboat_5.jpg',
            thumb: 'wallpaper_sailboat_5.jpg'
        },
        {
            id: 'sailboat_6',
            name: 'Dramatic Horizon Sailing',
            url: 'wallpaper_sailboat_6.jpg',
            thumb: 'wallpaper_sailboat_6.jpg'
        },
        {
            id: 'alpine',
            name: 'Alpine Serenity',
            url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2560&q=85',
            thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=360&q=60'
        },
        {
            id: 'horizon',
            name: 'Golden Horizon',
            url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=2560&q=85',
            thumb: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=360&q=60'
        },
        {
            id: 'cyberpunk',
            name: 'Neon Metropolis',
            url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2560&q=85',
            thumb: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=360&q=60'
        },
        {
            id: 'obsidian',
            name: 'Stealth Matte Black',
            url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="%23090a0c"/></svg>',
            thumb: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="192" height="108" viewBox="0 0 192 108"><rect width="192" height="108" fill="%23090a0c"/></svg>'
        }
    ];

    // 2. High-Quality Vector Shortcuts (8 Tiles - Authentic Official Brand Vectors)
    const DEFAULT_SHORTCUTS = [
        {
            name: 'Amazon',
            sub: 'Sponsored',
            url: 'https://www.amazon.com',
            iconBg: '#232f3e',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FF9900" d="M13.77 10.95c0-1.57-.17-2.77-1.67-2.77-1.03 0-1.59.78-1.83 1.48l3.5 1.29zm1.8-4.86h2.15v8.57c0 1.2.1 2.1.77 2.75l-2.1 1.01c-.54-.62-.7-1.44-.78-2.06-.72.94-1.83 1.7-3.33 1.7-2.49 0-4.12-1.82-4.12-4.33 0-2.75 2.04-4.29 4.38-4.29 1.23 0 2.13.4 2.65.92V6.09h.43v-.001zm-13.8 11.2c4.46 3.19 10.84 4.7 16.79 2.44.64-.24.61-.97-.04-1.06-3.75-.5-7.4-1.88-10.59-4.06-.4-.28-.87.16-.51.52.06.06.12.11.18.17l-5.83 1.99zm18.34-1.22c.28-.35.84-.19.8.27-.14 1.63-.82 2.78-1.8 3.52-.31.23-.74-.04-.59-.4.36-.88.94-2.13 1.59-3.39z"/></svg>`
        },
        {
            name: 'Trip.com',
            sub: 'Sponsored',
            url: 'https://www.trip.com',
            iconBg: '#2577e3',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5c0 .28-.22.5-.5.5h-1c-.28 0-.5-.22-.5-.5V11H8.5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5H11V6.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5V9h2.5c.28 0 .5.22.5.5v1c0 .28-.22.5-.5.5H13v5.5zm3.5-3.5h-1c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1c.28 0 .5.22.5.5s-.22.5-.5.5zm0-2.5h-1c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1c.28 0 .5.22.5.5s-.22.5-.5.5z"/></svg>`
        },
        {
            name: 'Skyscanner',
            sub: 'Sponsored',
            url: 'https://www.skyscanner.com',
            iconBg: '#0770e3',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 4a8 8 0 0 0-8 8c0 2.21.9 4.21 2.34 5.66l1.41-1.41A5.98 5.98 0 0 1 6 12a6 6 0 0 1 6-6c1.66 0 3.14.67 4.24 1.76l1.42-1.42A7.96 7.96 0 0 0 12 4zm0 4a4 4 0 0 0-4 4c0 1.1.45 2.1 1.17 2.83l1.42-1.42A1.99 1.99 0 0 1 10 12a2 2 0 0 1 2-2c.55 0 1.05.22 1.41.59l1.42-1.42A3.96 3.96 0 0 0 12 8zm0 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>`
        },
        {
            name: 'YouTube',
            sub: 'm.youtube.com',
            url: 'https://www.youtube.com',
            iconBg: '#CC0000',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
        },
        {
            name: 'ChatGPT',
            sub: 'chatgpt.com',
            url: 'https://chatgpt.com',
            iconBg: '#10A37F',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.07-9.52a4.475 4.475 0 0 1 2.34-1.974V12.35l5.843 3.37v2.332a.08.08 0 0 1-.033.062L5.84 21.2a4.5 4.5 0 0 1-3.31-12.416z"/></svg>`
        },
        {
            name: 'GitHub',
            sub: 'github.com',
            url: 'https://www.github.com',
            iconBg: '#24292e',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
        },
        {
            name: 'WhatsApp',
            sub: 'web.whatsapp.com',
            url: 'https://web.whatsapp.com',
            iconBg: '#25D366',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.084 8.084 0 0 1-1.24-4.29c0-4.47 3.64-8.11 8.11-8.11 2.17 0 4.2 1.2 5.73 2.73 1.53 1.54 2.37 3.57 2.37 5.73 0 4.47-3.64 8.1-8.11 8.1z"/></svg>`
        },
        {
            name: 'Reddit',
            sub: 'reddit.com',
            url: 'https://www.reddit.com',
            iconBg: '#FF4500',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm5.5 0c-.688 0-1.25.56-1.25 1.25 0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.096.327.327 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.096z"/></svg>`
        }
    ];

    // Diverse fallback photos matching editorial categories (eliminates repetitive typewriter fallback)
    const DEFAULT_STORY_IMAGES = [
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80"
    ];

    // 3. Primary 8 Rich Editorial Stories (matching reference exactly)
    const PRIMARY_STORIES = [
        {
            title: "After accusing Govinda of infidelity, Sunita Ahuja confident about their reunion: '40-year-old marriage'",
            source: "The Indian Express",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23EA580C'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>IE</text></svg>",
            url: "https://indianexpress.com",
            image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "'Hollywood Se Bhi Better Hai...': Sunny Deol Urges Every Indian To Watch Ramayana, Praises Film's VFX",
            source: "Free Press Journal",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23DC2626'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>F</text></svg>",
            url: "https://freepressjournal.in",
            image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "NSE EGR trading hits record 2.27 lakh units on Dhanteras festival surge",
            source: "Business Line",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563EB'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>bl.</text></svg>",
            url: "https://thehindubusinessline.com",
            image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Ramayana: Kajal Aggarwal on playing Mandodari, says, 'Some roles are bigger than screen time'",
            source: "Mid-Day",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284C7'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>MD</text></svg>",
            url: "https://mid-day.com",
            image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Chemicals to capital goods: What is driving India's push to indigenise 100 critical industrial components",
            source: "The Indian Express",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23EA580C'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>IE</text></svg>",
            url: "https://indianexpress.com",
            image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "No 'Patiala Peg' for fans: Four Diljit Dosanjh songs barred from upcoming concert tour",
            source: "The Telegraph",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>T</text></svg>",
            url: "https://telegraphindia.com",
            image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "iPhone 18 Pro and iPhone 17 Pro: 5 camera tips for stunning low-light festival photography and cinematic video",
            source: "Wion News",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23059669'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>WN</text></svg>",
            url: "https://wionews.com",
            image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "UK plans facial recognition surveillance network to track visa overstayers and border compliance",
            source: "Firstpost",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23D97706'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>FP</text></svg>",
            url: "https://firstpost.com",
            image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"
        }
    ];

    // Extended 8 Real Stories (shown when user clicks "View More Stories")
    const EXTENDED_STORIES = [
        {
            title: "ISRO gears up for Gaganyaan uncrewed orbital mission with advanced crew escape module test",
            source: "NDTV News",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23E11D48'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='11' font-weight='bold' fill='white' text-anchor='middle'>NDTV</text></svg>",
            url: "https://ndtv.com",
            image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Global markets rally as semiconductor fabrication investments cross $500B milestone",
            source: "Reuters",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F97316'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>R</text></svg>",
            url: "https://reuters.com",
            image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "DeepSeek releases open-source reasoning model architecture rivaling proprietary LLMs",
            source: "TechCrunch",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310B981'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>TC</text></svg>",
            url: "https://techcrunch.com",
            image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Cybersecurity researchers uncover zero-click Bluetooth vulnerability impacting millions of legacy devices",
            source: "Wired",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23000000'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>W</text></svg>",
            url: "https://wired.com",
            image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Renewable energy overtakes fossil fuel capacity across European power grid in landmark quarter",
            source: "BBC News",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23B91C1C'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='11' font-weight='bold' fill='white' text-anchor='middle'>BBC</text></svg>",
            url: "https://bbc.com/news",
            image: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "James Webb Space Telescope detects atmospheric water signatures on nearby habitable-zone exoplanet",
            source: "Space.com",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233B82F6'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>S</text></svg>",
            url: "https://space.com",
            image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Electric vehicle battery breakthrough achieves 1,000 km range with 10-minute fast charging",
            source: "Electrek",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2314B8A6'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>E</text></svg>",
            url: "https://electrek.co",
            image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Rust language adoption surges across Linux kernel and Chromium infrastructure for memory safety",
            source: "Ars Technica",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F43F5E'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>ars</text></svg>",
            url: "https://arstechnica.com",
            image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80"
        }
    ];

    const ALL_STORIES = [...PRIMARY_STORIES, ...EXTENDED_STORIES];

    // DOM Elements
    const wallpaperBg = document.getElementById('wallpaperBg');
    const searchForm = document.getElementById('desktopSearchForm');
    const searchInput = document.getElementById('desktopSearchInput');
    const searchEngineIcon = document.getElementById('searchEngineIcon');
    const shortcutsContainer = document.getElementById('shortcutsContainer');
    const storiesGrid = document.getElementById('storiesGrid');
    const storiesRegionSelect = document.getElementById('storiesRegionSelect');
    const btnViewMoreStories = document.getElementById('btnViewMoreStories');
    const btnViewMoreText = document.getElementById('btnViewMoreText');
    const btnFloatingCustomize = document.getElementById('btnFloatingCustomize');
    const wallpaperModal = document.getElementById('wallpaperModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const wallpapersGrid = document.getElementById('wallpapersGrid');
    const btnUploadDeviceImage = document.getElementById('btnUploadDeviceImage');
    const deviceFileInput = document.getElementById('deviceFileInput');

    let isExpandedStories = false;
    let liveFetchedStories = null;

    // 1. Wallpaper Management
    function loadWallpaper() {
        const savedCustom = localStorage.getItem('fokk_custom_wallpaper');
        const savedId = localStorage.getItem('fokk_wallpaper_id');

        if (savedCustom) {
            wallpaperBg.style.backgroundImage = `url("${savedCustom}")`;
            return;
        }

        if (savedId) {
            const match = CURATED_WALLPAPERS.find(w => w.id === savedId);
            if (match) {
                wallpaperBg.style.backgroundImage = `url("${match.url}")`;
                return;
            }
        }

        // Default Sailboat wallpaper
        wallpaperBg.style.backgroundImage = `url("wallpaper_sailboat.jpg")`;
    }

    function setWallpaper(item) {
        localStorage.removeItem('fokk_custom_wallpaper');
        localStorage.setItem('fokk_wallpaper_id', item.id);
        wallpaperBg.style.backgroundImage = `url("${item.url}")`;
        renderWallpaperGrid();
    }

    // Expose setWallpaper globally so browser.js can update all open tabs instantly
    window.setWallpaper = function(itemOrId) {
        if (!itemOrId) return;
        if (typeof itemOrId === 'string') {
            const match = CURATED_WALLPAPERS.find(w => w.id === itemOrId);
            if (match) {
                setWallpaper(match);
            } else {
                localStorage.setItem('fokk_custom_wallpaper', itemOrId);
                wallpaperBg.style.backgroundImage = `url("${itemOrId}")`;
            }
        } else if (itemOrId && itemOrId.url) {
            setWallpaper(itemOrId);
        }
    };

    function renderWallpaperGrid() {
        if (!wallpapersGrid) return;
        const currentId = localStorage.getItem('fokk_wallpaper_id') || 'sailboat';
        const hasCustom = !!localStorage.getItem('fokk_custom_wallpaper');

        wallpapersGrid.innerHTML = CURATED_WALLPAPERS.map(w => `
            <div class="wallpaper-tile ${(!hasCustom && w.id === currentId) ? 'active' : ''}" style="background-image: url('${w.url}')" data-id="${w.id}">
                <div class="wallpaper-tile-label">${w.name}</div>
            </div>
        `).join('');

        wallpapersGrid.querySelectorAll('.wallpaper-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const id = tile.getAttribute('data-id');
                const match = CURATED_WALLPAPERS.find(w => w.id === id);
                if (match) setWallpaper(match);
            });
        });
    }

    // Modal Events
    if (btnFloatingCustomize) {
        btnFloatingCustomize.addEventListener('click', (e) => {
            e.stopPropagation();
            renderWallpaperGrid();
            wallpaperModal.classList.remove('hidden');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            wallpaperModal.classList.add('hidden');
        });
    }

    if (wallpaperModal) {
        wallpaperModal.addEventListener('click', (e) => {
            if (e.target === wallpaperModal) wallpaperModal.classList.add('hidden');
        });
    }

    // Device Upload
    if (btnUploadDeviceImage) {
        btnUploadDeviceImage.addEventListener('click', () => {
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.triggerWallpaperPicker === 'function') {
                window.FokkShieldBridge.triggerWallpaperPicker().then(dataUrl => {
                    if (dataUrl) {
                        localStorage.setItem('fokk_custom_wallpaper', dataUrl);
                        wallpaperBg.style.backgroundImage = `url("${dataUrl}")`;
                        wallpaperModal.classList.add('hidden');
                    }
                }).catch(() => {
                    if (deviceFileInput) deviceFileInput.click();
                });
            } else if (deviceFileInput) {
                deviceFileInput.click();
            }
        });
    }

    if (deviceFileInput) {
        deviceFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = event.target.result;
                    localStorage.setItem('fokk_custom_wallpaper', result);
                    wallpaperBg.style.backgroundImage = `url("${result}")`;
                    wallpaperModal.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 2. Navigation Handler
    function navigateTo(url) {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.openUrl === 'function') {
            window.FokkShieldBridge.openUrl(url);
        } else {
            window.location.href = url;
        }
    }

    // Search Engine Definitions (Matching Image 3 Reference)
    const SEARCH_ENGINES = {
        google: {
            name: 'Google',
            url: 'https://www.google.com/search?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.41l4.03-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>'
        },
        bing: {
            name: 'Bing',
            url: 'https://www.bing.com/search?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 32 32"><defs><linearGradient id="bingStartLg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00BCF2"/><stop offset="100%" stop-color="#0078D4"/></linearGradient></defs><path fill="url(#bingStartLg)" d="M8 3v21.5c0 1.2 1 2.2 2.2 2.3 3.5.3 8.5.5 12.5-3.2 3.6-3.4 3.7-8.8 1-12.8L16.5 6v9.5c0 .8-.7 1.5-1.5 1.5-.7 0-1.3-.5-1.5-1.2l-.5-1.6V3c0-.8-.7-1.5-1.5-1.5S8 2.2 8 3z"/></svg>'
        },
        brave: {
            name: 'Brave',
            url: 'https://search.brave.com/search?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 32 32"><path fill="#FF3300" d="M16 2l-10 4.2v8.5c0 7.2 4.3 13.8 10 16.3 5.7-2.5 10-9.1 10-16.3V6.2L16 2z"/><path fill="#FFF" d="M16 8l-4.5 2.5 1.4 6 3.1-1.5 3.1 1.5 1.4-6L16 8zm0 10.5l-3.2 2 1.2 4 2-1.2 2 1.2 1.2-4-3.2-2z"/><path fill="#FF7700" d="M12.5 13.5l3.5-1.8 3.5 1.8-1 4.5-2.5-1.2-2.5 1.2-1-4.5z"/></svg>'
        },
        duckduckgo: {
            name: 'DuckDuckGo',
            url: 'https://duckduckgo.com/?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#DE5833"/><path fill="#FFFFFF" d="M16 6c-3.9 0-7 3.1-7 7 0 2.2 1 4.1 2.6 5.4-.1.6-.4 1.9-1.6 3.1 1.8.1 3.5-.7 4.6-2 .5.1.9.1 1.4.1 3.9 0 7-3.1 7-7s-3.1-6.6-7-6.6z"/><circle cx="13.5" cy="11.5" r="1.5" fill="#333333"/><path fill="#F9A825" d="M17.5 14.5c0 0 3.5.5 5 2.5-1.5 1-4 1.5-6.5 1 0 0 2.5-1 1.5-3.5z"/><path fill="#4CAF50" d="M14 23.5l2-1.5 2 1.5-2 1.5-2-1.5z"/></svg>'
        },
        startpage: {
            name: 'Startpage',
            url: 'https://www.startpage.com/sp/search?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1A1C24"/><path fill="#3661FF" d="M7 14c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.8 0-3.5-.6-4.8-1.7l-4.5 4.5-1.4-1.4 4.5-4.5C7.6 17.5 7 15.8 7 14zm8-5.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5-2.5-5.5-5.5-5.5z"/><path d="M7 25.5c3.5-1.8 8.5-1.8 12 0" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>'
        },
        ecosia: {
            name: 'Ecosia',
            url: 'https://www.ecosia.org/search?q=',
            iconSvg: '<svg width="22" height="22" viewBox="0 0 32 32"><path fill="#48B25A" d="M16 4C10.5 4 6 8.5 6 14c0 3.2 1.5 6 3.8 7.8v.2c0 .5.2 1 .5 1.4.3.4.7.6 1.2.6h9c.5 0 .9-.2 1.2-.6.3-.4.5-.9.5-1.4v-.2C24.5 20 26 17.2 26 14c0-5.5-4.5-10-10-10z"/><path fill="#FFFFFF" d="M16 16v8m-2.5-4l2.5-3 2.5 3" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        }
    };

    function getActiveEngine() {
        const id = localStorage.getItem('fokk_search_engine') || 'google';
        return SEARCH_ENGINES[id] || SEARCH_ENGINES.google;
    }

    function updateSearchEngineUI() {
        const engine = getActiveEngine();
        if (searchEngineIcon) {
            searchEngineIcon.innerHTML = engine.iconSvg;
            searchEngineIcon.title = engine.name;
        }
        if (searchInput) {
            searchInput.placeholder = `Search with ${engine.name} or enter address`;
        }
    }

    // 3. Search Bar Handling
    if (searchForm && searchInput) {
        updateSearchEngineUI();

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;

            let targetUrl = '';
            if (/^https?:\/\//i.test(query)) {
                targetUrl = query;
            } else if (query.includes('.') && !query.includes(' ')) {
                targetUrl = 'https://' + query;
            } else {
                targetUrl = getActiveEngine().url + encodeURIComponent(query);
            }

            navigateTo(targetUrl);
        });
    }

    // 4. Render Shortcuts (High-Res Favicons + Custom User Shortcuts + In-Page Modal)
    function getCombinedShortcuts() {
        let removed = new Set();
        try {
            const rawRem = localStorage.getItem('fokk_removed_shortcuts');
            if (rawRem) removed = new Set(JSON.parse(rawRem));
        } catch (_) {}

        let custom = [];
        try {
            const raw = localStorage.getItem('fokk_desktop_shortcuts') || localStorage.getItem('fokk_custom_shortcuts');
            if (raw) custom = JSON.parse(raw);
        } catch (_) {}

        const seenUrls = new Set();
        const validShortcuts = [];

        // Add non-removed default shortcuts
        for (const d of DEFAULT_SHORTCUTS) {
            const norm = d.url.replace(/\/$/, '');
            if (!removed.has(norm) && !seenUrls.has(norm)) {
                seenUrls.add(norm);
                validShortcuts.push(d);
            }
        }

        // Add non-removed custom shortcuts
        for (const c of custom) {
            const norm = (c.url || '').replace(/\/$/, '');
            if (norm && !removed.has(norm) && !seenUrls.has(norm)) {
                seenUrls.add(norm);
                let host = '';
                try { host = new URL(c.url).hostname; } catch(_) { host = c.url; }
                validShortcuts.push({
                    name: c.name || c.title || host.replace('www.', ''),
                    url: c.url,
                    sub: host,
                    isCustom: true
                });
            }
        }
        return validShortcuts;
    }

    function renderShortcuts() {
        if (!shortcutsContainer) return;
        const allShortcuts = getCombinedShortcuts();

        const tilesHtml = allShortcuts.map((s) => {
            let hostname = '';
            try { hostname = new URL(s.url).hostname; } catch(_) { hostname = s.url; }
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
            const firstLetter = (s.name || 'W').charAt(0).toUpperCase();

            return `
                <div class="shortcut-tile" data-url="${s.url}" title="${s.name}">
                    <div class="shortcut-icon-card" style="background-color: ${s.iconBg || 'rgba(43,42,51,0.85)'}">
                        <img src="${faviconUrl}" class="shortcut-favicon-img" alt="${s.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="shortcut-fallback-icon" style="display: none;">
                            ${s.iconSvg ? s.iconSvg : `<span class="shortcut-letter">${firstLetter}</span>`}
                        </div>
                        <button class="shortcut-del-btn" data-url="${s.url}" title="Remove Shortcut">&times;</button>
                    </div>
                    <span class="shortcut-label">${s.name}</span>
                    ${s.sub ? `<span class="shortcut-sub">${s.sub}</span>` : ''}
                </div>
            `;
        }).join('');

        const addTileHtml = `
            <div class="shortcut-tile add-shortcut-tile" id="btnAddShortcutTile" title="Add Custom Shortcut">
                <div class="shortcut-icon-card add-shortcut-card">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </div>
                <span class="shortcut-label">Add Tile</span>
            </div>
        `;

        shortcutsContainer.innerHTML = tilesHtml + addTileHtml;

        // Navigation click handlers
        shortcutsContainer.querySelectorAll('.shortcut-tile:not(.add-shortcut-tile)').forEach(tile => {
            tile.addEventListener('click', (e) => {
                if (e.target.classList.contains('shortcut-del-btn')) return;
                const url = tile.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });

        // Delete handlers for all shortcuts
        shortcutsContainer.querySelectorAll('.shortcut-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const toDel = btn.getAttribute('data-url');
                const norm = (toDel || '').replace(/\/$/, '');

                // 1. Add to removed set
                try {
                    let removed = JSON.parse(localStorage.getItem('fokk_removed_shortcuts') || '[]');
                    if (!removed.includes(norm)) removed.push(norm);
                    localStorage.setItem('fokk_removed_shortcuts', JSON.stringify(removed));
                } catch (_) {}

                // 2. Also remove from custom list if present
                try {
                    let custom = JSON.parse(localStorage.getItem('fokk_desktop_shortcuts') || '[]');
                    custom = custom.filter(c => (c.url || '').replace(/\/$/, '') !== norm);
                    localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(custom));
                    localStorage.setItem('fokk_custom_shortcuts', JSON.stringify(custom));
                } catch (_) {}

                renderShortcuts();
            });
        });

        // Add Shortcut Tile Modal Trigger
        const addBtn = document.getElementById('btnAddShortcutTile');
        const modal = document.getElementById('addShortcutModal');
        const titleInput = document.getElementById('shortcutTitleInput');
        const urlInput = document.getElementById('shortcutUrlInput');
        const previewImg = document.getElementById('shortcutPreviewImg');
        const previewFallback = document.getElementById('shortcutPreviewFallback');
        const previewName = document.getElementById('previewName');
        const previewUrl = document.getElementById('previewUrl');
        const btnCancel = document.getElementById('btnCancelShortcut');
        const btnSave = document.getElementById('btnSaveShortcut');
        const btnClose = document.getElementById('btnCloseShortcutModal');

        if (addBtn && modal) {
            function updatePreview() {
                const rawUrl = (urlInput.value || '').trim();
                const rawTitle = (titleInput.value || '').trim();

                if (!rawUrl) {
                    previewUrl.textContent = 'example.com';
                    previewImg.style.display = 'none';
                    previewFallback.style.display = 'flex';
                    previewFallback.textContent = rawTitle ? rawTitle.charAt(0).toUpperCase() : 'W';
                    previewName.textContent = rawTitle || 'Shortcut Name';
                    return;
                }

                let host = rawUrl.replace(/^https?:\/\//i, '').split('/')[0];
                previewUrl.textContent = host;

                const autoTitle = host.replace(/^www\./i, '').split('.')[0];
                const displayName = rawTitle || (autoTitle ? autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1) : 'Shortcut');
                previewName.textContent = displayName;
                previewFallback.textContent = displayName.charAt(0).toUpperCase();

                const faviconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
                previewImg.src = faviconUrl;
                previewImg.onload = () => {
                    previewImg.style.display = 'block';
                    previewFallback.style.display = 'none';
                };
                previewImg.onerror = () => {
                    previewImg.style.display = 'none';
                    previewFallback.style.display = 'flex';
                };
            }

            addBtn.onclick = () => {
                titleInput.value = '';
                urlInput.value = '';
                updatePreview();
                modal.classList.remove('hidden');
                setTimeout(() => urlInput.focus(), 50);
            };

            urlInput.oninput = updatePreview;
            titleInput.oninput = updatePreview;

            btnCancel.onclick = () => modal.classList.add('hidden');
            if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');

            modal.onclick = (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            };

            btnSave.onclick = () => {
                let rawUrl = (urlInput.value || '').trim();
                if (!rawUrl) return;

                const validUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
                let host = '';
                try { host = new URL(validUrl).hostname; } catch(_) { host = rawUrl; }

                let name = (titleInput.value || '').trim();
                if (!name) {
                    const cleanHost = host.replace(/^www\./i, '').split('.')[0];
                    name = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
                }

                // If previously in removed list, un-remove it
                try {
                    let removed = JSON.parse(localStorage.getItem('fokk_removed_shortcuts') || '[]');
                    const norm = validUrl.replace(/\/$/, '');
                    removed = removed.filter(u => u !== norm);
                    localStorage.setItem('fokk_removed_shortcuts', JSON.stringify(removed));
                } catch (_) {}

                // Save to custom shortcuts
                try {
                    let custom = JSON.parse(localStorage.getItem('fokk_desktop_shortcuts') || '[]');
                    custom.push({ name, url: validUrl, sub: host, isCustom: true });
                    localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(custom));
                    localStorage.setItem('fokk_custom_shortcuts', JSON.stringify(custom));
                } catch (_) {}

                modal.classList.add('hidden');
                renderShortcuts();
            };
        }
    }

    // 5. Render Stories (Firefox Style Grid - 8 Default or 16 Extended)
    function renderStories(items) {
        if (!storiesGrid) return;
        const sourceList = (items && items.length >= 4) ? items : ALL_STORIES;
        const list = isExpandedStories ? sourceList.slice(0, 16) : sourceList.slice(0, 8);

        storiesGrid.innerHTML = list.map((story, idx) => {
            const fallbackImg = DEFAULT_STORY_IMAGES[idx % DEFAULT_STORY_IMAGES.length];
            const imgSrc = story.image || story.img || fallbackImg;
            return `
                <div class="firefox-card" data-url="${story.url}">
                    <div class="card-img-wrap">
                        <img class="card-img" src="${imgSrc}" alt="News thumbnail" loading="lazy">
                    </div>
                    <div class="card-body">
                        <h3 class="card-headline">${story.title}</h3>
                        <div class="card-source-bar">
                            ${story.sourceIcon ? `<img class="source-icon" src="${story.sourceIcon}" alt="">` : ''}
                            <span class="source-name">${story.source || 'News'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        storiesGrid.querySelectorAll('.firefox-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });
    }

    // View More Stories Button Handler
    if (btnViewMoreStories) {
        btnViewMoreStories.addEventListener('click', () => {
            isExpandedStories = !isExpandedStories;
            btnViewMoreStories.classList.toggle('expanded', isExpandedStories);
            if (btnViewMoreText) {
                btnViewMoreText.textContent = isExpandedStories ? 'Show Fewer Stories' : 'View More Stories';
            }
            renderStories(liveFetchedStories || ALL_STORIES);
        });
    }

    function fetchStories(region = 'global') {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getLiveNews === 'function') {
            try {
                const raw = window.FokkShieldBridge.getLiveNews('all', region);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        liveFetchedStories = parsed;
                        renderStories(parsed);
                        return;
                    }
                }
            } catch (e) {}
        }
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.refreshLiveNews === 'function') {
            try {
                window.FokkShieldBridge.refreshLiveNews('all', region);
            } catch (e) {}
        }
        liveFetchedStories = null;
        renderStories(ALL_STORIES);
    }

    if (storiesRegionSelect) {
        storiesRegionSelect.addEventListener('change', (e) => {
            fetchStories(e.target.value);
        });
    }

    window.addEventListener('fokk-live-news-updated', (event) => {
        let stories = null;
        let incomingRegion = null;
        if (Array.isArray(event.detail)) {
            stories = event.detail;
        } else if (event.detail && Array.isArray(event.detail.stories)) {
            stories = event.detail.stories;
            incomingRegion = event.detail.region;
        }

        const currentRegion = storiesRegionSelect ? storiesRegionSelect.value : 'global';
        if (incomingRegion && incomingRegion !== currentRegion) return;

        if (stories && stories.length > 0) {
            liveFetchedStories = stories;
            renderStories(stories);
        }
    });

    // Listen for storage changes across tabs to update wallpaper and engine in real time
    window.addEventListener('storage', (e) => {
        if (e.key === 'fokk_wallpaper_id' || e.key === 'fokk_custom_wallpaper') {
            loadWallpaper();
            renderWallpaperGrid();
        }
        if (e.key === 'fokk_search_engine') {
            updateSearchEngineUI();
        }
    });

    // Initialize Page
    loadWallpaper();
    renderShortcuts();
    fetchStories('global');
})();
