"use client";

import { Modal } from "@/app/types";
import React, { createContext, useContext, useMemo, useState } from "react";

type ModalContextValue = {
  currentModals: Modal[];
  setCurrentModals: React.Dispatch<React.SetStateAction<Modal[]>>;
  addModal: (modal: Modal) => void;
  removeModal: (modal: Modal) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [currentModals, setCurrentModals] = useState<Modal[]>([]);

  const value = useMemo<ModalContextValue>(() => {
    const addModal = (modal: Modal) => setCurrentModals((prev) => [...prev, modal]);
    const removeModal = (modal: Modal) =>
      setCurrentModals((prev) => prev.filter((m) => m !== modal));
    return { currentModals, setCurrentModals, addModal, removeModal };
  }, [currentModals]);

  return React.createElement(ModalContext.Provider, { value }, children);
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
}