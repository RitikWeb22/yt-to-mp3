const app = require('./src/app');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();
const PORT = process.env.PORT || "https://yt-to-mp3-dmm4.onrender.com";
// Database connect
connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
