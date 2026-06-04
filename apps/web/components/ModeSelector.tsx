export default function ModeSelector({ mode, setMode }: any) {
    const modes = ["auto", "gemini", "groq", "openrouter"];

    return (
        <div className="flex gap-2 justify-center mb-3">
            {modes.map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 border rounded ${mode === m ? "bg-black text-white" : ""
                        }`}
                >
                    {m.toUpperCase()}
                </button>
            ))}
        </div>
    );
}