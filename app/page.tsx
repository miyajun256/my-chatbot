// Next.js (App Router) + OpenAI API を使ったシンプルチャットボット
// .env に OPENAI_API_KEY を設定して使う

"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";

/**
 * チャットメッセージの型定義
 * role: 'user'（ユーザーメッセージ）または'assistant'（AIの応答）
 * content: メッセージ内容のテキスト
 */
interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * 言語モデルの選択肢の型定義
 * id: モデルのID（APIで使用する識別子）
 * name: UI上で表示されるモデル名
 */
interface ModelOption {
  id: string;
  name: string;
}

/**
 * マルバツゲームの状態を表す型
 * board: ゲーム盤面（9マス）
 * isPlayerTurn: プレイヤーのターンかどうか
 * gameOver: ゲームが終了したかどうか
 * winner: 勝者（'○'、'×'、またはnull）
 * playerMarks: プレイヤーが使用したマークの数
 * aiMarks: AIが使用したマークの数
 */
interface TicTacToeState {
  board: Array<string | null>;
  isPlayerTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  playerMarks: number;
  aiMarks: number;
}

/**
 * オセロゲームの状態を表す型
 * board: 6x6のゲーム盤面
 * currentPlayer: 現在のプレイヤー（'black'または'white'）
 * gameOver: ゲームが終了したかどうか
 * blackCount: 黒石の数
 * whiteCount: 白石の数
 * skipTurn: ターンをスキップするかどうか
 */
interface OthelloState {
  board: string[][];
  currentPlayer: 'black' | 'white';
  gameOver: boolean;
  blackCount: number;
  whiteCount: number;
  skipTurn: boolean;
}

/**
 * メインのチャットボットコンポーネント
 * 機能:
 * - OpenAI APIを使ったチャット対話
 * - 複数の言語モデルの切り替え
 * - 最新情報検索機能（エージェントモード）
 * - ローカルストレージを使った会話履歴の保存
 * - マルバツゲームとオセロゲーム（「マルバツ」「オセロ」と入力するとプレイ可能）
 */
export default function MyChatbot() {
  // チャット関連の状態管理
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "よう。何か聞きたいことある？" }]);
  const [input, setInput] = useState(""); // ユーザー入力テキスト
  const [loading, setLoading] = useState(false); // API通信中のローディング状態
  const [loadingModels, setLoadingModels] = useState(true); // モデル一覧読み込み中の状態
  const [error, setError] = useState<string | null>(null); // エラーメッセージ
  
  // モデル関連の状態管理
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]); // 利用可能なモデル一覧
  const [selectedModel, setSelectedModel] = useState<string>(""); // 選択中のモデル
  const [agentMode, setAgentMode] = useState<boolean>(false); // 最新情報検索モード（ON/OFF）
  
  // DOM参照
  const messagesEndRef = useRef<HTMLDivElement>(null); // 自動スクロール用の参照
  
  // マルバツゲームの状態
  const [showGame, setShowGame] = useState(false);
  const [tictactoe, setTictactoe] = useState<TicTacToeState>({
    board: Array(9).fill(null),
    isPlayerTurn: true,
    gameOver: false,
    winner: null,
    playerMarks: 0,
    aiMarks: 0
  });
  
  // オセロゲームの状態
  const [showOthello, setShowOthello] = useState(false);
  const [othello, setOthello] = useState<OthelloState>({
    board: Array(6).fill(null).map(() => Array(6).fill('')),
    currentPlayer: 'black',
    gameOver: false,
    blackCount: 0,
    whiteCount: 0,
    skipTurn: false
  });
  


  /**
   * モデル一覧をAPIから取得
   * アプリ起動時に一度だけ実行される
   */
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
    // この機能を削除
  }, []);

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

  /**
   * 新しいメッセージが追加されたら自動スクロール
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * モデルIDに基づいてバッジの色を取得
   * UI表示用の補助関数
   */
  const getModelBadgeColor = (modelId: string) => {
    if (!modelId) return "";
    if (modelId.includes("gpt-4")) return "bg-green-500";
    if (modelId.includes("claude")) return "bg-purple-500";
    if (modelId.includes("gpt-3.5")) return "bg-yellow-500";
    return "";
  };

  // AIのターン用のuseEffect（マルバツゲーム）
  useEffect(() => {
    // ゲームが表示されていて、AIのターンで、ゲームが終了していない場合
    if (showGame && !tictactoe.isPlayerTurn && !tictactoe.gameOver) {
      // AIの手を少し遅延させて実行
      const timer = setTimeout(() => aiMove(tictactoe.board), 700);
      return () => clearTimeout(timer);
    }
  }, [showGame, tictactoe.isPlayerTurn, tictactoe.gameOver, tictactoe.board]);

  // AIのターン用のuseEffect（オセロ）
  useEffect(() => {
    // ゲームが表示されていて、AIのターン（白）で、ゲームが終了していない場合
    if (showOthello && othello.currentPlayer === 'white' && !othello.gameOver) {
      // AIの手を少し遅延させて実行
      const timer = setTimeout(() => makeAIMove(othello.board), 800);
      return () => clearTimeout(timer);
    }
  }, [showOthello, othello.currentPlayer, othello.gameOver, othello.board]);

  /**
   * マルバツゲームの表示切り替え
   * ゲームが表示されていなければ初期化して表示、表示中なら非表示にする
   */
  const toggleGame = () => {
    if (!showGame) {
      setShowGame(true);
      setShowOthello(false);
      resetGame();
    } else {
      setShowGame(false);
    }
  };
  
  /**
   * マルバツゲームの初期化
   * ランダムに最初のAIの手を決定する
   */
  const resetGame = () => {
    // ゲームの状態を初期化
    const newBoard = Array(9).fill(null);
    
    // 先行がAIの場合は、最初の手を決める（中央か角）
    const firstMoves = [0, 2, 4, 6, 8];
    const firstMove = firstMoves[Math.floor(Math.random() * firstMoves.length)];
    newBoard[firstMove] = '×';
    
    setTictactoe({
      board: newBoard,
      isPlayerTurn: true, // プレイヤーのターンに設定
      gameOver: false,
      winner: null,
      playerMarks: 0,
      aiMarks: 1 // AIはすでに1つマークを置いた
    });
  };

  /**
   * オセロゲームの表示切り替え
   * ゲームが表示されていなければ初期化して表示、表示中なら非表示にする
   */
  const toggleOthello = () => {
    if (!showOthello) {
      setShowOthello(true);
      setShowGame(false);
      initOthelloBoard();
    } else {
      setShowOthello(false);
    }
  };



  /**
   * オセロゲームの初期化
   * 中央に初期配置の石を設定する
   */
  const initOthelloBoard = () => {
    // 6x6の盤面を作成
    const newBoard = Array(6).fill(null).map(() => Array(6).fill(''));
    
    // 初期配置 (中央に4つの石を配置)
    const mid = Math.floor(6 / 2) - 1;
    newBoard[mid][mid] = 'white';
    newBoard[mid][mid + 1] = 'black';
    newBoard[mid + 1][mid] = 'black';
    newBoard[mid + 1][mid + 1] = 'white';
    
    // 黒と白の石の数をカウント
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (newBoard[r][c] === 'black') blackCount++;
        else if (newBoard[r][c] === 'white') whiteCount++;
      }
    }
    
    // 初期状態をセット
    setOthello({
      board: newBoard,
      currentPlayer: 'black',
      gameOver: false,
      blackCount,
      whiteCount,
      skipTurn: false
    });
  };
  
  /**
   * オセロの合法手を検索
   * 指定したプレイヤーが石を置ける位置の座標リストを返す
   * @param board 現在の盤面
   * @param player プレイヤー（'black'または'white'）
   * @returns 合法手の座標リスト [row, col][]
   */
  const findLegalMoves = (board: string[][], player: 'black' | 'white'): [number, number][] => {
    const opponent = player === 'black' ? 'white' : 'black';
    const legalMoves: [number, number][] = [];
    
    // すべてのマスをチェック
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        // 空のマスのみ調査
        if (board[row][col] !== '') continue;
        
        // 8方向チェック
        const directions = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        
        // いずれかの方向で石が裏返せるかチェック
        for (const [dx, dy] of directions) {
          let r = row + dx;
          let c = col + dy;
          let foundOpponent = false;
          
          // 盤面の範囲内で相手の石が続くかチェック
          while (r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === opponent) {
            r += dx;
            c += dy;
            foundOpponent = true;
          }
          
          // 相手の石の先に自分の石があるかチェック
          if (foundOpponent && r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === player) {
            legalMoves.push([row, col]);
            break; // この位置は合法手なのでループを抜ける
          }
        }
      }
    }
    
    return legalMoves;
  };
  
  /**
   * 石を置いたときに裏返される石を計算
   * @param board 現在の盤面
   * @param row 石を置く行
   * @param col 石を置く列
   * @param player 現在のプレイヤー（'black'または'white'）
   * @returns 裏返される石の座標リスト [row, col][]
   */
  const getFlippedDiscs = (board: string[][], row: number, col: number, player: 'black' | 'white'): [number, number][] => {
    const opponent = player === 'black' ? 'white' : 'black';
    const flipped: [number, number][] = [];
    
    // 8方向チェック
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dx, dy] of directions) {
      const tempFlipped: [number, number][] = [];
      let r = row + dx;
      let c = col + dy;
      
      // 盤面の範囲内で相手の石が続くかチェック
      while (r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === opponent) {
        tempFlipped.push([r, c]);
        r += dx;
        c += dy;
      }
      
      // 相手の石の先に自分の石があるかチェック
      if (tempFlipped.length > 0 && r >= 0 && r < 6 && c >= 0 && c < 6 && board[r][c] === player) {
        flipped.push(...tempFlipped);
      }
    }
    
    return flipped;
  };
  
  /**
   * オセロの石を置く処理
   * プレイヤー（黒）の手を処理し、石を裏返して次のターンに進む
   * @param row 石を置く行
   * @param col 石を置く列
   */
  const placeDisc = (row: number, col: number) => {
    // ゲーム終了時またはすでに石がある場合は何もしない
    if (othello.gameOver || othello.board[row][col] !== '') return;
    
    // この位置が合法手かチェック
    const legalMoves = findLegalMoves(othello.board, 'black');
    const isLegalMove = legalMoves.some(([r, c]) => r === row && c === col);
    
    if (!isLegalMove) return;
    
    // 石を置く
    const board = [...othello.board.map(row => [...row])];
    board[row][col] = 'black';
    
    // 裏返す石を計算して適用
    const flippedDiscs = getFlippedDiscs(board, row, col, 'black');
    for (const [r, c] of flippedDiscs) {
      board[r][c] = 'black';
    }
    
    // 黒と白の石の数を数える
    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board[r][c] === 'black') blackCount++;
        else if (board[r][c] === 'white') whiteCount++;
      }
    }
    
    // 次のプレイヤーの合法手をチェック
    const nextLegalMoves = findLegalMoves(board, 'white');
    const canNextPlayerMove = nextLegalMoves.length > 0;
    
    // 次のプレイヤーが打てない場合、現在のプレイヤーが再度打てるかチェック
    if (!canNextPlayerMove) {
      const currentPlayerCanMove = findLegalMoves(board, 'black').length > 0;
      
      // どちらも打てない場合はゲーム終了
      if (!currentPlayerCanMove) {
        setOthello({
          board,
          currentPlayer: 'white',
          gameOver: true,
          blackCount,
          whiteCount,
          skipTurn: false
        });
        return;
      }
      
      // 次のプレイヤーがスキップ
      setOthello({
        board,
        currentPlayer: 'black', // 同じプレイヤーのターン
        gameOver: false,
        blackCount,
        whiteCount,
        skipTurn: true
      });
      
      return;
    }
    
    // AIのターンに変更
    setOthello({
      board,
      currentPlayer: 'white',
      gameOver: false,
      blackCount,
      whiteCount,
      skipTurn: false
    });
    
    // useEffectがAIの手を自動的に実行するので、ここでのmakeAIMove呼び出しは不要
  };
  
  /**
   * AIの手を計算（オセロ）
   * AI（白）の最適な手を評価関数とミニマックス探索で決定する
   * @param currentBoard 現在の盤面
   */
  const makeAIMove = (currentBoard: string[][]) => {
    // ゲームがすでに終了している場合は何もしない
    if (othello.gameOver) return;
    
    // 合法手を見つける
    const legalMoves = findLegalMoves(currentBoard, 'white');
    
    if (legalMoves.length === 0) {
      // AIが打てない場合、プレイヤーが打てるかチェック
      const playerCanMove = findLegalMoves(currentBoard, 'black').length > 0;
      
      if (!playerCanMove) {
        // どちらも打てない場合はゲーム終了
        setOthello(prevState => ({
          ...prevState,
          gameOver: true
        }));
      } else {
        // AIがスキップしてプレイヤーのターンに戻る
        setOthello(prevState => ({
          ...prevState,
          currentPlayer: 'black',
          skipTurn: true
        }));
      }
      return;
    }
    
    // 強化した評価関数で最善手を決定
    let bestScore = -Infinity;
    let bestMove: [number, number] = [-1, -1];
    
    /**
     * ボード評価関数（静的評価）
     * 石の配置に基づいて盤面の優劣を数値化する
     * @param board 評価する盤面
     * @param player 評価するプレイヤー
     * @returns スコア（高いほど良い盤面）
     */
    const evaluateBoard = (board: string[][], player: 'black' | 'white'): number => {
      // 盤面の位置価値マトリックス（値が高いほど良い位置）
      const positionValue = [
        [120, -20, 20, 20, -20, 120],
        [-20, -40, -5, -5, -40, -20],
        [20,  -5,  15, 15, -5,  20],
        [20,  -5,  15, 15, -5,  20],
        [-20, -40, -5, -5, -40, -20],
        [120, -20, 20, 20, -20, 120]
      ];
      
      let score = 0;
      const opponent = player === 'white' ? 'black' : 'white';
      
      // 1. 石の数差
      let countDiff = 0;
      
      // 2. 終盤に近いかどうかを判断するための全石数
      let totalStones = 0;
      
      // 3. 手番数（空きマス数で推定）
      let emptyCells = 0;
      
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (board[r][c] === player) {
            countDiff++;
            totalStones++;
            // 位置の評価を追加
            score += positionValue[r][c];
          } else if (board[r][c] === opponent) {
            countDiff--;
            totalStones++;
            // 相手の位置評価を減算
            score -= positionValue[r][c];
          } else {
            emptyCells++;
          }
        }
      }
      
      // ゲームフェーズの判定（序盤、中盤、終盤）
      const endgameThreshold = 30; // 6x6なので36マス中30が埋まったら終盤と判断
      const isEndgame = totalStones >= endgameThreshold;
      
      // 終盤では石数差を重視
      if (isEndgame) {
        score += countDiff * 10;
      } else {
        // 序盤・中盤では機動力（合法手の数）を重視
        const myMoves = findLegalMoves(board, player).length;
        const opponentMoves = findLegalMoves(board, opponent).length;
        score += (myMoves - opponentMoves) * 5;
        
        // 石数差はあまり重視しない
        score += countDiff * 2;
      }
      
      return score;
    };
    
    // 隅を優先して取る戦略
    const cornerMoves = legalMoves.filter(([r, c]) => 
      (r === 0 && c === 0) || (r === 0 && c === 5) || 
      (r === 5 && c === 0) || (r === 5 && c === 5)
    );
    
    if (cornerMoves.length > 0) {
      // 隅があるなら隅を選択
      // それぞれの隅を評価
      for (const [row, col] of cornerMoves) {
        const testBoard = [...currentBoard.map(r => [...r])];
        testBoard[row][col] = 'white';
        
        // 裏返す石を計算して適用
        const flippedDiscs = getFlippedDiscs(testBoard, row, col, 'white');
        for (const [r, c] of flippedDiscs) {
          testBoard[r][c] = 'white';
        }
        
        // 盤面を評価
        const score = evaluateBoard(testBoard, 'white');
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = [row, col];
        }
      }
    } else {
      // ミニマックス的な先読み（深さ2の探索）
      for (const [row, col] of legalMoves) {
        // AIが石を置いてみる
        const testBoard = [...currentBoard.map(r => [...r])];
        testBoard[row][col] = 'white';
        
        // 裏返す石を計算して適用
        const flippedDiscs = getFlippedDiscs(testBoard, row, col, 'white');
        for (const [r, c] of flippedDiscs) {
          testBoard[r][c] = 'white';
        }
        
        // プレイヤーの合法手を見つける
        const playerMoves = findLegalMoves(testBoard, 'black');
        
        if (playerMoves.length === 0) {
          // プレイヤーがパスなら高評価
          const score = evaluateBoard(testBoard, 'white') + 30;
          if (score > bestScore) {
            bestScore = score;
            bestMove = [row, col];
          }
          continue;
        }
        
        // プレイヤーの最善手を探す
        let playerBestScore = Infinity;
        
        for (const [pRow, pCol] of playerMoves) {
          const playerBoard = [...testBoard.map(r => [...r])];
          playerBoard[pRow][pCol] = 'black';
          
          // 裏返す石を計算して適用
          const playerFlipped = getFlippedDiscs(playerBoard, pRow, pCol, 'black');
          for (const [r, c] of playerFlipped) {
            playerBoard[r][c] = 'black';
          }
          
          // プレイヤー視点での評価（低いほど良い）
          const playerScore = evaluateBoard(playerBoard, 'white');
          playerBestScore = Math.min(playerBestScore, playerScore);
        }
        
        // 最終評価（相手の最善手を考慮）
        if (playerBestScore > bestScore) {
          bestScore = playerBestScore;
          bestMove = [row, col];
        }
      }
      
      // どの手も良くない場合は、単純な評価関数で決める
      if (bestMove[0] === -1) {
        for (const [row, col] of legalMoves) {
          const testBoard = [...currentBoard.map(r => [...r])];
          testBoard[row][col] = 'white';
          
          // 裏返す石を計算して適用
          const flippedDiscs = getFlippedDiscs(testBoard, row, col, 'white');
          for (const [r, c] of flippedDiscs) {
            testBoard[r][c] = 'white';
          }
          
          const score = evaluateBoard(testBoard, 'white');
          
          if (score > bestScore) {
            bestScore = score;
            bestMove = [row, col];
          }
        }
      }
      
      // それでも見つからない場合はランダム
      if (bestMove[0] === -1) {
        bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }
    }
    
    // bestMoveが決まったら、その位置に石を置く
    if (bestMove[0] !== -1 && bestMove[1] !== -1) {
      const [row, col] = bestMove;
      const board = [...currentBoard.map(r => [...r])];
      
      // 石を置く
      board[row][col] = 'white';
      
      // 裏返す石を計算して適用
      const flippedDiscs = getFlippedDiscs(board, row, col, 'white');
      for (const [r, c] of flippedDiscs) {
        board[r][c] = 'white';
      }
      
      // 黒と白の石の数を数える
      let blackCount = 0;
      let whiteCount = 0;
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (board[r][c] === 'black') blackCount++;
          else if (board[r][c] === 'white') whiteCount++;
        }
      }
      
      // 次のプレイヤーの合法手をチェック
      const nextLegalMoves = findLegalMoves(board, 'black');
      const canNextPlayerMove = nextLegalMoves.length > 0;
      
      // 次のプレイヤーが打てない場合、AIが再度打てるかチェック
      if (!canNextPlayerMove) {
        const aiCanMove = findLegalMoves(board, 'white').length > 0;
        
        // どちらも打てない場合はゲーム終了
        if (!aiCanMove) {
          setOthello({
            board,
            currentPlayer: 'black',
            gameOver: true,
            blackCount,
            whiteCount,
            skipTurn: false
          });
          return;
        }
        
        // 次のプレイヤーがスキップ
        setOthello({
          board,
          currentPlayer: 'white', // AIの番が続く
          gameOver: false,
          blackCount,
          whiteCount,
          skipTurn: true
        });
        
        return;
      }
      
      // プレイヤーのターンに戻す
      setOthello({
        board,
        currentPlayer: 'black',
        gameOver: false,
        blackCount,
        whiteCount,
        skipTurn: false
      });
    }
  };

  // 勝者を判定
  const checkWinner = (board: Array<string | null>): string | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    
    return null;
  };

  // オセロのボードセルをレンダリング
  const renderOthelloCell = (row: number, col: number) => {
    const cell = othello.board[row][col];
    const isLegalMove = 
      !othello.gameOver && 
      othello.currentPlayer === 'black' && 
      cell === '' && 
      findLegalMoves(othello.board, 'black').some(([r, c]) => r === row && c === col);
    
    return (
      <div 
        key={`${row}-${col}`} 
        className={`othello-cell ${isLegalMove ? 'legal-move' : ''}`}
        onClick={() => isLegalMove ? placeDisc(row, col) : null}
      >
        {cell !== '' && (
          <div className={`othello-disc ${cell}`}></div>
        )}
        {isLegalMove && <div className="legal-move-indicator"></div>}
      </div>
    );
  };

  // useEffect for Othello initialization
  useEffect(() => {
    if (showOthello) {
      initOthelloBoard();
    }
  }, [showOthello]);

  /**
   * メッセージ送信処理
   * ユーザー入力をAPIに送信し、AIの応答を取得して表示する
   */
  const sendMessage = async () => {
    if (input.trim() === "") return;
    if (loading) return;
    
    // 特定のキーワードを検出したらゲームを起動
    const lowerInput = input.toLowerCase();
    if (lowerInput === "マルバツ" || lowerInput === "まるばつ" || lowerInput === "〇×") {
      toggleGame();
      setInput("");
      return;
    }
    
    if (lowerInput === "オセロ" || lowerInput === "おせろ" || lowerInput === "リバーシ") {
      toggleOthello();
      setInput("");
      return;
    }
    
    // ユーザーメッセージを追加
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setError(null);
    
    // 選択中のモデルが無ければデフォルトを使用
    const model = selectedModel || localStorage.getItem("selectedModel") || "gpt-3.5-turbo";
    
    setLoading(true);
    try {
      // エージェントモードかどうかでAPIエンドポイントを切り替え
      const apiEndpoint = agentMode ? "/api/agent" : "/api/chat";
      
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.concat(userMessage),
          model,
        }),
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      // アシスタントの返答を追加
      const assistantMessage: Message = { role: "assistant", content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      console.error("Error sending message:", err);
      setError("メッセージの送信中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 会話履歴をクリアする
   * 初期メッセージのみ残して他を削除
   */
  const clearChat = () => {
    const initialMessage: Message[] = [{ 
      role: "assistant", 
      content: "よう。また話そうぜ。何か聞きたいことある？"
    }];
    setMessages(initialMessage);
    localStorage.setItem("chatHistory", JSON.stringify(initialMessage));
    setError(null);
  };

  /**
   * Enterキーで送信
   * Shift+Enterでは改行
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ダークモード切り替え
  const toggleDarkMode = () => {
    // この機能を削除
  };

  // モデル選択の変更
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  // マルバツゲームの関数
  // AIの手を計算（マルバツゲーム）
  const aiMove = (board: Array<string | null>) => {
    // 新しいボードを作成（元のボードを変更しないため）
    const newBoard = [...board];
    
    // AIがバツを3つ以上使っている場合
    if (tictactoe.aiMarks >= 3) {
      // 既存のバツを動かす必要がある
      // 勝てる手があるか確認
      for (let i = 0; i < 9; i++) {
        if (!newBoard[i]) {
          // 既存のバツを動かして試す
          for (let j = 0; j < 9; j++) {
            if (newBoard[j] === '×') {
              // 一時的にマークを移動
              const testBoard = [...newBoard];
              testBoard[j] = null;
              testBoard[i] = '×';
              
              // この手で勝てるか確認
              if (checkWinner(testBoard) === '×') {
                newBoard[j] = null;
                newBoard[i] = '×';
                
                setTictactoe(prevState => ({
                  ...prevState,
                  board: newBoard,
                  isPlayerTurn: true,
                  gameOver: true,
                  winner: '×'
                }));
                return;
              }
            }
          }
        }
      }
      
      // 勝てる手がなければ、防御または良い位置に移動
      // プレイヤーが次に勝てる手を防ぐ
      for (let i = 0; i < 9; i++) {
        if (!newBoard[i]) {
          // このマスにプレイヤーが置いた場合
          const testBoard = [...newBoard];
          testBoard[i] = '○';
          
          if (checkWinner(testBoard) === '○') {
            // プレイヤーがここに置くと勝つので防ぐ
            // 既存のバツを移動
            const firstMarkIndex = newBoard.findIndex(cell => cell === '×');
            if (firstMarkIndex !== -1) {
              newBoard[firstMarkIndex] = null;
              newBoard[i] = '×';
              
              setTictactoe(prevState => ({
                ...prevState,
                board: newBoard,
                isPlayerTurn: true,
                aiMarks: prevState.aiMarks
              }));
              return;
            }
          }
        }
      }
      
      // どちらも当てはまらない場合は、最初のバツを良い位置に移動
      const firstMarkIndex = newBoard.findIndex(cell => cell === '×');
      // 空いているマスを探す（中央を優先）
      const emptyIndexes = [];
      for (let i = 0; i < 9; i++) {
        if (!newBoard[i]) {
          emptyIndexes.push(i);
        }
      }
      
      // 中央が空いていれば優先
      if (emptyIndexes.includes(4)) {
        newBoard[firstMarkIndex] = null;
        newBoard[4] = '×';
      } else {
        // ランダムに選択
        const randomIndex = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
        newBoard[firstMarkIndex] = null;
        newBoard[randomIndex] = '×';
      }
    } else {
      // AIがバツを3つ未満の場合、新しい位置に置く
      const bestMove = findBestMove(newBoard, tictactoe.aiMarks);
      
      if (bestMove !== -1) {
        newBoard[bestMove] = '×';
      }
    }
    
    // 勝敗判定
    const winner = checkWinner(newBoard);
    if (winner) {
      setTictactoe(prevState => ({
        ...prevState,
        board: newBoard,
        isPlayerTurn: true,
        gameOver: true,
        winner: winner,
        aiMarks: prevState.aiMarks < 3 ? prevState.aiMarks + 1 : prevState.aiMarks
      }));
      return;
    }
    
    // プレイヤーのターンに戻す
    setTictactoe(prevState => ({
      ...prevState,
      board: newBoard,
      isPlayerTurn: true,
      aiMarks: prevState.aiMarks < 3 ? prevState.aiMarks + 1 : prevState.aiMarks
    }));
  };

  // マルバツゲームのセルをクリックしたときの処理
  const handleCellClick = (index: number) => {
    // すでにマークがあるか、ゲームが終了している場合は何もしない
    if (tictactoe.board[index] || !tictactoe.isPlayerTurn || tictactoe.gameOver) return;
    
    // プレイヤーがマルを3つ以上使っている場合は置けない
    if (tictactoe.playerMarks >= 3 && !tictactoe.board.includes('○')) return;
    
    // 新しいボードを作成
    const newBoard = [...tictactoe.board];
    
    // プレイヤーの手を置く（マルの数をカウント）
    if (tictactoe.playerMarks < 3 || newBoard.includes('○')) {
      // 3つ未満の場合、または既存のマルを動かす場合
      if (tictactoe.playerMarks >= 3) {
        // 既存のマルを動かす場合は、1つ目のマルを削除
        const firstMarkIndex = newBoard.findIndex(cell => cell === '○');
        if (firstMarkIndex !== -1) {
          newBoard[firstMarkIndex] = null;
        }
      }
      
      newBoard[index] = '○';
      
      // 勝敗判定
      const winner = checkWinner(newBoard);
      if (winner) {
        setTictactoe(prevState => ({
          ...prevState,
          board: newBoard,
          gameOver: true,
          winner: winner,
          playerMarks: prevState.playerMarks < 3 ? prevState.playerMarks + 1 : prevState.playerMarks
        }));
        return;
      }
      
      // AIのターンに変更
      setTictactoe(prevState => ({
        ...prevState,
        board: newBoard,
        isPlayerTurn: false,
        playerMarks: prevState.playerMarks < 3 ? prevState.playerMarks + 1 : prevState.playerMarks
      }));
      
      // useEffectがAIの手を自動的に実行するので、ここでのaiMove呼び出しは不要
    }
  };

  // 最適な手を見つける（マルバツゲーム）
  const findBestMove = (board: Array<string | null>, aiMarksCount: number): number => {
    // ミニマックスアルゴリズムの深さ
    const maxDepth = 5;
    
    // 盤面の評価関数
    const evaluateBoard = (board: Array<string | null>, depth: number): number => {
      // 勝敗をチェック
      const winner = checkWinner(board);
      
      if (winner === '×') return 100 - depth; // AIの勝ち (深さが浅いほど価値が高い)
      if (winner === '○') return depth - 100; // プレイヤーの勝ち (できるだけ遅らせる)
      
      // 勝敗がついていない場合は盤面の状況を評価
      let score = 0;
      
      // 中央のマス
      if (board[4] === '×') score += 3;
      if (board[4] === '○') score -= 3;
      
      // 角のマス
      const corners = [0, 2, 6, 8];
      for (const corner of corners) {
        if (board[corner] === '×') score += 2;
        if (board[corner] === '○') score -= 2;
      }
      
      // 3つのマークで勝てるラインをチェック
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // 縦
        [0, 4, 8], [2, 4, 6]             // 斜め
      ];
      
      for (const line of lines) {
        let aiCount = 0;
        let playerCount = 0;
        let emptyCount = 0;
        
        for (const pos of line) {
          if (board[pos] === '×') aiCount++;
          else if (board[pos] === '○') playerCount++;
          else emptyCount++;
        }
        
        // AI有利なライン
        if (aiCount === 2 && emptyCount === 1) score += 5;
        else if (aiCount === 1 && emptyCount === 2) score += 1;
        
        // プレイヤー有利なライン
        if (playerCount === 2 && emptyCount === 1) score -= 5; // ブロック重要
      }
      
      return score;
    };
    
    // ミニマックスアルゴリズム（アルファベータ枝刈り）
    const minimax = (board: Array<string | null>, depth: number, isMaximizing: boolean, alpha: number, beta: number, aiMarks: number, playerMarks: number): [number, number] => {
      // 終了条件
      if (depth === 0 || checkWinner(board) !== null) {
        return [evaluateBoard(board, depth), -1];
      }
      
      if (isMaximizing) { // AIのターン
        let bestScore = -Infinity;
        let bestMove = -1;
        
        // 可能な手をすべて試す
        for (let i = 0; i < 9; i++) {
          // 空きマスがある場合
          if (!board[i]) {
            if (aiMarks < 3) {
              // 新しいマークを置く
              const newBoard = [...board];
              newBoard[i] = '×';
              
              const [score, _] = minimax(newBoard, depth - 1, false, alpha, beta, aiMarks + 1, playerMarks);
              
              if (score > bestScore) {
                bestScore = score;
                bestMove = i;
              }
              
              alpha = Math.max(alpha, bestScore);
              if (beta <= alpha) break; // アルファベータ枝刈り
            }
          }
        }
        
        // 3つのマークがすでにある場合は移動も考慮
        if (aiMarks >= 3) {
          for (let i = 0; i < 9; i++) {
            if (board[i] === '×') {
              for (let j = 0; j < 9; j++) {
                if (!board[j]) {
                  // マークを移動
                  const newBoard = [...board];
                  newBoard[i] = null;
                  newBoard[j] = '×';
                  
                  const [score, _] = minimax(newBoard, depth - 1, false, alpha, beta, aiMarks, playerMarks);
                  
                  if (score > bestScore) {
                    bestScore = score;
                    bestMove = j * 10 + i; // 移動の場合、bestMoveを特殊な値にする
                  }
                  
                  alpha = Math.max(alpha, bestScore);
                  if (beta <= alpha) break;
                }
              }
            }
          }
        }
        
        return [bestScore, bestMove];
      } else { // プレイヤーのターン
        let bestScore = Infinity;
        let bestMove = -1;
        
        // 可能な手をすべて試す
        for (let i = 0; i < 9; i++) {
          if (!board[i]) {
            if (playerMarks < 3) {
              const newBoard = [...board];
              newBoard[i] = '○';
              
              const [score, _] = minimax(newBoard, depth - 1, true, alpha, beta, aiMarks, playerMarks + 1);
              
              if (score < bestScore) {
                bestScore = score;
                bestMove = i;
              }
              
              beta = Math.min(beta, bestScore);
              if (beta <= alpha) break;
            }
          }
        }
        
        // プレイヤーも3つのマークがある場合は移動を考慮
        if (playerMarks >= 3) {
          for (let i = 0; i < 9; i++) {
            if (board[i] === '○') {
              for (let j = 0; j < 9; j++) {
                if (!board[j]) {
                  const newBoard = [...board];
                  newBoard[i] = null;
                  newBoard[j] = '○';
                  
                  const [score, _] = minimax(newBoard, depth - 1, true, alpha, beta, aiMarks, playerMarks);
                  
                  if (score < bestScore) {
                    bestScore = score;
                    bestMove = j;
                  }
                  
                  beta = Math.min(beta, bestScore);
                  if (beta <= alpha) break;
                }
              }
            }
          }
        }
        
        return [bestScore, bestMove];
      }
    };
    
    // 実際のミニマックス実行（開始深さを調整）
    const useDepth = aiMarksCount < 3 ? maxDepth : 4; // より複雑な局面では計算量削減
    const [_, bestMove] = minimax(board, useDepth, true, -Infinity, Infinity, aiMarksCount, tictactoe.playerMarks);
    
    // 特殊な値の場合は移動を処理
    if (bestMove >= 10) {
      const to = Math.floor(bestMove / 10);
      const from = bestMove % 10;
      
      // 移動元の石を消す
      board[from] = null;
      return to;
    }
    
    // 勝てる手があれば優先
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        const testBoard = [...board];
        testBoard[i] = '×';
        if (checkWinner(testBoard) === '×') {
          return i;
        }
      }
    }
    
    // プレイヤーの勝ちを阻止する手があれば優先
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        const testBoard = [...board];
        testBoard[i] = '○';
        if (checkWinner(testBoard) === '○') {
          return i;
        }
      }
    }
    
    // ミニマックスが有効な手を見つけられなかった場合のフォールバック
    if (bestMove === -1) {
      // 中央が空いていれば選択
      if (!board[4]) {
        return 4;
      }
      
      // 角が空いていれば選択
      const corners = [0, 2, 6, 8];
      const emptyCorners = corners.filter(i => !board[i]);
      if (emptyCorners.length > 0) {
        return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
      }
      
      // それ以外の場合は空いているマスをランダムに選択
      const emptyIndexes = [];
      for (let i = 0; i < 9; i++) {
        if (!board[i]) {
          emptyIndexes.push(i);
        }
      }
      
      if (emptyIndexes.length > 0) {
        return emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
      }
    }
    
    return bestMove;
  };



  return (
    <>
      <style jsx global>{`
        /* ベースとなるリセットスタイル */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          height: 100% !important;
          width: 100%;
          overflow-x: hidden;
        }

        body {
          background: linear-gradient(135deg, #f9fafb, #f3f4f6, #e5e7eb);
          background-size: 300% 300%;
          background-attachment: fixed;
          animation: gradient 15s ease infinite;
          color: #171717;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.5;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        #__next, main {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .dark body {
          background: linear-gradient(135deg, #111827, #1f2937, #374151);
          color: #f1f5f9;
        }

        /* レイアウト */
        .container {
          max-width: 64rem;
          margin: 0 auto;
          padding: 1.5rem;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        /* カード要素 */
        .card {
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(8px);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .dark .card {
          background-color: rgba(17, 24, 39, 0.7);
          border-color: #1f2937;
        }

        /* チャットウィンドウ */
        .chat-window {
          backdrop-filter: blur(8px);
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          padding: 1.25rem;
          height: 65vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 400px;
        }

        .dark .chat-window {
          background-color: rgba(17, 24, 39, 0.7);
          border-color: #1f2937;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          flex: 1;
          overflow-y: auto;
        }

        .message {
          display: flex;
          animation: fadeIn 0.3s ease-out;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.assistant {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 75%;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .message.user .message-bubble {
          background: linear-gradient(to right, #3b82f6, #2563eb);
          color: white;
          border-top-right-radius: 0;
        }

        .message.assistant .message-bubble {
          background-color: rgba(243, 244, 246, 0.8);
          color: #171717;
          border-top-left-radius: 0;
        }

        .dark .message.assistant .message-bubble {
          background-color: rgba(31, 41, 55, 0.8);
          color: #f1f5f9;
        }

        .message-text {
          font-size: 0.875rem;
        }

        /* 入力エリア */
        .input-area {
          margin-top: 1rem;
          backdrop-filter: blur(8px);
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          padding: 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .dark .input-area {
          background-color: rgba(17, 24, 39, 0.7);
          border-color: #1f2937;
        }

        .message-input {
          flex: 1;
          min-width: 200px;
          padding: 0.75rem;
          border-radius: 0.75rem;
          background-color: rgba(255, 255, 255, 0.4);
          border: 1px solid #e5e7eb;
          resize: none;
          font-family: inherit;
          font-size: 0.875rem;
          color: #171717;
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
        }

        .dark .message-input {
          background-color: rgba(31, 41, 55, 0.4);
          border-color: #292524;
          color: #f1f5f9;
        }

        .message-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px #2563eb;
        }

        .dark .message-input:focus {
          box-shadow: 0 0 0 2px #3b82f6;
        }

        .send-button {
          margin-left: 0.75rem;
          padding: 0.5rem 1.25rem;
          border-radius: 0.75rem;
          background: linear-gradient(to right, #3b82f6, #4f46e5);
          color: white;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .send-button:hover {
          background: linear-gradient(to right, #2563eb, #4338ca);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .send-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .send-icon {
          margin-left: 0.25rem;
          width: 1rem;
          height: 1rem;
        }
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ローディングアニメーション */
        .loading-dots {
          display: flex;
          align-items: center;
        }

        .loading-text {
          font-size: 0.875rem;
        }

        .dots-container {
          display: flex;
          align-items: center;
          margin-left: 0.5rem;
          gap: 0.25rem;
        }

        .dot {
          width: 0.25rem;
          height: 0.25rem;
          border-radius: 50%;
          background-color: currentColor;
          display: inline-block;
        }

        .dot-1 {
          animation: bounce 1s infinite;
        }

        .dot-2 {
          animation: bounce 1s infinite 0.2s;
        }

        .dot-3 {
          animation: bounce 1s infinite 0.4s;
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        /* スクロールバーのスタイル */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        .dark ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .dark ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }

        /* マルバツゲーム用のスタイル */
        .game-container {
          backdrop-filter: blur(8px);
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          width: 100%;
          max-width: 400px;
          margin: 0 auto 1.5rem auto;
        }

        .dark .game-container {
          background-color: rgba(17, 24, 39, 0.7);
          border-color: #1f2937;
        }

        .game-status {
          text-align: center;
          width: 100%;
        }

        .game-result {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          background: linear-gradient(to right, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient 3s ease infinite;
          background-size: 200% auto;
        }

        .turn-indicator {
          font-size: 1.125rem;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #171717;
        }

        .dark .turn-indicator {
          color: #f1f5f9;
        }

        .mark-counts {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-top: 0.5rem;
        }

        .mark-count {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .dark .mark-count {
          color: #a1a1aa;
        }

        .game-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-gap: 0.5rem;
          width: 300px;
          height: 300px;
        }

        .game-cell {
          background-color: rgba(255, 255, 255, 0.1);
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          cursor: pointer;
          transition: all 0.2s;
          color: #171717;
          aspect-ratio: 1;
        }

        .dark .game-cell {
          background-color: rgba(31, 41, 55, 0.4);
          border-color: #292524;
          color: #f1f5f9;
        }

        .game-cell:hover:not(.marked) {
          background-color: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .game-cell.marked {
          cursor: default;
        }

        .game-button {
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          background: linear-gradient(to right, #3b82f6, #4f46e5);
          color: white;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .game-button:hover {
          background: linear-gradient(to right, #2563eb, #4338ca);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        /* オセロゲーム用のスタイル */
        .othello-board {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          grid-template-rows: repeat(6, 1fr);
          gap: 4px;
          width: 360px;
          height: 360px;
          max-width: 100%;
          background-color: rgba(0, 0, 0, 0.05);
          padding: 8px;
          border-radius: 8px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .dark .othello-board {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .othello-cell {
          background-color: #43a047;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          aspect-ratio: 1;
        }

        .othello-cell:hover.legal-move {
          background-color: #66bb6a;
        }

        .othello-disc {
          width: 85%;
          height: 85%;
          border-radius: 50%;
          transition: all 0.3s ease;
        }

        .othello-disc.black {
          background-color: #212121;
          box-shadow: inset 0px -3px 5px rgba(255, 255, 255, 0.2), 
                    inset 0px 3px 5px rgba(0, 0, 0, 0.5),
                    0px 2px 5px rgba(0, 0, 0, 0.3);
          animation: flip-to-black 0.3s;
        }

        .othello-disc.white {
          background-color: #f5f5f5;
          box-shadow: inset 0px -3px 5px rgba(0, 0, 0, 0.1), 
                    inset 0px 3px 5px rgba(255, 255, 255, 0.8),
                    0px 2px 5px rgba(0, 0, 0, 0.1);
          animation: flip-to-white 0.3s;
        }

        .legal-move-indicator {
          width: 30%;
          height: 30%;
          border-radius: 50%;
          background-color: rgba(0, 0, 0, 0.2);
          position: absolute;
        }

        .disc-counts {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-top: 0.5rem;
          font-weight: 500;
        }

        .disc-count {
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          background-color: rgba(255, 255, 255, 0.1);
          font-size: 0.875rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* オセロアニメーション */
        @keyframes flip-to-black {
          0% {
            transform: rotateY(0deg);
            background-color: #f5f5f5;
          }
          50% {
            transform: rotateY(90deg);
          }
          100% {
            transform: rotateY(180deg);
            background-color: #212121;
          }
        }

        @keyframes flip-to-white {
          0% {
            transform: rotateY(0deg);
            background-color: #212121;
          }
          50% {
            transform: rotateY(90deg);
          }
          100% {
            transform: rotateY(180deg);
            background-color: #f5f5f5;
          }
        }

        /* レスポンシブスタイル */
        @media (max-width: 768px) {
          .container {
            padding: 0.75rem;
            max-width: 100%;
          }
          
          .message-bubble {
            max-width: 85%;
          }

          .chat-window {
            height: 60vh;
            min-height: 300px;
          }

          .button-group {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 500px) {
          .othello-board {
            width: 100%;
            height: auto;
            aspect-ratio: 1;
            max-width: 300px;
          }

          .disc-counts {
            flex-direction: column;
            gap: 0.5rem;
            align-items: center;
          }
        }

        @media (max-width: 400px) {
          .game-board {
            width: 100%;
            height: auto;
            max-width: 300px;
          }
          
          .game-cell {
            font-size: 1.75rem;
          }
        }


      `}</style>
    
      <main className="flex min-h-screen flex-col p-2 sm:p-6 md:p-24 transition-colors duration-300 bg-white text-black">
        <div className="flex flex-col w-full max-w-4xl mx-auto rounded-lg border shadow-lg overflow-hidden bg-white border-gray-200">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold">マイチャットボット</h1>
            <div className="flex gap-2 items-center">
              {!loadingModels && (
                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  className="text-sm p-1 rounded border bg-white text-black border-gray-300"
                >
                  {modelOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
              
              {/* エージェントモード切り替えボタン */}
              <button 
                onClick={() => setAgentMode(!agentMode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  agentMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {agentMode ? '最新情報検索: ON' : '最新情報検索: OFF'}
              </button>
              
              <button
                onClick={clearChat}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700"
              >
                クリア
              </button>
            </div>
          </div>

          {/* マルバツゲーム */}
          {showGame && (
            <div className="game-container">
              <div className="game-status">
                {tictactoe.gameOver ? (
                  <div className="game-result">
                    {tictactoe.winner === "○" ? "あなたの勝ち！" : 
                     tictactoe.winner === "×" ? "AIの勝ち！" : "引き分け"}
                  </div>
                ) : (
                  <div className="turn-indicator">
                    {tictactoe.isPlayerTurn ? "あなたの番です" : "AIの番です..."}
                  </div>
                )}
                <div className="mark-counts">
                  <span className="mark-count">あなた: {tictactoe.playerMarks}/3 マーク</span>
                  <span className="mark-count">AI: {tictactoe.aiMarks}/3 マーク</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  3つのマークを使った後は、自分のマークを動かして遊んでね
                </p>
              </div>
              
              <div className="game-board">
                {tictactoe.board.map((cell, index) => (
                  <div
                    key={index}
                    className={`game-cell ${cell ? "marked" : ""}`}
                    onClick={() => handleCellClick(index)}
                  >
                    {cell}
                  </div>
                ))}
              </div>
              
              <button 
                onClick={toggleGame}
                className="game-button"
              >
                ゲームを閉じる
              </button>
            </div>
          )}
          
          {/* オセロゲーム */}
          {showOthello && (
            <div className="game-container">
              <div className="game-status">
                {othello.gameOver ? (
                  <div className="game-result">
                    {othello.blackCount > othello.whiteCount ? "あなたの勝ち！" : 
                     othello.blackCount < othello.whiteCount ? "AIの勝ち！" : "引き分け"}
                  </div>
                ) : (
                  <div className="turn-indicator">
                    {othello.currentPlayer === 'black' ? "あなたの番です" : "AIの番です..."}
                    {othello.skipTurn && " (相手のスキップ)"}
                  </div>
                )}
                
                <div className="disc-counts">
                  <span className="disc-count">黒 (あなた): {othello.blackCount}</span>
                  <span className="disc-count">白 (AI): {othello.whiteCount}</span>
                </div>
              </div>
              
              <div className="othello-board">
                {othello.board.map((row, rowIndex) => (
                  row.map((_, colIndex) => renderOthelloCell(rowIndex, colIndex))
                ))}
              </div>
              
              <button 
                onClick={toggleOthello}
                className="game-button"
              >
                ゲームを閉じる
              </button>
            </div>
          )}

          

          {/* チャットウィンドウ */}
          <div className="h-[500px] overflow-y-auto p-4 bg-gray-50">
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[75%] rounded-lg px-4 py-2 ${
                      msg.role === "user" 
                        ? "bg-blue-600 text-white rounded-br-none" 
                        : "bg-gray-200 text-gray-800 rounded-bl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] rounded-lg px-4 py-2 rounded-bl-none bg-gray-200 text-gray-800">
                    <div className="flex items-center">
                      <span>考え中</span>
                      <div className="flex items-center ml-2">
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce mx-0.5" style={{ animationDelay: "0ms" }}></span>
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce mx-0.5" style={{ animationDelay: "200ms" }}></span>
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce mx-0.5" style={{ animationDelay: "400ms" }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* 入力エリア */}
          <div className="p-4 flex gap-2 border-t border-gray-200 bg-gray-50">
            <textarea
              className="flex-1 p-2 rounded-lg border resize-none focus:outline-none focus:ring-2 bg-white border-gray-300 text-black focus:ring-blue-400"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={2}
              placeholder="メッセージを入力...「マルバツ」もしくは「オセロ」と入力するとゲームが始まるよ"
              disabled={loading}
            />
            <button 
              className={`px-4 py-2 rounded-lg font-medium flex items-center ${
                loading 
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              onClick={sendMessage}
              disabled={loading}
            >
              {loading ? (
                <span>送信中...</span>
              ) : (
                <span className="flex items-center">
                  <span>送信</span>
                  <svg className="ml-1 w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

// --- /api/chat.ts ---
