const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();

if (process.env.YOUTUBE_COOKIES) {
    fs.writeFileSync(path.join(__dirname, 'cookies.txt'), process.env.YOUTUBE_COOKIES, 'utf8');
    console.log('✅ Cookies written from environment');
}

const PORT = process.env.PORT;
connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
