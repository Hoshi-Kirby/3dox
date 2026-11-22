import { useEffect, useState } from "react";
import outerUrl from "./assets/layer_outer.svg?url";
import innerUrl from "./assets/layer_inner.svg?url";
import glassLitUrl from "./assets/layer_glass_clear.svg?url";
import glassDarkUrl from "./assets/layer_glass.svg?url";
import "./App.css";

const CELL = 72;
const BOARD = CELL * 3; // 盤面の一辺 216px
const FLOOR_H = 64; // 1階分の高さ
const SCREEN_PER_FLOOR = FLOOR_H * Math.sin(Math.PI / 3); // 1階ぶんの画面上の高さ
const DROP_MS = 900; // 降下アニメーションの長さ

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const emptyFloor = () => ({ cells: Array(9).fill(null) });

// 階番号から先攻を決める（1階は○、2階は×、以下交互）
const starterOf = (i) => (i % 2 === 0 ? "O" : "X");
const otherOf = (m) => (m === "O" ? "X" : "O");

// セル番号 → 盤面上の座標 (列, 行)
const xy = (c) => [c % 3, Math.floor(c / 3)];

// a→b→c が等間隔で一直線に並ぶか（同じ位置の縦並びも含む）
function isStraight(a, b, c) {
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  const [cx, cy] = xy(c);
  return ax + cx === 2 * bx && ay + cy === 2 * by;
}

// top 階の cell に駒を置いた直後に勝ちが成立したか
function isWin(floors, top, cell) {
  const mark = floors[top].cells[cell];

  // 同じ階の3目
  const sameFloor = LINES.some(
    (line) =>
      line.includes(cell) && line.every((c) => floors[top].cells[c] === mark),
  );
  if (sameFloor) return true;

  // 2階下・1階下・今の階を通る直線
  if (top < 2) return false;
  const bottom = floors[top - 2].cells;
  const middle = floors[top - 1].cells;
  for (let a = 0; a < 9; a++) {
    for (let b = 0; b < 9; b++) {
      if (bottom[a] === mark && middle[b] === mark && isStraight(a, b, cell)) {
        return true;
      }
    }
  }
  return false;
}

// 5階に1回を点灯階にする（前後にずらして機械的に見えないようにする）
const isLitFloor = (i) => (i + 2) % 5 === 0;

// 階ごとの壁（先頭ほど手前）
const wallFor = (i) => {
  const lit = isLitFloor(i);
  const layers = [
    outerUrl, // 外側の柱（手前）
    lit ? glassLitUrl : glassDarkUrl, // ガラス
    innerUrl,
  ];
  return {
    backgroundImage: layers.map((u) => `url("${u}")`).join(", "),
  };
};

// ○と×をSVGで描く（線の太さと大きさを両方そろえる）
function Mark({ m }) {
  if (!m) return null;
  const common = {
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 5,
    strokeLinecap: "round",
  };
  if (m === "O") {
    return (
      <svg {...common}>
        <circle cx="20" cy="20" r="13" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 12L28 28M28 12L12 28" />
    </svg>
  );
}

export default function App() {
  const [floors, setFloors] = useState([emptyFloor()]);
  const [phase, setPhase] = useState("play"); // play | destroy | build | over
  const [destroyStep, setDestroyStep] = useState(0); // 0: 先攻が後攻の駒を2個 / 1: 後攻が先攻の駒を3個
  const [destroyCount, setDestroyCount] = useState(0);
  const [winner, setWinner] = useState(null);
  const [viewTop, setViewTop] = useState(0); // 画面中央に置く階の番号

  const top = floors.length - 1;
  const cur = floors[top].cells;
  const first = starterOf(top); // この階の先攻
  const second = otherOf(first); // この階の後攻
  const marks = cur.filter(Boolean).length;
  const turn = marks % 2 === 0 ? first : second;
  const symbol = (m) => (m === "O" ? "○" : "×");

  let message;
  if (phase === "over") {
    message = `${symbol(winner)}の勝ち！`;
  } else if (phase === "destroy") {
    message =
      destroyStep === 0
        ? `先攻（${symbol(first)}）は${symbol(second)}の駒をあと${2 - destroyCount}個破壊`
        : `後攻（${symbol(second)}）は${symbol(first)}の駒をあと${3 - destroyCount}個破壊`;
  } else if (phase === "build") {
    message = `${floors.length}階を建設中…`;
  } else {
    message = `${symbol(turn)}の番（${floors.length}階・先攻${symbol(first)}）`;
  }

  // 建設の降下が終わったら、新しい階が中央に来るよう全体を下げる
  useEffect(() => {
    if (phase !== "build") return;
    const t = setTimeout(() => {
      setViewTop(floors.length - 1);
      setPhase("play");
    }, DROP_MS);
    return () => clearTimeout(t);
  }, [phase, floors.length]);

  function handlePlace(cell) {
    if (phase !== "play" || cur[cell]) return;

    const next = floors.map((f, i) =>
      i === top ? { cells: f.cells.map((v, c) => (c === cell ? turn : v)) } : f,
    );
    setFloors(next);

    if (isWin(next, top, cell)) {
      setWinner(turn);
      setPhase("over");
      return;
    }
    if (next[top].cells.every(Boolean)) {
      // 引き分け → 破壊フェーズへ
      setPhase("destroy");
      setDestroyStep(0);
      setDestroyCount(0);
    }
  }

  function handleDestroy(cell) {
    if (phase !== "destroy") return;
    const target = destroyStep === 0 ? second : first;
    if (cur[cell] !== target) return;

    const removed = floors.map((f, i) =>
      i === top ? { cells: f.cells.map((v, c) => (c === cell ? null : v)) } : f,
    );
    const count = destroyCount + 1;
    const need = destroyStep === 0 ? 2 : 3;

    if (count < need) {
      setFloors(removed);
      setDestroyCount(count);
      return;
    }
    if (destroyStep === 0) {
      setFloors(removed);
      setDestroyStep(1);
      setDestroyCount(0);
      return;
    }

    // 残った駒はそのまま残し、何も置かれていない新しい階を上に建てる
    setFloors([...removed, emptyFloor()]);
    setPhase("build");
    setDestroyStep(0);
    setDestroyCount(0);
  }

  function reset() {
    setFloors([emptyFloor()]);
    setPhase("play");
    setWinner(null);
    setDestroyStep(0);
    setDestroyCount(0);
    setViewTop(0);
  }

  // 階ごとの持ち上げ量（勝敗決定時のみ、px）
  const liftOf = (i) => {
    if (phase !== "over") return 0;
    if (i === top) return 2 * FLOOR_H;
    if (i === top - 1) return FLOOR_H;
    return 0;
  };

  // 今の階の盤面が画面中央に来るように全体を下げる
  const stageStyle = {
    transform: `translateY(${SCREEN_PER_FLOOR}px) rotateX(60deg) rotateZ(45deg) translateZ(${-viewTop * FLOOR_H}px)`,
  };
  const sceneVars = { "--board": `${BOARD}px`, "--floor-h": `${FLOOR_H}px` };

  return (
    <div className="app">
      <header className="hud">
        <h1>立体○×</h1>
        <p className="msg">{message}</p>
        <button onClick={reset}>最初から</button>
      </header>

      <div className="backdrop night">
        <div className="stars" />
      </div>

      <div className="scene" style={sceneVars}>
        <div className="stage" style={stageStyle}>
          <div className="ground" />
          {floors.map((floor, i) => {
            const isTop = i === top;
            const dropping = phase === "build" && isTop;
            const pFirst = starterOf(i);
            const lift = liftOf(i);
            const z = i * FLOOR_H + FLOOR_H / 2 + lift;
            const lifted = lift > 0;
            return (
              <div
                key={i}
                className={`block ${dropping ? "drop" : ""}`}
                style={{
                  transform: `translateZ(${z}px)`,
                  "--z": `${z}px`,
                }}
              >
                {i !== 0 && !lifted && (
                  <>
                    <div className="face front" style={wallFor(i)} />
                    <div className="face right" style={wallFor(i)} />
                  </>
                )}

                <div className={`plate ${isTop ? "" : "past"}`}>
                  <div className="grid">
                    {floor.cells.map((v, c) => {
                      const targetMark =
                        destroyStep === 0 ? otherOf(pFirst) : pFirst;
                      const targetable =
                        isTop && phase === "destroy" && v === targetMark;
                      return (
                        <div
                          key={c}
                          className={`cell ${v === "O" ? "o" : v === "X" ? "x" : ""} ${
                            targetable ? "target" : ""
                          }`}
                          onClick={() => {
                            if (!isTop) return;
                            if (phase === "destroy") handleDestroy(c);
                            else handlePlace(c);
                          }}
                        >
                          <Mark m={v} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
