(async function(){
  const form = document.getElementById('filterForm');
  const results = document.getElementById('results');
  const statusEl = document.getElementById('status');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageInfo = document.getElementById('pageInfo');

  let page = 1;
  const limit = 12;

  function paramsFromForm() {
    const data = new FormData(form);
    const o = Object.fromEntries(data.entries());
    o.status = 'approved';
    o.page = page;
    o.limit = limit;
    return o;
  }

  function setDisabled(btn, disabled) {
    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  async function search(pushState = true) {
    const p = paramsFromForm();
    const qs = new URLSearchParams(p).toString();
    if (pushState) history.replaceState(null, '', `?${qs}`);

    statusEl.textContent = 'Loading...';
    results.innerHTML = '';
    setDisabled(prevBtn, true);
    setDisabled(nextBtn, true);

    const res = await fetch(`/api/items?${qs}`);
    const data = await res.json();
    statusEl.textContent = `${data.total} item(s) found`;

    if (!data.items || data.items.length === 0) {
      results.innerHTML = '<p class="helper">No items match your filters. Try broadening your search.</p>';
      pageInfo.textContent = '';
      return;
    }

    results.innerHTML = data.items.map(it => `
      <article class="card item-card">
        <a href="/item.html?id=${it.id}" aria-label="View details: ${it.title}">
          <img src="${it.photo_filename ? '/uploads/' + it.photo_filename : 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22250%22><rect width=%22400%22 height=%22250%22 fill=%22%23f2f2f2%22/><text x=%2220%22 y=%22130%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2220%22>Photo not provided</text></svg>'}"
            alt="${it.title ? 'Photo of ' + it.title : 'No photo available'}">
        </a>
        <h3 style="margin:.5rem 0">${it.title}</h3>
        <div class="meta">
          <span class="badge">${it.category}</span>
          <span>Found: ${it.date_found}</span>
          <span>Location: ${it.location_found}</span>
        </div>
        <div style="margin-top:.5rem">
          <a class="btn secondary" href="/item.html?id=${it.id}">View & Claim</a>
        </div>
      </article>
    `).join('');

    const totalPages = Math.ceil(data.total / data.limit);
    pageInfo.textContent = `Page ${data.page} of ${totalPages || 1}`;
    setDisabled(prevBtn, data.page <= 1);
    setDisabled(nextBtn, data.page >= totalPages);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    page = 1;
    search();
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    form.reset(); page = 1; search();
  });

  prevBtn.addEventListener('click', () => { if (page > 1) { page -= 1; search(); } });
  nextBtn.addEventListener('click', () => { page += 1; search(); });

  // Load from URL params (deep link)
  const urlParams = new URLSearchParams(location.search);
  for (const [k,v] of urlParams.entries()) {
    const input = form.querySelector(`[name="${k}"]`);
    if (input) input.value = v;
    if (k === 'page') page = parseInt(v) || 1;
  }

  search(false);
})();
