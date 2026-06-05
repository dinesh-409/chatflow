"use client";

import { useEffect, useState } from "react";

type Props = {
    activeSession: string;
    onSelect: (id: string) => void;
};

export default function ChatSidebar({
    activeSession,
    onSelect,
}: Props) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    const loadSessions = async () => {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/sessions`
            );
            const data = await res.json();
            setSessions(data || []);
        } catch {
            setSessions([]);
        }
    };

    useEffect(() => {
        loadSessions();
        const handleChatCreated = () => loadSessions();
        window.addEventListener("chat-created", handleChatCreated);
        return () => window.removeEventListener("chat-created", handleChatCreated);
    }, []);

    const createNewChat = () => {
        const id = crypto.randomUUID();
        onSelect(id);
    };

    const handleUpdate = async (id: string, data: any) => {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        loadSessions();
        setMenuOpen(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this chat permanently?")) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${id}`, {
            method: "DELETE"
        });
        if (activeSession === id) onSelect(crypto.randomUUID());
        loadSessions();
        setMenuOpen(null);
    };

    const handleRename = async (id: string, currentTitle: string) => {
        const newTitle = prompt("Enter new chat title:", currentTitle);
        if (newTitle && newTitle.trim() !== currentTitle) {
            handleUpdate(id, { title: newTitle.trim() });
        }
        setMenuOpen(null);
    };

    const pinned = sessions.filter(s => s.isPinned && !s.isArchived);
    const unpinned = sessions.filter(s => !s.isPinned && !s.isArchived);

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const todayChats = unpinned.filter(s => new Date(s.updatedAt || s.createdAt).toDateString() === today.toDateString());
    const sevenDaysChats = unpinned.filter(s => new Date(s.updatedAt || s.createdAt) > sevenDaysAgo && new Date(s.updatedAt || s.createdAt).toDateString() !== today.toDateString());
    const olderChats = unpinned.filter(s => new Date(s.updatedAt || s.createdAt) <= sevenDaysAgo);

    const renderChatGroup = (title: string, items: any[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase tracking-wider">{title}</h3>
                <div className="space-y-1">
                    {items.map(s => renderChatItem(s))}
                </div>
            </div>
        );
    };

    const renderChatItem = (s: any) => {
        const isActive = activeSession === s.sessionId;
        return (
            <div
                key={s._id}
                className={`group relative p-2 rounded-xl cursor-pointer text-sm flex items-center justify-between transition-colors ${isActive
                    ? "bg-gray-800 text-white"
                    : "hover:bg-gray-900 text-gray-300"
                }`}
            >
                <div className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis" onClick={() => onSelect(s.sessionId)}>
                    {s.title || "Untitled Chat"}
                </div>
                
                <button 
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-white text-gray-400 z-10"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === s.sessionId ? null : s.sessionId);
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>

                {menuOpen === s.sessionId && (
                    <div className="absolute right-2 top-8 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50 text-sm">
                        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleRename(s.sessionId, s.title); }}>Rename</button>
                        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleUpdate(s.sessionId, { isPinned: !s.isPinned }); }}>{s.isPinned ? "Unpin" : "Pin"}</button>
                        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleUpdate(s.sessionId, { isArchived: true }); }}>Archive</button>
                        <button className="w-full text-left px-3 py-1.5 hover:bg-red-900 text-red-400" onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}>Delete</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-[260px] bg-black border-r border-gray-800 p-3 flex flex-col h-screen">
            
            <button
                className="w-full mb-6 p-3 bg-gray-900 hover:bg-gray-800 transition-colors text-white rounded-xl flex items-center justify-center gap-2 font-medium"
                onClick={createNewChat}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                New Chat
            </button>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {renderChatGroup("Pinned", pinned)}
                {renderChatGroup("Today", todayChats)}
                {renderChatGroup("Previous 7 Days", sevenDaysChats)}
                {renderChatGroup("Older", olderChats)}
            </div>
            
            {/* Click away listener overlay */}
            {menuOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
            )}
        </div>
    );
}