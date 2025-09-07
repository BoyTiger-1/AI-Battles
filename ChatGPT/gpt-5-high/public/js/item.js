(async function(){
  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get('id'));
  const claimForm = document.getElementById('claimForm');
  const claimStatus = document.getElementById('claimStatus');

  async function load() {
    const res = await fetch(`/api/items/${id}`);
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('title').textContent = 'Item not found';
      return;
    }
    document.title = `${data.title} • Lost & Found`;

    const photo = document.getElementById('photo');
    if (data.photo_filename) {
      photo.src = `/uploads/${data.photo_filename}`;
      photo.alt = `Photo of ${data.title}`;
    } else {
      photo.alt = 'No photo provided';
      photo.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect width=%22400%22 height=%22300%22 fill=%22%23f2f2f2%22/></svg>';
    }

    document.getElementById('title').textContent = data.title;
    document.getElementById('category').textContent = data.category;
    document.getElementById('date_found').textContent = `Found: ${data.date_found}`;
    document.getElementById('location_found').textContent = `Location: ${data.location_found}`;
    document.getElementById('description').textContent = data.description;

    const statusMap = { pending: 'Pending review', approved: 'Available', claimed: 'Claimed', archived: 'Archived' };
    document.getElementById('statusItem').textContent = `Status: ${statusMap[data.status] || data.status}`;
  }

  claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    claimStatus.textContent = 'Submitting...';
    const fd = new FormData(claimForm);
    try {
      const res = await fetch(`/api/items/${id}/claim`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        claimStatus.textContent = data.error || 'Failed to submit claim';
        return;
      }
      claimStatus.innerHTML = '<span class="alert ok">Claim submitted! The admin will contact you if more info is needed.</span>';
      claimForm.reset();
    } catch (e) {
      console.error(e);
      claimStatus.textContent = 'Network error.';
    }
  });

  load();
})();
