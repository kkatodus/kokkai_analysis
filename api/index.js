
var fs = require("fs")
const express = require("express");
const app = express();

const cors = require("cors");

app.listen(process.env.PORT, ()=>console.log("Server Start at the Port", process.env.PORT))

app.use(express.static("public"));
app.use(cors());


//endpoint for api guide
var api_guide = {
    "vote results":"sangiin_meeting_votes/:meeting_name",
    "party opinions":"sangiin_party_opinions/:meeting_name/:topic_name"
}

app.get("",(request, response)=>{response.send(api_guide)})

var voting_results_dir_path = "./data_sangiin/voting_results/";
var sangiin_meeting_vote_results_files = fs.readdirSync(voting_results_dir_path);

var meeting_names = {"meetings":[]}
var sangiin_meeting_vote_results = {}
sangiin_meeting_vote_results_files.forEach(filename=>{
    var meeting_name = filename.substring(0, filename.length-5);
    var one_sangiin_meeting_vote_data = fs.readFileSync(voting_results_dir_path + filename);
    var one_sangiin_meeting_vote_json = JSON.parse(one_sangiin_meeting_vote_data);
    var meeting_period = one_sangiin_meeting_vote_json["period"]
    console.log("meeting_period",meeting_period)
    var one_meeting_name = {"meeting_name":meeting_name, "period":meeting_period}
    meeting_names["meetings"].push(one_meeting_name)
    sangiin_meeting_vote_results[meeting_name] = one_sangiin_meeting_vote_json;
})

function searchSangiinMeeting(request, response){
    var meeting_name = request.params.meeting_name;

    if(sangiin_meeting_vote_results[meeting_name]){
        var reply = sangiin_meeting_vote_results[meeting_name]
    }else{
        var reply = {
            status:"Not found"
        }
    }
    response.send(reply);
}
//endpoint for returning the meeting names available
app.get('/meeting_names', (request, response)=>{response.send(meeting_names)})
//endpoint for voting results per meeting
app.get('/sangiin_meeting_votes/:meeting_name', searchSangiinMeeting);


//endpoint for returning the party opinions for one topic
var party_opinions_dir_path = "./data_sangiin/party_opinions/";
var party_opinions_files = fs.readdirSync(party_opinions_dir_path);

var sangiin_party_opinion_results = {}
party_opinions_files.forEach(filename=>{
    var meeting_name = filename.substring(0, filename.length-5);
    var one_sangiin_party_opinion_data = fs.readFileSync(party_opinions_dir_path + filename);
    var one_sangiin_party_opinion_json = JSON.parse(one_sangiin_party_opinion_data);
    sangiin_party_opinion_results[meeting_name] = one_sangiin_party_opinion_json;
})

function searchSangiinPartyOpinion(request, response){
    var meeting_name = request.params.meeting_name;
    var topic_name = request.params.topic_name;

    if(sangiin_party_opinion_results[meeting_name]){
        var reply = sangiin_party_opinion_results[meeting_name][topic_name]
    }else{
        var reply = {
            status:"Not found"
        }
    }
    response.send(reply);
}

app.get('/sangiin_party_opinions/:meeting_name/:topic_name', searchSangiinPartyOpinion);
