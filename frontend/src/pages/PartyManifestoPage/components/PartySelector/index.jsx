import React from 'react';
import PropTypes from 'prop-types';

// Tailwind color to hex mapping
const TAILWIND_COLORS = {
	'red-600': '#dc2626',
	'red-500': '#ef4444',
	'blue-600': '#2563eb',
	'blue-500': '#3b82f6',
	'green-600': '#16a34a',
	'green-500': '#22c55e',
	'yellow-500': '#eab308',
	'purple-600': '#9333ea',
	'orange-600': '#ea580c',
	'pink-600': '#db2777',
	'amber-700': '#b45309',
	'gray-600': '#4b5563',
	'gray-900': '#111827',
	'teal-600': '#0891b2',
	'lime-600': '#65a30d',
	'cyan-600': '#0891b2',
};

function PartySelector({ availableParties, partyColors, selectedParty, setSelectedParty }) {
	
	// Function to get the background color
	const getBackgroundColor = (party) => {
		const colorClass = partyColors[party];
		return TAILWIND_COLORS[colorClass] || '#6b7280'; // Default to gray if not found
	};
	
	return <div className="h-[50px] w-[100%] flex flex-row overflow-x-scroll">
		{availableParties.map((party) => (
			<button 
				type="button" 
				key={party} 
				style={{ backgroundColor: getBackgroundColor(party) }}
				className={`h-[50px] whitespace-nowrap mx-1 rounded-t-lg px-2 text-white hover:opacity-80 transition-opacity ${selectedParty === party ? 'ring-2 ring-offset-2 ring-gray-900' : ''}`} 
				onClick={() => setSelectedParty(party)}
			>
				{party}
			</button>
		))}
	</div>;
}

PartySelector.propTypes = {
	partyColors: PropTypes.objectOf(PropTypes.string).isRequired,
	availableParties: PropTypes.arrayOf(PropTypes.string).isRequired,
	selectedParty: PropTypes.string.isRequired,
	setSelectedParty: PropTypes.func.isRequired,
};



export default PartySelector;