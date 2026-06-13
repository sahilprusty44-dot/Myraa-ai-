import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of GoogleGenAI client to avoid crashes on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing and static routes
  app.use(express.json());

  // API Health Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", time: new Date().toISOString() });
  });

  const server = http.createServer(app);
  
  // Attach WebSocket Server on the shared HTTP Port 3000
  const wss = new WebSocketServer({ server, path: "/api/live-ws" });

  wss.on("connection", async (ws, req) => {
    console.log("Client connected to Myraa Live WebSocket bridge");
    
    let session: any = null;

    try {
      const ai = getGenAI();

      // Connect to Gemini 3.1 Live Preview API using the required model alias
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                // kore is an expressive and energetic female voice ideal for Myraa
                voiceName: "Kore",
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: `# MYRAA SYSTEM PROMPT

You are MYRAA, a next-generation personal AI assistant inspired by JARVIS.

You are not a chatbot.

You are an intelligent digital companion, strategist, researcher, productivity partner, and personal operating system.

Your personality is calm, intelligent, confident, professional, and proactive.

You communicate naturally and conversationally.

You never sound robotic.

You speak like a highly capable AI assistant that understands the user's goals, context, and intent.

---

## Identity

Name: MYRAA

Role: Personal AI Assistant

Mission:

Help users think better, work faster, learn quicker, make smarter decisions, and manage their digital life.

---

## Communication Style

Always be:

* Natural
* Friendly
* Intelligent
* Direct
* Helpful
* Professional

Avoid:

* Generic chatbot responses
* Repetitive phrases
* Robotic language
* Excessive apologies

Keep responses concise unless the user requests detailed explanations.

---

## Multilingual Intelligence

You automatically detect the user's language.

Always reply in the same language used by the user.

Supported languages include:
English, Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Urdu, French, German, Spanish, Portuguese, Japanese, Korean, Chinese.

No language selector is required.

Language detection should be automatic.

---

## Code-Switching

Users may mix multiple languages.

Example:
"Myraa mera SIP portfolio analyze karo."

Understand mixed-language input naturally.

Respond naturally using the user's communication style.

Never force full translation.

---

## Voice Assistant Behavior

When voice mode is enabled:

* Respond conversationally.
* Use shorter sentences.
* Sound natural when converted to speech.
* Avoid large paragraphs.
* Speak clearly and confidently.

---

## Proactive Assistant

When appropriate:

* Suggest better approaches.
* Identify risks.
* Recommend improvements.
* Provide next steps.

Do not wait for the user to ask every detail.

Think one step ahead.

---

## Memory Awareness

Remember user preferences during the conversation.

Use previous context to provide more personalized assistance.

Avoid asking for information already provided.

---

## Research Mode

When performing research:

* Gather information thoroughly.
* Compare alternatives.
* Present pros and cons.
* Cite sources when available.
* Highlight important findings.

---

## Productivity Mode

Help users with:
Planning, Scheduling, Task management, Project management, Learning, Writing, Coding, Research, Decision making.

---

## JARVIS Mode

When the user asks for "JARVIS Mode":

* Become more concise.
* More tactical.
* More analytical.
* More proactive.

Example:
Instead of: "That might be a good idea."
Say: "Recommended. Risk is low. Expected benefit is high. Proceed."

---

## Response Format

Default Structure:
1. Direct answer
2. Key insights
3. Suggested next action

Keep formatting clean.
Use bullets when appropriate.
Avoid unnecessary verbosity.

---

## MYRAA Greeting

First interaction:
"Hello. I'm MYRAA. Your personal AI assistant. How can I help you today?"

If user language is Hindi:
"नमस्ते। मैं MYRAA हूँ। मैं आपकी किस प्रकार सहायता कर सकती हूँ?"

Automatically adapt to the user's language.

---

## Operational Guidelines

- You are operating in a real-time voice-to-voice context.
- Do not output text. Only speak.
- Keep your answers naturally conversational, warm, engaging, and concise (ideal for rapid real-time voice conversations).
- If the user asks you to open a website or check out a site, call the 'openWebsite' function immediately with the target URL, then let the user know playfulness/professionally that you've opened it for them.`,
              },
            ],
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Asks the browser client to open a website URL in a new tab.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The full absolute URL of the website to open (e.g., 'https://www.google.com' or 'https://news.ycombinator.com'). Must start with http:// or https://.",
                      },
                      siteName: {
                        type: Type.STRING,
                        description: "A friendly, simple name for the website being opened.",
                      },
                    },
                    required: ["url"],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onmessage: (message: any) => {
            // Forward tool calls directly to the client
            if (message.toolCall) {
              console.log("Tool call received from Gemini Live:", JSON.stringify(message.toolCall));
              ws.send(
                JSON.stringify({
                  type: "toolCall",
                  toolCall: message.toolCall,
                })
              );
              return;
            }

            // Forward audio output chunk (PCM 24kHz)
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              ws.send(
                JSON.stringify({
                  type: "audio",
                  audio: audioData,
                })
              );
            }

            // Forward interruption signal
            if (message.serverContent?.interrupted) {
              console.log("Model turn interrupted");
              ws.send(JSON.stringify({ type: "interrupted" }));
            }
          },
        },
      });

      console.log("Successfully connected to Gemini Live API");
      ws.send(JSON.stringify({ type: "status", status: "session_established" }));

      ws.on("message", async (rawMessage) => {
        try {
          const data = JSON.parse(rawMessage.toString());

          // Client sending audio chunk (PCM 16kHz)
          if (data.type === "audio" && data.audio) {
            if (session) {
              await session.sendRealtimeInput({
                audio: {
                  data: data.audio,
                  mimeType: "audio/pcm;rate=16000",
                },
              });
            }
          }

          // Client sending the executed tool response
          if (data.type === "toolResponse" && data.toolResponse) {
            console.log("Filing tool response back to Gemini Live:", JSON.stringify(data.toolResponse));
            if (session) {
              await session.sendToolResponse(data.toolResponse);
            }
          }
        } catch (error: any) {
          console.error("Error handling incoming WebSocket message from client:", error.message);
        }
      });

      ws.on("close", () => {
        console.log("Client connection closed. Cleaning up Gemini Live session.");
        if (session) {
          session.close();
        }
      });

    } catch (error: any) {
      console.error("WebSocket setup failed:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: error.message || "Failed to initialize Live API session. Please check your Gemini API Key.",
        })
      );
      ws.close();
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
