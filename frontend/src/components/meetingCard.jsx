import "../styles/components/meeting_card.css"
import "../styles/other/animations.css"
import { Link } from "react-router-dom"
function MeetingCard(props) {
    
    return ( 
    <Link to={"/meeting_page/"+props.meeting_name}>
        <div className="meeting-card-container grow-on-hover-small">
            <h1>{props.meeting_name}</h1>
            <h2>{props.period}</h2>
        </div>
    </Link> );
}

export default MeetingCard;