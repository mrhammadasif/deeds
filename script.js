// --- SUPABASE CONFIGURATION ---
// PASTE YOUR SUPABASE URL AND ANON KEY HERE
var SUPABASE_URL = 'https://cmvjccoakhvdjzfvqtli.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtdmpjY29ha2h2ZGp6ZnZxdGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTA5MjAsImV4cCI6MjA4ODM2NjkyMH0.J0IQRSUxn3av7bqW54onNq2HDNL8g9cz8Lr633cwpTo';
// -----------------------------

// Initialize Supabase Client
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isApproved = false;

// Listen for Authentication Changes (Login/Logout/Refresh)
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
            currentUser = session.user;
            await checkUserApproval(session.user.email);
        } else {
            showLoginScreen();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        isApproved = false;
        showLoginScreen();
    }
});

/**
 * Triggered when clicking "Sign in with Google"
 */
async function signInWithGoogle() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
        showToast("Please add your Supabase credentials in script.js", "error");
        return;
    }

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Error logging in:', error);
        showToast(error.message, "error");
    }
}

/**
 * Triggered when clicking "Sign Out"
 */
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showToast("Signed out successfully", "info");
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

/**
 * Checks if the user exists in the custom 'users' table and if they are approved.
 * If they don't exist, it adds them as unapproved.
 */
async function checkUserApproval(email) {
    try {
        // 1. Check if user exists in the public.users table
        const { data: userRecord, error: fetchError } = await supabase
            .from('users')
            .select('is_approved')
            .eq('email', email)
            .maybeSingle(); // maybeSingle returns null if 0 rows, instead of throwing an error

        if (fetchError) {
            console.error("Database fetch error:", fetchError);
            isApproved = false;
        } else if (!userRecord) {
            // User not found in table! This is their first time logging in.
            // Insert them with is_approved = false (default behavior in SQL)
            const { error: insertError } = await supabase
                .from('users')
                .insert([{ email: email, is_approved: false }]);

            if (insertError) {
                console.error("Error creating user record:", insertError);
            }

            isApproved = false;
        } else {
            // User exists, check their approval status
            isApproved = userRecord.is_approved === true;
        }

        updateUIBasedOnApproval();

    } catch (error) {
        console.error("Error checking approval:", error);
        showToast("Error checking account status.", "error");
    }
}

/**
 * Updates the screen based on if the user is logged in, approved, or pending.
 */
function updateUIBasedOnApproval() {
    const overlay = document.getElementById('login-overlay');
    const loginMsg = document.getElementById('login-message');
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('supa-logout-btn');
    const mainContainer = document.querySelector('.container');

    if (!currentUser) {
        // Show normal login screen
        showLoginScreen();
        return;
    }

    if (isApproved) {
        // User is logged in and APPROVED -> Hide overlay, show main app
        overlay.classList.add('hidden');
        mainContainer.classList.add('approved');

        // Ensure we add a profile logout button to the main screen
        addProfileButton();
        showToast(`Welcome back, ${currentUser.email}!`, "good");
    } else {
        // User logged in but PENDING APPROVAL
        overlay.classList.remove('hidden');
        mainContainer.classList.remove('approved');
        loginMsg.innerHTML = `Your account (<b>${currentUser.email}</b>) is pending approval by the administrator.<br><br>Please check back later.`;
        googleBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
    }
}

function showLoginScreen() {
    const overlay = document.getElementById('login-overlay');
    const loginMsg = document.getElementById('login-message');
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('supa-logout-btn');
    const mainContainer = document.querySelector('.container');

    overlay.classList.remove('hidden');
    mainContainer.classList.remove('approved');
    loginMsg.innerHTML = "Please log in to track your deeds.";
    googleBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';

    // Remove profile button if it exists
    const profileBtn = document.getElementById('user-profile-btn');
    if (profileBtn) profileBtn.remove();
}

/**
 * Adds a small profile button to the top right of the main app
 */
function addProfileButton() {
    if (document.getElementById('user-profile-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'user-profile-btn';
    btn.className = 'user-profile';
    btn.innerHTML = `
        <img src="${currentUser.user_metadata.avatar_url || 'icon.svg'}" alt="Profile" style="width:24px; height:24px; border-radius:50%;">
        <span>Log Out</span>
    `;
    btn.onclick = signOut;
    document.body.appendChild(btn);
}


/**
 * Logs a deed to the Supabase database
 */
async function logDeed(portion, type) {
    if (!currentUser || !isApproved) {
        showToast("You must be logged in and approved to log deeds.", "error");
        return;
    }

    const typeLabel = type === 'good' ? 'Good Deed' : 'Bad Deed';
    const portionDiv = document.getElementById(`portion-${portion}`);
    const btn = portionDiv.querySelector(`.star-${type}`);
    const icon = btn.querySelector('.star-icon');

    // Play Click Animation
    icon.classList.remove('pulse-click');
    void icon.offsetWidth;
    icon.classList.add('pulse-click');

    // Disable buttons
    const buttons = document.querySelectorAll('.star-btn');
    buttons.forEach(b => b.style.pointerEvents = 'none');

    try {
        // Insert row into 'deeds' table in Supabase
        const { error } = await supabase
            .from('deeds')
            .insert([
                {
                    user_email: currentUser.email,
                    portion: portion.toUpperCase(),
                    deed_type: typeLabel
                }
            ]);

        if (error) throw error;

        showToast(`Successfully logged ${typeLabel}!`, type);

    } catch (error) {
        console.error('Error logging deed:', error);
        showToast(`Failed to log deed. Database error.`, "error");
    } finally {
        buttons.forEach(b => b.style.pointerEvents = 'auto');
    }
}

/**
 * Displays a toast notification on the screen
 */
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '';
    if (type === 'good') icon = '⭐';
    else if (type === 'bad') icon = '⚠️';
    else if (type === 'info') icon = '🔄';
    else icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.remove(); }, 400);
    }, 4000);
}
