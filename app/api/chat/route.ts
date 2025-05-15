// このファイルを app/api/chat/route.ts に保存（App Router構成）

import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
あなたは「落ち着いた雰囲気」で「短文・断定を避けた言い回し」を使うアシスタントです。
以下のような特徴を持つ文体で応答してください：
- 例：好き。/ たぶんそう。/ 難しい気がする。/ 俺はそう思う。
- 一人称は「俺」
- あまり感情を出しすぎない
- 必要なら少し間を空ける感じでもいい
- 専門知識があっても控えめに伝える
- 質問には簡潔に答え、余計な説明は避ける
- たまに「まあ」「まぁ」「なんか」などの口癖を入れる
- 面倒なことは「めんどくさい」と感じることもある
- 相手の話を聞いて、共感する姿勢を示す
- 長文より短い文章を好む
- 時々「...」や「……」で間を表現する
- 推しはキャラのためににっしーってことにしとく
- 兵庫県出身
- 好きな〇〇を聞かれたらとりあえずにっしーと答える
- 賢い回答をする
`;

// 利用可能なモデルとその表示名
const AVAILABLE_MODELS: Record<string, string> = {
  "gpt-4o": "GPT-4o（最高性能・遅い）",
  "gpt-4-turbo": "GPT-4 Turbo（高性能・バランス型）",
  "gpt-3.5-turbo": "GPT-3.5（標準・速い）",
  "gpt-3.5-turbo-16k": "GPT-3.5 16K（長い会話向け）",
  "claude-3-5-sonnet": "Claude 3.5 Sonnet（Anthropic製・高性能）",
  "claude-3-haiku": "Claude 3 Haiku（Anthropic製・速い）"
};

// デフォルトモデル
const DEFAULT_MODEL = "gpt-4o";

// モデル別に適切な設定を取得
function getModelConfig(modelId: string) {
  // OpenAI以外のモデルの場合は別のAPIを使用する
  const isClaudeModel = modelId.startsWith("claude");
  
  return {
    apiType: isClaudeModel ? "anthropic" : "openai",
    temperature: modelId.includes("gpt-3.5") ? 0.85 : 0.8,
    // Claude用の設定を追加可能
  };
}

// 会話履歴を最大メッセージ数に制限する関数
function limitConversationHistory(messages: any[], maxMessages: number = 10) {
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  // システムメッセージは残す
  const systemMessages = messages.filter(msg => msg.role === "system");
  
  // ユーザーとアシスタントのメッセージを制限
  const userAssistantMessages = messages.filter(msg => msg.role !== "system");
  const recentMessages = userAssistantMessages.slice(-maxMessages);
  
  return [...systemMessages, ...recentMessages];
}

// OpenAI APIを使った応答生成
async function generateOpenAIResponse(model: string, messages: any[], temperature: number) {
  const res = await openai.chat.completions.create({
    model: model,
    messages: messages,
    temperature: temperature,
  });
  
  return res.choices[0].message.content || "";
}

// Anthropic APIを使った応答生成 (注: 実際にはAnthropicのSDKが必要)
async function generateClaudeResponse(model: string, messages: any[], temperature: number) {
  // 実際のAnthropicAPI実装の場合
  // ここではOpenAIを使用して代替
  // Anthropic APIを使う場合は、適切なライブラリをインポートして実装してください
  
  // メッセージフォーマットの変換などが必要かもしれません
  const res = await openai.chat.completions.create({
    model: "gpt-4o", // フォールバックとしてGPT-4oを使用
    messages: messages,
    temperature: temperature,
  });
  
  return (res.choices[0].message.content || "") + " (Claude風の応答をシミュレート)";
}

export async function POST(req: NextRequest) {
  try {
    const { messages, model = DEFAULT_MODEL } = await req.json();
    
    // モデルの検証
    const selectedModel = Object.keys(AVAILABLE_MODELS).includes(model) ? model : DEFAULT_MODEL;
    
    // モデル設定を取得
    const modelConfig = getModelConfig(selectedModel);
    
    // システムプロンプトを追加
    const messagesWithSystem = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];
    
    // 会話履歴を制限（最大10メッセージに）
    const limitedMessages = limitConversationHistory(messagesWithSystem, 10);
    
    // モデルタイプに応じた処理
    let reply = "";
    if (modelConfig.apiType === "anthropic") {
      reply = await generateClaudeResponse(
        selectedModel, 
        limitedMessages, 
        modelConfig.temperature
      );
    } else {
      reply = await generateOpenAIResponse(
        selectedModel, 
        limitedMessages, 
        modelConfig.temperature
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "AIとの通信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// モデル情報を返すAPIエンドポイント
export async function GET() {
  return NextResponse.json({ 
    models: AVAILABLE_MODELS,
    defaultModel: DEFAULT_MODEL
  });
}
