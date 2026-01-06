"use client";

import { Modal } from "@/app/types";
import { RxCross1 } from "react-icons/rx";



export function DisclaimerModal({ removeModal }: { removeModal: () => void }) {
	return (
		<div className="h-full w-full flex flex-col justify-center items-center">
			<button
				className="right-0 top-0 absolute transition hover:scale-125 mt-2 mr-2"
				onClick={removeModal}
				type="button"
			>
				<RxCross1 className="h-10 w-10" />
			</button>
			<h1>Disclaimer Modal</h1>
		</div>
	)
}