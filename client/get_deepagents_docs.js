const https = require('https');

https.get('https://docs.langchain.com/oss/python/deepagents/overview', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => { 
    // Try to extract content blocks from NEXT_DATA
    const match = data.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (match) {
        const json = JSON.parse(match[1]);
        console.log("Found React DATA!");
    } else {
        console.log("No NEXT_DATA found");
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
