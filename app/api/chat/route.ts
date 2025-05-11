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
`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const res = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    temperature: 0.7,
  });

  const reply = res.choices[0].message.content;
  return NextResponse.json({ reply });
}
