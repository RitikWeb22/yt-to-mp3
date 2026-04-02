const express = require('express');
const cors = require('cors');
const downloadRouter = require('./routes/downloder.route');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use("/api", downloadRouter)


module.exports = app;
