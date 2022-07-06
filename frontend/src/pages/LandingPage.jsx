
import { Link } from "react-router-dom";
import NetworkPage from "./NetworkPage"
import WordCloudPage from "./WordCloudPage";
import {RiGovernmentLine} from "react-icons/ri"
import "../styles/general.css"
import "../styles/landing_page.css"
function LandingPage(){
    return(
        <div className="full-page-container scroll-snap-container">
            <section className="page-title-container scroll-snap-element">
                <h1 className="page-title" >KOKKAI DOC</h1>
            </section>
            <section className="page-menu-container scroll-snap-element">
                <Link to="/sangiin_main">
                    <div className="menu-icon-container">
                        <RiGovernmentLine className="menu-icon"/>
                    </div>
                </Link>
            </section>


            {/* <Link to = "/wordcloud">Word Cloud</Link>
            <Link to = "/network">Network</Link> */}
            
        </div>
    );
}


export default LandingPage;