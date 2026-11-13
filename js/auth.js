// =============== FIREBASE AUTH + SYNC ===============
let currentUser = null;
let firestoreUnsubscribe = null;
let syncInProgress = false;
let pendingSyncTimer = null;
let suppressSync = false; // Suppress sync during data load
let hasLoadedFromCloud = false; // Track if we've successfully loaded from cloud at least once

function setSyncStatus(status, text) {
  const el = $('syncStatus');
  const textEl = $('syncStatusText');
  if (!el) return;
  el.classList.remove('synced', 'syncing', 'offline');
  el.classList.add(status);
  if (textEl) textEl.textContent = text || status.toUpperCase();
}

function showLoginScreen() {
  const screen = $('loginScreen');
  if (screen) screen.classList.remove('hidden');
}

function hideLoginScreen() {
  const screen = $('loginScreen');
  if (screen) screen.classList.add('hidden');
}

function showLoginError(msg) {
  const err = $('loginError');
  if (err) {
    err.textContent = msg;
    err.classList.add('show');
  }
}

function hideLoginError() {
  const err = $('loginError');
  if (err) err.classList.remove('show');
}

// Wait for Firebase to be ready
function whenFirebaseReady(callback) {
  if (window.firebaseApp) {
    callback();
  } else {
    window.addEventListener('firebase-ready', callback, { once: true });
  }
}

// Sign in with Google
async function signInWithGoogle() {
  if (!window.firebaseApp) {
    showLoginError('Firebase ještě nenačten, počkejte chvíli...');
    return;
  }
  const btn = $('loginBtn');
  const btnText = $('loginBtnText');
  hideLoginError();
  if (btn) btn.classList.add('loading');
  if (btnText) btnText.textContent = 'Přihlašování...';
  try {
    const { auth, provider, signInWithPopup } = window.firebaseApp;
    await signInWithPopup(auth, provider);
    // onAuthStateChanged se postará o zbytek
  } catch (err) {
    console.error('Sign in error:', err);
    // Popup selhal — fallback na redirect (funguje vždy na localhostu)
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') {
      try {
        const { auth, provider, signInWithRedirect } = window.firebaseApp;
        await signInWithRedirect(auth, provider);
        // Stránka se přesměruje — loading zůstane aktivní
        return;
      } catch (redirectErr) {
        console.error('Redirect sign in error:', redirectErr);
      }
    }
    let msg = 'Chyba přihlášení';
    if (err.code === 'auth/popup-blocked') msg = 'Prohlížeč zablokoval pop-up — zkuste znovu (přesměrování).';
    else if (err.code === 'auth/popup-closed-by-user') msg = 'Přihlášení zrušeno';
    else if (err.code === 'auth/network-request-failed') msg = 'Žádné internetové spojení';
    else if (err.message) msg = err.message;
    showLoginError(msg);
    if (btn) btn.classList.remove('loading');
    if (btnText) btnText.textContent = 'Přihlásit přes Google';
  }
}

// Sign out
async function signOutUser() {
  if (!window.firebaseApp || !currentUser) return;
  if (!confirm('Opravdu odhlásit? Data zůstanou v cloudu, pouze ukončíte synchronizaci na tomto zařízení.')) return;
  try {
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    await window.firebaseApp.signOut(window.firebaseApp.auth);
    // onAuthStateChanged se postará o zbytek
  } catch (err) {
    console.error('Sign out error:', err);
    showToast('Chyba při odhlášení', 'error');
  }
}

// Load data from Firestore on first login (or merge)
async function loadFromFirestore(userId) {
  setSyncStatus('syncing', 'NAČÍTÁM');
  try {
    const { db, doc, getDoc } = window.firebaseApp;
    const userDocRef = doc(db, 'users', userId, 'data', 'main');
    const snapshot = await getDoc(userDocRef);

    if (snapshot.exists()) {
      // Cloud data exists
      const cloudData = snapshot.data();
      const cloudTrans = cloudData.transactions || [];
      const cloudInv = cloudData.inventory || [];

      // Check if we have local data different from cloud
      const localHasData = transactions.length > 0 || inventory.length > 0;
      const cloudHasData = cloudTrans.length > 0 || cloudInv.length > 0;

      if (localHasData && cloudHasData) {
        // BOTH have data - ask user
        const localTotal = transactions.length + inventory.length;
        const cloudTotal = cloudTrans.length + cloudInv.length;
        const msg = `KONFLIKT DAT:\n\nLokálně máte ${transactions.length} transakcí, ${inventory.length} pohybů skladu.\nV cloudu je ${cloudTrans.length} transakcí, ${cloudInv.length} pohybů skladu.\n\nKliknutím OK: použít CLOUDOVÁ data (lokální budou nahrazena)\nKliknutím CANCEL: použít LOKÁLNÍ data (cloud bude přepsán)`;
        if (confirm(msg)) {
          // Use cloud data
          suppressSync = true;
          transactions = cloudTrans;
          inventory = cloudInv;
          saveTrans();
          saveInv();
          suppressSync = false;
          showToast('Cloudová data načtena');
        } else {
          // Keep local, upload to cloud
          await syncToFirestore();
          showToast('Lokální data nahrána do cloudu');
        }
      } else if (cloudHasData) {
        // Only cloud has data - load it
        suppressSync = true;
        transactions = cloudTrans;
        inventory = cloudInv;
        saveTrans();
        saveInv();
        suppressSync = false;
        showToast(`Načteno ${cloudTrans.length} transakcí z cloudu`);
      } else if (localHasData) {
        // Only local has data - upload it
        await syncToFirestore();
        showToast('Lokální data nahrána do cloudu');
      }
      // else: both empty, nothing to do
    } else {
      // No cloud data yet - if we have local, upload it
      if (transactions.length > 0 || inventory.length > 0) {
        await syncToFirestore();
        showToast('Data nahrána do cloudu');
      }
    }

    // Now subscribe to real-time updates
    subscribeToFirestore(userId);
    hasLoadedFromCloud = true;
    setSyncStatus('synced', 'SYNCED');
    render();
  } catch (err) {
    console.error('Load from Firestore error:', err);
    setSyncStatus('offline', 'OFFLINE');
    showToast('Chyba načítání z cloudu', 'error');
  }
}

// Subscribe to real-time Firestore updates
function subscribeToFirestore(userId) {
  if (firestoreUnsubscribe) firestoreUnsubscribe();
  const { db, doc, onSnapshot } = window.firebaseApp;
  const userDocRef = doc(db, 'users', userId, 'data', 'main');

  firestoreUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
    if (!snapshot.exists()) return;
    // Skip if this is from our own write (avoid loop)
    if (snapshot.metadata.hasPendingWrites) return;

    const cloudData = snapshot.data();
    const cloudTrans = cloudData.transactions || [];
    const cloudInv = cloudData.inventory || [];

    // Update local state from cloud
    const localStr = JSON.stringify({ t: transactions, i: inventory });
    const cloudStr = JSON.stringify({ t: cloudTrans, i: cloudInv });

    if (localStr !== cloudStr) {
      suppressSync = true;
      transactions = cloudTrans;
      inventory = cloudInv;
      saveTrans();
      saveInv();
      suppressSync = false;
      render();
      console.log('[Sync] Data updated from cloud');
    }

    setSyncStatus('synced', 'SYNCED');
  }, (err) => {
    console.error('Firestore subscription error:', err);
    setSyncStatus('offline', 'OFFLINE');
  });
}

// Push current data to Firestore (debounced)
async function syncToFirestore() {
  if (!currentUser || !window.firebaseApp || suppressSync) return;
  if (syncInProgress) return;

  // SAFETY: Don't push empty data on top of cloud data we haven't loaded yet
  // This prevents accidental data wipe if user clears browser data
  if (transactions.length === 0 && inventory.length === 0 && !hasLoadedFromCloud) {
    console.log('[Sync] Skipping empty push - cloud data not loaded yet');
    return;
  }

  syncInProgress = true;
  setSyncStatus('syncing', 'SYNCING');
  try {
    const { db, doc, setDoc } = window.firebaseApp;
    const userDocRef = doc(db, 'users', currentUser.uid, 'data', 'main');
    await setDoc(userDocRef, {
      transactions: transactions,
      inventory: inventory,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser.email
    });
    setSyncStatus('synced', 'SYNCED');
  } catch (err) {
    console.error('Sync to Firestore error:', err);
    setSyncStatus('offline', 'OFFLINE');
  } finally {
    syncInProgress = false;
  }
}

// Debounced sync - wait 1 sec after last change before syncing
function scheduleSync() {
  if (!currentUser || suppressSync) return;
  if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
  setSyncStatus('syncing', 'CHANGED');
  pendingSyncTimer = setTimeout(() => {
    syncToFirestore();
  }, 1000);
}

// Patch saveTrans and saveInv to also trigger sync
const _originalSaveTrans = saveTrans;
const _originalSaveInv = saveInv;
window.saveTrans = function() {
  _originalSaveTrans();
  scheduleSync();
};
window.saveInv = function() {
  _originalSaveInv();
  scheduleSync();
};
// Need to override local refs too (used internally)
saveTrans = window.saveTrans;
saveInv = window.saveInv;

// Online/offline detection
window.addEventListener('online', () => {
  if (currentUser) {
    setSyncStatus('syncing', 'RECONNECT');
    syncToFirestore();
  }
});
window.addEventListener('offline', () => {
  setSyncStatus('offline', 'OFFLINE');
});

// Init Firebase auth listener
whenFirebaseReady(() => {
  const { auth, onAuthStateChanged, getRedirectResult } = window.firebaseApp;

  // Zpracuj výsledek po přesměrování Google login
  if (getRedirectResult) {
    getRedirectResult(auth).catch((err) => {
      if (err && err.code !== 'auth/no-current-user') {
        console.error('Redirect result error:', err);
        showLoginError(err.message || 'Chyba přihlášení přes redirect');
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User signed in
      currentUser = user;
      console.log('[Auth] Signed in as:', user.email);

      // Update menu user info
      const nameEl = $('menuUserName');
      const emailEl = $('menuUserEmail');
      const infoEl = $('menuUserInfo');
      if (nameEl) nameEl.textContent = user.displayName || user.email;
      if (emailEl) emailEl.textContent = user.email;
      if (infoEl) infoEl.style.display = 'block';

      // Hide login screen
      hideLoginScreen();

      // Load data from Firestore
      if (navigator.onLine) {
        loadFromFirestore(user.uid);
      } else {
        setSyncStatus('offline', 'OFFLINE');
        showToast('Offline - data jen lokálně');
      }
    } else {
      // User signed out
      currentUser = null;
      hasLoadedFromCloud = false;
      console.log('[Auth] Signed out');

      // Reset UI
      const infoEl = $('menuUserInfo');
      if (infoEl) infoEl.style.display = 'none';

      // Clear local data (data zůstávají v cloudu)
      transactions = [];
      inventory = [];
      saveTrans();
      saveInv();
      render();

      // Show login screen
      showLoginScreen();

      // Reset login button
      const btn = $('loginBtn');
      const btnText = $('loginBtnText');
      if (btn) btn.classList.remove('loading');
      if (btnText) btnText.textContent = 'Přihlásit přes Google';
    }
  });
});

// Expose globally so onclick attribute works as fallback
window.signInWithGoogle = signInWithGoogle;

// Wire up login button
const loginBtn = $('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', signInWithGoogle);

// Wire up sign out
const signOutBtn = $('menuSignOut');
if (signOutBtn) signOutBtn.addEventListener('click', () => {
  if (headerDropdown) headerDropdown.classList.remove('open');
  signOutUser();
});
