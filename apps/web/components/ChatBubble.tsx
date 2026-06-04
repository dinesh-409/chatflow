export default function ChatBubble({ role, text }: any) {
    return (
        <div className={`p-3 rounded mb-2 whitespace-pre-wrap ${role === "user" ? "bg-green-100 ml-auto w-fit" : "bg-gray-200"
            }`}>
            <b>{role === "user" ? "You" : "AI"}:</b> {text}
        </div>
    );
}