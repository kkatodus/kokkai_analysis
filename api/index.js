var fs = require("fs");

var sangiin_meeting_data = fs.readFileSync("data\\sangiin_meeting_vote_results.json")

var sangiin_meeting_data_json = JSON.parse(sangiin_meeting_data);

const express = require("express");
const app = express();

const cors = require("cors");

app.listen(process.env.PORT, ()=>console.log("Server Start at the Port"))


app.use(express.static("public"));
app.use(cors());

app.get('/sangiin_meeting_votes/:meeting_name', searchSangiinMeeting);

function searchSangiinMeeting(request, response){
    var meeting_name = request.params.meeting_name;

    if(sangiin_meeting_data_json[meeting_name]){
        var reply = sangiin_meeting_data_json[meeting_name]
    }else{
        var reply = {
            status:"Not found"
        }
    }
    response.send(reply);

}


