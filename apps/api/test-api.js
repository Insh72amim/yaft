const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/imports',
  method: 'GET',
  headers: {
    'Cookie': process.env.COOKIE || ''
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
