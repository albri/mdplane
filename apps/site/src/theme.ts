// Runs before the page renders, so a chosen theme doesn't flash the system one first.
try {
  const theme = localStorage.getItem('mdplane-theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // Storage can be unavailable; the system theme applies.
}
