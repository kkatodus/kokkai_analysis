import { Routes, Route, Link } from "react-router-dom";
import './App.css';
import LandingPage from "./pages/LandingPage"
import WordCloudPage from './pages/WordCloudPage';
import NetworkPage from './pages/NetworkPage';
function App() {
  return (
    <div>
      <Routes>
          <Route exact path="/" element = {<LandingPage/>}/>
          <Route exact path="wordcloud" element={<WordCloudPage/>}/>
          <Route exact path="network" element={<NetworkPage/>}/>
      </Routes>
    </div>
    
  );
}

export default App;
