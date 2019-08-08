const puppeteer = require('puppeteer');
const config = require('./config.json');
const stanfordCareersHomePage = "https://careersearch.stanford.edu/";
const stanfordMySubmissionsPage = "https://stanford.taleo.net//careersection/mysubmissions.ftl?lang=en";
let browser, page, context;

//MAIN
(async () => {
    await initializeBrowser();
    await signInToStanford();
    const keywords = config.keywords;
    for (keyword of keywords) {
        let appliedJobsById = await getAppliedJobsById();
        await applyForAllJobs(keyword, appliedJobsById);
    }
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
    await page.click('#dialogTemplate-dialogForm-login-name1');
    await page.keyboard.type(config.stanford_username);
    await page.click('#dialogTemplate-dialogForm-login-password');
    await page.keyboard.type(config.stanford_password);
    await page.click('#dialogTemplate-dialogForm-login-defaultCmd');
}

async function getAppliedJobsById() {
    //TODO: account for drafts
    let appliedJobsById = [];
    await goTo(stanfordMySubmissionsPage);
    await page.select('[id="mySubmissionsInterface.myAppDropListSize"]', "100");
    do {
        let jobIdElements = await page.$$('span[id^="mySubmissionsInterface.ID1208.row"]');
        for (jobIdElement of jobIdElements) {
            let jobIdFullText = await getInnerText(jobIdElement);
            let jobId = jobIdFullText.replace("Job Number: ", "");
            appliedJobsById.push(jobId);
        }

    }
    while (await appliedJobsPagination())

    return appliedJobsById;
}

async function appliedJobsPagination() {
    let nextPageSelector = 'a[id="mySubmissionsInterface.pagerDivID1610.Next"]';
    await page.waitFor(3000);
    const nextPageElement = await page.$(nextPageSelector);
    const hasNext = await page.evaluate(element => element.getAttribute('aria-disabled'), nextPageElement);
    if (hasNext !== "true") {
        await page.click(nextPageSelector);
        return true;
    }
    else
        return false;
}


async function applyForAllJobs(keyword, appliedJobsById) {
    const jobSearchURL = await searchJobs(keyword);
    const jobPostingsByURL = await getAllPostedJobs(jobSearchURL);
    for (jobPostingURL of jobPostingsByURL) {
        await applyToJob(jobPostingURL, appliedJobsById);
    }
}

async function applyToJob(jobPostingURL, appliedJobsById) {
    const jobId = await getJobId(jobPostingURL)
    if (appliedJobsById.includes(jobId))
        return;

    await goTo(jobPostingURL);
    await page.click("#apply_btn"); await waitFor(3000);
    //Portal starts on step 3
    await page.select("select[id$='recruitmentSourceType']", '4'); await waitFor();
    await page.select("select[id='recruitmentSourceDP']", '10001'); await waitFor();
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 4
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 5
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 6
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 7
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 8
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Step 9
    await page.click("input[id$='FullName']");
    await page.keyboard.type(config.fullName);
    await page.click("input[id$='EMailAddress']");
    await page.keyboard.type(config.emailAddress);
    await page.click("#et-ef-content-ftf-saveContinueCmdBottom"); await waitFor();
    //Final step, submit button
    await page.click("#et-ef-content-ftf-submitCmdBottom");
}

async function getJobId(jobPostingURL) {
    await goTo(jobPostingURL);
    const jobIdSpanElement = await page.$('dd.job_external_id span.field_value');
    const jobId = getInnerText(jobIdSpanElement);
    return jobId;
}

async function getAllPostedJobs(jobSearchURL) {
    await goTo(jobSearchURL);
    let allJobLinks = [];
    let anchorSelector = 'div[id^="job_list_"] a.job_link.font_bold'
    do {
        let jobLinksOnCurrentPage = await page.$$eval(anchorSelector, anchors => [].map.call(anchors, a => a.href));
        allJobLinks = allJobLinks.concat(jobLinksOnCurrentPage);
    }
    while (await postedJobsPagination(page.url()))

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
    await page.click('#keyword');
    await page.keyboard.type(keyword);
    await page.click('#jSearchSubmit span.btn_text');
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

async function waitFor(time = 1500) {
    await page.waitFor(time);
}