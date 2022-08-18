import "../styles/components/party_opinion_card.css"

function PartyOpinionCard(props) {
    var party_opinion = props.party_opinion["speech"];
    var party_name = props.party_name;
    return ( 
        <div className='party-opinion-card'>
            <h1>{party_name}</h1>
            <p>{party_opinion}</p>
        </div>
    );
}

export default PartyOpinionCard;