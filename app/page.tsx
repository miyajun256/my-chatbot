// Next.js (App Router) + OpenAI API を使ったシンプルチャットボット
// .env に OPENAI_API_KEY を設定して使う

"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";

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
      document.documentElement.classList.add('dark');
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

  // アニメーションのスタイル
  const spinnerStyle = {
    display: 'flex',
    alignItems: 'center', 
    marginLeft: '8px',
    gap: '4px'
  };

  const dotStyle = {
    width: '4px',
    height: '4px',
    margin: '0 1px',
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
    animationDelay: '0.2s'
  };

  const dot3Style = {
    ...dotStyle,
    animation: 'bounce 1s infinite',
    animationDelay: '0.4s'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-950 bg-[length:300%_300%] animate-gradient">
      <div className="max-w-4xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="backdrop-blur-md bg-white/70 dark:bg-gray-900/70 rounded-2xl shadow-xl mb-6 p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                AI
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-400 bg-clip-text text-transparent">俺っぽいAI</h1>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={toggleDarkMode}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/20 dark:bg-gray-800/20 border border-gray-300 dark:border-gray-700 shadow-sm transition-all hover:shadow-md"
              >
                <span className="text-sm">{darkMode ? "🌞" : "🌙"}</span>
                <span className="text-sm font-medium">{darkMode ? "ライト" : "ダーク"}</span>
              </button>
              <button 
                onClick={clearChat}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm bg-white/20 dark:bg-gray-800/20 border border-gray-300 dark:border-gray-700 shadow-sm transition-all hover:shadow-md"
              >
                <span className="text-sm">🔄</span>
                <span className="text-sm font-medium">リセット</span>
              </button>
            </div>
          </div>

          {/* モデル選択 */}
          <div className="mt-4 flex items-center">
            <div className="flex items-center p-1.5 rounded-lg backdrop-blur-sm bg-white/20 dark:bg-gray-800/20 border border-gray-300 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2">AIモデル</span>
              {loadingModels ? (
                <div className="flex items-center space-x-2 px-3 py-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-300 dark:bg-gray-700"></div>
                </div>
              ) : (
                <div className="relative">
                  <select 
                    value={selectedModel} 
                    onChange={handleModelChange}
                    className="appearance-none pl-3 pr-8 py-1 rounded-md text-sm bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  >
                    {modelOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <div className={`w-2 h-2 rounded-full ${getModelBadgeColor(selectedModel)}`}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm backdrop-blur-sm">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {/* チャットウィンドウ */}
        <div className="backdrop-blur-md bg-white/70 dark:bg-gray-900/70 rounded-2xl shadow-xl p-5 border border-gray-200 dark:border-gray-800 h-[500px] overflow-y-auto">
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === "user" 
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-none" 
                      : "backdrop-blur-sm bg-gray-100/80 dark:bg-gray-800/80 rounded-tl-none"
                  }`}
                >
                  <div className="text-sm">{msg.content}</div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] px-4 py-3 rounded-2xl shadow-sm backdrop-blur-sm bg-gray-100/80 dark:bg-gray-800/80 rounded-tl-none">
                  <div className="flex items-center">
                    <span className="text-sm">考え中</span>
                    <div style={spinnerStyle}>
                      <span style={dot1Style}></span>
                      <span style={dot2Style}></span>
                      <span style={dot3Style}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* 入力エリア */}
        <div className="mt-4 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 rounded-2xl shadow-lg p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex">
            <textarea
              className="flex-1 p-3 rounded-xl bg-white/40 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-inner"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={2}
              placeholder="メッセージを入力..."
              disabled={loading}
            />
            <button 
              onClick={sendMessage}
              disabled={loading}
              className={`ml-3 px-5 py-2 rounded-xl flex items-center justify-center transition-all ${
                loading 
                  ? "bg-gray-400 cursor-not-allowed text-gray-200" 
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg"
              }`}
            >
              {loading ? (
                <span>送信中...</span>
              ) : (
                <span className="flex items-center">
                  <span>送信</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- /api/chat.ts ---
