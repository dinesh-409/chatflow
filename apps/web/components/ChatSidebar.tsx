"use client";

import { useEffect, useState } from "react";

export default function ChatSidebar({ onSelect, activeSession }: any) {
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions`)
            .then((res) => res.json())
            .then(setSessions)
            .catch((err) => console.error("Sidebar load error:", err));
    }, []);

    return (
        <div className="w-64 border-r h-screen p-3 bg-white">

            <button
                className="bg-green-500 text-white px-3 py-1 rounded w-full mb-3"
                onClick={() => window.location.reload()}
            >
                + New Chat
            </button>

            <h2 className="font-bold mb-2">Chats</h2>

            {sessions.map((s: any) => (
                <div
                    key={s.sessionId}
                    onClick={() => onSelect(s.sessionId)}
                    className={`p-2 rounded cursor-pointer hover:bg-gray-200 ${activeSession === s.sessionId ? "bg-gray-300" : ""
                        }`}
                >
                    💬 {s.title || "New Chat"}
                </div>
            ))}
        </div>
    );
}