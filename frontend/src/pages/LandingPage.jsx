
import { Link } from "react-router-dom";
import NetworkPage from "./NetworkPage"
import WordCloudPage from "./WordCloudPage";
import "../styles/general.css"
import "../styles/landing_page.css"
function LandingPage(){
    return(
        <div className="full-page-container">
            <div className="page-title-container">
                <h1 className="page-title" >KOKKAI DOC</h1>
            </div>
            <div className="page-menu-container">

            </div>


            {/* <Link to = "/wordcloud">Word Cloud</Link>
            <Link to = "/network">Network</Link> */}
            
        </div>
    );
}
export default LandingPage;