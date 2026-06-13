"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../lib/api";

type Props = {
    activeSession: string;
    onSelect: (id: string) => void;
};

type SessionItem = {
    _id: string;
    sessionId: string;
    title: string;
    isPinned: boolean;
    isArchived: boolean;
    updatedAt?: string;
    createdAt?: string;
};

export default function ChatSidebar({ activeSession, onSelect }: Props) {
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { user, logout } = useAuth();

    const loadSessions = async () => {
        try {
            const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions`);
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

    const handleUpdate = async (id: string, data: Partial<SessionItem>) => {
        await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        loadSessions();
        setMenuOpen(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this chat permanently?")) return;
        await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${id}`, { method: "DELETE" });
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

    // Filter + group
    const filtered = sessions.filter(s =>
        !s.isArchived && (!searchQuery || (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const pinned = filtered.filter(s => s.isPinned);
    const unpinned = filtered.filter(s => !s.isPinned);

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const todayChats = unpinned.filter(s => new Date(s.updatedAt || s.createdAt || "").toDateString() === today.toDateString());
    const sevenDaysChats = unpinned.filter(s => {
        const d = new Date(s.updatedAt || s.createdAt || "");
        return d > sevenDaysAgo && d.toDateString() !== today.toDateString();
    });
    const olderChats = unpinned.filter(s => new Date(s.updatedAt || s.createdAt || "") <= sevenDaysAgo);

    const renderChatGroup = (title: string, items: SessionItem[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-4">
                <h3 className="text-[10px] font-semibold text-gray-500 mb-1.5 px-2 uppercase tracking-widest">{title}</h3>
                <div className="space-y-0.5">
                    {items.map(s => renderChatItem(s))}
                </div>
            </div>
        );
    };

    const renderChatItem = (s: SessionItem) => {
        const isActive = activeSession === s.sessionId;
        return (
            <div
                key={s._id}
                className={`group relative px-2.5 py-2 rounded-lg cursor-pointer text-[13px] flex items-center justify-between transition-all ${
                    isActive
                        ? "bg-gray-800/80 text-white"
                        : "hover:bg-gray-800/40 text-gray-400 hover:text-gray-200"
                }`}
            >
                <div className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis pr-2" onClick={() => onSelect(s.sessionId)}>
                    {s.isPinned && <span className="mr-1.5">📌</span>}
                    {s.title || "Untitled Chat"}
                </div>

                <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-white text-gray-500 z-10 transition flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === s.sessionId ? null : s.sessionId); }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>

                {menuOpen === s.sessionId && (
                    <div className="absolute right-0 top-8 w-36 bg-[#1a1a1a] border border-gray-700/80 rounded-xl shadow-2xl py-1 z-50 text-xs overflow-hidden">
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 hover:text-white transition" onClick={(e) => { e.stopPropagation(); handleRename(s.sessionId, s.title); }}>
                            ✏️ Rename
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 hover:text-white transition" onClick={(e) => { e.stopPropagation(); handleUpdate(s.sessionId, { isPinned: !s.isPinned }); }}>
                            {s.isPinned ? "📌 Unpin" : "📌 Pin"}
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300 hover:text-white transition" onClick={(e) => { e.stopPropagation(); handleUpdate(s.sessionId, { isArchived: true }); }}>
                            📦 Archive
                        </button>
                        <div className="border-t border-gray-700/50 my-0.5" />
                        <button className="w-full text-left px-3 py-2 hover:bg-red-900/50 text-red-400 transition" onClick={(e) => { e.stopPropagation(); handleDelete(s.sessionId); }}>
                            🗑️ Delete
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-[260px] bg-[#0f0f0f] border-r border-gray-800/80 flex flex-col h-screen">
            {/* Header */}
            <div className="p-3">
                <button
                    className="w-full p-2.5 bg-gray-800/50 hover:bg-gray-800 transition text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-gray-700/50 hover:border-gray-600"
                    onClick={createNewChat}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                    New Chat
                </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-3">
                <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search chats..."
                        className="w-full bg-gray-800/30 text-gray-300 text-xs pl-8 pr-3 py-2 rounded-lg border border-gray-700/30 focus:border-gray-600 focus:outline-none placeholder-gray-600 transition"
                    />
                </div>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2">
                {renderChatGroup("📌 Pinned", pinned)}
                {renderChatGroup("Today", todayChats)}
                {renderChatGroup("Previous 7 Days", sevenDaysChats)}
                {renderChatGroup("Older", olderChats)}

                {filtered.length === 0 && (
                    <div className="text-center text-gray-600 text-xs mt-8">
                        {searchQuery ? "No matching chats" : "No conversations yet"}
                    </div>
                )}
            </div>

            {/* Click-away overlay */}
            {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />}

            {/* User profile strip */}
            {user && (
                <div className="p-3 border-t border-gray-800/80">
                    <div className="flex items-center gap-2.5">
                        {user.avatar ? (
                            <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-700" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {user.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                        )}
                        <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-200 truncate">{user.name}</span>
                            <span className="text-[10px] text-gray-500 truncate">{user.isGuest ? "Guest" : (user.email || "")}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition flex-shrink-0"
                            title="Logout"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}