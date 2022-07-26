import { Routes, Route, Link } from "react-router-dom";
import './App.css';
import LandingPage from "./pages/LandingPage"
import SangiinMainPage from "./pages/SangiinMainPage";
import MeetingDetailPage from "./pages/MeetingDetailPage";
function App() {
  return (
    <Routes>
        <Route exact path="/" element = {<LandingPage/>}/>
        <Route exact path="sangiin_main" element={<SangiinMainPage/>}/>
        <Route exact path="meeting_page/:meeting_id" element={<MeetingDetailPage/>}/>
    </Routes>
    
  );
}

export default App;
