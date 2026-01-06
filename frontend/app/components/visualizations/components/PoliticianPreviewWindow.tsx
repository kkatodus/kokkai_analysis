import type { SangiinPolitician, ShugiinPolitician } from "@/app/types";
import { Badge } from "@/app/components/shared/Badge";
import { Card } from "@/app/components/shared/Card";
import { EmptyState } from "@/app/components/shared/EmptyState";

interface PoliticianPreviewWindowProps {
	selectedDistrict?: string | null;
	shugiinPoliticians?: ShugiinPolitician[];
	sangiinPoliticians?: SangiinPolitician[];
	onPoliticianSelect?: (id: string) => void;
	selectedPersonId?: string | null;
}

function PoliticianPreviewWindow({
	shugiinPoliticians,
	sangiinPoliticians,	
	selectedDistrict,
	onPoliticianSelect,
	selectedPersonId,
}: PoliticianPreviewWindowProps) {
	const shugiin = shugiinPoliticians ?? [];
	const sangiin = sangiinPoliticians ?? [];
	const hasDistrict = Boolean(selectedDistrict && selectedDistrict.trim().length > 0);
	const stopMapInteractions = (
		e:
			| React.WheelEvent
			| React.MouseEvent
			| React.PointerEvent
			| React.TouchEvent
	) => {
		// Prevent DeckGL/Map from using the same wheel/drag events (zoom/pan),
		// so the panel can scroll normally.
		e.stopPropagation();
	};

	return (
		<div
			className="pointer-events-none relative z-20 mb-2 w-full max-w-full sm:absolute sm:left-3 sm:top-3 sm:bottom-3 sm:mb-0 sm:w-[340px] sm:max-w-[calc(100%-1.5rem)]"
			id="politician-preview-window"
		>
			<div
				className="pointer-events-auto sm:h-full"
				// Stop click/drag on the panel from panning the map behind it
				onMouseDownCapture={stopMapInteractions}
				onPointerDownCapture={stopMapInteractions}
				onTouchStartCapture={stopMapInteractions}
				// Stop wheel from zooming the map; allow the inner scroll container to scroll
				onWheelCapture={stopMapInteractions}
				id="politician-preview-window-container"
			>
				<Card
					className="max-h-[240px] overflow-hidden sm:h-full sm:max-h-none"
					contentClassName="sm:h-full sm:min-h-0"
					id="politician-preview-window-card"
				>
					{/* NOTE: `Card` wraps children in an inner div, so flex must live inside here. */}
					<div
						className="flex min-h-0 flex-col sm:h-full"
						id="politician-preview-window-card-content"
					>
						<div className="flex items-start justify-between gap-2">
							<div>
								<div className="text-[11px] font-semibold text-slate-200 sm:text-xs">
									選挙区
								</div>
								<div className="text-[10px] text-slate-400 sm:text-[11px]">
									地図で選択した選挙区の議員を表示します
								</div>
							</div>
							<Badge className="shrink-0">
								{hasDistrict ? selectedDistrict : "未選択"}
							</Badge>
						</div>

						{/* Scrollable body (keeps header visible) */}
 						<div
							className="mt-3 max-h-[160px] min-h-0 overflow-y-auto overscroll-contain pr-2 sm:max-h-none sm:flex-1"
							id="politician-preview-window-card-content-scrollable"
						>
							<div className="grid gap-3">
								<HouseSection
									title="衆議院"
									subtitle="小選挙区"
									emptyMessage={
										hasDistrict
											? "この選挙区の衆議院議員が見つかりません。"
											: "地図上で選挙区をクリックしてください。"
									}
								>
									{shugiin.map((p) => (
										<PoliticianRow
											key={`${p.name}:${p.district}:${p.kaiha}:${p.person_id}`}
											name={p.name}
											yomikata={p.yomikata}
											kaiha={p.kaiha}
											personId={p.person_id}
											meta={[
												p.district ? `選挙区: ${p.district}` : null,
												p.number_of_terms_lower
													? `衆議院 当選${p.number_of_terms_lower}回`
													: null,
												p.number_of_terms_upper
													? `参議院 当選${p.number_of_terms_upper}回`
													: null,
											]}
											onPoliticianSelect={onPoliticianSelect}
											selectedPersonId={selectedPersonId}
										/>
									))}
								</HouseSection>

								<HouseSection
									title="参議院"
									subtitle="都道府県選挙区"
									emptyMessage={
										hasDistrict
											? "この選挙区に紐づく参議院（都道府県）の議員が見つかりません。"
											: "地図上で選挙区をクリックしてください。"
									}
								>
									{sangiin.map((p) => (
										<PoliticianRow
											key={`${p.name}:${p.district}:${p.period}:${p.kaiha}:${p.person_id}`}
											name={p.name}
											yomikata={p.yomikata}
											kaiha={p.kaiha}
											personId={p.person_id}
											meta={[
												p.district ? `選挙区: ${p.district}` : null,
												p.period ? `任期: ${p.period}` : null,
											]}
											link={p.link}
											onPoliticianSelect={onPoliticianSelect}
											selectedPersonId={selectedPersonId}
										/>
									))}
								</HouseSection>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}

export default PoliticianPreviewWindow;

function HouseSection({
	title,
	subtitle,
	children,
	emptyMessage,
}: {
	title: string;
	subtitle: string;
	children: React.ReactNode;
	emptyMessage: string;
}) {
	const isEmpty =
		children === null ||
		children === undefined ||
		(Array.isArray(children) && children.length === 0);

	return (
		<div className="rounded-xl border border-white/5 bg-[#0b1220] p-2.5">
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<div className="text-[11px] font-semibold text-slate-200 sm:text-xs">
					{title}
				</div>
				<div className="text-[9px] text-slate-500 sm:text-[10px]">{subtitle}</div>
			</div>
			<div className="grid gap-2">
				{isEmpty ? (
					<EmptyState className="py-2" message={emptyMessage} />
				) : (
					children
				)}
			</div>
		</div>
	);
}

function PoliticianRow({
	name,
	yomikata,
	kaiha,
	meta,
	link,
	onPoliticianSelect,
	personId,
	selectedPersonId,
}: {
	name: string;
	yomikata?: string;
	kaiha?: string;
	meta?: Array<string | null | undefined>;
	link?: string;
	onPoliticianSelect?: (id: string) => void;
	personId?: string | null;
	selectedPersonId?: string | null;
}) {
	const metaItems = (meta ?? []).filter(Boolean) as string[];
	const isSelected = Boolean(personId && selectedPersonId && personId === selectedPersonId);

	return (
		<button
			type="button"
			onClick={() => {
				if (!onPoliticianSelect) return;
				const id = personId ?? "";
				if (!id) return;
				onPoliticianSelect(id);
			}}
			className={`w-full rounded-xl border bg-[#020617] px-2.5 py-2 text-left transition ${
				isSelected
					? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_28px_rgba(34,211,238,0.18)]"
					: "border-white/5 hover:border-cyan-300/25 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_22px_rgba(34,211,238,0.12)]"
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">
						{name}
					</div>
					{yomikata ? (
						<div className="truncate text-[10px] text-slate-400 sm:text-[11px]">
							{yomikata}
						</div>
					) : null}
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1">
					{kaiha ? <Badge className="shrink-0">{kaiha}</Badge> : null}
					{personId ? (
						<div className="max-w-[160px] truncate font-mono text-[10px] text-slate-500">
							{personId}
						</div>
					) : null}
				</div>
			</div>

			{metaItems.length > 0 ? (
				<div className="mt-1.5 space-y-0.5 text-[10px] text-slate-400 sm:text-[11px]">
					{metaItems.map((m) => (
						<div key={m} className="truncate">
							{m}
						</div>
					))}
				</div>
			) : null}

			{link ? (
				<div className="mt-1.5">
					<a
						href={link}
						target="_blank"
						rel="noreferrer"
						onClick={(e) => e.stopPropagation()}
						className="text-[10px] text-cyan-300 hover:text-cyan-200 hover:underline sm:text-[11px]"
					>
						公式ページを見る
					</a>
				</div>
			) : null}
		</button>
	);
}