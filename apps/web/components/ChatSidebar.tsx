"use client";

import { useEffect, useState } from "react";

type Props = {
    activeSession: string;
    onSelect: (id: string) => void;
};

export default function ChatSidebar({ activeSession, onSelect }: Props) {
    const [sessions, setSessions] = useState<any[]>([]);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions`)
            .then((res) => res.json())
            .then((data) => setSessions(data || []))
            .catch(() => setSessions([]));
    }, []);

    return (
        <div className="w-64 bg-black border-r border-gray-800 p-3">
            <h2 className="text-white font-bold mb-3">Chats</h2>

            <button
                className="w-full mb-3 p-2 bg-green-500 text-black rounded"
                onClick={() => window.location.reload()}
            >
                + New Chat
            </button>

            <div className="space-y-2">
                {sessions.map((s) => (
                    <div
                        key={s._id}
                        onClick={() => onSelect(s._id)}
                        className={`p-2 rounded cursor-pointer text-sm ${activeSession === s._id
                                ? "bg-green-500 text-black"
                                : "bg-gray-900 text-white"
                            }`}
                    >
                        {s.title || "Untitled Chat"}
                    </div>
                ))}
            </div>
        </div>
    );
}