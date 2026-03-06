// --- CONFIGURATION ---
// You MUST provide these three values
const API_KEY = 'AIzaSyDh2_zDeQs3Fy71tm2juSNZjObkfqwimZY'; // The API key you provided
const CLIENT_ID = '155621673389-ho2bv27sai34souuh4ifj9urrlhfl093.apps.googleusercontent.com'; // Create this in Google Cloud Console
const SPREADSHEET_ID = '1uhMGusXzBw3uymhLWIOwcQO1zFCc5sFIWQ3rTrq91DI'; // The ID from your Google Sheets URL
// ---------------------

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isAuthenticated = false;

// 1. Initialize Google API (gapi)
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (err) {
        showToast("Error initializing Google API.", "error");
        console.error(err);
    }
}

// 2. Initialize Google Identity Services (GIS)
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later on auth click
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        // UI is ready to accept auth
        const authBtn = document.getElementById('authorize_button');
        if (authBtn) {
            authBtn.innerText = 'Authorize Google Sheets';
            authBtn.disabled = false;
        }
    }
}

// 3. Handle Auth Clicks
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        isAuthenticated = true;
        document.getElementById('signout_button').style.display = 'block';
        document.getElementById('authorize_button').style.display = 'none';
        showToast("Authenticated with Google successfully!", "good");
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and grant consent.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        isAuthenticated = false;
        document.getElementById('signout_button').style.display = 'none';
        document.getElementById('authorize_button').style.display = 'block';
        showToast("Signed out successfully.", "info");
    }
}

/**
 * Displays a toast notification on the screen
 * @param {string} message - The message to display
 * @param {string} type - 'good', 'bad', 'info', or 'error'
 */
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Select Icon
    let icon = '';
    if (type === 'good') icon = '⭐';
    else if (type === 'bad') icon = '⚠️';
    else if (type === 'info') icon = '🔄';
    else icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Trigger entrance animation
    setTimeout(() => { toast.classList.add('show'); }, 10);

    // Remove logic
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.remove(); }, 400); // wait for exit transition
    }, 4000);
}

/**
 * Logs a deed to the Google Sheet using the REST API
 * @param {string} portion - 'mbh' or 'zbh'
 * @param {string} type - 'good' or 'bad'
 */
async function logDeed(portion, type) {
    if (!isAuthenticated) {
        showToast("Please Authorize with Google first!", "error");
        return;
    }

    if (CLIENT_ID === 'YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com' || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
        showToast("Please set CLIENT_ID and SPREADSHEET_ID in script.js", "error");
        return;
    }

    const typeLabel = type === 'good' ? 'Good Deed' : 'Bad Deed';
    const portionDiv = document.getElementById(`portion-${portion}`);
    const btn = portionDiv.querySelector(`.star-${type}`);
    const icon = btn.querySelector('.star-icon');

    // 1. Play Click Animation
    icon.classList.remove('pulse-click');
    void icon.offsetWidth; // trigger DOM reflow
    icon.classList.add('pulse-click');

    // 2. Disable buttons to prevent spamming while request is flying
    const buttons = document.querySelectorAll('.star-btn');
    buttons.forEach(b => b.style.pointerEvents = 'none');

    showToast(`Saving ${typeLabel}...`, 'info');

    try {
        // 3. Format data to append
        const timestamp = new Date().toLocaleString();
        const rowData = [timestamp, portion.toUpperCase(), typeLabel];

        // 4. Call Sheets API to append to Sheet1 (Change 'Sheet1' if your sheet name is different)
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:C', // Assumes data goes into columns A, B, and C
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData]
            }
        });

        // 5. Handle success
        showToast(`Successfully logged ${typeLabel} to Sheet!`, type);

    } catch (error) {
        console.error('Error logging deed:', error);

        // Handle specific API errors
        if (error.result && error.result.error) {
            showToast(`API Error: ${error.result.error.message}`, "error");
        } else {
            showToast(`Failed to log ${typeLabel}. Check console.`, "error");
        }
    } finally {
        // 6. Re-enable buttons
        buttons.forEach(b => b.style.pointerEvents = 'auto');
    }
}
