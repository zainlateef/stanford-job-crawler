const puppeteer = require('puppeteer');
const config = require('./config.json');
const stanfordCareersHomePage = "https://careersearch.stanford.edu/";
const stanfordMySubmissionsPage = "https://stanford.taleo.net//careersection/mysubmissions.ftl?lang=en";
let browser, page, context;
let jobCounter = 0;

(async function main(){
    await initializeBrowser();
    await signInToStanford();
    const keywords = config.keywords;
    for (keyword of keywords) {
        console.log("Applying for:'"+keyword+"'");
        let appliedJobsById = await getAppliedJobsById();
        await applyForAllJobs(keyword, appliedJobsById);
    }
    console.log("Program finished, "+jobCounter+" jobs applied for");
    browser.close();
})();

async function initializeBrowser() {
    browser = await puppeteer.launch({headless: false});
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();
}

async function signInToStanford() {
    //TODO: check for login errors
    await goTo(stanfordMySubmissionsPage)
    await click('#dialogTemplate-dialogForm-login-name1');
    await page.keyboard.type(config.stanford_username);
    await click('#dialogTemplate-dialogForm-login-password');
    await page.keyboard.type(config.stanford_password);
    await click('#dialogTemplate-dialogForm-login-defaultCmd');
}

async function getAppliedJobsById() {
    //Opportunity to make it more robust: click the third li in the ul id="id="et-ef-content-ftf-j_id_id81pc5"
    let appliedJobsById = new Set([]), next=true;
    await goTo(stanfordMySubmissionsPage);
    await select('[id="mySubmissionsInterface.myAppDropListSize"]', "100");
    do {
        await waitFor(3000);
        let jobIdElements = await getAllElements('span[id^="mySubmissionsInterface.ID1208.row"]');
        for (jobIdElement of jobIdElements) {
            let jobIdFullText = await getInnerText(jobIdElement);
            let jobId = jobIdFullText.replace("Job Number: ", "");
            appliedJobsById.add(jobId);
        }
        next = await appliedJobsPagination()
    }
    while(next)

    return [...appliedJobsById];
}

async function appliedJobsPagination() {
    let nextPageSelector = 'a[id="mySubmissionsInterface.pagerDivID1610.Next"]';
    const nextPageElement = await getElement(nextPageSelector);
    const hasNext = await page.evaluate(element => element.getAttribute('aria-disabled'), nextPageElement);
    if (hasNext !== "true") {
        await click(nextPageSelector);
        return true;
    }
    else
        return false;
}


async function applyForAllJobs(keyword, appliedJobsById) {
    const jobSearchURL = await searchJobs(keyword);
    const jobPostingsByURL = await getAllPostedJobs(jobSearchURL);
    for (jobPostingURL of jobPostingsByURL) {
        await applyToJob(jobPostingURL, appliedJobsById).catch(err => jobApplicationErrorHandler(err, jobPostingURL));
    }
}

async function applyToJob(jobPostingURL, appliedJobsById) {
    const jobId = await getJobId(jobPostingURL)
    if (appliedJobsById.includes(jobId))
        return;

    await goTo(jobPostingURL);
    await click("#apply_btn"); 

    //Starts at Step 3
    await select("select[id$='recruitmentSourceType']", '4'); 
    await select("select[id='recruitmentSourceDP']", '10001');
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true);
    //Step 4
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 5
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 6
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 7
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 8
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 9
    await click("input[id$='FullName']");
    await page.keyboard.type(config.full_name);
    await click("input[id$='EMailAddress']");
    await page.keyboard.type(config.email_address);
    await click("#et-ef-content-ftf-saveContinueCmdBottom",true); 
    //Step 10, final submit
    await click("#et-ef-content-ftf-submitCmdBottom",true);
    await waitFor(5000);
    console.log("applied for Job:"+jobId+" @ "+jobPostingURL);
    jobCounter++;
}

async function getJobId(jobPostingURL) {
    await goTo(jobPostingURL);
    const jobIdSpanElement = await getElement('dd.job_external_id span.field_value');
    const jobId = getInnerText(jobIdSpanElement);
    return jobId;
}

async function getAllPostedJobs(jobSearchURL) {
    //do this async on a separate page. search for jobs and apply at the same time
    //add a job on the queue, remove it from the queue once it's been applied for or if its already been applied to
    await goTo(jobSearchURL);
    let allJobLinks = [], next = true;
    let anchorSelector = 'div[id^="job_list_"] a.job_link.font_bold'
    do {
        let jobLinksOnCurrentPage = await page.$$eval(anchorSelector, anchors => [].map.call(anchors, a => a.href));
        allJobLinks = allJobLinks.concat(jobLinksOnCurrentPage);
        next = await postedJobsPagination(page.url());
    }
    while (next)

    return allJobLinks;
}

async function postedJobsPagination(currentURL) {
    let attemptURL = "";
    let pos = currentURL.indexOf("page");
    if (pos == -1) {
        attemptURL = currentURL + "/page2";
    }
    else {
        let currentPagSuffix = currentURL.substring(pos); //pageX
        let currentPageNumber = parseInt(currentPagSuffix.replace("page", "")); //X
        let nextPageSuffix = "page" + (currentPageNumber + 1).toString(); //page(X+1)
        attemptURL = currentURL.replace(currentPagSuffix, "") + nextPageSuffix;
    }
    await goTo(attemptURL);
    return page.url() == attemptURL;
}


async function searchJobs(keyword) {
    await goTo(stanfordCareersHomePage)
    await click('#keyword');
    await page.keyboard.type(keyword);
    await click('#jSearchSubmit span.btn_text');
    await page.waitForNavigation();
    return page.url();
}

async function getInnerText(element) {
    const elementInnerText = await (await element.getProperty('textContent')).jsonValue();
    return elementInnerText;
}

async function goTo(url) {
    page.url() === url ? null : await page.goto(url);
}

async function click(selector, navigation = false){
    await waitForSelector(selector);
    if(navigation)
        await waitFor();
    await page.click(selector);
}

async function select(selector, value){
    await waitForSelector(selector);
    await page.select(selector, value);
}

async function getElement(selector){
    await waitForSelector(selector);
    return await page.$(selector);
}

async function getAllElements(selector){
    await waitForSelector(selector);
    return await page.$$(selector);
}

async function waitForSelector(selector){
    await page.waitForSelector(selector);
}

async function waitFor(time = 2500) {
    await page.waitFor(time);
}

function jobApplicationErrorHandler(err, jobPostingURL){
    console.log("An error occurred while applying to:"+jobPostingURL);
    console.error(err,)
}