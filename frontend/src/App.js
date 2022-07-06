import { Routes, Route, Link } from "react-router-dom";
import './App.css';
import LandingPage from "./pages/LandingPage"
import SangiinMainPage from "./pages/SangiinMainPage";
import WordCloudPage from './pages/WordCloudPage';
import NetworkPage from './pages/NetworkPage';
function App() {
  return (
    <Routes>
        <Route exact path="/" element = {<LandingPage/>}/>
        <Route exact path="sangiin_main" element={<SangiinMainPage/>}/>
        <Route exact path="network" element={<NetworkPage/>}/>
    </Routes>
    
  );
}

export default App;
