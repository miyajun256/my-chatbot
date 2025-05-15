// Next.js (App Router) + OpenAI API を使ったシンプルチャットボット
// .env に OPENAI_API_KEY を設定して使う

"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function MyChatbot() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "よう。何か聞きたいことある？" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ダークモード設定の読み込み
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "true") {
      setDarkMode(true);
    }
  }, []);

  // ダークモード設定の保存
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // ローカルストレージから会話履歴を読み込む
  useEffect(() => {
    const savedMessages = localStorage.getItem("chatHistory");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // 型を確認して適合するものだけ設定
        if (Array.isArray(parsedMessages) && 
            parsedMessages.every(msg => 
              (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string"
            )) {
          setMessages(parsedMessages as Message[]);
        }
      } catch (e) {
        console.error("Failed to parse saved messages:", e);
      }
    }
  }, []);

  // 会話履歴を保存する
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }, [messages]);

  // 新しいメッセージが追加されたら自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setError(null);
    const newMessages: Message[] = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "AIとの通信に失敗しました");
      }
      
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      console.error("Error during chat API call:", err);
      setError(err instanceof Error ? err.message : "通信エラーが発生しました");
      // エラーメッセージをアシスタントのメッセージとして追加
      setMessages([...newMessages, { 
        role: "assistant", 
        content: "すみません、エラーが発生しました。しばらく待ってからもう一度試してみてください。" 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // 会話履歴をクリアする
  const clearChat = () => {
    const initialMessage: Message[] = [{ role: "assistant", content: "よう。また話そうぜ。何か聞きたいことある？" }];
    setMessages(initialMessage);
    localStorage.setItem("chatHistory", JSON.stringify(initialMessage));
    setError(null);
  };

  // Enterキーで送信
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ダークモード切り替え
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`min-h-screen ${darkMode ? "dark bg-gray-900" : "bg-gray-50"} transition-colors duration-200`}>
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-black"}`}>俺っぽいAI</h1>
          <div className="flex space-x-2">
            <button 
              onClick={toggleDarkMode}
              className={`text-sm px-2 py-1 rounded ${darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-black"} hover:opacity-80`}
            >
              {darkMode ? "ライトモード" : "ダークモード"}
            </button>
            <button 
              onClick={clearChat}
              className={`text-sm px-2 py-1 rounded ${darkMode ? "bg-gray-700 text-white" : "bg-gray-200 text-black"} hover:opacity-80`}
            >
              会話をリセット
            </button>
          </div>
        </div>
        
        {error && (
          <div className={`p-2 rounded ${darkMode ? "bg-red-900" : "bg-red-100"} ${darkMode ? "text-red-200" : "text-red-800"} text-sm`}>
            {error}
          </div>
        )}
        
        <div className={`p-4 rounded-lg h-96 overflow-y-auto ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
          {messages.map((msg, i) => (
            <div key={i} className={`my-2 ${msg.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === "user" 
                    ? `${darkMode ? "bg-blue-600" : "bg-blue-500"} text-white` 
                    : `${darkMode ? "bg-gray-700" : "bg-gray-100"} ${darkMode ? "text-white" : "text-black"}`
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start my-2">
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${darkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
                考え中…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <textarea
            className={`flex-1 px-3 py-2 rounded-lg resize-none border ${
              darkMode 
                ? "bg-gray-800 text-white border-gray-700 focus:border-blue-500" 
                : "bg-white text-black border-gray-300 focus:border-blue-400"
            } focus:outline-none focus:ring-1 focus:ring-blue-500`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={2}
            placeholder="メッセージを入力..."
            disabled={loading}
          />
          <button 
            onClick={sendMessage}
            className={`${
              loading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-blue-500 hover:bg-blue-600"
            } text-white px-4 py-2 rounded-lg transition`}
            disabled={loading}
          >
            {loading ? "送信中..." : "送信"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- /api/chat.ts ---
