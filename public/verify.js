(function () {
  const landing = document.getElementById('landing');
  const verifyResult = document.getElementById('verify-result');
  const verifyContent = document.getElementById('verify-content');
  const verifyForm = document.getElementById('verify-form');
  const hashInput = document.getElementById('hash-input');

  const path = window.location.pathname;
  const verifyMatch = path.match(/^\/verify\/([a-f0-9]{64})$/);

  // Get secret from URL query param
  function getSecret() {
    const params = new URLSearchParams(window.location.search);
    return params.get('secret') || null;
  }

  if (verifyMatch) {
    lookupProof(verifyMatch[1], getSecret());
  }

  verifyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var hash = hashInput.value.trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(hash)) {
      window.history.pushState(null, '', '/verify/' + hash);
      lookupProof(hash, null);
    }
  });

  async function lookupProof(hash, secret) {
    landing.style.display = 'none';
    verifyResult.style.display = 'block';
    verifyContent.innerHTML = '<p style="color:#888">Looking up proof...</p>';

    try {
      var url = '/api/verify/' + hash;
      if (secret && /^[a-f0-9]{64}$/.test(secret)) {
        url += '?secret=' + secret;
      }
      var res = await fetch(url);
      var data = await res.json();

      if (!data.found) {
        verifyContent.innerHTML =
          '<div class="not-found">' +
          '<h3>No proof found</h3>' +
          '<p>No attestation record matches this hash.</p>' +
          '<p style="margin-top:12px;font-family:monospace;font-size:0.8rem;color:#555">' + escHtml(hash) + '</p>' +
          '</div>';
        return;
      }

      var statusClass = data.solana_status === 'confirmed' ? 'status-confirmed' : 'status-pending';
      var statusLabel = data.solana_status === 'pending_batch' ? 'Pending (awaiting next batch)' : data.solana_status;

      var html = '<div class="proof-card">';

      // If secret was valid, show full details
      if (data.secret_valid) {
        html += field('Status', '<span class="' + statusClass + '">' + statusLabel + '</span>');
        html += field('Combined Hash', data.combined_hash);
        html += field('Request Hash', data.request_hash);
        html += field('Response Hash', data.response_hash);
        html += field('Blinded Hash', data.blinded_hash);
        html += field('Timestamp', data.timestamp);
        html += field('Provider', data.provider);
        if (data.target_url) html += field('Target URL', data.target_url);
        if (data.response_status) html += field('Response Status', data.response_status);
      } else {
        // No secret or invalid — show limited info
        html += field('Blinded Hash', data.blinded_hash);
        html += field('Status', '<span class="' + statusClass + '">' + statusLabel + '</span>');
        if (data.secret_valid === false) {
          html += '<div style="background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:6px;padding:12px;margin:16px 0;color:#f44336;font-size:0.85rem;">Invalid secret. Only the blinded hash and batch status are shown.</div>';
        } else {
          html += '<div style="background:rgba(26,115,232,0.1);border:1px solid rgba(26,115,232,0.3);border-radius:6px;padding:12px;margin:16px 0;color:#8ab4f8;font-size:0.85rem;">This proof exists, but a valid secret is required to see full details. Add <code>?secret=your_secret</code> to the URL.</div>';
        }
      }

      if (data.batch_id) html += field('Batch ID', data.batch_id);
      if (data.merkle_root) html += field('Merkle Root', data.merkle_root);
      if (data.merkle_valid !== undefined) {
        html += field('Merkle Proof Valid', data.merkle_valid ? '<span class="status-confirmed">Yes</span>' : '<span style="color:#f44336">No</span>');
      }
      if (data.solana_signature) {
        html += field('Solana Signature', '<a href="' + escHtml(data.explorer_url) + '" target="_blank" rel="noopener">' + escHtml(data.solana_signature) + '</a>');
      }
      if (data.solana_slot) html += field('Solana Slot', data.solana_slot);
      html += field('Recorded At', data.created_at);
      html += '</div>';

      // Merkle path
      if (data.merkle_proof && data.merkle_proof.length > 0) {
        html += '<div class="proof-card" style="margin-top:16px;">';
        html += '<h3 style="margin:0 0 12px;font-size:1rem;color:#1a73e8;text-transform:none;letter-spacing:normal;">Merkle Path</h3>';
        for (var i = 0; i < data.merkle_proof.length; i++) {
          var step = data.merkle_proof[i];
          html += '<div class="proof-field"><span class="proof-label">Level ' + i + ' (' + step.position + ')</span><span class="proof-value" style="font-size:0.75rem;">' + escHtml(step.hash) + '</span></div>';
        }
        html += '</div>';
      }

      // Payloads — show readable request/response when secret is valid
      if (data.secret_valid && (data.request_body || data.response_body)) {
        html += '<div class="proof-card" style="margin-top:16px;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
        html += '<h3 style="margin:0;font-size:1rem;color:#1a73e8;text-transform:none;letter-spacing:normal;">Payloads</h3>';
        if (data.solana_status === 'confirmed') {
          html += '<a href="/api/verify/export/' + escHtml(hash) + '?secret=' + escHtml(secret) + '" class="export-btn" download>Export Bundle</a>';
        }
        html += '</div>';

        if (data.request_body) {
          html += '<div class="payload-section">';
          html += '<div class="payload-label">Request Body</div>';
          html += '<pre class="payload-content">' + formatPayload(data.request_body) + '</pre>';
          html += '</div>';
        }
        if (data.response_body) {
          html += '<div class="payload-section">';
          html += '<div class="payload-label">Response Body</div>';
          html += '<pre class="payload-content">' + formatPayload(data.response_body) + '</pre>';
          html += '</div>';
        }
        html += '</div>';
      }

      verifyContent.innerHTML = html;
    } catch (err) {
      verifyContent.innerHTML = '<p style="color:#f44336">Error looking up proof: ' + escHtml(err.message) + '</p>';
    }
  }

  function field(label, value) {
    return '<div class="proof-field"><span class="proof-label">' + label + '</span><span class="proof-value">' + value + '</span></div>';
  }

  function escHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatPayload(raw) {
    try {
      var parsed = JSON.parse(raw);
      return escHtml(JSON.stringify(parsed, null, 2));
    } catch (e) {
      return escHtml(raw);
    }
  }

  window.addEventListener('popstate', function () {
    var m = window.location.pathname.match(/^\/verify\/([a-f0-9]{64})$/);
    if (m) {
      lookupProof(m[1], getSecret());
    } else {
      landing.style.display = 'block';
      verifyResult.style.display = 'none';
    }
  });
})();
