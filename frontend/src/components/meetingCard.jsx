function MeetingCard(props) {
    console.log("meeting", props)
    
    return ( 
    <div>
        <h1>{props.meeting_name}</h1>
    </div> );
}

export default MeetingCard;