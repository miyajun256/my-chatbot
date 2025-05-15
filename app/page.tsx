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
    if (!modelId) return "";
    if (modelId.includes("gpt-4")) return "bg-green-500";
    if (modelId.includes("claude")) return "bg-purple-500";
    if (modelId.includes("gpt-3.5")) return "bg-yellow-500";
    return "";
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

  return (
    <div className="container">
      {/* ヘッダー */}
      <div className="card">
        <div className="header">
          <div className="logo-container">
            <div className="logo">AI</div>
            <h1 className="title">俺っぽいAI</h1>
          </div>
          <div className="button-group">
            <button className="button" onClick={toggleDarkMode}>
              <span>{darkMode ? "🌞" : "🌙"}</span>
              <span>{darkMode ? "ライト" : "ダーク"}</span>
            </button>
            <button className="button" onClick={clearChat}>
              <span>🔄</span>
              <span>リセット</span>
            </button>
          </div>
        </div>

        {/* モデル選択 */}
        <div className="model-selector">
          <div className="model-container">
            <span className="model-label">AIモデル</span>
            {loadingModels ? (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                <div style={{ 
                  height: '16px', 
                  width: '128px', 
                  animation: 'pulse 1.5s infinite',
                  background: darkMode ? '#374151' : '#d1d5db',
                  borderRadius: '4px'
                }}></div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <select 
                  value={selectedModel} 
                  onChange={handleModelChange}
                  className="model-select"
                  disabled={loading}
                >
                  {modelOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <div style={{ 
                  position: 'absolute', 
                  right: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  pointerEvents: 'none'
                }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '9999px',
                    background: selectedModel.includes('gpt-4') 
                      ? '#10b981' 
                      : selectedModel.includes('claude') 
                        ? '#8b5cf6' 
                        : selectedModel.includes('gpt-3.5') 
                          ? '#f59e0b' 
                          : '#6b7280'
                  }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* エラーメッセージ */}
      {error && (
        <div className="error">
          <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
      
      {/* チャットウィンドウ */}
      <div className="chat-window">
        <div className="messages">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`message ${msg.role}`}
            >
              <div className="message-bubble">
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message assistant">
              <div className="message-bubble">
                <div className="loading-dots">
                  <span className="loading-text">考え中</span>
                  <div className="dots-container">
                    <span className="dot dot-1"></span>
                    <span className="dot dot-2"></span>
                    <span className="dot dot-3"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 入力エリア */}
      <div className="input-area">
        <textarea
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={2}
          placeholder="メッセージを入力..."
          disabled={loading}
        />
        <button 
          className="send-button"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? (
            <span>送信中...</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span>送信</span>
              <svg className="send-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// --- /api/chat.ts ---
