const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const imagePath = 'C:/Users/JOSHUA/Desktop/test.png'; // Replace with a valid PNG path
const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
const base64Data = `data:image/png;base64,${base64Image}`;

fetch('http://localhost:3000/api/upload-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64Data })
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));