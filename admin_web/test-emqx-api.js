const http = require('http');

async function test() {
  try {
    const loginRes = await fetch('http://111.228.5.253:18083/api/v5/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'emqx_KtBQka'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login:', loginData);

    if (loginData.token) {
      const clientsRes = await fetch('http://111.228.5.253:18083/api/v5/clients', {
        headers: { 'Authorization': 'Bearer ' + loginData.token }
      });
      const clientsData = await clientsRes.json();
      console.log('Clients:', clientsData.data?.filter(c => c.connected).map(c => c.clientid));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
