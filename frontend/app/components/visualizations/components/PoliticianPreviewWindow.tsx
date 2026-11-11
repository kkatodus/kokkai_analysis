import type { SangiinPolitician, ShugiinPolitician } from "@/app/types";
import { Badge } from "@/app/components/shared/Badge";
import { Card, Heading } from "@/app/components/shared/Card";
import { Empty } from "@/app/components/shared/states";
import { selectedClass } from "@/app/components/shared/Chip";
import { cx } from "@/app/components/shared/cx";

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
								<Heading level={3}>選挙区</Heading>
								<p className="text-body-sm text-ink-muted">地図で選択した選挙区の議員を表示します</p>
							</div>
							<Badge className="shrink-0" tone={hasDistrict ? "accent" : "neutral"}>
								{hasDistrict ? selectedDistrict : "未選択"}
							</Badge>
						</div>

						{/* Scrollable body (keeps header visible) */}
 						<div
							className="mt-3 max-h-[160px] min-h-0 overflow-y-auto overscroll-contain pr-2 sm:max-h-none sm:flex-1"
							id="politician-preview-window-card-content-scrollable"
						>
							<div className="grid gap-4">
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
												p.district ? `選挙区：${p.district}` : null,
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
											? "この都道府県選出の参議院議員が見つかりません。"
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
												p.district ? `選挙区：${p.district}` : null,
												p.period ? `任期：${p.period}` : null,
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
		<section>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<p className="text-title-sm text-ink-strong">{title}</p>
				<p className="text-caption text-ink-muted">{subtitle}</p>
			</div>
			<div className="grid gap-2">
				{isEmpty ? <Empty className="py-2" message={emptyMessage} /> : children}
			</div>
		</section>
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
		<div
			className={cx(
				"rounded-lg border transition-colors duration-150",
				isSelected ? cx(selectedClass, "edge-primary") : "border-line bg-surface-raised hover:bg-surface-hover",
			)}
		>
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={() => {
					if (!onPoliticianSelect) return;
					const id = personId ?? "";
					if (!id) return;
					onPoliticianSelect(id);
				}}
				className="w-full rounded-lg px-3 pt-2 pb-2 text-left"
			>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className={cx("truncate text-title-sm", isSelected ? "text-on-primary-soft" : "text-ink-strong")}>{name}</div>
						{yomikata ? <div className="truncate text-caption text-ink-muted">{yomikata}</div> : null}
					</div>
					{kaiha ? <Badge className="shrink-0">{kaiha}</Badge> : null}
				</div>

				{metaItems.length > 0 ? (
					<div className="mt-1 space-y-0.5 text-caption text-ink-muted">
						{metaItems.map((m) => (
							<div key={m} className="truncate">
								{m}
							</div>
						))}
					</div>
				) : null}
			</button>

			{link ? (
				<div className="px-3 pb-2">
					<a href={link} target="_blank" rel="noreferrer" className="text-caption text-link underline underline-offset-2">
						公式ページを見る
					</a>
				</div>
			) : null}
		</div>
	);
}
