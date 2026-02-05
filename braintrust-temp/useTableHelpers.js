/**
 * Races multiple potential outcomes against each other.
 * Matches your preferred 'attemptAction' pattern.
 *
 * @param {object} params
 * @param {function} [params.action] - The trigger action (click, press, etc)
 * @param {number} [params.timeout] - Optional timeout in ms (default: 30000)
 * @param {Array<{
 * name: string,
 * locator?: import('@playwright/test').Locator | (() => Promise<import('@playwright/test').Locator>),
 * isSuccess: boolean,
 * isTimeoutOutcome?: boolean,
 * onOutcome?: (loc: import('@playwright/test').Locator) => Promise<any>
 * }>} params.outcomes
 */
async function attemptAction({ action, outcomes, timeout }) {
    // Define optional parameters clearly at the top using OR operator
    const timeoutValue = timeout || 30000;

    if (action) await action();

    const startTime = Date.now();
    const retryDelay = 300;
    const getRemainingTime = () => Math.max(0, timeoutValue - (Date.now() - startTime));

    // Separate timeout outcome from regular outcomes
    const timeoutOutcome = outcomes.find(o => o.isTimeoutOutcome);
    const regularOutcomes = outcomes.filter(o => !o.isTimeoutOutcome);

    // Track which outcomes have already logged strict mode errors to avoid duplicates
    const strictModeErrorsLogged = new Set();

    // Helper to resolve locator (function or direct)
    const resolveLocator = async (locator) =>
        typeof locator === 'function' ? await locator() : locator;

    // Helper to create a self-retrying runLocator function for each outcome
    const createRunLocator = (outcome) => {
        const runLocator = async () => {
            try {
                const locator = await resolveLocator(outcome.locator);
                const remainingTime = getRemainingTime();

                if (remainingTime <= 0) throw new Error('OUTCOME_TIMEOUT');

                await locator.waitFor({ state: "visible", timeout: remainingTime });
                return outcome;
            } catch (error) {
                // Check for Playwright strict mode violation (locator matched multiple elements)
                // Playwright can throw various error messages for this:
                // - "strict mode violation"
                // - "locator resolved to X elements"
                // - "expected single element"
                const errorMsg = error.message || '';
                const isStrictModeError =
                    errorMsg.includes('strict mode violation') ||
                    (errorMsg.includes('resolved to') && errorMsg.includes('elements')) ||
                    errorMsg.includes('expected single element');

                // Only log strict mode errors once per outcome to avoid spam during retries
                if (isStrictModeError && !strictModeErrorsLogged.has(outcome.name)) {
                    strictModeErrorsLogged.add(outcome.name);
                    console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  STRICT MODE VIOLATION DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Outcome: "${outcome.name}"
Issue: Locator matched multiple elements
Fix: Make your locator more specific

Locator: ${typeof outcome.locator === 'function' ? '<async locator>' : outcome.locator.toString()}

Original error:
${errorMsg}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
                }

                if (getRemainingTime() <= 0) throw new Error('OUTCOME_TIMEOUT');
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return runLocator();
            }
        };
        return runLocator;
    };

    // Race all locators together
    const racePromises = regularOutcomes.map(outcome => createRunLocator(outcome)());

    let winner = null;
    try {
        winner = await Promise.race(racePromises);
    } catch {
        const results = await Promise.allSettled(racePromises);
        const fulfilled = results.find(r => r.status === 'fulfilled');
        if (fulfilled) winner = fulfilled.value;
    }

    // If no winner and we have a timeout outcome, use it
    if (!winner && timeoutOutcome) {
        // Call onOutcome for timeout outcome (no locator to pass)
        const data = timeoutOutcome.onOutcome ? await timeoutOutcome.onOutcome(null) : null;
        return {
            isSuccess: timeoutOutcome.isSuccess,
            outcome: timeoutOutcome.name,
            data: data,
        };
    }

    if (!winner) {
        const debugList = regularOutcomes
            .map(o => `\n  - ${o.name}: ${typeof o.locator === 'function' ? '<async locator>' : o.locator.toString()}`)
            .join("");
        throw new Error(`Action timed out: None of the expected outcomes occurred within ${timeoutValue}ms. \nchecked for:${debugList}`);
    }

    // Check for collisions: check remaining locators with 100ms timeout
    const remainingOutcomes = regularOutcomes.filter(o => o !== winner);
    let allWinners = [winner];

    if (remainingOutcomes.length > 0) {
        const collisionCheckPromises = remainingOutcomes.map(async (outcome) => {
            try {
                const locator = await resolveLocator(outcome.locator);
                await locator.waitFor({ state: "visible", timeout: 100 });
                return outcome;
            } catch {
                return null;
            }
        });

        const results = await Promise.allSettled(collisionCheckPromises);
        const collisions = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        allWinners = [winner, ...collisions];
    }

    if (allWinners.length > 1) {
        throw new Error(
            `Ambiguous Page State: Multiple outcomes detected simultaneously: [${allWinners.map(w => w.name).join(", ")}]. Fix your locators!`
        );
    }

    // Run onOutcome callback (for data extraction or post-outcome actions)
    const finalWinner = allWinners[0];
    const winnerLocator = typeof finalWinner.locator === 'function'
        ? await finalWinner.locator()
        : finalWinner.locator;

    const data = finalWinner.onOutcome ? await finalWinner.onOutcome(winnerLocator) : null;
    return {
        isSuccess: finalWinner.isSuccess,
        outcome: finalWinner.name,
        data: data,
    };
}

/**
 * Wrapper for attemptAction to handle passive state detection.
 * Uses a shorter default timeout (5s) since we aren't waiting for a network action.
 *
 * @param {object} params
 * @param {Array<{
 * name: string,
 * locator: import('@playwright/test').Locator | (() => Promise<import('@playwright/test').Locator>),
 * isSuccess: boolean,
 * onOutcome?: (loc: import('@playwright/test').Locator) => Promise<any>
 * }>} params.outcomes
 * @param {number} [params.timeout] - Default timeout of 5s for passive state detection
 */
async function detectPageState({ outcomes, timeout }) {
    // Define optional parameters clearly at the top using OR operator
    const timeoutValue = timeout || 5000;

    return await attemptAction({ action: null, outcomes, timeout: timeoutValue });
}

/**
 * Ensures a user exists in the organization members list.
 * Races the "User Found" state against the "Not Found" state to determine if an invite is needed.
 * * @param {import('@playwright/test').Page} page
 * @param {string} userEmail
 */
async function ensureUserExists(page, userEmail) {
    await page.getByRole(`link`, { name: `Members` }).click();

    // Search for the user to trigger the filtered view
    await page.getByRole("textbox", { name: "Find members" }).fill(userEmail);

    // Race: Does the user appear, or do we see the "It looks like..." message?
    const result = await detectPageState({
        outcomes: [
            {
                name: "UserFound",
                isSuccess: true,
                // Look for the email appearing in the list
                locator: page.getByRole("list").getByText(userEmail, { exact: true }).first(),
                onOutcome: (loc) => loc.innerText()
            },
            {
                name: "UserNotFound",
                isSuccess: false, // Triggers the Invite flow
                locator: page.getByText(`It looks like ${userEmail}`),
            },
        ],
    });

    // Handle the "Not Found" case by running the Invite flow
    if (!result.isSuccess) {
        logWithTrace('log', `User ${userEmail} not found. Inviting...`);

        // Click the main invite button
        await page.getByRole("button", { name: "Invite member" }).click();

        // Click the select permission groups button
        await page
            .getByRole("button", { name: "Select permission groups" })
            .click();

        // Select No Permission group
        await page.getByRole("option", { name: "No permission group" }).click();

        // Press Escape key to close the menu
        await page.keyboard.press("Escape");

        // Send Invite
        await page.getByRole("button", { name: "Invite", exact: true }).click();

        // Verification: Wait for the user to appear in the list to ensure hydration is complete
        await page
            .getByRole("list")
            .filter({ hasText: userEmail })
            .first()
            .waitFor();
    } else {
        logWithTrace('log', `User ${userEmail} already exists.`);
    }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} groupName
 * @param {string} [description]
 */
async function ensurePermissionGroupExists(
    page,
    groupName,
    description = "Automated description",
) {
    await page.getByRole('link', { name: 'Permission groups' }).click();

    // Use the table abstraction to verify existence within the specific list
    const groupTable = useTable(page.locator("table"), {
        headerTransformer: ({ index }) => {
            return ["Name", "Actions"][index];
        }
    });

    try {
        // Attempt to resolve the row with a short timeout to determine existence
        await groupTable.init();
        const row = groupTable.getByRow({ Name: groupName });
        await row.waitFor({ state: "visible", timeout: 5000 });
    } catch {
        // Log intent to create if the row was not found
        logWithTrace('log', `Group "${groupName}" not found. Creating...`);
        await _createPermissionGroup(page, groupName, description);
    }
}

/**
 * Internal helper to handle the creation flow
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} description
 */
async function _createPermissionGroup(page, name, description) {
    // Open the creation modal
    await page.getByRole("button", { name: "Create permission group" }).click();

    // Fill in the standard details
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description").fill(description);

    // Confirm creation
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // Ensure the new item appears in the list before proceeding
    await page.getByText(name, { exact: true }).waitFor();
}

/**
 * Syncs the permissions.
 * Treats each column (Organization, Projects) as its own isolated table of settings.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupName
 * @param {Object.<string, string|string[]>} permissions
 */
async function ensureGroupPermissions(page, groupName, permissions) {
    const config = {
        Organization: [],
        Projects: [],
        ...permissions,
    };

    const groupTable = useTable(page.locator("table"), {
        headerTransformer: ({ text, index }) => ["Name", "Actions"][index],
    });
    await groupTable.init();
    const row = groupTable.getByRow({ Name: groupName });

    await row.getByRole("button", { name: "Permissions" }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Organization")).toBeVisible();

    for (const [sectionName, permValues] of Object.entries(config)) {
        const permissionsToEnable = Array.isArray(permValues) ? permValues : [permValues];

        const sectionContainer = modal.locator('div.space-y-2').filter({ hasText: sectionName }).first();

        const sectionTable = useTable(sectionContainer, {
            rowSelector: 'div[data-component="PermissionsCheckbox"]',
            // Use string selector to avoid frame context issues
            headerSelector: 'div[data-component="PermissionsCheckbox"]:first-of-type > div > button[role="checkbox"], div[data-component="PermissionsCheckbox"]:first-of-type > div > label',
            headerTransformer: async ({ locator }) => {
                const role = await locator.getAttribute('role');
                if (role === 'checkbox') return 'Checkbox';
                const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
                return tagName === 'label' ? 'Permission' : 'Unknown';
            },
            strategies: {
                getCellLocator: ({ row, columnName, columnIndex }) => {
                    if (columnIndex === 0 || columnName === 'Checkbox') {
                        return row.locator('button[role="checkbox"]');
                    } else {
                        return row.locator('label');
                    }
                }
            }
        });

        await sectionTable.init();

        const allRows = await sectionTable.getAllCurrentRows();

        for (const [index, row] of allRows.entries()) {
            const name = (await row.getCell('Permission').textContent() || "").trim();
            const checkbox = row.getCell('Checkbox');

            const shouldBeChecked = permissionsToEnable.includes(name);
            const ariaChecked = await checkbox.getAttribute('aria-checked');
            const isChecked = ariaChecked === 'true';

            if (shouldBeChecked !== isChecked) {
                await checkbox.click();
            }
        }
    }

    await page.getByRole("button", { name: "Save" }).click();
}

/**
 * Ensures specific users are assigned to the group.
 * Handles "Empty State" vs "Existing Members" race condition.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupName
 * @param {string[]} userEmails
 */
async function ensureGroupHasUsers(page, groupName, userEmails) {
    // Open the Members Modal using the main table
    const groupTable = useTable(page.locator("table"));
    await groupTable.init();
    const row = groupTable.getByRow({ Name: groupName });

    await row.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole("menuitem", { name: "Members" }).click();

    // Race Condition: Wait for EITHER the list header OR the empty state text
    const membersHeader = page.getByRole("heading", {
        name: "Group members",
        exact: true,
    });
    const emptyState = page.getByText(
        "There are no members in this permission group yet",
    );

    await Promise.race([
        membersHeader.waitFor({ state: "visible" }),
        emptyState.waitFor({ state: "visible" }),
    ]);

    // Determine which state won
    const hasExistingMembers = await membersHeader.isVisible();

    // Check and Add Users
    for (const email of userEmails) {
        let isUserPresent = false;

        if (hasExistingMembers) {
            const membersContainer = page
                .locator("div")
                .filter({ has: membersHeader })
                .filter({ hasNot: page.getByText("Non-members") });

            const memberRow = membersContainer
                .locator('div[data-component="UserItem"]')
                .filter({ hasText: email });

            isUserPresent = await memberRow.isVisible();
        }

        if (!isUserPresent) {
            logWithTrace('log', `User ${email} missing from ${groupName}. Adding...`);

            // Fill search to filter the non-members list
            await page
                .getByRole("textbox", { name: "Find permission group member" })
                .fill(email);

            // Click the "Add" (+) button.
            await page.getByRole("button", { name: "Add user to group" }).click();

            // Wait for the user to appear in the "Member" list (Top section) to confirm success
            await expect(
                page
                    .locator('div[data-component="UserItem"]')
                    .filter({ hasText: email }),
            ).toBeVisible();
        }
    }

    // Close Modal
    await page.getByRole("button", { name: "Close", exact: true }).click();
}

/**
 * comprehensive setup helper for RBAC tests.
 * Navigates to settings, ensures the user exists in the org,
 * creates/finds the permission group, sets the specific permissions,
 * and assigns the user to that group.
 *
 * @param {import('@playwright/test').Page} adminPage
 * @param {object} params
 * @param {string} params.email - The email of the user to test
 * @param {string} params.groupName - Name of the permission group (e.g. "Viewer", "Editor")
 * @param {object} params.permissions - The permission config object { Organization: [], Projects: [] }
 */
async function setupUserRole(adminPage, { email, groupName, permissions }) {
    logWithTrace('log', `Provisioning user ${email} with role ${groupName}...`);

    await clickTab(adminPage, 'Settings');

    // Ensure User Exists in the Organization (General Members list)
    await ensureUserExists(adminPage, email);

    // Create/Get Group
    await ensurePermissionGroupExists(adminPage, groupName);

    // Set Permissions (Idempotent - only changes if different)
    await ensureGroupPermissions(adminPage, groupName, permissions);

    // Assign User to Group
    await ensureGroupHasUsers(adminPage, groupName, [email]);

    logWithTrace('log', `Complete. User ${email} is now in group ${groupName}.`);

    // Navigate back to Overview tab
    await clickTab(adminPage, 'Overview');
}

/**
 * Robustly finds an element within a virtualized (infinite scroll) list by scrolling.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} target - The element we are looking for
 * @param {object} options
 * @param {import('@playwright/test').Locator} [options.scrollableContainer] - The container to hover/scroll
 * @param {number} [options.maxScrolls] - Max attempts before giving up (default: 20)
 * @param {number} [options.scrollAmount] - Pixels to scroll per step (default: 500)
 * @returns {Promise<boolean>} - True if found and visible
 */
async function findInVirtualList(page, target, options) {
    // Define optional parameters clearly at the top using OR operator
    const scrollableContainer = options?.scrollableContainer;
    const maxScrolls = options?.maxScrolls || 20;
    const scrollAmount = options?.scrollAmount || 500;

    // 1. Fast Path: Is it already there?
    if (await target.isVisible()) return true;

    // 2. Setup Scroll Context
    // Ensure we are hovering the right area so wheel events register
    if (scrollableContainer) {
        await scrollableContainer.hover().catch(() => { });
    } else {
        // If no container specified, hover middle of screen
        const viewport = page.viewportSize();
        if (viewport) await page.mouse.move(viewport.width / 2, viewport.height / 2);
    }

    // 3. Scroll Loop
    for (let i = 0; i < maxScrolls; i++) {
        // Check if target rendered
        if (await target.isVisible()) {
            return true;
        }

        // Perform Scroll
        await page.mouse.wheel(0, scrollAmount);

        // Wait for render (React virtual lists need a tick to mount new rows)
        await page.waitForTimeout(200);
    }

    // Final check
    return await target.isVisible();
}


/**
 * Creates a configured useTable instance for Braintrust's virtualized tables
 * 
 * @param {Object} page - Playwright page object
 * @param {Object} options - Optional configuration overrides
 * @param {Object} options.tableLocator - Locator for the table container
 * @param {Object} options.rowSelector - Locator for the table rows
 * @param {Object} options.headerSelector - Locator for the table headers
 * @param {Object} options.headerTransformer - Function to transform the header text
 * @param {Object} options.cellSelector - Locator for the table cells
 * @param {Object} options.strategies - Object containing strategies for the table
 * @returns {Object} Object containing braintrustTable instance and helper functions
 * 
 * @example
 * const { braintrustTable, parseRows } = getBraintrustTable(page);
 * await braintrustTable.init();
 * const rows = await parseRows();
 */
function getBraintrustTable(page, options = {}) {
    const { tableLocator, ...restOptions } = options;
    const tableContainer = tableLocator || page.locator('div')
        .filter({ has: page.locator('[data-component="TableHeadersComponent"]') }).last();

    // Configure useTable with Braintrust's virtualized table structure
    const braintrustTable = useTable(
        tableContainer,
        {
            // Rows are children of the parent container
            rowSelector: 'div.flex.absolute[data-index]',
            // Use data-column-name attribute for headers - this captures all columns including hidden ones
            headerSelector: 'div[data-column-name]',
            headerTransformer: async ({ locator, index }) => {
                const columnName = await locator.getAttribute('data-column-name');

                // Handle special hidden columns
                if (columnName === '__row_selection') return 'Select';
                if (columnName === '__row_star') return 'Star';

                // Try to get clean text from the draggable header element
                const headerElement = locator.locator('.draggable-column-header');
                const isVisible = await headerElement.isVisible();

                if (isVisible) {
                    return await headerElement.textContent();
                }

                return columnName || `column-${index}`;
            },
            cellSelector: '> div[data-index]',
            strategies: {
                getCellLocator: ({ row, columnIndex }) => {
                    // columnIndex now matches data-index because headers include all columns via data-column-name
                    return row.locator(`> div[data-index="${columnIndex}"]`);
                },
                pagination: async ({ page }) => {
                    // Scroll down to load more rows
                    await page.mouse.move(700, 400);
                    await page.mouse.wheel(0, 300);
                    await page.waitForTimeout(200);
                    return true; // Continue pagination
                }
            },
            ...restOptions // Allow overriding any config
        }
    );

    /**
     * Parse rows from the table, optionally limiting columns
     * 
     * @param {Object} options - Parsing options
     * @param {number} [options.cols] - Number of columns to keep (keeps all if not specified)
     * @param {number} [options.maxRows] - Maximum number of rows to parse
     * @returns {Promise<Array<Object>>} Array of row objects with header names as keys
     * 
     * @example
     * // Get first 2 columns from all rows
     * const rows = await parseRows({ cols: 2 });
     * 
     * // Get all columns from first 10 rows
     * const rows = await parseRows({ maxRows: 10 });
     */
    async function parseRows(options = {}) {
        const { columns, cols, maxRows } = options;

        // Ensure table is initialized
        if (!braintrustTable.isInitialized()) {
            await braintrustTable.init();
        }

        const headers = await braintrustTable.getHeaders();
        const allRows = await braintrustTable.getRows();

        // Limit rows if specified
        const rowsToProcess = maxRows ? allRows.slice(0, maxRows) : allRows;

        // Determine which columns to extract
        let columnsToExtract;
        if (columns) {
            // Preferred: explicit column names
            columnsToExtract = columns;
        } else if (cols !== undefined) {
            // Backward compatibility: first N columns
            columnsToExtract = headers.slice(0, Math.min(cols, headers.length));
        }

        // Extract and format row data
        const parsedRows = await Promise.all(
            rowsToProcess.map(async (row) => {
                // Only extract the columns we need to avoid accessing non-visible cells
                const data = await row.toJSON({ columns: columnsToExtract });
                return data;
            })
        );

        return parsedRows;
    }

    /**
     * Get values from a specific column with optional validation
     * 
     * @param {string} columnName - Name of the column to extract
     * @param {Object} options - Extraction options
     * @param {Function} [options.mapper] - Custom mapper function for each cell
     * @param {Function} [options.validator] - Validation function for each value
     * @returns {Promise<Array>} Array of column values
     * 
     * @example
     * // Get all values from a column
     * const values = await getColumnValues('Score');
     * 
     * // Get and validate percentage values
     * const percentages = await getColumnValues('Score', {
     *   mapper: async (cell) => {
     *     const text = await cell.textContent();
     *     return parseFloat(text.replace('%', ''));
     *   },
     *   validator: (value) => value === 100 || value === 0
     * });
     */
    async function getColumnValues(columnName, options = {}) {
        const { mapper, validator } = options;

        // Ensure table is initialized
        if (!braintrustTable.isInitialized()) {
            await braintrustTable.init();
        }

        const headers = await braintrustTable.getHeaders();
        if (!headers.includes(columnName)) {
            throw new Error(`Column "${columnName}" not found. Available columns: ${headers.join(', ')}`);
        }

        const values = await braintrustTable.getColumnValues(columnName, {
            mapper: mapper || (async (cell) => await cell.textContent())
        });

        // Apply validation if provided
        if (validator) {
            values.forEach((value, index) => {
                if (!validator(value)) {
                    throw new Error(
                        `Validation failed for ${columnName} at row ${index}: ${value}`
                    );
                }
            });
        }

        return values;
    }

    return {
        braintrustTable,
        parseRows,
        getColumnValues
    };
}

/**
 * Creates an experiment from the playground and optionally asserts human review score.
 * @param {import('playwright').Page} page - The Playwright page object.
 * @param {string} experimentName - The name of the experiment to create.
 * @param {Array<object>} playgroundRows - Array of playground row objects.
 * @param {string[]} matchColumns - Column names to extract from experiment rows for matching (e.g., ['Name', 'Input']).
 * @param {object} [options] - Optional parameters.
 * @param {object} [options.humanReviewScore] - Human review score object for assertions.
 * @param {string} [options.datasetName] - Dataset name to assert.
 * @returns {Promise<void>}
 *
 * @example
 * await createExperimentFromPlaygroundWithUseTable(page, 'experiment-hr-options 12345', playgroundRows, ['Name', 'Input'], { humanReviewScore, datasetName });
 */
async function createExperimentFromPlaygroundWithUseTable(
    page,
    experimentName,
    playgroundRows,
    matchColumns,
    options = {},
) {
    // Extract options
    const humanReviewScore = options.humanReviewScore;

    // Click + Experiment
    await page.getByRole(`button`, { name: `Experiment`, exact: true }).click();

    // Fill in experiment name
    await page
        .getByRole(`textbox`, { name: `Enter task name` })
        .fill(experimentName);

    // Click Create
    await page.waitForTimeout(1000);
    await page.getByRole(`button`, { name: `Create` }).click();

    // Click Go to experiment in the toast notification
    await page.waitForTimeout(1000);
    await page.getByRole(`button`, { name: `Go to experiment` }).click();
    await page.waitForTimeout(5000);

    // Assert experiment name
    await expect(
        page.getByRole(`combobox`).filter({ hasText: experimentName }),
    ).toBeVisible();

    // Assert DataSet
    await expect(
        page.getByRole(`link`, { name: options.datasetName }),
    ).toBeVisible();

    // Get table helpers after navigating to experiment page
    const { braintrustTable, parseRows, getColumnValues } = getBraintrustTable(page);

    // Make sure all rows have loaded using useTable
    await expect(async () => {
        try {
            await braintrustTable.init();
            const rows = await braintrustTable.getRows();
            expect(rows.length).toBe(playgroundRows.length);
        } catch (error) {
            // Reload and reinitialize table on failure
            await page.reload();
            await page.waitForTimeout(5000);
            throw error;
        }
    }).toPass({ timeout: 2 * 60 * 1000 });

    // Get experiment rows with only the columns we need for matching
    const experimentRows = await parseRows({ columns: matchColumns });

    // Loop through playground rows and verify they exist in experiment
    for (const playgroundRow of playgroundRows) {
        // Match by Input field
        const input = playgroundRow.Input;
        const experimentRow = experimentRows.find((el) => el.Input === input);

        // Assert that a matching row was found
        expect(experimentRow).toBeDefined();
    }

    // Optional human review score assertions
    if (humanReviewScore && humanReviewScore.scoreType !== "text") {
        // Assert hr options name
        await expect(
            page.locator(`#sidebar`).getByText(humanReviewScore.name),
        ).toBeVisible();

        // Assert No score data
        await expect(
            page.locator(
                `[data-component="ScorerItem"]:has-text("${humanReviewScore.name}") + div:has-text("No score data")`,
            ),
        ).toBeVisible();

        // Assert column header matching human review score name
        await expect(
            page.locator(
                `[data-component="headerWrapper"]:has-text("${humanReviewScore.name}")`,
            ),
        ).toBeVisible();

        // Ensure human review scores are "-" using useTable
        const hrValues = await getColumnValues(humanReviewScore.name);

        // Assert each human review column has a value of "﹣"
        for (const hrText of hrValues) {
            expect(hrText).toBe("﹣");
        }
    }
}
