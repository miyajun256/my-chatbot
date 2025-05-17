// このファイルを app/api/chat/route.ts に保存（App Router構成）
/**
 * チャットボットAPIエンドポイント
 * 
 * このAPIは以下の機能を提供します：
 * - OpenAI APIまたはAnthropic API（Claude）を使用した応答生成
 * - 会話履歴の管理と制限
 * - 複数のAIモデルのサポート
 * - カスタムシステムプロンプトを使った応答スタイルの制御
 * 
 * 使用方法:
 * - POST /api/chat でメッセージを送信し応答を取得
 * - GET /api/chat でサポートされているモデル一覧を取得
 */

import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

/**
 * チャットボットのシステムプロンプト
 * AIの応答の口調や特徴を定義します
 */
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

/**
 * 利用可能なAIモデルとその表示名
 * UI上でのモデル選択に使用されます
 */
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

/**
 * モデル別に適切な設定を取得
 * モデルの種類に応じて適切なAPI設定を返します
 * @param modelId モデルID
 * @returns APIタイプと温度設定
 */
function getModelConfig(modelId: string) {
  // OpenAI以外のモデルの場合は別のAPIを使用する
  const isClaudeModel = modelId.startsWith("claude");
  
  return {
    apiType: isClaudeModel ? "anthropic" : "openai",
    temperature: modelId.includes("gpt-3.5") ? 0.85 : 0.8,
    // Claude用の設定を追加可能
  };
}

/**
 * 会話履歴を最大メッセージ数に制限する関数
 * @param messages 現在のメッセージ配列
 * @param maxMessages 最大メッセージ数（デフォルト10）
 * @returns 制限されたメッセージ配列
 */
function limitConversationHistory(messages: any[], maxMessages: number = 10) {
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  // 最新のメッセージを保持する
  return messages.slice(-maxMessages);
}

/**
 * OpenAI APIを使った応答生成（LangChain経由）
 * @param model モデルID
 * @param messages メッセージ履歴
 * @param temperature 温度設定（多様性）
 * @returns AIの応答テキスト
 */
async function generateOpenAIResponse(model: string, messages: any[], temperature: number) {
  try {
    // LangChainのChatOpenAIモデルを初期化
    const chat = new ChatOpenAI({
      modelName: model,
      temperature: temperature,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    // システムメッセージを取得
    const systemMessage = messages.find(msg => msg.role === "system")?.content || "";
    
    // ユーザーとアシスタントのメッセージのみを抽出
    const chatMessages = messages
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map(msg => {
        if (msg.role === "user") return new HumanMessage(msg.content);
        return new AIMessage(msg.content);
      });
    
    // チャットプロンプトテンプレートを作成
    const chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      new MessagesPlaceholder("history"),
    ]);
    
    // チェーンを作成
    const chain = RunnableSequence.from([
      {
        history: () => chatMessages,
      },
      chatPrompt,
      chat,
      new StringOutputParser(),
    ]);
    
    // チェーンを実行して応答を生成
    const response = await chain.invoke({});
    
    return response;
  } catch (error) {
    console.error("Error with OpenAI API:", error);
    return "申し訳ありません。AIとの通信中にエラーが発生しました。";
  }
}

/**
 * Claude APIを使った応答生成（LangChain経由）
 * @param model モデルID
 * @param messages メッセージ履歴
 * @param temperature 温度設定（多様性）
 * @returns AIの応答テキスト
 */
async function generateClaudeResponse(model: string, messages: any[], temperature: number) {
  try {
    // AnthropicのAPIキーが設定されていない場合はOpenAIにフォールバック
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not set, falling back to OpenAI");
      return generateOpenAIResponse("gpt-4o", messages, temperature) + " (Claude風の応答をシミュレート)";
    }
    
    // LangChainのChatAnthropicモデルを初期化
    const chat = new ChatAnthropic({
      modelName: model, // "claude-3-haiku" または "claude-3-5-sonnet"
      temperature: temperature,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // システムメッセージを取得
    const systemMessage = messages.find(msg => msg.role === "system")?.content || "";
    
    // ユーザーとアシスタントのメッセージのみを抽出
    const chatMessages = messages
      .filter(msg => msg.role === "user" || msg.role === "assistant")
      .map(msg => {
        if (msg.role === "user") return new HumanMessage(msg.content);
        return new AIMessage(msg.content);
      });
    
    // チャットプロンプトテンプレートを作成
    const chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessage],
      new MessagesPlaceholder("history"),
    ]);
    
    // チェーンを作成
    const chain = RunnableSequence.from([
      {
        history: () => chatMessages,
      },
      chatPrompt,
      chat,
      new StringOutputParser(),
    ]);
    
    // チェーンを実行して応答を生成
    const response = await chain.invoke({});
    
    return response;
  } catch (error) {
    console.error("Error with Claude API:", error);
    // エラー時はOpenAIにフォールバック
    return generateOpenAIResponse("gpt-4o", messages, temperature) + " (Claude APIエラーのためフォールバック)";
  }
}

/**
 * POSTエンドポイント - メッセージを送信し応答を取得
 * @param req リクエスト（messagesとmodel含む）
 * @returns AIの応答をJSON形式で返す
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, model = DEFAULT_MODEL } = await req.json();
    
    // モデルの検証
    const selectedModel = Object.keys(AVAILABLE_MODELS).includes(model) ? model : DEFAULT_MODEL;
    
    // モデル設定を取得
    const modelConfig = getModelConfig(selectedModel);
    
    // 会話履歴を制限（最大10メッセージに）
    const limitedMessages = limitConversationHistory([...messages], 10);
    const langchainReadyMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...limitedMessages
    ];
    
    // モデルタイプに応じた処理
    let reply = "";
    if (modelConfig.apiType === "anthropic") {
      reply = await generateClaudeResponse(
        selectedModel, 
        langchainReadyMessages, 
        modelConfig.temperature
      );
    } else {
      reply = await generateOpenAIResponse(
        selectedModel, 
        langchainReadyMessages, 
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

/**
 * GETエンドポイント - 利用可能なモデル一覧を取得
 * @returns 利用可能なモデルとデフォルトモデルの情報
 */
export async function GET() {
  return NextResponse.json({ 
    models: AVAILABLE_MODELS,
    defaultModel: DEFAULT_MODEL
  });
}
