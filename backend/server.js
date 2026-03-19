const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();

if (process.env.YOUTUBE_COOKIES) {
    try {
        fs.writeFileSync(path.join(__dirname, 'cookies.txt'), process.env.YOUTUBE_COOKIES, 'utf8');
        console.log('Cookies written from environment');
    } catch (error) {
        console.error('Failed to write cookies file:', error.message);
    }
}

const PORT = process.env.PORT || 3000;
connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
