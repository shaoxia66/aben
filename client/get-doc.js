const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://docs.langchain.com/oss/python/deepagents/overview');
    
    await page.waitForSelector('article');
    
    // Attempt to extract the article innerText
    const content = await page.evaluate(() => {
        return document.querySelector('article')?.innerText || document.body.innerText;
    });

    console.log(content);
    await browser.close();
})();
