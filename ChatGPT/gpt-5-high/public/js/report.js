(function(){
  const form = document.getElementById('reportForm');
  const status = document.getElementById('status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Submitting...';
    const fd = new FormData(form);

    try {
      const res = await fetch('/api/items', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.error || 'Submission failed';
        return;
      }
      status.innerHTML = '<span class="alert ok">Thank you! Your item was submitted for review.</span>';
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = 'Network error';
    }
  });
})();
