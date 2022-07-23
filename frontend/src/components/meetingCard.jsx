import "../styles/components/meeting_card.css"
import "../styles/other/animations.css"

function MeetingCard(props) {
    console.log("meeting", props)
    
    return ( 
    <div className="meeting-card-container grow-on-hover-small">
        <h1>{props.meeting_name}</h1>
        <h2>{props.period}</h2>
    </div> );
}

export default MeetingCard;