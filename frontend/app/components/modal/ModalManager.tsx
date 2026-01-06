"use client";

import { Modal } from "@/app/types";
import { useModal } from "@/app/lib/hooks/useModal";
import { DonateModal } from "./modals/DonateModal";
import { DisclaimerModal } from "./modals/DisclaimerModal";
import React from "react";

const modalComponents = {
	donation: DonateModal,
	disclaimer: DisclaimerModal,
}
export function ModalManager() {
	const { currentModals, addModal, removeModal } = useModal();
	if (currentModals.length === 0) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="relative min-h-0 max-h-[80%] w-[80%] rounded-lg drop-shadow-2xl">
				{currentModals.length > 0 && React.createElement(modalComponents[currentModals[0]], { removeModal: () => removeModal(currentModals[0]) })}
			</div>
		</div>
	)
}