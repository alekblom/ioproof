(function () {
  const landing = document.getElementById('landing');
  const verifyResult = document.getElementById('verify-result');
  const verifyContent = document.getElementById('verify-content');
  const verifyForm = document.getElementById('verify-form');
  const hashInput = document.getElementById('hash-input');

  const path = window.location.pathname;
  const verifyMatch = path.match(/^\/verify\/([a-f0-9]{64})$/);

  if (verifyMatch) {
    lookupProof(verifyMatch[1]);
  }

  verifyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const hash = hashInput.value.trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(hash)) {
      window.history.pushState(null, '', '/verify/' + hash);
      lookupProof(hash);
    }
  });

  async function lookupProof(hash) {
    landing.style.display = 'none';
    verifyResult.style.display = 'block';
    verifyContent.innerHTML = '<p style="color:#888">Looking up proof...</p>';

    try {
      const res = await fetch('/api/verify/' + hash);
      const data = await res.json();

      if (!data.found) {
        verifyContent.innerHTML =
          '<div class="not-found">' +
          '<h3>No proof found</h3>' +
          '<p>No attestation record matches this hash.</p>' +
          '<p style="margin-top:12px;font-family:monospace;font-size:0.8rem;color:#555">' + hash + '</p>' +
          '</div>';
        return;
      }

      var statusClass = data.solana_status === 'confirmed' ? 'status-confirmed' : 'status-pending';
      var statusLabel = data.solana_status === 'pending_batch' ? 'Pending (awaiting next batch)' : data.solana_status;

      var html =
        '<div class="proof-card">' +
        field('Combined Hash', data.combined_hash) +
        field('Request Hash', data.request_hash) +
        field('Response Hash', data.response_hash) +
        field('Timestamp', data.timestamp) +
        field('Provider', data.provider) +
        field('Status', '<span class="' + statusClass + '">' + statusLabel + '</span>');

      if (data.batch_id) {
        html += field('Batch ID', data.batch_id);
      }
      if (data.merkle_root) {
        html += field('Merkle Root', data.merkle_root);
      }
      if (data.merkle_valid !== undefined) {
        html += field('Merkle Proof Valid', data.merkle_valid ? '<span class="status-confirmed">Yes</span>' : '<span style="color:#f44336">No</span>');
      }
      if (data.solana_signature) {
        html += field('Solana Signature', '<a href="' + data.explorer_url + '" target="_blank" rel="noopener">' + data.solana_signature + '</a>');
      }
      if (data.solana_slot) {
        html += field('Solana Slot', data.solana_slot);
      }
      html += field('Recorded At', data.created_at);
      html += '</div>';

      if (data.merkle_proof && data.merkle_proof.length > 0) {
        html += '<div class="proof-card" style="margin-top:16px;">';
        html += '<h3 style="margin:0 0 12px;font-size:1rem;color:#d4a438;">Merkle Path</h3>';
        for (var i = 0; i < data.merkle_proof.length; i++) {
          var step = data.merkle_proof[i];
          html += '<div class="proof-field"><span class="proof-label">Level ' + i + ' (' + step.position + ')</span><span class="proof-value" style="font-size:0.75rem;">' + step.hash + '</span></div>';
        }
        html += '</div>';
      }

      verifyContent.innerHTML = html;
    } catch (err) {
      verifyContent.innerHTML = '<p style="color:#f44336">Error looking up proof: ' + err.message + '</p>';
    }
  }

  function field(label, value) {
    return '<div class="proof-field"><span class="proof-label">' + label + '</span><span class="proof-value">' + value + '</span></div>';
  }

  window.addEventListener('popstate', function () {
    var m = window.location.pathname.match(/^\/verify\/([a-f0-9]{64})$/);
    if (m) {
      lookupProof(m[1]);
    } else {
      landing.style.display = 'block';
      verifyResult.style.display = 'none';
    }
  });
})();
