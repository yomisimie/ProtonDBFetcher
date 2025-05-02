// ==UserScript==
// @name         ProtonDB Fetcher with Auto Fetch Option
// @namespace    https://lestrades.com
// @version      2.2
// @description  Fetch and view ProtonDB data on lestrades.com with menu commands, caching, and auto-fetch option at page load.
// @match        https://lestrades.com/game/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @connect      protondb.com
// ==/UserScript==

(function () {
  'use strict';

GM_addStyle(`
  #protondb-lightbox {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  }

  .lightbox-content {
    background: #1e1e1e; color: #f0f0f0;
    padding: 20px; border-radius: 8px;
    max-width: 80%;
    box-shadow: 0 0 10px rgba(0,0,0,0.7); text-align: center;
  }

  .lightbox-content h2 { margin-top: 0; }

  .lightbox-content button {
    margin-top: 15px;
    padding: 8px 12px;
    background: #444;
    border: none;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
  }

  .lightbox-content button:hover {
    background: #666;
  }

  .lightbox-content a {
    color: #61dafb;
    text-decoration: underline;
  }
  .lightbox-row {
  border-bottom: 1px solid #000;
  padding: 5px 0;
  }
`);


  const AUTO_FETCH_KEY = "autoFetchProtonDB"; // Store the state of the auto-fetch checkbox
  const CACHE_KEY = 'protondb_cache_all';
  let autoFetchMenuCommandId = null; // Store the ID of the Auto Fetch menu command to unregister it later

  // Register menu commands
  registerMenuCommands();

  function registerMenuCommands() {
    GM_registerMenuCommand("📥 Fetch ProtonDB Data", fetchProtonDB);
    GM_registerMenuCommand("📂 View Cached Data", viewCachedProtonDB);
    GM_registerMenuCommand("🗑️ Clear Cached Data", clearCachedProtonDB);
    updateAutoFetchMenuCommand();
  }

  // Update Auto Fetch menu command based on current state
  function updateAutoFetchMenuCommand() {
    const autoFetchEnabled = GM_getValue(AUTO_FETCH_KEY, false);
    const commandLabel = autoFetchEnabled ? "⚙️ Toggle Auto Fetch (ON)" : "⚙️ Toggle Auto Fetch (OFF)";

    // If a menu command already exists, unregister it first
    if (autoFetchMenuCommandId !== null) {
      GM_unregisterMenuCommand(autoFetchMenuCommandId);
    }

    // Register a new Auto Fetch menu command with the updated label
    autoFetchMenuCommandId = GM_registerMenuCommand(commandLabel, toggleAutoFetch);
  }

  // Toggle the auto-fetch option (Checkbox in Tampermonkey menu)
  function toggleAutoFetch() {
    const currentValue = GM_getValue(AUTO_FETCH_KEY, false);
    GM_setValue(AUTO_FETCH_KEY, !currentValue);
    updateAutoFetchMenuCommand();
    alert(`Auto Fetch is now ${!currentValue ? "Enabled" : "Disabled"}`);
  }

  // Get appId from a link inside the #game-info container
  function getAppIdFromUrl() {
    const container = document.querySelector('#game-info');
    if (container) {
      const link = container.querySelector('a[href*="store.steampowered.com/app/"]');
      if (link) {
        const match = link.href.match(/store\.steampowered\.com\/app\/(\d+)\//);
        return match ? match[1] : null;
      }
    }
    return null;
  }

  // Fetch and cache ProtonDB data
function fetchProtonDB() {
  const appId = getAppIdFromUrl();
  if (!appId) return;

  const url = `https://www.protondb.com/api/v1/reports/summaries/${appId}.json`;

  console.log("Fetching ProtonDB data from:", url);

  GM_xmlhttpRequest({
    method: "GET",
    url,
    onload: (response) => {
      try {
        const data = JSON.parse(response.responseText);

        // Capture the game title from <h1 id="game-title">
        const gameTitle = getGameTitle();

        // Store the game title along with the other data
        const fullData = {
          ...data,
          name: gameTitle // Save the title to cache
        };

        // Cache with timestamp and game title
        setCache(appId, fullData);
        displayProtonDBData(fullData);
      } catch (e) {
        console.error("Parse error:", e);
      }
    },
    onerror: (err) => {
      console.error("Request error:", err);
    }
  });
}


    function getGameTitle() {
  const titleElement = document.querySelector('h1#game-title');
  if (titleElement) {
    // Get text content, excluding the text inside <span> tags
    const span = titleElement.querySelector('span');
    if (span) {
      // Remove the span content
      span.remove();
    }
    return titleElement.textContent.trim(); // Return the cleaned title
  }
  return "Unknown Title"; // Default if no title found
}

function setCache(appId, data) {
    const allCache = JSON.parse(GM_getValue(CACHE_KEY, '{}'));
    allCache[appId] = {
        data, // Store the data along with the title
        timestamp: Date.now()
    };
    GM_setValue(CACHE_KEY, JSON.stringify(allCache));
}


  // View cached data
async function viewCachedProtonDB() {
  // Get all the cached data
  const allCache = JSON.parse(GM_getValue(CACHE_KEY, '{}'));

  if (Object.keys(allCache).length === 0) {
    alert("No cached data found!");
    return;
  }

  // Create a list to show the cached data
  let cacheContent = '';

  for (const appId in allCache) {
    const entry = allCache[appId];
    if (entry && entry.data) {
      const gameTitle = entry.data.name || 'Unknown Game'; // Use the stored title
      const tier = entry.data.tier || 'Unknown';
      const tierColor = getTierColor(tier);

      cacheContent += `
        <div class="lightbox-row">
          <span class="lightbox-title">${gameTitle}</span>&nbsp;|&nbsp;
          <span class="lightbox-tier" style="color: ${tierColor}"><strong>${tier}</strong></span>&nbsp;|&nbsp;
          <a class="lightbox-link" href="https://www.protondb.com/app/${appId}" target="_blank">View on ProtonDB</a>
        </div>
      `;
    }
  }

  // Display all cached data in the lightbox
  displayLightbox('all', 'All Cached Games', cacheContent);
}


function displayLightbox(appId, title, content) {
  let lightbox = document.getElementById('protondb-lightbox');

  // If lightbox doesn't exist, create it
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'protondb-lightbox'; // Ensure it has the appropriate ID for styling
  }

  // Clear previous content if any
  lightbox.innerHTML = '';

  // Create the inner content of the lightbox (use class names for styling)
  const lightboxContent = document.createElement('div');
  lightboxContent.className = 'lightbox-content'; // Assuming this class is styled in your CSS

  // Title
  const titleElement = document.createElement('h3');
  titleElement.textContent = title;
  lightboxContent.appendChild(titleElement);

  // Append the passed content (cache data) inside the lightbox
  lightboxContent.innerHTML += content;

  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.className = 'lightbox-close'; // Assuming this class is styled in your CSS
  closeButton.onclick = () => {
    document.body.removeChild(lightbox); // Close the lightbox
  };

  lightboxContent.appendChild(closeButton);

  // Append content to lightbox and lightbox to the body
  lightbox.appendChild(lightboxContent);
  document.body.appendChild(lightbox);
}

  function getCache(appId) {
      const allCache = JSON.parse(GM_getValue(CACHE_KEY, '{}'));
      const entry = allCache[appId];
      if (!entry) return null;
      const now = Date.now();
      return (now - entry.timestamp) < 30 * 24 * 60 * 60 * 1000 ? entry : null;
  }

  // Clear cache
function clearCachedProtonDB() {
  GM_setValue(CACHE_KEY, JSON.stringify([]));
  alert("Cache cleared.");
  const existing = document.getElementById("protondb-result");
  if (existing) existing.remove();
}

  function insertLinkInPage(appId, data) {
      const container = document.querySelector("#game-info");
      const tierColor = getTierColor(data.tier);
      const logoImg = document.createElement("img");
      logoImg.src = 'https://www.protondb.com/sites/protondb/images/site-logo.svg'; // The ProtonDB logo
      logoImg.alt = `ProtonDB Tier: ${data.tier || "Unknown"}`;
      logoImg.style = `height: 20px; vertical-align: middle;`;

      const tierText = document.createElement("span");
      tierText.textContent = data.tier || "Unknown";
      tierText.style = `color: ${tierColor}; font-weight: bold; margin-left: 5px; vertical-align: middle;`;

      // Create the clickable link wrapping the logo and tier text
      const protonDBLink = document.createElement("a");
      protonDBLink.href = `https://www.protondb.com/app/${appId}`;
      protonDBLink.target = "_blank"; // Open in a new tab
      protonDBLink.style = "text-decoration: none; display: inline-flex; align-items: center;"; // Inline-flex to align logo and text

      // Append the logo and tier text to the link
      protonDBLink.appendChild(logoImg);
      protonDBLink.appendChild(tierText);

      const wrapper = document.createElement("div"); // Make it a block-level element (div)
      wrapper.id = "protondb-result"; // Set the ID for easy removal or replacement

      wrapper.appendChild(protonDBLink); // Add the clickable link to the wrapper

      const link = container.querySelector('a[href*="store.steampowered.com/app/"]');
      if (link) {
        link.parentNode.insertBefore(wrapper, link.nextSibling);
      }
  }

  // Display result inside #game-info
  function displayProtonDBData(data) {
    const container = document.querySelector("#game-info");
    if (!container) return;

      const appId = getAppIdFromUrl();
      const dataFromCache = getCache(appId);
      if (dataFromCache) {
          const existing = document.getElementById("protondb-result");
          if (existing) existing.remove();
          insertLinkInPage(appId, dataFromCache.data);
      }
  }

  // Return the color for a given tier based on provided colors (using lowercase tier names)
  function getTierColor(tier) {
    const lowerCaseTier = (tier || "").toLowerCase(); // Ensure tier is lowercase for matching

    switch (lowerCaseTier) {
      case 'platinum':
        return '#b4c7dc'; // Light Blue-Gray
      case 'native':
        return '#008000'; // Green
      case 'gold':
        return '#cfb53b'; // Gold
      case 'bronze':
        return '#cd7f32'; // Bronze
      case 'borked':
        return '#ff0000'; // Red
      case 'silver':
        return '#a6a6a6'; // Silver-Gray
      default:
        return '#2196F3'; // Blue (for unknown)
    }
  }

  // On page load, check for cached data and display ProtonDB logo next to the Steam link
  (function onPageLoad() {
    const appId = getAppIdFromUrl();
    if (!appId) return;

      const data = getCache(appId);
      if (data) {
    const container = document.querySelector("#game-info");

      // Look for the link in #game-info and append the ProtonDB logo with the tier text and color
      const link = container.querySelector('a[href*="store.steampowered.com/app/"]');
      if (link) {
        insertLinkInPage(appId, data.data);
      }
    } else {
      const autoFetchEnabled = GM_getValue(AUTO_FETCH_KEY, false);
      if (autoFetchEnabled) {
        fetchProtonDB(); // Auto fetch if enabled
      }
    }
  })();

})();
