
import { Link } from "react-router-dom";
import {RiGovernmentLine} from "react-icons/ri"
import {RiInformationLine} from "react-icons/ri"
import "../styles/general.css"
import "../styles/pages/landing_page.css"
function LandingPage(){
    return(
        <div className="full-page-container landing-page-container">
            <h1 className="page-title" >KOKKAI DOC</h1>
            <div className='icons-menu'>    
                <Link to="/sangiin_main">
                    <div className="menu-icon-container">
                        <RiGovernmentLine className="menu-icon"/>
                    </div>
                </Link>
                <Link to="/page_info">
                    <div className="menu-icon-container">
                        <RiInformationLine className="menu-icon"/>
                    </div>
                </Link>
            </div>



            {/* <Link to = "/wordcloud">Word Cloud</Link>
            <Link to = "/network">Network</Link> */}
            
        </div>
    );
}


export default LandingPage;