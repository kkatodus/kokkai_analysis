import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ManifestoService from '../../../../services/manifestoService';
import { SAMPLE_MANIFESTO } from './sample';

function ManifestoDisplay({ selectedParty }) {
	const [manifestoData, setManifestoData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	
	useEffect(() => {
		const fetchManifestoData = async () => {
			if (!selectedParty) return;
			
			setLoading(true);
			setError(null);
			
			try {
				const data = await ManifestoService.getPartyManifesto(selectedParty);
				setManifestoData(data.policies || SAMPLE_MANIFESTO);
			} catch (err) {
				console.error('Failed to fetch manifesto data:', err);
				setError(err.message);
				// Fallback to sample data on error
				setManifestoData(SAMPLE_MANIFESTO);
			} finally {
				setLoading(false);
			}
		};
		
		fetchManifestoData();
	}, [selectedParty]);

	if (loading) {
		return (
			<div className="flex-1 w-full h-full overflow-y-auto bg-gray-50 p-6">
				<div className="max-w-4xl mx-auto flex items-center justify-center h-64">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"/>
						<p className="text-gray-600">政策データを読み込み中...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 w-full h-full overflow-y-auto bg-gray-50 p-6">
			<div className="max-w-4xl mx-auto">
				<h2 className="text-2xl font-bold mb-6 text-gray-800">
					{selectedParty}の政策マニフェスト
				</h2>
				
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
				
				<div className="space-y-6">
					{manifestoData?.policies?.length > 0 ? manifestoData.policies.map((policy) => (
						<div key={policy.topic} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
							{/* Topic Header */}
							<div className="mb-4">
								<h3 className="text-xl font-semibold text-gray-900 mb-1">
									{policy.topic}
								</h3>
								<p className="text-sm text-gray-600 italic">
									{policy.topic_en}
								</p>
							</div>
							
							{/* Policy Text */}
							<div className="mb-4">
								<p className="text-gray-700 whitespace-pre-line leading-relaxed">
									{policy.text}
								</p>
							</div>
							
							{/* Summary */}
							<div className="mb-4 bg-blue-50 rounded p-4 border-l-4 border-blue-400">
								<p className="text-sm font-medium text-gray-800">
									要約
								</p>
								<p className="text-sm text-gray-700 mt-1">
									{policy.summary}
								</p>
							</div>
							
							{/* URL Link */}
							{policy.url && (
								<div className="text-right">
									<a 
										href={policy.url} 
										target="_blank" 
										rel="noopener noreferrer"
										className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
									>
										詳細を見る
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</a>
								</div>
							)}
						</div>
					)) : (
						<div className="text-center py-12">
							<p className="text-gray-500">
								{selectedParty}の政策データがありません。
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

ManifestoDisplay.propTypes = {
	selectedParty: PropTypes.string.isRequired,
};

export default ManifestoDisplay;