const express = require('express');
const dotenv = require('dotenv');
const shopifRoutes = require('./src/routes/shopifRoutes');
const myposRoutes = require('./src/routes/myposRoutes');
const authRoutes = require('./src/routes/authRoutes');

dotenv.config();
const app = express();
const port = 3000;

app.use(express.json());
app.use('/shopify', shopifRoutes);
app.use('/mypos',myposRoutes );

app.use('/auth', authRoutes);


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
