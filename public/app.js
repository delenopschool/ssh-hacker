function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.token) {
      sessionStorage.setItem('token', data.token);
      showHomePage();
    } else {
      alert('Username or Password are incorrect');
    }
  });
}

function showHomePage() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'block';
  loadClients();
}

function loadClients() {
  fetch('/clients', {
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
  })
  .then(response => response.json())
  .then(clients => {
    const clientList = document.getElementById('client-list');
    clientList.innerHTML = '';
    clients.forEach(client => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `/clients/${client._id}`;
      link.innerText = `${client.clientId} - ${client.friendlyName}`;
      li.appendChild(link);
      clientList.appendChild(li);
    });
  })
  .catch(error => {
    console.error('Error:', error);
  });
}

function showClientDetails(clientId) {
  console.log('Fetching details for client:', clientId); // Debugging
  fetch(`/clients/${clientId}`, {
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
  })
  .then(response => response.text()) // Log eerst als tekst
  .then(text => {
    console.log('Raw response:', text); // Debugging
    const client = JSON.parse(text); // Vervolgens pas JSON proberen
    document.getElementById('client-id').innerText = clientId;
    document.getElementById('client-details').style.display = 'block';
  })
  .catch(error => {
    console.error('Error fetching client details:', error);
  });
}


function shutdown() {
  const clientId = document.getElementById('client-id').textContent;
  performAction(clientId, 'shutdown');
}

function reboot() {
  const clientId = document.getElementById('client-id').textContent;
  performAction(clientId, 'reboot');
}

function openWebsite() {
  const clientId = document.getElementById('client-id').textContent;
  const url = prompt('Enter website URL', 'https://berkay-blog.glitch.me/screensaver.html');
  performAction(clientId, 'openwebsite', { url });
}

function performAction(clientId, action, body = {}) {
  fetch(`/clients/${clientId}/${action}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + sessionStorage.getItem('token'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  .then(response => response.json())
  .then(data => alert(data.message));
}
