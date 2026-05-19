window.onload = function () {
  // Pre-fill default prompt texts so the form is ready to use immediately
  document.getElementById('welcomePrompt').value =
    'Welcome to our service. Please listen carefully to the following options.';
  document.getElementById('ivrPrompt').value =
    'Press 1 for Sales. Press 2 for Support.';
  document.getElementById('wrongDigitPrompt').value =
    'Sorry, that was an invalid option. Please try again.';
  document.getElementById('timeoutPrompt').value =
    'We did not receive your input. Please try again.';
};

// toastr options
toastr.options = {
  closeButton: true,
  progressBar: true,
  positionClass: 'toast-top-right',
  timeOut: '5000',
};

// POST broadcast call config to server
function initiateCall(payload, callback) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState === 4) {
      if (this.status >= 200 && this.status < 300) {
        callback(null, JSON.parse(this.responseText));
      } else {
        callback(new Error('Server returned ' + this.status), null);
      }
    }
  };
  xhttp.open('POST', '/broadcast-call/', true);
  xhttp.setRequestHeader('Content-Type', 'application/json');
  xhttp.send(JSON.stringify(payload));
}

document.getElementById('voice_call_form').addEventListener('submit', function (event) {
  event.preventDefault();

  var fromNumber       = document.getElementById('fromNumber').value.trim();
  var toNumber         = document.getElementById('toNumber').value.trim();
  var voice            = document.getElementById('voice').value;
  var language         = document.getElementById('language').value;
  var welcomePrompt    = document.getElementById('welcomePrompt').value.trim();
  var ivrPrompt        = document.getElementById('ivrPrompt').value.trim();
  var wrongDigitPrompt = document.getElementById('wrongDigitPrompt').value.trim();
  var timeoutPrompt    = document.getElementById('timeoutPrompt').value.trim();
  var digit1Number     = document.getElementById('digit1Number').value.trim();
  var digit2Number     = document.getElementById('digit2Number').value.trim();

  var msgEl = document.getElementById('message');

  if (!fromNumber || !toNumber) {
    msgEl.textContent = 'From Number and To Number are required.';
    return;
  }
  if (!digit1Number || !digit2Number) {
    msgEl.textContent = 'Both Digit-1 and Digit-2 bridge numbers are required.';
    return;
  }
  if (!welcomePrompt || !ivrPrompt) {
    msgEl.textContent = 'Welcome Prompt and IVR Menu Prompt are required.';
    return;
  }
  msgEl.textContent = '';

  var callBtn = document.getElementById('callBtn');
  callBtn.disabled = true;
  callBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Calling…';

  // Clear previous log
  document.getElementById('callLog').innerHTML = '';
  document.getElementById('callStatus').style.display = 'none';

  var payload = {
    from:             fromNumber,
    to:               toNumber,
    play_voice:       voice,
    play_language:    language,
    welcomePrompt:    welcomePrompt,
    ivrPrompt:        ivrPrompt,
    wrongDigitPrompt: wrongDigitPrompt,
    timeoutPrompt:    timeoutPrompt,
    digit1Number:     digit1Number,
    digit2Number:     digit2Number,
  };

  initiateCall(payload, function (err, response) {
    callBtn.disabled = false;
    callBtn.innerHTML = '<i class="fa fa-broadcast-tower"></i> Start Broadcast';

    if (err) {
      toastr.error('Failed to initiate broadcast. Check server logs.');
      msgEl.textContent = 'Error: ' + err.message;
      return;
    }

    toastr.success('Broadcast initiated! ID: ' + (response.broadcast_id || 'N/A'));
    document.getElementById('callStatus').style.display = 'block';
  });
});
