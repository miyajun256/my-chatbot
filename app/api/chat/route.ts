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
- 質問の答えが分からないときは正直に認める
`;

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

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    // システムプロンプトを追加
    const messagesWithSystem = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];
    
    // 会話履歴を制限（最大10メッセージに）
    const limitedMessages = limitConversationHistory(messagesWithSystem, 10);
    
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: limitedMessages,
      temperature: 0.8,
    });

    const reply = res.choices[0].message.content;
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "AIとの通信中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
