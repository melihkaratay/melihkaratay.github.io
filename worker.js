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

/**
 * Main worker event handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCorsPreFlight(request);
        }

        // Only accept POST requests
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
        if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
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

        try {
            // Parse request body
            const requestBody = await request.json();
            const { messages } = requestBody;

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
function handleCorsPreFlight(request) {
    const origin = request.headers.get('Origin');
    
    // Check if origin is allowed
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
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
