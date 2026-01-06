/**
 * Codeforces QoL - Gym Page Content Script
 * Handles Friend Gym Finder: finds gyms where friends have virtual submissions.
 */
(async () => {
  'use strict';

  if (location.pathname !== '/gyms') return;

  // Global state
  let findButton, clearButton, progressText;
  let originalDatatable, originalPagination, resultsContainer;
  let resultsMap = new Map();
  let totalGyms = 0;
  let processedCount = 0;

  // Use shared utilities (injected via manifest)
  const storage = window.storage;
  const callApi = window.callApi;

  /**
   * Create the finder sidebar box
   */
  const createFinderBox = () => {
    const sidebox = document.createElement('div');
    sidebox.className = 'roundbox sidebox';
    sidebox.innerHTML = `
      <div class="caption titled">→ Friend Gym Finder</div>
      <div style="margin: 1em;">
        <p style="font-size: 1.1rem; margin-bottom: 1em;">
          Finds 5-hour gyms from the last 8 years where your friends have virtual submissions but you do not.
        </p>
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
  };

  /**
   * Get friends list from API
   */
  const getFriends = async (apiKey, apiSecret) => {
    try {
      const friendsList = await callApi('user.friends', { onlyOnline: false }, apiKey, apiSecret);
      return new Set(friendsList);
    } catch (error) {
      progressText.textContent = `Error fetching friends: ${error.message}`;
      return null;
    }
  };

  /**
   * Get user submissions with caching
   */
  const getSubmissions = async (handle, apiKey, apiSecret) => {
    const cacheKey = `submissions-cache-${handle}`;
    const cached = await storage.get(cacheKey);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    if (cached[cacheKey]?.timestamp > twoHoursAgo) {
      progressText.textContent = 'Submissions loaded from cache.';
      await new Promise((r) => setTimeout(r, 500));
      return cached[cacheKey].submissions;
    }

    try {
      progressText.textContent = 'Fetching submissions from API (this may take a moment)...';
      const submissions = await callApi('user.status', { handle, from: 1, count: 10000 }, apiKey, apiSecret);
      await storage.set({ [cacheKey]: { submissions, timestamp: Date.now() } });
      return submissions;
    } catch (error) {
      progressText.textContent = `Error fetching submissions: ${error.message}`;
      return null;
    }
  };

  /**
   * Get gym list with caching
   */
  const getGymList = async (apiKey, apiSecret) => {
    const cacheKey = 'gym-list-cache';
    const cached = await storage.get(cacheKey);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    if (cached[cacheKey]?.timestamp > oneWeekAgo) {
      progressText.textContent = 'Gym list loaded from cache.';
      await new Promise((r) => setTimeout(r, 500));
      return cached[cacheKey].gyms;
    }

    try {
      progressText.textContent = 'Fetching gym list from API...';
      const gyms = await callApi('contest.list', { gym: true }, apiKey, apiSecret);
      await storage.set({ [cacheKey]: { gyms, timestamp: Date.now() } });
      return gyms;
    } catch (error) {
      progressText.textContent = `Error fetching gym list: ${error.message}`;
      return null;
    }
  };

  /**
   * Calculate cache duration based on gym age
   * Sliding scale: 2 weeks (newest) → 6 months (3+ years old)
   */
  const getCacheDuration = (gym) => {
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

    if (!gym.creationTimeSeconds) return SIX_MONTHS_MS;

    const gymAgeMs = Date.now() - gym.creationTimeSeconds * 1000;
    const normalizedAge = Math.max(0, Math.min(1, gymAgeMs / THREE_YEARS_MS));
    const baseDuration = TWO_WEEKS_MS + normalizedAge * (SIX_MONTHS_MS - TWO_WEEKS_MS);
    const randomizationFactor = 1 + (Math.random() - 0.5) * 0.2;

    return baseDuration * randomizationFactor;
  };

  /**
   * Update progress display
   */
  const updateProgress = () => {
    if (totalGyms > 0) {
      progressText.textContent = `[${resultsMap.size} found] Processed ${processedCount} of ${totalGyms} gyms...`;
    }
  };

  /**
   * Render results table
   */
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
      <div style="padding: 4px 0 0 6px;font-size:1.4rem;position:relative;">Recommended Gyms</div>
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
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = datatableWrapper.querySelector('tbody');
    resultsArray.forEach(({ gym, score }, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="left">
          ${gym.name}<br>
          <a style="font-size: 0.8em;" href="/gym/${gym.id}">Enter »</a><br>
          <a style="font-size: 0.8em;" href="/gym/${gym.id}/virtual">Virtual participation »</a>
        </td>
        <td class="state">
          <div><a href="/gym/${gym.id}/standings">Final standings</a></div>
        </td>
        <td class="right" style="font-size:1.2em; font-weight: bold;">${score}</td>
      `;

      if (index % 2 === 0) {
        Array.from(tr.children).forEach((td) => td.classList.add('dark'));
      }

      tbody.appendChild(tr);
    });

    const lastRow = tbody.querySelector('tr:last-child');
    if (lastRow) {
      Array.from(lastRow.children).forEach((td) => td.classList.add('bottom'));
    }

    resultsContainer.appendChild(datatableWrapper);
  };

  /**
   * Process all gyms
   */
  const processGyms = async () => {
    const { cfxHandle, cfxApiKey, cfxApiSecret } = await storage.get(['cfxHandle', 'cfxApiKey', 'cfxApiSecret']);

    if (!cfxHandle || !cfxApiKey || !cfxApiSecret) {
      progressText.textContent = 'Error: API credentials not set in options.';
      alert('Please set your handle, API key, and secret in the extension options.');
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }

    const friends = await getFriends(cfxApiKey, cfxApiSecret);
    if (!friends) {
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }

    const submissions = await getSubmissions(cfxHandle, cfxApiKey, cfxApiSecret);
    if (!submissions) {
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }
    const submittedContestIds = new Set(submissions.map((sub) => sub.contestId));

    const allContests = await getGymList(cfxApiKey, cfxApiSecret);
    if (!allContests) {
      findButton.disabled = false;
      findButton.textContent = 'Find Recommended Gyms';
      return;
    }

    const eightYearsAgo = Math.floor(Date.now() / 1000) - 8 * 365 * 24 * 60 * 60;
    const fiveHours = 5 * 60 * 60;

    const filteredGyms = allContests.filter((c) =>
      c.phase === 'FINISHED' &&
      c.durationSeconds === fiveHours &&
      (c.startTimeSeconds ? c.startTimeSeconds >= eightYearsAgo : true) &&
      !submittedContestIds.has(c.id)
    );

    totalGyms = filteredGyms.length;
    processedCount = 0;
    resultsMap = new Map();
    updateProgress();

    for (const gym of filteredGyms) {
      const cacheKey = `gym-cache-${gym.id}`;
      const cached = await storage.get(cacheKey);

      let score = 0;
      let isExpired = true;

      if (cached[cacheKey]) {
        score = cached[cacheKey].score;
        if (score > 0) resultsMap.set(gym.id, { gym, score });
        if (Date.now() < cached[cacheKey].expiry) isExpired = false;
      }

      if (!isExpired) {
        processedCount++;
        updateProgress();
        if (processedCount % 10 === 0) renderResults();
      } else {
        if (cached[cacheKey] && score > 0) {
          renderResults();
          await new Promise((r) => setTimeout(r, 50));
        }

        try {
          await new Promise((r) => setTimeout(r, 250));
          const standingsData = await callApi('contest.standings', { contestId: gym.id, showUnofficial: true }, cfxApiKey, cfxApiSecret);
          const standings = standingsData.rows;

          const friendTeams = new Set();
          standings.forEach((row) => {
            if (row.party.participantType === 'VIRTUAL') {
              row.party.members.forEach((member) => {
                if (friends.has(member.handle)) {
                  friendTeams.add(row.party.teamId || member.handle);
                }
              });
            }
          });

          score = friendTeams.size;
          const cacheDuration = getCacheDuration(gym);
          const expiry = Date.now() + cacheDuration;
          await storage.set({ [cacheKey]: { score, expiry } });

          if (score > 0) {
            resultsMap.set(gym.id, { gym, score });
          } else {
            resultsMap.delete(gym.id);
          }
        } catch (error) {
          console.error(`[CFX] Failed to process gym ${gym.id}:`, error);
          resultsMap.delete(gym.id);
        } finally {
          processedCount++;
          updateProgress();
          renderResults();
        }
      }
    }

    renderResults();
    findButton.disabled = false;
    findButton.textContent = 'Find Recommended Gyms';
    progressText.textContent = `Done! Found ${resultsMap.size} gyms.`;
  };

  /**
   * Handle find button click
   */
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

  /**
   * Handle clear button click
   */
  const onClearClick = () => {
    resultsMap = new Map();
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (originalDatatable) originalDatatable.style.display = '';
    if (originalPagination) originalPagination.style.display = '';
    progressText.textContent = '';
    progressText.style.display = 'none';
    clearButton.style.display = 'none';
    findButton.textContent = 'Find Recommended Gyms';
  };

  // Initialize
  if (createFinderBox()) {
    findButton = document.getElementById('cfx-findGyms');
    clearButton = document.getElementById('cfx-clearResults');
    progressText = document.getElementById('cfx-progress');

    findButton.addEventListener('click', onFindClick);
    clearButton.addEventListener('click', onClearClick);
  }
})();