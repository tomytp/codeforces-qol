(() => {
  if (!/\/((contest|gym)\/)\d+/.test(location.pathname)) return;
  console.log('[CFX] contest content script loaded');
})();

