/**
 * Cloudflare Worker - Unrestricted OpenAI Proxy
 * * Özellikler:
 * - SYSTEM_PROMPT YOK (Ham model cevabı)
 * - CORS KISITLAMASI YOK (Herkes erişebilir)
 * - Loglama sistemi aktif (Admin takibi için)
 */

// Log saklama süresi (30 gün)
const LOG_RETENTION_SECONDS = 60 * 60 * 24 * 30;

export default {
    async fetch(request, env, ctx) {
        
        // 1. HERKESE AÇIK CORS AYARLARI (Kısıtlama Yok)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // <--- YILDIZ: Her yerden erişime izin ver
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        };

        const url = new URL(request.url);

        // 2. LOGLARI OKUMA (Admin Paneli - /logs)
        // Burası sadece sizin logları okumanız için, mesajlaşmayı etkilemez.
        if (url.pathname === '/logs' && request.method === 'GET') {
            return handleLogsRequest(request, env, corsHeaders);
        }

        // 3. OPTIONS İSTEKLERİ (Tarayıcı Ön Kontrolü)
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // 4. SADECE POST İSTEKLERİNİ KABUL ET
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
                status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            });
        }

        const startedAt = Date.now();
        let requestBody = {};

        try {
            // İsteği ayrıştır
            requestBody = await request.json();
            const { messages, sessionId, meta } = requestBody;

            // Basit doğrulama (Sadece boş olmasın diye)
            if (!messages || !Array.isArray(messages)) {
                throw new Error('Messages array is required');
            }

            // API Key Kontrolü
            const apiKey = env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('Server API Key eksik');
            }

            // --- DEĞİŞİKLİK BURADA: SYSTEM PROMPT EKLENMİYOR ---
            // Gelen mesajları olduğu gibi iletiyoruz.
            // Kullanıcı ne gönderdiyse o gider.
            
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: requestBody.model || 'gpt-3.5-turbo', // Kullanıcı model seçebilir veya varsayılan
                    messages: messages, // <--- Ham mesajlar
                    temperature: requestBody.temperature || 0.7, // İstenirse dışarıdan ayarlanabilir
                    max_tokens: requestBody.max_tokens || 1000
                })
            });

            // OpenAI Cevabını İşle
            if (!openaiResponse.ok) {
                const errorData = await openaiResponse.json();
                throw new Error(errorData.error?.message || 'OpenAI Error');
            }

            const responseData = await openaiResponse.json();
            const botMessage = responseData.choices?.[0]?.message?.content;

            // LOGLAMA (Başarılı İşlem)
            ctx.waitUntil(logInteraction(env, {
                type: 'chat-success',
                sessionId: sessionId || 'anonymous',
                requestMessages: messages,
                responseMessage: botMessage,
                clientIp: request.headers.get('cf-connecting-ip'),
                durationMs: Date.now() - startedAt
            }));

            // Başarılı Cevap Dön
            return new Response(JSON.stringify(responseData), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });

        } catch (error) {
            // LOGLAMA (Hata Durumu)
            ctx.waitUntil(logInteraction(env, {
                type: 'chat-error',
                error: error.message,
                clientIp: request.headers.get('cf-connecting-ip'),
                durationMs: Date.now() - startedAt
            }));

            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }
};

/**
 * Logları KV'ye kaydetme fonksiyonu
 */
async function logInteraction(env, log) {
    if (!env?.CHAT_LOGS) return; // KV bağlı değilse geç

    const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const record = { ...log, timestamp: new Date().toISOString() };

    try {
        await env.CHAT_LOGS.put(key, JSON.stringify(record), { expirationTtl: LOG_RETENTION_SECONDS });
    } catch (e) {
        console.error("Log hatasi:", e);
    }
}

/**
 * Admin Loglarını Okuma Fonksiyonu
 */
async function handleLogsRequest(request, env, corsHeaders) {
    if (!env?.CHAT_LOGS) return new Response("KV yok", { status: 500, headers: corsHeaders });

    // Admin Token Kontrolü (Loglarınızı başkası okumasın diye burası kalsın)
    const token = request.headers.get('X-Admin-Token');
    if (token !== env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const { keys } = await env.CHAT_LOGS.list({ prefix: 'log:', limit });
    const logs = [];

    for (const key of keys) {
        const value = await env.CHAT_LOGS.get(key.name);
        if (value) logs.push(JSON.parse(value));
    }

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return new Response(JSON.stringify({ logs }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}