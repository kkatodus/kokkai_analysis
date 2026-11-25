"use client";

import { useModal } from "@/app/lib/hooks/useModal";
import { DonateModal } from "./modals/DonateModal";

// Each modal renders its own shared Dialog (scrim, focus trap, Esc).
const modalComponents = {
  donation: DonateModal,
};

export function ModalManager() {
  const { currentModals, removeModal } = useModal();
  if (currentModals.length === 0) return null;
  const current = currentModals[0];
  const Component = modalComponents[current];
  return <Component removeModal={() => removeModal(current)} />;
}
