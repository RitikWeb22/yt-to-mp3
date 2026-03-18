const { Router } = require('express');

const downloadRouter = Router();
const { infoController, downloadController, historyController } = require('../controllers/downloader.controller');

// info route
downloadRouter.get('/info', infoController);

// download route
downloadRouter.get('/download', downloadController);

// history route
downloadRouter.get('/history', historyController);

module.exports = downloadRouter;