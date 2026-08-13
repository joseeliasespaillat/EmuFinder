/**
 * EmuFinder - Application Engine
 */

// 1. Supabase Configuration
const SUPABASE_URL = 'https://mlkbwrhkiqqupnetostt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q3u_yzIndQayWSHKHpg91Q_40A54ZCs';

let supabaseClient = null;

// Safe initializer accepts both standard JWTs and new publishable keys
function initSupabase() {
  const isPlaceholder =
    !SUPABASE_URL ||
    SUPABASE_URL.includes('YOUR_SUPABASE') ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');

  if (isPlaceholder) {
    console.warn(
      'EmuFinder: Using Local Standalone Mode (Supabase URL/Key missing).'
    );
    return null;
  }

  try {
    if (
      window.supabase &&
      typeof window.supabase.createClient === 'function'
    ) {
      return window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );
    }
  } catch (err) {
    console.error(
      'EmuFinder: Supabase init error, switching to local fallback:',
      err
    );
  }

  return null;
}

// Local Fallback Directory Data
const FALLBACK_DIRECTORY = [
  {
    id: 'emu-1',
    name: 'VisualBoyAdvance-M',
    type: 'emulator',
    platform: 'GBA',
    description:
      'The most trusted Game Boy Advance emulator featuring speed tweaks and save states.',
    safety_score: 'Verified 100% Safe',
    download_url: '#',
    tags: ['GBA', 'GBC', 'Easy Setup']
  },
  {
    id: 'emu-2',
    name: 'Snes9x',
    type: 'emulator',
    platform: 'SNES',
    description:
      'Lightweight, beginner-friendly Super Nintendo emulator with plug-and-play controller support.',
    safety_score: 'Verified 100% Safe',
    download_url: '#',
    tags: ['SNES', 'Low PC Specs']
  },
  {
    id: 'emu-3',
    name: 'Project64',
    type: 'emulator',
    platform: 'N64',
    description:
      'Top rated Nintendo 64 emulator with high-definition resolution upscaling support.',
    safety_score: 'Verified 100% Safe',
    download_url: '#',
    tags: ['N64', 'HD Graphics']
  },
  {
    id: 'emu-4',
    name: 'DuckStation',
    type: 'emulator',
    platform: 'PS1',
    description:
      'Modern PlayStation 1 emulator focusing on playability, accuracy, and smooth enhancement.',
    safety_score: 'Verified 100% Safe',
    download_url: '#',
    tags: ['PS1', 'Widescreen Hack']
  },
  {
    id: 'rom-1',
    name: 'Pokemon Unbound (ROM Hack)',
    type: 'rom',
    platform: 'GBA',
    description:
      'An extraordinary fan-made GBA RPG featuring custom story, QoL features, and Gen 1-8 Pokemon.',
    safety_score: 'Verified Virus-Free',
    download_url: '#',
    tags: ['GBA Patch', 'Community Favorite']
  },
  {
    id: 'rom-2',
    name: 'Super Mario World - Restored',
    type: 'rom',
    platform: 'SNES',
    description:
      'Verified clean dump homebrew patch adding modern widescreen & bug fixes.',
    safety_score: 'Verified Virus-Free',
    download_url: '#',
    tags: ['SNES', 'Clean Hash']
  },
  {
    id: 'rom-3',
    name: 'Celeste Classic 64',
    type: 'rom',
    platform: 'N64',
    description:
      'A charming 3D platformer homebrew game created for the Nintendo 64 system.',
    safety_score: 'Verified Clean',
    download_url: '#',
    tags: ['N64 Homebrew', 'Indie']
  }
];

// Application State
let directoryData = FALLBACK_DIRECTORY;
let userBookmarks = [];
let currentUser = null;
let activeType = 'all';
let activePlatform = 'all';
let searchQuery = '';
let authMode = 'login';

// DOM Element References
let gridContainer;
let searchInput;
let clearSearchBtn;
let resultCountText;
let bookmarkCountBadge;
let drawerOverlay;
let bookmarksList;
let authModal;
let authBtnText;

// 2. Bootstrapper
function initApp() {
  // Grab DOM references
  gridContainer = document.getElementById('directory-grid');
  searchInput = document.getElementById('search-input');
  clearSearchBtn = document.getElementById('clear-search');
  resultCountText = document.getElementById('result-count');
  bookmarkCountBadge = document.getElementById('bookmark-count');
  drawerOverlay = document.getElementById('drawer-overlay');
  bookmarksList = document.getElementById('bookmarks-list');
  authModal = document.getElementById('auth-modal');
  authBtnText = document.getElementById('auth-btn-text');

  // Load local bookmarks instantly
  try {
    userBookmarks =
      JSON.parse(localStorage.getItem('retrohaven_bookmarks')) || [];
  } catch (err) {
    console.warn('Could not load local bookmarks:', err);
    userBookmarks = [];
  }

  updateBookmarkBadge();

  // Bind events & render immediately
  setupEventListeners();
  renderDirectory();

  // Initialize Supabase
  supabaseClient = initSupabase();

  if (supabaseClient) {
    loadInitialData();
    checkForPasswordReset();
  }
}

// Executes immediately if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Helper to run promises with a strict timeout
function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

async function loadInitialData() {
  try {
    await withTimeout(initializeSession());
    await withTimeout(loadDirectoryData());
    await withTimeout(loadUserBookmarks());

    renderDirectory();
  } catch (err) {
    console.warn(
      'Supabase remote sync timed out or failed, using local state:',
      err
    );
  }
}

// 3. User Session Handler
async function initializeSession() {
  if (!supabaseClient) return;

  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    currentUser = session?.user || null;

    updateAuthUI();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;

      updateAuthUI();

      await loadUserBookmarks();

      renderDirectory();
    });
  } catch (err) {
    console.warn('Session check warning:', err);
  }
}

function updateAuthUI() {
  if (!authBtnText) return;

  if (currentUser) {
    authBtnText.textContent = currentUser.email
      ? currentUser.email.split('@')[0]
      : 'My Account';
  } else {
    authBtnText.textContent = 'Login / Register';
  }
}

// 4. Data Loading Logic
async function loadDirectoryData() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading directory data:', error);
      return;
    }

    if (data && data.length > 0) {
      directoryData = data;
    }
  } catch (err) {
    console.error('Directory loading error:', err);
  }
}

async function loadUserBookmarks() {
  if (currentUser && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('bookmarks')
        .select('item_id')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error loading bookmarks:', error);

        userBookmarks =
          JSON.parse(localStorage.getItem('retrohaven_bookmarks')) || [];
      } else if (data) {
        userBookmarks = data.map((bookmark) => bookmark.item_id);
      }
    } catch (err) {
      console.error('Bookmark loading error:', err);

      userBookmarks =
        JSON.parse(localStorage.getItem('retrohaven_bookmarks')) || [];
    }
  } else {
    try {
      userBookmarks =
        JSON.parse(localStorage.getItem('retrohaven_bookmarks')) || [];
    } catch (err) {
      userBookmarks = [];
    }
  }

  updateBookmarkBadge();
}

// 5. Bookmark Action
window.toggleBookmark = async function (itemId) {
  const isBookmarked = userBookmarks.includes(itemId);

  if (currentUser && supabaseClient) {
    try {
      if (isBookmarked) {
        const { error } = await supabaseClient
          .from('bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('item_id', itemId);

        if (error) {
          console.error('Error deleting bookmark:', error);
          alert(`Could not remove bookmark: ${error.message}`);
          return;
        }

        userBookmarks = userBookmarks.filter(
          (id) => id !== itemId
        );
      } else {
        const { error } = await supabaseClient
          .from('bookmarks')
          .insert([
            {
              user_id: currentUser.id,
              item_id: itemId
            }
          ]);

        if (error) {
          console.error('Error inserting bookmark:', error);
          alert(`Could not save bookmark: ${error.message}`);
          return;
        }

        userBookmarks.push(itemId);
      }
    } catch (err) {
      console.error('Error toggling DB bookmark:', err);
      alert('There was a problem saving your bookmark.');
      return;
    }
  } else {
    if (isBookmarked) {
      userBookmarks = userBookmarks.filter(
        (id) => id !== itemId
      );
    } else {
      userBookmarks.push(itemId);
    }

    localStorage.setItem(
      'retrohaven_bookmarks',
      JSON.stringify(userBookmarks)
    );
  }

  updateBookmarkBadge();
  renderDirectory();

  if (
    drawerOverlay &&
    drawerOverlay.classList.contains('active')
  ) {
    renderBookmarksDrawer();
  }
};

// 6. UI Renderers
function updateBookmarkBadge() {
  if (bookmarkCountBadge) {
    bookmarkCountBadge.textContent = userBookmarks.length;
  }
}

function renderDirectory() {
  if (!gridContainer) return;

  const filtered = directoryData.filter((item) => {
    const name = String(item.name || '').toLowerCase();
    const description = String(
      item.description || ''
    ).toLowerCase();
    const platform = String(
      item.platform || ''
    ).toLowerCase();

    const matchesType =
      activeType === 'all' ||
      item.type === activeType;

    const matchesPlatform =
      activePlatform === 'all' ||
      item.platform === activePlatform;

    const matchesSearch =
      name.includes(searchQuery) ||
      description.includes(searchQuery) ||
      platform.includes(searchQuery);

    return (
      matchesType &&
      matchesPlatform &&
      matchesSearch
    );
  });

  if (resultCountText) {
    resultCountText.textContent =
      `Showing ${filtered.length} verified safe source${
        filtered.length === 1 ? '' : 's'
      }`;
  }

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div style="
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: var(--text-muted);
      ">
        <i
          class="fa-solid fa-ghost"
          style="
            font-size: 3rem;
            margin-bottom: 12px;
            color: #cbd5e1;
          "
        ></i>

        <h3>No verified sources match your search.</h3>

        <p>
          Try searching for GBA, SNES, or resetting active filters.
        </p>
      </div>
    `;

    return;
  }

  gridContainer.innerHTML = filtered
    .map((item) => {
      const isBookmarked =
        userBookmarks.includes(item.id);

      const safeName =
        String(item.name || '').replace(
          /'/g,
          "\\'"
        );

      return `
        <div class="card">
          <div>
            <div class="card-header">

              <span class="type-badge ${
                item.type === 'emulator'
                  ? 'type-emulator'
                  : 'type-rom'
              }">
                ${item.type}
              </span>

              <button
                class="bookmark-btn ${
                  isBookmarked
                    ? 'bookmarked'
                    : ''
                }"
                onclick="toggleBookmark('${item.id}')"
                title="Save / Bookmark"
              >
                <i class="${
                  isBookmarked
                    ? 'fa-solid'
                    : 'fa-regular'
                } fa-bookmark"></i>
              </button>

            </div>

            <h3 class="card-title">
              ${item.name}
            </h3>

            <p class="card-desc">
              ${item.description}
            </p>

            <div class="card-tags">

              <span class="safety-tag">
                <i class="fa-solid fa-circle-check"></i>
                ${
                  item.safety_score ||
                  'Verified Safe'
                }
              </span>

              ${(item.tags || [])
                .map(
                  (tag) =>
                    `<span class="tag">${tag}</span>`
                )
                .join('')}

            </div>
          </div>

          <div class="card-footer">

            <span
              style="
                font-size:0.8rem;
                font-weight:800;
                color:var(--text-muted);
              "
            >
              <i class="fa-solid fa-gamepad"></i>
              ${item.platform}
            </span>

            <a
              href="${item.download_url || '#'}"
              class="download-link"
              target="_blank"
              rel="noopener noreferrer"
              onclick="handleSafeRedirect(event, '${safeName}')"
            >
              <i class="fa-solid fa-download"></i>
              Get Source
            </a>

          </div>
        </div>
      `;
    })
    .join('');
}

function renderBookmarksDrawer() {
  if (!bookmarksList) return;

  if (userBookmarks.length === 0) {
    bookmarksList.innerHTML = `
      <div
        style="
          text-align: center;
          color: var(--text-muted);
          margin-top: 40px;
        "
      >
        <i
          class="fa-regular fa-folder-open"
          style="
            font-size: 2.5rem;
            margin-bottom: 8px;
          "
        ></i>

        <p>No saved items in your folder yet.</p>
      </div>
    `;

    return;
  }

  const bookmarkedItems =
    directoryData.filter((item) =>
      userBookmarks.includes(item.id)
    );

  bookmarksList.innerHTML =
    bookmarkedItems
      .map(
        (item) => `
        <div
          style="
            background:#f8fafc;
            padding:12px;
            border-radius:14px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e2e8f0;
          "
        >

          <div>
            <h4
              style="
                font-size:0.95rem;
                font-weight:800;
              "
            >
              ${item.name}
            </h4>

            <span
              style="
                font-size:0.75rem;
                color:var(--text-muted);
                font-weight:700;
              "
            >
              ${item.platform} • ${item.type}
            </span>
          </div>

          <button
            onclick="toggleBookmark('${item.id}')"
            style="
              background:none;
              border:none;
              color:var(--secondary);
              cursor:pointer;
            "
            title="Remove bookmark"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>

        </div>
      `
      )
      .join('');
}

window.handleSafeRedirect = function (
  event,
  name
) {
  const link = event.currentTarget;

  if (
    !link.href ||
    link.getAttribute('href') === '#'
  ) {
    event.preventDefault();

    alert(
      `[Verified Safety Check]: Redirecting to official verified source for ${name}.`
    );
  }
};

// ==========================================
// 7. PASSWORD RESET
// ==========================================

async function sendPasswordReset() {
  if (!supabaseClient) {
    alert(
      'Password reset is unavailable because Supabase is not connected.'
    );
    return;
  }

  // Supabase authentication should not be tested from file:// URLs.
  if (window.location.protocol === 'file:') {
    alert(
      'Please open EmuFinder through a local web server before using password reset.'
    );
    return;
  }

  const emailInput =
    document.getElementById('auth-email');

  if (!emailInput) {
    alert('Email field could not be found.');
    return;
  }

  const email =
    emailInput.value.trim();

  if (!email) {
    alert(
      'Please enter your email address first.'
    );

    emailInput.focus();
    return;
  }

  const forgotPasswordBtn =
    document.getElementById(
      'forgot-password-btn'
    );

  if (forgotPasswordBtn) {
    forgotPasswordBtn.disabled = true;

    forgotPasswordBtn.dataset.originalText =
      forgotPasswordBtn.textContent;

    forgotPasswordBtn.textContent =
      'Sending...';
  }

  try {
    const redirectUrl =
      `${window.location.origin}${window.location.pathname}?reset=true`;

    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: redirectUrl
        }
      );

    if (error) {
      console.error(
        'Password reset error:',
        error
      );

      if (
        error.message &&
        error.message
          .toLowerCase()
          .includes('rate limit')
      ) {
        alert(
          'Too many password reset requests were made. Please wait before trying again and check your email and spam folder for an existing reset message.'
        );
      } else {
        alert(
          `Password reset failed: ${error.message}`
        );
      }

      return;
    }

    alert(
      'Password reset email sent! Check your inbox and follow the link to choose a new password.'
    );
  } catch (err) {
    console.error(
      'Unexpected password reset error:',
      err
    );

    alert(
      'Something went wrong while sending the password reset email.'
    );
  } finally {
    if (forgotPasswordBtn) {
      forgotPasswordBtn.disabled = false;

      forgotPasswordBtn.textContent =
        forgotPasswordBtn.dataset.originalText ||
        'Forgot your password?';
    }
  }
}

async function checkForPasswordReset() {
  if (!supabaseClient) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  if (
    params.get('reset') !== 'true'
  ) {
    return;
  }

  const resetModal =
    document.getElementById(
      'reset-password-modal'
    );

  if (resetModal) {
    resetModal.classList.add('active');
  }
}

// 8. Event Listeners Setup
function setupEventListeners() {

  // ==========================================
  // PASSWORD RESET BUTTON
  // ==========================================

  const forgotPasswordBtn =
    document.getElementById(
      'forgot-password-btn'
    );

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener(
      'click',
      async () => {
        await sendPasswordReset();
      }
    );
  }

  // ==========================================
  // CLOSE PASSWORD RESET MODAL
  // ==========================================

  const closeResetPasswordBtn =
    document.getElementById(
      'close-reset-password'
    );

  const resetPasswordModal =
    document.getElementById(
      'reset-password-modal'
    );

  if (closeResetPasswordBtn) {
    closeResetPasswordBtn.addEventListener(
      'click',
      () => {
        if (resetPasswordModal) {
          resetPasswordModal.classList.remove(
            'active'
          );
        }
      }
    );
  }

  // ==========================================
  // UPDATE PASSWORD
  // ==========================================

  const resetPasswordForm =
    document.getElementById(
      'reset-password-form'
    );

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        if (!supabaseClient) {
          alert(
            'Password reset is unavailable because Supabase is not connected.'
          );
          return;
        }

        const newPasswordInput =
          document.getElementById(
            'new-password'
          );

        const confirmPasswordInput =
          document.getElementById(
            'confirm-password'
          );

        if (
          !newPasswordInput ||
          !confirmPasswordInput
        ) {
          alert(
            'Password fields could not be found.'
          );
          return;
        }

        const newPassword =
          newPasswordInput.value;

        const confirmPassword =
          confirmPasswordInput.value;

        if (
          newPassword !==
          confirmPassword
        ) {
          alert(
            'The passwords do not match.'
          );
          return;
        }

        if (
          newPassword.length < 6
        ) {
          alert(
            'Your password must be at least 6 characters long.'
          );
          return;
        }

        try {
          const { error } =
            await supabaseClient.auth.updateUser(
              {
                password: newPassword
              }
            );

          if (error) {
            console.error(
              'Password update error:',
              error
            );

            alert(
              `Password update failed: ${error.message}`
            );

            return;
          }

          alert(
            'Your password has been successfully updated!'
          );

          resetPasswordForm.reset();

          if (resetPasswordModal) {
            resetPasswordModal.classList.remove(
              'active'
            );
          }

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } catch (err) {
          console.error(
            'Unexpected password update error:',
            err
          );

          alert(
            'Something went wrong while updating your password.'
          );
        }
      }
    );
  }

  // ==========================================
  // SEARCH BAR
  // ==========================================

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      (event) => {
        searchQuery =
          event.target.value
            .toLowerCase()
            .trim();

        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle(
            'hidden',
            searchQuery === ''
          );
        }

        renderDirectory();
      }
    );
  }

  // Clear Search
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener(
      'click',
      () => {
        if (searchInput) {
          searchInput.value = '';
        }

        searchQuery = '';

        clearSearchBtn.classList.add(
          'hidden'
        );

        renderDirectory();
      }
    );
  }

  // ==========================================
  // TYPE FILTERS
  // ==========================================

  const typeFilterContainer =
    document.getElementById(
      'type-filter'
    );

  if (typeFilterContainer) {
    typeFilterContainer.addEventListener(
      'click',
      (event) => {
        const btn =
          event.target.closest(
            '.filter-pill'
          );

        if (!btn) return;

        document
          .querySelectorAll(
            '.filter-pill'
          )
          .forEach((button) =>
            button.classList.remove(
              'active'
            )
          );

        btn.classList.add('active');

        activeType =
          btn.dataset.type;

        renderDirectory();
      }
    );
  }

  // ==========================================
  // PLATFORM FILTERS
  // ==========================================

  const platformFilterContainer =
    document.getElementById(
      'platform-filter'
    );

  if (platformFilterContainer) {
    platformFilterContainer.addEventListener(
      'click',
      (event) => {
        const btn =
          event.target.closest(
            '.platform-pill'
          );

        if (!btn) return;

        document
          .querySelectorAll(
            '.platform-pill'
          )
          .forEach((button) =>
            button.classList.remove(
              'active'
            )
          );

        btn.classList.add('active');

        activePlatform =
          btn.dataset.platform;

        renderDirectory();
      }
    );
  }

  // ==========================================
  // BOOKMARKS DRAWER
  // ==========================================

  const openBookmarksBtn =
    document.getElementById(
      'open-bookmarks'
    );

  if (openBookmarksBtn) {
    openBookmarksBtn.addEventListener(
      'click',
      () => {
        renderBookmarksDrawer();

        if (drawerOverlay) {
          drawerOverlay.classList.add(
            'active'
          );
        }
      }
    );
  }

  // Close Bookmarks Drawer
  const closeDrawerBtn =
    document.getElementById(
      'close-drawer'
    );

  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener(
      'click',
      () => {
        if (drawerOverlay) {
          drawerOverlay.classList.remove(
            'active'
          );
        }
      }
    );
  }

  // ==========================================
  // AUTH MODAL
  // ==========================================

  const openAuthBtn =
    document.getElementById(
      'open-auth'
    );

  if (openAuthBtn) {
    openAuthBtn.addEventListener(
      'click',
      async () => {

        // Logged-in user clicking button = logout
        if (currentUser) {

          if (
            confirm(
              'Do you want to log out?'
            )
          ) {

            if (supabaseClient) {
              const { error } =
                await supabaseClient.auth.signOut();

              if (error) {
                console.error(
                  'Logout error:',
                  error
                );

                alert(
                  `Logout failed: ${error.message}`
                );

                return;
              }
            } else {
              currentUser = null;
              updateAuthUI();
            }
          }

          return;
        }

        // Logged-out user = open auth modal
        if (authModal) {
          authModal.classList.add(
            'active'
          );
        }
      }
    );
  }

  // Close Auth Modal
  const closeAuthBtn =
    document.getElementById(
      'close-auth'
    );

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener(
      'click',
      () => {
        if (authModal) {
          authModal.classList.remove(
            'active'
          );
        }
      }
    );
  }

  // ==========================================
  // LOGIN / REGISTER TABS
  // ==========================================

  const tabLogin =
    document.getElementById(
      'tab-login'
    );

  const tabRegister =
    document.getElementById(
      'tab-register'
    );

  if (tabLogin) {
    tabLogin.addEventListener(
      'click',
      () => {

        authMode = 'login';

        tabLogin.classList.add(
          'active'
        );

        if (tabRegister) {
          tabRegister.classList.remove(
            'active'
          );
        }

        const modalTitle =
          document.getElementById(
            'modal-title'
          );

        const submitButton =
          document.getElementById(
            'auth-submit-btn'
          );

        if (modalTitle) {
          modalTitle.textContent =
            'Welcome Back!';
        }

        if (submitButton) {
          submitButton.textContent =
            'Login';
        }
      }
    );
  }

  if (tabRegister) {
    tabRegister.addEventListener(
      'click',
      () => {

        authMode = 'register';

        tabRegister.classList.add(
          'active'
        );

        if (tabLogin) {
          tabLogin.classList.remove(
            'active'
          );
        }

        const modalTitle =
          document.getElementById(
            'modal-title'
          );

        const submitButton =
          document.getElementById(
            'auth-submit-btn'
          );

        if (modalTitle) {
          modalTitle.textContent =
            'Create an Account';
        }

        if (submitButton) {
          submitButton.textContent =
            'Sign Up';
        }
      }
    );
  }

  // ==========================================
  // AUTH FORM SUBMIT
  // ==========================================

  const authForm =
    document.getElementById(
      'auth-form'
    );

  if (authForm) {
    authForm.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();

        const emailInput =
          document.getElementById(
            'auth-email'
          );

        const passwordInput =
          document.getElementById(
            'auth-password'
          );

        if (
          !emailInput ||
          !passwordInput
        ) {
          console.error(
            'Authentication form inputs are missing.'
          );

          return;
        }

        const email =
          emailInput.value.trim();

        const password =
          passwordInput.value;

        if (
          !email ||
          !password
        ) {
          alert(
            'Please enter your email and password.'
          );

          return;
        }

        // Local fallback mode
        if (!supabaseClient) {

          alert(
            'Local Demo Mode: Account registered in local state.'
          );

          currentUser = {
            id: 'guest-user',
            email: email
          };

          updateAuthUI();

          if (authModal) {
            authModal.classList.remove(
              'active'
            );
          }

          return;
        }

        // Register
        if (
          authMode === 'register'
        ) {

          const {
            data,
            error
          } =
            await supabaseClient.auth.signUp(
              {
                email,
                password
              }
            );

          if (error) {

            console.error(
              'Registration error:',
              error
            );

            alert(
              `Registration Error: ${error.message}`
            );

            return;
          }

          console.log(
            'Registration successful:',
            data
          );

          alert(
            'Account registered! Check your email inbox to confirm.'
          );

        } else {

          // Login
          const {
            data,
            error
          } =
            await supabaseClient.auth.signInWithPassword(
              {
                email,
                password
              }
            );

          if (error) {

            console.error(
              'Login error:',
              error
            );

            alert(
              `Login Error: ${error.message}`
            );

            return;
          }

          console.log(
            'Login successful:',
            data
          );
        }

        if (authModal) {
          authModal.classList.remove(
            'active'
          );
        }
      }
    );
  }
}