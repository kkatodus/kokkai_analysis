import {readdirSync, readFileSync} from 'fs';
import {SANGIIN_DATA_DIR} from './constants.js';

var party_opinions_dir_path = SANGIIN_DATA_DIR + "party_opinions/";
var party_opinions_files = readdirSync(party_opinions_dir_path);

var sangiin_party_opinion_results = {}
party_opinions_files.forEach(filename=>{
    var meeting_name = filename.substring(0, filename.length-5);
    var one_sangiin_party_opinion_data = readFileSync(party_opinions_dir_path + filename);
    var one_sangiin_party_opinion_json = JSON.parse(one_sangiin_party_opinion_data);
    sangiin_party_opinion_results[meeting_name] = one_sangiin_party_opinion_json;
})

export function searchSangiinPartyOpinion(request, response){
    var meeting_name = request.params.meeting_name;
    var topic_name = request.params.topic_name;

    if(sangiin_party_opinion_results[meeting_name]){
        var reply = sangiin_party_opinion_results[meeting_name][topic_name]
    }else{
        var reply = {
            status:"Not found"
        }
    }
    response.json(reply);
}