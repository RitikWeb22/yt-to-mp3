const { Router } = require('express');

const downloadRouter = Router();
const { infoController, downloadController, historyController, downloadLimiter } = require('../controllers/downloader.controller');

// info route
downloadRouter.get('/info', infoController);

// download route
downloadRouter.get('/download', downloadLimiter, downloadController);

// history route
downloadRouter.get('/history', historyController);

module.exports = downloadRouter;
