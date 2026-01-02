/**
 * Cloudflare Worker - Secure OpenAI Proxy
 * 
 * This worker acts as a secure proxy between your GitHub Pages frontend and OpenAI API.
 * It keeps your API key safe by storing it in Cloudflare's encrypted environment variables.
 * 
 * Security Features:
 * - CORS restrictions (only allows requests from your domain)
 * - API key stored in environment variables (never exposed to client)
 * - Request validation and error handling
 * - Rate limiting ready (can be enhanced)
 */

// Define allowed origins - ONLY your domain
const ALLOWED_ORIGINS = [
    'https://melihkaratay.github.io',
    'http://localhost:3000', // For local development
    'http://localhost:8000'   // For local development
];

// System prompt for the AI assistant
const SYSTEM_PROMPT = "You are Melih's portfolio assistant. Answer in Turkish. Melih is a Computer Engineer and Digital Transformation Specialist skilled in .NET, C#, SQL Server, and Industrial IoT. Keep answers professional, concise, and friendly.";

// Log retention (30 days)
const LOG_RETENTION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Main worker event handler
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Admin log retrieval endpoint (GET only)
        if (url.pathname === '/logs' && request.method === 'GET') {
            return handleLogsRequest(request, env);
        }

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCorsPreFlight(request, env);
        }

        // Only accept POST requests for chat endpoint
        if (request.method !== 'POST') {
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                {
                    status: 405,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Verify origin
        const origin = request.headers.get('Origin');
        if (!isOriginAllowed(origin, env)) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized origin' }),
                {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': origin || '*'
                    }
                }
            );
        }

        const startedAt = Date.now();

        try {
            // Parse request body
            const requestBody = await request.json();
            const { messages, sessionId, meta } = requestBody;

            // Validate messages
            if (!messages || !Array.isArray(messages)) {
                return new Response(
                    JSON.stringify({ error: 'Invalid request format' }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            // Get API key from environment (set in Cloudflare dashboard)
            const apiKey = env.OPENAI_API_KEY;
            if (!apiKey) {
                console.error('OpenAI API key not configured');
                return new Response(
                    JSON.stringify({ error: 'Server configuration error' }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            // Prepare messages with system prompt
            const fullMessages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages
            ];

            // Call OpenAI API
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: fullMessages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            // Handle OpenAI response
            if (!openaiResponse.ok) {
                const errorData = await openaiResponse.json();
                console.error('OpenAI API error:', errorData);
                return new Response(
                    JSON.stringify({
                        error: 'OpenAI API error',
                        details: errorData.error?.message || 'Unknown error'
                    }),
                    {
                        status: openaiResponse.status,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': origin
                        }
                    }
                );
            }

            const responseData = await openaiResponse.json();
            const botMessage = responseData.choices?.[0]?.message?.content;

            if (!botMessage) {
                throw new Error('No message content in OpenAI response');
            }

            ctx.waitUntil(logInteraction(env, {
                type: 'chat-success',
                origin,
                sessionId: formatSessionId(sessionId),
                meta: normalizeMeta(meta, request),
                requestMessages: messages,
                responseMessage: botMessage,
                userAgent: request.headers.get('user-agent'),
                clientIp: getClientIp(request),
                durationMs: Date.now() - startedAt
            }));

            // Return success response
            return new Response(
                JSON.stringify({
                    success: true,
                    message: botMessage
                }),
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': origin,
                        'Cache-Control': 'no-cache'
                    }
                }
            );
        } catch (error) {
            console.error('Worker error:', error);

            ctx.waitUntil(logInteraction(env, {
                type: 'chat-error',
                origin,
                sessionId: 'unknown',
                meta: normalizeMeta(null, request),
                error: error?.message || 'Unknown error',
                userAgent: request.headers.get('user-agent'),
                clientIp: getClientIp(request),
                durationMs: Date.now() - startedAt
            }));

            return new Response(
                JSON.stringify({
                    error: 'Internal server error',
                    message: error.message
                }),
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': origin || '*'
                    }
                }
            );
        }
    }
};

/**
 * Handle CORS preflight requests
 */
function handleCorsPreFlight(request, env) {
    const origin = request.headers.get('Origin');
    
    // Check if origin is allowed
    if (!isOriginAllowed(origin, env)) {
        return new Response(null, { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * Combine built-in and environment-provided allowed origins.
 */
function getAllowedOrigins(env) {
    const dynamicOrigins = env?.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
        : [];

    const merged = new Set([...ALLOWED_ORIGINS, ...dynamicOrigins]);
    return Array.from(merged);
}

function isOriginAllowed(origin, env) {
    if (!origin) return false;
    return getAllowedOrigins(env).includes(origin);
}

/**
 * Persist a lightweight interaction log to KV if available.
 */
async function logInteraction(env, log) {
    if (!env?.CHAT_LOGS || typeof env.CHAT_LOGS.put !== 'function') {
        return;
    }

    const key = `log:${Date.now()}:${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}`;
    const record = {
        ...log,
        timestamp: new Date().toISOString()
    };

    try {
        await env.CHAT_LOGS.put(key, JSON.stringify(record), {
            expirationTtl: LOG_RETENTION_SECONDS
        });
    } catch (err) {
        console.error('Logging failed', err);
    }
}

/**
 * Admin endpoint to fetch recent logs (requires ADMIN_TOKEN).
 */
async function handleLogsRequest(request, env) {
    if (!env?.CHAT_LOGS) {
        return new Response(
            JSON.stringify({ error: 'Logging storage not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const adminToken = env.ADMIN_TOKEN;
    const providedToken = request.headers.get('X-Admin-Token') || new URL(request.url).searchParams.get('token');

    if (!adminToken || providedToken !== adminToken) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const { keys } = await env.CHAT_LOGS.list({ prefix: 'log:', limit });
    const logs = [];

    for (const key of keys) {
        const value = await env.CHAT_LOGS.get(key.name);
        if (value) {
            try {
                logs.push(JSON.parse(value));
            } catch (err) {
                console.error('Failed to parse log entry', err);
            }
        }
    }

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return new Response(
        JSON.stringify({ logs }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': request.headers.get('Origin') || '*'
            }
        }
    );
}

function normalizeMeta(meta, request) {
    if (!meta || typeof meta !== 'object') {
        return {
            language: request.headers.get('Accept-Language') || 'unknown',
            page: null,
            referrer: request.headers.get('Referer') || null
        };
    }

    return {
        sessionId: formatSessionId(meta.sessionId),
        userAgent: meta.userAgent?.toString().slice(0, 500),
        language: meta.language || request.headers.get('Accept-Language') || 'unknown',
        timezone: meta.timezone || null,
        page: meta.page || null,
        referrer: meta.referrer || request.headers.get('Referer') || null
    };
}

function formatSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') return 'anonymous';
    return sessionId.slice(0, 120);
}

function getClientIp(request) {
    return request.headers.get('cf-connecting-ip')
        || request.headers.get('x-forwarded-for')
        || request.headers.get('x-real-ip')
        || 'unknown';
}
