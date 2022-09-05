import { useEffect, useState } from "react";
import {Link} from "react-router-dom";
import {MdOutlineArrowBack} from "react-icons/md"

import { sangiin_endpoint } from "../resource/resources"

import "../styles/sanitize.css"
import "../styles/general.css"

import MeetingCard from "../components/meetingCard";


function SangiinMainPage() {
    const [meeting_names, setMeetingNames] = useState([])
    var [isloading, setIsLoading] = useState(true)
    var [meeting_name_cards, setCards] = useState("")

    useEffect(() => {
        //gets called on mount of the component

        const fetchMeetingNames = async () => {
            const meeting_names_data = await fetch(sangiin_endpoint + "meeting_names")
            const meeting_names_json = await meeting_names_data.json()
            setMeetingNames(meeting_names_json["meetings"])
        }
        //get the meetings if the array is empty in store
        setIsLoading(true)
        fetchMeetingNames()
            .catch(() => {
                console.error()
                setIsLoading(true)
        })
    }, [])

    useEffect(()=>{
        if (meeting_names.length === 0){
            setIsLoading(true)
        }else{
            setIsLoading(false)
            var cards = meeting_names.map(meeting_name => {
                return (
                    <MeetingCard key={meeting_name["meeting_name"]} {...meeting_name} />
                )
            })
            setCards(cards)
        }

    },[meeting_names])
    return (
        <div className="full-page-container">
            <div className="header-section ">
                <Link className="back-icon" to="/">
                    <MdOutlineArrowBack/>
                </Link>
                <h1>参議院</h1>

            </div>
            <div className="content-section">
                {isloading?<h1>Loading</h1>:meeting_name_cards}

            </div>
        </div>
    );
}

export default SangiinMainPage;