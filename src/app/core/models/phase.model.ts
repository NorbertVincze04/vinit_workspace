export type PhaseId = 'build' | 'prove' | 'sell' | 'scale';

/** One of the four Year-1 phases. Shared by the Roadmap and Tasks tools. */
export interface Phase {
  id: PhaseId;
  name: string;
  months: readonly [number, number];
  goal: string;
}

/** Name + percent pair used by the phase rail. */
export interface PhaseProgress {
  name: string;
  percent: number;
}
