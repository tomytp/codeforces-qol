window.callApi = async function(method, params, apiKey, apiSecret) {
  // 1. Add apiKey and time to params
  const allParams = {
    ...params,
    apiKey,
    time: Math.floor(Date.now() / 1000),
  };

  // 2. Generate 6-digit random string
  const rand = Math.random().toString().slice(2, 8).padStart(6, '0');

  // 3. Create param string sorted by key
  const paramString = Object.keys(allParams)
    .sort()
    .map(key => `${key}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  // 4. Create string to hash
  const toHash = `${rand}/${method}?${paramString}#${apiSecret}`;

  // 5. Calculate signature
  const apiSig = await sha512(toHash);

  // 6. Construct final URL
  const finalUrl = `https://codeforces.com/api/${method}?${paramString}&apiSig=${rand}${apiSig}`;

  // 7. Make the call
  const response = await fetch(finalUrl);
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Codeforces API Error: ${data.comment}`);
  }

  return data.result;
}
