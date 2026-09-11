import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types
from memory import MemoryStorage, MemoryManager

load_dotenv(dotenv_path=".env.local")
load_dotenv(dotenv_path=".env")

app = FastAPI()

memory_manager = MemoryManager(MemoryStorage('myraa_memory.json'))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return JSONResponse(content={"status": "healthy", "time": datetime.utcnow().isoformat()})

SYSTEM_PROMPT = """# MYRAA SYSTEM PROMPT

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
- If the user asks you to open a website or check out a site, call the 'openWebsite' function immediately with the target URL, then let the user know playfulness/professionally that you've opened it for them."""

def get_ai_client():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY environment variable is required.")
    return genai.Client(api_key=key, http_options={'headers': {'User-Agent': 'aistudio-build'}})

@app.websocket("/api/live-ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to Myraa Live WebSocket bridge")

    try:
        client = get_ai_client()

        # Tools
        remember_tool = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="rememberFact",
                    description="Save an important fact, preference, or context about the user to long-term memory. Use this proactively when the user mentions something important.",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "key": types.Schema(type="STRING", description="A short, descriptive key for the memory (e.g., 'user_name', 'favorite_color', 'current_project')."),
                            "value": types.Schema(type="STRING", description="The value or fact to remember."),
                            "context": types.Schema(type="STRING", description="Optional context about why this is important.")
                        },
                        required=["key", "value"]
                    )
                ),
                types.FunctionDeclaration(
                    name="forgetFact",
                    description="Delete a fact from long-term memory if the user asks you to forget it or it is no longer true.",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "key": types.Schema(type="STRING", description="The key of the memory to delete.")
                        },
                        required=["key"]
                    )
                )
            ]
        )
        open_website_tool = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="openWebsite",
                    description="Asks the browser client to open a website URL in a new tab.",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "url": types.Schema(
                                type="STRING",
                                description="The full absolute URL of the website to open. Must start with http:// or https://."
                            ),
                            "siteName": types.Schema(
                                type="STRING",
                                description="A friendly, simple name for the website being opened."
                            ),
                        },
                        required=["url"]
                    )
                )
            ]
        )

        config = types.LiveConnectConfig(
            response_modalities=[types.LiveClientContentModality.AUDIO, types.LiveClientContentModality.TEXT],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore"
                    )
                )
            ),
            system_instruction=types.Content(parts=[types.Part.from_text(text=SYSTEM_PROMPT + '\n\n' + memory_manager.format_memory_for_prompt())]),
            tools=[open_website_tool, remember_tool]
        )

        async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as session:
            print("Successfully connected to Gemini Live API")
            await websocket.send_json({"type": "status", "status": "session_established"})

            async def receive_from_client():
                while True:
                    try:
                        raw_msg = await websocket.receive_text()
                        data = json.loads(raw_msg)

                        if data.get("type") == "audio" and data.get("audio"):
                            await session.send(input={"realtime_input": {"media_chunks": [{"mime_type": "audio/pcm;rate=16000", "data": data["audio"]}]}})

                        elif data.get("type") == "clientText" and data.get("text"):
                            await session.send(input={"client_content": {"turns": [{"role": "user", "parts": [{"text": data["text"]}]}], "turn_complete": True}})

                        elif data.get("type") == "image" and data.get("mimeType") and data.get("data"):
                            await session.send(input={"realtime_input": {"media_chunks": [{"mime_type": data["mimeType"], "data": data["data"]}]}})

                        elif data.get("type") == "toolResponse" and data.get("toolResponse"):
                            # The client sends a toolResponse format, let's map it correctly for the Python SDK
                            func_responses = data["toolResponse"].get("functionResponses", [])
                            responses = []
                            for fr in func_responses:
                                responses.append(types.FunctionResponse(
                                    name=fr["name"],
                                    id=fr["id"],
                                    response=fr["response"]
                                ))
                            await session.send(input={"function_responses": responses})

                        elif data.get("type") == "interrupt":
                             # How to interrupt in python sdk? Maybe client_content with interrupted=True?
                             # In JS it's not strictly necessary to send an interrupt packet to the backend, it just stops sending audio.
                             pass
                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        print(f"Error handling client message: {e}")

            async def receive_from_gemini():
                async for message in session.receive():
                    try:
                        server_content = message.server_content
                        if not server_content:
                            continue

                        # Tool call
                        if server_content.model_turn and server_content.model_turn.parts:
                            for part in server_content.model_turn.parts:
                                if part.function_call:
                                    if part.function_call.name == "rememberFact":
                                        print(f"Executing rememberFact locally: {part.function_call.args}")
                                        key = part.function_call.args.get("key")
                                        value = part.function_call.args.get("value")
                                        context = part.function_call.args.get("context")
                                        if key and value:
                                            memory_manager.remember(key, value, context)
                                            # Send a quick tool response back to Gemini so it knows it succeeded
                                            await session.send(input={"function_responses": [types.FunctionResponse(
                                                name="rememberFact",
                                                id=part.function_call.id,
                                                response={"status": "success"}
                                            )]})
                                    elif part.function_call.name == "forgetFact":
                                        print(f"Executing forgetFact locally: {part.function_call.args}")
                                        key = part.function_call.args.get("key")
                                        if key:
                                            success = memory_manager.forget(key)
                                            await session.send(input={"function_responses": [types.FunctionResponse(
                                                name="forgetFact",
                                                id=part.function_call.id,
                                                response={"status": "success" if success else "not_found"}
                                            )]})
                                    else:
                                        print(f"Tool call received from Gemini Live: {part.function_call.name}")
                                        await websocket.send_json({
                                            "type": "toolCall",
                                            "toolCall": {
                                                "functionCalls": [{
                                                    "name": part.function_call.name,
                                                    "id": part.function_call.id,
                                                    "args": part.function_call.args
                                                }]
                                            }
                                        })
                                elif part.inline_data:
                                    # Forward audio output chunk (PCM 24kHz)
                                    await websocket.send_json({
                                        "type": "audio",
                                        "audio": base64.b64encode(part.inline_data.data).decode("utf-8")
                                    })
                                elif part.text:
                                    # Forward Myraa Text
                                    await websocket.send_json({"type": "text", "text": part.text})

                        if server_content.interrupted:
                            print("Model turn interrupted")
                            await websocket.send_json({"type": "interrupted"})

                        if server_content.turn_complete:
                            await websocket.send_json({"type": "turnComplete"})

                    except Exception as e:
                        print(f"Error handling Gemini message: {e}")

            # Run both listeners concurrently
            await asyncio.gather(
                receive_from_client(),
                receive_from_gemini()
            )

    except WebSocketDisconnect:
        print("Client connection closed. Cleaning up Gemini Live session.")
    except Exception as e:
        print(f"WebSocket setup failed: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e) or "Failed to initialize Live API session."
            })
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
