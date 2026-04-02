const { Router } = require('express');

const downloadRouter = Router();
const {
    rapidApiYtMp3Controller,
    getVideoInfoController,
    downloadMp3Controller,
    getDownloadHistoryController,
} = require('../controllers/downloader.controller');

downloadRouter.get('/ytmp3', rapidApiYtMp3Controller);
downloadRouter.get('/info', getVideoInfoController);
downloadRouter.get('/download', downloadMp3Controller);
downloadRouter.get('/history', getDownloadHistoryController);

module.exports = downloadRouter;
