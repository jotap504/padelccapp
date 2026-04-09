const bcrypt = require('bcryptjs');
console.log('Hash for "100":', bcrypt.hashSync('100', 10));
