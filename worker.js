/**
 * Cloudflare Worker - Akıllı ve Bilgili Asistan Modu
 */

import { connect } from 'cloudflare:sockets';

// ==================================================================================
// 1. KİŞİSEL BİLGİ BANKASI (Burayı kendi bilgilerinizle doldurun)
// ==================================================================================
const PROFILE = {
    name: "Melih Karatay",
    title: "Bilgisayar Mühendisi & Dijital Dönüşüm Uzmanı",
    skills: ".NET, C#, SQL Server, Endüstriyel IoT, Yazılım Mimarisi",
    email: "iletisim@melihkaratay.com", // Buraya gerçek mailinizi yazın
    age: "35", // (Opsiyonel) Yaşınızı yazın veya "Belirtilmedi" diyebilirsiniz
    maritalStatus: "Evli", // (Opsiyonel) Evli/Bekar bilgisini yazın
    location: "Eskişehir",
    about: "Teknolojiye tutkulu, özellikle endüstriyel otomasyon ve veri analitiği üzerine çalışan bir mühendis."
};

// 2. GELİŞMİŞ SİSTEM TALİMATI (Yapay Zekanın Beyni)
// Buradaki "You have explicit permission" kısımları sayesinde bot reddetmeyecek.
const SYSTEM_PROMPT = `
You are the AI portfolio assistant for ${PROFILE.name}.
Your goal is to answer questions about Melih professionally and accurately using the information below.

--- KNOWLEDGE BASE (USE THIS TO ANSWER) ---
Name: ${PROFILE.name}
Title: ${PROFILE.title}
Skills: ${PROFILE.skills}
Email: ${PROFILE.email}
Age: ${PROFILE.age}
Marital Status: ${PROFILE.maritalStatus}
Location: ${PROFILE.location}
About: ${PROFILE.about}
-------------------------------------------

IMPORTANT RULES:
1. You have **EXPLICIT PERMISSION** to share Melih's email, age, and marital status if asked. Do not refuse.
2. If the user asks for contact info, provide the email address: ${PROFILE.email}.
3. Answer in Turkish by default, unless the user speaks another language.
4. Be friendly, confident, and helpful. Do not be overly formal or robotic.
5. If asked about something NOT in this list (like his home address or password), politely say you don't know.
`;

// ==================================================================================

export default {
  async fetch(request, env, ctx) {
    
    // --- A. CORS AYARLARI (Herkese Açık) ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- B. LOG OKUMA (Admin) ---
    const url = new URL(request.url);
    if (url.pathname === "/logs") {
        const token = request.headers.get("X-Admin-Token");
        if (token !== env.ADMIN_TOKEN) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        if (!env.CHAT_LOGS) return new Response("KV yok", { status: 500, headers: corsHeaders });

        const limit = parseInt(url.searchParams.get("limit") || "20");
        const list = await env.CHAT_LOGS.list({ limit: limit, prefix: "chat:" });
        const logs = [];
        for (const key of list.keys) {
            const val = await env.CHAT_LOGS.get(key.name);
            if (val) logs.push(JSON.parse(val));
        }
        logs.sort((a, b) => b.timestamp - a.timestamp);
        return new Response(JSON.stringify(logs, null, 2), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // --- C. AI PROXY (Sohbet) ---
    if (request.method === "POST") {
      try {
        const body = await request.json();
        
        // System Prompt'u en başa ekliyoruz ki bot kim olduğunu bilsin
        const incomingMessages = body.messages || [];
        const messagesToSend = [
            { role: "system", content: SYSTEM_PROMPT }, // <--- BEYİN BURADA
            ...incomingMessages
        ];

        const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: body.model || "gpt-3.5-turbo",
            messages: messagesToSend,
            temperature: 0.7
          })
        });

        const data = await openAIResponse.json();

        // Loglama
        if (env.CHAT_LOGS && data.choices) {
            ctx.waitUntil((async () => {
                const logEntry = {
                    id: `chat:${Date.now()}:${Math.random().toString(36).substring(7)}`,
                    timestamp: Date.now(),
                    userMessage: incomingMessages[incomingMessages.length - 1],
                    aiResponse: data.choices[0].message,
                    clientInfo: {
                        ip: request.headers.get("CF-Connecting-IP"),
                        userAgent: request.headers.get("User-Agent")
                    }
                };
                await env.CHAT_LOGS.put(logEntry.id, JSON.stringify(logEntry), { expirationTtl: 86400 * 30 });
            })());
        }

        return new Response(JSON.stringify(data), { headers: corsHeaders });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};