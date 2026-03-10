require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import DB Connection
require('./db');

const apiRoutes = require('./routes/apiRoutes');

const app = express();
app.use(cors("*"));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
