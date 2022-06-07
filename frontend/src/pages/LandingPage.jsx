
import { Link } from "react-router-dom";
import NetworkPage from "./NetworkPage"
import WordCloudPage from "./WordCloudPage";
function LandingPage(){
    return(
        <div className="landing-page">
            Landing Page

            <Link to = "/wordcloud">Word Cloud</Link>
            <Link to = "/network">Network</Link>
            
        </div>
    );
}
export default LandingPage;