// src/game/state.ts
// Match-level state management

export interface MatchState {
  frame: number;
  paused: boolean;
}

export const matchState: MatchState = {
  frame: 0,
  paused: false,
};

export function resetMatchState(): void {
  matchState.frame  = 0;
  matchState.paused = false;
}

export function tickFrame(): void {
  matchState.frame++;
}
