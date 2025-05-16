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

// マルバツゲームの状態を表す型
interface TicTacToeState {
  board: Array<string | null>;
  isPlayerTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  playerMarks: number;
  aiMarks: number;
}

// オセロゲームの状態を表す型
interface OthelloState {
  board: string[][];
  currentPlayer: 'black' | 'white';
  gameOver: boolean;
  blackCount: number;
  whiteCount: number;
  skipTurn: boolean;
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

  // マルバツゲームの関数
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
      
      // AIの手を計算
      setTimeout(() => aiMove(newBoard), 700);
    }
  };

  // AIの手を計算
  const aiMove = (board: Array<string | null>) => {
    // すでにゲームが終了している場合は何もしない
    if (tictactoe.gameOver) return;
    
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

  // 最適な手を見つける
  const findBestMove = (board: Array<string | null>, aiMarksCount: number): number => {
    // 勝てる手があれば選択
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        const testBoard = [...board];
        testBoard[i] = '×';
        if (checkWinner(testBoard) === '×') {
          return i;
        }
      }
    }
    
    // 相手が次に勝てる手を防ぐ
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        const testBoard = [...board];
        testBoard[i] = '○';
        if (checkWinner(testBoard) === '○') {
          return i;
        }
      }
    }
    
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
    
    return -1;
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

  // ゲームをリセット
  const resetGame = () => {
    // ゲームの状態を初期化
    const newState: TicTacToeState = {
      board: Array(9).fill(null),
      isPlayerTurn: false, // AIが先手になるようfalseに設定
      gameOver: false,
      winner: null,
      playerMarks: 0,
      aiMarks: 0
    };
    
    setTictactoe(newState);
    
    // AIが先行で打つため、少し遅延させてAIの手を実行
    setTimeout(() => {
      if (!showGame) return; // ゲームが表示されていない場合は実行しない
      const newBoard = [...Array(9).fill(null)]; // 新しい配列を作成
      // 最初の手は中央か角を選ぶ
      const firstMoves = [0, 2, 4, 6, 8];
      const firstMove = firstMoves[Math.floor(Math.random() * firstMoves.length)];
      newBoard[firstMove] = '×';
      
      setTictactoe(prevState => ({
        ...prevState,
        board: newBoard,
        isPlayerTurn: true, // プレイヤーのターンに変更
        aiMarks: 1 // AIのマークを1つ増やす
      }));
    }, 800);
  };
  
  // ゲーム表示切り替え
  const toggleGame = () => {
    if (!showGame) {
      setShowGame(true); // 先にゲーム表示状態を更新
      setTimeout(() => resetGame(), 100); // 少し遅延させてからリセット処理を行う
    } else {
      setShowGame(false);
    }
    setShowOthello(false);
  };

  // オセロゲームの初期化
  const initOthelloBoard = () => {
    // 6x6の盤面を作成
    const newBoard = Array(6).fill(null).map(() => Array(6).fill(''));
    
    // 初期配置 (中央に4つの石を配置)
    const mid = Math.floor(6 / 2) - 1;
    newBoard[mid][mid] = 'white';
    newBoard[mid][mid + 1] = 'black';
    newBoard[mid + 1][mid] = 'black';
    newBoard[mid + 1][mid + 1] = 'white';
    
    // 打てる場所を計算
    const legalMoves = findLegalMoves(newBoard, 'black');
    
    // 初期状態をセット
    setOthello({
      board: newBoard,
      currentPlayer: 'black',
      gameOver: false,
      blackCount: 2,
      whiteCount: 2,
      skipTurn: legalMoves.length === 0
    });
  };
  
  // 合法手を見つける
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
  
  // 石を置いたときに裏返る石を計算
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
  
  // オセロの石を置く
  const placeDisc = (row: number, col: number) => {
    // ゲーム終了時またはすでに石がある場合は何もしない
    if (othello.gameOver || othello.board[row][col] !== '') return;
    
    // 現在のプレイヤー
    const currentPlayer = othello.currentPlayer;
    const board = [...othello.board.map(row => [...row])];
    
    // この位置が合法手かチェック
    const legalMoves = findLegalMoves(board, currentPlayer);
    const isLegalMove = legalMoves.some(([r, c]) => r === row && c === col);
    
    if (!isLegalMove) return;
    
    // 石を置く
    board[row][col] = currentPlayer;
    
    // 裏返す石を計算して適用
    const flippedDiscs = getFlippedDiscs(board, row, col, currentPlayer);
    for (const [r, c] of flippedDiscs) {
      board[r][c] = currentPlayer;
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
    
    // 次のプレイヤー
    const nextPlayer = currentPlayer === 'black' ? 'white' : 'black';
    
    // 次のプレイヤーの合法手をチェック
    const nextLegalMoves = findLegalMoves(board, nextPlayer);
    const canNextPlayerMove = nextLegalMoves.length > 0;
    
    // 次のプレイヤーが打てない場合、現在のプレイヤーが再度打てるかチェック
    if (!canNextPlayerMove) {
      const currentPlayerCanMove = findLegalMoves(board, currentPlayer).length > 0;
      
      // どちらも打てない場合はゲーム終了
      if (!currentPlayerCanMove) {
        setOthello({
          board,
          currentPlayer: nextPlayer,
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
        currentPlayer: currentPlayer, // 同じプレイヤーのターン
        gameOver: false,
        blackCount,
        whiteCount,
        skipTurn: true
      });
      
      return;
    }
    
    // プレイヤーがwhiteの場合、次はAIの手番
    setOthello({
      board,
      currentPlayer: nextPlayer,
      gameOver: false,
      blackCount,
      whiteCount,
      skipTurn: false
    });
    
    // AIのターンの場合、少し遅延させてAIの手を実行
    if (nextPlayer === 'white') {
      setTimeout(() => makeAIMove(board), 800);
    }
  };
  
  // AIの手を計算
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
        setOthello({
          ...othello,
          gameOver: true
        });
      } else {
        // AIがスキップしてプレイヤーのターンに戻る
        setOthello({
          ...othello,
          currentPlayer: 'black',
          skipTurn: true
        });
      }
      return;
    }
    
    // 簡単な評価関数：裏返せる石の数が最も多い手を選ぶ
    let bestScore = -1;
    let bestMove: [number, number] = [-1, -1];
    
    // 隅を優先して取る戦略
    const cornerMoves = legalMoves.filter(([r, c]) => 
      (r === 0 && c === 0) || (r === 0 && c === 5) || 
      (r === 5 && c === 0) || (r === 5 && c === 5)
    );
    
    if (cornerMoves.length > 0) {
      // ランダムに隅を選択
      bestMove = cornerMoves[Math.floor(Math.random() * cornerMoves.length)];
    } else {
      // 隅がない場合は裏返せる石の数が多い手を選ぶ
      for (const [row, col] of legalMoves) {
        const flipped = getFlippedDiscs(currentBoard, row, col, 'white');
        
        // 特定の位置に重みを与える（辺を優先）
        let score = flipped.length;
        
        // 辺の位置にボーナス
        if (row === 0 || row === 5 || col === 0 || col === 5) {
          score += 2;
        }
        
        // 隅の隣は避ける
        if ((row === 0 && col === 1) || (row === 1 && col === 0) || 
            (row === 0 && col === 4) || (row === 1 && col === 5) || 
            (row === 4 && col === 0) || (row === 5 && col === 1) || 
            (row === 4 && col === 5) || (row === 5 && col === 4)) {
          score -= 1;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = [row, col];
        }
      }
      
      // 良い手が見つからない場合はランダム選択
      if (bestMove[0] === -1) {
        bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }
    }
    
    // 石を置く
    placeDisc(bestMove[0], bestMove[1]);
  };
  
  // オセロゲームをリセット
  const resetOthello = () => {
    initOthelloBoard();
  };
  
  // ゲーム切り替え
  const toggleOthello = () => {
    if (!showOthello) {
      resetOthello();
      setShowGame(false);
    }
    setShowOthello(!showOthello);
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

  const sendMessage = async () => {
    if (!input.trim()) return;
    setError(null);
    
    // マルバツゲームの起動コマンド
    if (input.trim().toLowerCase() === 'まるばつ' || 
        input.trim().toLowerCase() === 'マルバツ' || 
        input.trim().toLowerCase() === 'tic tac toe' || 
        input.trim().toLowerCase() === 'まるばつゲーム' || 
        input.trim().toLowerCase() === 'マルバツゲーム') {
      const newMessages: Message[] = [
        ...messages, 
        { role: "user", content: input },
        { role: "assistant", content: "マルバツゲームを始めるよ！君は○、俺は×。先攻は俺がやるね。それぞれ3つまでしか置けないから、戦略的に配置してみて。" }
      ];
      setMessages(newMessages);
      setInput("");
      toggleGame();
      return;
    }
    
    // オセロゲームの起動コマンド
    if (input.trim().toLowerCase() === 'オセロ' || 
        input.trim().toLowerCase() === 'おせろ' || 
        input.trim().toLowerCase() === 'othello' || 
        input.trim().toLowerCase() === 'オセロゲーム' || 
        input.trim().toLowerCase() === 'おせろゲーム') {
      const newMessages: Message[] = [
        ...messages, 
        { role: "user", content: input },
        { role: "assistant", content: "オセロを始めよう！君は黒、俺は白で6×6の盤面で対戦するよ。石は多い方が勝ちだ。緑色のマスに石を置けるからクリックしてみて。" }
      ];
      setMessages(newMessages);
      setInput("");
      toggleOthello();
      return;
    }
    
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
            <button className="button" onClick={toggleGame}>
              <span>🎮</span>
              <span>マルバツ</span>
            </button>
            <button className="button" onClick={toggleOthello}>
              <span>⚫</span>
              <span>オセロ</span>
            </button>
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
      
      {showOthello ? (
        /* オセロゲーム */
        <div className="game-container">
          <div className="game-status">
            {othello.gameOver ? (
              <div className="game-result">
                {othello.blackCount > othello.whiteCount
                  ? '🎉 おめでとう！君の勝ちだ！'
                  : othello.blackCount < othello.whiteCount
                  ? '😎 俺の勝ち！次は頑張れよ？'
                  : '😯 引き分けだな'}
              </div>
            ) : (
              <div className="turn-indicator">
                {othello.skipTurn ? 
                  `${othello.currentPlayer === 'black' ? '相手' : '君'}は打てる場所がないため、${othello.currentPlayer === 'black' ? '君' : '相手'}の番だよ` : 
                  `${othello.currentPlayer === 'black' ? '君' : '相手'}のターン (${othello.currentPlayer === 'black' ? '黒' : '白'})`}
              </div>
            )}
            <div className="disc-counts">
              <div className="disc-count">黒 (あなた): {othello.blackCount} 個</div>
              <div className="disc-count">白 (AI): {othello.whiteCount} 個</div>
            </div>
          </div>
        
          <div className="othello-board">
            {othello.board.map((row, rowIndex) =>
              row.map((_, colIndex) => renderOthelloCell(rowIndex, colIndex))
            )}
          </div>
        
          <button className="game-button" onClick={resetOthello}>ゲームをリセット</button>
          <button className="game-button" onClick={toggleOthello}>チャットに戻る</button>
        </div>
      ) : showGame ? (
        /* マルバツゲーム */
        <div className="game-container">
          <div className="game-status">
            {tictactoe.gameOver ? (
              <div className="game-result">
                {tictactoe.winner === '○' ? 
                  '🎉 おめでとう！君の勝ちだ！' : 
                  tictactoe.winner === '×' ? 
                  '😎 俺の勝ち！次は頑張れよ？' : 
                  '😯 引き分けだな'}
              </div>
            ) : (
              <div className="turn-indicator">
                {tictactoe.isPlayerTurn ? 
                  `君のターン (○) ${tictactoe.playerMarks >= 3 ? '- マークを動かそう' : ''}` : 
                  '俺のターン (×)...'}
              </div>
            )}
            <div className="mark-counts">
              <div className="mark-count">あなた: {tictactoe.playerMarks}/3 個</div>
              <div className="mark-count">AI: {tictactoe.aiMarks}/3 個</div>
            </div>
          </div>
        
          <div className="game-board">
            {tictactoe.board.map((cell, index) => (
              <div 
                key={index} 
                className={`game-cell ${cell ? 'marked' : ''}`}
                onClick={() => handleCellClick(index)}
              >
                {cell}
              </div>
            ))}
          </div>
        
          <button className="game-button" onClick={resetGame}>ゲームをリセット</button>
        </div>
      ) : (
        <>
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
              placeholder="メッセージを入力...「マルバツ」と入力するとゲームが始まるよ"
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
        </>
      )}
    </div>
  );
}

// --- /api/chat.ts ---
