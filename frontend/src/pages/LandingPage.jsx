
import { Routes, Route, Link } from "react-router-dom";
import Network from "./Network"
import WordCloud from "./WordCloud";
function LandingPage(){
    return(
        <div className="LandingPage">

            <Link to = "/wordcloud">Word Cloud</Link>
            <Link to = "/network">Network</Link>
            <Routes>
                <Route exact path="wordcloud" element={<WordCloud/>}/>
                <Route exact path="network" element={<Network/>}/>
            </Routes>
        </div>
    );
}
export default LandingPage;