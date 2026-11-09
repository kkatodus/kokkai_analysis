"use client";

import { createContext, useContext } from "react";

/** Start/stop the guided tour from anywhere under the explorer (the header's 使い方 button uses it). */
export interface TutorialContextValue {
  active: boolean;
  start: () => void;
  stop: () => void;
}

export const TutorialContext = createContext<TutorialContextValue>({
  active: false,
  start: () => {},
  stop: () => {},
});

export function useTutorial(): TutorialContextValue {
  return useContext(TutorialContext);
}

export const TUTORIAL_SEEN_KEY = "kokkai_doc_tutorial_seen";
