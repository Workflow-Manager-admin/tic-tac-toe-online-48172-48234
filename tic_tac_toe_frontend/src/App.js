import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import { getAIMove, calculateWinner } from "./ai";

// Color variables per requirements (applied to style objects and CSS vars)
const PRIMARY = "#1976d2";
const ACCENT = "#388e3c";
const SECONDARY = "#ffffff";

// Helper function for empty board
function createEmptyBoard() {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

// PUBLIC_INTERFACE
function App() {
  // App state
  const [theme, setTheme] = useState("light");
  const [mode, setMode] = useState(null); // "single" or "multi"
  const [playerSymbol, setPlayerSymbol] = useState("X");
  const [status, setStatus] = useState("Select mode");
  const [board, setBoard] = useState(createEmptyBoard());
  const [gameId, setGameId] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [draw, setDraw] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const channel = useRef(null);
  const userId = useRef(`u${Math.floor(Math.random() * 1e9)}`);

  // Set theme on document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Reset everything
  const handleReset = () => {
    setBoard(createEmptyBoard());
    setWinner(null);
    setDraw(false);
    setStatus(mode === "multi" ? (isMyTurn ? "Your move" : "Waiting for opponent...") : "Your move");
    if (mode === "multi" && gameId) {
      sendBoardUpdate(createEmptyBoard(), null, false);
    }
  };

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // PUBLIC_INTERFACE
  // User selects play mode
  const startSinglePlayer = () => {
    setMode("single");
    setPlayerSymbol("X");
    setBoard(createEmptyBoard());
    setWinner(null);
    setDraw(false);
    setStatus("Your move");
    setIsMyTurn(true);
    setGameId(null);
  };

  // PUBLIC_INTERFACE
  // Start a new multiplayer game
  const startMultiplayer = async () => {
    setGameLoading(true);
    const gameRef = `room-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from("games")
      .insert([
        {
          id: gameRef,
          board: JSON.stringify(createEmptyBoard()),
          turn: "X",
          status: "waiting",
          players: JSON.stringify([userId.current]),
        },
      ]);
    setMode("multi");
    setPlayerSymbol("X");
    setBoard(createEmptyBoard());
    setWinner(null);
    setDraw(false);
    setGameId(gameRef);
    setIsMyTurn(true);
    setStatus("Share this code to join: " + gameRef);
    // Subscribe to changes for this game
    subscribeToGame(gameRef);
    setGameLoading(false);
  };

  // PUBLIC_INTERFACE
  // Join an existing multiplayer game
  const joinGame = async (idToJoin) => {
    setGameLoading(true);
    // Fetch game
    let { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", idToJoin)
      .single();
    if (error || !game) {
      setStatus("Invalid code");
      setGameLoading(false);
      return;
    }
    if (JSON.parse(game.players).length >= 2) {
      setStatus("Room full / already started");
      setGameLoading(false);
      return;
    }
    // Add self as player 2
    const { error: updateError } = await supabase
      .from("games")
      .update({
        players: JSON.stringify([...JSON.parse(game.players), userId.current]),
        status: "playing",
      })
      .eq("id", idToJoin);
    setMode("multi");
    setPlayerSymbol("O");
    setBoard(JSON.parse(game.board));
    setWinner(null);
    setDraw(false);
    setGameId(idToJoin);
    setIsMyTurn(false); // Player O goes second
    setStatus("Joined! Wait for your turn...");
    subscribeToGame(idToJoin);
    setGameLoading(false);
  };

  // Multiplayer: subscribe to realtime changes
  const subscribeToGame = (id) => {
    if (channel.current) {
      channel.current.unsubscribe();
      channel.current = null;
    }
    channel.current = supabase
      .channel(`public:games:id=eq.${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        ({ new: newGame }) => {
          // Parse board
          const parsedBoard = JSON.parse(newGame.board);
          setBoard(parsedBoard);
          setIsMyTurn(
            (playerSymbol === "X" && newGame.turn === "X") ||
              (playerSymbol === "O" && newGame.turn === "O")
          );
          setWinner(newGame.winner || null);
          setDraw(newGame.draw || false);
          if (newGame.status === "waiting") setStatus("Waiting for opponent...");
          else if (newGame.status === "playing")
            setStatus(
              (playerSymbol === newGame.turn ? "Your move" : "Opponent's move")
            );
          else if (newGame.status === "done")
            setStatus(
              newGame.winner
                ? newGame.winner === playerSymbol
                  ? "You won!"
                  : "You lost."
                : "Draw!"
            );
        }
      )
      .subscribe();
  };

  // Send real-time board update (for multiplayer)
  const sendBoardUpdate = async (updatedBoard, winnerFound, drawVal) => {
    if (!gameId) return;
    const nextTurn = playerSymbol === "X" ? "O" : "X";
    let newStatus = "playing";
    if (winnerFound || drawVal) newStatus = "done";
    await supabase
      .from("games")
      .update({
        board: JSON.stringify(updatedBoard),
        turn: nextTurn,
        winner: winnerFound || null,
        draw: drawVal,
        status: newStatus,
      })
      .eq("id", gameId);
  };

  // Handle move (either mode)
  const handleClick = (rowIdx, colIdx) => {
    if (winner || draw) return;
    // Single player
    if (mode === "single") {
      if (!isMyTurn || board[rowIdx][colIdx]) return;
      const newBoard = board.map((r) => r.slice());
      newBoard[rowIdx][colIdx] = playerSymbol;
      const w = calculateWinner(newBoard);
      const d = newBoard.flat().every((c) => c);
      setBoard(newBoard);
      if (w) {
        setWinner(w);
        setStatus("You win!");
      } else if (d) {
        setDraw(true);
        setStatus("Draw!");
      } else {
        setIsMyTurn(false);
        setStatus("Computer's move...");
      }
    }
    // Multiplayer
    else if (mode === "multi") {
      if (!isMyTurn || board[rowIdx][colIdx]) return;
      const newBoard = board.map((r) => r.slice());
      newBoard[rowIdx][colIdx] = playerSymbol;
      const w = calculateWinner(newBoard);
      const d = newBoard.flat().every((c) => c);
      setBoard(newBoard);
      setIsMyTurn(false);
      if (w) {
        setWinner(w);
        setStatus("Game over!");
        sendBoardUpdate(newBoard, w, false);
      } else if (d) {
        setDraw(true);
        setStatus("Draw!");
        sendBoardUpdate(newBoard, null, true);
      } else {
        sendBoardUpdate(newBoard, null, false);
        setStatus("Opponent's move");
      }
    }
  };

  // AI move (single player)
  useEffect(() => {
    if (mode === "single" && !isMyTurn && !winner && !draw) {
      const timer = setTimeout(() => {
        const [aiRow, aiCol] = getAIMove(board, "O", "X");
        const newBoard = board.map((r) => r.slice());
        newBoard[aiRow][aiCol] = "O";
        const w = calculateWinner(newBoard);
        const d = newBoard.flat().every((c) => c);
        setBoard(newBoard);
        if (w) {
          setWinner(w);
          setStatus("Computer wins!");
        } else if (d) {
          setDraw(true);
          setStatus("Draw!");
        } else {
          setIsMyTurn(true);
          setStatus("Your move");
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [board, isMyTurn, mode, winner, draw]);

  // Cleanup Supabase subscription on unmount
  useEffect(() => {
    return () => {
      if (channel.current) channel.current.unsubscribe();
    };
  }, []);

  // Checks for winner/draw to update overlays for multiplayer (for out-of-band board changes)
  useEffect(() => {
    if (mode === "multi" && board) {
      const w = calculateWinner(board);
      const d = board.flat().every((c) => c);
      if (w && !winner) setWinner(w);
      else if (d && !draw && !w) setDraw(true);
    }
  }, [board, mode, winner, draw]);

  // UI Rendering -------

  // Board render
  function renderBoard() {
    return (
      <div className="ttt-board">
        {board.map((row, i) => (
          <div className="ttt-row" key={i}>
            {row.map((cell, j) => (
              <button
                className="ttt-cell"
                key={j}
                onClick={() => handleClick(i, j)}
                disabled={!!cell || winner || draw || (mode === "multi" && !isMyTurn)}
                aria-label={`Cell ${i},${j}`}
              >
                {cell}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Main screen
  return (
    <div className="App" style={{ background: SECONDARY }}>
      <header className="App-header" style={{ background: SECONDARY }}>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <h1 style={{ color: PRIMARY, margin: "0 0 24px" }}>
          Tic Tac Toe Online
        </h1>
        {mode == null && (
          <div className="ttt-modesel">
            <button
              style={{
                background: PRIMARY,
                color: SECONDARY,
                margin: "0 8px",
                minWidth: 140,
              }}
              className="ttt-btn"
              onClick={startSinglePlayer}
            >
              Single Player
            </button>
            <button
              style={{
                background: ACCENT,
                color: SECONDARY,
                margin: "0 8px",
                minWidth: 140,
              }}
              className="ttt-btn"
              onClick={startMultiplayer}
              disabled={gameLoading}
            >
              {gameLoading ? "Starting..." : "2-Player Online"}
            </button>
            <div
              style={{
                marginTop: 22,
                borderTop: "1px solid #e0e0e0",
                paddingTop: 14,
                fontSize: 16,
                color: "#555",
                width: 270,
              }}
            >
              <span style={{ fontWeight: 500 }}>Or join with code</span>
              <form
                style={{ marginTop: 10, display: "flex" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  joinGame(roomCodeInput.trim());
                }}
              >
                <input
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "1px solid #ccc",
                    padding: "7px 8px",
                    fontSize: 16,
                    outline: "none",
                  }}
                  placeholder="Room code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  disabled={gameLoading}
                />
                <button
                  type="submit"
                  className="ttt-btn"
                  disabled={gameLoading}
                  style={{
                    background: PRIMARY,
                    color: SECONDARY,
                    marginLeft: 8,
                  }}
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}

        {mode && (
          <div className="ttt-game">
            <div className="ttt-status" style={{ marginBottom: 15 }}>
              <span
                style={{
                  color:
                    winner && winner === playerSymbol
                      ? ACCENT
                      : winner
                      ? "#c62828"
                      : PRIMARY,
                  fontWeight: "bold",
                }}
              >
                {winner
                  ? winner === playerSymbol
                    ? "You win!"
                    : mode === "multi"
                    ? winner === "X" && playerSymbol === "O"
                      ? "Opponent wins!"
                      : "Opponent wins!"
                    : "Computer wins!"
                  : draw
                  ? "Draw!"
                  : status}
              </span>
              {mode === "multi" && gameId && (
                <>
                  <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
                    Room: <b>{gameId}</b> &nbsp;|&nbsp; You: <b>{playerSymbol}</b>
                  </div>
                </>
              )}
            </div>
            {renderBoard()}
            <div className="ttt-actions" style={{ margin: "20px 0 0 0" }}>
              <button
                className="ttt-btn"
                style={{
                  background: PRIMARY,
                  color: SECONDARY,
                  marginRight: 10,
                  minWidth: 100,
                }}
                onClick={handleReset}
              >
                Restart
              </button>
              <button
                className="ttt-btn"
                style={{
                  background: "#d32f2f",
                  color: SECONDARY,
                  minWidth: 100,
                }}
                onClick={() => window.location.reload()}
              >
                Home
              </button>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
