(function () {
  try {
    var savedTheme = localStorage.getItem('theme')
    var themes = ['dark', 'light', 'mist', 'night-feast', 'green-garden', 'golden', 'blue-pool']
    document.documentElement.dataset.theme = themes.includes(savedTheme || '') ? savedTheme : 'mist'
  } catch {
    document.documentElement.dataset.theme = 'mist'
  }

  document.addEventListener('DOMContentLoaded', function () {
    var splash = document.getElementById('startup-splash')
    var root = document.getElementById('root')
    if (!splash || !root) return

    var hide = function () {
      if (!splash.isConnected) return
      splash.classList.add('is-hidden')
      window.setTimeout(function () {
        splash.remove()
      }, 240)
    }

    if (root.childElementCount > 0) {
      window.requestAnimationFrame(hide)
      return
    }

    var observer = new MutationObserver(function () {
      if (root.childElementCount === 0) return
      observer.disconnect()
      window.requestAnimationFrame(hide)
    })
    observer.observe(root, { childList: true })
  })
})()
