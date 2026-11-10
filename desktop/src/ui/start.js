// Fokk Desktop Start Page Logic (Firefox Desktop Layout)

(function() {
    'use strict';

    // Immediate Theme Initialization
    try {
        const savedTheme = localStorage.getItem('fokk_theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('theme-light');
        } else {
            document.body.classList.remove('theme-light');
        }
    } catch (_) {}

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

    // 2. High-Quality Vector Shortcuts (Authentic Official Brand Vectors matching Image 2 reference)
    const DEFAULT_SHORTCUTS = [
        {
            name: 'YouTube',
            sub: 'youtube.com',
            url: 'https://www.youtube.com',
            iconBg: '#FF0000',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M29.6 9.2c-.3-1.3-1.3-2.3-2.6-2.6C24.7 6 16 6 16 6s-8.7 0-11 .6c-1.3.3-2.3 1.3-2.6 2.6C1.8 11.5 1.8 16 1.8 16s0 4.5.6 6.8c.3 1.3 1.3 2.3 2.6 2.6 2.3.6 11 .6 11 .6s8.7 0 11-.6c1.3-.3 2.3-1.3 2.6-2.6.6-2.3.6-6.8.6-6.8s0-4.5-.6-6.8zM13.2 20.2V11.8l7.4 4.2-7.4 4.2z"/></svg>`
        },
        {
            name: 'Instagram',
            sub: 'instagram.com',
            url: 'https://www.instagram.com',
            iconBg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M16 5.8c3.3 0 3.7 0 5 .1 1.2.1 1.9.3 2.3.4.6.2 1 .5 1.5 1 .5.5.8.9 1 1.5.2.4.3 1.1.4 2.3.1 1.3.1 1.7.1 5s0 3.7-.1 5c-.1 1.2-.3 1.9-.4 2.3-.2.6-.5 1-1 1.5-.5.5-.9.8-1.5 1-.4.2-1.1.3-2.3.4-1.3.1-1.7.1-5 .1s-3.7 0-5-.1c-1.2-.1-1.9-.3-2.3-.4-.6-.2-1-.5-1.5-1-.5-.5-.8-.9-1-1.5-.2-.4-.3-1.1-.4-2.3-.1-1.3-.1-1.7-.1-5s0-3.7.1-5c.1-1.2.3-1.9.4-2.3.2-.6.5-1 1-1.5.5-.5.9-.8 1.5-1 .4-.2 1.1-.3 2.3-.4 1.3-.1 1.7-.1 5-.1zm0-3.3c-3.4 0-3.8 0-5.1.1-1.3.1-2.2.3-3 .6-.8.3-1.5.8-2.2 1.5-.7.7-1.2 1.4-1.5 2.2-.3.8-.5 1.7-.6 3-.1 1.3-.1 1.7-.1 5.1s0 3.8.1 5.1c.1 1.3.3 2.2.6 3 .3.8.8 1.5 1.5 2.2.7.7 1.4 1.2 2.2 1.5.8.3 1.7.5 3 .6 1.3.1 1.7.1 5.1.1s3.8 0 5.1-.1c1.3-.1 2.2-.3 3-.6.8-.3 1.5-.8 2.2-1.5.7-.7 1.2-1.4 1.5-2.2.3-.8.5-1.7.6-3 .1-1.3.1-1.7.1-5.1s0-3.8-.1-5.1c-.1-1.3-.3-2.2-.6-3-.3-.8-.8-1.5-1.5-2.2-.7-.7-1.4-1.2-2.2-1.5-.8-.3-1.7-.5-3-.6-1.3-.1-1.7-.1-5.1-.1zm0 7.3a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm8-10.7a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z"/></svg>`
        },
        {
            name: 'Google',
            sub: 'google.com',
            url: 'https://www.google.com',
            iconBg: '#FFFFFF',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#4285F4" d="M30.5 16.3c0-1.1-.1-2.1-.3-3.1H16v6.2h8.2c-.4 2-1.5 3.8-3.1 5v4.1h5c2.9-2.7 4.6-6.8 4.6-12.2z"/><path fill="#34A853" d="M16 31c4.1 0 7.5-1.4 10-3.7l-5-4.1c-1.4.9-3.2 1.5-5 1.5-3.9 0-7.2-2.6-8.4-6.2H2.4v4.2C5 27.9 10.1 31 16 31z"/><path fill="#FBBC05" d="M7.6 18.5c-.3-.9-.5-1.8-.5-2.8s.2-1.9.5-2.8V8.7H2.4C1.3 11 0.7 13.4 0.7 16s.6 5 1.7 7.3l5.2-4.8z"/><path fill="#EA4335" d="M16 7.2c2.2 0 4.2.8 5.8 2.3l4.3-4.3C23.5 2.8 20.1 1.7 16 1.7 10.1 1.7 5 4.8 2.4 9.9l5.2 4.1C8.8 9.8 12.1 7.2 16 7.2z"/></svg>`
        },
        {
            name: 'WhatsApp',
            sub: 'web.whatsapp.com',
            url: 'https://web.whatsapp.com',
            iconBg: '#25D366',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M16 2.5C8.544 2.5 2.5 8.544 2.5 16c0 2.544.704 4.928 1.92 6.976L2.6 29.4l6.624-1.76A13.435 13.435 0 0 0 16 29.5c7.456 0 13.5-6.044 13.5-13.5S23.456 2.5 16 2.5zm7.84 19.04c-.32.928-1.6 1.76-2.592 1.984-.672.16-1.568.288-4.512-.928-3.776-1.568-6.176-5.408-6.368-5.664-.16-.256-1.504-2.016-1.504-3.84s.96-2.72 1.312-3.072c.352-.352.768-.448 1.024-.448.256 0 .512.032.736.032.224 0 .544-.096.864.672.32.768 1.12 2.72 1.216 2.912.096.192.16.416.032.672-.128.256-.192.416-.384.64-.192.224-.416.48-.576.64-.192.192-.384.416-.16.8.224.384.992 1.632 2.144 2.656 1.472 1.312 2.72 1.728 3.104 1.92.384.192.608.16.832-.096.224-.256.96-1.12 1.216-1.504.256-.384.512-.32.864-.192.352.128 2.24 1.056 2.624 1.248.384.192.64.288.736.448.096.16.096.96-.224 1.888z"/></svg>`
        },
        {
            name: 'Reddit',
            sub: 'reddit.com',
            url: 'https://www.reddit.com',
            iconBg: '#FF4500',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M28.5 14.5c0-1.4-1.1-2.5-2.5-2.5-.7 0-1.3.3-1.8.8-2-1.4-4.8-2.3-7.8-2.4l1.3-6.2 4.3.9c.1 1.1 1 1.9 2.1 1.9 1.2 0 2.2-1 2.2-2.2s-1-2.2-2.2-2.2c-.8 0-1.5.5-1.9 1.1l-4.8-1c-.3-.1-.6.1-.7.4l-1.5 7.1c-3.1.1-5.9 1-7.9 2.4-.5-.5-1.1-.8-1.8-.8-1.4 0-2.5 1.1-2.5 2.5 0 .9.5 1.7 1.2 2.1-.1.5-.1 1-.1 1.5 0 4.1 4.5 7.5 10 7.5s10-3.4 10-7.5c0-.5 0-1-.1-1.5.7-.4 1.2-1.2 1.2-2.1zm-17.5 3c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8.8-1.8 1.8-1.8zm10 5.4c-1.5 1.5-4.4 1.6-5 1.6s-3.5-.1-5-1.6c-.2-.2-.2-.5 0-.7.2-.2.5-.2.7 0 1.1 1.1 3.4 1.3 4.3 1.3s3.2-.2 4.3-1.3c.2-.2.5-.2.7 0 .2.2.2.5 0 .7zm-.2-3.6c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z"/></svg>`
        },
        {
            name: 'ChatGPT',
            sub: 'chatgpt.com',
            url: 'https://chatgpt.com',
            iconBg: '#10A37F',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M29.6 13.1c-.3-2.1-1.6-3.9-3.5-4.8-.4-.2-.8-.4-1.2-.5-.4-2.5-2.2-4.5-4.7-5.1-1.9-.5-3.9-.2-5.6.8-.7-.4-1.5-.7-2.3-.8-2.6-.4-5.2.9-6.4 3.2-1.2 2.3-1 5.1.5 7.1-.4.6-.7 1.3-.8 2-.5 2.5.2 5.1 1.9 6.9-.3.8-.4 1.6-.4 2.4 0 2.6 1.4 5 3.7 6.2 2.3 1.2 5 1.1 7.2-.3.6.4 1.3.6 2 .7 2.6.4 5.2-.9 6.4-3.2 1.2-2.3 1-5.1-.5-7.1.4-.6.7-1.3.8-2 .5-2.4-.2-5-2.1-6.7zM17.6 29c-1.7 0-3.3-.7-4.5-2l2.4-1.4c.5.3 1.1.5 1.7.5 1.7 0 3.2-1.2 3.5-2.9l.1-.5 5.2 3c-2 2-5 3.3-8.4 3.3zm-8.8-4.5c-1.3-1.1-2-2.7-2-4.3 0-.6.1-1.2.3-1.8l2.4 1.4c-.2.5-.3 1.1-.3 1.7 0 1.7 1.1 3.2 2.7 3.7l.5.2-3 5.1c-.2-.6-.4-1.3-.6-2.1v-3.9zm-3-10.4c.5-1.6 1.7-2.9 3.3-3.6l1.4 2.4c-.5.3-.9.7-1.2 1.2-.9 1.4-.8 3.3.3 4.6l.3.4-3 5.2c-1.4-1.8-1.7-4.2-1.1-6.6l.3-3.6zm19.6-3.5l-5.2-3c2-2 5-3.3 8.4-3.3 1.7 0 3.3.7 4.5 2l-2.4 1.4c-.5-.3-1.1-.5-1.7-.5-1.7 0-3.2 1.2-3.5 2.9l-.1.5zm3.5 7.1c.2-.5.3-1.1.3-1.7 0-1.7-1.1-3.2-2.7-3.7l-.5-.2 3-5.1c1.5 1.2 2.4 2.9 2.6 4.8.2 1.9-.3 3.8-1.3 5.4l-1.4-.5zm-4.7 3.5c-.3.4-.6.8-1 1.1-1.4.9-3.2.8-4.6-.3l-.4-.3 3-5.2c1.4 1.8 1.7 4.2 1.1 6.6l-.3 3.6-1.4-2.4c1.1-1 1.7-2.4 1.7-3.9 0-.4 0-.8-.1-1.2l2.5 1.5c-.2.2-.4.4-.5.5z"/></svg>`
        },
        {
            name: 'GitHub',
            sub: 'github.com',
            url: 'https://www.github.com',
            iconBg: '#18181B',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FFFFFF" d="M16 2C8.27 2 2 8.27 2 16c0 6.18 4.01 11.43 9.57 13.28.7.13.96-.3.96-.67 0-.33-.01-1.42-.02-2.58-3.89.85-4.71-1.65-4.71-1.65-.64-1.61-1.56-2.04-1.56-2.04-1.27-.87.1-.85.1-.85 1.4.1 2.14 1.44 2.14 1.44 1.25 2.14 3.28 1.52 4.08 1.16.13-.91.49-1.52.89-1.87-3.11-.35-6.38-1.55-6.38-6.92 0-1.53.55-2.78 1.44-3.76-.14-.35-.63-1.78.14-3.71 0 0 1.18-.38 3.85 1.44 1.12-.31 2.32-.47 3.51-.47 1.19 0 2.39.16 3.51.47 2.67-1.81 3.84-1.44 3.84-1.44.77 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.38-3.28 6.56-6.4 6.91.5.43.95 1.28.95 2.58 0 1.86-.02 3.36-.02 3.82 0 .37.26.81.97.67C25.99 27.42 30 22.18 30 16c0-7.73-6.27-14-14-14z"/></svg>`
        },
        {
            name: 'Amazon',
            sub: 'amazon.com',
            url: 'https://www.amazon.com',
            iconBg: '#232F3E',
            iconSvg: `<svg viewBox="0 0 32 32"><path fill="#FF9900" d="M19.3 15.6c0-2.3-.2-4-2.4-4-1.5 0-2.3 1.1-2.6 2.1l5 1.9zm2.6-7h3.1v12.3c0 1.7.1 3 1.1 3.9l-3 1.5c-.8-.9-1-2.1-1.1-3-.9 1.4-2.6 2.4-4.8 2.4-3.6 0-5.9-2.6-5.9-6.2 0-4 3-6.2 6.3-6.2 1.8 0 3.1.6 3.8 1.3V8.6h.6zm-19.8 16c6.4 4.6 15.6 6.8 24.2 3.5.9-.3.9-1.4-.1-1.5-5.4-.7-10.7-2.7-15.3-5.8-.6-.4-1.3.2-.7.7l-8.1 3.1zm26.4-1.7c.4-.5 1.2-.3 1.1.4-.2 2.3-1.2 4-2.6 5-.4.3-1.1-.1-.8-.6.5-1.3 1.3-3.1 2.3-4.8z"/></svg>`
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
    const suggestionsDropdown = document.getElementById('searchSuggestionsDropdown');
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
        let id = 'bing';
        try {
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getSearchEngine === 'function') {
                id = window.FokkShieldBridge.getSearchEngine() || id;
            } else {
                id = localStorage.getItem('fokk_search_engine') || id;
            }
        } catch (_) {
            id = localStorage.getItem('fokk_search_engine') || 'bing';
        }
        id = (id || 'bing').toLowerCase();
        return SEARCH_ENGINES[id] || SEARCH_ENGINES.bing;
    }

    function updateSearchEngineUI(engineId) {
        if (engineId && SEARCH_ENGINES[engineId.toLowerCase()]) {
            try {
                localStorage.setItem('fokk_search_engine', engineId.toLowerCase());
            } catch (_) {}
        }
        const engine = getActiveEngine();
        if (searchEngineIcon) {
            searchEngineIcon.innerHTML = engine.iconSvg;
            searchEngineIcon.title = `${engine.name} (Click to switch engine)`;
        }
        if (searchInput) {
            searchInput.placeholder = `Search with ${engine.name} or enter address`;
        }
    }

    // Expose on window for webview script injection & preload bridge
    window.updateSearchEngineUI = updateSearchEngineUI;

    // Listen for custom bridge event
    window.addEventListener('fokk-search-engine-change', (e) => {
        if (e.detail && e.detail.engineId) {
            updateSearchEngineUI(e.detail.engineId);
        }
    });

    // Interactive Search Engine Switcher on Icon Click
    if (searchEngineIcon) {
        searchEngineIcon.style.cursor = 'pointer';
        searchEngineIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const keys = Object.keys(SEARCH_ENGINES);
            const cur = getActiveEngine();
            const curKey = keys.find(k => SEARCH_ENGINES[k].name === cur.name) || 'bing';
            const nextIdx = (keys.indexOf(curKey) + 1) % keys.length;
            const nextKey = keys[nextIdx];
            updateSearchEngineUI(nextKey);
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.setSearchEngine === 'function') {
                window.FokkShieldBridge.setSearchEngine(nextKey);
            }
        });
    }

    // 3. Search Bar Handling & Real-Time Auto-Suggestions
    function executeSearch(rawQuery) {
        const query = (rawQuery || '').trim();
        if (!query) return;

        let targetUrl = '';
        if (/^https?:\/\//i.test(query)) {
            targetUrl = query;
        } else if (/^localhost(:\d+)?(\/.*)?$/i.test(query) || /^127\.0\.0\.1(:\d+)?(\/.*)?$/i.test(query)) {
            targetUrl = 'http://' + query;
        } else if (query.includes('.') && !query.includes(' ')) {
            targetUrl = 'https://' + query;
        } else {
            targetUrl = getActiveEngine().url + encodeURIComponent(query);
        }

        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.openUrl === 'function') {
            window.FokkShieldBridge.openUrl(targetUrl);
        } else {
            window.location.href = targetUrl;
        }
    }

    if (searchForm && searchInput) {
        updateSearchEngineUI();

        let activeSuggestionIndex = -1;
        let currentSuggestions = [];
        let debounceTimer = null;
        let lastQueriedText = '';
        let originalTypedText = '';

        function escapeSuggestionHtml(str) {
            const div = document.createElement('div');
            div.textContent = str || '';
            return div.innerHTML;
        }

        function hideSuggestions() {
            activeSuggestionIndex = -1;
            currentSuggestions = [];
            if (suggestionsDropdown) {
                suggestionsDropdown.classList.add('hidden');
                suggestionsDropdown.innerHTML = '';
            }
        }

        function updateActiveSuggestion(items) {
            items.forEach((it, idx) => {
                if (idx === activeSuggestionIndex) {
                    it.classList.add('active');
                    searchInput.value = currentSuggestions[idx] || originalTypedText;
                    try { it.scrollIntoView({ block: 'nearest' }); } catch (_) {}
                } else {
                    it.classList.remove('active');
                }
            });
        }

        function renderSuggestions(suggestions, query) {
            if (!suggestionsDropdown || !suggestions || suggestions.length === 0) {
                hideSuggestions();
                return;
            }

            currentSuggestions = suggestions;
            activeSuggestionIndex = -1;
            suggestionsDropdown.innerHTML = '';

            suggestions.forEach((itemText, idx) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'search-suggestion-item';
                itemEl.setAttribute('role', 'option');
                itemEl.setAttribute('data-index', idx);
                itemEl.innerHTML = `
                    <span class="search-suggestion-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <circle cx="11" cy="11" r="7"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </span>
                    <span class="search-suggestion-text">${escapeSuggestionHtml(itemText)}</span>
                    <span class="search-suggestion-arrow">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="7" y1="17" x2="17" y2="7"/>
                            <polyline points="7 7 17 7 17 17"/>
                        </svg>
                    </span>
                `;

                // Prevent blur on mouse down
                itemEl.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                });

                itemEl.addEventListener('click', () => {
                    searchInput.value = itemText;
                    hideSuggestions();
                    executeSearch(itemText);
                });

                suggestionsDropdown.appendChild(itemEl);
            });

            suggestionsDropdown.classList.remove('hidden');
        }

        async function requestSuggestions(text) {
            const query = (text || '').trim();
            if (!query || /^https?:\/\//i.test(query) || (query.includes('.') && !query.includes(' '))) {
                hideSuggestions();
                return;
            }

            lastQueriedText = query;
            try {
                let list = [];
                if (window.FokkShieldBridge && typeof window.FokkShieldBridge.fetchSearchSuggestions === 'function') {
                    list = await window.FokkShieldBridge.fetchSearchSuggestions(query);
                } else if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getSearchSuggestions === 'function') {
                    list = await window.FokkShieldBridge.getSearchSuggestions(query);
                }

                if (searchInput.value.trim() !== lastQueriedText) {
                    return; // Input changed while waiting
                }

                if (Array.isArray(list) && list.length > 0) {
                    renderSuggestions(list, query);
                } else {
                    hideSuggestions();
                }
            } catch (_) {
                hideSuggestions();
            }
        }

        searchInput.addEventListener('input', () => {
            originalTypedText = searchInput.value;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                requestSuggestions(searchInput.value);
            }, 120);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (!suggestionsDropdown || suggestionsDropdown.classList.contains('hidden') || currentSuggestions.length === 0) {
                return;
            }

            const items = suggestionsDropdown.querySelectorAll('.search-suggestion-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeSuggestionIndex <= 0) {
                    activeSuggestionIndex = -1;
                    searchInput.value = originalTypedText;
                    items.forEach(it => it.classList.remove('active'));
                } else {
                    activeSuggestionIndex--;
                    updateActiveSuggestion(items);
                }
            } else if (e.key === 'Escape') {
                hideSuggestions();
            } else if (e.key === 'Enter') {
                if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
                    e.preventDefault();
                    const selected = currentSuggestions[activeSuggestionIndex];
                    searchInput.value = selected;
                    hideSuggestions();
                    executeSearch(selected);
                }
            }
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0 && currentSuggestions.length > 0) {
                if (suggestionsDropdown) suggestionsDropdown.classList.remove('hidden');
            } else if (searchInput.value.trim().length > 0) {
                requestSuggestions(searchInput.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.firefox-search-wrap')) {
                hideSuggestions();
            }
        });

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            hideSuggestions();
            executeSearch(searchInput.value);
        });
    }

    // 4. Render Shortcuts (Unified Editable List + Crisp Authentic Vectors + In-Page Modal)
    function getSavedShortcuts() {
        let list = [];
        try {
            const raw = localStorage.getItem('fokk_desktop_shortcuts');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    list = parsed;
                }
            }
        } catch (_) {}

        if (list.length === 0) {
            let removed = new Set();
            try {
                const remRaw = localStorage.getItem('fokk_removed_shortcuts');
                if (remRaw) removed = new Set(JSON.parse(remRaw));
            } catch (_) {}

            list = DEFAULT_SHORTCUTS.filter(d => !removed.has(d.url.replace(/\/$/, ''))).map(d => ({
                name: d.name,
                url: d.url,
                sub: d.sub || '',
                iconBg: d.iconBg || '',
                iconSvg: d.iconSvg || ''
            }));
        }

        // Always ensure default brand shortcuts have their authentic crisp official SVGs & colors
        list.forEach(item => {
            const norm = (item.url || '').replace(/\/$/, '').toLowerCase();
            const def = DEFAULT_SHORTCUTS.find(d => 
                d.url.replace(/\/$/, '').toLowerCase() === norm ||
                d.name.toLowerCase() === (item.name || '').toLowerCase()
            );
            if (def) {
                item.iconSvg = def.iconSvg;
                item.iconBg = def.iconBg;
                if (!item.sub) item.sub = def.sub;
            }
        });

        try { localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(list)); } catch (_) {}
        return list;
    }

    function saveShortcutsList(list) {
        localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(list));
        localStorage.setItem('fokk_custom_shortcuts', JSON.stringify(list));
    }

    // Modal elements
    let editingOriginalUrl = null;
    const shortcutTitleInput = document.getElementById('shortcutTitleInput');
    const shortcutUrlInput = document.getElementById('shortcutUrlInput');
    const shortcutPreviewImg = document.getElementById('shortcutPreviewImg');
    const shortcutPreviewFallback = document.getElementById('shortcutPreviewFallback');
    const previewName = document.getElementById('previewName');
    const previewUrl = document.getElementById('previewUrl');
    const btnCancelShortcut = document.getElementById('btnCancelShortcut');
    const btnSaveShortcut = document.getElementById('btnSaveShortcut');
    const btnCloseShortcutModal = document.getElementById('btnCloseShortcutModal');

    function updateShortcutPreview() {
        const urlInputEl = document.getElementById('shortcutUrlInput');
        const titleInputEl = document.getElementById('shortcutTitleInput');
        const prevUrlEl = document.getElementById('previewUrl');
        const prevNameEl = document.getElementById('previewName');
        const prevImgEl = document.getElementById('shortcutPreviewImg');
        const prevFallbackEl = document.getElementById('shortcutPreviewFallback');

        const rawUrl = (urlInputEl ? urlInputEl.value : '').trim();
        const rawTitle = (titleInputEl ? titleInputEl.value : '').trim();

        if (!rawUrl) {
            if (prevUrlEl) prevUrlEl.textContent = 'example.com';
            if (prevImgEl) prevImgEl.style.display = 'none';
            if (prevFallbackEl) {
                prevFallbackEl.style.display = 'flex';
                prevFallbackEl.textContent = rawTitle ? rawTitle.charAt(0).toUpperCase() : 'W';
            }
            if (prevNameEl) prevNameEl.textContent = rawTitle || 'Shortcut Name';
            return;
        }

        let host = rawUrl.replace(/^https?:\/\//i, '').split('/')[0];
        if (prevUrlEl) prevUrlEl.textContent = host;

        const autoTitle = host.replace(/^www\./i, '').split('.')[0];
        const displayName = rawTitle || (autoTitle ? autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1) : 'Shortcut');
        if (prevNameEl) prevNameEl.textContent = displayName;
        if (prevFallbackEl) prevFallbackEl.textContent = displayName.charAt(0).toUpperCase();

        const faviconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
        if (prevImgEl) {
            prevImgEl.src = faviconUrl;
            prevImgEl.onload = () => {
                prevImgEl.style.display = 'block';
                if (prevFallbackEl) prevFallbackEl.style.display = 'none';
            };
            prevImgEl.onerror = () => {
                prevImgEl.style.display = 'none';
                if (prevFallbackEl) prevFallbackEl.style.display = 'flex';
            };
        }
    }

    function openShortcutModal(isEdit = false, item = null) {
        const modal = document.getElementById('addShortcutModal');
        if (!modal) return;
        editingOriginalUrl = isEdit && item ? item.url : null;

        const heading = document.getElementById('shortcutModalHeading');
        const sub = document.getElementById('shortcutModalSub');
        const titleInput = document.getElementById('shortcutTitleInput');
        const urlInput = document.getElementById('shortcutUrlInput');
        const saveBtn = document.getElementById('btnSaveShortcut');

        if (isEdit && item) {
            if (heading) heading.textContent = 'Edit Shortcut';
            if (sub) sub.textContent = 'Modify title or website domain to update this shortcut';
            if (titleInput) titleInput.value = item.name || '';
            if (urlInput) urlInput.value = item.url || '';
            if (saveBtn) saveBtn.textContent = 'Save Changes';
        } else {
            if (heading) heading.textContent = 'Add New Shortcut';
            if (sub) sub.textContent = 'Enter title and domain to automatically fetch its official logo';
            if (titleInput) titleInput.value = '';
            if (urlInput) urlInput.value = '';
            if (saveBtn) saveBtn.textContent = 'Add Shortcut';
        }

        updateShortcutPreview();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        setTimeout(() => {
            if (isEdit && titleInput) titleInput.focus();
            else if (urlInput) urlInput.focus();
        }, 60);
    }

    function closeShortcutModal() {
        const modal = document.getElementById('addShortcutModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        editingOriginalUrl = null;
    }

    function saveShortcutAction() {
        const urlInputEl = document.getElementById('shortcutUrlInput');
        const titleInputEl = document.getElementById('shortcutTitleInput');
        let rawUrl = (urlInputEl ? urlInputEl.value : '').trim();
        if (!rawUrl) return;

        const validUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
        let host = '';
        try { host = new URL(validUrl).hostname; } catch(_) { host = rawUrl; }

        let name = (titleInputEl ? titleInputEl.value : '').trim();
        if (!name) {
            const cleanHost = host.replace(/^www\./i, '').split('.')[0];
            name = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
        }

        let list = getSavedShortcuts();
        const normNew = validUrl.replace(/\/$/, '');

        // Check if there is an official SVG matching this domain
        const defMatch = DEFAULT_SHORTCUTS.find(d => d.url.replace(/\/$/, '').toLowerCase() === normNew.toLowerCase());

        if (editingOriginalUrl) {
            const normOrig = editingOriginalUrl.replace(/\/$/, '');
            const idx = list.findIndex(s => (s.url || '').replace(/\/$/, '') === normOrig);
            if (idx !== -1) {
                list[idx].name = name;
                list[idx].url = validUrl;
                list[idx].sub = host;
                if (defMatch) {
                    list[idx].iconSvg = defMatch.iconSvg;
                    list[idx].iconBg = defMatch.iconBg;
                }
            } else {
                list.push({ 
                    name, 
                    url: validUrl, 
                    sub: host, 
                    iconSvg: defMatch ? defMatch.iconSvg : '', 
                    iconBg: defMatch ? defMatch.iconBg : 'rgba(36,35,45,0.88)' 
                });
            }
        } else {
            list = list.filter(s => (s.url || '').replace(/\/$/, '') !== normNew);
            list.push({ 
                name, 
                url: validUrl, 
                sub: host, 
                iconSvg: defMatch ? defMatch.iconSvg : '', 
                iconBg: defMatch ? defMatch.iconBg : 'rgba(36,35,45,0.88)' 
            });
        }

        saveShortcutsList(list);
        closeShortcutModal();
        renderShortcuts();
    }

    if (shortcutUrlInput) {
        shortcutUrlInput.oninput = updateShortcutPreview;
        shortcutUrlInput.onkeydown = (e) => { if (e.key === 'Enter') saveShortcutAction(); };
    }
    if (shortcutTitleInput) {
        shortcutTitleInput.oninput = updateShortcutPreview;
        shortcutTitleInput.onkeydown = (e) => { if (e.key === 'Enter') saveShortcutAction(); };
    }
    if (btnSaveShortcut) btnSaveShortcut.onclick = saveShortcutAction;
    if (btnCancelShortcut) btnCancelShortcut.onclick = closeShortcutModal;
    if (btnCloseShortcutModal) btnCloseShortcutModal.onclick = closeShortcutModal;

    const modalBackdropEl = document.getElementById('addShortcutModal');
    if (modalBackdropEl) {
        modalBackdropEl.onclick = (e) => {
            if (e.target === modalBackdropEl) closeShortcutModal();
        };
    }
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeShortcutModal();
    });

    function renderShortcuts() {
        if (!shortcutsContainer) return;
        const allShortcuts = getSavedShortcuts();

        const tilesHtml = allShortcuts.map((s) => {
            let hostname = '';
            try { hostname = new URL(s.url).hostname; } catch(_) { hostname = s.url; }
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
            const firstLetter = (s.name || 'W').charAt(0).toUpperCase();

            return `
                <div class="shortcut-tile" data-url="${s.url}" data-name="${s.name}" title="${s.name}">
                    <div class="shortcut-icon-card" style="background: ${s.iconBg || 'rgba(36,35,45,0.88)'}">
                        ${s.iconSvg ? `
                            <div class="shortcut-svg-wrap">
                                ${s.iconSvg}
                            </div>
                        ` : `
                            <img src="${faviconUrl}" class="shortcut-favicon-img" alt="${s.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="shortcut-fallback-icon" style="display: none;">
                                <span class="shortcut-letter">${firstLetter}</span>
                            </div>
                        `}
                        <button class="shortcut-edit-btn" data-url="${s.url}" data-name="${s.name}" title="Edit Shortcut">✎</button>
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
            tile.onclick = (e) => {
                if (e.target.closest('.shortcut-del-btn') || e.target.closest('.shortcut-edit-btn')) return;
                const url = tile.getAttribute('data-url');
                if (url) navigateTo(url);
            };
        });

        // Edit handlers
        shortcutsContainer.querySelectorAll('.shortcut-edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const u = btn.getAttribute('data-url');
                const n = btn.getAttribute('data-name');
                openShortcutModal(true, { name: n, url: u });
            };
        });

        // Delete handlers
        shortcutsContainer.querySelectorAll('.shortcut-del-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const toDel = btn.getAttribute('data-url');
                const norm = (toDel || '').replace(/\/$/, '');
                let list = getSavedShortcuts();
                list = list.filter(s => (s.url || '').replace(/\/$/, '') !== norm);
                saveShortcutsList(list);
                renderShortcuts();
            };
        });

        // Add Tile click handler with direct binding
        const addBtn = document.getElementById('btnAddShortcutTile');
        if (addBtn) {
            addBtn.style.cursor = 'pointer';
            addBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openShortcutModal(false);
            };
        }

        // Smooth mouse-wheel horizontal scrolling for shortcuts
        if (!shortcutsContainer.__wheelBound) {
            shortcutsContainer.__wheelBound = true;
            shortcutsContainer.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    shortcutsContainer.scrollLeft += e.deltaY;
                    e.preventDefault();
                }
            }, { passive: false });
        }
    }

    // Event delegation on container for Add Tile guarantee
    if (shortcutsContainer && !shortcutsContainer.__clickBound) {
        shortcutsContainer.__clickBound = true;
        shortcutsContainer.addEventListener('click', (e) => {
            const addTarget = e.target.closest('#btnAddShortcutTile, .add-shortcut-tile');
            if (addTarget) {
                e.preventDefault();
                e.stopPropagation();
                openShortcutModal(false);
            }
        });
    }

    // Helper to produce authentic branded publisher badges
    function getPublisherBadge(sourceName, sourceIcon, storyUrl) {
        if (sourceIcon && typeof sourceIcon === 'string' && sourceIcon.trim().length > 0) {
            return `<img class="source-icon" src="${sourceIcon}" alt="" onerror="this.outerHTML=''">`;
        }

        const name = (sourceName || '').toLowerCase().trim();
        const url = (storyUrl || '').toLowerCase();

        // 1. BBC
        if (name.includes('bbc') || url.includes('bbc.')) {
            return `<span class="source-badge-icon" style="background:#B91C1C;color:#FFF;font-size:8px;font-weight:900;letter-spacing:0.5px;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">BBC</span>`;
        }
        // 2. CNN
        if (name.includes('cnn') || url.includes('cnn.')) {
            return `<span class="source-badge-icon" style="background:#CC0000;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">CNN</span>`;
        }
        // 3. NPR
        if (name.includes('npr') || url.includes('npr.')) {
            return `<span class="source-badge-icon" style="background:#0F172A;color:#FFF;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;border-left:2px solid #3B82F6;border-right:2px solid #EF4444;">npr</span>`;
        }
        // 4. ABC
        if (name.includes('abc') || url.includes('abcnews.')) {
            return `<span class="source-badge-icon" style="background:#000000;color:#FFF;font-size:9px;font-weight:800;width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">abc</span>`;
        }
        // 5. Mint
        if (name.includes('mint') || url.includes('livemint.')) {
            return `<span class="source-badge-icon" style="background:#FF9900;color:#000;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">mint</span>`;
        }
        // 6. Business Standard
        if (name.includes('business standard') || name === 'bs' || url.includes('business-standard.')) {
            return `<span class="source-badge-icon" style="background:#A51C30;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">BS</span>`;
        }
        // 7. The Hindu
        if (name.includes('the hindu') || url.includes('thehindu.')) {
            return `<span class="source-badge-icon" style="background:#1E3A8A;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">TH</span>`;
        }
        // 8. The Indian Express
        if (name.includes('indian express') || url.includes('indianexpress.')) {
            return `<span class="source-badge-icon" style="background:#DC2626;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">IE</span>`;
        }
        // 9. The Telegraph
        if (name.includes('telegraph') || url.includes('telegraphindia.')) {
            return `<span class="source-badge-icon" style="background:#334155;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">TT</span>`;
        }
        // 10. The Economic Times
        if (name.includes('economic times') || url.includes('economictimes.')) {
            return `<span class="source-badge-icon" style="background:#B91C1C;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">ET</span>`;
        }
        // 11. Reuters
        if (name.includes('reuters') || url.includes('reuters.')) {
            return `<span class="source-badge-icon" style="background:#F97316;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">R</span>`;
        }
        // 12. TechCrunch
        if (name.includes('techcrunch') || url.includes('techcrunch.')) {
            return `<span class="source-badge-icon" style="background:#00A562;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">TC</span>`;
        }
        // 13. Wired
        if (name.includes('wired') || url.includes('wired.')) {
            return `<span class="source-badge-icon" style="background:#111827;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">W</span>`;
        }
        // 14. NDTV
        if (name.includes('ndtv') || url.includes('ndtv.')) {
            return `<span class="source-badge-icon" style="background:#E11D48;color:#FFF;font-size:7.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">NDTV</span>`;
        }
        // 15. Associated Press / AP
        if (name.includes('associated press') || name.includes('ap news') || url.includes('apnews.')) {
            return `<span class="source-badge-icon" style="background:#000000;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;border-top:2px solid #EF4444;">AP</span>`;
        }
        // 16. The Guardian
        if (name.includes('guardian') || url.includes('theguardian.')) {
            return `<span class="source-badge-icon" style="background:#052962;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">G</span>`;
        }
        // 17. Bloomberg
        if (name.includes('bloomberg') || url.includes('bloomberg.')) {
            return `<span class="source-badge-icon" style="background:#1D4ED8;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">B</span>`;
        }
        // 18. Firstpost
        if (name.includes('firstpost') || url.includes('firstpost.')) {
            return `<span class="source-badge-icon" style="background:#D97706;color:#FFF;font-size:8.5px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">FP</span>`;
        }
        // 19. Space.com
        if (name.includes('space.com') || url.includes('space.com')) {
            return `<span class="source-badge-icon" style="background:#2563EB;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">S</span>`;
        }
        // 20. Free Press Journal
        if (name.includes('free press') || url.includes('freepressjournal.')) {
            return `<span class="source-badge-icon" style="background:#DC2626;color:#FFF;font-size:9px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">F</span>`;
        }
        // 21. Business Line
        if (name.includes('business line') || url.includes('thehindubusinessline.')) {
            return `<span class="source-badge-icon" style="background:#2563EB;color:#FFF;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">BL</span>`;
        }
        // 22. Mid-Day
        if (name.includes('mid-day') || url.includes('mid-day.')) {
            return `<span class="source-badge-icon" style="background:#0284C7;color:#FFF;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">MD</span>`;
        }

        // Generic fallback with derived color
        const colors = ['#0284C7', '#7C3AED', '#059669', '#DC2626', '#D97706', '#4F46E5', '#0D9488'];
        let hash = 0;
        const cleanName = (sourceName || 'News').trim();
        for (let i = 0; i < cleanName.length; i++) hash = (hash * 31 + cleanName.charCodeAt(i)) & 0xffff;
        const color = colors[Math.abs(hash) % colors.length];
        const initials = cleanName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'N';

        return `<span class="source-badge-icon" style="background:${color};color:#FFF;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:3px;display:inline-flex;align-items:center;">${initials}</span>`;
    }

    // 5. Render Stories (Modern Single-Row Horizontally Scrollable Cards)
    function renderStories(items) {
        if (!storiesGrid) return;
        const sourceList = (items && items.length >= 4) ? items : ALL_STORIES;
        const list = sourceList.slice(0, 12);

        storiesGrid.innerHTML = list.map((story, idx) => {
            const fallbackImg = DEFAULT_STORY_IMAGES[idx % DEFAULT_STORY_IMAGES.length];
            const imgSrc = story.image || story.img || fallbackImg;
            const badgeHtml = getPublisherBadge(story.source, story.sourceIcon, story.url);
            return `
                <div class="firefox-card" data-url="${story.url}">
                    <div class="card-img-wrap">
                        <img class="card-img" src="${imgSrc}" alt="News thumbnail" loading="lazy">
                    </div>
                    <div class="card-body">
                        <h3 class="card-headline">${story.title}</h3>
                        <div class="card-source-bar">
                            ${badgeHtml}
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

        // Smooth mouse-wheel horizontal scrolling for stories row
        if (!storiesGrid.__wheelBound) {
            storiesGrid.__wheelBound = true;
            storiesGrid.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    storiesGrid.scrollLeft += e.deltaY;
                    e.preventDefault();
                }
            }, { passive: false });
        }
    }

    // View More Stories Button Handler (Fallback if triggered)
    if (btnViewMoreStories) {
        btnViewMoreStories.addEventListener('click', () => {
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
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const isIncognitoMode = urlParams.get('incognito') === '1' || window.location.hash.includes('incognito');
        if (isIncognitoMode) {
            document.body.classList.add('incognito-stealth-mode');
            const searchInput = document.getElementById('desktopSearchInput');
            if (searchInput) {
                searchInput.placeholder = 'Search privately or enter address';
            }
        }
    } catch (_) {}

    loadWallpaper();
    renderShortcuts();
    fetchStories('global');
})();
