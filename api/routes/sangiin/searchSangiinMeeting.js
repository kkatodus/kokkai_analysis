import { SANGIIN_DATA_DIR } from "./constants.js";
import { readdirSync, readFileSync } from "fs";

var voting_results_dir_path = SANGIIN_DATA_DIR + "voting_results/";
var sangiin_meeting_vote_results_files = readdirSync(voting_results_dir_path);

var meeting_names = {"meetings":[]}
var sangiin_meeting_vote_results = {}
sangiin_meeting_vote_results_files.forEach(filename=>{
    var meeting_name = filename.substring(0, filename.length-5);
    var one_sangiin_meeting_vote_data = readFileSync(voting_results_dir_path + filename);
    var one_sangiin_meeting_vote_json = JSON.parse(one_sangiin_meeting_vote_data);
    var meeting_period = one_sangiin_meeting_vote_json["period"]
    var one_meeting_name = {"meeting_name":meeting_name, "period":meeting_period}
    meeting_names["meetings"].push(one_meeting_name)
    sangiin_meeting_vote_results[meeting_name] = one_sangiin_meeting_vote_json;
})

export function getMeetingNames(request, response){
	response.json(meeting_names);
}

export function searchSangiinMeeting(request, response){
    var meeting_name = request.params.meeting_name;

    if(sangiin_meeting_vote_results[meeting_name]){
        var reply = sangiin_meeting_vote_results[meeting_name]
    }else{
        var reply = {
            status:"Not found"
        }
    }
    response.json(reply);
}