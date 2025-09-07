(async function(){
  const logoutLink = document.getElementById('logoutLink');
  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/admin/login.html';
  });

  async function loadStats() {
    const res = await fetch('/api/admin/stats');
    if (res.status === 401) { location.href = '/admin/login.html'; return; }
    const d = await res.json();
    document.getElementById('stats').innerHTML = `
      <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap: .5rem">
        <div class="card"><strong>Total Items:</strong> ${d.items.total}</div>
        <div class="card"><strong>Pending:</strong> ${d.items.pending}</div>
        <div class="card"><strong>Approved:</strong> ${d.items.approved}</div>
        <div class="card"><strong>Claimed:</strong> ${d.items.claimed}</div>
        <div class="card"><strong>Total Claims:</strong> ${d.claims.total}</div>
        <div class="card"><strong>New Claims:</strong> ${d.claims.new}</div>
      </div>
    `;
  }
  loadStats();

  // Change password
  const pwForm = document.getElementById('pwForm');
  const pwStatus = document.getElementById('pwStatus');
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pwStatus.textContent = 'Updating...';
    const body = { current: pwForm.current.value, next: pwForm.next.value };
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const data = await res.json();
    pwStatus.textContent = res.ok ? 'Password updated.' : (data.error || 'Failed');
    if (res.ok) pwForm.reset();
  });

  // Items
  const itemsTable = document.getElementById('itemsTable');
  const itemStatusSel = document.getElementById('itemStatus');
  const itemQ = document.getElementById('itemQ');
  document.getElementById('loadItemsBtn').addEventListener('click', loadItems);

  async function loadItems() {
    const qs = new URLSearchParams();
    if (itemStatusSel.value) qs.set('status', itemStatusSel.value);
    if (itemQ.value.trim()) qs.set('q', itemQ.value.trim());
    const res = await fetch('/api/admin/items?' + qs.toString());
    if (res.status === 401) { location.href = '/admin/login.html'; return; }
    const data = await res.json();
    itemsTable.innerHTML = data.items.map(it => `
      <tr>
        <td>${it.id}</td>
        <td><a href="/item.html?id=${it.id}" target="_blank" rel="noopener">${it.title}</a></td>
        <td>${it.category}</td>
        <td>${it.date_found}<br><span class="helper">${it.location_found || ''}</span></td>
        <td><span class="badge">${it.status}</span></td>
        <td>
          <div class="toolbar">
            <button class="btn ok" data-action="approve" data-id="${it.id}">Approve</button>
            <button class="btn warn" data-action="mark_claimed" data-id="${it.id}">Mark Claimed</button>
            <button class="btn secondary" data-action="archive" data-id="${it.id}">Archive</button>
            <button class="btn danger" data-action="delete" data-id="${it.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  itemsTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    if (action === 'delete' && !confirm('Delete this item? This removes associated claims and photos.')) return;

    if (action === 'delete') {
      const res = await fetch(`/api/admin/items/${id}`, { method: 'DELETE' });
      if (!res.ok) alert('Delete failed');
    } else {
      const res = await fetch(`/api/admin/items/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action })
      });
      if (!res.ok) alert('Update failed');
    }
    loadItems();
    loadStats();
  });

  loadItems();

  // Claims
  const claimsTable = document.getElementById('claimsTable');
  const claimStatusSel = document.getElementById('claimStatusSel');
  document.getElementById('loadClaimsBtn').addEventListener('click', loadClaims);

  async function loadClaims() {
    const qs = new URLSearchParams();
    if (claimStatusSel.value) qs.set('status', claimStatusSel.value);
    const res = await fetch('/api/admin/claims?' + qs.toString());
    if (res.status === 401) { location.href = '/admin/login.html'; return; }
    const data = await res.json();
    claimsTable.innerHTML = data.claims.map(c => `
      <tr>
        <td>${c.id}</td>
        <td><a href="/item.html?id=${c.item_id}" target="_blank" rel="noopener">${c.item_title}</a><br><span class="badge">${c.item_status}</span></td>
        <td>${c.claimant_name}</td>
        <td><a href="mailto:${c.claimant_email}">${c.claimant_email}</a></td>
        <td>${c.student_id || ''}</td>
        <td><span class="badge">${c.status}</span></td>
        <td>
          <div class="toolbar">
            ${['new','in_review','approved','rejected','resolved'].map(s => `
              <button class="btn ${s==='approved'?'ok':s==='rejected'?'danger':s==='in_review'?'secondary':'secondary'}"
                      data-claim="${c.id}" data-status="${s}">${s.replace('_',' ')}</button>`).join('')}
          </div>
        </td>
      </tr>
    `).join('');
  }

  claimsTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-claim]');
    if (!btn) return;
    const id = btn.getAttribute('data-claim');
    const status = btn.getAttribute('data-status');
    const res = await fetch(`/api/admin/claims/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status })
    });
    if (!res.ok) alert('Update failed');
    loadClaims();
    loadStats();
  });

  loadClaims();
})();
