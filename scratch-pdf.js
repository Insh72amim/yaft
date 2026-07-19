const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('/Users/yaft/Code/YAFT-private-inputs/epfo_passbook.pdf');
pdf(dataBuffer).then(function(data) {
  fs.writeFileSync('/Users/yaft/Code/YAFT-private-inputs/epfo_passbook.txt', data.text);
  console.log(data.text.slice(0, 2000));
});
