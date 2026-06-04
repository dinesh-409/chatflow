export type ChatMessage = {
    role: "user" | "ai";
    text: string;
};

export type ChatSession = {
    id: string;
    title: string;
    messages: ChatMessage[];
};