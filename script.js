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
let realtimeChannel = null
let welcomeShown = false
const deedTimestamps = [] // rolling window for rate limiting

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
    welcomeShown = false
    unsubscribeFromDeeds()
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
    if ( !welcomeShown ) {
      showToast( `Welcome back, ${currentUser.email}!`, "good" )
      welcomeShown = true
    }
    updateCounts()
    fetchRecentActivity()
    fetchPreviousMonthWinner()
    subscribeToDeeds()
  } else {
    // User logged in but NOT approved -> show app in view-only mode
    overlay.classList.add( 'hidden' )
    mainContainer.classList.add( 'approved', 'view-only' )
    document.getElementById( 'view-only-banner' ).style.display = 'block'
    addProfileButton()
    updateCounts()
    fetchRecentActivity()
    fetchPreviousMonthWinner()
    subscribeToDeeds()
  }
}

function showLoginScreen () {
  const overlay = document.getElementById( 'login-overlay' )
  const loginMsg = document.getElementById( 'login-message' )
  const googleBtn = document.getElementById( 'google-login-btn' )
  const logoutBtn = document.getElementById( 'supa-logout-btn' )
  const emailSection = document.getElementById( 'email-login-section' )
  const mainContainer = document.querySelector( '.container' )
  document.getElementById( 'view-only-banner' ).style.display = 'none'
  mainContainer.classList.remove( 'view-only' )

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
 * Fetches last month's deed counts and renders the summary banner.
 */
async function fetchPreviousMonthWinner () {
  if ( !currentUser ) return

  const now       = new Date()
  const prevStart = new Date( now.getFullYear(), now.getMonth() - 1, 1 )
  const prevEnd   = new Date( now.getFullYear(), now.getMonth(),     1 )
  const monthName = prevStart.toLocaleString( 'default', { month: 'long', year: 'numeric' } )

  const portions = ['MBH', 'ZBH']
  const types    = ['Good Deed', 'Bad Deed']
  const counts   = {}

  const promises = []
  for ( const portion of portions ) {
    for ( const type of types ) {
      const key = `${portion}-${type === 'Good Deed' ? 'good' : 'bad'}`
      promises.push(
        supabase
          .from( 'deeds' )
          .select( '*', { count: 'exact', head: true } )
          .eq( 'portion', portion )
          .eq( 'deed_type', type )
          .gte( 'created_at', prevStart.toISOString() )
          .lt( 'created_at', prevEnd.toISOString() )
          .is( 'undone_at', null )
          .then( ( { count, error } ) => {
            if ( !error ) counts[key] = count || 0
          } )
      )
    }
  }

  await Promise.all( promises )

  const mbhGood = counts['MBH-good'] || 0
  const mbhBad  = counts['MBH-bad']  || 0
  const zbhGood = counts['ZBH-good'] || 0
  const zbhBad  = counts['ZBH-bad']  || 0
  const total   = mbhGood + mbhBad + zbhGood + zbhBad

  const banner = document.getElementById( 'prev-month-banner' )
  if ( !banner ) return

  if ( total === 0 ) {
    banner.classList.remove( 'visible' )
    return
  }

  const mbhNet  = mbhGood - mbhBad
  const zbhNet  = zbhGood - zbhBad
  const fmt     = n => n > 0 ? `+${n}` : `${n}`
  const mbhWins = mbhNet > zbhNet
  const zbhWins = zbhNet > mbhNet

  const resultText = mbhWins ? 'MBH wins 👑' : ( zbhWins ? 'ZBH wins 👑' : 'Tied ✦' )

  // Build DOM safely (no innerHTML)
  const mk = ( tag, cls, text ) => {
    const e = document.createElement( tag )
    if ( cls  ) e.className   = cls
    if ( text !== undefined ) e.textContent = text
    return e
  }

  const left = mk( 'div', 'pmb-left' )
  left.appendChild( mk( 'span', 'pmb-label', 'Last Month' ) )
  left.appendChild( mk( 'span', 'pmb-month', monthName ) )

  const mbhScore = mk( 'div', 'pmb-score' + ( mbhWins ? ' pmb-winner' : '' ) )
  mbhScore.appendChild( mk( 'span', 'pmb-name', 'MBH' ) )
  mbhScore.appendChild( mk( 'span', 'pmb-breakdown', `⭐ ${mbhGood} · ⚠️ ${mbhBad}` ) )
  mbhScore.appendChild( mk( 'span', 'pmb-net', fmt( mbhNet ) ) )

  const zbhScore = mk( 'div', 'pmb-score' + ( zbhWins ? ' pmb-winner' : '' ) )
  zbhScore.appendChild( mk( 'span', 'pmb-name', 'ZBH' ) )
  zbhScore.appendChild( mk( 'span', 'pmb-breakdown', `⭐ ${zbhGood} · ⚠️ ${zbhBad}` ) )
  zbhScore.appendChild( mk( 'span', 'pmb-net', fmt( zbhNet ) ) )

  const scores = mk( 'div', 'pmb-scores' )
  scores.appendChild( mbhScore )
  scores.appendChild( mk( 'span', 'pmb-vs', 'vs' ) )
  scores.appendChild( zbhScore )

  const result = mk( 'div', 'pmb-result' + ( ( mbhWins || zbhWins ) ? ' pmb-result-gold' : '' ), resultText )

  banner.textContent = ''
  banner.appendChild( left )
  banner.appendChild( scores )
  banner.appendChild( result )
  banner.classList.add( 'visible' )
}

/**
 * Fetches the 10 most recent deeds and renders the activity list.
 */
async function fetchRecentActivity () {
  if ( !currentUser ) return

  const { data, error } = await supabase
    .from( 'deeds' )
    .select( 'id, portion, deed_type, created_at, undone_by, undone_at' )
    .order( 'created_at', { ascending: false } )
    .limit( 10 )

  if ( error ) {
    console.error( 'Error fetching recent activity:', error )
    return
  }

  renderRecentActivity( data || [] )
}

function renderRecentActivity ( deeds ) {
  const container = document.getElementById( 'recent-activity' )
  if ( !container ) return

  if ( deeds.length === 0 ) {
    container.classList.remove( 'visible' )
    return
  }

  const mk = ( tag, cls, text ) => {
    const e = document.createElement( tag )
    if ( cls  ) e.className   = cls
    if ( text !== undefined ) e.textContent = text
    return e
  }

  container.textContent = ''
  container.appendChild( mk( 'div', 'ra-header', 'Recent Activity' ) )

  for ( const deed of deeds ) {
    const isGood  = deed.deed_type === 'Good Deed'
    const undone  = !!deed.undone_at

    const item = mk( 'div', 'ra-item' + ( undone ? ' ra-item-undone' : '' ) )

    item.appendChild( mk( 'span', 'ra-icon', isGood ? '⭐' : '⚠️' ) )

    const details = mk( 'div', 'ra-details' )
    details.appendChild( mk( 'div', null, deed.deed_type ) )
    details.appendChild( mk( 'div', 'ra-portion', deed.portion ) )
    if ( undone ) {
      const undoneBy = deed.undone_by === currentUser.email ? 'you' : deed.undone_by
      details.appendChild( mk( 'div', 'ra-undone-label', `Undone by ${undoneBy} · ${relativeTime( deed.undone_at )}` ) )
    }
    item.appendChild( details )

    item.appendChild( mk( 'span', 'ra-time', relativeTime( deed.created_at ) ) )

    const btn = mk( 'button', undone ? 'ra-redo-btn' : 'ra-undo-btn', undone ? 'Redo' : 'Undo' )
    btn.onclick = undone ? () => redoDeed( deed.id, btn ) : () => undoDeed( deed.id, btn )
    item.appendChild( btn )

    container.appendChild( item )
  }

  container.classList.add( 'visible' )
}

function relativeTime ( dateStr ) {
  const diff = Date.now() - new Date( dateStr ).getTime()
  const mins = Math.floor( diff / 60000 )
  if ( mins < 1  ) return 'just now'
  if ( mins < 60 ) return `${mins}m ago`
  const hrs = Math.floor( mins / 60 )
  if ( hrs < 24  ) return `${hrs}h ago`
  return `${Math.floor( hrs / 24 )}d ago`
}

/**
 * Opens a Realtime subscription on the deeds table.
 * Any INSERT or DELETE on the table triggers a fresh count fetch.
 */
function subscribeToDeeds () {
  if ( realtimeChannel ) return // already subscribed

  realtimeChannel = supabase
    .channel( 'deeds-changes' )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deeds' },
      () => {
        updateCounts()
        fetchRecentActivity()
      }
    )
    .subscribe()
}

function unsubscribeFromDeeds () {
  if ( realtimeChannel ) {
    supabase.removeChannel( realtimeChannel )
    realtimeChannel = null
  }
}

/**
 * Logs a deed to the Supabase database
 */
async function logDeed ( portion, type ) {
  if ( !currentUser || !isApproved ) {
    showToast( "You must be logged in and approved to log deeds.", "error" )
    return
  }

  const now = Date.now()
  const oneMinuteAgo = now - 60_000
  // Drop timestamps outside the rolling window
  const firstValidIndex = deedTimestamps.findIndex( t => t > oneMinuteAgo )
  deedTimestamps.splice( 0, firstValidIndex === -1 ? deedTimestamps.length : firstValidIndex )
  if ( deedTimestamps.length >= 10 ) {
    const wait = Math.ceil( ( deedTimestamps[0] + 60_000 - now ) / 1000 )
    showToast( `Slow down! Try again in ${wait}s.`, "error" )
    return
  }
  deedTimestamps.push( now )

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
    updateCounts()

  } catch ( error ) {
    console.error( 'Error logging deed:', error )
    showToast( `Failed to log deed. Database error.`, "error" )
  } finally {
    buttons.forEach( b => b.style.pointerEvents = 'auto' )
  }
}

/**
 * Deletes a deed entirely — used by the toast immediately after logging.
 */
async function deleteDeed ( id, buttonElement ) {
  if ( !currentUser || !isApproved ) return

  buttonElement.disabled = true
  buttonElement.innerText = '...'

  try {
    const { error } = await supabase
      .from( 'deeds' )
      .delete()
      .eq( 'id', id )

    if ( error ) throw error

    const parentToast = buttonElement.closest( '.toast' )
    if ( parentToast ) {
      parentToast.classList.remove( 'show' )
      setTimeout( () => parentToast.remove(), 400 )
    }

    updateCounts()

  } catch ( error ) {
    console.error( 'Error deleting deed:', error )
    showToast( "Failed to undo.", "error" )
    buttonElement.disabled = false
    buttonElement.innerText = 'Undo'
  }
}

/**
 * Restores an undone deed back to active by clearing the undo fields.
 */
async function redoDeed ( id, buttonElement ) {
  if ( !currentUser || !isApproved ) return

  buttonElement.disabled = true
  buttonElement.innerText = '...'

  try {
    const { error } = await supabase
      .from( 'deeds' )
      .update( { undone_by: null, undone_at: null } )
      .eq( 'id', id )

    if ( error ) throw error

    showToast( "Deed restored.", "good" )
    updateCounts()
    fetchRecentActivity()

  } catch ( error ) {
    console.error( 'Error redoing deed:', error )
    showToast( "Failed to restore.", "error" )
    buttonElement.disabled = false
    buttonElement.innerText = 'Redo'
  }
}

/**
 * Marks a deed as undone — used from the activity list to preserve the audit trail.
 */
async function undoDeed ( id, buttonElement ) {
  if ( !currentUser || !isApproved ) return

  buttonElement.disabled = true
  buttonElement.innerText = '...'

  try {
    const { error } = await supabase
      .from( 'deeds' )
      .update( { undone_by: currentUser.email, undone_at: new Date().toISOString() } )
      .eq( 'id', id )

    if ( error ) throw error

    showToast( "Deed undone.", "info" )
    updateCounts()
    fetchRecentActivity()

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
    undoHtml = `<button class="undo-btn" onclick="deleteDeed('${deedId}', this)">Undo</button>`
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
async function updateCounts () {
  if ( !currentUser ) return

  try {
    const now = new Date()
    const monthStart     = new Date( now.getFullYear(), now.getMonth(),     1 ).toISOString()
    const monthEnd       = new Date( now.getFullYear(), now.getMonth() + 1, 1 ).toISOString()

    const portions = ['MBH', 'ZBH']
    const types = ['Good Deed', 'Bad Deed']
    const counts = {}

    const promises = []

    for ( const portion of portions ) {
      for ( const type of types ) {
        const idPrefix = portion.toLowerCase()
        const idSuffix = type === 'Good Deed' ? 'good' : 'bad'
        const countId = `count-${idPrefix}-${idSuffix}`
        const el = document.getElementById( countId )

        if ( el ) el.classList.add( 'loading' )

        const fetchPromise = supabase
          .from( 'deeds' )
          .select( '*', { count: 'exact', head: true } )
          .eq( 'portion', portion )
          .eq( 'deed_type', type )
          .gte( 'created_at', monthStart )
          .lt( 'created_at', monthEnd )
          .is( 'undone_at', null )
          .then( ( { count, error } ) => {
            if ( !error ) {
              const val = count || 0
              if ( el ) {
                el.innerText = val
                el.classList.remove( 'loading' )
              }
              counts[countId] = val
            }
          } )
        promises.push( fetchPromise )
      }
    }

    await Promise.all( promises )
    updateProgressBars( counts )

  } catch ( error ) {
    console.error( 'Error fetching deed counts:', error )
    document.querySelectorAll( '.deed-count' ).forEach( el => el.classList.remove( 'loading' ) )
  }
}

/**
 * Computes net scores (Good − Bad) for MBH and ZBH, and updates the progress bar DOM elements.
 * Evaluation order avoids division-by-zero (see spec).
 */
function updateProgressBars ( counts ) {
  const mbhGood = counts['count-mbh-good'] || 0
  const mbhBad  = counts['count-mbh-bad']  || 0
  const zbhGood = counts['count-zbh-good'] || 0
  const zbhBad  = counts['count-zbh-bad']  || 0

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
  function applyBar ( valueEl, barEl, statusEl, titleEl, titleBase, net, pct, isLeading, statusText, showCrown = isLeading ) {
    valueEl.textContent = fmt( net )
    valueEl.className = 'net-score-value' + ( isLeading ? ' leading' : '' )
    barEl.style.width = pct + '%'
    barEl.className = 'progress-fill' + ( isLeading ? ' leading' : '' )
    statusEl.textContent = statusText
    statusEl.className = 'net-score-status' + ( isLeading ? ' leading' : '' )
    if ( titleEl ) titleEl.textContent = titleBase + ( showCrown ? ' 👑' : '' )
  }

  // Branch 1: both nets ≤ 0 — no winner
  if ( mbhNet <= 0 && zbhNet <= 0 ) {
    applyBar( mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet, 0, false, '' )
    applyBar( zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet, 0, false, '' )
    return
  }

  // Branch 2: scores are equal; at least one is positive since Branch 1 already handled both ≤ 0
  // Show gold bars on both cards, no crown
  if ( mbhNet === zbhNet ) {
    applyBar( mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet, 100, true, 'Tied ✦', false )
    applyBar( zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet, 100, true, 'Tied ✦', false )
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
