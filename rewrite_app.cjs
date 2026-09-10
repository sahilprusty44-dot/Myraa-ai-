const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Imports
code = code.replace(
  /Mic,/,
  `Mic,
  Camera,
  CameraOff,
  Video,
  MonitorPlay,
  MonitorOff,`
);

// 2. State
code = code.replace(
  /const \[isMuted, setIsMuted\] = useState<boolean>\(false\);/,
  `const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);`
);

// 3. Refs
code = code.replace(
  /const isMutedRef = useRef<boolean>\(false\);/,
  `const isMutedRef = useRef<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const isAnalyzingVisionRef = useRef<boolean>(false);`
);

code = code.replace(
  /useEffect\(\(\) => \{\n\s+isMutedRef\.current = isMuted;\n\s+\}, \[isMuted\]\);/,
  `useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isAnalyzingVisionRef.current = isAnalyzingVision;
  }, [isAnalyzingVision]);`
);


// 4. Effects
code = code.replace(
  /useEffect\(\(\) => \{\n    return \(\) => \{\n      disconnectSession\(\);\n    \};\n  \}, \[\]\);/,
  `useEffect(() => {
    return () => {
      disconnectSession();
      stopCamera();
    };
  }, []);

  const VISION_FRAME_INTERVAL_MS = 3000;

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);

      // Start capturing frames if connected
      startFrameCapture();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Camera permission denied or unavailable.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    stopFrameCapture();
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const sendSingleFrame = () => {
    if (isCameraActive && videoRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          const base64Data = dataUrl.split(",")[1];
          wsRef.current.send(JSON.stringify({
            type: "image",
            mimeType: "image/jpeg",
            data: base64Data
          }));
        }
      }
    }
  };

  const startFrameCapture = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    frameIntervalRef.current = window.setInterval(() => {
      // Only capture if websocket is connected, camera is active, AND we are analyzing vision (a recent query)
      if (stateRef.current !== "disconnected" && isCameraActive && isAnalyzingVisionRef.current) {
        sendSingleFrame();
      }
    }, VISION_FRAME_INTERVAL_MS);
  };

  const stopFrameCapture = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };`
);


// 5. Hooks into websocket connection logic
code = code.replace(
  /setState\("connecting"\);/,
  `setState("connecting");\n    if (isCameraActive) startFrameCapture();`
);

code = code.replace(
  /if \(streamerRef.current\) \{/,
  `stopFrameCapture();\n    if (streamerRef.current) {`
);


// Chat History WS integration
code = code.replace(
  /if \(msg.type === "interrupted"\) \{/,
  `if (msg.type === "text") {
            setChatHistory(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.sender === "myraa" && lastMsg.id === "current-turn") {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = { ...lastMsg, text: lastMsg.text + msg.text };
                return newHistory;
              } else {
                return [...prev, {
                  id: "current-turn",
                  sender: "myraa",
                  text: msg.text,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }];
              }
            });
          }

          if (msg.type === "transcription" && msg.finished && msg.text) {
             setChatHistory(prev => {
                return [...prev, {
                  id: \`usr-\${Date.now()}\`,
                  sender: "user",
                  text: "🎙️ " + msg.text,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }];
             });
             if (isCameraActive) {
               setIsAnalyzingVision(true);
               sendSingleFrame();
               setTimeout(() => setIsAnalyzingVision(false), 5000);
             }
          }

          if (msg.type === "turnComplete") {
            setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg && lastMsg.id === "current-turn") {
                 newHistory[newHistory.length - 1] = { ...lastMsg, id: \`myraa-\${Date.now()}\` };
              }
              return newHistory;
            });
          }

          if (msg.type === "interrupted") {`
);

// Player callback ID finalize
code = code.replace(
  /playerRef.current = new AudioPlayer\(\n        \(\) => \{\n          setState\("speaking"\);\n        \},\n        \(\) => \{\n          setState\("listening"\);\n        \},/,
  `playerRef.current = new AudioPlayer(
        () => {
          setState("speaking");
        },
        () => {
          setState("listening");
          setChatHistory(prev => {
              const newHistory = [...prev];
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg && lastMsg.id === "current-turn") {
                 newHistory[newHistory.length - 1] = { ...lastMsg, id: \`myraa-\${Date.now()}\` };
              }
              return newHistory;
          });
        },`
);

// executeTextMessage
code = code.replace(
  /const executeTextMessage = \(\w+: string\) => \{[\s\S]*?setState\("listening"\);\n    \}, 1200\);\n  \};/,
  `const executeTextMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: \`usr-\${Date.now()}\`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setTypedMessage("");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clientText", text }));
      setState("thinking");

      if (isCameraActive) {
        setIsAnalyzingVision(true);
        sendSingleFrame();
        setTimeout(() => setIsAnalyzingVision(false), 5000);
      }
    } else {
      setState("thinking");
      setTimeout(() => {
        const myraaMsg: ChatMessage = {
          id: \`myraa-\${Date.now()}\`,
          sender: "myraa",
          text: "I am currently offline. Please click 'Start Link' to establish connection with my neural core.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setChatHistory((prev) => [...prev, myraaMsg]);
        setState("disconnected");
      }, 800);
    }
  };`
);


// UI Layout replacement (Centered orb with absolute absolute positioned camera box to keep orb perfectly centered)
code = code.replace(
  /\{\/\* HERO AREA: CENTRAL OVERSIZED REACTOR ORB \(DECOUPLED FROM FIXED COLUMNS\) \*\/\}\n\s+<div className="flex-1 flex flex-col items-center justify-center relative w-full select-none my-2">/,
  `{/* HERO AREA: FLEX CONTAINER FOR CONVERSATION AND VISION */}
        <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col mb-4 items-center justify-center relative">

          {/* Central Oversized Reactor Orb (Conversation/Core) */}
          <div className="flex-1 flex flex-col items-center justify-center relative select-none w-full min-h-[350px] my-2">`
);


code = code.replace(
  /<\/div>\n\n\s+{\/\* Futurisic HUD Glass Control Deck/,
  `</div>

          {/* RIGHT: Laptop Camera Vision Box (Absolute positioned to keep Orb perfectly centered) */}
          <div className={\`w-full md:w-[260px] \${isCameraActive ? 'flex' : 'hidden'} flex-col shrink-0 md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2 z-30\`}>
            <div className="w-full bg-[#050816]/80 backdrop-blur-xl border border-[#00D4FF]/30 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,212,255,0.1)] relative flex flex-col h-[260px]">

              {/* Vision Header */}
              <div className="h-8 bg-[#0B1220]/80 border-b border-[#00D4FF]/10 flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <MonitorPlay className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span className="text-[9px] font-orbitron tracking-widest text-[#00D4FF] font-semibold uppercase">Live Camera</span>
                </div>
                <div className="flex items-center gap-2">
                  {(state !== "disconnected" && isCameraActive && isAnalyzingVision) && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30">
                      <div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                      <span className="text-[7px] uppercase tracking-wider text-purple-300 font-mono">Analyzing</span>
                    </div>
                  )}
                  <button onClick={stopCamera} className="text-slate-400 hover:text-red-400 transition-colors">
                    <MonitorOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Vision Content */}
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[160px]">
                {cameraError ? (
                  <div className="text-center p-3 text-red-400 font-mono text-xs">
                    <p className="mb-2">⚠️ {cameraError}</p>
                    <button onClick={startCamera} className="px-3 py-1 bg-red-500/20 rounded text-red-300 hover:bg-red-500/30">Retry</button>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Overlay Scanning Effect */}
                {state !== "disconnected" && isCameraActive && isAnalyzingVision && (
                  <div className="absolute inset-0 pointer-events-none">
                     <div className="absolute top-0 left-0 w-full h-full border-2 border-[#00D4FF]/20 z-10" />
                     {/* Scanning line animation */}
                     <motion.div
                        animate={{ y: ["0%", "100%", "0%"] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="absolute top-0 left-0 w-full h-[2px] bg-[#00D4FF]/60 shadow-[0_0_8px_#00D4FF] z-20"
                     />
                  </div>
                )}
              </div>

              {/* Vision Footer */}
              <div className="h-6 bg-[#0B1220]/80 border-t border-[#00D4FF]/10 flex items-center justify-center px-3 shrink-0">
                <span className="text-[8px] font-mono text-slate-400">
                  {state !== "disconnected" ? "Transmitting visual context..." : "Vision offline (Core Disconnected)"}
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* Futurisic HUD Glass Control Deck`
);

// Connect button Camera Toggle icon
code = code.replace(
  /<button\n\s+onClick=\{state === "disconnected" \? connectSession : disconnectSession\}/,
  `<button
              onClick={toggleCamera}
              className={\`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border transition-all duration-300 shadow-[0_0_15px_rgba(0,212,255,0.1)] relative group \${
                !isCameraActive
                  ? "bg-slate-950 border-slate-800 text-slate-400 hover:border-[#00D4FF]/40 hover:text-[#00D4FF]"
                  : "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/30 hover:bg-[#00D4FF]/20"
              }\`}
              title={isCameraActive ? "Disable Camera" : "Enable Camera Vision"}
            >
              {isCameraActive ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
            </button>

            <button
              onClick={state === "disconnected" ? connectSession : disconnectSession}`
);

fs.writeFileSync('src/App.tsx', code);
