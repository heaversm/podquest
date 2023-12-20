//import puppeteer
import puppeteer from 'puppeteer';

async function muiSelectOption(page, buttonSelector, optionValue) {
  let liComponent;
  let selectorSubstr = buttonSelector.substring(1); // Remove the leading '#' or '.'
  if (optionValue) {
    liComponent = `li[data-value="${optionValue}"]`;
  } else {
    liComponent = 'li:first-child';
  }
  await page.waitForSelector(buttonSelector);
  await page.$eval(buttonSelector, (el) => {
    const event = new MouseEvent('mousedown');
    event.initEvent('mousedown', true, true);
    return el.dispatchEvent(event);
  });
  const liSelector = `ul[aria-labelledby="${selectorSubstr}Label"] ${liComponent}`;
  await page.waitForSelector(liSelector);
  await page.$eval(liSelector, (e) => e.click());
}

async function fillForm(data) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  for (const item of data) {
    // await page.goto('https://podquest-ad0401ffdcd5.herokuapp.com/'); // Replace with your webpage URL
    await page.goto('http://localhost:3000/'); // Replace with your webpage URL

    // Click the first "Select" button
    await page.click(
      '.mode-select-card:first-child .mode-select-button'
    ); // Replace with the correct selector

    await page.focus('input#podcast');

    // Populate the "Name" field
    await page.type('input#podcast', item.podcastName); // Replace with the correct selector

    await page.click('button#submitPodcastName');

    await page.waitForSelector('#selectPodcast', { timeout: 5000 }); // Adjust selector and timeout as needed

    // await page.click('#selectPodcast');
    try {
      await muiSelectOption(page, '#selectPodcast');
      console.log(`first selectPodcast option selected`);
    } catch (error) {
      console.log(`selectPodcast Not Found`);
      continue;
    }

    try {
      await page.waitForSelector('#selectEpisode', { timeout: 5000 }); // Adjust selector and timeout as needed
    } catch {
      console.log(`can't find selectEpisode dropdown`);
      continue; // Skip to the next item if no results
    }

    try {
      await muiSelectOption(page, '#selectEpisode');
      console.log(`first selectEpisode option selected`);
    } catch {
      console.log(`can't find selectEpisode dropdown`);
      continue; // Skip to the next item if no results
    }

    // await page.waitForTimeout(5000);

    // Wait for the query form to appear
    // MH TODO: not working for some reason
    try {
      await page.waitForSelector('input[name="query"]', {
        timeout: 120000,
      }); //this can take a long time if your episode transcription runs long
      console.log('query form available');
    } catch {
      console.log(
        `can't find query form - maybe episode not yet transcribed?`
      );
      continue;
    }

    try {
      await page.waitForSelector('.download-transcript-button');
    } catch {
      console.log(`can't find download-transcript-button`);
      continue;
    }

    await page.click('.download-transcript-button');

    // Click the "PodQuest" link to go back to the home page
    await page.click('a#podquestHomeLink');
  }

  // await browser.close();
}

// Sample data array
const data = [
  {
    podcastName: 'Hard Fork',
  },
  {
    podcastName: 'Digital Futures Told',
  },
  // Add more items here
];

fillForm(data).catch(console.error);
