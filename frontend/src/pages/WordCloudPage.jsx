import React from 'react';
import "../styles/wordcloud.css"
const word_cloud_data = {
    "largest_size": 60,
    "words":[
        {"hamburger":20},
        {"cheeseburger":30},
        {"pizza":14},
        {"donut":22},
        {"cheesecake":34},
        {"schnitzel":60}

    ]
}

function WordCloudPage(props)  {
    return(
        <div id = "word-cloud-page">
            Some word cloud
        </div>
    )
  }

export default WordCloudPage;