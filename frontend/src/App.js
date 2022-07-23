import { Routes, Route, Link } from "react-router-dom";
import './App.css';
import LandingPage from "./pages/LandingPage"
import SangiinMainPage from "./pages/SangiinMainPage";
function App() {
  return (
    <Routes>
        <Route exact path="/" element = {<LandingPage/>}/>
        <Route exact path="sangiin_main" element={<SangiinMainPage/>}/>
    </Routes>
    
  );
}

export default App;
