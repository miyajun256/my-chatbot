// Next.js (App Router) + OpenAI API を使ったシンプルチャットボット
// .env に OPENAI_API_KEY を設定して使う

"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import "./styles.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
}

export default function MyChatbot() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "よう。何か聞きたいことある？" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // モデル一覧を取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch("/api/chat");
        const data = await res.json();
        
        const options = Object.entries(data.models).map(([id, name]) => ({
          id,
          name: name as string
        }));
        
        setModelOptions(options);
        setSelectedModel(data.defaultModel);
      } catch (err) {
        console.error("Error fetching models:", err);
        setError("モデル情報の取得に失敗しました");
      } finally {
        setLoadingModels(false);
      }
    };
    
    fetchModels();
  }, []);

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

  // 選択中のモデルを保存
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("selectedModel", selectedModel);
    }
  }, [selectedModel]);

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

    // 保存されたモデル設定の読み込み
    const savedModel = localStorage.getItem("selectedModel");
    if (savedModel) {
      setSelectedModel(savedModel);
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

  // モデル情報表示用
  const getModelBadgeColor = (modelId: string) => {
    if (!modelId) return "bg-gray-500";
    if (modelId.includes("gpt-4")) return "bg-green-500";
    if (modelId.includes("claude")) return "bg-purple-500";
    if (modelId.includes("gpt-3.5")) return "bg-yellow-500";
    return "bg-gray-500";
  };

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
        body: JSON.stringify({ 
          messages: newMessages,
          model: selectedModel 
        }),
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

  // モデル選択の変更
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  // ローディングドット用のスタイル
  const loadingDotStyle = "inline-block w-1 h-1 mx-0.5 rounded-full bg-current";

  // アニメーションのスタイル
  const spinnerStyle = {
    display: 'flex',
    alignItems: 'center', 
    gap: '2px'
  };

  const dotStyle = {
    width: '4px',
    height: '4px',
    backgroundColor: 'currentColor',
    borderRadius: '50%',
    display: 'inline-block'
  };

  const dot1Style = {
    ...dotStyle,
    animation: 'bounce 1s infinite'
  };

  const dot2Style = {
    ...dotStyle,
    animation: 'bounce 1s infinite',
    animationDelay: '200ms'
  };

  const dot3Style = {
    ...dotStyle,
    animation: 'bounce 1s infinite',
    animationDelay: '400ms'
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-black"} transition-colors duration-200`}>
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">俺っぽいAI</h1>
          <div className="flex space-x-2">
            <button 
              onClick={toggleDarkMode}
              className={`text-sm px-2 py-1 rounded ${darkMode ? "bg-gray-700" : "bg-gray-200"} hover:opacity-80`}
            >
              {darkMode ? "ライトモード" : "ダークモード"}
            </button>
            <button 
              onClick={clearChat}
              className={`text-sm px-2 py-1 rounded ${darkMode ? "bg-gray-700" : "bg-gray-200"} hover:opacity-80`}
            >
              会話をリセット
            </button>
          </div>
        </div>
        
        {/* モデル選択 */}
        <div className="flex items-center">
          <label className="text-sm mr-2">AIモデル:</label>
          {loadingModels ? (
            <div className="flex items-center">
              <div className={`animate-pulse w-32 h-6 ${darkMode ? "bg-gray-700" : "bg-gray-300"} rounded`}></div>
              <span className={`ml-2 text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>読み込み中...</span>
            </div>
          ) : (
            <>
              <select 
                value={selectedModel} 
                onChange={handleModelChange}
                className={`text-sm rounded px-2 py-1 ${
                  darkMode 
                    ? "bg-gray-800 text-white border-gray-700" 
                    : "bg-white text-black border-gray-300"
                } border focus:outline-none focus:ring-1 focus:ring-blue-500`}
                disabled={loading}
              >
                {modelOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <div className="ml-1">
                <span 
                  className={`inline-block rounded-full w-2 h-2 ${getModelBadgeColor(selectedModel)}`}
                />
              </div>
            </>
          )}
        </div>
        
        {error && (
          <div className={`p-2 rounded ${darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800"} text-sm`}>
            {error}
          </div>
        )}
        
        <div className={`p-4 rounded-lg h-96 overflow-y-auto ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border`}>
          {messages.map((msg, i) => (
            <div key={i} className={`my-2 ${msg.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === "user" 
                    ? `${darkMode ? "bg-blue-600" : "bg-blue-500"} text-white` 
                    : `${darkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start my-2">
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${darkMode ? "bg-gray-700 text-white" : "bg-gray-100 text-black"}`}>
                <div className="flex items-center">
                  <span>考え中</span>
                  <span className="flex ml-2" style={spinnerStyle}>
                    <span style={dot1Style}></span>
                    <span style={dot2Style}></span>
                    <span style={dot3Style}></span>
                  </span>
                </div>
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
