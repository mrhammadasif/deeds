// --- SUPABASE CONFIGURATION ---
// PASTE YOUR SUPABASE URL AND ANON KEY HERE

var SUPABASE_URL = 'https://yjsgrftgjiznvcinbmwh.supabase.co'
var SUPABASE_PUBLIC_KEY = 'sb_publishable_mKdpVdmBsC28o45-NdV24w_kAH5lyzD'
// -----------------------------

// Initialize Supabase Client with explicit persistent session settings
var supabase = window.supabase.createClient( SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'deeds-auth'
  }
} )

let currentUser = null
let isApproved = false

// Check for existing session immediately on load
async function initializeAuth () {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if ( error ) throw error

    if ( session ) {
      currentUser = session.user
      await checkUserApproval( session.user.email )
    } else {
      // No existing session -> show the login screen
      showLoginScreen()
    }
  } catch ( error ) {
    console.error( "Error getting session on load:", error )
    // On error, fall back to showing the login screen
    showLoginScreen()
  }
}

// Call on load
initializeAuth()

// Listen for Authentication Changes (Login/Logout/Refresh)
supabase.auth.onAuthStateChange( ( event, session ) => {
  if ( event === 'SIGNED_IN' || event === 'INITIAL_SESSION' ) {
    if ( session ) {
      currentUser = session.user
      console.log('[onAuthStateChange] calling checkUserApproval', session.user.email);
      checkUserApproval( session.user.email )
      
      console.log('[onAuthStateChange] user fetched', data);
    } else {
      showLoginScreen()
    }
  } else if ( event === 'SIGNED_OUT' ) {
    currentUser = null
    isApproved = false
    showLoginScreen()
  }
} )


/**
 * Triggered when clicking "Sign in with Google"
 */
async function signInWithGoogle () {
  if ( SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' ) {
    showToast( "Please add your Supabase credentials in script.js", "error" )
    return
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth( {
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    } )
    if ( error ) throw error
  } catch ( error ) {
    console.error( 'Error logging in:', error )
    showToast( error.message, "error" )
  }
}

/**
 * Triggered when clicking "Sign Out"
 */
async function signOut () {
  try {
    const { error } = await supabase.auth.signOut()
    if ( error ) throw error
    showToast( "Signed out successfully", "info" )
  } catch ( error ) {
    console.error( 'Error signing out:', error )
  }
}

/**
 * Checks if the user exists in the custom 'users' table and if they are approved.
 * If they don't exist, it adds them as unapproved.
 */
async function checkUserApproval ( email ) {
  try {
    console.log('[checkUserApproval] querying users for', email);
    // 1. Check if user exists in the public.users table
    const {
      data: userRecord,
      error: fetchError
    } = await supabase
      .from( 'users' )
      .select(  )
      .eq( 'email', email )
      .maybeSingle() // maybeSingle returns null if 0 rows, instead of throwing an error

    if ( fetchError ) {
      console.error( "Database fetch error:", fetchError )
      isApproved = false
    } else if ( !userRecord ) {
      // User not found in table! This is their first time logging in.
      // Insert them with is_approved = false (default behavior in SQL)
      const { error: insertError } = await supabase
        .from( 'users' )
        .insert( [{ email: email, is_approved: false }] )

      if ( insertError ) {
        console.error( "Error creating user record:", insertError )
      }

      isApproved = false
    } else {
      // User exists, check their approval status
      isApproved = userRecord.is_approved === true
    }

    updateUIBasedOnApproval()

  } catch ( error ) {
    console.error( "Error checking approval:", error )
    showToast( "Error checking account status.", "error" )
  }
}

/**
 * Updates the screen based on if the user is logged in, approved, or pending.
 */
function updateUIBasedOnApproval () {
  const overlay = document.getElementById( 'login-overlay' )
  const loginMsg = document.getElementById( 'login-message' )
  const googleBtn = document.getElementById( 'google-login-btn' )
  const logoutBtn = document.getElementById( 'supa-logout-btn' )
  const emailSection = document.getElementById( 'email-login-section' )
  const mainContainer = document.querySelector( '.container' )

  if ( !currentUser ) {
    // Show normal login screen
    showLoginScreen()
    return
  }

  if ( isApproved ) {
    // User is logged in and APPROVED -> Hide overlay, show main app
    overlay.classList.add( 'hidden' )
    mainContainer.classList.add( 'approved' )

    // Ensure we add a profile logout button to the main screen
    addProfileButton()
    showToast( `Welcome back, ${currentUser.email}!`, "good" )
    updateCounts()
  } else {
    // User logged in but PENDING APPROVAL
    overlay.classList.remove( 'hidden' )
    mainContainer.classList.remove( 'approved' )
    loginMsg.innerHTML = `You're signed in as <b>${currentUser.email}</b>.<br><br>Your account is not approved yet by the administrator. Please check back later.`
    if ( googleBtn ) googleBtn.style.display = 'none'
    if ( emailSection ) emailSection.style.display = 'none'
    if ( logoutBtn ) logoutBtn.style.display = 'inline-flex'
  }
}

function showLoginScreen () {
  const overlay = document.getElementById( 'login-overlay' )
  const loginMsg = document.getElementById( 'login-message' )
  const googleBtn = document.getElementById( 'google-login-btn' )
  const logoutBtn = document.getElementById( 'supa-logout-btn' )
  const emailSection = document.getElementById( 'email-login-section' )
  const mainContainer = document.querySelector( '.container' )

  overlay.classList.remove( 'hidden' )
  mainContainer.classList.remove( 'approved' )
  loginMsg.innerHTML = "Please log in to track your deeds."
  if ( googleBtn ) googleBtn.style.display = 'inline-flex'
  if ( emailSection ) emailSection.style.display = 'block'
  if ( logoutBtn ) logoutBtn.style.display = 'none'

  // Remove profile button if it exists
  const profileBtn = document.getElementById( 'user-profile-btn' )
  if ( profileBtn ) profileBtn.remove()
}

/**
 * Adds a small profile button to the top right of the main app
 */
function addProfileButton () {
  if ( document.getElementById( 'user-profile-btn' ) ) return

  const btn = document.createElement( 'div' )
  btn.id = 'user-profile-btn'
  btn.className = 'user-profile'
  btn.innerHTML = `
        <img src="${currentUser.user_metadata.avatar_url || 'icon.svg'}" alt="Profile" style="width:24px; height:24px; border-radius:50%;">
        <span>Log Out</span>
    `
  btn.onclick = signOut
  document.body.appendChild( btn )
}


/**
 * Logs a deed to the Supabase database
 */
async function logDeed ( portion, type ) {
  if ( !currentUser || !isApproved ) {
    showToast( "You must be logged in and approved to log deeds.", "error" )
    return
  }

  const typeLabel = type === 'good' ? 'Good Deed' : 'Bad Deed'
  const portionDiv = document.getElementById( `portion-${portion}` )
  const btn = portionDiv.querySelector( `.star-${type}` )
  const icon = btn.querySelector( '.star-icon' )


  // Play Click Animation
  icon.classList.remove( 'pulse-click' )
  void icon.offsetWidth
  icon.classList.add( 'pulse-click' )

  // Disable buttons
  const buttons = document.querySelectorAll( '.star-btn' )
  buttons.forEach( b => b.style.pointerEvents = 'none' )

  try {
    // Insert row into 'deeds' table in Supabase
    const { data, error } = await supabase
      .from( 'deeds' )
      .insert( [
        {
          user_email: currentUser.email,
          portion: portion.toUpperCase(),
          deed_type: typeLabel
        }
      ] )
      .select()

    if ( error ) throw error

    const insertedId = data && data.length > 0 ? data[0].id : null

    showToast( `Successfully logged ${typeLabel}!`, type, insertedId )
    updateCounts( true )

  } catch ( error ) {
    console.error( 'Error logging deed:', error )
    showToast( `Failed to log deed. Database error.`, "error" )
  } finally {
    buttons.forEach( b => b.style.pointerEvents = 'auto' )
  }
}

/**
 * Deletes a recently logged deed by ID (Undo action)
 */
async function undoDeed ( id, buttonElement ) {
  if ( !currentUser ) return

  // Disable button to prevent double clicks
  buttonElement.disabled = true
  buttonElement.innerText = '...'

  try {
    const { error } = await supabase
      .from( 'deeds' )
      .delete()
      .eq( 'id', id )

    if ( error ) throw error

    showToast( "Deed undone successfully.", "info" )

    // Hide the original toast quickly
    const parentToast = buttonElement.closest( '.toast' )
    if ( parentToast ) {
      parentToast.classList.remove( 'show' )
      setTimeout( () => parentToast.remove(), 400 )
    }

    updateCounts( true )

  } catch ( error ) {
    console.error( 'Error undoing deed:', error )
    showToast( "Failed to undo.", "error" )
    buttonElement.disabled = false
    buttonElement.innerText = 'Undo'
  }
}

/**
 * Displays a toast notification on the screen
 */
function showToast ( message, type, deedId = null ) {
  const container = document.getElementById( 'toast-container' )
  const toast = document.createElement( 'div' )
  toast.className = `toast toast-${type}`

  let icon = ''
  if ( type === 'good' ) icon = '⭐'
  else if ( type === 'bad' ) icon = '⚠️'
  else if ( type === 'info' ) icon = '🔄'
  else icon = '❌'

  let undoHtml = ''
  if ( deedId ) {
    undoHtml = `<button class="undo-btn" onclick="undoDeed('${deedId}', this)">Undo</button>`
  }

  toast.innerHTML = `<div class="toast-content"><span>${icon}</span> <span>${message}</span></div> ${undoHtml}`
  container.appendChild( toast )

  setTimeout( () => { toast.classList.add( 'show' ) }, 10 )

  // Auto-dismiss after 5 seconds
  setTimeout( () => {
    if ( toast.parentElement ) {
      toast.classList.remove( 'show' )
      setTimeout( () => {
        if ( toast.parentElement ) toast.remove()
      }, 400 )
    }
  }, 5000 )
}

/**
 * Fetches and updates the deed counts for all portions and types
 */
async function updateCounts ( forceFetch = false ) {
  if ( !currentUser || !isApproved ) return

  try {
    const portions = ['MBH', 'ZBH']
    const types = ['Good Deed', 'Bad Deed']

    // We run these fetch calls concurrently for speed
    const promises = []

    for ( const portion of portions ) {
      for ( const type of types ) {
        const idPrefix = portion.toLowerCase()
        const idSuffix = type === 'Good Deed' ? 'good' : 'bad'
        const countId = `count-${idPrefix}-${idSuffix}`
        const el = document.getElementById( countId )

        // 1. Immediately visually load from cache to prevent the "-" reset effect
        const cachedCount = localStorage.getItem( countId )
        if ( cachedCount !== null && el ) {
          el.innerText = cachedCount
        }

        // 2. Only query Supabase if we forced it (like adding a deed) or if count is missing
        if ( forceFetch || cachedCount === null ) {
          const fetchPromise = supabase
            .from( 'deeds' )
            .select( '*', { count: 'exact', head: true } )
            .eq( 'user_email', currentUser.email )
            .eq( 'portion', portion )
            .eq( 'deed_type', type )
            .then( ( { count, error } ) => {
              if ( !error ) {
                if ( el ) el.innerText = count || 0
                localStorage.setItem( countId, count || 0 )
              }
            } )
          promises.push( fetchPromise )
        }
      }
    }

    await Promise.all( promises )
    updateProgressBars()

  } catch ( error ) {
    console.error( 'Error fetching deed counts:', error )
  }
}

/**
 * Reads the four deed counts from localStorage, computes net scores
 * (Good − Bad) for MBH and ZBH, and updates the progress bar DOM elements.
 * Evaluation order avoids division-by-zero (see spec).
 */
function updateProgressBars () {
  const mbhGood = parseInt( localStorage.getItem( 'count-mbh-good' ) ) || 0
  const mbhBad  = parseInt( localStorage.getItem( 'count-mbh-bad' ) )  || 0
  const zbhGood = parseInt( localStorage.getItem( 'count-zbh-good' ) ) || 0
  const zbhBad  = parseInt( localStorage.getItem( 'count-zbh-bad' ) )  || 0

  const mbhNet = mbhGood - mbhBad
  const zbhNet = zbhGood - zbhBad

  const mbhValueEl  = document.getElementById( 'net-mbh' )
  const zbhValueEl  = document.getElementById( 'net-zbh' )
  const mbhBarEl    = document.getElementById( 'bar-mbh' )
  const zbhBarEl    = document.getElementById( 'bar-zbh' )
  const mbhStatusEl = document.getElementById( 'status-mbh' )
  const zbhStatusEl = document.getElementById( 'status-zbh' )
  const mbhTitle    = document.querySelector( '#portion-mbh .portion-title' )
  const zbhTitle    = document.querySelector( '#portion-zbh .portion-title' )

  if (
    !mbhValueEl || !zbhValueEl ||
    !mbhBarEl   || !zbhBarEl   ||
    !mbhStatusEl || !zbhStatusEl
  ) return

  // Format net score for display: +5, 0, -2
  const fmt = n => n > 0 ? `+${n}` : `${n}`

  // Helper: set a card to its bar state
  function applyBar ( valueEl, barEl, statusEl, titleEl, titleBase, net, pct, isLeading, statusText ) {
    valueEl.textContent = fmt( net )
    valueEl.className = 'net-score-value' + ( isLeading ? ' leading' : '' )
    barEl.style.width = pct + '%'
    barEl.className = 'progress-fill' + ( isLeading ? ' leading' : '' )
    statusEl.textContent = statusText
    statusEl.className = 'net-score-status' + ( isLeading ? ' leading' : '' )
    if ( titleEl ) titleEl.textContent = titleBase + ( isLeading ? ' 👑' : '' )
  }

  // Branch 1: both nets ≤ 0 — no winner
  if ( mbhNet <= 0 && zbhNet <= 0 ) {
    applyBar( mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet, 0, false, '' )
    applyBar( zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet, 0, false, '' )
    return
  }

  // Branch 2: tied and both positive — gold bars, no crown
  if ( mbhNet === zbhNet ) {
    ;[
      [ mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet ],
      [ zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet ]
    ].forEach( ( [ vEl, bEl, sEl, tEl, base, net ] ) => {
      vEl.textContent = fmt( net )
      vEl.className = 'net-score-value leading'
      bEl.style.width = '100%'
      bEl.className = 'progress-fill leading'
      sEl.textContent = 'Tied ✦'
      sEl.className = 'net-score-status leading'
      if ( tEl ) tEl.textContent = base   // no crown on a tie
    } )
    return
  }

  // Branch 3: one is ahead
  const mbhLeading = mbhNet > zbhNet
  const leaderNet  = mbhLeading ? mbhNet  : zbhNet
  const trailNet   = mbhLeading ? zbhNet  : mbhNet
  const trailPct   = Math.max( 0, ( trailNet / leaderNet ) * 100 )
  const gap        = leaderNet - trailNet

  applyBar(
    mbhLeading ? mbhValueEl : zbhValueEl,
    mbhLeading ? mbhBarEl   : zbhBarEl,
    mbhLeading ? mbhStatusEl : zbhStatusEl,
    mbhLeading ? mbhTitle   : zbhTitle,
    mbhLeading ? 'MBH'      : 'ZBH',
    mbhLeading ? mbhNet     : zbhNet,
    100, true, `Leading by ${gap} ✦`
  )
  applyBar(
    mbhLeading ? zbhValueEl : mbhValueEl,
    mbhLeading ? zbhBarEl   : mbhBarEl,
    mbhLeading ? zbhStatusEl : mbhStatusEl,
    mbhLeading ? zbhTitle   : mbhTitle,
    mbhLeading ? 'ZBH'      : 'MBH',
    mbhLeading ? zbhNet     : mbhNet,
    trailPct, false, `${gap} behind`
  )
}
