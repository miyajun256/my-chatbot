// Next.js (App Router) + OpenAI API を使ったシンプルチャットボット
// .env に OPENAI_API_KEY を設定して使う

"use client";

import { useState } from "react";

export default function MyChatbot() {
  const [messages, setMessages] = useState([{ role: "assistant", content: "よう。何か聞きたいことある？" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });
    const data = await res.json();
    setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">俺っぽいAI</h1>
      <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
            <p className="my-1"><span className="font-semibold">{msg.role === "user" ? "あなた" : "俺AI"}：</span>{msg.content}</p>
          </div>
        ))}
        {loading && <p>俺AI：考え中…</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border px-2 py-1 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} className="bg-black text-white px-4 py-1 rounded">送信</button>
      </div>
    </div>
  );
}

// --- /api/chat.ts ---