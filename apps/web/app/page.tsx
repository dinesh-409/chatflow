"use client";

import { useEffect, useRef, useState } from "react";
import ChatSidebar from "../components/ChatSidebar";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export default function Page() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("auto");
  const [activeSession, setActiveSession] = useState("");
  const [activeModel, setActiveModel] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef("");

  useEffect(() => {
    const savedSession =
      sessionStorage.getItem("chatflow_session");

    if (savedSession) {
      sessionIdRef.current = savedSession;
      setActiveSession(savedSession);
    } else {
      const id = crypto.randomUUID();

      sessionIdRef.current = id;
      setActiveSession(id);

      sessionStorage.setItem(
        "chatflow_session",
        id
      );
    }
  }, []);

  useEffect(() => {
    if (!activeSession) return;

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${activeSession}`
    )
      .then((res) => res.json())
      .then((data) => {
        setChat(
          (data?.messages || []).map(
            (m: {
              role: "user" | "ai";
              text: string;
            }) => ({
              role: m.role,
              text: m.text,
            })
          )
        );
      })
      .catch(() => setChat([]));
  }, [activeSession]);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const streamMessage = async (msg: string) => {
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setChat((prev) => [
      ...prev,
      { role: "user", text: msg },
      { role: "ai", text: "" },
    ]);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat-stream`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: msg,
            sessionId:
              sessionIdRef.current,
            mode,
          }),
        }
      );

      if (!res.body) {
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let aiText = "";

      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines =
          buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (
            !line.startsWith("data: ")
          )
            continue;

          const raw = line
            .replace("data: ", "")
            .trim();

          if (raw === "[DONE]")
            continue;

          let parsedText = raw;
          try {
             const parsed = JSON.parse(raw);
             if (parsed.type === "meta") {
                 setActiveModel(parsed.model);
                 continue;
             }
             if (parsed.text) {
                 parsedText = parsed.text;
             }
          } catch (e) {
             // Fallback to raw
          }

          aiText += parsedText;

          setChat((prev) => {
            const updated = [...prev];

            updated[
              updated.length - 1
            ] = {
              role: "ai",
              text: aiText,
            };

            return updated;
          });
        }
      }
    } catch (err) {
      console.error(
        "Stream Error:",
        err
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      if (!loading && messageQueue.length > 0) {
          const nextMsg = messageQueue[0];
          setMessageQueue(prev => prev.slice(1));
          streamMessage(nextMsg);
      }
  }, [loading, messageQueue]);

  const sendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;

    const msg = message;
    const isFirstMessage = chat.length === 0;
    const currentAttachments = attachments;

    setMessage("");
    setAttachments([]);

    let fileUrls: string[] = [];
    if (currentAttachments.length > 0) {
        setLoading(true);
        try {
            const formData = new FormData();
            currentAttachments.forEach(f => formData.append("files", f));
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            fileUrls = data.urls || [];
        } catch (e) {
            console.error("Upload failed", e);
        }
    }

    const finalMsg = fileUrls.length > 0 ? `[Attached Files: ${fileUrls.map(u => `${process.env.NEXT_PUBLIC_API_URL}${u}`).join(", ")}]\n${msg}` : msg;

    if (loading) {
        setChat(prev => [...prev, { role: "user", text: msg }]);
        setMessageQueue(prev => [...prev, finalMsg]);
        return;
    }

    await streamMessage(finalMsg);
    
    if (isFirstMessage) {
        window.dispatchEvent(new CustomEvent("chat-created"));
    }
  };

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice input not supported in this browser.");
        return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
        setMessage(prev => prev + (prev ? " " : "") + event.results[0][0].transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files) {
         setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
     }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      <ChatSidebar
        activeSession={activeSession}
        onSelect={(id: string) => {
          sessionIdRef.current = id;

          sessionStorage.setItem(
            "chatflow_session",
            id
          );

          setActiveSession(id);
          setChat([]);
        }}
      />

      <div className="flex flex-col flex-1">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            🚀 ChatFlow AI
          </h1>
        </div>

        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col"
        >
          {chat.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center -mt-20">
              <h2 className="text-4xl font-semibold text-gray-200 mb-8">What's on your mind today?</h2>
            </div>
          ) : (
            chat.map((c, i) => (
              <div key={i} className="flex flex-col">
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${c.role === "user"
                      ? "ml-auto bg-[#383838] text-white"
                      : "bg-transparent text-gray-100"
                    }`}
                >
                  {c.text}
                </div>
                {c.role === "ai" && activeModel && i === chat.length - 1 && (
                  <div className="text-xs text-gray-500 mt-2 ml-2 flex items-center gap-1.5 font-medium">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Model Used: {activeModel}
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="text-gray-400 flex items-center gap-2 px-4 py-2">
              <div className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-pulse"></div>
              <div className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-pulse delay-75"></div>
              <div className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-pulse delay-150"></div>
            </div>
          )}
        </div>

        <div className="p-4 mx-auto w-full max-w-4xl">
          <div className="bg-[#1e1f20] rounded-3xl p-3 flex flex-col gap-2 border border-gray-800">
            
            <div className="flex items-center gap-2 px-2">
               <button className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
               </button>
               
               <select 
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="appearance-none bg-transparent text-gray-300 font-medium text-sm focus:outline-none cursor-pointer hover:bg-gray-700 px-3 py-1.5 rounded-full"
               >
                  <option value="auto" className="bg-gray-800 text-white">Auto (Smart)</option>
                  <option value="gemini" className="bg-gray-800 text-white">Gemini 3.1 Pro (High)</option>
                  <option value="groq" className="bg-gray-800 text-white">Groq Llama 3.1 (Fast)</option>
                  <option value="openrouter" className="bg-gray-800 text-white">OpenRouter GPT-4o</option>
               </select>
            </div>

            <div className="flex items-center gap-2">
              {attachments.length > 0 && (
                  <div className="flex gap-2 px-4 pt-2">
                      {attachments.map((f, i) => (
                          <div key={i} className="bg-gray-800 text-xs px-2 py-1 rounded text-gray-300 flex items-center gap-1">
                              {f.name}
                              <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 ml-1">×</button>
                          </div>
                      ))}
                  </div>
              )}
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything, @ to mention, / for actions"
                className="flex-1 bg-transparent text-white px-4 py-3 focus:outline-none text-[15px] placeholder-gray-500"
              />
              
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>

              <button onClick={handleVoice} className={`p-2 rounded-full hover:bg-gray-700 transition-colors ${isListening ? "text-red-500 bg-red-500/10" : "text-gray-400"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </button>

              {loading ? (
                <button
                  onClick={stop}
                  className="bg-gray-700 p-2.5 rounded-full text-white hover:bg-gray-600 transition-colors flex items-center justify-center mr-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  className={`p-2.5 rounded-full transition-colors flex items-center justify-center mr-1 ${message.trim() ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-gray-800 text-gray-600"}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}