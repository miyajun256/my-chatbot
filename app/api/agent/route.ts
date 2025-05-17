// LangChainエージェントを使った最新情報検索機能

import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { google } from 'googleapis';
import { getJson } from 'serpapi';

// デバッグモードの設定
const DEBUG_MODE = false;

// デバッグログ
function debugLog(...args: any[]) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

// タイムアウト設定（60秒に延長）
const API_TIMEOUT_MS = 60000;
const TOOL_TIMEOUT_MS = 30000;

// Google Custom Searchの設定
const customsearch = google.customsearch('v1');

// Google検索を実行する関数
async function performGoogleSearch(query: string, numResults: number = 5): Promise<string> {
  try {
    // Google Custom Search APIのキーが設定されているか確認
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_CSE_ID;
    
    if (!apiKey || !searchEngineId) {
      console.warn("Google Search API keys not found, falling back to SerpAPI");
      return performSerpApiSearch(query, numResults);
    }
    
    // タイムアウト付きでGoogle Custom Search APIを実行
    const searchPromise = customsearch.cse.list({
      auth: apiKey,
      cx: searchEngineId,
      q: query,
      num: numResults
    });
    
    // タイムアウト設定
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Google Search API timeout"));
      }, TOOL_TIMEOUT_MS);
    });
    
    // どちらか早い方を採用
    const res = await Promise.race([searchPromise, timeoutPromise]);
    
    // 検索結果がなければエラーメッセージを返す
    if (!res.data.items || res.data.items.length === 0) {
      return `「${query}」の検索結果はありませんでした。`;
    }
    
    // 検索結果を整形
    let results = `「${query}」の検索結果（${new Date().toLocaleString('ja-JP')}時点）:\n\n`;
    
    res.data.items.forEach((item, index) => {
      results += `${index + 1}. ${item.title}\n`;
      results += `   URL: ${item.link}\n`;
      if (item.snippet) {
        results += `   概要: ${item.snippet}\n`;
      }
      results += '\n';
    });
    
    return results;
  } catch (error) {
    console.error("Google Search API error:", error);
    debugLog("Google Search failed, falling back to SerpAPI");
    // Google検索に失敗した場合はSerpAPIにフォールバック
    return performSerpApiSearch(query, numResults);
  }
}

// SerpAPIの結果型を定義
interface SerpApiResult {
  title: string;
  link: string;
  snippet?: string;
  [key: string]: any; // その他のプロパティも許可
}

interface SerpApiResponse {
  organic_results?: SerpApiResult[];
  [key: string]: any; // その他のプロパティも許可
}

// SerpAPIを使った検索（代替手段）
async function performSerpApiSearch(query: string, numResults: number = 5): Promise<string> {
  try {
    // SerpAPIのキーが設定されているか確認
    const apiKey = process.env.SERPAPI_KEY;
    
    if (!apiKey) {
      return simulateSearch(query);
    }
    
    // タイムアウト付きでSerpAPIを実行
    const searchPromise = getJson({
      engine: "google",
      q: query,
      api_key: apiKey,
      num: numResults,
      hl: "ja"
    });
    
    // タイムアウト設定
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("SerpAPI timeout"));
      }, TOOL_TIMEOUT_MS);
    });
    
    // どちらか早い方を採用
    const response = await Promise.race([searchPromise, timeoutPromise]) as SerpApiResponse;
    
    // 検索結果がなければエラーメッセージを返す
    if (!response.organic_results || response.organic_results.length === 0) {
      return `「${query}」の検索結果はありませんでした。`;
    }
    
    // 検索結果を整形
    let results = `「${query}」の検索結果（${new Date().toLocaleString('ja-JP')}時点）:\n\n`;
    
    response.organic_results.slice(0, numResults).forEach((item: SerpApiResult, index: number) => {
      results += `${index + 1}. ${item.title}\n`;
      results += `   URL: ${item.link}\n`;
      if (item.snippet) {
        results += `   概要: ${item.snippet}\n`;
      }
      results += '\n';
    });
    
    return results;
  } catch (error) {
    console.error("SerpAPI error:", error);
    debugLog("SerpAPI failed, using simulated search");
    // どちらのAPIも失敗した場合はシミュレートした検索結果を返す
    return simulateSearch(query);
  }
}

// シミュレートした検索結果（APIキーがない場合のフォールバック）
function simulateSearch(query: string): string {
  return `「${query}」の検索結果（シミュレートしたデモ結果）:
      
1. ${query}に関する最新情報 - Wikipedia
   URL: https://ja.wikipedia.org/wiki/${encodeURIComponent(query)}
   概要: ${query}に関する基本的な情報と最新の動向についての解説。

2. ${query}の最近の展開と将来予測 - 専門家の見解
   URL: https://example.com/experts-on-${encodeURIComponent(query)}
   概要: 業界の専門家たちが${query}について分析し、今後の展開を予測しています。

3. ${query}に関する統計データ - 最新レポート
   URL: https://example.com/stats-${encodeURIComponent(query)}
   概要: ${query}に関する最新の統計データと分析結果が公開されています。

4. ${query}についての新しい研究 - 学術ジャーナル
   URL: https://example.com/research-${encodeURIComponent(query)}
   概要: ${query}に関する最新の学術研究と発見について解説しています。

※注：これはシミュレートされた検索結果です。実際のAPIキーを設定することで、リアルタイムの検索結果が表示されます。`;
}

// 情報検索ツールの作成
const websearchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "最新の情報をウェブで検索するツール。現在の時事情報やニュースを調べる時に使用します。",
  schema: z.object({
    query: z.string().describe("検索クエリ"),
  }),
  func: async ({ query }) => {
    try {
      debugLog(`Web searching for: ${query}`);
      
      // 検索クエリが空の場合はデフォルトクエリを設定
      if (!query || query.trim() === "") {
        query = "最新ニュース";
        debugLog('Empty query, using default: 最新ニュース');
      }
      
      // 検索クエリの前処理
      query = query.trim();
      
      // クエリを最適化（「について」などの曖昧な表現を削除）
      query = query.replace(/について$/g, '')
                  .replace(/を教えて$/g, '')
                  .replace(/を調べて$/g, '')
                  .replace(/検索して$/g, '');
      
      // 検索クエリに制限を設ける
      if (query.length > 200) {
        query = query.substring(0, 200);
        debugLog('Query too long, truncated to 200 chars');
      }
      
      // 最新の情報であることを明示
      if (!query.includes('最新') && !query.includes('今日') && !query.includes('現在')) {
        query = `最新 ${query}`;
        debugLog('Added "最新" to query:', query);
      }
      
      // まずGoogle検索APIを試し、失敗した場合はSerpAPIを使用
      const result = await performGoogleSearch(query);
      debugLog(`Search completed, result length: ${result.length}`);
      return result;
    } catch (error) {
      console.error("Web search failed:", error);
      debugLog("Web search tool failed completely");
      return "検索中にエラーが発生しました。別の質問を試してください。";
    }
  },
});

// 日時確認ツールの作成
const currentDateTool = new DynamicStructuredTool({
  name: "get_current_date",
  description: "現在の日付と時刻を取得するツール。",
  schema: z.object({}),
  func: async () => {
    const now = new Date();
    return now.toLocaleString('ja-JP', { 
      timeZone: 'Asia/Tokyo',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
  },
});

// エージェントの設定を作成
const createAgent = async (systemPrompt: string) => {
  debugLog('Creating agent with system prompt:', systemPrompt.substring(0, 50) + '...');
  
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
      timeout: API_TIMEOUT_MS, // タイムアウト設定
    });

    // エージェントが使用するツールを設定
    const tools = [websearchTool, currentDateTool];
    debugLog('Tools initialized:', tools.map(t => t.name));

    // エージェントのプロンプトテンプレート
    const agentPrompt = ChatPromptTemplate.fromMessages([
      ["system", `${systemPrompt}

あなたには以下のツールが利用可能です:
1. web_search: 最新の情報をウェブで検索できます
2. get_current_date: 現在の日付と時刻を取得できます

重要: ユーザーが「最新情報検索をON」にしている場合、以下のような質問には必ずweb_searchツールを使ってください：
- 天気予報、ニュース、株価、スポーツ結果など現在の情報
- 「今日は何の日」「最近の〇〇の動向」など時事的な質問
- 「〇〇の最新情報」などの明示的な最新情報リクエスト
- 2021年以降の出来事に関する質問

特に、ユーザーのメッセージが「【最新情報検索ON】」で始まる場合は、
必ずweb_searchツールを使って最新情報を取得してください。
これは最新情報検索機能がONになっていることを示す明示的な指示です。

日付に関する質問にはget_current_dateツールを使ってください。

ツールを使う際は、以下の形式で必ず記述してください:
<tool>
  <tool_name>ツール名</tool_name>
  <parameters>
    <param_name>パラメータ値</param_name>
    ...
  </parameters>
</tool>

※ツールの使用が必要でない場合は、上記のフォーマットを使わず直接回答してください。

ツールの使用結果を受け取ったら、その情報を元に回答を作成してください。
検索結果から得られた情報を基に回答する際は、情報の出典を明記してください。
検索に失敗した場合は、その旨を伝えて一般的な知識に基づいて回答してください。`],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);

    // エージェントの応答を解析する関数
    const parseAgentResponse = (response: string) => {
      // ツール使用の検出
      debugLog('Raw response to parse:', response.substring(0, 100) + '...');
      
      // より寛容なパターンマッチング
      const toolPattern = /<tool>[\s\S]*?<tool_name>([\s\S]*?)<\/tool_name>[\s\S]*?<parameters>([\s\S]*?)<\/parameters>[\s\S]*?<\/tool>/;
      const match = response.match(toolPattern);

      if (match) {
        debugLog('Tool pattern matched');
        const toolName = match[1].trim();
        const paramsText = match[2];
        const paramPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
        
        const params: Record<string, string> = {};
        let paramMatch;
        while ((paramMatch = paramPattern.exec(paramsText)) !== null) {
          params[paramMatch[1]] = paramMatch[2].trim();
        }

        debugLog('Extracted tool:', toolName, 'params:', JSON.stringify(params));
        return { useTool: true, toolName, params };
      }

      // 代替パターンも試す（より単純な形式）
      const altToolPattern = /ツール：\s*([^\n]+)\s*パラメータ：\s*([^\n]+)/i;
      const altMatch = response.match(altToolPattern);
      
      if (altMatch) {
        debugLog('Alternative tool pattern matched');
        const toolName = altMatch[1].trim();
        const paramValue = altMatch[2].trim();
        
        if (toolName === "web_search") {
          return {
            useTool: true,
            toolName: "web_search",
            params: { query: paramValue }
          };
        } else if (toolName === "get_current_date") {
          return {
            useTool: true,
            toolName: "get_current_date",
            params: {}
          };
        }
      }

      debugLog('No tool pattern matched');
      return { useTool: false, response };
    };

    // ツールを実行する関数
    const executeTool = async (toolName: string, params: Record<string, string>) => {
      try {
        if (toolName === "web_search" && params && params.query) {
          return await websearchTool.invoke({ query: params.query });
        } else if (toolName === "get_current_date") {
          return await currentDateTool.invoke({});
        }
        return "指定されたツールは利用できません。";
      } catch (error) {
        console.error(`Tool execution error (${toolName}):`, error);
        debugLog(`Tool execution failed: ${toolName}`, error);
        return `ツール「${toolName}」の実行中にエラーが発生しました。別の方法で質問に答えます。`;
      }
    };

    // エージェントチェインを作成
    return async (messages: any[]) => {
      try {
        debugLog('Agent called with messages count:', messages.length);
        
        // 会話履歴の準備
        const chatMessages = messages.map(msg => {
          if (msg.role === "user") return new HumanMessage(msg.content);
          return new AIMessage(msg.content);
        });
        debugLog('Chat messages prepared');

        // 入力メッセージの確実な取得
        let userInput = "こんにちは"; // デフォルト値
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && typeof lastMessage.content === 'string') {
            userInput = lastMessage.content;
            debugLog('User input:', userInput);
          } else {
            debugLog('Warning: Last message has no content or not a string');
          }
        } else {
          debugLog('Warning: No messages provided');
        }
        
        try {
          // タイムアウト付きの最初のモデル実行
          debugLog('Sending request to model...');
          const resultPromise = agentPrompt.pipe(model).invoke({
            history: chatMessages,
            input: userInput,
          });
          
          // タイムアウト処理
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("リクエストがタイムアウトしました"));
            }, API_TIMEOUT_MS);
          });
          
          // どちらか早い方を採用
          const result = await Promise.race([resultPromise, timeoutPromise]);
          debugLog('Initial model response received');
          let finalResponse = result.content.toString();
          
          // 最新情報探索を促進
          // 入力にこれらのキーワードが含まれるが、ツール使用の検出がない場合に特別処理
          const timelyKeywords = ['今日', '最近', '最新', 'ニュース', '天気', '今', '現在', '速報', 'いつ'];
          const hasTimelyKeywords = timelyKeywords.some(keyword => userInput.includes(keyword));
          const isShortQuery = userInput.length < 50 && !userInput.includes('とは') && !userInput.includes('について');
          const hasExplicitMarker = userInput.includes('【最新情報検索ON】');
          
          // 時事的な質問か、短い質問か、明示的なマーカーがある場合は最新情報が必要
          const needsTimeliness = hasTimelyKeywords || isShortQuery || hasExplicitMarker;
          
          // ツール使用の検出を試みる
          debugLog('Parsing agent response for tool usage');
          const parsedResponse = parseAgentResponse(finalResponse);
          
          // 最新情報が必要そうなのにツールを使っていない場合は強制的にツールを使用
          if (needsTimeliness && !parsedResponse.useTool) {
            debugLog('Forcing web search for timely query:', userInput);
            try {
              // 検索を実行
              const searchResult = await websearchTool.invoke({ 
                query: userInput.replace(/[？\?。\.!！]/g, '') 
              });
              
              // フォローアップ
              const forceSearchPrompt = ChatPromptTemplate.fromMessages([
                ["system", systemPrompt],
                new MessagesPlaceholder("history"),
                ["human", userInput],
                ["system", `以下の検索結果を使って質問に答えてください:\n\n${searchResult}`],
              ]);
              
              const forceSearchResult = await forceSearchPrompt.pipe(model).invoke({
                history: chatMessages,
              });
              
              finalResponse = forceSearchResult.content.toString();
              debugLog('Forced search and follow-up completed');
            } catch (searchError) {
              debugLog('Forced search failed:', searchError);
              // 元の応答を使用
            }
          } else if (parsedResponse.useTool && parsedResponse.toolName) {
            debugLog('Tool usage detected:', parsedResponse.toolName);
            
            try {
              // パラメータのログ出力
              debugLog('Tool parameters:', JSON.stringify(parsedResponse.params));
              
              // ツール実行
              debugLog('Executing tool:', parsedResponse.toolName);
              const toolResult = await executeTool(
                parsedResponse.toolName, 
                parsedResponse.params
              );
              
              debugLog('Tool executed successfully, result length:', toolResult.length);
              
              // ツール結果を含めて再度モデルに問い合わせ
              debugLog('Sending follow-up request to model with tool results');
              const followUpPrompt = ChatPromptTemplate.fromMessages([
                ["system", systemPrompt],
                new MessagesPlaceholder("history"),
                ["human", messages[messages.length - 1].content || ""],
                ["ai", finalResponse],
                ["system", `ツール「${parsedResponse.toolName}」の実行結果: ${toolResult}`],
                ["human", "この情報を使って質問に答えてください。"],
              ]);
              
              const followUpResult = await followUpPrompt.pipe(model).invoke({
                history: chatMessages.slice(0, -1),
              });
              
              debugLog('Follow-up response received');
              finalResponse = followUpResult.content.toString();
            } catch (toolError: any) {
              console.error("Tool execution error:", toolError);
              debugLog('Tool execution failed:', toolError.message || 'Unknown error');
              
              // ツール実行エラー時は、一般的な知識でユーザー質問に答えるよう別のプロンプトを送信
              debugLog('Sending fallback request after tool error');
              try {
                const errorFollowUpPrompt = ChatPromptTemplate.fromMessages([
                  ["system", systemPrompt],
                  new MessagesPlaceholder("history"),
                  ["human", messages[messages.length - 1].content || ""],
                  ["system", `ツールの実行中にエラーが発生しました。一般的な知識を使って質問に答えてください。エラーについては言及せず、自然な返答をしてください。`],
                ]);
                
                const errorFollowUpResult = await errorFollowUpPrompt.pipe(model).invoke({
                  history: chatMessages.slice(0, -1),
                });
                
                finalResponse = errorFollowUpResult.content.toString();
                debugLog('Fallback response received');
              } catch (fallbackError) {
                debugLog('Fallback also failed:', fallbackError);
                finalResponse = `すまない。検索ツールがうまく動かなかったみたい。\n\nもう一度質問してもらえる？あるいは、別の角度から質問してみてくれないか？`;
              }
            }
          } else {
            debugLog('No tool usage detected in response');
          }
          
          // 最終的な応答からツールの使用部分を削除
          finalResponse = finalResponse.replace(/<tool>[\s\S]*?<\/tool>/g, "").trim();
          debugLog('Final response prepared, length:', finalResponse.length);
          
          // 空のレスポンスをチェック
          if (!finalResponse || finalResponse.length === 0) {
            debugLog('Empty response detected, sending fallback');
            try {
              const fallbackPrompt = ChatPromptTemplate.fromMessages([
                ["system", `あなたは簡潔な返答をするアシスタントです。ユーザーの問いかけに短く返答してください。`],
                ["human", userInput],
              ]);
              
              const fallbackResult = await fallbackPrompt.pipe(model).invoke({});
              finalResponse = fallbackResult.content.toString();
              
              if (!finalResponse || finalResponse.length === 0) {
                finalResponse = "うん。何か質問があれば言ってね。";
              }
            } catch (fallbackError) {
              debugLog('Fallback for empty response failed:', fallbackError);
              finalResponse = "うん。何か質問があれば言ってね。";
            }
          }
          
          return finalResponse;
        } catch (modelError: any) {
          console.error("Model execution error:", modelError);
          debugLog('Model execution failed:', modelError.message || 'Unknown error');
          
          // モデル実行エラー時はシンプルなフォールバック
          try {
            // シンプルなフォールバックプロンプト
            const simpleModel = new ChatOpenAI({
              modelName: "gpt-3.5-turbo", // フォールバックには高速なモデルを使用
              temperature: 0.7,
              openAIApiKey: process.env.OPENAI_API_KEY,
              timeout: 15000, // 短いタイムアウト
            });
            
            const fallbackPrompt = ChatPromptTemplate.fromMessages([
              ["system", `あなたは短い返答をするアシスタントです。ユーザーの質問に対して簡潔に答えてください。最新情報については「最新の情報は持っていない」と伝えてください。`],
              ["human", userInput],
            ]);
            
            const fallbackResult = await fallbackPrompt.pipe(simpleModel).invoke({});
            return fallbackResult.content.toString();
          } catch (fallbackError) {
            return `申し訳ない。AIモデルの実行中にエラーが発生したよ。もう一度質問してくれないか？`;
          }
        }
      } catch (error: any) {
        console.error("Agent chain error:", error);
        debugLog('Agent chain failed:', error.message || 'Unknown error');
        // エラー時のフォールバック応答
        return `すまない。応答の生成中にエラーが発生したよ。もう一度質問してみてください。`;
      }
    };
  } catch (initError: any) {
    console.error("Agent initialization error:", initError);
    debugLog('Agent initialization failed:', initError.message || 'Unknown error');
    
    // エージェント初期化エラー時はフォールバック関数を返す
    return async () => {
      return "申し訳ありません。AIエージェントの初期化に失敗しました。管理者にお問い合わせください。";
    };
  }
};

// POSTリクエストの処理
export async function POST(req: NextRequest) {
  // リクエストタイムアウト
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS - 5000); // APIのタイムアウトより少し短く
  
  try {
    debugLog('POST request received');
    const { messages } = await req.json();
    debugLog('Request parsed, messages count:', messages?.length || 0);
    
    // メッセージが無い場合のガード
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      clearTimeout(timeoutId);
      debugLog('No valid messages in request');
      return NextResponse.json({ 
        reply: "申し訳ありませんが、メッセージが無効です。もう一度お試しください。" 
      });
    }
    
    // 明示的なフラグをメッセージに追加して、モデルがエージェントモードだと認識させる
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      // 最新情報検索がONであることを示すヒントを追加
      debugLog('Adding agent mode hint to user message');
      
      const originalContent = lastUserMessage.content;
      const isTimeliness = /今日|最近|最新|ニュース|天気|今|現在|速報|いつ/.test(originalContent);
      
      // 明示的に最新情報検索が必要そうな場合、メッセージを拡張
      if (isTimeliness) {
        lastUserMessage.content = `【最新情報検索ON】${originalContent}`;
        debugLog('Modified user message:', lastUserMessage.content);
      }
    }
    
    // メッセージ数の制限
    const maxMessages = 15;
    const limitedMessages = messages.length > maxMessages 
      ? [...messages.slice(0, 1), ...messages.slice(messages.length - maxMessages + 1)]
      : messages;
      
    if (messages.length !== limitedMessages.length) {
      debugLog(`Limited message history from ${messages.length} to ${limitedMessages.length}`);
    }
    
    // システムプロンプト
    const systemPrompt = `あなたは「落ち着いた雰囲気」で「短文・断定を避けた言い回し」を使うアシスタントです。
一人称は「俺」であまり感情を出しすぎない文体を使います。
最新の情報を調べる必要がある時は、必ず最新情報検索ツールを使ってください。
質問内容に以下のいずれかが含まれていたら、web_searchツールを使ってください：
- 「今日」「最近」「最新」「現在」などの時事的表現
- ニュース、天気、株価、スポーツの結果、新製品、イベントなどの現在進行形の話題
- ここ数年以内の出来事で、あなたの知識が不確かな内容
検索結果から得られた情報は簡潔にまとめてください。`;

    // エージェントを作成
    debugLog('Creating agent');
    const agent = await createAgent(systemPrompt);
    
    // エージェントに質問して回答を取得（Promise.raceでタイムアウト処理）
    debugLog('Executing agent');
    const responsePromise = agent(limitedMessages);
    const timeoutPromise = new Promise<string>(resolve => {
      setTimeout(() => {
        debugLog('Global timeout reached');
        resolve("タイムアウトしました。もう少し簡単な質問をするか、後でもう一度試してみてください。");
      }, API_TIMEOUT_MS - 10000); // タイムアウトを短く設定
    });
    
    // どちらか早い方を採用
    const response = await Promise.race([responsePromise, timeoutPromise]);
    debugLog('Agent response received, length:', response.length);

    // 空の応答をチェック
    const finalResponse = response && response.trim().length > 0
      ? response
      : "申し訳ありません。回答を生成できませんでした。別の質問を試してみてください。";

    // タイムアウトをクリア
    clearTimeout(timeoutId);
    
    return NextResponse.json({ reply: finalResponse });
  } catch (error: any) {
    // タイムアウトをクリア
    clearTimeout(timeoutId);
    
    // アボートエラーの特別な処理
    if (error.name === 'AbortError') {
      console.error("Request aborted due to timeout");
      debugLog('Request timeout occurred');
      return NextResponse.json(
        { reply: "タイムアウトしました。もう少し簡単な質問をするか、後でもう一度試してみてください。" },
        { status: 200 } // 408ではなく200を返してUIがエラーを表示しないようにする
      );
    }
    
    console.error("Agent API error:", error);
    debugLog('API error:', error.message || 'Unknown error');
    return NextResponse.json(
      { reply: "申し訳ありませんが、質問に応答できませんでした。別の質問を試してみてください。" },
      { status: 200 } // エラーをユーザーフレンドリーなメッセージとして返す
    );
  }
} 