document.addEventListener('DOMContentLoaded', (event) => {
  const debugToggle = document.querySelector('.debug-toggle');
  const body = document.body;

  debugToggle.addEventListener('change', (event) => {
    if (event.target.checked) {
      body.classList.add('debug');
    } else {
      body.classList.remove('debug');
    }
  });
});
