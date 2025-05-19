import app from './src/app.js'; // Changed extension to .mjs

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; 

app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
});