// This script is injected into the Codeforces gym page.
// It adds a "Friend Gym Finder" to the right sidebar.

(async () => {
  // Ensure this only runs on the main gyms page
  if (location.pathname !== '/gyms') {
    return;
  }

  // --- Global variables ---
  let findButton, clearButton, progressText;
  let originalDatatable, originalPagination, resultsContainer;
  let resultsMap = new Map(); // Changed from array to Map for easier updates
  let totalGyms = 0;
  let processedCount = 0;

  // --- UI Creation ---
  function createFinderBox() {
    const sidebox = document.createElement('div');
    sidebox.className = 'roundbox sidebox';
    sidebox.innerHTML = `
      <div class="caption titled">→ Friend Gym Finder</div>
      <div style="margin: 1em;">
        <p style="font-size: 1.1rem; margin-bottom: 1em;">Finds 5-hour gyms from the last 8 years where your friends have virtual submissions but you do not.</p>
        <button id="cfx-findGyms" style="padding: 0 1em; width: 100%;">Find Recommended Gyms</button>
        <button id="cfx-clearResults" style="padding: 0 1em; width: 100%; margin-top: 0.5em; display: none;">Clear Results</button>
        <div id="cfx-progress" style="margin-top: 1em; font-style: italic; color: #888;"></div>
      </div>
    `;

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.prepend(sidebox);
      return true;
    }
    return false;
  }

  // --- Helper Functions (with caching) ---
  const getFriends = async (apiKey, apiSecret) => {
    try {
      const friendsList = await window.callApi('user.friends', { onlyOnline: false }, apiKey, apiSecret);
      return new Set(friendsList);
    } catch (error) {
      progressText.textContent = `Error fetching friends: ${error.message}`;
      return null;
    }
  };

  const getSubmissions = async (handle, apiKey, apiSecret) => {
    const cacheKey = `submissions-cache-${handle}`;
    const cached = await window.storage.get(cacheKey);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    if (cached[cacheKey] && cached[cacheKey].timestamp > twoHoursAgo) {
      progressText.textContent = 'Submissions loaded from cache.';
      await new Promise(resolve => setTimeout(resolve, 500));
      return cached[cacheKey].submissions;
    }
    
    try {
      progressText.textContent = 'Fetching submissions from API (this may take a moment)...';
      const submissions = await window.callApi('user.status', { handle: handle, from: 1, count: 10000 }, apiKey, apiSecret);
      await window.storage.set({ [cacheKey]: { submissions, timestamp: Date.now() } });
      return submissions;
    } catch (error) {
      progressText.textContent = `Error fetching submissions: ${error.message}`;
      return null;
    }
  };

  const getGymList = async (apiKey, apiSecret) => {
    const cacheKey = 'gym-list-cache';
    const cached = await window.storage.get(cacheKey);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    if (cached[cacheKey] && cached[cacheKey].timestamp > oneWeekAgo) {
        progressText.textContent = 'Gym list loaded from cache.';
        await new Promise(resolve => setTimeout(resolve, 500));
        return cached[cacheKey].gyms;
    }

    try {
        progressText.textContent = 'Fetching gym list from API...';
        const gyms = await window.callApi('contest.list', { gym: true }, apiKey, apiSecret);
        await window.storage.set({ [cacheKey]: { gyms, timestamp: Date.now() } });
        return gyms;
    } catch (error) {
        progressText.textContent = `Error fetching gym list: ${error.message}`;
        return null;
    }
  };

  const getCacheDuration = (gym) => {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
    const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

    if (!gym.creationTimeSeconds) {
        return TWO_MONTHS_MS;
    }

    const gymAgeMs = Date.now() - (gym.creationTimeSeconds * 1000);

    const normalizedAge = Math.max(0, Math.min(1, gymAgeMs / THREE_YEARS_MS));

    const baseDuration = ONE_WEEK_MS + normalizedAge * (TWO_MONTHS_MS - ONE_WEEK_MS);

    const randomizationFactor = 1 + (Math.random() - 0.5) * 0.2; 
    
    return baseDuration * randomizationFactor;
  };
  
  const updateProgress = () => {
    if (totalGyms > 0) {
      progressText.textContent = `[${resultsMap.size} found] Processed ${processedCount} of ${totalGyms} gyms...`;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  };

  const formatDuration = (totalSeconds) => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // --- Rendering ---
  const renderResults = () => {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    if (resultsMap.size === 0) return;

    const resultsArray = Array.from(resultsMap.values());
    resultsArray.sort((a, b) => b.score - a.score);

    const datatableWrapper = document.createElement('div');
    datatableWrapper.className = 'datatable';
    datatableWrapper.style.marginTop = '2em';
    datatableWrapper.innerHTML = `
      <div class="lt">&nbsp;</div><div class="rt">&nbsp;</div><div class="lb">&nbsp;</div><div class="rb">&nbsp;</div>
      <div style="padding: 4px 0 0 6px;font-size:1.4rem;position:relative;">
          Recommended Gyms
      </div>
      <div style="background-color: white; margin: 0.3em 3px 0px; position: relative;">
        <div class="ilt">&nbsp;</div>
        <div class="irt">&nbsp;</div>
        <table>
          <thead>
            <tr>
              <th style="width:40%;" class="top left">Name</th>
              <th style="width:20%;" class="top">Status</th>
              <th style="width:20%;" class="top right">Friend Teams</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
    `;

    const tbody = datatableWrapper.querySelector('tbody');
    resultsArray.forEach(({ gym, score }, index) => {
      const tr = document.createElement('tr');

      // Removed startTime and duration as they are no longer displayed
      // const startTime = formatDate(gym.startTimeSeconds);
      // const duration = formatDuration(gym.durationSeconds);

      tr.innerHTML = `
        <td class="left">
          ${gym.name}<br>
          <a style="font-size: 0.8em;" href="/gym/${gym.id}">Enter »</a><br>
          <a style="font-size: 0.8em;" href="/gym/${gym.id}/virtual">Virtual participation »</a>
        </td>
        <td class="state">
          <div><a href="/gym/${gym.id}/standings">Final standings</a></div>
        </td>
        <td class="right" style="font-size:1.2em; font-weight: bold;">
          ${score}
        </td>
      `;

      if (index % 2 === 0) {
          Array.from(tr.children).forEach(td => td.classList.add('dark'));
      }

      tbody.appendChild(tr);
    });

    const lastRow = tbody.querySelector('tr:last-child');
    if (lastRow) {
        Array.from(lastRow.children).forEach(td => td.classList.add('bottom'));
    }

    resultsContainer.appendChild(datatableWrapper);
  };

  // --- Main Logic ---
  const processGyms = async () => {
    const { cfxHandle, cfxApiKey, cfxApiSecret } = await window.storage.get(['cfxHandle', 'cfxApiKey', 'cfxApiSecret']);
    if (!cfxHandle || !cfxApiKey || !cfxApiSecret) {
      progressText.textContent = 'Error: API credentials not set in options.';
      alert('Please set your handle, API key, and secret in the extension options.');
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }

    const friends = await getFriends(cfxApiKey, cfxApiSecret);
    if (friends === null) {
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }

    const submissions = await getSubmissions(cfxHandle, cfxApiKey, cfxApiSecret);
    if (submissions === null) {
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }
    const submittedContestIds = new Set(submissions.map(sub => sub.contestId));

    const allContests = await getGymList(cfxApiKey, cfxApiSecret);
    if (allContests === null) {
        findButton.disabled = false;
        findButton.textContent = 'Find Recommended Gyms';
        return;
    }
    
    const eightYearsAgo = Math.floor(Date.now() / 1000) - (8 * 365 * 24 * 60 * 60);
    const fiveHours = 5 * 60 * 60;

    const filteredGyms = allContests.filter(c => 
      c.phase === 'FINISHED' &&
      c.durationSeconds === fiveHours &&
      (c.startTimeSeconds ? c.startTimeSeconds >= eightYearsAgo : true) &&
      !submittedContestIds.has(c.id)
    );

    totalGyms = filteredGyms.length;
    processedCount = 0;
    resultsMap = new Map(); // Reset results map
    updateProgress();

    for (const gym of filteredGyms) {
      const cacheKey = `gym-cache-${gym.id}`;
      const cached = await window.storage.get(cacheKey);

      let score = 0;
      let isExpired = true;
      
      if (cached[cacheKey]) { // Check if any cache exists
        score = cached[cacheKey].score;
        if (score > 0) { // Only add to map if score > 0
            resultsMap.set(gym.id, { gym, score });
        }
        if (Date.now() < cached[cacheKey].expiry) {
            isExpired = false;
        }
      }

      if (!isExpired) { // If valid cache, just update progress
        processedCount++;
        updateProgress();
        if (processedCount % 10 === 0) {
            renderResults();
        }
      } else { // Not cached or expired, process it (and potentially update stale data)
        if (cached[cacheKey] && score > 0) { // If we had stale data with score > 0, render it now
            renderResults();
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to allow render
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 250));
          const standingsData = await window.callApi('contest.standings', { contestId: gym.id, showUnofficial: true }, cfxApiKey, cfxApiSecret);
          const standings = standingsData.rows;
          const friendTeams = new Set();
          standings.forEach(row => {
            if (row.party.participantType === 'VIRTUAL') {
              row.party.members.forEach(member => {
                if (friends.has(member.handle)) {
                  friendTeams.add(row.party.teamId || member.handle);
                }
              });
            }
          });
          score = friendTeams.size;
          
          const cacheDuration = getCacheDuration(gym);
          const expiry = Date.now() + cacheDuration;
          await window.storage.set({ [cacheKey]: { score, expiry } });

          if (score > 0) { // Only add/update if score > 0
            resultsMap.set(gym.id, { gym, score });
          } else {
            resultsMap.delete(gym.id); // If score is 0, remove it from display
          }
        } catch (error) {
          console.error(`Failed to process gym ${gym.id}:`, error);
          resultsMap.delete(gym.id); // Remove if API call fails
        } finally {
          processedCount++;
          updateProgress();
          renderResults(); // Always re-render after processing a gym
        }
      }
    }

    renderResults();
    findButton.disabled = false;
    findButton.textContent = 'Find Recommended Gyms';
    progressText.textContent = `Done! Found ${resultsMap.size} gyms.`;
  };

  const onFindClick = () => {
    findButton.disabled = true;
    findButton.textContent = 'Finding...';
    progressText.style.display = 'block';
    clearButton.style.display = 'inline-block';
    
    originalDatatable = document.querySelector('.datatable');
    originalPagination = document.querySelector('.pagination');
    if (originalDatatable) originalDatatable.style.display = 'none';
    if (originalPagination) originalPagination.style.display = 'none';

    if (!resultsContainer) {
      resultsContainer = document.createElement('div');
      originalDatatable.parentNode.insertBefore(resultsContainer, originalDatatable);
    }
    
    processGyms();
  };

  const onClearClick = () => {
    resultsMap = new Map(); // Clear results map
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (originalDatatable) originalDatatable.style.display = '';
    if (originalPagination) originalPagination.style.display = '';
    progressText.textContent = '';
    progressText.style.display = 'none';
    clearButton.style.display = 'none';
    findButton.textContent = 'Find Recommended Gyms';
  };

  // --- Initialization ---
  if (createFinderBox()) {
    findButton = document.getElementById('cfx-findGyms');
    clearButton = document.getElementById('cfx-clearResults');
    progressText = document.getElementById('cfx-progress');
    
    findButton.addEventListener('click', onFindClick);
    clearButton.addEventListener('click', onClearClick);
  }
})();