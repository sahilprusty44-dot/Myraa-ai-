/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  MicOff,
  Power,
  Globe,
  RefreshCw,
  ExternalLink,
  Volume2,
  Sparkles,
  Info,
  Heart,
  Smile,
  BrainCircuit,
  MessageSquare,
  Network,
  TrendingUp,
  Calendar,
  BookOpen,
  User,
  Settings,
  Send,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  Database,
  Target,
  Sliders,
  Clock
} from "lucide-react";
import { AudioPlayer } from "./lib/AudioPlayer";
import { AudioStreamer } from "./lib/AudioStreamer";

type CallState = "disconnected" | "connecting" | "listening" | "speaking" | "thinking";

interface ToolNotification {
  id: string;
  url: string;
  siteName: string;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "myraa";
  text: string;
  timestamp: string;
}

export default function App() {
  const [state, setState] = useState<CallState>("disconnected");
  const [volume, setVolume] = useState<number>(0); // 0 to 100
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolNotification[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  // High-frequency state refs for smooth loop reading without component effect thrashing
  const stateRef = useRef<CallState>(state);
  const volumeRef = useRef<number>(volume);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Chat message support for keyboard users
  const [typedMessage, setTypedMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "myraa",
      text: "Namaste! I am MYRAA, your futuristic quantum AI assistant. Click 'Start Link' or the power button to establish a real-time voice channel so we can talk naturally, or type your query below at any time!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Dynamic system clock
  const [digitalTime, setDigitalTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setDigitalTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Refs for audio and websocket nodes
  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Custom dynamic helper is computed on-the-fly inside the render tree

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  // Connect WebSocket session to full-stack endpoint
  const connectSession = async () => {
    setErrorMsg(null);
    setState("connecting");

    try {
      playerRef.current = new AudioPlayer(
        () => {
          setState("speaking");
        },
        () => {
          setState("listening");
        },
        (vol) => {
          setVolume(vol);
        }
      );
      playerRef.current.init();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live-ws`;

      console.log("Linking core websocket stream:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket console connection established");
      };

      ws.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === "status" && msg.status === "session_established") {
            setState("listening");
            try {
              const streamer = new AudioStreamer(
                (audioChunk) => {
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isMutedRef.current) {
                    wsRef.current.send(JSON.stringify({ type: "audio", audio: audioChunk }));
                  }
                },
                (vol) => {
                  const currState = stateRef.current;
                  if (currState === "listening" || currState === "thinking" || currState === "connecting") {
                    setVolume(vol);
                  }
                }
              );
              streamerRef.current = streamer;
              await streamer.start();
              console.log("Audio capturing system activated");
            } catch (err: any) {
              console.error("Audio capturing error:", err);
              setErrorMsg(err.message || "Microphone access denied");
              disconnectSession();
            }
          }

          if (msg.type === "audio" && msg.audio) {
            if (playerRef.current) {
              playerRef.current.playChunk(msg.audio);
            }
          }

          if (msg.type === "interrupted") {
            if (playerRef.current) {
              playerRef.current.stop();
            }
            setState("listening");
          }

          if (msg.type === "toolCall" && msg.toolCall) {
            handleToolCall(msg.toolCall);
          }

          if (msg.type === "error") {
            setErrorMsg(msg.message);
            disconnectSession();
          }
        } catch (err) {
          console.error("Audio block decoding exception:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Websocket operational error:", err);
        setErrorMsg("Failed to connect to backend server. Ensure GEMINI_API_KEY is configured.");
        disconnectSession();
      };

      ws.onclose = () => {
        disconnectSession();
      };

    } catch (err: any) {
      console.error("Neural core initialization failure:", err);
      setErrorMsg(err.message || "Failed to boot custom voice module.");
      disconnectSession();
    }
  };

  const disconnectSession = () => {
    setState("disconnected");
    setVolume(0);

    if (streamerRef.current) {
      try {
        streamerRef.current.stop();
      } catch (err) {}
      streamerRef.current = null;
    }

    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (err) {}
      playerRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {}
      wsRef.current = null;
    }
  };

  const triggerInterruption = () => {
    if (state === "speaking" && playerRef.current) {
      playerRef.current.stop();
      setState("listening");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "interrupt" }));
      }
    }
  };

  const handleToolCall = (toolCall: any) => {
    const fCalls = toolCall.functionCalls;
    if (!fCalls || fCalls.length === 0) return;

    const callObj = fCalls[0];
    const { name, args, id } = callObj;

    if (name === "openWebsite") {
      const targetUrl = args.url;
      const siteFriendlyName = args.siteName || targetUrl;

      const newNotification: ToolNotification = {
        id: id,
        url: targetUrl,
        siteName: siteFriendlyName,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
      };
      setToolCalls((prev) => [newNotification, ...prev]);

      try {
        window.open(targetUrl, "_blank");
      } catch (err) {
        console.warn("Browser window blocker halted direct redirection. Standard log fallback loaded.");
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "toolResponse",
            toolResponse: {
              functionResponses: [
                {
                  name: "openWebsite",
                  id: id,
                  response: {
                    output: {
                      status: "success",
                      message: `Successfully spawned a new tab for ${siteFriendlyName} at link target: ${targetUrl}.`,
                    },
                  },
                },
              ],
            },
          })
        );
      }
    }
  };

  // Automated general intelligent response simulator for typing conversations
  const executeTextMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message to transmission log
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setTypedMessage("");
    setState("thinking");

    // Set a quick simulated thinking delay with contextual response answers
    setTimeout(() => {
      let replyMarkdown = "";
      const query = text.toLowerCase();

      if (query.includes("hello") || query.includes("hey") || query.includes("namaste") || query.includes("hii")) {
        replyMarkdown = `Hello! I am **MYRAA**, your personal operating system companion. 

How can I help you today? You can activate the physical **Start Link** button above to open an immersive, real-time voice channel so we can talk directly! Or feel free to query my neural bank here via standard input.`;
      } else if (query.includes("who are you") || query.includes("your name") || query.includes("what is myraa")) {
        replyMarkdown = `I am **MYRAA** (Multi-agent Responsive Autonomous Assistant), your futuristic quantum AI companion. 

My architecture is designed to manage advanced streams, retrieve knowledge parameters dynamically, and host voice link protocols (PCM16 // 14ms latency) using Gemini's most expressively synced acoustic kernels.`;
      } else if (query.includes("voice") || query.includes("call") || query.includes("connect")) {
        replyMarkdown = `To begin a fluid, low-latency live vocal interaction:
1. Click **Start Link** in the HUD control deck or bottom bar.
2. Grant browser microphone permission when prompted.
3. Once the core signals **listening state** in active fuchsia/cyan, speak freely!

I'll parse vocal nuances on the fly. Let's communicate!`;
      } else {
        replyMarkdown = `Affirmative! Received query parameter: _"${text}"_. 

I am parsing your input sequence through my cognitive matrices. In standby keyboard terminal mode, I can help you compile ideas, execute strategies, or solve research files. 

For full conversational immersion, activate the **Start Link** voice bridge! Let me know if you would like me to specialize on a particular topic.`;
      }

      const myraaMsg: ChatMessage = {
        id: `myraa-${Date.now()}`,
        sender: "myraa",
        text: replyMarkdown,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setChatHistory((prev) => [...prev, myraaMsg]);
      setState("listening");
    }, 1200);
  };

  // Background Circuit Traces Canvas animation setup
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    // Create faint constellation/circuit nodes
    const nodesCount = 45;
    const nodes: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

    for (let i = 0; i < nodesCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.5 + 1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(5, 8, 22, 1)";
      ctx.fillRect(0, 0, width, height);

      // Render faint circuit connections
      ctx.strokeStyle = "rgba(0, 212, 255, 0.04)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodesCount; i++) {
        for (let j = i + 1; j < nodesCount; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Render glowing stargrid dots
      for (let i = 0; i < nodesCount; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(124, 92, 255, 0.25)";
        ctx.fill();

        // Update positions
        n.x += n.vx;
        n.y += n.vy;

        // Bounce back from walls
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      // Draw faint cybernetic HUD grids
      ctx.strokeStyle = "rgba(0, 212, 255, 0.015)";
      ctx.lineWidth = 0.5;
      const gridSize = 48;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Centered Holographic Fluid Wave Particle Sphere visualizer setup (statically mounted, driven by high-speed state refs)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 380;
      canvas.height = canvas.parentElement?.clientHeight || 380;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dynamic wave settings for organic morphing
    const waveLayers = [
      { speed: 0.015, frequency: 4, amplitude: 8, phaseShift: 0, opacity: 0.25 },
      { speed: -0.012, frequency: 5, amplitude: 12, phaseShift: 2, opacity: 0.18 },
      { speed: 0.02, frequency: 3, amplitude: 6, phaseShift: 4, opacity: 0.3 }
    ];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.33;

      const currentVol = volumeRef.current;
      const currentState = stateRef.current;

      let activeScale = currentVol / 100; // 0.0 to 1.0
      let primaryColor = "rgba(0, 214, 255, 1)"; // default cyan
      let accentColor = "rgba(124, 92, 255, 1)";  // royal purple

      if (currentState === "speaking") {
        primaryColor = "rgba(192, 38, 255, 1)";
        accentColor = "rgba(236, 72, 153, 1)";
      } else if (currentState === "thinking") {
        primaryColor = "rgba(124, 92, 255, 1)";
        accentColor = "rgba(0, 214, 255, 1)";
      } else if (currentState === "connecting") {
        primaryColor = "rgba(245, 158, 11, 1)";
        accentColor = "rgba(239, 68, 68, 1)";
      } else if (currentState === "disconnected") {
        primaryColor = "rgba(148, 163, 184, 0.45)";
        accentColor = "rgba(71, 85, 105, 0.2)";
      }

      // Increment visualizer animation timeline
      let animSpeed = 0.015;
      if (currentState === "speaking") {
        animSpeed = 0.035 + activeScale * 0.04;
      } else if (currentState === "listening") {
        animSpeed = 0.022 + activeScale * 0.025;
      } else if (currentState === "thinking") {
        animSpeed = 0.05;
      }
      time += animSpeed;

      ctx.save();

      // 1. Central Ambient Spherical Hologram (Internal Glowing Core)
      const grad = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, baseRadius + (currentState === "speaking" ? activeScale * 25 : 5)
      );
      
      const glowIntensity = currentState !== "disconnected" ? 0.08 + activeScale * 0.15 : 0.04;
      const outerGlowIntensity = currentState !== "disconnected" ? 0.35 + activeScale * 0.45 : 0.08;

      grad.addColorStop(0, primaryColor.replace("1)", "0"));
      grad.addColorStop(0.5, primaryColor.replace("1)", `${glowIntensity}`));
      grad.addColorStop(0.9, accentColor.replace("1)", `${glowIntensity * 1.5}`));
      grad.addColorStop(1, primaryColor.replace("1)", "0"));

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // 2. High-Gloss Shadow effects
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = currentState !== "disconnected" ? 18 + activeScale * 28 : 5;

      // 3. Drawing Morphing Organic Audio Waves around Sphere Border
      waveLayers.forEach((layer, layerIndex) => {
        ctx.beginPath();
        
        // Multi-frequency sound ripples
        const totalPoints = 140;
        const currentAmp = layer.amplitude + (currentState === "speaking" ? activeScale * 38 : (currentState === "listening" ? activeScale * 14 : 0));
        
        for (let i = 0; i <= totalPoints; i++) {
          const theta = (i / totalPoints) * Math.PI * 2;
          
          // Synthesize organic noise using multi-octave trigonometric waves
          const waveOffset1 = Math.sin(theta * layer.frequency + time * (layerIndex === 1 ? -1.4 : 1.1) + layer.phaseShift);
          const waveOffset2 = Math.cos(theta * (layer.frequency / 2) - time * 0.8 + layerIndex);
          const noise = (waveOffset1 * 0.7 + waveOffset2 * 0.3) * currentAmp;
          
          const r = baseRadius + noise;
          const x = centerX + Math.cos(theta) * r;
          const y = centerY + Math.sin(theta) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        
        // Vary wave stroke colors elegantly
        ctx.lineWidth = layerIndex === 2 ? 1.5 : 2;
        const transparency = currentState !== "disconnected" ? layer.opacity + activeScale * 0.3 : 0.08;
        
        ctx.strokeStyle = layerIndex === 0 
          ? primaryColor.replace("1)", `${transparency}`)
          : layerIndex === 1
            ? accentColor.replace("1)", `${transparency}`)
            : "rgba(255, 255, 255, " + (transparency * 0.8) + ")";
            
        ctx.stroke();
      });

      // 4. Draw Floating Quantum Star-Dust Dust Particles (Orbital flow)
      if (currentState !== "disconnected") {
        const particleCount = 18;
        for (let p = 0; p < particleCount; p++) {
          const pAngle = (p / particleCount) * Math.PI * 2 + time * 0.4;
          const orbitScale = 0.5 + Math.sin(time * 0.2 + p) * 0.25;
          const distOffset = (baseRadius - 15) * orbitScale;
          
          const pX = centerX + Math.cos(pAngle) * distOffset;
          const pY = centerY + Math.sin(pAngle) * distOffset;

          const size = 1.2 + (currentState === "speaking" ? activeScale * 2 : 0) + Math.cos(time + p) * 0.5;
          const trailOpacity = 0.45 + Math.sin(time + p) * 0.35 + activeScale * 0.2;

          ctx.beginPath();
          ctx.arc(pX, pY, size, 0, Math.PI * 2);
          ctx.fillStyle = p % 2 === 0 ? `rgba(255, 255, 255, ${trailOpacity})` : primaryColor.replace("1)", `${trailOpacity}`);
          ctx.fill();
        }
      }

      // 5. Draw Beautiful Glowing Concentric HUD Orbital Rings
      ctx.shadowBlur = 0; // Turn off glow for fine HUD geometric elements
      ctx.strokeStyle = primaryColor.replace("1)", "0.1");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 28, 0, Math.PI * 2);
      ctx.stroke();

      // Spinning dashboard dashed reference tracker
      ctx.strokeStyle = accentColor.replace("1)", "0.15");
      ctx.setLineDash([6, 18]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 18, time * 0.15, time * 0.15 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 6. Draw Elegant Center Wave Beacon
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5 + activeScale * 14, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor.replace("1)", "0.22");
      ctx.fill();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050816] font-sans text-slate-200 flex flex-col justify-between overflow-hidden select-none">
      
      {/* Background Circuit particle traces */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Glow highlight filter backdrop */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[600px] h-[600px] bg-[#00D4FF]/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-[#7C5CFF]/10 rounded-full blur-[180px]" />
      </div>

      {/* ================= HEADER PANEL (72px GLASS BAR) ================= */}
      <header className="z-30 h-18 shrink-0 w-full bg-[#050816]/70 backdrop-blur-xl border-b border-[#00D4FF]/15 py-3 px-6 flex items-center justify-between relative shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Glow border segment highlight */}
        <div className="absolute bottom-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/40 to-transparent" />

        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="py-1 px-2.5 border border-[#00D4FF]/20 bg-[#00D4FF]/5 rounded-md shadow-[0_0_12px_rgba(0,212,255,0.15)]">
            <span className="text-xs font-black tracking-widest text-[#00D4FF] font-orbitron">MYRAA</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold tracking-wider font-orbitron text-slate-100 uppercase">
              MYRAA <span className="text-[#7C5CFF]">OS</span>
            </h1>
            <span className="text-[8px] uppercase tracking-widest text-[#94A3B8]/60 font-mono">AI Companion v3.4 // Quantum Neural Link</span>
          </div>
        </div>

        {/* Center: System Status Beacon */}
        <div className="hidden md:flex items-center gap-3 bg-[#0B1220]/85 border border-slate-800 px-4 py-1.5 rounded-full shadow-inner">
          <div className={`w-2 h-2 rounded-full transition-all duration-500 animate-pulse ${
            state === "disconnected" ? "bg-red-500 shadow-[0_0_8px_#ef4444]" :
            state === "connecting" ? "bg-amber-500 shadow-[0_0_12px_#f59e0b]" :
            state === "thinking" ? "bg-purple-500 shadow-[0_0_12px_#7c5cff]" :
            state === "speaking" ? "bg-fuchsia-500 shadow-[0_0_12px_#c026ff]" :
            "bg-[#10B981] shadow-[0_0_12px_#10b981]"
          }`} />
          <span className="text-[10px] font-orbitron tracking-widest text-slate-300 uppercase">
            {state === "disconnected" && "SYSTEM OFFLINE"}
            {state === "connecting" && "SYNC FREQUENCIES..."}
            {state === "thinking" && "CORE: ANALYZING"}
            {state === "listening" && "CORE: LISTENING"}
            {state === "speaking" && "CORE: GENERATING RESPONSE"}
          </span>
        </div>

        {/* Right: Time, security latency & action indicators */}
        <div className="flex items-center gap-4">
          <div className="bg-[#0B1220]/75 border border-slate-800/80 px-4 py-1.5 rounded-lg flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#00D4FF] animate-pulse" />
            <span className="text-xs font-mono tracking-wider text-[#00D4FF] font-semibold">
              {digitalTime || "10:30:00 AM"}
            </span>
          </div>
          <div className="hidden sm:flex bg-[#0B1220]/75 border border-slate-800/80 px-3 py-1.5 rounded-lg text-left text-xs font-mono">
            <span className="text-[8px] uppercase text-slate-500 block leading-none mb-0.5">SECURE CORE</span>
            <span className="text-[10px] font-bold text-[#10B981]">PCM16 // 14ms</span>
          </div>
        </div>
      </header>

      {/* ================= PRIMARY MAIN OS CONCOUND ================= */}
      <main className="z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col items-center justify-between relative relative">
        


        {/* HERO AREA: CENTRAL OVERSIZED REACTOR ORB (DECOUPLED FROM FIXED COLUMNS) */}
        <div className="flex-1 flex flex-col items-center justify-center relative w-full select-none my-2">
          
          {/* Glowing Platform beneath core */}
          <div className="absolute bottom-[10%] w-[260px] h-6 bg-[#00D4FF]/5 rounded-full blur-md border border-[#00D4FF]/10 scale-y-50 z-0 pointer-events-none" />

          {/* Core Orb Container */}
          <motion.div 
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut" }}
            className="relative w-[340px] md:w-[410px] aspect-square flex items-center justify-center z-10 transition-all"
          >
            {/* Glossy futuristic sphere glass overlay overlay */}
            <div 
              onClick={triggerInterruption}
              role="button"
              tabIndex={0}
              className="absolute inset-0 rounded-full border border-[#00D4FF]/20 bg-gradient-to-tr from-[#050816]/70 to-[#00D4FF]/10 backdrop-blur-[1px] hover:border-[#00D4FF]/40 cursor-pointer shadow-[2px_4px_45px_rgba(0,0,0,0.85)] z-20 flex items-center justify-center group overflow-hidden"
            >
              {/* Spinning Hexagonal grid lines pattern for high scifi authenticity */}
              <div className="absolute inset-2 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(5,8,22,0.65)_90%)] bg-[#050816]/10 opacity-70 pointer-events-none" />
              
              {/* Dynamic canvas element rendering animated arc nodes */}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />

              {/* Minimal translucent glowing heart pulse */}
              <div className="relative z-30 flex flex-col items-center justify-center pointer-events-none select-none">
                <motion.div 
                  animate={{ 
                    scale: state === "speaking" ? [1, 1.25, 1] : state === "listening" ? [1, 1.1, 1] : [1, 1.04, 1],
                    opacity: state === "disconnected" ? 0.35 : [0.65, 0.95, 0.65]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: state === "speaking" ? 1.0 : state === "listening" ? 1.8 : 3.0, 
                    ease: "easeInOut" 
                  }}
                  className={`w-10 h-10 rounded-full border border-[#00D4FF]/45 flex items-center justify-center transition-all duration-500 bg-[#00D4FF]/10 shadow-[0_0_22px_rgba(0,212,255,0.35)]`}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,1)]" />
                </motion.div>
                <div className="mt-3.5 flex flex-col items-center opacity-70">
                  <span className="text-[8px] font-black tracking-[0.4em] font-orbitron text-[#00D4FF] uppercase">
                    {state === "disconnected" ? "passive core" : "quantum link"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Futurisic HUD Glass Control Deck with direct connection triggers and neural status */}
        <div className="w-full max-w-xl mx-auto mb-6 bg-[#040814]/85 border border-[#00D4FF]/15 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_8px_32px_rgba(0,212,255,0.05)] z-20">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Pulsing state button container */}
            <button
              onClick={state === "disconnected" ? connectSession : disconnectSession}
              className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border transition-all duration-300 shadow-[0_0_15px_rgba(0,212,255,0.1)] relative group ${
                state === "disconnected" 
                  ? "bg-slate-950 border-slate-800 text-slate-400 hover:border-[#00D4FF]/40 hover:text-[#00D4FF]"
                  : "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/30 hover:bg-[#00D4FF]/20"
              }`}
              title={state === "disconnected" ? "Establish Voice Link" : "Disconnect Voice Link"}
            >
              {state === "speaking" ? (
                <Volume2 className="w-5 h-5 animate-bounce" />
              ) : state === "listening" ? (
                <Mic className="w-5 h-5 text-[#00D4FF] animate-pulse" />
              ) : state === "thinking" ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : state === "connecting" ? (
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              ) : (
                <Power className="w-5 h-5 group-hover:scale-110 transition-transform" />
              )}
            </button>
            <div className="text-left font-mono min-w-0">
              <span className={`text-[10px] font-bold tracking-wider font-orbitron uppercase block ${
                state === "disconnected" ? "text-slate-400" :
                state === "connecting" ? "text-amber-400" :
                state === "speaking" ? "text-fuchsia-400 animate-pulse" :
                "text-[#00D4FF]"
              }`}>
                {state === "disconnected" ? "NEURAL LINK STANDBY" : `${state} state`}
              </span>
              <span className="text-[10px] text-slate-300 block leading-tight font-mono font-medium max-w-[280px]">
                {errorMsg ? errorMsg : (state === "disconnected" ? "Passive telemetry standby. Click icon to link." : 
                  state === "connecting" ? "Synchronizing core frequencies..." :
                  state === "listening" ? (volume > 5 ? "Myraa is parsing incoming audio stream..." : "Core linked. Speak naturally or send text.") :
                  state === "speaking" ? "Active voice response in progress..." :
                  state === "thinking" ? "Processing multi-agent financial matrix..." : ""
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
            {state === "disconnected" ? (
              <button
                onClick={connectSession}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#00D4FF]/20 to-[#7C5CFF]/20 hover:from-[#00D4FF]/30 hover:to-[#7C5CFF]/30 border border-[#00D4FF]/35 text-[#00D4FF] font-orbitron text-[10px] tracking-widest uppercase rounded-lg transition-all font-semibold"
              >
                Start Link
              </button>
            ) : (
              <button
                onClick={disconnectSession}
                className="w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 text-red-400 font-orbitron text-[10px] tracking-widest uppercase rounded-lg transition-all font-semibold"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* ================= SECURE WEB TOOL POP-OUT RETRY BANNER ================= */}
        {toolCalls.length > 0 && (
          <div className="w-full max-w-2xl mb-4 bg-[#0B1220]/80 border border-cyan-500/30 p-2.5 rounded-xl flex items-center justify-between backdrop-blur-xl relative shadow-xl shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-cyan-500/10 border border-cyan-400/20 text-[#00D4FF] rounded-lg">
                <Globe className="w-4 h-4 animate-spin" />
              </div>
              <div className="min-w-0 font-mono">
                <span className="text-[9px] text-[#00D4FF]/50 uppercase tracking-widest block font-bold">Live Tool Execution</span>
                <span className="text-xs text-slate-300 font-semibold truncate block">Opened {toolCalls[0].siteName}</span>
              </div>
            </div>
            <a 
              href={toolCalls[0].url} 
              target="_blank" 
              rel="noreferrer" 
              className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-[#00D4FF] hover:bg-cyan-400 text-slate-900 rounded font-orbitron"
            >
              Browse Tab
            </a>
          </div>
        )}

      </main>

      {/* ================= DOCKING DUAL CHAT LAYOUT LOG (FOR TYPING CONVERSATION) ================= */}
      {/* Scrollable telemetry chat dialog lines to show typing outcomes */}
      <AnimatePresence>
        {chatHistory.length > 1 && (
          <div className="z-20 w-full max-w-4xl mx-auto px-4 md:px-8 shrink-0 relative mt-2 max-h-[160px] overflow-y-auto space-y-2 font-mono scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {chatHistory.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-2 rounded-xl border text-[11px] leading-relaxed max-w-2xl ${
                  item.sender === "user"
                    ? "bg-[#00D4FF]/5 border-[#00D4FF]/25 text-[#00D4FF] ml-auto text-right"
                    : "bg-[#0B1220]/75 border-slate-800 text-slate-200 mr-auto text-left"
                }`}
              >
                <div className="flex items-center justify-between text-[8px] text-slate-500 mb-0.5 uppercase gap-4">
                  <span className={item.sender === "user" ? "text-[#00D4FF] font-bold" : "text-[#7C5CFF] font-bold"}>
                    [{item.sender === "user" ? "Client Terminal" : "MYRAA"}]
                  </span>
                  <span>{item.timestamp}</span>
                </div>
                {/* Simulated lightweight markdown parser rendering */}
                <p className="whitespace-pre-wrap select-text">{item.text}</p>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ================= DOCKING BOTTOM CONTROL CHAT BOARD & WAVEFORM ================= */}
      <footer className="z-30 w-full max-w-7xl mx-auto px-4 md:px-8 pb-4 pt-2 flex flex-col gap-4 bg-[#050816]/30 backdrop-blur-md">
        
        {/* Floating rounded Frosted Glass Chat Input Bar (900px wide) */}
        <div className="w-full max-w-4xl mx-auto bg-[#0B1220]/70 border border-[#00D4FF]/15 rounded-full p-2 flex items-center justify-between gap-3 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,212,255,0.05)] relative overflow-hidden">
          
          {/* Neon inner highlight link */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00D4FF]/25 to-transparent" />

          {/* Left: Attachment & typing trigger */}
          <div className="flex items-center gap-2 shrink-0 pl-2">
            <button 
              onClick={() => {
                alert("MYRAA OS Core: Simulated document index parsed. Drag other documents over terminal anytime.");
              }}
              className="p-2 text-slate-400 hover:text-[#00D4FF] rounded-full transition-all"
              title="Add documents/bank sheets attachment"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Command prompt input string */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Type message to Myraa... (e.g. 'How can I optimize my workflow?')"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  executeTextMessage(typedMessage);
                }
              }}
              className="w-full bg-transparent border-0 outline-none text-slate-100 font-mono text-xs placeholder:text-slate-500/80 focus:ring-0"
            />
          </div>

          {/* Right: Connect/Disconnect power link, Mic switch, Mute, Send */}
          <div className="flex items-center gap-2.5 pr-1">

            {state !== "disconnected" && (
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className={`p-2 rounded-full border transition-all ${
                  isMuted
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic Input"}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Simulated send or typing executor text node */}
            {typedMessage.trim().length > 0 ? (
              <button
                onClick={() => executeTextMessage(typedMessage)}
                className="p-2 bg-gradient-to-r from-[#00D4FF] to-[#7C5CFF] text-slate-950 rounded-full hover:scale-105 active:scale-95 transition-all"
                title="Transmit prompt segment"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            ) : (
              state === "disconnected" ? (
                <button 
                  onClick={connectSession}
                  className="px-5 py-2 rounded-full text-[10px] tracking-wider uppercase font-orbitron bg-gradient-to-r from-[#00D4FF] to-[#7C5CFF] text-[#050816] font-bold shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:opacity-90 active:scale-95 transition-all"
                >
                  Link Voice
                </button>
              ) : (
                <button 
                  onClick={disconnectSession}
                  className="px-5 py-2 rounded-full text-[10px] tracking-wider uppercase font-orbitron bg-red-500 hover:bg-red-400 text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  Disconnect
                </button>
              )
            )}

          </div>
        </div>

        {/* Dynamic Voice Waveform visualizers (Equalizers) tracking active voice amplitude */}
        <div className="flex justify-center items-center gap-1.5 h-6 shrink-0 select-none">
          {Array.from({ length: 30 }).map((_, i) => {
            const distanceFromCenter = Math.abs(i - 15);
            const peakFactor = (15 - distanceFromCenter) / 15; // [0, 1]
            let isActive = state !== "disconnected";

            let currentHeight = 3;
            if (isActive) {
              const currentVolumePercentage = volume / 100;
              currentHeight = 4 + (peakFactor * 26 * currentVolumePercentage) + (Math.sin(Date.now() * 0.007 + i) * 5 * currentVolumePercentage);
              currentHeight = Math.max(3, Math.min(30, currentHeight));
            } else {
              // Idle slight breathing pattern
              currentHeight = 3 + (Math.sin(Date.now() * 0.0016 + i) * 1.5);
            }

            return (
              <div
                key={i}
                style={{ height: currentHeight }}
                className={`w-1 rounded-full transition-all duration-300 ${
                  state === "disconnected" ? "bg-slate-800" :
                  state === "speaking" ? "bg-[#C026FF] shadow-[0_0_8px_rgba(192,38,255,0.6)]" :
                  state === "listening" ? "bg-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.6)]" :
                  "bg-[#7C5CFF]"
                }`}
              />
            );
          })}
        </div>

        {/* Console status footer indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[9px] text-[#94A3B8]/30 font-mono pt-2 border-t border-[#00D4FF]/10 select-none">
          <span>Myraa FinMate OS © 2026. SECURE COGNITIVE FEED MATRIX.</span>
          <span className="text-[#00D4FF]/50 uppercase tracking-widest font-bold">FREQUENCY LINK STATUS // STABLE COMPILING COMPLETE</span>
        </div>

      </footer>
    </div>
  );
}
