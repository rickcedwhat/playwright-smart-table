//--------------------------------
// Arrange:
//--------------------------------
// Constants
const playground = `[Static] Movie-Human-Review-Playground`;
const projectName = `${getEnvironmentPrefix()}-experiments-hr-options`;
const randomNum = Date.now().toString().slice(-5);
const experimentCleanUpId = `${getEnvironmentPrefix()}-experiment-hr-options`
const experimentName = `${experimentCleanUpId} ${randomNum}`
const scoreType = `hr-options`;
const datasetName = `Movie-Matcher-Shortened`;
const datasetFile = `movie-matcher-short.csv`;
const humanReviewScore = {
    name: `${scoreType}-${randomNum}`,
    description: `human-review-options description ${randomNum}`,
    scoreType: "options",
    options: [
        {
            label: "Accurate",
            value: "100",
        },
        {
            label: "Inaccurate",
            value: "0",
        },
    ],
};

// Log into default organization account
const { page, context } = await logIn({
    permissions: ["clipboard-read", "clipboard-write"],
});

// Delete dedicated project
await deleteProject(page, nav(page), projectName);

// Create dedicated project
await createProject(page, nav(page), projectName);

// Create and upload dataset
await createAndUploadDataset(page, nav(page), datasetName, datasetFile);

// Wait in between actions
await page.waitForTimeout(5000);

// Remove # of rows from dataset
await removeRowsFromDataset(page, 10);

// Navigate to Project page
await page.getByRole(`banner`).getByRole(`link`, { name: projectName }).click();

//--------------------------------
// Act:
//--------------------------------

// Add human review score
await addHumanReviewScore(page, nav(page), humanReviewScore)

// Create playground
await createPlayground(page, nav(page), playground, {
    dataset: datasetName,
    prompt: `Please tell me what movie name matches the description found in {{input}}.`
});

// Click 'Run'
await page.getByRole(`button`, { name: `Run`, exact: true }).click({ force: true, delay: 300 });
await page.waitForTimeout(1000)
// Wait for 'Run' button to be visible
await page.getByRole(`button`, { name: `Run`, exact: true }).waitFor({ timeout: 2 * 60 * 1000 });

// Change playground to List View if playground is in Grid view 
await page.getByRole(`button`, { name: `Display` }).click();
await page.getByRole(`menuitem`, { name: `Layout` }).click();
await page.getByRole(`menuitemcheckbox`, { name: `List` }).click();

// Parse playground rows, keeping only the first 2 columns 
const { parseRows } = getBraintrustTable(page);
const playgroundRows = await parseRows({ columns: ['Name', 'Input'] });

// Wait in between
await page.waitForTimeout(2000);

// Create experiment from playground
await createExperimentFromPlaygroundWithUseTable(page, experimentName, playgroundRows, ['Name', 'Input'], { humanReviewScore, datasetName })

// Wait in between
await page.waitForTimeout(10 * 1000);

await page.getByRole(`button`, { name: `Review`, exact: true }).click({ force: true });

const currentRow = page.locator(`[name="typedRowIndex"]`);

// Iterate through rows and review each one
for (let i = 0; i < playgroundRows.length; i++) {

    // Wait for current row to be i+1
    await expect(currentRow).toHaveValue(`${i + 1}`);
    await page.waitForTimeout(2000);

    // Get output and expected texts
    const outputText = await nav(page).traceOutput.textContent();
    const expectedText = await nav(page).traceExpected.textContent()

    // Scroll activity panel into view and count current activities
    await page.locator('div > [data-component="ActivityWrapper"]').first().scrollIntoViewIfNeeded();
    const initialActivityCount = await page.locator('[data-component="ActivityWrapper"]').count();

    // Click Accurate or Inaccurate based on text
    const reviewScore = outputText.includes(expectedText) ? 'Accurate' : 'Inaccurate';

    await page.getByRole(`radio`, { name: reviewScore, exact: true }).click({ force: true });

    // Wait for new activity to appear
    await expect(page.locator('[data-component="ActivityWrapper"]')).toHaveCount(initialActivityCount + 1);

    // Assert the first (newest) activity contains expected text
    const newestActivity = page.locator('[data-component="ActivityWrapper"]').first();
    await expect(newestActivity).toContainText('QA Wolf');
    await expect(newestActivity).toContainText('set scores to');
    await expect(newestActivity).toContainText(`"${humanReviewScore.name}":${reviewScore === 'Accurate' ? 1 : 0}`);

    // Skip last iteration and click x to close out of review
    if (i < playgroundRows.length - 1) await page.getByRole(`button`, { name: `Next row →` }).click();
    else await page.locator(`button:has-text("Next row") + button`).click();
}

// Click Views tab button
await page.locator(`[data-component="TraceHeader"] button`).last().click()
await page.reload();
const { getColumnValues, braintrustTable: experimentTable } = getBraintrustTable(page);

// Wait up to 15 seconds for table to load
await experimentTable.init({ timeout: 15000 });
//--------------------------------
// Assert:
//--------------------------------

const hrValuesNew = await getColumnValues(humanReviewScore.name, {
    mapper: async (cell) => {
        const text = await cell.textContent();
        // Assert the text matches percentage pattern
        expect(text).toMatch(/^(100(\.00)?%|0(\.00)?%)$/);
        return parseFloat(text.replace('%', ''));
    },
    validator: (value) => {
        // Validate the parsed number is either 100 or 0
        return value === 100 || value === 0;
    }
});
const average = hrValuesNew.reduce((sum, val) => sum + val, 0) / hrValuesNew.length;

// Assert average in column header
const headerCell = await experimentTable.getHeaderCell(humanReviewScore.name);
await expect(headerCell).toContainText(`${average}%`);

// Assert scorers and distribution graph is visible
await expect(page.locator(`[data-component="ScorerItem"]:has-text("${humanReviewScore.name}") + div [data-component="Chart"]`)).toBeVisible()

// Click on average header 
await page.getByRole(`button`, { name: `${average}%avg`, exact: true }).click();

// Assert tooltip is visible 
await expect(page.locator(`div:text-is("Base experiment") + div:has-text("${humanReviewScore.name}"):has-text("${average}%")`)).toBeVisible()

//--------------------------------
// Clean Up:
//--------------------------------
// Return to project page
await page.getByRole(`banner`).getByRole(`link`, { name: projectName }).click();

// Click on the 'Projects' tab
await nav(page).projectsTabEnsure();

// Wait 
await page.waitForTimeout(1000);

// Delete project
await deleteProject(page, nav(page), projectName);