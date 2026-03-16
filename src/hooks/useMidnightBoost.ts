import { useState, useEffect, useCallback } from "react";

const BOOST_WINDOW_SECONDS = 300; // 5 minutes before and after midnight UTC
const BOOST_POLL_MS = 2_000;
const NORMAL_POLL_MS = 5_000;

export interface MidnightBoostState {
  isBoostActive: boolean;
  secondsUntilMidnight: number;
  recommendedPollMs: number;
}

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0
  ));
  return Math.floor((nextMidnight.getTime() - now.getTime()) / 1000);
}

export function useMidnightBoost(): MidnightBoostState {
  const compute = useCallback((): MidnightBoostState => {
    const secsUntil = getSecondsUntilMidnightUTC();
    // Active if within 5 min before OR after midnight UTC
    const isBoost = secsUntil <= BOOST_WINDOW_SECONDS || secsUntil >= 86400 - BOOST_WINDOW_SECONDS;
    return {
      isBoostActive: isBoost,
      secondsUntilMidnight: secsUntil,
      recommendedPollMs: isBoost ? BOOST_POLL_MS : NORMAL_POLL_MS,
    };
  }, []);

  const [state, setState] = useState<MidnightBoostState>(compute);

  useEffect(() => {
    const interval = setInterval(() => {
      setState(compute());
    }, 1000);
    return () => clearInterval(interval);
  }, [compute]);

  return state;
}
