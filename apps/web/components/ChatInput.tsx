export default function ChatInput({ message, setMessage, sendMessage, stop }: any) {
    return (
        <div className="flex gap-2 mt-3">
            <input
                className="border p-2 flex-1 rounded"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type message..."
            />

            <button
                className="bg-green-500 text-white px-4 py-2 rounded"
                onClick={sendMessage}
            >
                Send 🚀
            </button>

            <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={stop}
            >
                Stop ✋
            </button>
        </div>
    );
}