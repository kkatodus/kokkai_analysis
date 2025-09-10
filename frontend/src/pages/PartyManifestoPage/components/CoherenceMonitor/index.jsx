import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ManifestoService from '../../../../services/manifestoService';
import { SAMPLE_COHERENCE_MONITOR } from './sample';

function CoherenceMonitor({ selectedParty }) {
	const [expandedIndex, setExpandedIndex] = useState(null);
	const [expandedInvestigation, setExpandedInvestigation] = useState({});
	const [contradictions, setContradictions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	
	useEffect(() => {
		const fetchCoherenceData = async () => {
			if (!selectedParty) return;
			
			setLoading(true);
			setError(null);
			setExpandedIndex(null); // Reset expanded state when changing parties
			setExpandedInvestigation({}); // Reset expanded investigations
			
			try {
				const data = await ManifestoService.getPartyManifesto(selectedParty);
				setContradictions(data.coherence || SAMPLE_COHERENCE_MONITOR);
			} catch (err) {
				console.error('Failed to fetch coherence data:', err);
				setError(err.message);
				// Fallback to sample data on error
				setContradictions(SAMPLE_COHERENCE_MONITOR);
			} finally {
				setLoading(false);
			}
		};
		
		fetchCoherenceData();
	}, [selectedParty]);

	const toggleExpand = (index) => {
		setExpandedIndex(expandedIndex === index ? null : index);
	};
	
	const toggleInvestigation = (index, llm) => {
		const key = `${index}-${llm}`;
		setExpandedInvestigation(prev => ({
			...prev,
			[key]: !prev[key]
		}));
	};
	
	const getAgreementClass = (agreement) => {
		if (!agreement) return 'bg-gray-100 text-gray-800';
		const lowerAgreement = agreement.toLowerCase();
		if (lowerAgreement.includes('agree') && !lowerAgreement.includes('disagree')) return 'bg-green-100 text-green-800';
		if (lowerAgreement.includes('disagree')) return 'bg-red-100 text-red-800';
		if (lowerAgreement.includes('neutral')) return 'bg-yellow-100 text-yellow-800';
		return 'bg-gray-100 text-gray-800';
	};
	
	const getAgreementIcon = (agreement) => {
		if (!agreement) return '❓';
		const lowerAgreement = agreement.toLowerCase();
		if (lowerAgreement.includes('agree') && !lowerAgreement.includes('disagree')) return '✅';
		if (lowerAgreement.includes('disagree')) return '❌';
		if (lowerAgreement.includes('neutral')) return '⚠️';
		return '❓';
	};

	if (loading) {
		return (
			<div className="flex-1 w-full h-full overflow-y-auto bg-slate-100">
				{/* Header Section */}
				<div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 shadow-md">
					<h2 className="text-xl font-bold flex items-center gap-2">
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						政策間の整合性チェック（ベータ版）
					</h2>
				</div>
				
				<div className="p-6">
					<div className="max-w-4xl mx-auto flex items-center justify-center h-64">
						<div className="text-center">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"/>
							<p className="text-gray-600">整合性データを読み込み中...</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 w-full h-full overflow-y-auto bg-slate-100">
			{/* Header Section */}
			<div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 shadow-md">
				<h2 className="text-xl font-bold flex items-center gap-2">
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					政策間の整合性チェック（ベータ版）
				</h2>
			</div>
			
			<div className="p-6">
				<div className="max-w-4xl mx-auto">
				
				<div className="mb-4 bg-yellow-50 rounded p-4 border-l-4 border-yellow-400">
					<p className="text-sm text-gray-700">
						以下は{selectedParty}の政策間で矛盾または同時実施が困難と判定された組み合わせです。
					</p>
				</div>
				
				{error && (
					<div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<div className="flex items-center">
							<svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<p className="text-sm text-yellow-800">
								{error} (サンプルデータを表示しています)
							</p>
						</div>
					</div>
				)}
				
				<div className="space-y-4">
					{contradictions.length > 0 ? contradictions.map((contradiction, index) => (
						// eslint-disable-next-line react/no-array-index-key
						<div key={index} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
							{/* Header - Always visible */}
							<button
								className="p-6 cursor-pointer"
								type="button"
								onClick={() => toggleExpand(index)}
							>
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-lg font-semibold text-red-700">
										矛盾の可能性が検出されました
									</h3>
									<button type="button" className="text-gray-500 hover:text-gray-700">
										{expandedIndex === index ? (
											<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
											</svg>
										) : (
											<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
											</svg>
										)}
									</button>
								</div>
								
								{/* Policy Topics */}
								<div className="grid md:grid-cols-2 gap-4">
									<div className="bg-red-50 rounded p-3 border-l-4 border-red-400">
										<p className="text-sm font-medium text-gray-700 mb-1">政策1:</p>
										<p className="text-sm text-gray-900 font-semibold">
											{contradiction.policy1.topic}
										</p>
									</div>
									<div className="bg-red-50 rounded p-3 border-l-4 border-red-400">
										<p className="text-sm font-medium text-gray-700 mb-1">政策2:</p>
										<p className="text-sm text-gray-900 font-semibold">
											{contradiction.policy2.topic}
										</p>
									</div>
								</div>
								
								{/* Reason Summary */}
								<div className="mt-4 bg-gray-50 rounded p-3">
									<p className="text-sm text-gray-700 line-clamp-2">
										{contradiction.reason}
									</p>
								</div>
								
								{/* AI Agreement Summary */}
								{(contradiction.o3_investigation || contradiction['gemini-2.5-pro_investigation']) && (
									<div className="mt-2 space-y-2">
										<div className="flex items-center gap-2 text-xs">
											<span className="text-gray-600">AI検証:</span>
											{contradiction.o3_investigation?.reply && (
												<span className="flex items-center gap-1">
													{getAgreementIcon(contradiction.o3_investigation.reply.split('：')[1]?.split('\n')[0])}
													<span className="text-gray-500">O3</span>
												</span>
											)}
											{contradiction['gemini-2.5-pro_investigation']?.reply && (
												<span className="flex items-center gap-1">
													{getAgreementIcon(contradiction['gemini-2.5-pro_investigation'].reply.split('：')[1]?.split('\n')[0])}
													<span className="text-gray-500">Gemini</span>
												</span>
											)}
										</div>
										<div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
											<div className="space-y-1">
												<div>✅ 矛盾あり: AIモデルが初期判定に同意し、政策間の矛盾を認める</div>
												<div>⚠️ 中立: AIモデルが判断を保留、または条件付きで矛盾を認める</div>
												<div>❌ 矛盾なし: AIモデルが初期判定に反対し、政策間の矛盾を否定する</div>
											</div>
										</div>
									</div>
								)}
							</button>
							
							{/* Expanded Details */}
							{expandedIndex === index && (
								<div className="border-t px-6 pb-6">
									<div className="mt-6 space-y-6">
										{/* Policy 1 Details */}
										<div>
											<h4 className="font-semibold text-gray-900 mb-2">
												政策1: {contradiction.policy1.topic}
											</h4>
											<p className="text-sm text-gray-600 italic mb-2">
												{contradiction.policy1.topic_en}
											</p>
											<p className="text-sm text-gray-700 whitespace-pre-line mb-3">
												{contradiction.policy1.text}
											</p>
											<div className="bg-blue-50 rounded p-3 border-l-4 border-blue-400">
												<p className="text-sm font-medium text-gray-800">要約</p>
												<p className="text-sm text-gray-700 mt-1">
													{contradiction.policy1.summary}
												</p>
											</div>
										</div>
										
										{/* Policy 2 Details */}
										<div>
											<h4 className="font-semibold text-gray-900 mb-2">
												政策2: {contradiction.policy2.topic}
											</h4>
											<p className="text-sm text-gray-600 italic mb-2">
												{contradiction.policy2.topic_en}
											</p>
											<p className="text-sm text-gray-700 whitespace-pre-line mb-3">
												{contradiction.policy2.text}
											</p>
											<div className="bg-blue-50 rounded p-3 border-l-4 border-blue-400">
												<p className="text-sm font-medium text-gray-800">要約</p>
												<p className="text-sm text-gray-700 mt-1">
													{contradiction.policy2.summary}
												</p>
											</div>
										</div>
										
										{/* Full Reason */}
										<div className="bg-yellow-50 rounded p-4 border-l-4 border-yellow-600">
											<p className="text-sm font-medium text-gray-800 mb-2">
												矛盾の詳細な理由
											</p>
											<p className="text-sm text-gray-700">
												{contradiction.reason}
											</p>
										</div>
										
										{/* LLM Investigation Results */}
										{(contradiction.o3_investigation || contradiction['gemini-2.5-pro_investigation']) && (
											<div className="mt-6 space-y-4">
												<h4 className="font-semibold text-gray-800">AI専門家による検証結果</h4>
												
												{/* O3 Investigation */}
												{contradiction.o3_investigation && (
													<div className="border rounded-lg p-4 bg-gray-50">
														<div className="flex items-center justify-between mb-2">
															<div className="flex items-center gap-2">
																<span className="font-medium">O3モデル</span>
																{contradiction.o3_investigation.reply && (() => {
																	const agreement = contradiction.o3_investigation.reply.split('：')[1]?.split('\n')[0];
																	return (
																		<span className={`px-2 py-1 rounded text-xs font-medium ${getAgreementClass(agreement)}`}>
																			{getAgreementIcon(agreement)} {agreement}
																		</span>
																	);
																})()}
															</div>
															<button 
																type="button"
																onClick={() => toggleInvestigation(index, 'o3')}
																className="text-gray-500 hover:text-gray-700"
															>
																{expandedInvestigation[`${index}-o3`] ? (
																	<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
																	</svg>
																) : (
																	<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
																	</svg>
																)}
															</button>
														</div>
														{expandedInvestigation[`${index}-o3`] && contradiction.o3_investigation.reply && (
															<div className="text-sm text-gray-700 whitespace-pre-line">
																{contradiction.o3_investigation.reply.split('REASON：')[1]}
																{contradiction.o3_investigation.annotations?.length > 0 && (
																	<div className="mt-4">
																		<p className="font-medium mb-2">参照資料:</p>
																		<ul className="list-disc list-inside space-y-1">
																			{contradiction.o3_investigation.annotations.map((annotation, idx) => (
																				// eslint-disable-next-line react/no-array-index-key
																				<li key={idx} className="text-xs">
																					{typeof annotation === 'object' ? annotation.title || annotation.text || JSON.stringify(annotation) : annotation}
																				</li>
																			))}
																		</ul>
																	</div>
																)}
															</div>
														)}
													</div>
												)}
												
												{/* Gemini Investigation */}
												{contradiction['gemini-2.5-pro_investigation'] && (
													<div className="border rounded-lg p-4 bg-gray-50">
														<div className="flex items-center justify-between mb-2">
															<div className="flex items-center gap-2">
																<span className="font-medium">Gemini 2.5 Proモデル</span>
																{contradiction['gemini-2.5-pro_investigation'].reply && (() => {
																	const agreement = contradiction['gemini-2.5-pro_investigation'].reply.split('：')[1]?.split('\n')[0];
																	return (
																		<span className={`px-2 py-1 rounded text-xs font-medium ${getAgreementClass(agreement)}`}>
																			{getAgreementIcon(agreement)} {agreement}
																		</span>
																	);
																})()}
															</div>
															<button 
																type="button"
																onClick={() => toggleInvestigation(index, 'gemini')}
																className="text-gray-500 hover:text-gray-700"
															>
																{expandedInvestigation[`${index}-gemini`] ? (
																	<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
																	</svg>
																) : (
																	<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
																	</svg>
																)}
															</button>
														</div>
														{expandedInvestigation[`${index}-gemini`] && contradiction['gemini-2.5-pro_investigation'].reply && (
															<div className="text-sm text-gray-700 whitespace-pre-line">
																{contradiction['gemini-2.5-pro_investigation'].reply.split('REASON：')[1]}
																{contradiction['gemini-2.5-pro_investigation'].sorted_supports?.length > 0 && (
																	<div className="mt-4">
																		<p className="font-medium mb-2">参照資料:</p>
																		<ul className="list-disc list-inside space-y-1">
																			{contradiction['gemini-2.5-pro_investigation'].sorted_supports.map((support, idx) => (
																				// eslint-disable-next-line react/no-array-index-key
																				<li key={idx} className="text-xs italic">
																					{typeof support === 'object' ? support.text || support.title || JSON.stringify(support) : support}
																				</li>
																			))}
																		</ul>
																	</div>
																)}
																{contradiction['gemini-2.5-pro_investigation'].chunks?.length > 0 && (
																	<div className="mt-4">
																		<p className="font-medium mb-2">参照元URL:</p>
																		<div className="space-y-1">
																			{contradiction['gemini-2.5-pro_investigation'].chunks.map((chunk, idx) => (
																				<a 
																				// eslint-disable-next-line react/no-array-index-key
																					key={idx}
																					href={chunk.uri}
																					target="_blank"
																					rel="noopener noreferrer"
																					className="text-xs text-blue-600 hover:text-blue-800 hover:underline block truncate"
																				>
																					{chunk.title || chunk.uri}
																				</a>
																			))}
																		</div>
																	</div>
																)}
															</div>
														)}
													</div>
												)}
											</div>
										)}
										
										{/* Meta Information */}
										<div className="flex justify-between items-center text-xs text-gray-500 mt-4">
											<span>初回検出: {contradiction.flagged_by}</span>
											<div className="space-x-4">
												{contradiction.policy1.url && (
													<a 
														href={contradiction.policy1.url} 
														target="_blank" 
														rel="noopener noreferrer"
														className="text-blue-600 hover:text-blue-800 hover:underline"
													>
														政策1の詳細
													</a>
												)}
												{contradiction.policy2.url && (
													<a 
														href={contradiction.policy2.url} 
														target="_blank" 
														rel="noopener noreferrer"
														className="text-blue-600 hover:text-blue-800 hover:underline"
													>
														政策2の詳細
													</a>
												)}
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					)) : (
						<div className="bg-green-50 rounded-lg p-8 text-center">
							<p className="text-green-700">
								現在、{selectedParty}について矛盾する政策は検出されていません。
							</p>
						</div>
					)}
				</div>
				</div>
			</div>
		</div>
	);
}

CoherenceMonitor.propTypes = {
	selectedParty: PropTypes.string.isRequired,
};

export default CoherenceMonitor;